import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized } from "@/db/init";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * ملخص العام لكل طالب: درجات الفترات الأربع (فصل×فترة) × مجموع كل فصل
 * × مجموع الفصلين × المتوسط — مادة واحدة في فصل محدد، للمعلم المالك فقط.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  const url = new URL(req.url);
  const classId = Number(url.searchParams.get("classId"));
  const subjectId = Number(url.searchParams.get("subjectId"));
  if (!classId || !subjectId) {
    return Response.json({ ok: false, error: "الفصل والمادة مطلوبان" }, { status: 400 });
  }

  const [classOwn, subjectOwn] = await Promise.all([
    db.execute(sql`SELECT 1 FROM classes WHERE id = ${classId} AND teacher_id = ${session.sub} LIMIT 1`),
    db.execute(sql`SELECT 1 FROM subjects WHERE id = ${subjectId} AND teacher_id = ${session.sub} LIMIT 1`),
  ]);
  if (classOwn.rows.length === 0 || subjectOwn.rows.length === 0) {
    return Response.json({ ok: false, error: "الفصل أو المادة غير موجودان" }, { status: 404 });
  }
  const linkCheck = await db.execute(sql`
    SELECT 1 FROM subject_class_links WHERE subject_id = ${subjectId} AND class_id = ${classId} LIMIT 1
  `);
  if (linkCheck.rows.length === 0) {
    return Response.json({ ok: false, error: "هذه المادة غير مرتبطة بهذا الفصل", notLinked: true }, { status: 400 });
  }

  const students = await db.execute(sql`
    SELECT id, full_name, national_id FROM students
    WHERE class_id = ${classId} ORDER BY full_name ASC
  `);
  const studentIds = students.rows
    .map((r) => Number((r as { id: number }).id))
    .filter((n) => Number.isFinite(n));

  type Cell = { s1p1: number; s1p2: number; s2p1: number; s2p2: number };
  const cells: Record<number, Cell> = {};
  for (const s of students.rows) cells[Number((s as { id: number }).id)] = { s1p1: 0, s1p2: 0, s2p1: 0, s2p2: 0 };

  if (studentIds.length > 0) {
    const idList = studentIds.map((n) => Math.trunc(n)).join(",");
    const g = await db.execute(sql`
      SELECT g.student_id, g.semester, g.period, COALESCE(SUM(g.value), 0)::float AS total
      FROM grades g
      JOIN grade_components gc ON gc.id = g.component_id AND gc.is_active = TRUE
      WHERE g.student_id = ANY(ARRAY[${sql.raw(idList)}]::int[])
        AND gc.subject_id = ${subjectId} AND g.value IS NOT NULL
      GROUP BY g.student_id, g.semester, g.period
    `);
    for (const row of g.rows as Array<{ student_id: number; semester: number; period: number; total: number }>) {
      const c = cells[Number(row.student_id)];
      if (!c) continue;
      if (row.semester === 1 && row.period === 1) c.s1p1 = Number(row.total);
      else if (row.semester === 1 && row.period === 2) c.s1p2 = Number(row.total);
      else if (row.semester === 2 && row.period === 1) c.s2p1 = Number(row.total);
      else if (row.semester === 2 && row.period === 2) c.s2p2 = Number(row.total);
    }
  }

  const periodsMax = await db.execute<{ active_max: string }>(sql`
    SELECT COALESCE(SUM(max_score), 0)::text AS active_max
    FROM grade_components WHERE subject_id = ${subjectId} AND is_active = TRUE
  `);
  const periodMax = Number(periodsMax.rows[0]?.active_max ?? "100");

  const rows = students.rows.map((s) => {
    const id = Number((s as { id: number }).id);
    const c = cells[id];
    const sem1 = c.s1p1 + c.s1p2;
    const sem2 = c.s2p1 + c.s2p2;
    const yearTotal = sem1 + sem2;
    const avg = yearTotal / 4;
    const percent = periodMax > 0 ? (avg / periodMax) * 100 : 0;
    return { s, ...c, sem1, sem2, yearTotal, avg, percent, yearMax: periodMax * 4, semMax: periodMax * 2 };
  });

  return Response.json({ ok: true, rows, periodMax });
}
