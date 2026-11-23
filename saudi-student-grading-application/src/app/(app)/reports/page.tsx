"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import {
  FileText, Printer, FileSpreadsheet, Loader2, Table2, UserRound,
  BarChart3, AlertCircle, Download, CalendarRange, Sigma, RectangleHorizontal, RectangleVertical, Medal, IdCard, Info,
} from "lucide-react";
import { toast } from "@/components/AppShell";

type ClassItem = { id: number; name: string; grade_label: string; stage: string };
type SubjectItem = { id: number; name: string; color: string; is_active: boolean; class_ids?: number[] };
type Component = { id: number; name: string; category: string; max_score: number; weight_label: string; is_active: boolean };
type StudentRow = { id: number; full_name: string; national_id: string };
type SubjectInfo = { id: number; name: string; max_total: string | number; pass_score: string | number; color: string };
type TeacherInfo = {
  full_name: string; school_name: string; education_admin: string; education_office: string;
  city: string; principal_name: string; academic_year: string; semester: string; job_title: string;
};
type YearRow = {
  s: StudentRow; s1p1: number; s1p2: number; s2p1: number; s2p2: number;
  sem1: number; sem2: number; yearTotal: number; avg: number; percent: number;
  semMax: number; yearMax: number;
};
type TabKey = "sheet" | "notices" | "analysis" | "year" | "sem1";

const SEMESTERS: Record<string, string> = { "1": "الفصل الدراسي الأول", "2": "الفصل الدراسي الثاني" };
const PERIODS: Record<string, string> = { "1": "الفترة الأولى", "2": "الفترة الثانية" };

