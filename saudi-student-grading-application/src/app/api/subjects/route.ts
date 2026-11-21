import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized } from "@/db/init";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DEFAULT_COMPONENTS = [
  { name: "المهام الأدائية", category: "formative", maxScore: 20, weightLabel: "أداء عملي", sortOrder: 1 },
  { name: "المشاركة والتفاعل الصفي", category: "formative", maxScore: 15, weightLabel: "", sortOrder: 2 },
  { name: "الواجبات والتطبيقات", category: "formative", maxScore: 10, weightLabel: "", sortOrder: 3 },
  { name: "الاختبار القصير", category: "formative", maxScore: 15, weightLabel: "تحريري", sortOrder: 4 },
  { name: "الاختبار النهائي — تحريري", category: "final", maxScore: 30, weightLabel: "نهائي", sortOrder: 5 },
  { name: "الاختبار النهائي — عملي / شفهي", category: "final", maxScore: 10, weightLabel: "نهائي", sortOrder: 6 },
];

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  const subjects = await db.execute(sql`
    SELECT s.id, s.name, s.max_total, s.pass_score, s.color, s.sort_order, s.is_active,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', gc.id, 'name', gc.name, 'category', gc.category,
          'maxScore', gc.max_score::float, 'weightLabel', gc.weight_label,
          'isActive', gc.is_active, 'sortOrder', gc.sort_order
        ) ORDER BY gc.sort_order ASC, gc.id ASC)
        FROM grade_components gc WHERE gc.subject_id = s.id
      ), '[]'::json) AS components
    FROM subjects s
    WHERE s.teacher_id = ${session.sub}
    ORDER BY s.sort_order ASC, s.id ASC
  `);
  return Response.json({ ok: true, subjects: subjects.rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  const color = String(body?.color ?? "#0e5c3a");
  const withDefaults = body?.withDefaults !== false;
  if (!name) return Response.json({ ok: false, error: "أدخل اسم المادة" }, { status: 400 });

  const inserted = await db.execute<{ id: number }>(sql`
    INSERT INTO subjects (teacher_id, name, max_total, pass_score, color, sort_order)
    VALUES (${session.sub}, ${name}, 100, 50, ${color}, COALESCE((SELECT MAX(sort_order) + 1 FROM subjects WHERE teacher_id = ${session.sub}), 1))
    RETURNING id
  `);
  const subjectId = inserted.rows[0]?.id;
  if (subjectId && withDefaults) {
    for (const c of DEFAULT_COMPONENTS) {
      await db.execute(sql`
        INSERT INTO grade_components (subject_id, name, category, max_score, weight_label, is_active, sort_order)
        VALUES (${subjectId}, ${c.name}, ${c.category}, ${c.maxScore}, ${c.weightLabel}, TRUE, ${c.sortOrder})
      `);
    }
  }
  return Response.json({ ok: true, id: subjectId }, { status: 201 });
}
