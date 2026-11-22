import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized } from "@/db/init";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  const url = new URL(req.url);
  const classId = url.searchParams.get("classId");
  const q = (url.searchParams.get("q") ?? "").trim();
  const rows = classId
    ? await db.execute(sql`
        SELECT s.id, s.full_name, s.national_id, s.guardian_phone, s.gender, s.notes, s.class_id,
               c.name AS class_name, c.grade_label
        FROM students s JOIN classes c ON c.id = s.class_id
        WHERE s.class_id = ${Number(classId)} AND c.teacher_id = ${session.sub}
          AND (${q} = '' OR s.full_name ILIKE '%' || ${q} || '%' OR s.national_id LIKE '%' || ${q} || '%')
        ORDER BY s.full_name ASC
      `)
    : await db.execute(sql`
        SELECT s.id, s.full_name, s.national_id, s.guardian_phone, s.gender, s.notes, s.class_id,
               c.name AS class_name, c.grade_label
        FROM students s JOIN classes c ON c.id = s.class_id
        WHERE c.teacher_id = ${session.sub}
          AND (${q} = '' OR s.full_name ILIKE '%' || ${q} || '%' OR s.national_id LIKE '%' || ${q} || '%')
        ORDER BY c.sort_order ASC, s.full_name ASC
      `);
  return Response.json({ ok: true, students: rows.rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  const body = await req.json().catch(() => ({}));
  const fullName = String(body?.fullName ?? "").trim();
  const nationalId = String(body?.nationalId ?? "").trim();
  const classId = Number(body?.classId);
  const guardianPhone = String(body?.guardianPhone ?? "").trim();
  const gender = String(body?.gender ?? "ذكر").trim();
  if (!fullName || !classId) {
    return Response.json({ ok: false, error: "الاسم الرباعي والفصل مطلوبان" }, { status: 400 });
  }
  if (nationalId && !/^\d{10}$/.test(nationalId)) {
    return Response.json({ ok: false, error: "رقم الهوية يجب أن يتكون من 10 أرقام" }, { status: 400 });
  }
  const classCheck = await db.execute(sql`SELECT id FROM classes WHERE id = ${classId} AND teacher_id = ${session.sub}`);
  if (classCheck.rows.length === 0) {
    return Response.json({ ok: false, error: "الفصل غير موجود" }, { status: 404 });
  }
  const inserted = await db.execute(sql`
    INSERT INTO students (full_name, national_id, guardian_phone, gender, class_id)
    VALUES (${fullName}, ${nationalId}, ${guardianPhone}, ${gender}, ${classId})
    RETURNING id, full_name, national_id, class_id
  `);
  void import("@/lib/backup").then((m) => m.saveAutoSnapshot(session.sub)).catch(() => {});
  return Response.json({ ok: true, student: inserted.rows[0] }, { status: 201 });
}
