import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized } from "@/db/init";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  const rows = await db.execute(sql`
    SELECT c.id, c.name, c.grade_label, c.stage, c.sort_order,
           COUNT(s.id)::int AS student_count,
           (SELECT COUNT(DISTINCT l.subject_id)::int
              FROM subject_grade_links l
              JOIN subjects s ON s.id = l.subject_id AND s.teacher_id = c.teacher_id AND s.is_active = TRUE
             WHERE l.grade_label = c.grade_label) AS subject_count,
           (SELECT COUNT(*)::int FROM subjects s WHERE s.teacher_id = c.teacher_id AND s.is_active = TRUE) AS total_subjects
    FROM classes c
    LEFT JOIN students s ON s.class_id = c.id
    WHERE c.teacher_id = ${session.sub}
    GROUP BY c.id
    ORDER BY c.sort_order ASC, c.id ASC
  `);
  return Response.json({ ok: true, classes: rows.rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  const gradeLabel = String(body?.gradeLabel ?? "").trim();
  const stage = String(body?.stage ?? "متوسط").trim();
  if (!name || !gradeLabel) {
    return Response.json({ ok: false, error: "أكمل اسم الفصل والصف" }, { status: 400 });
  }
  const inserted = await db.execute(sql`
    INSERT INTO classes (teacher_id, name, grade_label, stage, sort_order)
    VALUES (${session.sub}, ${name}, ${gradeLabel}, ${stage}, COALESCE((SELECT MAX(sort_order) + 1 FROM classes WHERE teacher_id = ${session.sub}), 1))
    RETURNING id, name, grade_label, stage
  `);
  return Response.json({ ok: true, class: inserted.rows[0] }, { status: 201 });
}
