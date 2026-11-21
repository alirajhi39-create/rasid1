import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized } from "@/db/init";
import { createSessionToken, sessionCookie, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await ensureInitialized();
    const body = await req.json().catch(() => ({}));
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");
    if (!username || !password) {
      return NextResponse.json({ ok: false, error: "أدخل اسم المستخدم وكلمة المرور" }, { status: 400 });
    }
    const rows = await db.execute<{ id: number; username: string; full_name: string; password_hash: string }>(
      sql`SELECT id, username, full_name, password_hash FROM teachers WHERE username = ${username} LIMIT 1`
    );
    const teacher = rows.rows[0];
    const valid = teacher ? await verifyPassword(password, teacher.password_hash) : false;
    if (!teacher || !valid) {
      return NextResponse.json({ ok: false, error: "بيانات الدخول غير صحيحة" }, { status: 401 });
    }
    const token = createSessionToken({ sub: teacher.id, name: teacher.full_name, username: teacher.username });
    const res = NextResponse.json({ ok: true, name: teacher.full_name });
    res.cookies.set(sessionCookie.name, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: sessionCookie.maxAge,
    });
    return res;
  } catch (err) {
    console.error("login error", err);
    return NextResponse.json(
      { ok: false, error: "تعذر الاتصال بقاعدة البيانات — تحقق من DATABASE_URL" },
      { status: 500 }
    );
  }
}
