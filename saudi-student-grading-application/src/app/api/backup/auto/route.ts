import { getSession } from "@/lib/auth";
import { latestAutoSnapshot } from "@/lib/backup";

export const dynamic = "force-dynamic";

/** تنزيل آخر نسخة تلقائية محفوظة (إن وُجدت) */
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  const latest = await latestAutoSnapshot(session.sub);
  if (!latest) return Response.json({ ok: false, error: "لا توجد نسخة تلقائية محفوظة بعد" }, { status: 404 });
  return Response.json(latest.snapshot, {
    headers: {
      "Content-Disposition": `attachment; filename="rased-autobackup-${new Date(latest.createdAt).toISOString().slice(0, 16).replace("T", "-").replace(":", "-")}.json"`,
      "X-Backup-At": latest.createdAt,
    },
  });
}
