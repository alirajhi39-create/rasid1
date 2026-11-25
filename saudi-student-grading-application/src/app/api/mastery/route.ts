import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureInitialized } from "@/db/init";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// ============================================================
//  تحليل الإتقان التربوي (المرحلة التأسيسية)
//  مستويات الأداء + المهارات/الفاقد + المقارنات + أساس الإجراءات
// ============================================================

const PASS50 = 50;
const MASTERY60 = 60;

const LEVELS = [
  { key: "excellent", label: "متفوق", min: 90, color: "#047857", bg: "#d1fae5" },
  { key: "veryGood", label: "متقن جداً", min: 80, color: "#0f766e", bg: "#ccfbf1" },
  { key: "good", label: "متقن", min: 70, color: "#1d4ed8", bg: "#dbeafe" },
  { key: "follow", label: "بحاجة إلى متابعة", min: 50, color: "#b45309", bg: "#fef3c7" },
  { key: "support", label: "بحاجة إلى دعم / خطة علاجية", min: 0, color: "#b91c1c", bg: "#fee2e2" },
];
const levelOf = (pct: number) => LEVELS.find((l) => pct >= l.min) ?? LEVELS[LEVELS.length - 1];

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return Response.json({ ok: false, error: "غير مصرح" }, { status: 401 });
    await ensureInitialized();
    const url = new URL(req.url);
    const subjectId = Number(url.searchParams.get("subjectId"));
    const classId = Number(url.searchParams.get("classId"));
    const semester = url.searchParams.get("semester") === "2" ? 2 : 1;
    const period = url.searchParams.get("period") === "2" ? 2 : 1;
    if (!subjectId || !classId) return Response.json({ ok: false, error: "المادة والفصل مطلوبان" }, { status: 400 });

    // الفترة السابقة: (فترة 1 ← لا سابق)، (فترة 2 ← فترة 1 نفس الفصل)، (فصل 2 فترة 1 ← فصل 1 فترة 2)
    const prev = period === 2 ? { semester, period: 1 } : semester === 2 ? { semester: 1, period: 2 } : null;

    // المادة والفصل (تحقق الملكية)
    const subj = await db.execute<{ id: number; name: string }>(sql`
      SELECT id, name FROM subjects WHERE id = ${subjectId} AND teacher_id = ${session.sub} LIMIT 1`);
    if (subj.rows.length === 0) return Response.json({ ok: false, error: "المادة غير موجودة" }, { status: 404 });
    const cls = await db.execute<{ id: number; name: string; grade_label: string }>(sql`
      SELECT id, name, grade_label FROM classes WHERE id = ${classId} AND teacher_id = ${session.sub} LIMIT 1`);
    if (cls.rows.length === 0) return Response.json({ ok: false, error: "الفصل غير موجود" }, { status: 404 });

    const students = await db.execute<{ id: number; full_name: string; national_id: string; guardian_phone: string }>(sql`
      SELECT id, full_name, national_id, guardian_phone FROM students WHERE class_id = ${classId} ORDER BY full_name ASC`);
    const ids = students.rows.map((r) => Number(r.id));
    if (ids.length === 0) return Response.json({ ok: true, subject: subj.rows[0], class: cls.rows[0], levels: LEVELS, students: [], boxes: [], subjectsCompare: [], classesCompare: [], periodCompare: null, maxTotal: 0, prev, semester, period });
    const idList = ids.map((n) => Math.trunc(n)).join(",");

    // خانات المادة المفعّلة
    const boxes = await db.execute<{ id: number; name: string; category: string; max: number }>(sql`
      SELECT id, name, category, max_score::float AS max FROM grade_components
      WHERE subject_id = ${subjectId} AND is_active = TRUE ORDER BY sort_order ASC, id ASC`);
    const comps = boxes.rows.map((r) => ({ id: Number(r.id), name: String(r.name), category: String(r.category), max: num(r.max) }));
    const maxTotal = comps.reduce((a, c) => a + c.max, 0);

    // درجات المادة الحالية (لكل خانة)
    const curGrades = await db.execute<{ student_id: number; comp_id: number; value: number }>(sql`
      SELECT g.student_id, gc.id AS comp_id, g.value::float AS value
      FROM grades g JOIN grade_components gc ON gc.id = g.component_id
      WHERE gc.subject_id = ${subjectId} AND g.student_id = ANY(ARRAY[${sql.raw(idList)}]::int[])
        AND g.semester = ${semester} AND g.period = ${period} AND g.value IS NOT NULL`);
    // درجات المادة السابقة (للمقارنة)
    const prevGrades = prev
      ? await db.execute<{ student_id: number; comp_id: number; value: number }>(sql`
          SELECT g.student_id, gc.id AS comp_id, g.value::float AS value
          FROM grades g JOIN grade_components gc ON gc.id = g.component_id
          WHERE gc.subject_id = ${subjectId} AND g.student_id = ANY(ARRAY[${sql.raw(idList)}]::int[])
            AND g.semester = ${prev.semester} AND g.period = ${prev.period} AND g.value IS NOT NULL`)
      : { rows: [] as Array<{ student_id: number; comp_id: number; value: number }> };
    // درجات كل مواد الفصل (للمقارنة بين المواد)
    const allGrades = await db.execute<{ subject_id: number; student_id: number; value: number }>(sql`
      SELECT s2.id AS subject_id, g.student_id, g.value::float AS value
      FROM grades g
      JOIN grade_components gc ON gc.id = g.component_id AND gc.is_active = TRUE
      JOIN subjects s2 ON s2.id = gc.subject_id AND s2.is_active = TRUE
      WHERE g.student_id = ANY(ARRAY[${sql.raw(idList)}]::int[])
        AND g.semester = ${semester} AND g.period = ${period} AND g.value IS NOT NULL`);
    const subjMax = await db.execute<{ subject_id: number; name: string; max: number }>(sql`
      SELECT s.id AS subject_id, s.name, COALESCE(SUM(gc.max_score),0)::float AS max
      FROM subjects s
      JOIN subject_class_links l ON l.subject_id = s.id AND l.class_id = ${classId}
      LEFT JOIN grade_components gc ON gc.subject_id = s.id AND gc.is_active = TRUE
      WHERE s.teacher_id = ${session.sub} AND s.is_active = TRUE
      GROUP BY s.id, s.name ORDER BY s.sort_order ASC`);
    // فصول المادة (للمقارنة بين الفصول/الشعب)
    const subjClasses = await db.execute<{ id: number; name: string; grade_label: string; cnt: number }>(sql`
      SELECT c.id, c.name, c.grade_label, COUNT(st.id)::int AS cnt
      FROM classes c
      JOIN subject_class_links l ON l.class_id = c.id AND l.subject_id = ${subjectId}
      LEFT JOIN students st ON st.class_id = c.id
      WHERE c.teacher_id = ${session.sub}
      GROUP BY c.id, c.name, c.grade_label ORDER BY c.sort_order ASC, c.id ASC`);
    const subjClassGrades = await db.execute<{ class_id: number; student_id: number; value: number }>(sql`
      SELECT c.id AS class_id, g.student_id, g.value::float AS value
      FROM grades g
      JOIN grade_components gc ON gc.id = g.component_id AND gc.is_active = TRUE
      JOIN subjects s ON s.id = gc.subject_id AND s.id = ${subjectId}
      JOIN students st ON st.id = g.student_id
      JOIN classes c ON c.id = st.class_id AND c.teacher_id = ${session.sub}
      WHERE g.semester = ${semester} AND g.period = ${period} AND g.value IS NOT NULL`);

    // ===== تجميع: لكل طالب في المادة الحالية =====
    type Acc = { total: number; byBox: Map<number, number> };
    const cur = new Map<number, Acc>();
    for (const g of curGrades.rows as Array<{ student_id: number; comp_id: number; value: number }>) {
      const a = cur.get(g.student_id) ?? { total: 0, byBox: new Map<number, number>() };
      a.total += g.value; a.byBox.set(g.comp_id, g.value);
      cur.set(g.student_id, a);
    }
    const prevAcc = new Map<number, number>();
    for (const g of prevGrades.rows as Array<{ student_id: number; comp_id: number; value: number }>) {
      prevAcc.set(g.student_id, (prevAcc.get(g.student_id) ?? 0) + g.value);
    }

    // خرائط الخانات (حالياً/سابقاً) لكل طالب
    const curByBox = (sid: number) => cur.get(sid)?.byBox ?? new Map<number, number>();
    const prevByBox = new Map<number, Map<number, number>>();
    for (const g of prevGrades.rows as Array<{ student_id: number; comp_id: number; value: number }>) {
      const m = prevByBox.get(g.student_id) ?? new Map<number, number>();
      m.set(g.comp_id, g.value); prevByBox.set(g.student_id, m);
    }

    // ===== الطلاب =====
    const studentsOut = students.rows.map((st) => {
      const sid = Number(st.id);
      const acc = cur.get(sid);
      const total = acc?.total ?? 0;
      const filled = acc ? acc.byBox.size : 0;
      const complete = filled === comps.length && comps.length > 0;
      const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
      const lvl = levelOf(pct);
      const weak: string[] = [];
      const strong: string[] = [];
      for (const c of comps) {
        const score = acc?.byBox.get(c.id) ?? null;
        if (score === null || c.max <= 0) continue;
        const r = score / c.max;
        if (r < MASTERY60 / 100) weak.push(c.name);
        else if (r >= 0.8) strong.push(c.name);
      }
      const prevPct = prev && maxTotal > 0 ? ((prevAcc.get(sid) ?? 0) / maxTotal) * 100 : null;
      const delta = prevPct !== null && filled > 0 ? Math.round((pct - prevPct) * 10) / 10 : null;
      return {
        id: sid, name: String(st.full_name), nationalId: String(st.national_id ?? ""), guardianPhone: String(st.guardian_phone ?? ""),
        total, filled, complete, pct: Math.round(pct * 10) / 10,
        levelKey: lvl.key, levelLabel: lvl.label, levelColor: lvl.color, levelBg: lvl.bg,
        weak, strong, prevPct: prevPct !== null ? Math.round(prevPct * 10) / 10 : null, delta,
      };
    });

    // ===== مستويات الأداء =====
    const gradedStudents = studentsOut.filter((s) => s.filled > 0);
    const levelsOut = LEVELS.map((l) => {
      const count = gradedStudents.filter((s) => s.levelKey === l.key).length;
      return { key: l.key, label: l.label, color: l.color, bg: l.bg, count, pct: gradedStudents.length ? Math.round((count / gradedStudents.length) * 1000) / 10 : 0 };
    });

    // ===== الخانات (مهارات) =====
    const boxesOut = comps.map((c) => {
      const curVals: number[] = [];
      for (const st of students.rows) { const v = cur.get(Number(st.id))?.byBox.get(c.id); if (v !== undefined) curVals.push(v); }
      const prevVals: number[] = [];
      for (const st of students.rows) { const v = prevByBox.get(Number(st.id))?.get(c.id); if (v !== undefined) prevVals.push(v); }
      const n = curVals.length;
      const avg = n ? curVals.reduce((a, b) => a + b, 0) / n : 0;
      const mastery = n && c.max > 0 ? (curVals.filter((v) => v / c.max >= MASTERY60 / 100).length / n) * 100 : 0;
      const pass50 = n && c.max > 0 ? (curVals.filter((v) => v / c.max >= PASS50 / 100).length / n) * 100 : 0;
      const prevMastery = prevVals.length && c.max > 0 ? (prevVals.filter((v) => v / c.max >= MASTERY60 / 100).length / prevVals.length) * 100 : null;
      const status = mastery >= 80 ? "mastered" : mastery >= 60 ? "attention" : "gap";
      return { id: c.id, name: c.name, category: c.category, max: c.max, avg: Math.round(avg * 10) / 10, mastery: Math.round(mastery), pass50: Math.round(pass50), prevMastery: prevMastery !== null ? Math.round(prevMastery) : null, status, filled: n };
    });

    // ===== مقارنة المواد (في هذا الفصل، الفترة الحالية) =====
    const subjTotals = new Map<number, Map<number, number>>();
    for (const g of allGrades.rows as Array<{ subject_id: number; student_id: number; value: number }>) {
      const m = subjTotals.get(g.subject_id) ?? new Map<number, number>();
      m.set(g.student_id, (m.get(g.student_id) ?? 0) + g.value);
      subjTotals.set(g.subject_id, m);
    }
    const subjectsCompare = subjMax.rows.map((r) => {
      const sid = Number(r.subject_id); const smax = num(r.max);
      const m = subjTotals.get(sid);
      const pcts: number[] = [];
      if (m && smax > 0) for (const [sid2, tot] of m) pcts.push((tot / smax) * 100);
      const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
      const pass50r = pcts.length ? (pcts.filter((p) => p >= PASS50).length / pcts.length) * 100 : 0;
      return { id: sid, name: String(r.name), isCurrent: sid === subjectId, studentCount: pcts.length, avgPct: Math.round(avg * 10) / 10, passRate50: Math.round(pass50r) };
    });

    // ===== مقارنة الفصول/الشعب (هذه المادة) =====
    const clsTotals = new Map<number, Map<number, number>>();
    for (const g of subjClassGrades.rows as Array<{ class_id: number; student_id: number; value: number }>) {
      const m = clsTotals.get(g.class_id) ?? new Map<number, number>();
      m.set(g.student_id, (m.get(g.student_id) ?? 0) + g.value);
      clsTotals.set(g.class_id, m);
    }
    const classesCompare = subjClasses.rows.map((r) => {
      const cid = Number(r.id); const m = clsTotals.get(cid);
      const pcts: number[] = [];
      if (m && maxTotal > 0) for (const [, tot] of m) pcts.push((tot / maxTotal) * 100);
      const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
      const pass50r = pcts.length ? (pcts.filter((p) => p >= PASS50).length / pcts.length) * 100 : 0;
      return { id: cid, name: String(r.name), gradeLabel: String(r.grade_label), isCurrent: cid === classId, studentCount: Number(r.cnt), avgPct: Math.round(avg * 10) / 10, passRate50: Math.round(pass50r) };
    });

    // ===== مقارنة الفترة الحالية بالسابقة =====
    let periodCompare = null;
    if (prev) {
      const curPcts = gradedStudents.map((s) => s.pct);
      const prevPctVals: number[] = [];
      for (const st of students.rows) { const v = prevAcc.get(Number(st.id)); if (v) prevPctVals.push((v / maxTotal) * 100); }
      const curAvg = curPcts.length ? curPcts.reduce((a, b) => a + b, 0) / curPcts.length : 0;
      const prevAvg = prevPctVals.length ? prevPctVals.reduce((a, b) => a + b, 0) / prevPctVals.length : 0;
      let improved = 0, declined = 0, unchanged = 0;
      for (const s of studentsOut) { if (s.delta !== null) { if (s.delta > 0.5) improved++; else if (s.delta < -0.5) declined++; else unchanged++; } }
      periodCompare = {
        exists: prevPctVals.length > 0,
        prevLabel: `الفصل ${prev.semester} · الفترة ${prev.period}`,
        curLabel: `الفصل ${semester} · الفترة ${period}`,
        curAvg: Math.round(curAvg * 10) / 10, prevAvg: Math.round(prevAvg * 10) / 10,
        delta: Math.round((curAvg - prevAvg) * 10) / 10, improved, declined, unchanged,
      };
    }

    return Response.json({
      ok: true, subject: subj.rows[0], class: cls.rows[0], semester, period, prev,
      levels: levelsOut, students: studentsOut, boxes: boxesOut,
      subjectsCompare, classesCompare, periodCompare, maxTotal,
    });
  } catch (err) {
    console.error("mastery error", err);
    return Response.json({ ok: false, error: "تعذر التحليل" }, { status: 500 });
  }
}
