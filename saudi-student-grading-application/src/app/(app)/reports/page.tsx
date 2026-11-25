"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import {
  FileText, Printer, FileSpreadsheet, Loader2, Table2, UserRound,
  BarChart3, AlertCircle, Download, CalendarRange, Sigma, RectangleHorizontal, RectangleVertical, Medal, Info, Columns3, MessageCircle, Smartphone, ClipboardList, TrendingUp, TrendingDown, Target, Users, BookOpen, Home, Wrench,
} from "lucide-react";
import { toast } from "@/components/AppShell";
import { buildWaMessage, openWhatsApp, waLink, channelLink, renderTemplate, WA_DEFAULT_TEMPLATE, WA_PLACEHOLDERS, type WaChannel } from "@/lib/whatsapp";

type ClassItem = { id: number; name: string; grade_label: string; stage: string };
type SubjectItem = { id: number; name: string; color: string; is_active: boolean; class_ids?: number[] };
type Component = { id: number; name: string; category: string; max_score: number; weight_label: string; is_active: boolean };
type StudentRow = { id: number; full_name: string; national_id: string; guardian_phone?: string };
type SubjectInfo = { id: number; name: string; max_total: string | number; pass_score: string | number; color: string };
type TeacherInfo = {
  full_name: string; school_name: string; education_admin: string; education_office: string;
  city: string; principal_name: string; academic_year: string; semester: string; job_title: string;
  band_excellent_min?: number; band_very_good_min?: number; band_good_min?: number; band_pass_min?: number;
  teacher_sig?: string | null; principal_sig?: string | null;
};
type BandMins = { excellent: number; veryGood: number; good: number; pass: number };
const DEFAULT_BANDS: BandMins = { excellent: 90, veryGood: 80, good: 70, pass: 60 };
type YearRow = {
  s: StudentRow; s1p1: number; s1p2: number; s2p1: number; s2p2: number;
  sem1: number; sem2: number; yearTotal: number; avg: number; percent: number;
  semMax: number; yearMax: number;
};
type TabKey = "sheet" | "notices" | "analysis" | "year" | "sem1" | "wa" | "mastery";

const SEMESTERS: Record<string, string> = { "1": "الفصل الدراسي الأول", "2": "الفصل الدراسي الثاني" };
const PERIODS: Record<string, string> = { "1": "الفترة الأولى", "2": "الفترة الثانية" };

