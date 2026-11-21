import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized } from "@/db/init";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * حفظ ربط المادة بالصفوف — المادة تظهر فقط في الصفوف المرتبطة
 * (grade_label مثل «الصف الثالث المتوسط») في الرصد والتقارير والتصدير.
 */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  const { id } = await ctx.params;
  const subjectId = Number(id);

  const owner = await db.execute(
    sql`SELECT 1 FROM subjects WHERE id = ${subjectId} AND teacher_id = ${session.sub} LIMIT 1`
  );
  if (owner.rows.length === 0) {
    return Response.json({ ok: false, error: "المادة غير موجودة" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const gradeLabels = Array.isArray(body?.gradeLabels)
    ? (body.gradeLabels as unknown[]).map((v) => String(v).trim()).filter(Boolean).slice(0, 50)
    : [];

  await db.execute(sql`DELETE FROM subject_grade_links WHERE subject_id = ${subjectId}`);
  for (const label of gradeLabels) {
    await db.execute(sql`
      INSERT INTO subject_grade_links (subject_id, grade_label)
      VALUES (${subjectId}, ${label})
      ON CONFLICT (subject_id, grade_label) DO NOTHING
    `);
  }

  return Response.json({ ok: true, gradeLabels });
}
