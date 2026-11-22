import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized } from "@/db/init";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** ربط جميع مواد المعلم النشطة بصف هذا الفصل (grade_label) — بطلب صريح من المعلم */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  const { id } = await ctx.params;
  const classId = Number(id);

  const classRow = await db.execute<{ grade_label: string }>(
    sql`SELECT grade_label FROM classes WHERE id = ${classId} AND teacher_id = ${session.sub} LIMIT 1`
  );
  if (classRow.rows.length === 0) {
    return Response.json({ ok: false, error: "الفصل غير موجود" }, { status: 404 });
  }
  const gradeLabel = classRow.rows[0].grade_label;

  const result = await db.execute<{ linked: number }>(sql`
    WITH ins AS (
      INSERT INTO subject_grade_links (subject_id, grade_label)
      SELECT s.id, ${gradeLabel}
      FROM subjects s
      WHERE s.teacher_id = ${session.sub} AND s.is_active = TRUE
      ON CONFLICT (subject_id, grade_label) DO NOTHING
      RETURNING subject_id
    )
    SELECT COUNT(*)::int AS linked FROM ins
  `);
  const linked = Number(result.rows[0]?.linked ?? 0);
  return Response.json({ ok: true, linked, gradeLabel });
}
