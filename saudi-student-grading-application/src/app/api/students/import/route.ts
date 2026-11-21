import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized } from "@/db/init";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

type IncomingRow = { fullName?: unknown; nationalId?: unknown; guardianPhone?: unknown; gender?: unknown };

/** استيراد جماعي — تُرسل الصفوف من المتصفح بعد تحليل Excel/CSV */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  const body = await req.json().catch(() => ({}));
  const classId = Number(body?.classId);
  const rows = Array.isArray(body?.rows) ? (body.rows as IncomingRow[]) : [];
  if (!classId || rows.length === 0) {
    return Response.json({ ok: false, error: "اختر الفصل وأرفق بيانات الطلاب" }, { status: 400 });
  }
  if (rows.length > 1000) {
    return Response.json({ ok: false, error: "الحد الأقصى 1000 طالب في الدفعة الواحدة" }, { status: 400 });
  }

  const classCheck = await db.execute(sql`SELECT id FROM classes WHERE id = ${classId} AND teacher_id = ${session.sub}`);
  if (classCheck.rows.length === 0) {
    return Response.json({ ok: false, error: "الفصل غير موجود" }, { status: 404 });
  }

  const existing = await db.execute<{ national_id: string }>(sql`
    SELECT s.national_id FROM students s
    JOIN classes c ON c.id = s.class_id
    WHERE s.national_id <> '' AND c.teacher_id = ${session.sub}
  `);
  const knownIds = new Set(existing.rows.map((r) => r.national_id));

  let inserted = 0;
  let skipped = 0;
  const seen = new Set<string>();

  for (const raw of rows) {
    const fullName = String(raw?.fullName ?? "").trim().replace(/\s+/g, " ");
    let nationalId = String(raw?.nationalId ?? "").replace(/\D/g, "").trim();
    const guardianPhone = String(raw?.guardianPhone ?? "").trim();
    const gender = String(raw?.gender ?? "ذكر").trim() || "ذكر";
    if (!fullName || fullName.length < 3) { skipped++; continue; }
    if (nationalId) {
      if (!/^[12]\d{9}$/.test(nationalId)) nationalId = nationalId.slice(-10);
      if (!/^[12]\d{9}$/.test(nationalId)) nationalId = "";
    }
    if (nationalId) {
      if (knownIds.has(nationalId) || seen.has(nationalId)) { skipped++; continue; }
      seen.add(nationalId);
    }
    await db.execute(sql`
      INSERT INTO students (full_name, national_id, guardian_phone, gender, class_id)
      VALUES (${fullName}, ${nationalId}, ${guardianPhone}, ${gender}, ${classId})
    `);
    inserted++;
  }

  return Response.json({ ok: true, inserted, skipped });
}
