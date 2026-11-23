import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized } from "@/db/init";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function ownsStudent(studentId: number, teacherId: number): Promise<boolean> {
  const r = await db.execute(sql`
    SELECT 1 FROM students s JOIN classes c ON c.id = s.class_id
    WHERE s.id = ${studentId} AND c.teacher_id = ${teacherId} LIMIT 1
  `);
  return r.rows.length > 0;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  const { id } = await ctx.params;
  const studentId = Number(id);
  if (!(await ownsStudent(studentId, session.sub))) {
    return Response.json({ ok: false, error: "الطالب غير موجود" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));

  const fullName = body?.fullName !== undefined ? String(body.fullName).trim() : undefined;
  const nationalId = body?.nationalId !== undefined ? String(body.nationalId).trim() : undefined;
  const guardianPhone = body?.guardianPhone !== undefined ? String(body.guardianPhone).trim() : undefined;
  const gender = body?.gender !== undefined ? String(body.gender).trim() : undefined;
  const notes = body?.notes !== undefined ? String(body.notes).trim() : undefined;
  const classId = body?.classId !== undefined ? Number(body.classId) : undefined;

  if (nationalId !== undefined && nationalId !== "" && !/^\d{10}$/.test(nationalId)) {
    return Response.json({ ok: false, error: "رقم الهوية يجب أن يتكون من 10 أرقام" }, { status: 400 });
  }
  // عند النقل لفصل آخر: يجب أن يكون الفصل الجديد ملكاً لنفس المعلم
  if (classId !== undefined) {
    const classCheck = await db.execute(sql`SELECT id FROM classes WHERE id = ${classId} AND teacher_id = ${session.sub}`);
    if (classCheck.rows.length === 0) {
      return Response.json({ ok: false, error: "الفصل الهدف غير موجود" }, { status: 404 });
    }
  }

  await db.execute(sql`
    UPDATE students SET
      full_name = COALESCE(${fullName ?? null}, full_name),
      national_id = COALESCE(${nationalId ?? null}, national_id),
      guardian_phone = COALESCE(${guardianPhone ?? null}, guardian_phone),
      gender = COALESCE(${gender ?? null}, gender),
      notes = COALESCE(${notes ?? null}, notes),
      class_id = COALESCE(${classId ?? null}, class_id)
    WHERE id = ${studentId}
  `);
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  const { id } = await ctx.params;
  const studentId = Number(id);
  if (!(await ownsStudent(studentId, session.sub))) {
    return Response.json({ ok: false, error: "الطالب غير موجود" }, { status: 404 });
  }
  await db.execute(sql`DELETE FROM students WHERE id = ${studentId}`);
  void import("@/lib/backup").then((m) => m.saveAutoSnapshot(session.sub)).catch(() => {});
  return Response.json({ ok: true });
}
