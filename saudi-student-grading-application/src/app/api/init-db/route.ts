import { ensureInitialized } from "@/db/init";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * مسار التهيئة التلقائية — يُنشئ الجداول والحساب الافتراضي والبيانات الأولية.
 * آمن للتكرار ولا يحذف أي بيانات. يُستدعى تلقائياً عند أول تسجيل دخول.
 */
export async function POST() {
  try {
    const report = await ensureInitialized();
    return Response.json({ ok: true, report });
  } catch (err) {
    console.error("init-db failed", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "تعذرت تهيئة قاعدة البيانات" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await getSession();
  try {
    const report = await ensureInitialized();
    return Response.json(
      { ok: true, authenticated: Boolean(session), report },
    );
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "تعذر الاتصال بقاعدة البيانات" },
      { status: 500 }
    );
  }
}
