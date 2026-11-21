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
           city, principal_name, academic_year, semester, stage
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
