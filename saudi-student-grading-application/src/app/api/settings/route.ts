import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized } from "@/db/init";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  const rows = await db.execute(sql`
    SELECT id, username, full_name, job_title, school_name, education_admin, education_office,
           city, principal_name, academic_year, semester, stage,
           band_excellent_min, band_very_good_min, band_good_min, band_pass_min,
           teacher_sig, principal_sig
    FROM teachers WHERE id = ${session.sub} LIMIT 1
  `);
  return Response.json({ ok: true, teacher: rows.rows[0] ?? null });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  const b = await req.json().catch(() => ({}));
  const v = (k: string) => (b?.[k] !== undefined ? String(b[k]).trim() : null);

  // التواقيع (data URL) — تُحفظ أو تُحذف (بإرسال null/فراغ)، وأسماء الأعمدة ثوابت والقيم مُربوطة
  if (b?.teacherSig !== undefined || b?.principalSig !== undefined) {
    const sigOk = (val: unknown) =>
      val === null || val === "" ||
      (typeof val === "string" && val.startsWith("data:image/") && val.length <= 1_500_000);
    if (!sigOk(b.teacherSig) || !sigOk(b.principalSig)) {
      return Response.json({ ok: false, error: "صيغة صورة التوقيع غير صالحة أو حجمها كبير" }, { status: 400 });
    }
    if (b.teacherSig !== undefined) {
      const t = b.teacherSig === "" ? null : (b.teacherSig as string);
      await db.execute(sql`UPDATE teachers SET teacher_sig = ${t} WHERE id = ${session.sub}`);
    }
    if (b.principalSig !== undefined) {
      const p = b.principalSig === "" ? null : (b.principalSig as string);
      await db.execute(sql`UPDATE teachers SET principal_sig = ${p} WHERE id = ${session.sub}`);
    }
  }

  // عتبات التقدير (إن وُجدت): تتحقق من الترتيب المنطقي وتُخزَّن
  const bands: Record<string, number> | null =
    b?.bandExcellent !== undefined || b?.bandVeryGood !== undefined || b?.bandGood !== undefined || b?.bandPass !== undefined
      ? {
          excellent: Math.round(Number(b?.bandExcellent ?? 90)),
          veryGood: Math.round(Number(b?.bandVeryGood ?? 80)),
          good: Math.round(Number(b?.bandGood ?? 70)),
          pass: Math.round(Number(b?.bandPass ?? 60)),
        }
      : null;
  if (bands) {
    const { excellent, veryGood, good, pass } = bands;
    if ([excellent, veryGood, good, pass].some((n) => !Number.isFinite(n) || n < 0 || n > 100)) {
      return Response.json({ ok: false, error: "النسب يجب أن تكون بين 0 و 100" }, { status: 400 });
    }
    if (!(excellent > veryGood && veryGood > good && good > pass)) {
      return Response.json({ ok: false, error: "يجب أن تكون النسب متناقصة: ممتاز > جيد جداً > جيد > مقبول" }, { status: 400 });
    }
    await db.execute(sql`
      UPDATE teachers SET
        band_excellent_min = ${excellent},
        band_very_good_min = ${veryGood},
        band_good_min = ${good},
        band_pass_min = ${pass}
      WHERE id = ${session.sub}
    `);
  }

  await db.execute(sql`
    UPDATE teachers SET
      full_name = COALESCE(${v("fullName")}, full_name),
      job_title = COALESCE(${v("jobTitle")}, job_title),
      school_name = COALESCE(${v("schoolName")}, school_name),
      education_admin = COALESCE(${v("educationAdmin")}, education_admin),
      education_office = COALESCE(${v("educationOffice")}, education_office),
      city = COALESCE(${v("city")}, city),
      principal_name = COALESCE(${v("principalName")}, principal_name),
      academic_year = COALESCE(${v("academicYear")}, academic_year),
      semester = COALESCE(${v("semester")}, semester),
      stage = COALESCE(${v("stage")}, stage)
    WHERE id = ${session.sub}
  `);
  return Response.json({ ok: true });
}