function band(pct: number) {
  if (pct >= 90) return { label: "ممتاز", comment: "أداء متميز — نرجو المحافظة على التفوق" };
  if (pct >= 80) return { label: "جيد جداً", comment: "أداء مميز — بخطوات قليلة يصل للامتياز" };
  if (pct >= 70) return { label: "جيد", comment: "مستوى جيد — يحتاج مزيداً من التركيز في المذاكرة" };
  if (pct >= 60) return { label: "مقبول", comment: "مقبول — يُنصح بمراجعة الدروس أولاً بأول" };
  return { label: "ضعيف", comment: "يحتاج خطة علاجية ومتابعة منزلية عاجلة" };
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function ReportsInner() {
  const searchParams = useSearchParams();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classId, setClassId] = useState(searchParams.get("classId") ?? "");
  const [subjectId, setSubjectId] = useState(searchParams.get("subjectId") ?? "");
  const [semester, setSemester] = useState(searchParams.get("semester") ?? "1");
  const [period, setPeriod] = useState(searchParams.get("period") ?? "1");
  const [tab, setTab] = useState<TabKey>("sheet");
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [hideNid, setHideNid] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [subject, setSubject] = useState<SubjectInfo | null>(null);
  const [grades, setGrades] = useState<Record<number, Record<number, number | null>>>({});
  const [yearRows, setYearRows] = useState<YearRow[]>([]);
  const [yearPeriodMax, setYearPeriodMax] = useState(100);
  const [teacher, setTeacher] = useState<TeacherInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // المواد الظاهرة = المرتبطة بهذا الفصل تحديداً
  const linkedSubjects = useMemo(
    () => subjects.filter((s) => !classId || (s.class_ids ?? []).map(Number).includes(Number(classId))),
    [subjects, classId]
  );

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" }).then((r) => r.json()).then((d) => d.ok && setTeacher(d.teacher));
    fetch("/api/classes", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (d.ok) {
        setClasses(d.classes);
        if (!classId && d.classes[0]) setClassId(String(d.classes[0].id));
      }
    });
    fetch("/api/subjects", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (d.ok) setSubjects(d.subjects.filter((s: SubjectItem) => s.is_active));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ضمان اختيار مادة مرتبطة عند تغيّر الفصل
  useEffect(() => {
    if (linkedSubjects.length > 0 && !linkedSubjects.some((s) => String(s.id) === subjectId)) {
      setSubjectId(String(linkedSubjects[0].id));
    }
  }, [linkedSubjects, subjectId]);

  // بيانات الكشف المحدد (فصل + فترة)
  useEffect(() => {
    if (!classId || !subjectId) return;
    setLoading(true);
    fetch(`/api/grades?classId=${classId}&subjectId=${subjectId}&semester=${semester}&period=${period}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setStudents(d.students);
          setSubject(d.subject);
          setComponents(d.components.filter((c: Component) => c.is_active));
          setGrades(d.grades ?? {});
        }
      })
      .finally(() => setLoading(false));
  }, [classId, subjectId, semester, period]);

  // بيانات ملخص العام (الفصلان والفترتان) — تُحمَّل عند فتح تبويب الملخص
  useEffect(() => {
    if (!classId || !subjectId || (tab !== "year" && tab !== "sem1")) return;
    fetch(`/api/grades/year?classId=${classId}&subjectId=${subjectId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) { setYearRows(d.rows); setYearPeriodMax(d.periodMax); }
      });
  }, [classId, subjectId, tab]);

  const maxTotal = useMemo(() => components.reduce((a, c) => a + Number(c.max_score), 0), [components]);
  const passScore = subject ? Number(subject.pass_score) : 50;
  const activeClass = classes.find((c) => String(c.id) === classId);
  const classLabel = activeClass ? `${activeClass.grade_label} — فصل ${activeClass.name}` : "";
  const semesterLabel = SEMESTERS[semester] ?? "الفصل الدراسي الأول";
  const periodLabel = PERIODS[period] ?? "الفترة الأولى";
  const axisLabel = `${semesterLabel} · ${periodLabel}`;
  const today = new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "long", year: "numeric" }).format(new Date());

  const rows = useMemo(() => students.map((s) => {
    const perComp = components.map((c) => {
      const v = grades?.[s.id]?.[c.id];
      return v === null || v === undefined ? null : Number(v);
    });
    const total = perComp.reduce<number>((a, v) => a + (v ?? 0), 0);
    const filled = perComp.filter((v) => v !== null).length;
    const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
    return { s, perComp, total, filled, pct, band: band(pct) };
  }), [students, components, grades, maxTotal]);

  // مجاميع المجموعتين لكل طالب (للطباعة: الإجماليات فقط دون البنود)
  const perfMax = components.filter((c) => c.category === "performance").reduce((a, c) => a + Number(c.max_score), 0);
  const writtenMax = components.filter((c) => c.category === "written").reduce((a, c) => a + Number(c.max_score), 0);
  const grouped = useMemo(() => rows.map((r) => {
    let perf = 0, perfFilled = 0, written = 0, writtenFilled = 0;
    components.forEach((c, j) => {
      const v = r.perComp[j];
      if (v === null) return;
      if (c.category === "performance") { perf += v; perfFilled++; }
      else { written += v; writtenFilled++; }
    });
    return { ...r, perf, perfFilled, written, writtenFilled };
  }), [rows, components]);

  const groupedStats = useMemo(() => {
    const withPerf = grouped.filter((r) => r.perfFilled > 0);
    const withWritten = grouped.filter((r) => r.writtenFilled > 0);
    const avgOf = (list: typeof grouped, key: "perf" | "written") =>
      list.length ? list.reduce((a, r) => a + r[key], 0) / list.length : 0;
    return {
      perfAvg: avgOf(withPerf, "perf"), writtenAvg: avgOf(withWritten, "written"),
      perfTop: withPerf.length ? Math.max(...withPerf.map((r) => r.perf)) : 0,
      perfLow: withPerf.length ? Math.min(...withPerf.map((r) => r.perf)) : 0,
      writtenTop: withWritten.length ? Math.max(...withWritten.map((r) => r.written)) : 0,
      writtenLow: withWritten.length ? Math.min(...withWritten.map((r) => r.written)) : 0,
      perfMastery: withPerf.length ? (withPerf.filter((r) => perfMax > 0 && r.perf / perfMax >= 0.6).length / withPerf.length) * 100 : 0,
      writtenMastery: withWritten.length ? (withWritten.filter((r) => writtenMax > 0 && r.written / writtenMax >= 0.6).length / withWritten.length) * 100 : 0,
    };
  }, [grouped, perfMax, writtenMax]);

  const classAvg = rows.length ? rows.reduce((a, r) => a + r.pct, 0) / rows.length : 0;
  const passCount = rows.filter((r) => r.total >= passScore && r.filled > 0).length;
  const gradedCount = rows.filter((r) => r.filled > 0).length;

  const passingYear = yearRows.filter((r) => r.avg >= passScore).length;
  const gradedYear = yearRows.filter((r) => r.yearTotal > 0).length;
  const yearAvg = yearRows.length ? yearRows.reduce((a, r) => a + r.percent, 0) / yearRows.length : 0;

  // إحصائيات ملخص الفصل الدراسي الأول
  const sem1Rows = yearRows.map((r) => ({
    ...r,
    semAvg: r.sem1 / 2,
    semPct: yearPeriodMax > 0 ? (r.sem1 / (2 * yearPeriodMax)) * 100 : 0,
  }));
  const sem1Graded = sem1Rows.filter((r) => r.sem1 > 0).length;
  const sem1Passing = sem1Rows.filter((r) => r.semAvg >= passScore).length;
  const sem1ClassAvg = sem1Rows.length ? sem1Rows.reduce((a, r) => a + r.semPct, 0) / sem1Rows.length : 0;

  // ============ تصدير Excel مطابق لقالب نور ============
  const exportNoor = () => {
    if (!subject || !teacher) return;
    setExporting(true);
    try {
      const title = `كشف رصد درجات مادة ${subject.name} — ${classLabel} — ${axisLabel}`;
      const header = ["م", "رقم السجل المدني", "اسم الطالب",
        ...components.map((c) => `${c.name} (${fmt(Number(c.max_score))})`),
        `المجموع (${fmt(maxTotal)})`, "النسبة %", "التقدير"];
      const aoa: (string | number)[][] = [
        ["المملكة العربية السعودية"],
        ["وزارة التعليم"],
        [teacher.education_admin],
        [`${teacher.school_name} — ${teacher.city}`],
        [title],
        [`${semesterLabel} · ${periodLabel} · العام الدراسي ${teacher.academic_year} · المعلم: ${teacher.full_name}`],
        [],
        header,
        ...rows.map((r, i) => [
          i + 1,
          r.s.national_id || "",
          r.s.full_name,
          ...r.perComp.map((v) => (v === null ? "" : v)),
          r.filled > 0 ? r.total : "",
          r.filled > 0 ? Number(r.pct.toFixed(1)) : "",
          r.filled > 0 ? r.band.label : "",
        ]),
        [],
        [`إعداد المعلم: ${teacher.full_name}`, "", "", "", "", "", `مدير المدرسة: ${teacher.principal_name}`, "", "الختم والتوقيع"],
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!views"] = [{ rightToLeft: true, showGridLines: false }];
      ws["!cols"] = [{ wch: 5 }, { wch: 17 }, { wch: 32 }, ...components.map(() => ({ wch: 15 })), { wch: 13 }, { wch: 10 }, { wch: 11 }];
      const lastCol = header.length - 1;
      ws["!merges"] = [0, 1, 2, 3, 4, 5].map((r) => ({ s: { r, c: 0 }, e: { r, c: Math.min(lastCol, 8) } }));
      const wb = XLSX.utils.book_new();
      wb.Workbook = { Views: [{ RTL: true }] };
      XLSX.utils.book_append_sheet(wb, ws, "رصد الدرجات");
      const fileName = `نور-${subject.name}-${activeClass?.grade_label ?? ""}-${activeClass?.name ?? ""}-فصل${semester}-فترة${period}.xlsx`.replace(/[\\/:*?"<>|]/g, "-");
      XLSX.writeFile(wb, fileName);
      toast("تم تصدير ملف Excel مطابق لقالب نور");
    } catch (err) {
      console.error(err);
      toast("تعذر إنشاء ملف Excel", "error");
    } finally {
      setExporting(false);
    }
  };

  const TABS: Array<{ key: TabKey; label: string; icon: typeof Table2 }> = [
    { key: "sheet", label: "كشف الرصد الرسمي", icon: Table2 },
    { key: "notices", label: "الإشعارات الفردية", icon: UserRound },
    { key: "analysis", label: "تحليل أداء الفصل", icon: BarChart3 },
    { key: "sem1", label: "ملخص الفصل الأول", icon: Medal },
    { key: "year", label: "ملخص الفصلين والعام", icon: Sigma },
  ];

  /** طباعة مع حقن اتجاه @page ديناميكياً — الطريقة الموثوقة في Chrome/Edge */
  const handlePrint = () => {
    const RULE_ID = "rased-print-page-rule";
    document.getElementById(RULE_ID)?.remove();
    const style = document.createElement("style");
    style.id = RULE_ID;
    const orient = orientation === "portrait" ? "portrait" : "landscape";
    const margin = orientation === "portrait" ? "12mm 16mm" : "10mm 15mm";
    style.textContent = `@page { size: A4 ${orient} !important; margin: ${margin} !important; }`;
    document.head.appendChild(style);
    const cleanup = () => {
      document.getElementById(RULE_ID)?.remove();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    // احتياط: window.print() متزامن في Chrome ويطلق afterprint عند الإغلاق
    window.setTimeout(cleanup, 1500);
  };

  return (
    <div className="space-y-4">
      {/* ===== شريط التحكم (لا يُطبع) ===== */}
      <div className="no-print space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-[#0a4630]"><FileText className="text-[#c9a24b]" /> التقارير والطباعة والتصدير</h2>
            <p className="text-[0.72rem] font-semibold text-[#5c6f65]">كشوف رسمية بترويسة وزارة التعليم — الفصلان الدراسيان · الفترة الأولى والثانية — جاهزة للطباعة والتصدير لنور</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* تبديل اتجاه الطباعة */}
            <div className="flex gap-1 rounded-xl bg-[#eef1ec] p-1" title="اتجاه صفحة الطباعة">
              <button onClick={() => setOrientation("landscape")} aria-pressed={orientation === "landscape"}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[0.72rem] font-extrabold transition ${orientation === "landscape" ? "bg-white text-[#0a4630] shadow" : "text-[#5c6f65]"}`}>
                <RectangleHorizontal size={16} /> أفقي
              </button>
              <button onClick={() => setOrientation("portrait")} aria-pressed={orientation === "portrait"}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[0.72rem] font-extrabold transition ${orientation === "portrait" ? "bg-white text-[#0a4630] shadow" : "text-[#5c6f65]"}`}>
                <RectangleVertical size={16} /> عمودي
              </button>
            </div>
            <label className="flex cursor-pointer select-none items-center gap-2 rounded-xl border border-[#e3e4dd] bg-white px-3 py-2 text-[0.7rem] font-extrabold text-[#3c4f44] hover:shadow-sm">
              <input type="checkbox" className="accent-[#0e5c3a]" checked={hideNid} onChange={(e) => setHideNid(e.target.checked)} />
              <IdCard size={14} /> إخفاء رقم السجل المدني في الطباعة
            </label>
            <button onClick={exportNoor} disabled={exporting || loading} className="btn btn-gold">
              {exporting ? <Loader2 size={17} className="animate-spin" /> : <FileSpreadsheet size={17} />}
              تصدير Excel لنور
            </button>
            <button onClick={handlePrint} className="btn btn-primary">
              <Printer size={17} /> طباعة / PDF
            </button>
          </div>
        </div>

        <div className="card flex flex-wrap items-center gap-3 p-3">
          <label className="flex items-center gap-2">
            <span className="text-[0.7rem] font-extrabold text-[#5c6f65]">الفصل</span>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className="input !w-auto font-bold">
              {classes.map((c) => <option key={c.id} value={c.id}>{c.grade_label} — {c.name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-[0.7rem] font-extrabold text-[#5c6f65]">المادة</span>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="input !w-auto font-bold">
              {linkedSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <CalendarRange size={15} className="text-[#5c6f65]" />
            <select value={semester} onChange={(e) => setSemester(e.target.value)} className="input !w-auto font-bold" aria-label="الفصل الدراسي">
              <option value="1">الفصل الدراسي الأول</option>
              <option value="2">الفصل الدراسي الثاني</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="input !w-auto font-bold" aria-label="الفترة">
              <option value="1">الفترة الأولى</option>
              <option value="2">الفترة الثانية</option>
            </select>
          </label>
          <div className="ms-auto flex flex-wrap gap-1 rounded-xl bg-[#eef1ec] p-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[0.72rem] font-extrabold transition ${active ? "bg-white text-[#0a4630] shadow" : "text-[#5c6f65]"}`}>
                  <Icon size={15} /> {t.label}
                </button>
              );
            })}
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-[0.65rem] font-bold text-[#8a968d]">
          <Info size={13} className="shrink-0" />
          عند الطباعة اختر: ورق A4، والمهمش «الافتراضي» (لا تستخدم مهمشاً مخصصاً)، والتخطيط يتبع اتجاه الصفحة المحدد أعلاه — هذا يمنع اقتطاع أي جانب من الورقة.
        </p>
        {linkedSubjects.length === 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-[0.72rem] font-bold text-amber-800">
            <AlertCircle size={15} /> لا توجد مواد مرتبطة بهذا الفصل — اربطها من «المواد والتوزيع» أو زر «ربط كل المواد» في صفحة الفصول.
          </div>
        )}
        {tab !== "year" && !loading && gradedCount === 0 && linkedSubjects.length > 0 && (
          <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-[0.72rem] font-bold text-amber-800">
            <AlertCircle size={15} /> لا توجد درجات مرصودة لهذا النطاق (الفصل/الفترة) — ستُطبع الخلايا فارغة.
          </div>
        )}
      </div>

      {/* ===== منطقة الطباعة ===== */}
      {loading && tab !== "year" ? (
        <div className="shimmer no-print h-96 rounded-3xl" />
      ) : (
        <div className="print-area">
          {tab === "sheet" && (
            <div className={`print-sheet ${orientation === "portrait" ? "portrait" : ""}`}>
              <SheetHeader teacher={teacher} subjectName={subject?.name ?? ""} classLabel={classLabel} today={today}
                docTitle={`كشف رصد درجات مادة ${subject?.name ?? ""}`} axisLabel={axisLabel} />
              <table className="sheet-table">
                <colgroup>
                  <col style={{ width: "4%" }} />
                  {!hideNid && <col style={{ width: "12%" }} />}
                  <col style={{ width: hideNid ? "34%" : "26%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "13%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th rowSpan={2}>م</th>
                    {!hideNid && <th rowSpan={2}>رقم السجل<br />المدني</th>}
                    <th rowSpan={2}>اسم الطالب</th>
                    <th colSpan={2}>توزيع الدرجات (الإجماليات)</th>
                    <th rowSpan={2}>المجموع<br />{fmt(maxTotal)}</th>
                    <th rowSpan={2}>النسبة</th>
                    <th rowSpan={2}>التقدير</th>
                    <th rowSpan={2}>توقيع ولي<br />الأمر</th>
                  </tr>
                  <tr>
                    <th>المهام الأدائية<br /><span style={{ fontWeight: 600, fontSize: "0.6rem" }}>من {fmt(perfMax)}</span></th>
                    <th>التقويمات التحريرية<br /><span style={{ fontWeight: 600, fontSize: "0.6rem" }}>من {fmt(writtenMax)}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map((r, i) => (
                    <tr key={r.s.id} style={r.filled > 0 && r.total < passScore ? { background: "#fdf1f1" } : undefined}>
                      <td>{i + 1}</td>
                      {!hideNid && <td dir="ltr" className="nid">{r.s.national_id || "—"}</td>}
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{r.s.full_name}</td>
                      <td style={{ fontWeight: 700 }}>{r.perfFilled > 0 ? fmt(r.perf) : ""}</td>
                      <td style={{ fontWeight: 700 }}>{r.writtenFilled > 0 ? fmt(r.written) : ""}</td>
                      <td style={{ fontWeight: 800 }}>{r.filled > 0 ? fmt(r.total) : ""}</td>
                      <td>{r.filled > 0 ? `${r.pct.toFixed(1)}%` : ""}</td>
                      <td style={{ fontWeight: 800 }}>{r.filled > 0 ? r.band.label : ""}</td>
                      <td style={{ minWidth: 70 }}></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#eef3ee", fontWeight: 800 }}>
                    <td colSpan={hideNid ? 2 : 3}>المتوسط العام للفصل / عدد الناجحين</td>
                    <td>{grouped.some((r) => r.perfFilled > 0) ? groupedStats.perfAvg.toFixed(1) : "—"}</td>
                    <td>{grouped.some((r) => r.writtenFilled > 0) ? groupedStats.writtenAvg.toFixed(1) : "—"}</td>
                    <td colSpan={2}>{gradedCount > 0 ? `${classAvg.toFixed(1)}%` : "—"}</td>
                    <td colSpan={2}>{gradedCount > 0 ? `${passCount} / ${gradedCount}` : "—"}</td>
                  </tr>
                </tfoot>
              </table>
              <SignatureRow teacher={teacher} />
            </div>
          )}

          {tab === "notices" && (
            <div>
              {grouped.map((r, i) => (
                <div key={r.s.id} className={`print-sheet ${i < grouped.length - 1 ? "page-break" : ""} ${orientation === "portrait" ? "portrait" : ""} mb-6`}>
                  <SheetHeader teacher={teacher} subjectName={subject?.name ?? ""} classLabel={classLabel} today={today}
                    docTitle="إشعار درجات الطالب" axisLabel={axisLabel} />
                  <div className={`mb-3 grid grid-cols-2 gap-2 text-[0.75rem] ${hideNid ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
                    {[
                      ["اسم الطالب", r.s.full_name],
                      ...(hideNid ? [] : [["رقم السجل المدني", r.s.national_id || "—"]]),
                      ["الصف / الفصل", classLabel],
                      ["المادة", subject?.name ?? ""],
                    ].map(([k, v]) => (
                      <div key={k as string} className="rounded-lg border border-[#dfe3da] bg-[#fbfbf8] p-2 text-center">
                        <div className="text-[0.58rem] font-bold text-[#7a857d]">{k}</div>
                        <div className="mt-0.5 font-extrabold text-[#0a4630]">{v}</div>
                      </div>
                    ))}
                  </div>
                  <table className="sheet-table">
                    <thead>
                      <tr>
                        <th>المهام الأدائية<br /><span style={{ fontWeight: 600, fontSize: "0.6rem" }}>من {fmt(perfMax)}</span></th>
                        <th>التقويمات التحريرية<br /><span style={{ fontWeight: 600, fontSize: "0.6rem" }}>من {fmt(writtenMax)}</span></th>
                        <th>المجموع<br />{fmt(maxTotal)}</th>
                        <th>النسبة</th><th>التقدير</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 800, fontSize: "1rem" }}>{r.perfFilled > 0 ? fmt(r.perf) : "—"}</td>
                        <td style={{ fontWeight: 800, fontSize: "1rem" }}>{r.writtenFilled > 0 ? fmt(r.written) : "—"}</td>
                        <td style={{ fontWeight: 800, fontSize: "1rem" }}>{r.filled > 0 ? fmt(r.total) : "—"}</td>
                        <td style={{ fontSize: "1rem" }}>{r.filled > 0 ? `${r.pct.toFixed(1)}%` : "—"}</td>
                        <td style={{ fontWeight: 800, fontSize: "1rem" }}>{r.filled > 0 ? r.band.label : "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="mt-3 rounded-xl border border-dashed border-[#c9a24b] bg-[#fffdf2] p-3 text-[0.78rem] font-bold text-[#6b5518]">
                    <span className="text-[#a8843a]">تعليق المعلم: </span>{r.filled > 0 ? r.band.comment : "لم تُرصد درجاته بعد"}
                  </div>
                  <SignatureRow teacher={teacher} />
                </div>
              ))}
              {rows.length === 0 && <p className="no-print card p-10 text-center text-sm font-bold text-[#8a968d]">لا يوجد طلاب في هذا الفصل</p>}
            </div>
          )}

          {tab === "analysis" && (
            <div className={`print-sheet ${orientation === "portrait" ? "portrait" : ""}`}>
              <SheetHeader teacher={teacher} subjectName={subject?.name ?? ""} classLabel={classLabel} today={today}
                docTitle="تقرير تحليل أداء الفصل" axisLabel={axisLabel} />
              <table className="sheet-table">
                <thead>
                  <tr><th>المجموعة</th><th>العظمى</th><th>متوسط الكشف</th><th>أعلى درجة</th><th>أدنى درجة</th><th>نسبة الإتقان ≥ 60%</th></tr>
                </thead>
                <tbody>
                  {([
                    { label: "المهام الأدائية", max: perfMax, avg: groupedStats.perfAvg, top: groupedStats.perfTop, low: groupedStats.perfLow, mastery: groupedStats.perfMastery, any: grouped.some((r) => r.perfFilled > 0) },
                    { label: "التقويمات التحريرية", max: writtenMax, avg: groupedStats.writtenAvg, top: groupedStats.writtenTop, low: groupedStats.writtenLow, mastery: groupedStats.writtenMastery, any: grouped.some((r) => r.writtenFilled > 0) },
                  ]).map((row) => (
                    <tr key={row.label}>
                      <td style={{ textAlign: "right", fontWeight: 800 }}>{row.label}</td>
                      <td>{fmt(row.max)}</td>
                      <td>{row.any ? row.avg.toFixed(2) : "—"}</td>
                      <td>{row.any ? fmt(row.top) : "—"}</td>
                      <td>{row.any ? fmt(row.low) : "—"}</td>
                      <td>{row.any ? `${row.mastery.toFixed(0)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#eef3ee", fontWeight: 800 }}>
                    <td style={{ textAlign: "right" }}>الإجمالي</td>
                    <td>{fmt(maxTotal)}</td>
                    <td>{gradedCount > 0 ? (rows.reduce((a, r) => a + r.total, 0) / gradedCount).toFixed(2) : "—"}</td>
                    <td>{gradedCount > 0 ? fmt(Math.max(...rows.map((r) => r.total))) : "—"}</td>
                    <td>{gradedCount > 0 ? fmt(Math.min(...rows.map((r) => r.total))) : "—"}</td>
                    <td>{gradedCount > 0 ? `${((passCount / gradedCount) * 100).toFixed(0)}%` : "—"}</td>
                  </tr>
                </tfoot>
              </table>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                {[
                  ["عدد الطلاب", String(students.length)],
                  ["تم رصدهم", String(gradedCount)],
                  ["الناجحون", `${passCount} (${gradedCount ? Math.round((passCount / gradedCount) * 100) : 0}%)`],
                  ["المتوسط العام", `${classAvg.toFixed(1)}%`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-[#dfe3da] bg-[#fbfbf8] p-3">
                    <div className="text-xl font-black text-[#0a4630]">{v}</div>
                    <div className="text-[0.6rem] font-bold text-[#7a857d]">{k}</div>
                  </div>
                ))}
              </div>
              <SignatureRow teacher={teacher} />
            </div>
          )}

          {tab === "sem1" && (
            <div className={`print-sheet ${orientation === "portrait" ? "portrait" : ""}`}>
              <SheetHeader teacher={teacher} subjectName={subject?.name ?? ""} classLabel={classLabel} today={today}
                docTitle="كشف ملخص الفصل الدراسي الأول" axisLabel="الفصل الدراسي الأول" />
              <table className="sheet-table">
                <colgroup>
                  <col style={{ width: "4%" }} />
                  {!hideNid && <col style={{ width: "13%" }} />}
                  <col style={{ width: hideNid ? "34%" : "26%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: hideNid ? "9%" : "8%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th rowSpan={2}>م</th>
                    {!hideNid && <th rowSpan={2}>رقم السجل<br />المدني</th>}
                    <th rowSpan={2}>اسم الطالب</th>
                    <th colSpan={4}>الفصل الدراسي الأول</th>
                    <th rowSpan={2}>النسبة</th>
                    <th rowSpan={2}>التقدير</th>
                  </tr>
                  <tr>
                    <th>الفترة الأولى<br /><span style={{ fontWeight: 600, fontSize: "0.58rem" }}>({fmt(yearPeriodMax)})</span></th>
                    <th>الفترة الثانية<br /><span style={{ fontWeight: 600, fontSize: "0.58rem" }}>({fmt(yearPeriodMax)})</span></th>
                    <th>مجموع الفصل الأول<br /><span style={{ fontWeight: 600, fontSize: "0.58rem" }}>({fmt(yearPeriodMax * 2)})</span></th>
                    <th>متوسط الفترتين<br /><span style={{ fontWeight: 600, fontSize: "0.58rem" }}>({fmt(yearPeriodMax)})</span></th>
                  </tr>
                </thead>
                <tbody>
                  {sem1Rows.map((r, i) => {
                    const b = band(r.semPct);
                    const failing = r.sem1 > 0 && r.semAvg < passScore;
                    return (
                      <tr key={r.s.id} style={failing ? { background: "#fdf1f1" } : undefined}>
                        <td>{i + 1}</td>
                        {!hideNid && <td dir="ltr" className="nid">{r.s.national_id || "—"}</td>}
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{r.s.full_name}</td>
                        <td>{r.s1p1 > 0 ? fmt(r.s1p1) : ""}</td>
                        <td>{r.s1p2 > 0 ? fmt(r.s1p2) : ""}</td>
                        <td style={{ fontWeight: 800, background: "#f6f8f3" }}>{r.sem1 > 0 ? fmt(r.sem1) : ""}</td>
                        <td style={{ fontWeight: 800, background: "#f6f8f3", color: "#0e5c3a" }}>{r.sem1 > 0 ? fmt(r.semAvg) : ""}</td>
                        <td style={{ background: "#f6f8f3" }}>{r.sem1 > 0 ? `${r.semPct.toFixed(1)}%` : ""}</td>
                        <td style={{ fontWeight: 800, background: "#f6f8f3" }}>{r.sem1 > 0 ? b.label : ""}</td>
                      </tr>
                    );
                  })}
                  {sem1Rows.length === 0 && (
                    <tr><td colSpan={hideNid ? 8 : 9} style={{ padding: "1.5rem" }}>لا توجد بيانات رصد للفصل الدراسي الأول بعد</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#eef3ee", fontWeight: 800 }}>
                    <td colSpan={hideNid ? 2 : 3}>المتوسط / عدد الناجحين</td>
                    <td>{sem1Rows.length ? (sem1Rows.reduce((a, r) => a + r.s1p1, 0) / sem1Rows.length).toFixed(1) : "—"}</td>
                    <td>{sem1Rows.length ? (sem1Rows.reduce((a, r) => a + r.s1p2, 0) / sem1Rows.length).toFixed(1) : "—"}</td>
                    <td>{sem1Rows.length ? (sem1Rows.reduce((a, r) => a + r.sem1, 0) / sem1Rows.length).toFixed(1) : "—"}</td>
                    <td>{sem1Rows.length ? (sem1Rows.reduce((a, r) => a + r.semAvg, 0) / sem1Rows.length).toFixed(1) : "—"}</td>
                    <td>{sem1Rows.length ? `${sem1ClassAvg.toFixed(1)}%` : "—"}</td>
                    <td>{sem1Graded > 0 ? `${sem1Passing} / ${sem1Graded}` : "—"}</td>
                  </tr>
                </tfoot>
              </table>
              <p style={{ marginTop: "0.5rem", fontSize: "0.62rem", fontWeight: 600, color: "#555" }}>
                * درجة كل فترة من {fmt(yearPeriodMax)} · مجموع الفصل الدراسي الأول من {fmt(yearPeriodMax * 2)} · متوسط الفترتين من {fmt(yearPeriodMax)} · التقدير حسب المتوسط ({passScore} درجة للنجاح).
              </p>
              <SignatureRow teacher={teacher} />
            </div>
          )}

          {tab === "year" && (
            <div className={`print-sheet ${orientation === "portrait" ? "portrait" : ""}`}>
              <SheetHeader teacher={teacher} subjectName={subject?.name ?? ""} classLabel={classLabel} today={today}
                docTitle="كشف العام — مجموع الفصلين والمتوسط" axisLabel={teacher?.semester ?? "الفصل الدراسي"} />
              <table className="sheet-table" style={{ fontSize: "0.56rem" }}>
                <colgroup>
                  <col style={{ width: "3.5%" }} />
                  {!hideNid && <col style={{ width: "10%" }} />}
                  <col style={{ width: hideNid ? "22%" : "18%" }} />
                  {Array.from({ length: 13 }).map((_, i) => (
                    <col key={i} style={{ width: hideNid ? "5.5%" : "5.2%" }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th rowSpan={2}>م</th>
                    {!hideNid && <th rowSpan={2}>رقم السجل المدني</th>}
                    <th rowSpan={2}>اسم الطالب</th>
                    <th colSpan={4}>الفصل الدراسي الأول</th>
                    <th colSpan={4}>الفصل الدراسي الثاني</th>
                    <th colSpan={5}>محصلة العام</th>
                  </tr>
                  <tr>
                    <th>الفترة الأولى<br />({fmt(yearPeriodMax)})</th>
                    <th>الفترة الثانية<br />({fmt(yearPeriodMax)})</th>
                    <th>مجموع الفترتين<br />({fmt(yearPeriodMax * 2)})</th>
                    <th>متوسط الفترتين<br />({fmt(yearPeriodMax)})</th>
                    <th>الفترة الأولى<br />({fmt(yearPeriodMax)})</th>
                    <th>الفترة الثانية<br />({fmt(yearPeriodMax)})</th>
                    <th>مجموع الفترتين<br />({fmt(yearPeriodMax * 2)})</th>
                    <th>متوسط الفترتين<br />({fmt(yearPeriodMax)})</th>
                    <th>مجموع الفصلين<br />({fmt(yearPeriodMax * 4)})</th>
                    <th>متوسط الفصلين<br />({fmt(yearPeriodMax * 2)})</th>
                    <th>المتوسط العام<br />({fmt(yearPeriodMax)})</th>
                    <th>النسبة</th>
                    <th>التقدير</th>
                  </tr>
                </thead>
                <tbody>
                  {yearRows.map((r, i) => {
                    const b = band(r.percent);
                    const failing = r.yearTotal > 0 && r.avg < passScore;
                    const sem1Avg = r.sem1 / 2;
                    const sem2Avg = r.sem2 / 2;
                    const yearAvgSem = r.yearTotal / 2;
                    return (
                      <tr key={r.s.id} style={failing ? { background: "#fdf1f1" } : undefined}>
                        <td>{i + 1}</td>
                        {!hideNid && <td dir="ltr" className="nid">{r.s.national_id || "—"}</td>}
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{r.s.full_name}</td>
                        <td>{r.s1p1 > 0 ? fmt(r.s1p1) : ""}</td>
                        <td>{r.s1p2 > 0 ? fmt(r.s1p2) : ""}</td>
                        <td style={{ fontWeight: 700 }}>{r.sem1 > 0 ? fmt(r.sem1) : ""}</td>
                        <td style={{ color: "#0e5c3a", fontWeight: 700 }}>{r.sem1 > 0 ? fmt(sem1Avg) : ""}</td>
                        <td>{r.s2p1 > 0 ? fmt(r.s2p1) : ""}</td>
                        <td>{r.s2p2 > 0 ? fmt(r.s2p2) : ""}</td>
                        <td style={{ fontWeight: 700 }}>{r.sem2 > 0 ? fmt(r.sem2) : ""}</td>
                        <td style={{ color: "#0e5c3a", fontWeight: 700 }}>{r.sem2 > 0 ? fmt(sem2Avg) : ""}</td>
                        <td style={{ fontWeight: 800, background: "#f6f8f3" }}>{r.yearTotal > 0 ? fmt(r.yearTotal) : ""}</td>
                        <td style={{ fontWeight: 800, background: "#f6f8f3", color: "#0e5c3a" }}>{r.yearTotal > 0 ? fmt(yearAvgSem) : ""}</td>
                        <td style={{ fontWeight: 800, background: "#f6f8f3" }}>{r.yearTotal > 0 ? fmt(r.avg) : ""}</td>
                        <td style={{ background: "#f6f8f3" }}>{r.yearTotal > 0 ? `${r.percent.toFixed(1)}%` : ""}</td>
                        <td style={{ fontWeight: 800, background: "#f6f8f3" }}>{r.yearTotal > 0 ? b.label : ""}</td>
                      </tr>
                    );
                  })}
                  {yearRows.length === 0 && (
                    <tr><td colSpan={hideNid ? 15 : 16} style={{ padding: "1.5rem" }}>لا توجد بيانات رصد لهذه المادة بعد</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#eef3ee", fontWeight: 800 }}>
                    <td colSpan={hideNid ? 2 : 3}>المتوسط / عدد الناجحين</td>
                    <td>{yearRows.length ? (yearRows.reduce((a, r) => a + r.s1p1, 0) / yearRows.length).toFixed(1) : "—"}</td>
                    <td>{yearRows.length ? (yearRows.reduce((a, r) => a + r.s1p2, 0) / yearRows.length).toFixed(1) : "—"}</td>
                    <td>{yearRows.length ? (yearRows.reduce((a, r) => a + r.sem1, 0) / yearRows.length).toFixed(1) : "—"}</td>
                    <td>{yearRows.length ? (yearRows.reduce((a, r) => a + r.sem1 / 2, 0) / yearRows.length).toFixed(1) : "—"}</td>
                    <td>{yearRows.length ? (yearRows.reduce((a, r) => a + r.s2p1, 0) / yearRows.length).toFixed(1) : "—"}</td>
                    <td>{yearRows.length ? (yearRows.reduce((a, r) => a + r.s2p2, 0) / yearRows.length).toFixed(1) : "—"}</td>
                    <td>{yearRows.length ? (yearRows.reduce((a, r) => a + r.sem2, 0) / yearRows.length).toFixed(1) : "—"}</td>
                    <td>{yearRows.length ? (yearRows.reduce((a, r) => a + r.sem2 / 2, 0) / yearRows.length).toFixed(1) : "—"}</td>
                    <td>{yearRows.length ? (yearRows.reduce((a, r) => a + r.yearTotal, 0) / yearRows.length).toFixed(1) : "—"}</td>
                    <td>{yearRows.length ? (yearRows.reduce((a, r) => a + r.yearTotal / 2, 0) / yearRows.length).toFixed(1) : "—"}</td>
                    <td>{yearRows.length ? (yearRows.reduce((a, r) => a + r.avg, 0) / yearRows.length).toFixed(1) : "—"}</td>
                    <td>{yearRows.length ? `${yearAvg.toFixed(1)}%` : "—"}</td>
                    <td>{gradedYear > 0 ? `${passingYear} / ${gradedYear}` : "—"}</td>
                  </tr>
                </tfoot>
              </table>
              <p style={{ marginTop: "0.5rem", fontSize: "0.62rem", fontWeight: 600, color: "#555" }}>
                * درجة كل فترة من {fmt(yearPeriodMax)} · مجموع الفترتين (الفصل) من {fmt(yearPeriodMax * 2)} · متوسط الفترتين من {fmt(yearPeriodMax)} · مجموع الفصلين من {fmt(yearPeriodMax * 4)} · متوسط الفصلين من {fmt(yearPeriodMax * 2)} · المتوسط العام من {fmt(yearPeriodMax)} · التقدير حسب المتوسط العام ({passScore} درجة للنجاح).
              </p>
              <SignatureRow teacher={teacher} />
            </div>
          )}
        </div>
      )}

      {/* زر تحميل عائم للجوال */}
      <button onClick={exportNoor} disabled={exporting}
        className="no-print fixed bottom-5 left-5 z-40 grid h-14 w-14 place-items-center rounded-2xl bg-[#0a4630] text-[#e7cf9a] shadow-2xl transition hover:scale-105 lg:hidden"
        aria-label="تصدير نور">
        {exporting ? <Loader2 size={22} className="animate-spin" /> : <Download size={22} />}
      </button>
    </div>
  );
}

/** ترويسة وزارة التعليم المشتركة — بشعار وزارة التعليم الرسمي */
function SheetHeader({ teacher, subjectName, classLabel, today, docTitle, axisLabel }: {
  teacher: TeacherInfo | null; subjectName: string; classLabel: string; today: string; docTitle: string; axisLabel: string;
}) {
  return (
    <>
      <div className="ministry-head">
        <div className="col" style={{ textAlign: "right", flex: 1 }}>
          <strong style={{ fontSize: "0.84rem" }}>المملكة العربية السعودية</strong><br />
          <strong style={{ fontSize: "0.84rem" }}>وزارة التعليم</strong><br />
          <strong style={{ fontSize: "0.74rem", display: "inline-block", marginTop: 2 }}>{teacher?.education_admin}</strong><br />
          <span style={{ fontSize: "0.68rem", fontWeight: 700 }}>{teacher?.education_office}</span><br />
          <strong style={{ fontSize: "0.85rem", color: "#0a4630", display: "inline-block", marginTop: 4, borderTop: "1.5px solid #c9a24b", paddingTop: 3 }}>{teacher?.school_name}</strong>
        </div>
        <div className="col" style={{ flexShrink: 0 }}>
          {/* شعار وزارة التعليم الرسمي */}
          <img src="/images/moe-logo.svg" alt="شعار وزارة التعليم" width={132} height={68}
            style={{ objectFit: "contain", display: "block", margin: "0 auto" }} />
        </div>
        <div className="col" style={{ textAlign: "left", flex: 1 }}>
          <strong style={{ fontSize: "0.85rem" }}>العام الدراسي {teacher?.academic_year}</strong><br />
          <span style={{ fontSize: "0.68rem" }}>{teacher?.city}</span><br />
          <span style={{ fontSize: "0.68rem" }}>تاريخ الإصدار: {today}</span>
        </div>
      </div>
      <div className="doc-title">
        {docTitle}
        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#333", marginTop: 2 }}>
          {classLabel} · المادة: {subjectName} · {axisLabel} · المعلم: {teacher?.full_name} ({teacher?.job_title})
        </div>
      </div>
    </>
  );
}

/** صف التوقيعات — معلم المادة ومدير المدرسة فقط */
function SignatureRow({ teacher }: { teacher: TeacherInfo | null }) {
  return (
    <div className="sign-row">
      <div className="sign-box">
        <div style={{ fontWeight: 800, fontSize: "0.72rem" }}>معلم المادة</div>
        <div className="sign-line" />
        <div style={{ fontSize: "0.72rem" }}>{teacher?.full_name}</div>
      </div>
      <div className="sign-box">
        <div style={{ fontWeight: 800, fontSize: "0.72rem" }}>مدير المدرسة</div>
        <div className="sign-line" />
        <div style={{ fontSize: "0.72rem" }}>{teacher?.principal_name}</div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="shimmer h-96 rounded-3xl" />}>
      <ReportsInner />
    </Suspense>
  );
}
