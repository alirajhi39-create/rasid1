import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized } from "@/db/init";
import { hashPassword, verifyPassword, getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  }
  await ensureInitialized();
  const body = await req.json().catch(() => ({}));
  const current = String(body?.current ?? "");
  const next = String(body?.next ?? "");
  if (next.length < 6) {
    return Response.json({ ok: false, error: "كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف" }, { status: 400 });
  }
  const rows = await db.execute<{ password_hash: string }>(
    sql`SELECT password_hash FROM teachers WHERE id = ${session.sub} LIMIT 1`
  );
  const teacher = rows.rows[0];
  if (!teacher || !(await verifyPassword(current, teacher.password_hash))) {
    return Response.json({ ok: false, error: "كلمة المرور الحالية غير صحيحة" }, { status: 400 });
  }
  const hash = await hashPassword(next);
  await db.execute(sql`UPDATE teachers SET password_hash = ${hash} WHERE id = ${session.sub}`);
  return Response.json({ ok: true });
}
