import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized } from "@/db/init";
import { getSession } from "@/lib/auth";
import { buildSnapshot, type BackupSnapshot } from "@/lib/backup";

export const dynamic = "force-dynamic";

const str = (v: unknown) => (v === undefined || v === null ? null : String(v).slice(0, 300));

/**
 * GET  → تنزيل نسخة احتياطية كاملة لمساحة عمل المعلم الحالي (JSON)
 * POST → استعادة نسخة (تستبدل كل بيانات المساحة الحالية)
 */
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  try {
    const snapshot = await buildSnapshot(session.sub);
    return Response.json(snapshot, {
      headers: { "Content-Disposition": `attachment; filename="rased-backup-${new Date().toISOString().slice(0, 10)}.json"` },
    });
  } catch (err) {
    console.error("backup export failed", err);
    return Response.json({ ok: false, error: "تعذر بناء النسخة الاحتياطية" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();

  let snap: Partial<BackupSnapshot>;
  try {
    snap = await req.json();
  } catch {
    return Response.json({ ok: false, error: "الملف ليس JSON صالحاً" }, { status: 400 });
  }
  if (snap?.app !== "rased" || !Array.isArray(snap.classes) || !Array.isArray(snap.students) || !Array.isArray(snap.subjects) || !Array.isArray(snap.grades)) {
    return Response.json({ ok: false, error: "هذا ليس ملف نسخة احتياطية من رَصْد" }, { status: 400 });
  }
  if (snap.classes.length > 200 || snap.students.length > 10000 || snap.subjects.length > 200 || snap.grades.length > 500000) {
    return Response.json({ ok: false, error: "حجم النسخة أكبر من الحد المسموح" }, { status: 400 });
  }

  const T = session.sub;
  try {
    const counts = await db.transaction(async (tx) => {
      // 1) حذف بيانات المساحة الحالية (يتبعها الحذف المتسلسل: طلاب/درجات/خانات/روابط)
      await tx.execute(sql`DELETE FROM classes WHERE teacher_id = ${T}`);
      await tx.execute(sql`DELETE FROM subjects WHERE teacher_id = ${T}`);

      // 2) بيانات المعلم والمدرسة (إن وُجدت في النسخة)
      const t = (snap.teacher ?? {}) as Record<string, unknown>;
      await tx.execute(sql`
        UPDATE teachers SET
          full_name = COALESCE(${str(t.full_name)}, full_name),
          job_title = COALESCE(${str(t.job_title)}, job_title),
          school_name = COALESCE(${str(t.school_name)}, school_name),
          education_admin = COALESCE(${str(t.education_admin)}, education_admin),
          education_office = COALESCE(${str(t.education_office)}, education_office),
          city = COALESCE(${str(t.city)}, city),
          principal_name = COALESCE(${str(t.principal_name)}, principal_name),
          academic_year = COALESCE(${str(t.academic_year)}, academic_year),
          semester = COALESCE(${str(t.semester)}, semester),
          stage = COALESCE(${str(t.stage)}, stage)
        WHERE id = ${T}
      `);

      // 3) الفصول
      const classMap = new Map<number, number>();
      for (const c of snap.classes!) {
        const r = await tx.execute<{ id: number }>(sql`
          INSERT INTO classes (teacher_id, name, grade_label, stage, sort_order)
          VALUES (${T}, ${String(c.name ?? "").slice(0, 100)}, ${String(c.gradeLabel ?? "").slice(0, 150)}, ${String(c.stage ?? "متوسط").slice(0, 30)}, ${Number(c.sortOrder) || 0})
          RETURNING id
        `);
        classMap.set(Number(c.id), r.rows[0].id);
      }

      // 4) الطلاب
      const studentMap = new Map<number, number>();
      let studentsCount = 0;
      for (const s of snap.students!) {
        const targetClass = classMap.get(Number(s.classId)) ?? null;
        if (!targetClass) continue;
        const r = await tx.execute<{ id: number }>(sql`
          INSERT INTO students (full_name, national_id, guardian_phone, gender, notes, class_id)
          VALUES (${String(s.fullName ?? "").slice(0, 200)}, ${String(s.nationalId ?? "").slice(0, 20)},
                  ${String(s.guardianPhone ?? "").slice(0, 20)}, ${String(s.gender ?? "ذكر").slice(0, 10)},
                  ${String(s.notes ?? "").slice(0, 500)}, ${targetClass})
          RETURNING id
        `);
        studentMap.set(Number(s.id), r.rows[0].id);
        studentsCount++;
      }

      // 5) المواد + الخانات + الروابط
      const subjMap = new Map<number, number>();
      const compMap = new Map<number, number>();
      let subjectsCount = 0;
      for (const sub of snap.subjects!) {
        const sr = await tx.execute<{ id: number }>(sql`
          INSERT INTO subjects (teacher_id, name, max_total, pass_score, color, sort_order, is_active)
          VALUES (${T}, ${String(sub.name ?? "").slice(0, 150)}, ${Number(sub.maxTotal) || 100}, ${Number(sub.passScore) || 50},
                  ${String(sub.color ?? "#0e5c3a").slice(0, 20)}, ${Number(sub.sortOrder) || 0}, ${sub.isActive !== false})
          RETURNING id
        `);
        const newSubjectId = sr.rows[0].id;
        subjMap.set(Number(sub.id), newSubjectId);

        for (const c of sub.components ?? []) {
          const cat = c.category === "performance" ? "performance" : c.category === "written_oral" ? "written_oral" : "written";
          const cr = await tx.execute<{ id: number }>(sql`
            INSERT INTO grade_components (subject_id, name, category, max_score, weight_label, is_active, sort_order)
            VALUES (${newSubjectId}, ${String(c.name ?? "").slice(0, 150)}, ${cat}, ${Number(c.maxScore) || 0},
                    ${String(c.weightLabel ?? "").slice(0, 60)}, ${c.isActive !== false}, ${Number(c.sortOrder) || 0})
            RETURNING id
          `);
          compMap.set(Number(c.id), cr.rows[0].id);
        }
        for (const classId of sub.classIds ?? []) {
          const targetClass = classMap.get(Number(classId));
          if (targetClass) {
            await tx.execute(sql`
              INSERT INTO subject_class_links (subject_id, class_id)
              VALUES (${newSubjectId}, ${targetClass})
              ON CONFLICT (subject_id, class_id) DO NOTHING
            `);
          }
        }
        subjectsCount++;
      }

      // 6) الدرجات (لكل الفصلين والفترتين)
      let gradesCount = 0;
      for (const g of snap.grades!) {
        const sid = studentMap.get(Number(g.studentId));
        const cid = compMap.get(Number(g.componentId));
        if (!sid || !cid) continue;
        const semester = g.semester === 2 ? 2 : 1;
        const period = g.period === 2 ? 2 : 1;
        const value = g.value === null ? null : Math.max(0, Number(g.value));
        if (value === null || Number.isNaN(value)) {
          await tx.execute(sql`DELETE FROM grades WHERE student_id = ${sid} AND component_id = ${cid} AND semester = ${semester} AND period = ${period}`);
        } else {
          await tx.execute(sql`
            INSERT INTO grades (student_id, component_id, semester, period, value, updated_at)
            VALUES (${sid}, ${cid}, ${semester}, ${period}, ${value}, now())
            ON CONFLICT (student_id, component_id, semester, period)
            DO UPDATE SET value = EXCLUDED.value, updated_at = now()
          `);
        }
        gradesCount++;
      }

      return { classes: classMap.size, students: studentsCount, subjects: subjectsCount, grades: gradesCount };
    });

    return Response.json({ ok: true, ...counts }, { status: 201 });
  } catch (err) {
    console.error("backup restore failed", err);
    return Response.json({ ok: false, error: "تعذرت الاستعادة — لم يتم حذف بياناتك الحالية (فشل معاملة واحدة)" }, { status: 500 });
  }
}
