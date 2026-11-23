import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized } from "@/db/init";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function ownsClass(classId: number, teacherId: number): Promise<boolean> {
  const r = await db.execute(sql`SELECT 1 FROM classes WHERE id = ${classId} AND teacher_id = ${teacherId} LIMIT 1`);
  return r.rows.length > 0;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  const { id } = await ctx.params;
  const classId = Number(id);
  if (!(await ownsClass(classId, session.sub))) {
    return Response.json({ ok: false, error: "الفصل غير موجود" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  const gradeLabel = String(body?.gradeLabel ?? "").trim();
  const stage = String(body?.stage ?? "متوسط").trim();
  if (!classId || !name || !gradeLabel) {
    return Response.json({ ok: false, error: "بيانات غير مكتملة" }, { status: 400 });
  }
  await db.execute(sql`
    UPDATE classes SET name = ${name}, grade_label = ${gradeLabel}, stage = ${stage}
    WHERE id = ${classId} AND teacher_id = ${session.sub}
  `);
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  const { id } = await ctx.params;
  const classId = Number(id);
  if (!(await ownsClass(classId, session.sub))) {
    return Response.json({ ok: false, error: "الفصل غير موجود" }, { status: 404 });
  }
  const count = await db.execute<{ c: string }>(
    sql`SELECT COUNT(*)::text AS c FROM students WHERE class_id = ${classId}`
  );
  await db.execute(sql`DELETE FROM classes WHERE id = ${classId} AND teacher_id = ${session.sub}`);
  return Response.json({ ok: true, deletedStudents: Number(count.rows[0]?.c ?? "0") });
}
