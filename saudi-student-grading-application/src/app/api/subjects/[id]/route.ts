import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized } from "@/db/init";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function ownsSubject(subjectId: number, teacherId: number): Promise<boolean> {
  const r = await db.execute(sql`SELECT 1 FROM subjects WHERE id = ${subjectId} AND teacher_id = ${teacherId} LIMIT 1`);
  return r.rows.length > 0;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  const { id } = await ctx.params;
  const subjectId = Number(id);
  if (!(await ownsSubject(subjectId, session.sub))) {
    return Response.json({ ok: false, error: "المادة غير موجودة" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));

  const name = body?.name !== undefined ? String(body.name).trim() : undefined;
  const color = body?.color !== undefined ? String(body.color) : undefined;
  const passScore = body?.passScore !== undefined ? Number(body.passScore) : undefined;
  const isActive = body?.isActive !== undefined ? Boolean(body.isActive) : undefined;

  await db.execute(sql`
    UPDATE subjects SET
      name = COALESCE(${name ?? null}, name),
      color = COALESCE(${color ?? null}, color),
      pass_score = COALESCE(${passScore ?? null}, pass_score),
      is_active = COALESCE(${isActive ?? null}, is_active)
    WHERE id = ${subjectId} AND teacher_id = ${session.sub}
  `);
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  const { id } = await ctx.params;
  const subjectId = Number(id);
  if (!(await ownsSubject(subjectId, session.sub))) {
    return Response.json({ ok: false, error: "المادة غير موجودة" }, { status: 404 });
  }
  await db.execute(sql`DELETE FROM subjects WHERE id = ${subjectId} AND teacher_id = ${session.sub}`);
  return Response.json({ ok: true });
}