function band(pct: number, mins: BandMins = DEFAULT_BANDS) {
  if (pct >= mins.excellent) return { label: "ممتاز", comment: "أداء متميز — نرجو المحافظة على التفوق", color: "#047857", bg: "#d1fae5", text: "#065f46" };
  if (pct >= mins.veryGood) return { label: "جيد جداً", comment: "أداء مميز — بخطوات قليلة يصل للامتياز", color: "#0f766e", bg: "#ccfbf1", text: "#115e59" };
  if (pct >= mins.good) return { label: "جيد", comment: "مستوى جيد — يحتاج مزيداً من التركيز في المذاكرة", color: "#1d4ed8", bg: "#dbeafe", text: "#1e40af" };
  if (pct >= mins.pass) return { label: "مقبول", comment: "مقبول — يُنصح بمراجعة الدروس أولاً بأول", color: "#b45309", bg: "#fef3c7", text: "#92400e" };
  return { label: "ضعيف", comment: "يحتاج خطة علاجية ومتابعة منزلية عاجلة", color: "#b91c1c", bg: "#fee2e2", text: "#991b1b" };
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
  const [hidePct, setHidePct] = useState(false);
  const [hideBand, setHideBand] = useState(false);
  const [hideSig, setHideSig] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [subject, setSubject] = useState<SubjectInfo | null>(null);
  const [grades, setGrades] = useState<Record<number, Record<number, number | null>>>({});
  const [yearRows, setYearRows] = useState<YearRow[]>([]);
  const [yearPeriodMax, setYearPeriodMax] = useState(100);
  const [teacher, setTeacher] = useState<TeacherInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [anScope, setAnScope] = useState<"period" | "semester" | "year">("period");
  const [maScope, setMaScope] = useState<"period" | "semester">("period");
  const [mastery, setMastery] = useState<any>(null);
  // ===== الإرسال الجماعي عبر واتساب =====
  const [waTemplate, setWaTemplate] = useState<string>(() => {
    try { return localStorage.getItem("rased-wa-template") || ""; } catch { return ""; }
  });
  const [waSelected, setWaSelected] = useState<Set<number>>(new Set());
  const [waQueue, setWaQueue] = useState<Array<{ name: string; link: string }>>([]);
  const [waQi, setWaQi] = useState(0);
  const [waChannel, setWaChannel] = useState<WaChannel>("wa");

  // المواد الظاهرة = المرتبطة بهذا الفصل تحديداً
  const linkedSubjects = useMemo(
    () => subjects.filter((s) => !classId || (s.class_ids ?? []).map(Number).includes(Number(classId))),
    [subjects, classId]
  );

  // إرسال نتيجة الطالب لولي الأمر عبر واتساب
  const sendWa = (s: StudentRow, r: { perf: number; perfFilled: number; written: number; writtenFilled: number; total: number; filled: number; pct: number; bandLabel: string }) => {
    const ok = openWhatsApp(s.guardian_phone ?? "", buildWaMessage({
      studentName: s.full_name,
      subject: subject?.name ?? "",
      classLabel: classLabel,
      axisLabel,
      perf: r.perfFilled > 0 ? r.perf : null,
      perfMax,
      written: r.writtenFilled > 0 ? r.written : null,
      writtenMax,
      total: r.filled > 0 ? r.total : null,
      totalMax: maxTotal,
      pct: r.filled > 0 ? r.pct : null,
      bandLabel: r.filled > 0 ? r.bandLabel : "—",
      school: teacher?.school_name ?? "",
      teacherName: teacher?.full_name ?? "",
    }));
    if (!ok) toast("لا يوجد رقم جوال مسجّل لولي أمر هذا الطالب", "error");
  };

  // عتبات التقدير المخصصة للمعلم (من الإعدادات)
  const bands: BandMins = teacher
    ? {
        excellent: Number(teacher.band_excellent_min ?? 90),
        veryGood: Number(teacher.band_very_good_min ?? 80),
        good: Number(teacher.band_good_min ?? 70),
        pass: Number(teacher.band_pass_min ?? 60),
      }
    : DEFAULT_BANDS;

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

  // بيانات التحليل الشامل (لكل مادة وفصل)
  useEffect(() => {
    if (!subjectId || tab !== "analysis") { setAnalysis(null); return; }
    fetch(`/api/analysis?subjectId=${subjectId}&semester=${semester}&period=${period}&scope=${anScope}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setAnalysis(d); })
      .catch(() => setAnalysis(null));
  }, [subjectId, tab, semester, period, anScope]);

  // بيانات تحليل الإتقان والإجراءات التربوية
  useEffect(() => {
    if (!subjectId || !classId || tab !== "mastery") { setMastery(null); return; }
    fetch(`/api/mastery?subjectId=${subjectId}&classId=${classId}&semester=${semester}&period=${period}&scope=${maScope}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setMastery(d); })
      .catch(() => setMastery(null));
  }, [subjectId, classId, semester, period, tab, maScope]);

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
    return { s, perComp, total, filled, pct, band: band(pct, bands) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [students, components, grades, maxTotal, teacher]);

  // مجاميع المجموعات لكل طالب (للطباعة: الإجماليات فقط دون البنود)
  const perfMax = components.filter((c) => c.category === "performance").reduce((a, c) => a + Number(c.max_score), 0);
  const writtenMax = components.filter((c) => c.category === "written" || c.category === "written_oral").reduce((a, c) => a + Number(c.max_score), 0);
  const hasWrittenOral = components.some((c) => c.category === "written_oral");
  const writtenColLabel = hasWrittenOral ? "التقويمات التحريرية والشفوية" : "التقويمات التحريرية";
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

  // ===== أدوات الإرسال الجماعي عبر واتساب =====
  const waTemplateEffective = waTemplate.trim() ? waTemplate : WA_DEFAULT_TEMPLATE;
  const waRowData = (r: (typeof grouped)[number]) => ({
    student: r.s.full_name,
    subject: subject?.name ?? "",
    class: classLabel,
    axis: axisLabel,
    perf: r.perfFilled > 0 ? `${fmt(r.perf)} من ${perfMax}` : "لم تُرصد بعد",
    written: r.writtenFilled > 0 ? `${fmt(r.written)} من ${writtenMax}` : "لم تُرصد بعد",
    total: r.filled > 0 ? fmt(r.total) : "—",
    max: fmt(maxTotal),
    pct: r.filled > 0 ? `${r.pct.toFixed(1)}%` : "—",
    band: r.filled > 0 ? r.band.label : "—",
    school: teacher?.school_name ?? "",
    teacher: teacher?.full_name ?? "",
  });
  const waEligible = useMemo(
    () => grouped.filter((r) => (r.s.guardian_phone ?? "").replace(/\D/g, "").length >= 9),
    [grouped]
  );
  const waMissing = grouped.length - waEligible.length;

  useEffect(() => {
    if (tab !== "wa") return;
    setWaSelected((prev) => (prev.size > 0 ? prev : new Set(waEligible.map((r) => r.s.id))));
  }, [tab, waEligible]);

  const saveWaTemplate = (v: string) => {
    setWaTemplate(v);
    try { localStorage.setItem("rased-wa-template", v); } catch { /* ignore */ }
  };

  const startWaQueue = () => {
    const msg = (r: (typeof grouped)[number]) => renderTemplate(waTemplateEffective, waRowData(r));
    const items = waEligible
      .filter((r) => waSelected.has(r.s.id))
      .map((r) => ({ name: r.s.full_name, link: channelLink(waChannel, r.s.guardian_phone ?? "", msg(r)) }))
      .filter((x): x is { name: string; link: string } => Boolean(x.link));
    if (items.length === 0) { toast("لا يوجد طلاب منتخبون برقم جوال", "error"); return; }
    if (waChannel === "sms") toast("ملاحظة: إرسال الرسائل النصية يعمل من الجوال (يفتح تطبيق الرسائل)");
    setWaQueue(items);
    setWaQi(0);
    window.open(items[0].link, "_blank", "noopener,noreferrer");
    toast(`بدأ الإرسال — ${items.length} رسالة (افتُتحت الأولى)`);
  };
  const waNext = () => {
    const next = waQi + 1;
    if (next >= waQueue.length) { setWaQueue([]); setWaQi(0); toast("اكتمل الإرسال للكل"); return; }
    setWaQi(next);
    window.open(waQueue[next].link, "_blank", "noopener,noreferrer");
  };
  const waStop = () => { setWaQueue([]); setWaQi(0); };

  // ===== الإجراءات التربوية وتغذية راجعة الأسرة =====
  const remedialAction = (st: any) => {
    const base = st.levelKey === "support"
      ? "خطة علاجية عاجلة: إعادة تدريس المهارات التأسيسية عبر أنشطة مبسطة وأوراق عمل مركّزة، ومتابعة فردية أو في مجموعات صغيرة."
      : "خطة متابعة: مراجعة المهارات غير المتقنة بتدريبات مركّزة، ومتابعة فردية أو في مجموعات صغيرة.";
    return st.weak?.length ? `${base} التركيز على: ${st.weak.join("، ")}.` : base;
  };
  const enrichAction = (st: any) =>
    st.levelKey === "excellent"
      ? "خطة إثرائية: مهام ومشاريع تفكير أعلى، وإعداده ليكون مرشداً أقرانياً لدعم زميل متعثر."
      : "إثراء: أنشطة تمديدية وأسئلة محفّزة تنمّي قدراته وتحافظ على دافعيته.";
  const teachingAction = (bx: any) =>
    `المهارة «${bx.name}» أظهرت تعثراً جماعياً (إتقان ${bx.mastery}%، اجتياز ${bx.pass50}%). الإجراء: مراجعة طريقة الشرح، وتنويع أدوات التقويم التكويني، وإعادة تدريس المهارة عبر نشاط موجّه.`;
  const familyMessage = (st: any) => [
    `أهلاً، ولي أمر الطالب/ة ${st.name}`,
    `${teacher?.school_name ?? ""}`,
    `المادة: ${subject?.name ?? ""} — ${classLabel}`,
    `الفترة: ${axisLabel}`,
    "--------------------------",
    `مستوى الأداء: ${st.levelLabel}`,
    `الدرجة: ${st.total} من ${maxTotal} (${st.pct}%)`,
    st.strong?.length ? `نقاط القوة: ${st.strong.join("، ")}` : "",
    st.weak?.length ? `ما يحتاج تركيزاً في المنزل: ${st.weak.join("، ")}` : "",
    st.levelKey === "support" || st.levelKey === "follow" ? `التوصية: ${remedialAction(st)}` : `التوصية: ${enrichAction(st)}`,
    "--------------------------",
    `مع خالص التحية — ${teacher?.full_name ?? ""}`,
  ].filter(Boolean).join("\n");
  const sendFamily = (st: any) => {
    const link = channelLink(waChannel, st.guardianPhone ?? "", familyMessage(st));
    if (!link) { toast("لا يوجد رقم جوال مسجّل لولي أمر هذا الطالب", "error"); return; }
    window.open(link, "_blank", "noopener,noreferrer");
    toast("فُتحت الرسالة في واتساب — راجعها وأرسلها");
  };

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
    { key: "analysis", label: "تحليل النتائج", icon: BarChart3 },
    { key: "mastery", label: "تحليل الإتقان والإجراءات", icon: ClipboardList },
    { key: "sem1", label: "ملخص الفصل الأول", icon: Medal },
    { key: "year", label: "نهاية العام", icon: Sigma },
    { key: "wa", label: "إرسال واتساب جماعي", icon: MessageCircle },
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
            {/* اختيار أعمدة الطباعة */}
            <div className="flex items-center gap-1.5 rounded-xl border border-[#e3e4dd] bg-white px-3 py-1.5">
              <span className="flex items-center gap-1 text-[0.68rem] font-black text-[#0a4630]"><Columns3 size={14} /> أعمدة الطباعة</span>
              {[
                { label: "السجل", checked: !hideNid, set: setHideNid },
                { label: "النسبة", checked: !hidePct, set: setHidePct },
                { label: "التقدير", checked: !hideBand, set: setHideBand },
                { label: "التوقيع", checked: !hideSig, set: setHideSig },
              ].map((c) => (
                <label key={c.label} className="flex cursor-pointer select-none items-center gap-1 rounded-lg bg-[#f4f5f0] px-2 py-1 text-[0.66rem] font-extrabold text-[#3c4f44]">
                  <input type="checkbox" className="accent-[#0e5c3a]" checked={c.checked} onChange={(e) => c.set(!e.target.checked)} />
                  {c.label}
                </label>
              ))}
            </div>
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
                  {!hideNid && <col style={{ width: "11%" }} />}
                  <col style={{ width: "17%" }} />
                  <col style={{ width: "12.5%" }} />
                  <col style={{ width: "12.5%" }} />
                  <col style={{ width: "9%" }} />
                  {!hidePct && <col style={{ width: "7%" }} />}
                  {!hideBand && <col style={{ width: "8%" }} />}
                  {!hideSig && <col style={{ width: "12%" }} />}
                  <col className="no-print-col" style={{ width: "4%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th rowSpan={2}>م</th>
                    {!hideNid && <th rowSpan={2}>رقم السجل<br />المدني</th>}
                    <th rowSpan={2}>اسم الطالب</th>
                    <th colSpan={2}>توزيع الدرجات (الإجماليات)</th>
                    <th rowSpan={2} className="grp-sum">المجموع<br />{fmt(maxTotal)}</th>
                    {!hidePct && <th rowSpan={2}>النسبة</th>}
                    {!hideBand && <th rowSpan={2}>التقدير</th>}
                    {!hideSig && <th rowSpan={2}>توقيع ولي<br />الأمر</th>}
                    <th rowSpan={2} className="no-print" style={{ background: "#eef1ec", color: "#0e5c3a", width: "4%" }}>واتساب</th>
                  </tr>
                  <tr>
                    <th className="grp-perf">المهام الأدائية<br /><span style={{ fontWeight: 600, fontSize: "0.6rem", color: "#ccfbf1" }}>من {fmt(perfMax)}</span></th>
                    <th className="grp-written">{writtenColLabel}<br /><span style={{ fontWeight: 600, fontSize: "0.6rem", color: "#e0e7ff" }}>من {fmt(writtenMax)}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map((r, i) => (
                    <tr key={r.s.id} style={r.filled > 0 && r.total < passScore ? { background: "#fdecec" } : undefined}>
                      <td>{i + 1}</td>
                      {!hideNid && <td dir="ltr" className="nid">{r.s.national_id || "—"}</td>}
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{r.s.full_name}</td>
                      <td style={{ fontWeight: 700, color: "#0b5449" }}>{r.perfFilled > 0 ? fmt(r.perf) : ""}</td>
                      <td style={{ fontWeight: 700, color: "#2a2580" }}>{r.writtenFilled > 0 ? fmt(r.written) : ""}</td>
                      <td style={{ fontWeight: 800, color: "#0a4630" }}>{r.filled > 0 ? fmt(r.total) : ""}</td>
                      {!hidePct && <td>{r.filled > 0 ? `${r.pct.toFixed(1)}%` : ""}</td>}
                      {!hideBand && <td>{r.filled > 0 ? (
                        <span className="band-chip" style={{ background: r.band.bg, color: r.band.text }}>{r.band.label}</span>
                      ) : ""}</td>}
                      {!hideSig && <td style={{ minWidth: 60 }}></td>}
                      <td className="no-print" style={{ background: "#fbfdfb" }}>
                        <button
                          onClick={() => sendWa(r.s, { perf: r.perf, perfFilled: r.perfFilled, written: r.written, writtenFilled: r.writtenFilled, total: r.total, filled: r.filled, pct: r.pct, bandLabel: r.band.label })}
                          title={`إرسال النتيجة لولي أمر ${r.s.full_name} عبر واتساب`}
                          className="mx-auto grid h-8 w-8 place-items-center rounded-lg bg-[#25d366]/15 text-[#128c4b] transition hover:bg-[#25d366] hover:text-white"
                        >
                          <MessageCircle size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2 + (hideNid ? 0 : 1)}>المتوسط العام للفصل / عدد الناجحين</td>
                    <td style={{ color: "#0b5449" }}>{grouped.some((r) => r.perfFilled > 0) ? groupedStats.perfAvg.toFixed(1) : "—"}</td>
                    <td style={{ color: "#2a2580" }}>{grouped.some((r) => r.writtenFilled > 0) ? groupedStats.writtenAvg.toFixed(1) : "—"}</td>
                    <td colSpan={1 + (hidePct ? 0 : 1) + (hideBand ? 0 : 1) + (hideSig ? 0 : 1)}>
                      <span style={{ marginInlineEnd: "0.9em" }}>{gradedCount > 0 ? `${classAvg.toFixed(1)}%` : "—"}</span>
                      <span style={{ opacity: 0.85 }}>{gradedCount > 0 ? `${passCount} / ${gradedCount} ناجح` : "—"}</span>
                    </td>
                    <td className="no-print"></td>
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
                        <th className="grp-perf">المهام الأدائية<br /><span style={{ fontWeight: 600, fontSize: "0.6rem", color: "#ccfbf1" }}>من {fmt(perfMax)}</span></th>
                        <th className="grp-written">{writtenColLabel}<br /><span style={{ fontWeight: 600, fontSize: "0.6rem", color: "#e0e7ff" }}>من {fmt(writtenMax)}</span></th>
                        <th className="grp-sum">المجموع<br />{fmt(maxTotal)}</th>
                        <th>النسبة</th><th>التقدير</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 800, fontSize: "1rem", color: "#0b5449" }}>{r.perfFilled > 0 ? fmt(r.perf) : "—"}</td>
                        <td style={{ fontWeight: 800, fontSize: "1rem", color: "#2a2580" }}>{r.writtenFilled > 0 ? fmt(r.written) : "—"}</td>
                        <td style={{ fontWeight: 800, fontSize: "1rem", color: "#0a4630" }}>{r.filled > 0 ? fmt(r.total) : "—"}</td>
                        <td style={{ fontSize: "1rem" }}>{r.filled > 0 ? `${r.pct.toFixed(1)}%` : "—"}</td>
                        <td>{r.filled > 0 ? (
                          <span className="band-chip" style={{ background: r.band.bg, color: r.band.text, fontSize: "0.85rem" }}>{r.band.label}</span>
                        ) : "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="mt-3 rounded-xl border border-dashed border-[#c9a24b] bg-[#fffdf2] p-3 text-[0.78rem] font-bold text-[#6b5518]">
                    <span className="text-[#a8843a]">تعليق المعلم: </span>{r.filled > 0 ? r.band.comment : "لم تُرصد درجاته بعد"}
                  </div>
                  <div className="no-print mt-3">
                    <button
                      onClick={() => sendWa(r.s, { perf: r.perf, perfFilled: r.perfFilled, written: r.written, writtenFilled: r.writtenFilled, total: r.total, filled: r.filled, pct: r.pct, bandLabel: r.band.label })}
                      className="btn !bg-[#25d366] !text-white w-full justify-center"
                    >
                      <MessageCircle size={17} /> إرسال النتيجة لولي الأمر عبر واتساب
                    </button>
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
                docTitle={`تحليل نتائج مادة ${subject?.name ?? ""} — ${anScope === "year" ? "العام الدراسي" : anScope === "semester" ? "الفصل الدراسي" : "الفصل والفترة"}`}
                axisLabel={anScope === "year" ? "العام الدراسي كامل (الفصلان × الفترتان)" : anScope === "semester" ? `الفصل الدراسي ${semester} كامل (الفترتان)` : axisLabel} />
              {/* اختيار نطاق التحليل */}
              <div className="no-print mb-3 flex gap-1 rounded-xl bg-[#eef1ec] p-1 w-fit">
                {([
                  { k: "period", label: "تحليل الفترة الحالية" },
                  { k: "semester", label: "تحليل الفصل الدراسي" },
                  { k: "year", label: "تحليل العام الدراسي" },
                ] as const).map((o) => (
                  <button key={o.k} onClick={() => setAnScope(o.k)}
                    className={`rounded-lg px-3 py-1.5 text-[0.7rem] font-extrabold transition ${anScope === o.k ? "bg-white text-[#0a4630] shadow" : "text-[#5c6f65]"}`}>
                    {o.label}
                  </button>
                ))}
              </div>
              {(() => {
                const list: any[] = analysis?.classes ?? [];
                const cur = list.find((c) => c.classId === Number(classId)) ?? list[0];
                if (!analysis || !cur) {
                  return <p className="py-10 text-center text-[0.8rem] font-bold text-[#8a968d]">لا توجد بيانات تحليل لهذه المادة والنطاق.</p>;
                }
                const DIST = [
                  { key: "excellent", label: "ممتاز", color: "#047857", bg: "#d1fae5" },
                  { key: "veryGood", label: "جيد جداً", color: "#0f766e", bg: "#ccfbf1" },
                  { key: "good", label: "جيد", color: "#1d4ed8", bg: "#dbeafe" },
                  { key: "pass", label: "مقبول", color: "#b45309", bg: "#fef3c7" },
                  { key: "fail", label: "ضعيف", color: "#b91c1c", bg: "#fee2e2" },
                  { key: "incomplete", label: "غير مكتمل", color: "#9ca3af", bg: "#f3f4f6" },
                ];
                const totalDist = Math.max(1, Object.values(cur.dist).reduce((a: number, n: unknown) => a + (Number(n) || 0), 0));
                return (
                  <>
                    {/* مؤشرات الفصل المحدد */}
                    <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                      {[
                        ["عدد الطلاب", String(cur.studentCount), "#0a4630", "#eef3ee"],
                        ["اكتمل رصدهم", `${cur.completeCount}/${cur.studentCount}`, "#0b5449", "#ccfbf1"],
                        ["نسبة النجاح", `${cur.passRate}%`, "#047857", "#d1fae5"],
                        ["متوسط النسبة", `${cur.avgPct.toFixed(1)}%`, "#8a6a1f", "#f7efd9"],
                      ].map(([k, v, fg, bg]) => (
                        <div key={k as string} className="rounded-xl border border-[#dfe3da] p-2.5" style={{ background: bg as string }}>
                          <div className="text-lg font-black" style={{ color: fg as string }}>{v}</div>
                          <div className="text-[0.58rem] font-bold text-[#5c6f65]">{k}</div>
                        </div>
                      ))}
                    </div>

                    {/* توزيع التقديرات */}
                    <div className="mt-3">
                      <div className="mb-1.5 text-[0.72rem] font-black text-[#0a4630]">توزيع التقديرات — {cur.gradeLabel} · فصل {cur.className}</div>
                      <div className="flex w-full overflow-hidden rounded-lg" style={{ height: "16px" }}>
                        {DIST.map((d) => {
                          const w = (cur.dist[d.key] / totalDist) * 100;
                          return w > 0 ? <div key={d.key} style={{ width: `${w}%`, background: d.color }} title={`${d.label}: ${cur.dist[d.key]}`} /> : null;
                        })}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                        {DIST.map((d) => (
                          <span key={d.key} className="flex items-center gap-1 text-[0.6rem] font-bold text-[#3c4f44]">
                            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
                            {d.label}: {cur.dist[d.key]}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* تحليل الخانات */}
                    <div className="mt-3">
                      <div className="mb-1.5 text-[0.72rem] font-black text-[#0a4630]">تحليل الخانات (البند × البند)</div>
                      <table className="sheet-table">
                        <thead>
                          <tr><th style={{ textAlign: "right" }}>الخانة</th><th>النوع</th><th>العظمى</th><th>المتوسط</th><th>أعلى</th><th>أدنى</th><th>الإتقان ≥ 60%</th><th>الاجتياز ≥ 50%</th><th>الحالة</th></tr>
                        </thead>
                        <tbody>
                          {cur.components.map((c: any) => {
                            const m = c.mastery || 0;
                            const status = m >= 80 ? { t: "مُتقنة", bg: "#d1fae5", fg: "#065f46" } : m >= 60 ? { t: "تحتاج انتباهاً", bg: "#fef3c7", fg: "#92400e" } : { t: "فاقد تعليمي", bg: "#fee2e2", fg: "#991b1b" };
                            return (
                            <tr key={c.id}>
                              <td style={{ textAlign: "right", fontWeight: 700 }}>{c.name}</td>
                              <td><span className="band-chip" style={{
                                background: c.category === "performance" ? "#ccfbf1" : c.category === "written_oral" ? "#f5d0fe" : "#e0e7ff",
                                color: c.category === "performance" ? "#0f766e" : c.category === "written_oral" ? "#a21caf" : "#3730a3"
                              }}>{c.category === "performance" ? "أدائية" : c.category === "written_oral" ? "تحريري/شفوي" : "تحريرية"}</span></td>
                              <td>{fmt(c.max)}</td>
                              <td style={{ fontWeight: 800 }}>{c.filled ? c.avg.toFixed(1) : "—"}</td>
                              <td>{c.filled ? fmt(c.top) : "—"}</td>
                              <td>{c.filled ? fmt(c.low) : "—"}</td>
                              <td style={{ fontWeight: 800, color: m >= 60 ? "#0f766e" : "#b91c1c" }}>{c.filled ? `${m.toFixed(0)}%` : "—"}</td>
                              <td>{c.filled ? `${(c.pass50 || 0).toFixed(0)}%` : "—"}</td>
                              <td>{c.filled ? <span className="band-chip" style={{ background: status.bg, color: status.fg }}>{status.t}</span> : "—"}</td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* مقارنة الفصول في هذه المادة */}
                    {list.length > 1 && (
                      <div className="mt-3">
                        <div className="mb-1.5 text-[0.72rem] font-black text-[#0a4630]">مقارنة الفصول — مادة {subject?.name}</div>
                        <table className="sheet-table">
                          <thead>
                            <tr><th style={{ textAlign: "right" }}>الفصل</th><th>الطلاب</th><th>اكتمل</th><th>متوسط النسبة</th><th>نسبة النجاح</th><th>ممتاز</th><th>جيد جداً</th><th>جيد</th><th>مقبول</th><th>ضعيف</th><th>غير مكتمل</th></tr>
                          </thead>
                          <tbody>
                            {list.map((c) => (
                              <tr key={c.classId} style={c.classId === cur.classId ? { background: "#f6f8f3", fontWeight: 800 } : undefined}>
                                <td style={{ textAlign: "right", fontWeight: 700 }}>{c.gradeLabel} · {c.className}</td>
                                <td>{c.studentCount}</td>
                                <td>{c.completeCount}/{c.studentCount}</td>
                                <td>{c.completeCount > 0 ? `${c.avgPct.toFixed(1)}%` : "—"}</td>
                                <td>{c.completeCount > 0 ? `${c.passRate}%` : "—"}</td>
                                <td style={{ color: "#047857" }}>{c.dist.excellent}</td>
                                <td style={{ color: "#0f766e" }}>{c.dist.veryGood}</td>
                                <td style={{ color: "#1d4ed8" }}>{c.dist.good}</td>
                                <td style={{ color: "#b45309" }}>{c.dist.pass}</td>
                                <td style={{ color: "#b91c1c" }}>{c.dist.fail}</td>
                                <td style={{ color: "#9ca3af" }}>{c.dist.incomplete ?? 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                );
              })()}
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
                    <th colSpan={4} className="grp-perf">الفصل الدراسي الأول</th>
                    <th rowSpan={2} className="grp-sum">النسبة</th>
                    <th rowSpan={2} className="grp-sum">التقدير</th>
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
                    const b = band(r.semPct, bands);
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
                        <td style={{ background: "#f6f8f3" }}>{r.sem1 > 0 ? (
                          <span className="band-chip" style={{ background: b.bg, color: b.text }}>{b.label}</span>
                        ) : ""}</td>
                      </tr>
                    );
                  })}
                  {sem1Rows.length === 0 && (
                    <tr><td colSpan={hideNid ? 8 : 9} style={{ padding: "1.5rem" }}>لا توجد بيانات رصد للفصل الدراسي الأول بعد</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
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
                docTitle="تقرير نهاية العام الدراسي — مجموع الفصلين والمتوسط" axisLabel="العام الدراسي كامل" />
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
                    <th colSpan={4} className="grp-perf">الفصل الدراسي الأول</th>
                    <th colSpan={4} className="grp-written">الفصل الدراسي الثاني</th>
                    <th colSpan={5} className="grp-year">محصلة العام</th>
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
                    const b = band(r.percent, bands);
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
                        <td style={{ background: "#fbf7ea" }}>{r.yearTotal > 0 ? `${r.percent.toFixed(1)}%` : ""}</td>
                        <td style={{ background: "#fbf7ea" }}>{r.yearTotal > 0 ? (
                          <span className="band-chip" style={{ background: b.bg, color: b.text }}>{b.label}</span>
                        ) : ""}</td>
                      </tr>
                    );
                  })}
                  {yearRows.length === 0 && (
                    <tr><td colSpan={hideNid ? 15 : 16} style={{ padding: "1.5rem" }}>لا توجد بيانات رصد لهذه المادة بعد</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
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

          {/* ===== تحليل الإتقان والإجراءات التربوية ===== */}
          {tab === "mastery" && (
            <div className={`print-sheet ${orientation === "portrait" ? "portrait" : ""}`}>
              {!mastery ? (
                <div className="py-10"><div className="shimmer mx-auto h-64 max-w-3xl rounded-3xl" /></div>
              ) : (
                <>
                  <SheetHeader teacher={teacher} subjectName={mastery.subject?.name ?? ""} classLabel={`${mastery.class?.grade_label ?? ""} — فصل ${mastery.class?.name ?? ""}`} today={today}
                    docTitle={`تحليل الإتقان والإجراءات التربوية — مادة ${mastery.subject?.name ?? ""}`} axisLabel={maScope === "semester" ? `الفصل الدراسي ${semester} كامل (الفترتان)` : axisLabel} />

                  {/* اختيار نطاق التحليل */}
                  <div className="no-print mb-3 flex gap-1 rounded-xl bg-[#eef1ec] p-1 w-fit">
                    {([
                      { k: "period", label: "نطاق: الفترة الحالية" },
                      { k: "semester", label: "نطاق: الفصل الدراسي كامل" },
                    ] as const).map((o) => (
                      <button key={o.k} onClick={() => setMaScope(o.k)}
                        className={`rounded-lg px-3 py-1.5 text-[0.7rem] font-extrabold transition ${maScope === o.k ? "bg-white text-[#0a4630] shadow" : "text-[#5c6f65]"}`}>
                        {o.label}
                      </button>
                    ))}
                  </div>

                  {/* مستويات الأداء */}
                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center gap-2 text-[0.72rem] font-black text-[#0a4630]"><Target size={14} /> توزيع مستويات الأداء</div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {mastery.levels.map((l: any) => (
                        <div key={l.key} className="rounded-2xl border p-2.5 text-center" style={{ background: l.bg, borderColor: l.color + "55" }}>
                          <div className="text-2xl font-black tabular-nums" style={{ color: l.color }}>{l.count}</div>
                          <div className="text-[0.6rem] font-extrabold" style={{ color: l.color }}>{l.label}</div>
                          <div className="text-[0.55rem] font-bold text-[#5c6f65]">{l.pct}%</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* مقارنة الفترة الحالية بالسابقة */}
                  {mastery.periodCompare?.exists && (
                    <div className="mt-3 rounded-2xl border border-[#eef0ea] bg-[#fbfbf8] p-3">
                      <div className="mb-1.5 flex items-center gap-2 text-[0.72rem] font-black text-[#0a4630]"><TrendingUp size={14} /> متابعة المسار: مقارنة {mastery.periodCompare.curLabel} بـ {mastery.periodCompare.prevLabel}</div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-xl bg-white p-2 text-center ring-1 ring-[#eef0ea]"><div className="text-lg font-black text-[#0a4630]">{mastery.periodCompare.prevAvg}%</div><div className="text-[0.55rem] font-bold text-[#8a968d]">الفترة السابقة</div></div>
                        <div className="rounded-xl bg-white p-2 text-center ring-1 ring-[#eef0ea]"><div className="text-lg font-black text-[#0a4630]">{mastery.periodCompare.curAvg}%</div><div className="text-[0.55rem] font-bold text-[#8a968d]">الفترة الحالية</div></div>
                        <div className="rounded-xl p-2 text-center" style={{ background: mastery.periodCompare.delta >= 0 ? "#d1fae5" : "#fee2e2" }}>
                          <div className="flex items-center justify-center gap-1 text-lg font-black" style={{ color: mastery.periodCompare.delta >= 0 ? "#047857" : "#b91c1c" }}>
                            {mastery.periodCompare.delta >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                            {mastery.periodCompare.delta > 0 ? "+" : ""}{mastery.periodCompare.delta}%
                          </div>
                          <div className="text-[0.55rem] font-bold text-[#5c6f65]">{mastery.periodCompare.delta >= 0 ? "تحسّن" : "تراجع"}</div>
                        </div>
                        <div className="rounded-xl bg-white p-2 text-center ring-1 ring-[#eef0ea]">
                          <div className="text-[0.62rem] font-bold leading-tight text-[#0a4630]">{mastery.periodCompare.improved} تحسّن · {mastery.periodCompare.declined} تراجع · {mastery.periodCompare.unchanged} ثابت</div>
                          <div className="text-[0.5rem] font-bold text-[#8a968d]">مسار الطلاب</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* المهارات والفاقد التعليمي */}
                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center gap-2 text-[0.72rem] font-black text-[#0a4630]"><BookOpen size={14} /> تحليل المهارات والفاقد التعليمي</div>
                    <table className="sheet-table">
                      <thead>
                        <tr><th style={{ textAlign: "right" }}>المهارة/الخانة</th><th>النوع</th><th>العظمى</th><th>المتوسط</th><th>الإتقان ≥ 60%</th><th>الاجتياز ≥ 50%</th><th>إتقان سابق</th><th>الحالة</th></tr>
                      </thead>
                      <tbody>
                        {[...mastery.boxes].sort((a: any, b: any) => a.mastery - b.mastery).map((bx: any) => (
                          <tr key={bx.id} style={bx.status === "gap" ? { background: "#fdf1f1" } : undefined}>
                            <td style={{ textAlign: "right", fontWeight: 700 }}>{bx.name}</td>
                            <td style={{ color: bx.category === "performance" ? "#0f766e" : bx.category === "written_oral" ? "#a21caf" : "#3730a3", fontWeight: 700 }}>{bx.category === "performance" ? "أدائية" : bx.category === "written_oral" ? "تحريري/شفوي" : "تحريرية"}</td>
                            <td>{fmt(bx.max)}</td>
                            <td style={{ fontWeight: 800 }}>{bx.filled ? bx.avg.toFixed(1) : "—"}</td>
                            <td style={{ fontWeight: 800, color: bx.mastery >= 60 ? "#0f766e" : "#b91c1c" }}>{bx.filled ? `${bx.mastery}%` : "—"}</td>
                            <td>{bx.filled ? `${bx.pass50}%` : "—"}</td>
                            <td>{bx.prevMastery !== null ? `${bx.prevMastery}%` : "—"}</td>
                            <td><span className="band-chip" style={{
                              background: bx.status === "mastered" ? "#d1fae5" : bx.status === "attention" ? "#fef3c7" : "#fee2e2",
                              color: bx.status === "mastered" ? "#065f46" : bx.status === "attention" ? "#92400e" : "#991b1b"
                            }}>{bx.status === "mastered" ? "مُتقنة" : bx.status === "attention" ? "تحتاج انتباهاً" : "فاقد تعليمي"}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* مقارنة المواد والفصول */}
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="mb-1.5 flex items-center gap-2 text-[0.72rem] font-black text-[#0a4630]"><Users size={14} /> مقارنة المواد — {mastery.class?.grade_label} فصل {mastery.class?.name}</div>
                      <table className="sheet-table">
                        <thead><tr><th style={{ textAlign: "right" }}>المادة</th><th>المتوسط</th><th>الاجتياز ≥ 50%</th></tr></thead>
                        <tbody>
                          {mastery.subjectsCompare.map((s: any) => (
                            <tr key={s.id} style={s.isCurrent ? { background: "#f6f8f3", fontWeight: 800 } : undefined}>
                              <td style={{ textAlign: "right", fontWeight: 700 }}>{s.name}{s.isCurrent ? " (الحالية)" : ""}</td>
                              <td>{s.studentCount ? `${s.avgPct}%` : "—"}</td>
                              <td>{s.studentCount ? `${s.passRate50}%` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center gap-2 text-[0.72rem] font-black text-[#0a4630]"><ClipboardList size={14} /> مقارنة الفصول/الشعب — مادة {mastery.subject?.name}</div>
                      <table className="sheet-table">
                        <thead><tr><th style={{ textAlign: "right" }}>الفصل</th><th>الطلاب</th><th>المتوسط</th><th>الاجتياز ≥ 50%</th></tr></thead>
                        <tbody>
                          {mastery.classesCompare.map((c: any) => (
                            <tr key={c.id} style={c.isCurrent ? { background: "#f6f8f3", fontWeight: 800 } : undefined}>
                              <td style={{ textAlign: "right", fontWeight: 700 }}>{c.gradeLabel} — {c.name}{c.isCurrent ? " (الحالي)" : ""}</td>
                              <td>{c.studentCount}</td>
                              <td>{c.studentCount ? `${c.avgPct}%` : "—"}</td>
                              <td>{c.studentCount ? `${c.passRate50}%` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* الإجراءات التربوية */}
                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center gap-2 text-[0.72rem] font-black text-[#0a4630]"><Wrench size={14} /> الإجراءات التربوية المطلوبة</div>
                    <div className="grid gap-3 md:grid-cols-3">
                      {/* خطط علاجية */}
                      <div className="rounded-2xl border border-red-200 bg-red-50/50 p-3">
                        <div className="mb-2 flex items-center justify-between text-[0.7rem] font-black text-red-800">
                          <span>خطط علاجية ومتابعة</span><span className="rounded-full bg-red-100 px-2 py-0.5">{mastery.students.filter((s: any) => s.levelKey === "support" || s.levelKey === "follow").length}</span>
                        </div>
                        <div className="space-y-2">
                          {mastery.students.filter((s: any) => s.levelKey === "support" || s.levelKey === "follow").map((st: any) => (
                            <div key={st.id} className="rounded-xl bg-white p-2.5 ring-1 ring-red-100">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[0.72rem] font-extrabold text-[#22332a]">{st.name}</span>
                                <span className="band-chip" style={{ background: st.levelBg, color: st.levelColor }}>{st.levelLabel}</span>
                              </div>
                              <p className="mt-1 text-[0.6rem] font-semibold leading-relaxed text-[#5c6f65]">{remedialAction(st)}</p>
                              <button onClick={() => sendFamily(st)} className="no-print mt-1.5 inline-flex items-center gap-1 rounded-lg bg-[#25d366] px-2 py-1 text-[0.58rem] font-extrabold text-white transition hover:bg-[#1da851]"><MessageCircle size={11} /> تغذية راجعة للأسرة</button>
                            </div>
                          ))}
                          {mastery.students.filter((s: any) => s.levelKey === "support" || s.levelKey === "follow").length === 0 && <p className="py-3 text-center text-[0.62rem] font-bold text-[#8a968d]">لا يوجد طلاب بحاجة إلى خطة علاجية 🎉</p>}
                        </div>
                      </div>
                      {/* خطط إثرائية */}
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3">
                        <div className="mb-2 flex items-center justify-between text-[0.7rem] font-black text-emerald-800">
                          <span>خطط إثرائية للمتفوقين</span><span className="rounded-full bg-emerald-100 px-2 py-0.5">{mastery.students.filter((s: any) => s.levelKey === "excellent" || s.levelKey === "veryGood").length}</span>
                        </div>
                        <div className="space-y-2">
                          {mastery.students.filter((s: any) => s.levelKey === "excellent" || s.levelKey === "veryGood").map((st: any) => (
                            <div key={st.id} className="rounded-xl bg-white p-2.5 ring-1 ring-emerald-100">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[0.72rem] font-extrabold text-[#22332a]">{st.name}</span>
                                <span className="band-chip" style={{ background: st.levelBg, color: st.levelColor }}>{st.levelLabel}</span>
                              </div>
                              <p className="mt-1 text-[0.6rem] font-semibold leading-relaxed text-[#5c6f65]">{enrichAction(st)}</p>
                              <button onClick={() => sendFamily(st)} className="no-print mt-1.5 inline-flex items-center gap-1 rounded-lg bg-[#25d366] px-2 py-1 text-[0.58rem] font-extrabold text-white transition hover:bg-[#1da851]"><MessageCircle size={11} /> تغذية راجعة للأسرة</button>
                            </div>
                          ))}
                          {mastery.students.filter((s: any) => s.levelKey === "excellent" || s.levelKey === "veryGood").length === 0 && <p className="py-3 text-center text-[0.62rem] font-bold text-[#8a968d]">لا يوجد متفوقون حالياً</p>}
                        </div>
                      </div>
                      {/* تعديل أساليب التدريس */}
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3">
                        <div className="mb-2 flex items-center justify-between text-[0.7rem] font-black text-amber-800">
                          <span>تعديل أساليب التدريس والتقويم</span><span className="rounded-full bg-amber-100 px-2 py-0.5">{mastery.boxes.filter((b: any) => b.status !== "mastered").length}</span>
                        </div>
                        <div className="space-y-2">
                          {mastery.boxes.filter((b: any) => b.status !== "mastered").map((bx: any) => (
                            <div key={bx.id} className="rounded-xl bg-white p-2.5 ring-1 ring-amber-100">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[0.7rem] font-extrabold text-[#22332a]">{bx.name}</span>
                                <span className="text-[0.58rem] font-black" style={{ color: bx.status === "gap" ? "#b91c1c" : "#b45309" }}>{bx.status === "gap" ? "فاقد تعليمي" : "تحتاج انتباهاً"}</span>
                              </div>
                              <p className="mt-1 text-[0.6rem] font-semibold leading-relaxed text-[#5c6f65]">{teachingAction(bx)}</p>
                            </div>
                          ))}
                          {mastery.boxes.filter((b: any) => b.status !== "mastered").length === 0 && <p className="py-3 text-center text-[0.62rem] font-bold text-[#8a968d]">كل المهارات مُتقنة — واصل التعزيز 🎉</p>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* تغذية راجعة للأسرة (زر شامل) */}
                  <div className="mt-3 rounded-2xl border border-[#eef0ea] bg-[#fbfbf8] p-3">
                    <div className="mb-2 flex items-center gap-2 text-[0.72rem] font-black text-[#0a4630]"><Home size={14} /> تغذية راجعة للأسرة — إرسال جماعي لكل الطلاب</div>
                    <button onClick={() => {
                      const items = mastery.students.filter((s: any) => (s.guardianPhone ?? "").replace(/\D/g, "").length >= 9).map((s: any) => ({ name: s.name, link: channelLink(waChannel, s.guardianPhone ?? "", familyMessage(s)) }));
                      const ok = items.filter((x: any) => x.link);
                      if (ok.length === 0) { toast("لا يوجد طلاب برقم جوال", "error"); return; }
                      setWaQueue(ok); setWaQi(0); window.open(ok[0].link, "_blank", "noopener,noreferrer");
                      toast(`بدأ إرسال التغذية الراجعة — ${ok.length} رسالة`);
                    }} className={`btn !text-white ${waChannel === "sms" ? "!bg-[#0a4630]" : "!bg-[#25d366]"}`}>
                      {waChannel === "sms" ? <Smartphone size={16} /> : <MessageCircle size={16} />} إرسال تغذية راجعة لكل أولياء الأمور ({mastery.students.filter((s: any) => (s.guardianPhone ?? "").replace(/\D/g, "").length >= 9).length})
                    </button>
                  </div>

                  <SignatureRow teacher={teacher} />
                </>
              )}
            </div>
          )}

          {/* ===== الإرسال الجماعي (واتساب / رسالة نصية) ===== */}
          {tab === "wa" && (
            <>
              <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <h3 className="flex items-center gap-2 font-black text-[#0a4630]"><MessageCircle className="text-[#25d366]" /> إرسال جماعي لنتائج الطلاب</h3>
                  <p className="mt-0.5 text-[0.68rem] font-semibold text-[#8a968d]">إلى جوال ولي الأمر المرتبط — اختر القناة ثم الطلاب ثم ابدأ.</p>
                </div>
                <div className="flex gap-1 rounded-xl bg-[#eef1ec] p-1">
                  {([
                    { k: "wa", label: "واتساب" },
                    { k: "sms", label: "رسالة نصية SMS" },
                  ] as const).map((o) => (
                    <button key={o.k} onClick={() => setWaChannel(o.k)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.72rem] font-extrabold transition ${waChannel === o.k ? (o.k === "wa" ? "bg-[#25d366] text-white" : "bg-[#0a4630] text-white") + " shadow" : "text-[#5c6f65]"}`}>
                      {o.k === "wa" ? <MessageCircle size={15} /> : <Smartphone size={15} />} {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-5">
              {/* الصيغة القابلة للتحكم */}
              <div className="card p-5 lg:col-span-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-black text-[#0a4630]"><MessageCircle className="text-[#25d366]" /> صيغة الرسالة</h3>
                  <button onClick={() => saveWaTemplate(WA_DEFAULT_TEMPLATE)} className="btn btn-ghost !py-1.5 text-[0.68rem]">استعادة الصيغة الافتراضية</button>
                </div>
                <p className="mt-1 text-[0.68rem] font-semibold text-[#8a968d]">حرّر الرسالة كما تريد — اضغط أي ملاحظة أدناه لإدراجها، واطلع على المعاينة الحية.</p>
                <textarea
                  value={waTemplateEffective}
                  onChange={(e) => saveWaTemplate(e.target.value)}
                  rows={12}
                  className="input mt-3 w-full font-mono text-[0.78rem] leading-relaxed"
                  dir="rtl"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {WA_PLACEHOLDERS.map((p) => (
                    <button key={p.key} type="button"
                      onClick={() => saveWaTemplate(waTemplateEffective + " " + p.key)}
                      title={p.label}
                      className="rounded-lg border border-[#dfe2da] bg-[#fbfbf8] px-2 py-1 text-[0.62rem] font-bold text-[#0e5c3a] transition hover:bg-emerald-50">
                      <span dir="ltr">{p.key}</span> · {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* المعاينة + الاختيار */}
              <div className="card p-5 lg:col-span-2">
                <h3 className="font-black text-[#0a4630]">معاينة حية</h3>
                <div className="mt-2 rounded-2xl border border-[#dfe3da] bg-[#f6faf7] p-3 text-[0.75rem] leading-relaxed text-[#22332a] whitespace-pre-wrap">
                  {waEligible[0] ? renderTemplate(waTemplateEffective, waRowData(waEligible[0])) : "لا يوجد طلاب برقم جوال في هذا الفصل"}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <h3 className="font-black text-[#0a4630]">الطلاب المستهدفون</h3>
                  <div className="flex gap-1.5">
                    <button onClick={() => setWaSelected(new Set(waEligible.map((r) => r.s.id)))} className="btn btn-ghost !py-1 text-[0.65rem]">تحديد الكل</button>
                    <button onClick={() => setWaSelected(new Set())} className="btn btn-ghost !py-1 text-[0.65rem]">إلغاء الكل</button>
                  </div>
                </div>
                <p className="mt-1 text-[0.65rem] font-semibold text-[#8a968d]">
                  {waEligible.length} طالباً برقم جوال
                  {waMissing > 0 && <span className="text-amber-700"> · {waMissing} بدون رقم (لن يُرسل لهم)</span>}
                </p>
                <div className="mt-2 max-h-64 space-y-1 overflow-y-auto pe-1">
                  {waEligible.map((r) => (
                    <label key={r.s.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 transition ${waSelected.has(r.s.id) ? "border-emerald-300 bg-emerald-50/60" : "border-[#eef0ea] bg-white"}`}>
                      <input type="checkbox" className="accent-[#0e5c3a]" checked={waSelected.has(r.s.id)}
                        onChange={(e) => {
                          setWaSelected((prev) => {
                            const n = new Set(prev);
                            if (e.target.checked) n.add(r.s.id); else n.delete(r.s.id);
                            return n;
                          });
                        }} />
                      <span className="flex-1 truncate text-[0.75rem] font-bold text-[#22332a]">{r.s.full_name}</span>
                      <span className="text-[0.62rem] font-semibold tabular-nums text-[#8a968d]" dir="ltr">{r.s.guardian_phone}</span>
                    </label>
                  ))}
                </div>
                <button onClick={startWaQueue} disabled={waSelected.size === 0}
                  className={`btn mt-3 w-full justify-center !text-white ${waChannel === "sms" ? "!bg-[#0a4630]" : "!bg-[#25d366]"}`}>
                  {waChannel === "sms" ? <Smartphone size={17} /> : <MessageCircle size={17} />}
                  إرسال إلى {waSelected.size} طالب عبر {waChannel === "sms" ? "رسالة نصية" : "واتساب"}
                </button>
              </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* نافذة طابور الإرسال الجماعي */}
      {waQueue.length > 0 && (
        <div className="no-print fixed bottom-5 right-5 z-50 w-80 rounded-2xl border border-[#e6e7e0] bg-white p-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[0.78rem] font-black text-[#0a4630]">{waChannel === "sms" ? <Smartphone size={17} /> : <MessageCircle size={17} className="text-[#25d366]" />} جارٍ الإرسال الجماعي</span>
            <button onClick={waStop} className="rounded-lg px-2 py-1 text-[0.65rem] font-bold text-red-600 hover:bg-red-50">إيقاف</button>
          </div>
          <div className="mt-2 text-[0.72rem] font-bold text-[#3c4f44]">
            الرسالة {waQi + 1} من {waQueue.length} — <span className="text-[#0e5c3a]">{waQueue[waQi]?.name}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eef0ea]">
            <div className="h-full rounded-full bg-[#25d366] transition-all" style={{ width: `${((waQi + 1) / waQueue.length) * 100}%` }} />
          </div>
          <button onClick={waNext} className="btn btn-primary mt-3 w-full justify-center text-[0.75rem]">
            {waQi + 1 >= waQueue.length ? "إنهاء (افتُتحت الأخيرة)" : "افتح التالي ←"}
          </button>
          <p className="mt-2 text-[0.6rem] font-semibold text-[#8a968d]">{waChannel === "sms" ? "تُفتح كل رسالة في تطبيق الرسائل (من الجوال) — راجع وأرسل ثم «افتح التالي»." : "تُفتح كل رسالة في واتساب جاهزة — راجع واضغط «إرسال» ثم «افتح التالي»."}</p>
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

/** صندوق توقيع واحد — يعرض الصورة إن وُجدت، وإلا خط توقيع */
function SignBox({ title, name, image }: { title: string; name: string; image?: string | null }) {
  return (
    <div className="sign-box">
      <div style={{ fontWeight: 800, fontSize: "0.72rem" }}>{title}</div>
      <div style={{ height: "2.4rem", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        {image ? (
          <img src={image} alt={title} style={{ maxHeight: "2.4rem", maxWidth: "8rem", objectFit: "contain" }} />
        ) : (
          <div className="sign-line" style={{ width: "100%" }} />
        )}
      </div>
      <div style={{ fontSize: "0.72rem" }}>{name}</div>
    </div>
  );
}

/** صف التوقيعات — معلم المادة ومدير المدرسة فقط */
function SignatureRow({ teacher }: { teacher: TeacherInfo | null }) {
  return (
    <div className="sign-row">
      <SignBox title="معلم المادة" name={teacher?.full_name ?? ""} image={teacher?.teacher_sig} />
      <SignBox title="مدير المدرسة" name={teacher?.principal_name ?? ""} image={teacher?.principal_sig} />
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
