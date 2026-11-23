import { sql } from "drizzle-orm";
import { db } from "@/db";

// ============================================================
//  النسخ الاحتياطي: لقطة كاملة لمساحة عمل المعلم
//  (المدرسة، الفصول، الطلاب، المواد وخاناتها وروابطها، وكل الدرجات)
// ============================================================

export type BackupSnapshot = {
  app: "rased";
  version: 1;
  exportedAt: string;
  teacher: Record<string, string>;
  classes: Array<{ id: number; name: string; gradeLabel: string; stage: string; sortOrder: number }>;
  students: Array<{
    id: number; fullName: string; nationalId: string; guardianPhone: string;
    gender: string; notes: string; classId: number;
  }>;
  subjects: Array<{
    id: number; name: string; maxTotal: number; passScore: number; color: string;
    sortOrder: number; isActive: boolean; classIds: number[];
    components: Array<{ id: number; name: string; category: string; maxScore: number; weightLabel: string; isActive: boolean; sortOrder: number }>;
  }>;
  grades: Array<{ studentId: number; componentId: number; semester: number; period: number; value: number | null }>;
};

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** بناء لقطة كاملة لمساحة عمل المعلم */
export async function buildSnapshot(teacherId: number): Promise<BackupSnapshot> {
  const [teacher, classes, students, subjects, components, classLinks, grades] = await Promise.all([
    db.execute(sql`
      SELECT full_name, job_title, school_name, education_admin, education_office,
             city, principal_name, academic_year, semester, stage
      FROM teachers WHERE id = ${teacherId}
    `),
    db.execute(sql`
      SELECT id, name, grade_label, stage, sort_order FROM classes
      WHERE teacher_id = ${teacherId} ORDER BY sort_order ASC, id ASC
    `),
    db.execute(sql`
      SELECT id, full_name, national_id, guardian_phone, gender, notes, class_id
      FROM students WHERE class_id IN (SELECT id FROM classes WHERE teacher_id = ${teacherId})
      ORDER BY id ASC
    `),
    db.execute(sql`
      SELECT id, name, max_total, pass_score, color, sort_order, is_active
      FROM subjects WHERE teacher_id = ${teacherId} ORDER BY sort_order ASC, id ASC
    `),
    db.execute(sql`
      SELECT id, subject_id, name, category, max_score, weight_label, is_active, sort_order
      FROM grade_components WHERE subject_id IN (SELECT id FROM subjects WHERE teacher_id = ${teacherId})
      ORDER BY sort_order ASC, id ASC
    `),
    db.execute(sql`
      SELECT l.subject_id, l.class_id FROM subject_class_links l
      JOIN subjects s ON s.id = l.subject_id WHERE s.teacher_id = ${teacherId}
      ORDER BY l.subject_id, l.class_id
    `),
    db.execute(sql`
      SELECT g.student_id, g.component_id, g.semester, g.period, g.value
      FROM grades g
      JOIN students s ON s.id = g.student_id
      JOIN classes c ON c.id = s.class_id AND c.teacher_id = ${teacherId}
      JOIN grade_components gc ON gc.id = g.component_id
      JOIN subjects sb ON sb.id = gc.subject_id AND sb.teacher_id = ${teacherId}
      ORDER BY g.student_id, g.component_id, g.semester, g.period
    `),
  ]);

  const linksBySubject = new Map<number, number[]>();
  for (const row of classLinks.rows as Array<{ subject_id: number; class_id: number }>) {
    (linksBySubject.get(row.subject_id) ?? linksBySubject.set(row.subject_id, []).get(row.subject_id)!).push(row.class_id);
  }

  const componentsBySubject = new Map<number, BackupSnapshot["subjects"][number]["components"]>();
  for (const row of components.rows as Array<{
    id: number; subject_id: number; name: string; category: string;
    max_score: string; weight_label: string; is_active: boolean; sort_order: number;
  }>) {
    const list = componentsBySubject.get(row.subject_id) ?? [];
    list.push({
      id: row.id, name: row.name,
      category: row.category === "performance" ? "performance" : "written",
      maxScore: num(row.max_score), weightLabel: row.weight_label,
      isActive: Boolean(row.is_active), sortOrder: row.sort_order,
    });
    componentsBySubject.set(row.subject_id, list);
  }

  return {
    app: "rased",
    version: 1,
    exportedAt: new Date().toISOString(),
    teacher: (teacher.rows[0] ?? {}) as Record<string, string>,
    classes: (classes.rows as Array<Record<string, unknown>>).map((r) => ({
      id: num(r.id), name: String(r.name ?? ""), gradeLabel: String(r.grade_label ?? ""),
      stage: String(r.stage ?? "متوسط"), sortOrder: num(r.sort_order),
    })),
    students: (students.rows as Array<Record<string, unknown>>).map((r) => ({
      id: num(r.id), fullName: String(r.full_name ?? ""), nationalId: String(r.national_id ?? ""),
      guardianPhone: String(r.guardian_phone ?? ""), gender: String(r.gender ?? "ذكر"),
      notes: String(r.notes ?? ""), classId: num(r.class_id),
    })),
    subjects: (subjects.rows as Array<Record<string, unknown>>).map((r) => ({
      id: num(r.id), name: String(r.name ?? ""), maxTotal: num(r.max_total), passScore: num(r.pass_score),
      color: String(r.color ?? "#0e5c3a"), sortOrder: num(r.sort_order), isActive: Boolean(r.is_active),
      classIds: linksBySubject.get(num(r.id)) ?? [],
      components: componentsBySubject.get(num(r.id)) ?? [],
    })),
    grades: (grades.rows as Array<Record<string, unknown>>).map((r) => ({
      studentId: num(r.student_id), componentId: num(r.component_id),
      semester: r.semester === 2 ? 2 : 1, period: r.period === 2 ? 2 : 1,
      value: r.value === null ? null : num(r.value),
    })),
  };
}

