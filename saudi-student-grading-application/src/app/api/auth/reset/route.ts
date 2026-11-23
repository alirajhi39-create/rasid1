import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized } from "@/db/init";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

/** التحقق من صحة رمز الاستعادة (قبل عرض نموذج التعيين) */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token) return Response.json({ ok: false, error: "الرمز غير صالح" }, { status: 400 });
  const rows = await db.execute<{ id: number; full_name: string; expires: string }>(sql`
    SELECT id, full_name, reset_token_expires::text AS expires FROM teachers
    WHERE reset_token_hash = ${sha256(token)} AND reset_token_expires > now()
    LIMIT 1
  `);
  if (!rows.rows[0]) {
    return Response.json({ ok: false, error: "الرمز غير صالح أو منتهي الصلاحية — اطلب رابطاً جديداً" }, { status: 400 });
  }
  return Response.json({ ok: true, name: rows.rows[0].full_name });
}

/** تعيين كلمة مرور جديدة بالرمز */
export async function POST(req: Request) {
  try {
    await ensureInitialized();
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? "");
    const password = String(body?.password ?? "");
    if (!token || password.length < 6) {
      return Response.json({ ok: false, error: "أدخل كلمة مرور جديدة (6 أحرف فأكثر)" }, { status: 400 });
    }
    const rows = await db.execute<{ id: number }>(sql`
      SELECT id FROM teachers WHERE reset_token_hash = ${sha256(token)} AND reset_token_expires > now()
      LIMIT 1
    `);
    const teacher = rows.rows[0];
    if (!teacher) {
      return Response.json({ ok: false, error: "الرمز غير صالح أو منتهي الصلاحية — اطلب رابطاً جديداً" }, { status: 400 });
    }
    const hash = await hashPassword(password);
    await db.execute(sql`
      UPDATE teachers SET password_hash = ${hash}, reset_token_hash = NULL, reset_token_expires = NULL
      WHERE id = ${teacher.id}
    `);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("reset error", err);
    return Response.json({ ok: false, error: "تعذر المعالجة" }, { status: 500 });
  }
}
