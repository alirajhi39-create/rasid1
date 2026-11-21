import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized, seedDefaultSubjectsForTeacher } from "@/db/init";
import { createSessionToken, hashPassword, sessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;

/**
 * تسجيل معلم جديد — كل معلم يمتلك مساحة عمل مستقلة
 * (فصوله، طلابه، مواده، درجات) وبيانات مدرسته الخاصة للطباعة.
 */
export async function POST(req: Request) {
  try {
    await ensureInitialized();
    const b = await req.json().catch(() => ({}));

    const fullName = String(b?.fullName ?? "").trim().replace(/\s+/g, " ");
    const username = String(b?.username ?? "").trim();
    const password = String(b?.password ?? "");
    const jobTitle = String(b?.jobTitle ?? "معلم").trim() || "معلم";
    const schoolName = String(b?.schoolName ?? "").trim() || "المدرسة";
    const educationAdmin = String(b?.educationAdmin ?? "").trim() || "الإدارة العامة للتعليم";
    const educationOffice = String(b?.educationOffice ?? "").trim() || "مكتب التعليم";
    const city = String(b?.city ?? "").trim() || "الرياض";
    const principalName = String(b?.principalName ?? "").trim() || "مدير المدرسة";
    const academicYear = String(b?.academicYear ?? "").trim() || "1447هـ";
    const semester = String(b?.semester ?? "").trim() || "الفصل الدراسي الأول";
    const stage = String(b?.stage ?? "").trim() || "متوسط";

    if (fullName.length < 3) {
      return NextResponse.json({ ok: false, error: "أدخل الاسم الرباعي الكامل" }, { status: 400 });
    }
    if (!USERNAME_RE.test(username)) {
      return NextResponse.json(
        { ok: false, error: "اسم المستخدم من 3 إلى 32 حرفاً (أحرف لاتينية وأرقام و _ . -)" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json({ ok: false, error: "كلمة المرور يجب ألا تقل عن 6 أحرف" }, { status: 400 });
    }

    const exists = await db.execute<{ id: number }>(
      sql`SELECT id FROM teachers WHERE lower(username) = lower(${username}) LIMIT 1`
    );
    if (exists.rows.length > 0) {
      return NextResponse.json({ ok: false, error: "اسم المستخدم محجوز — اختر غيره" }, { status: 409 });
    }

    const hash = await hashPassword(password);
    const inserted = await db.execute<{ id: number }>(sql`
      INSERT INTO teachers (username, full_name, job_title, password_hash, school_name, education_admin, education_office, city, principal_name, academic_year, semester, stage)
      VALUES (${username}, ${fullName}, ${jobTitle}, ${hash}, ${schoolName}, ${educationAdmin}, ${educationOffice}, ${city}, ${principalName}, ${academicYear}, ${semester}, ${stage})
      RETURNING id
    `);
    const teacherId = inserted.rows[0]?.id;
    if (!teacherId) throw new Error("تعذر إنشاء الحساب");

    // مساحة عمل جديدة تبدأ بمواد افتراضية بتوزيع لائحي (بدون بيانات طلاب)
    await seedDefaultSubjectsForTeacher(teacherId);

    const token = createSessionToken({ sub: teacherId, name: fullName, username });
    const res = NextResponse.json({ ok: true, name: fullName });
    res.cookies.set(sessionCookie.name, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: sessionCookie.maxAge,
    });
    return res;
  } catch (err) {
    console.error("register error", err);
    return NextResponse.json({ ok: false, error: "تعذر إنشاء الحساب — حاول لاحقاً" }, { status: 500 });
  }
}
