import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized } from "@/db/init";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SEMESTERS = new Set([1, 2]);
const PERIODS = new Set([1, 2]);
const cleanAxis = (v: string | null, allowed: Set<number>): number => {
  const n = Number(v);
  return allowed.has(n) ? n : 1;
};

/** بيانات شبكة الرصد: طلاب الفصل + خانات المادة + الدرجات (حسب الفصل الدراسي والفترة) */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  const url = new URL(req.url);
  const classId = Number(url.searchParams.get("classId"));
  const subjectId = Number(url.searchParams.get("subjectId"));
  const semester = cleanAxis(url.searchParams.get("semester"), SEMESTERS);
  const period = cleanAxis(url.searchParams.get("period"), PERIODS);
  if (!classId || !subjectId) {
    return Response.json({ ok: false, error: "الفصل والمادة مطلوبان" }, { status: 400 });
  }

  // تحقق الملكية: الفصل والمادة يخصان المعلم نفسه
  const [classOwn, subjectOwn] = await Promise.all([
    db.execute(sql`SELECT 1 FROM classes WHERE id = ${classId} AND teacher_id = ${session.sub} LIMIT 1`),
    db.execute(sql`SELECT 1 FROM subjects WHERE id = ${subjectId} AND teacher_id = ${session.sub} LIMIT 1`),
  ]);
  if (classOwn.rows.length === 0 || subjectOwn.rows.length === 0) {
    return Response.json({ ok: false, error: "الفصل أو المادة غير موجودان" }, { status: 404 });
  }

  // تحقق الربط: المادة مرتبطة بهذا الفصل تحديداً
  const linkCheck = await db.execute(sql`
    SELECT 1 FROM subject_class_links WHERE subject_id = ${subjectId} AND class_id = ${classId} LIMIT 1
  `);
  if (linkCheck.rows.length === 0) {
    return Response.json({ ok: false, error: "هذه المادة غير مرتبطة بهذا الفصل — اربطها من صفحة المواد والتوزيع", notLinked: true }, { status: 400 });
  }

  const [students, subject, components, bandsRow] = await Promise.all([
    db.execute(sql`
      SELECT id, full_name, national_id FROM students
      WHERE class_id = ${classId} ORDER BY full_name ASC
    `),
    db.execute(sql`
      SELECT id, name, max_total, pass_score, color FROM subjects WHERE id = ${subjectId}
    `),
    db.execute(sql`
      SELECT id, name, category, max_score::float AS max_score, weight_label, is_active, sort_order
      FROM grade_components WHERE subject_id = ${subjectId}
      ORDER BY sort_order ASC, id ASC
    `),
    db.execute(sql`
      SELECT band_excellent_min, band_very_good_min, band_good_min, band_pass_min
      FROM teachers WHERE id = ${session.sub} LIMIT 1
    `),
  ]);

  const studentIds = students.rows
    .map((r) => Number((r as { id: number }).id))
    .filter((n) => Number.isFinite(n));
  let gradesRows: Array<{ student_id: number; component_id: number; value: string | null }> = [];
  if (studentIds.length > 0) {
    const idList = studentIds.map((n) => Math.trunc(n)).join(",");
    const g = await db.execute(sql`
      SELECT student_id, component_id, value FROM grades
      WHERE student_id = ANY(ARRAY[${sql.raw(idList)}]::int[])
        AND semester = ${semester} AND period = ${period}
    `);
    gradesRows = g.rows as unknown as typeof gradesRows;
  }

  const gradesMap: Record<number, Record<number, number | null>> = {};
  for (const row of gradesRows) {
    (gradesMap[row.student_id] ??= {})[row.component_id] =
      row.value === null ? null : Number(row.value);
  }

  const br = (bandsRow.rows[0] ?? {}) as Record<string, number>;
  return Response.json({
    ok: true,
    semester,
    period,
    students: students.rows,
    subject: subject.rows[0] ?? null,
    components: components.rows,
    grades: gradesMap,
    bands: {
      excellent: Number(br.band_excellent_min ?? 90),
      veryGood: Number(br.band_very_good_min ?? 80),
      good: Number(br.band_good_min ?? 70),
      pass: Number(br.band_pass_min ?? 60),
    },
  });
}

/** حفظ جماعي تلقائي (Auto-save) — يقبل فقط خانات وطلاب المعلم نفسه، وللفصل/الفترة المحددين */
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  const body = await req.json().catch(() => ({}));
  const semester = cleanAxis(body?.semester !== undefined ? String(body.semester) : null, SEMESTERS);
  const period = cleanAxis(body?.period !== undefined ? String(body.period) : null, PERIODS);
  const entries = Array.isArray(body?.entries)
    ? (body.entries as Array<{ studentId: unknown; componentId: unknown; value: unknown }>)
    : null;
  if (!entries || entries.length === 0) {
    return Response.json({ ok: true, saved: 0 });
  }
  if (entries.length > 2000) {
    return Response.json({ ok: false, error: "دفعة كبيرة جداً" }, { status: 400 });
  }

  // مجموعات الطلاب والخانات المملوكة لهذا المعلم
  const [ownedStudents, ownedComponents] = await Promise.all([
    db.execute<{ id: number }>(sql`
      SELECT s.id FROM students s JOIN classes c ON c.id = s.class_id WHERE c.teacher_id = ${session.sub}
    `),
    db.execute<{ id: number }>(sql`
      SELECT gc.id FROM grade_components gc JOIN subjects s ON s.id = gc.subject_id WHERE s.teacher_id = ${session.sub}
    `),
  ]);
  const studentSet = new Set(ownedStudents.rows.map((r) => Number(r.id)));
  const componentSet = new Set(ownedComponents.rows.map((r) => Number(r.id)));

  let saved = 0;
  for (const e of entries) {
    const studentId = Number(e.studentId);
    const componentId = Number(e.componentId);
    if (!studentSet.has(studentId) || !componentSet.has(componentId)) continue;
    const raw = e.value;
    const value =
      raw === null || raw === undefined || raw === "" ? null : Math.max(0, Number(raw));
    if (value !== null && Number.isNaN(value)) continue;
    if (value === null) {
      await db.execute(sql`
        DELETE FROM grades WHERE student_id = ${studentId} AND component_id = ${componentId}
          AND semester = ${semester} AND period = ${period}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO grades (student_id, component_id, semester, period, value, updated_at)
        VALUES (${studentId}, ${componentId}, ${semester}, ${period}, ${value}, now())
        ON CONFLICT (student_id, component_id, semester, period)
        DO UPDATE SET value = EXCLUDED.value, updated_at = now()
      `);
    }
    saved++;
  }

  // نسخة احتياطية تلقائية (خفيفة: تُهمل إذا كانت آخر نسخة أحدث من 10 دقائق)
  if (saved > 0) {
    void import("@/lib/backup").then((m) => m.saveAutoSnapshot(session.sub)).catch(() => {});
  }

  return Response.json({ ok: true, saved, at: new Date().toISOString() });
}