const AUTOSAVE_INTERVAL_MS = 10 * 60 * 1000; // 10 دقائق
const KEEP_LAST = 5;

/** حفظ نسخة تلقائية (مع خنق: تُهمل إذا كانت آخر نسخة أحدث من 10 دقائق) */
export async function saveAutoSnapshot(teacherId: number): Promise<void> {
  try {
    const last = await db.execute<{ at: string }>(sql`
      SELECT created_at::text AS at FROM backups WHERE teacher_id = ${teacherId}
      ORDER BY created_at DESC LIMIT 1
    `);
    const lastAt = last.rows[0]?.at ? new Date(last.rows[0].at).getTime() : 0;
    if (Date.now() - lastAt < AUTOSAVE_INTERVAL_MS) return;

    const snap = await buildSnapshot(teacherId);
    await db.execute(sql`
      INSERT INTO backups (teacher_id, payload)
      VALUES (${teacherId}, ${JSON.stringify(snap)}::jsonb)
    `);
    await db.execute(sql`
      DELETE FROM backups
      WHERE teacher_id = ${teacherId}
        AND id NOT IN (SELECT id FROM backups WHERE teacher_id = ${teacherId} ORDER BY created_at DESC LIMIT ${KEEP_LAST})
    `);
  } catch (err) {
    console.error("auto snapshot failed", err);
  }
}

/** لقطة تلقائية أخيرة (أو null) */
export async function latestAutoSnapshot(teacherId: number): Promise<{ createdAt: string; snapshot: BackupSnapshot } | null> {
  const row = await db.execute<{ at: string; payload: BackupSnapshot }>(sql`
    SELECT created_at::text AS at, payload FROM backups
    WHERE teacher_id = ${teacherId} ORDER BY created_at DESC LIMIT 1
  `);
  if (!row.rows[0]) return null;
  const payload = row.rows[0].payload;
  return { createdAt: row.rows[0].at, snapshot: (typeof payload === "string" ? JSON.parse(payload) : payload) as BackupSnapshot };
}
