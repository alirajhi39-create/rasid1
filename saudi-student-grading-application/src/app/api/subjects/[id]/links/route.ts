import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized } from "@/db/init";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * حفظ ربط المادة بالفصول — المادة تظهر فقط في الفصول المرتبطة بها.
 * يستلم قائمة معرّفات الفصول (classIds) الخاصة بالمعلم نفسه.
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
  const rawClassIds = Array.isArray(body?.classIds) ? (body.classIds as unknown[]) : [];

  // نتحقق أن كل فصل مملوك للمعلم نفسه
  const owned = await db.execute<{ id: number }>(
    sql`SELECT id FROM classes WHERE teacher_id = ${session.sub}`
  );
  const ownedSet = new Set(owned.rows.map((r) => Number(r.id)));
  const classIds = [...new Set(rawClassIds.map((v) => Math.trunc(Number(v))).filter((n) => ownedSet.has(n)))].slice(0, 100);

  await db.execute(sql`DELETE FROM subject_class_links WHERE subject_id = ${subjectId}`);
  for (const classId of classIds) {
    await db.execute(sql`
      INSERT INTO subject_class_links (subject_id, class_id)
      VALUES (${subjectId}, ${classId})
      ON CONFLICT (subject_id, class_id) DO NOTHING
    `);
  }

  return Response.json({ ok: true, classIds });
}
