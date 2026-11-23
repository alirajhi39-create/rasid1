import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureInitialized } from "@/db/init";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AppGroupLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  let teacher: {
    full_name: string; school_name: string; academic_year: string; semester: string; job_title: string;
  } | null = null;
  try {
    await ensureInitialized(); // التهيئة التلقائية عند أول زيارة
    const rows = await db.execute<{
      full_name: string; school_name: string; academic_year: string; semester: string; job_title: string;
    }>(
      sql`SELECT full_name, school_name, academic_year, semester, job_title FROM teachers WHERE id = ${session.sub} LIMIT 1`
    );
    teacher = rows.rows[0] ?? null;
  } catch (err) {
    console.error("تعذر الاتصال بقاعدة البيانات:", err);
  }

  return <AppShell teacher={teacher}>{children}</AppShell>;
}
