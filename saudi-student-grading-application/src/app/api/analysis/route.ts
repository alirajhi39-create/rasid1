import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized } from "@/db/init";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * تحليل نتائج مادة: لكل فصل مرتبط (أو فصل محدد) — المتوسطات، نسبة النجاح،
 * توزيع التقديرات، وتحليل كل خانة (مهمة/تقويم) على حدة.
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
    await ensureInitialized();
  const url = new URL(req.url);
  const subjectId = Number(url.searchParams.get("subjectId"));
  const classIdParam = url.searchParams.get("classId");
  const semester = url.searchParams.get("semester") === "2" ? 2 : 1;
  const period = url.searchParams.get("period") === "2" ? 2 : 1;
  if (!subjectId) return Response.json({ ok: false, error: "المادة مطلوبة" }, { status: 400 });

  const subj = await db.execute<{ id: number; name: string }>(
    sql`SELECT id, name FROM subjects WHERE id = ${subjectId} AND teacher_id = ${session.sub} LIMIT 1`
  );
  if (subj.rows.length === 0) return Response.json({ ok: false, error: "المادة غير موجودة" }, { status: 404 });

  const components = await db.execute<{ id: number; name: string; category: string; max_score: number }>(sql`
    SELECT id, name, category, max_score::float AS max_score FROM grade_components
    WHERE subject_id = ${subjectId} AND is_active = TRUE ORDER BY sort_order ASC, id ASC
  `);
  const comps = components.rows as Array<{ id: number; name: string; category: string; max_score: number }>;
  const compMax = comps.reduce((a, c) => a + Number(c.max_score), 0);

  const classes = await db.execute<{ id: number; name: string; grade_label: string }>(sql`
    SELECT c.id, c.name, c.grade_label FROM classes c
    JOIN subject_class_links l ON l.class_id = c.id AND l.subject_id = ${subjectId}
    WHERE c.teacher_id = ${session.sub}
    ORDER BY c.sort_order ASC, c.id ASC
  `);
  let classList = classes.rows as Array<{ id: number; name: string; grade_label: string }>;
  if (classIdParam) classList = classList.filter((c) => c.id === Number(classIdParam));

  // عتبات التقدير للمعلم (مع أسماء مختصرة تطابق الكائن)
  const bandsRow = await db.execute<{ e: number; vg: number; g: number; p: number }>(sql`
    SELECT band_excellent_min AS e, band_very_good_min AS vg, band_good_min AS g, band_pass_min AS p
    FROM teachers WHERE id = ${session.sub} LIMIT 1
  `);
  const rawB = bandsRow.rows[0];
  const b = rawB
    ? {
        e: Number(rawB.e) || 90,
        vg: Number(rawB.vg) || 80,
        g: Number(rawB.g) || 70,
        p: Number(rawB.p) || 60,
      }
    : { e: 90, vg: 80, g: 70, p: 60 };

  const result = [];
  for (const cls of classList) {
    const students = await db.execute<{ id: number }>(sql`SELECT id FROM students WHERE class_id = ${cls.id}`);
    const ids = students.rows.map((r) => Number(r.id));
    if (ids.length === 0) continue;
    const idList = ids.map((n) => Math.trunc(n)).join(",");

    const compList = comps.map((c) => Math.trunc(Number(c.id))).join(",");
    const gradesRows = await db.execute<{ student_id: number; component_id: number; value: number }>(sql`
      SELECT g.student_id, g.component_id, g.value::float AS value FROM grades g
      WHERE g.student_id = ANY(ARRAY[${sql.raw(idList)}]::int[])
        AND g.component_id IN (SELECT unnest(ARRAY[${sql.raw(compList)}]::int[]))
        AND g.semester = ${semester} AND g.period = ${period} AND g.value IS NOT NULL
    `);

    // تجميع درجات كل طالب: [المجموع، عدد الخانات المعبأة، مجموع عظمى الخانات المعبأة]
    const compMaxMap = new Map<number, number>(comps.map((c) => [Number(c.id), Number(c.max_score)]));
    const byStudent = new Map<number, number[]>(); // studentId -> [total, filledCount, filledMaxSum]
    const byComp = new Map<number, number[]>(); // componentId -> values
    for (const g of gradesRows.rows as Array<{ student_id: number; component_id: number; value: number }>) {
      const st = byStudent.get(g.student_id) ?? [0, 0, 0];
      st[0] += g.value; st[1]++; st[2] += compMaxMap.get(g.component_id) ?? 0;
      byStudent.set(g.student_id, st);
      (byComp.get(g.component_id) ?? byComp.set(g.component_id, []).get(g.component_id)!).push(g.value);
    }

    const dist = { excellent: 0, veryGood: 0, good: 0, pass: 0, fail: 0 };
    let pctSum = 0, graded = 0, pass = 0;
    for (const [, [total, filled, filledMaxSum]] of byStudent) {
      if (filled === 0) continue;
      graded++;
      // نسبة عادلة: على ما رُصد فعلاً (لا يُعاقب الطالب على خانات لم تُحطّب بعد)
      const pct = filledMaxSum > 0 ? (total / filledMaxSum) * 100 : 0;
      pctSum += pct;
      if (pct >= b.p) pass++;
      if (pct >= b.e) dist.excellent++;
      else if (pct >= b.vg) dist.veryGood++;
      else if (pct >= b.g) dist.good++;
      else if (pct >= b.p) dist.pass++;
      else dist.fail++;
    }

    const compStats = comps.map((c) => {
      const vals = byComp.get(c.id) ?? [];
      const avg = vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : 0;
      const mastery = vals.length && c.max_score > 0 ? (vals.filter((v) => v / c.max_score >= 0.6).length / vals.length) * 100 : 0;
      return { id: c.id, name: c.name, category: c.category, max: Number(c.max_score), avg, top: vals.length ? Math.max(...vals) : 0, low: vals.length ? Math.min(...vals) : 0, mastery, filled: vals.length };
    });

    result.push({
      classId: cls.id,
      className: cls.name,
      gradeLabel: cls.grade_label,
      studentCount: ids.length,
      gradedCount: graded,
      avgPct: graded ? pctSum / graded : 0,
      passRate: graded ? Math.round((pass / graded) * 1000) / 10 : 0,
      dist,
      components: compStats,
    });
  }

    return Response.json({
      ok: true,
      subject: subj.rows[0],
      semester,
      period,
      compMax,
      classes: result,
    });
  } catch (err) {
    console.error("analysis error", err);
    return Response.json({ ok: false, error: "تعذر التحليل" }, { status: 500 });
  }
}
