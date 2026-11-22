import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized } from "@/db/init";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** حالة النسخ التلقائية: آخر توقيت + العدد المحفوظ */
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  const row = await db.execute<{ at: string; c: string }>(sql`
    SELECT COALESCE(MAX(created_at)::text, '') AS at, COUNT(*)::text AS c
    FROM backups WHERE teacher_id = ${session.sub}
  `);
  return Response.json({
    ok: true,
    last: row.rows[0]?.at || null,
    count: Number(row.rows[0]?.c ?? "0"),
  });
}
