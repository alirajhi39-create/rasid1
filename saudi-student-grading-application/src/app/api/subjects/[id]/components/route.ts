import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized } from "@/db/init";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

type IncomingComponent = {
  id?: unknown;
  name?: unknown;
  category?: unknown;
  maxScore?: unknown;
  weightLabel?: unknown;
  isActive?: unknown;
};

/**
 * حفظ توزيع الدرجات للمادة دفعة واحدة.
 * يستلم القائمة الكاملة للخانات: يُنشئ الجديد، يحدّث الموجود، ويحذف ما اختفى.
 */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  const { id } = await ctx.params;
  const subjectId = Number(id);

  const owner = await db.execute(sql`SELECT 1 FROM subjects WHERE id = ${subjectId} AND teacher_id = ${session.sub} LIMIT 1`);
  if (owner.rows.length === 0) {
    return Response.json({ ok: false, error: "المادة غير موجودة" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const components = Array.isArray(body?.components) ? (body.components as IncomingComponent[]) : null;
  if (!components) {
    return Response.json({ ok: false, error: "قائمة الخانات مطلوبة" }, { status: 400 });
  }

  const cleaned = components
    .map((c, i) => ({
      id: c.id ? Number(c.id) : null,
      name: String(c.name ?? "").trim(),
      category: ["formative", "final", "custom"].includes(String(c.category)) ? String(c.category) : "custom",
      maxScore: Math.max(0, Math.min(1000, Number(c.maxScore) || 0)),
      weightLabel: String(c.weightLabel ?? "").trim(),
      isActive: c.isActive !== false,
      sortOrder: i + 1,
    }))
    .filter((c) => c.name.length > 0);

  const keepIds = cleaned.filter((c) => c.id).map((c) => c.id as number);

  // حذف الخانات التي أُزيلت من القائمة (المصفوفة تُبنى من أعداد صحيحة موثوقة فقط)
  const keepList = keepIds.map((n) => Math.trunc(Number(n))).filter((n) => Number.isFinite(n)).join(",");
  if (keepList) {
    await db.execute(sql`
      DELETE FROM grade_components
      WHERE subject_id = ${subjectId} AND id NOT IN (SELECT unnest(ARRAY[${sql.raw(keepList)}]::int[]))
    `);
  } else {
    await db.execute(sql`DELETE FROM grade_components WHERE subject_id = ${subjectId}`);
  }

  // إنشاء/تحديث
  for (const c of cleaned) {
    if (c.id) {
      await db.execute(sql`
        UPDATE grade_components SET
          name = ${c.name}, category = ${c.category}, max_score = ${c.maxScore},
          weight_label = ${c.weightLabel}, is_active = ${c.isActive}, sort_order = ${c.sortOrder}
        WHERE id = ${c.id} AND subject_id = ${subjectId}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO grade_components (subject_id, name, category, max_score, weight_label, is_active, sort_order)
        VALUES (${subjectId}, ${c.name}, ${c.category}, ${c.maxScore}, ${c.weightLabel}, ${c.isActive}, ${c.sortOrder})
      `);
    }
  }

  // مزامنة العظمى الكلية للمادة مع مجموع الخانات المفعّلة
  const totalRow = await db.execute<{ total: string }>(sql`
    SELECT COALESCE(SUM(max_score), 0)::text AS total FROM grade_components
    WHERE subject_id = ${subjectId} AND is_active = TRUE
  `);
  const total = Number(totalRow.rows[0]?.total ?? "0");
  await db.execute(sql`UPDATE subjects SET max_total = ${total} WHERE id = ${subjectId}`);

  return Response.json({ ok: true, maxTotal: total });
}
