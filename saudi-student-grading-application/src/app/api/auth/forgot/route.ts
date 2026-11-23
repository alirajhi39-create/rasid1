import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized } from "@/db/init";
import { sendResetEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
const TOKEN_TTL_MS = 60 * 60 * 1000; // ساعة واحدة

/** طلب استعادة كلمة المرور: توليد رمز وإرساله بالبريد (أو إعادته لوضع الاختبار) */
export async function POST(req: Request) {
  try {
    await ensureInitialized();
    const body = await req.json().catch(() => ({}));
    const ident = String(body?.identifier ?? "").trim().toLowerCase();
    if (!ident) return Response.json({ ok: false, error: "أدخل بريدك الإلكتروني" }, { status: 400 });

    const rows = await db.execute<{ id: number; email: string | null; full_name: string }>(sql`
      SELECT id, email, full_name FROM teachers
      WHERE lower(email) = ${ident} OR lower(username) = ${ident}
      LIMIT 1
    `);
    const teacher = rows.rows[0];

    // إجابة موحدة مهما وجدنا أم لا (لا كشف عن وجود الحساب)
    if (!teacher || !teacher.email) {
      return Response.json({ ok: true, configured: false, message: "إن كان البريد مسجلاً في المنظومة فتم إرسال رابط الاستعادة." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    await db.execute(sql`
      UPDATE teachers SET reset_token_hash = ${sha256(token)}, reset_token_expires = (now() + interval '1 hour')
      WHERE id = ${teacher.id}
    `);

    const origin = req.headers.get("origin") || `https://${req.headers.get("host") || "localhost:3000"}`;
    const result = await sendResetEmail({ to: teacher.email, teacherName: teacher.full_name, siteOrigin: origin, token });

    if (result.configured && result.error) {
      return Response.json({ ok: false, error: "تعذر إرسال البريد: " + result.error }, { status: 502 });
    }
    // وضع الاختبار: لا يوجد مزوّد بريد — يُعاد الرابط مباشرةً
    return Response.json({
      ok: true,
      configured: result.configured,
      message: result.configured
        ? `تم إرسال رابط الاستعادة إلى ${teacher.email} — الرابط صالح لمدة ساعة.`
        : "وضع الاختبار (لم يُضبط مزوّد بريد): استخدم الرابط التالي لاستعادة كلمة المرور:",
      devLink: result.devLink,
    });
  } catch (err) {
    console.error("forgot error", err);
    return Response.json({ ok: false, error: "تعذر معالجة الطلب" }, { status: 500 });
  }
}
