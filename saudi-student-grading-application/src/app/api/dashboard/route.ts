import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized } from "@/db/init";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** إحصائيات لوحة المعلومات — محسوبة من مساحة عمل المعلم الحالي فقط */
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
  await ensureInitialized();
  const T = session.sub;

  const [totals, perSubject, distribution, topStudents, lowStudents, recent, completion] =
    await Promise.all([
      db.execute(sql`
        SELECT
          (SELECT COUNT(*)::int FROM students s JOIN classes c ON c.id = s.class_id WHERE c.teacher_id = ${T}) AS student_count,
          (SELECT COUNT(*)::int FROM classes WHERE teacher_id = ${T}) AS class_count,
          (SELECT COUNT(*)::int FROM subjects WHERE is_active = TRUE AND teacher_id = ${T}) AS subject_count
      `),
      db.execute(sql`
        SELECT s.id, s.name, s.color,
               COALESCE(AVG(g.value / NULLIF(gc.max_score, 0) * 100), 0)::float AS avg_percent,
               COUNT(g.id)::int AS graded
        FROM subjects s
        LEFT JOIN grade_components gc ON gc.subject_id = s.id AND gc.is_active = TRUE
        LEFT JOIN grades g ON g.component_id = gc.id AND g.value IS NOT NULL
        WHERE s.is_active = TRUE AND s.teacher_id = ${T}
          AND EXISTS (SELECT 1 FROM subject_grade_links l WHERE l.subject_id = s.id)
        GROUP BY s.id, s.name, s.color
        ORDER BY s.sort_order ASC
      `),
      db.execute(sql`
        WITH combos AS (
          SELECT st.id AS student_id, s.id AS subject_id,
                 COALESCE(SUM(g.value), 0) AS total,
                 COALESCE(SUM(gc.max_score) FILTER (WHERE g.value IS NOT NULL), 0) AS earned_max,
                 COALESCE(SUM(gc.max_score), 0) AS max_total
          FROM students st
          JOIN classes cl ON cl.id = st.class_id AND cl.teacher_id = ${T}
          CROSS JOIN subjects s
          JOIN subject_grade_links l ON l.subject_id = s.id AND l.grade_label = cl.grade_label
          JOIN grade_components gc ON gc.subject_id = s.id AND gc.is_active = TRUE
          LEFT JOIN grades g ON g.component_id = gc.id AND g.student_id = st.id AND g.value IS NOT NULL
          WHERE s.teacher_id = ${T}
          GROUP BY st.id, s.id
        )
        SELECT
          COUNT(*) FILTER (WHERE earned_max > 0 AND total / NULLIF(max_total,0) * 100 >= 90)::int AS excellent,
          COUNT(*) FILTER (WHERE earned_max > 0 AND total / NULLIF(max_total,0) * 100 >= 80 AND total / NULLIF(max_total,0) * 100 < 90)::int AS very_good,
          COUNT(*) FILTER (WHERE earned_max > 0 AND total / NULLIF(max_total,0) * 100 >= 70 AND total / NULLIF(max_total,0) * 100 < 80)::int AS good,
          COUNT(*) FILTER (WHERE earned_max > 0 AND total / NULLIF(max_total,0) * 100 >= 60 AND total / NULLIF(max_total,0) * 100 < 70)::int AS pass_,
          COUNT(*) FILTER (WHERE earned_max > 0 AND total / NULLIF(max_total,0) * 100 < 60)::int AS fail,
          COUNT(*) FILTER (WHERE earned_max > 0)::int AS graded_combos,
          COUNT(*) FILTER (WHERE earned_max > 0 AND total / NULLIF(max_total,0) * 100 >= 60)::int AS passing_combos,
          COALESCE(AVG(total / NULLIF(max_total,0) * 100) FILTER (WHERE earned_max > 0), 0)::float AS avg_percent
        FROM combos
      `),
      db.execute(sql`
        WITH combos AS (
          SELECT st.id, st.full_name, c.name AS class_name, c.grade_label,
                 AVG(g.value / NULLIF(gc.max_score,0) * 100)::float AS avg_pct
          FROM students st
          JOIN classes c ON c.id = st.class_id AND c.teacher_id = ${T}
          JOIN grades g ON g.student_id = st.id AND g.value IS NOT NULL
          JOIN grade_components gc ON gc.id = g.component_id AND gc.is_active = TRUE
          JOIN subjects s ON s.id = gc.subject_id AND s.teacher_id = ${T}
          JOIN subject_grade_links l ON l.subject_id = s.id AND l.grade_label = c.grade_label
          GROUP BY st.id, st.full_name, c.name, c.grade_label
          HAVING COUNT(g.id) >= 5
        )
        SELECT * FROM combos ORDER BY avg_pct DESC LIMIT 5
      `),
      db.execute(sql`
        WITH combos AS (
          SELECT st.id, st.full_name, c.name AS class_name, c.grade_label,
                 AVG(g.value / NULLIF(gc.max_score,0) * 100)::float AS avg_pct
          FROM students st
          JOIN classes c ON c.id = st.class_id AND c.teacher_id = ${T}
          JOIN grades g ON g.student_id = st.id AND g.value IS NOT NULL
          JOIN grade_components gc ON gc.id = g.component_id AND gc.is_active = TRUE
          JOIN subjects s ON s.id = gc.subject_id AND s.teacher_id = ${T}
          JOIN subject_grade_links l ON l.subject_id = s.id AND l.grade_label = c.grade_label
          GROUP BY st.id, st.full_name, c.name, c.grade_label
          HAVING COUNT(g.id) >= 5
        )
        SELECT * FROM combos ORDER BY avg_pct ASC LIMIT 5
      `),
      db.execute(sql`
        SELECT s.id, s.full_name, s.national_id, s.created_at, c.name AS class_name, c.grade_label
        FROM students s JOIN classes c ON c.id = s.class_id AND c.teacher_id = ${T}
        ORDER BY s.created_at DESC LIMIT 6
      `),
      db.execute(sql`
        SELECT
          (SELECT COUNT(*)::int FROM grades g
             JOIN students st ON st.id = g.student_id
             JOIN classes c ON c.id = st.class_id
             JOIN grade_components gc ON gc.id = g.component_id
             JOIN subjects s ON s.id = gc.subject_id
             JOIN subject_grade_links l ON l.subject_id = s.id AND l.grade_label = c.grade_label
            WHERE c.teacher_id = ${T} AND s.teacher_id = ${T} AND g.value IS NOT NULL) AS filled,
          (SELECT COALESCE(SUM(student_count * comp_count * 4), 0)::int FROM (
             SELECT c.grade_label,
                    (SELECT COUNT(*) FROM students st JOIN classes cc ON cc.id = st.class_id WHERE cc.teacher_id = ${T} AND cc.grade_label = c.grade_label) AS student_count,
                    (SELECT COUNT(*) FROM grade_components gc JOIN subjects s ON s.id = gc.subject_id
                       JOIN subject_grade_links l ON l.subject_id = s.id AND l.grade_label = c.grade_label
                      WHERE s.teacher_id = ${T} AND gc.is_active = TRUE AND s.is_active = TRUE) AS comp_count
             FROM (SELECT DISTINCT grade_label FROM classes WHERE teacher_id = ${T}) c
           ) t) AS expected
      `),
    ]);

  const dist = distribution.rows[0] as Record<string, number | string>;
  const graded = Number(dist.graded_combos ?? 0);
  const passing = Number(dist.passing_combos ?? 0);

  return Response.json({
    ok: true,
    totals: totals.rows[0],
    perSubject: perSubject.rows,
    completion: completion.rows[0],
    distribution: {
      excellent: Number(dist.excellent ?? 0),
      veryGood: Number(dist.very_good ?? 0),
      good: Number(dist.good ?? 0),
      pass: Number(dist.pass_ ?? 0),
      fail: Number(dist.fail ?? 0),
    },
    avgPercent: Number(dist.avg_percent ?? 0),
    passRate: graded > 0 ? Math.round((passing / graded) * 1000) / 10 : 0,
    topStudents: topStudents.rows,
    lowStudents: lowStudents.rows,
    recentStudents: recent.rows,
  });
}
