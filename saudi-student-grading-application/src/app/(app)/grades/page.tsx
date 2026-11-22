"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  ClipboardCheck, Save, CloudCheck, Loader2, CloudOff, Search, AlertTriangle,
  Printer, RefreshCw, Users, TrendingUp, ShieldAlert, ChevronDown,
} from "lucide-react";
import { toast } from "@/components/AppShell";

type ClassItem = { id: number; name: string; grade_label: string; stage: string };
type SubjectItem = { id: number; name: string; color: string; is_active: boolean; grade_labels?: string[] };
type Component = { id: number; name: string; category: string; max_score: number; weight_label: string; is_active: boolean };
type StudentRow = { id: number; full_name: string; national_id: string };
type SubjectInfo = { id: number; name: string; max_total: string | number; pass_score: string | number; color: string };

type SaveState = "idle" | "saving" | "saved" | "error";

// تحويل الأرقام العربية/الفارسية إلى لاتينية ثم float
function toLatinDigits(s: string): string {
  const map: Record<string, string> = { "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9","۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9", "٫": "." };
  return s.split("").map((ch) => map[ch] ?? ch).join("").replace(/[^\d.]/g, "");
}

function band(percent: number) {
  if (percent >= 90) return { label: "ممتاز", cls: "bg-emerald-100 text-emerald-800" };
  if (percent >= 80) return { label: "جيد جداً", cls: "bg-teal-100 text-teal-800" };
  if (percent >= 70) return { label: "جيد", cls: "bg-blue-100 text-blue-800" };
  if (percent >= 60) return { label: "مقبول", cls: "bg-amber-100 text-amber-800" };
  return { label: "ضعيف", cls: "bg-red-100 text-red-700" };
}

export default function GradesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [semester, setSemester] = useState<string>("1");
  const [period, setPeriod] = useState<string>("1");
  const [notLinked, setNotLinked] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [subject, setSubject] = useState<SubjectInfo | null>(null);
  const [values, setValues] = useState<Record<number, Record<number, string>>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string>("");
  const [query, setQuery] = useState("");
  const [highlightFailing, setHighlightFailing] = useState(true);
  const debounceRef = useRef<number | null>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    fetch("/api/classes", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (d.ok) { setClasses(d.classes); if (d.classes[0]) setClassId(String(d.classes[0].id)); }
    });
    fetch("/api/subjects", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (d.ok) setSubjects(d.subjects.filter((s: SubjectItem) => s.is_active));
    });
  }, []);

  // المواد الظاهرة = المرتبطة بصف الفصل المختار فقط
  const activeClassGradeLabel = classes.find((c) => String(c.id) === classId)?.grade_label ?? "";
  const linkedSubjects = useMemo(
    () => subjects.filter((s) => !activeClassGradeLabel || (s.grade_labels ?? []).includes(activeClassGradeLabel)),
    [subjects, activeClassGradeLabel]
  );

  // لو تغير الفصل وما عادت المادة المختارة مرتبطة بصفه — اختر أول مادة مرتبطة
  useEffect(() => {
    if (linkedSubjects.length > 0 && !linkedSubjects.some((s) => String(s.id) === subjectId)) {
      setSubjectId(String(linkedSubjects[0].id));
    }
  }, [linkedSubjects, subjectId]);

  const loadGrid = useCallback(async () => {
    if (!classId || !subjectId) return;
    setLoadingGrid(true);
    setSaveState("idle");
    setNotLinked(false);
    const r = await fetch(`/api/grades?classId=${classId}&subjectId=${subjectId}&semester=${semester}&period=${period}`, { cache: "no-store" });
    const d = await r.json();
    if (d.notLinked) { setNotLinked(true); setStudents([]); setLoadingGrid(false); return; }
    if (d.ok) {
      setStudents(d.students);
      setSubject(d.subject);
      setComponents(d.components.filter((c: Component) => c.is_active));
      const vals: Record<number, Record<number, string>> = {};
      for (const s of d.students) {
        vals[s.id] = {};
        for (const c of d.components.filter((x: Component) => x.is_active)) {
          const v = d.grades?.[s.id]?.[c.id];
          vals[s.id][c.id] = v === null || v === undefined ? "" : String(v);
        }
      }
      setValues(vals);
      setDirty(new Set());
    } else toast(d.error ?? "تعذر تحميل الشبكة", "error");
    setLoadingGrid(false);
  }, [classId, subjectId, semester, period]);

  useEffect(() => { loadGrid(); }, [loadGrid]);

  const maxTotal = useMemo(() => components.reduce((a, c) => a + Number(c.max_score), 0), [components]);
  const passScore = subject ? Number(subject.pass_score) : 50;

  const totals = useMemo(() => {
    const map = new Map<number, { total: number; filled: number; overMax: boolean }>();
    for (const s of students) {
      let total = 0, filled = 0, overMax = false;
      for (const c of components) {
        const raw = values[s.id]?.[c.id] ?? "";
        if (raw === "") continue;
        const n = parseFloat(toLatinDigits(raw));
        if (Number.isNaN(n)) continue;
        total += n; filled++;
        if (n > Number(c.max_score)) overMax = true;
      }
      map.set(s.id, { total, filled, overMax });
    }
    return map;
  }, [students, components, values]);

  const columnAverages = useMemo(() => {
    return components.map((c) => {
      let sum = 0, n = 0;
      for (const s of students) {
        const raw = values[s.id]?.[c.id] ?? "";
        if (raw === "") continue;
        const v = parseFloat(toLatinDigits(raw));
        if (!Number.isNaN(v)) { sum += v; n++; }
      }
      return n ? sum / n : 0;
    });
  }, [students, components, values]);

  const stats = useMemo(() => {
    let failing = 0, graded = 0, topTotal = 0;
    for (const s of students) {
      const t = totals.get(s.id);
      if (!t || t.filled === 0) continue;
      graded++;
      if (t.total < passScore) failing++;
      if (t.total > topTotal) topTotal = t.total;
    }
    return { failing, graded, topTotal };
  }, [students, totals, passScore]);

  const flush = useCallback(async () => {
    const pending = Array.from(dirtyRef.current);
    if (pending.length === 0) return;
    setDirty(new Set());
    const entries = pending.map((key) => {
      const [studentId, componentId] = key.split(":").map(Number);
      const raw = values[studentId]?.[componentId] ?? "";
      const value = raw === "" ? null : parseFloat(toLatinDigits(raw));
      return { studentId, componentId, value: value === null || Number.isNaN(value) ? null : value };
    });
    setSaveState("saving");
    try {
      const r = await fetch("/api/grades", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries, semester: Number(semester), period: Number(period) }),
      });
      const d = await r.json();
      if (d.ok) {
        setSaveState("saved");
        setSavedAt(new Date().toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      } else {
        setSaveState("error");
        setDirty(new Set(pending));
      }
    } catch {
      setSaveState("error");
      setDirty(new Set(pending));
    }
  }, [values, semester, period]);

  // مرجع دائم لآخر نسخة من flush (حتى لا تعتمد المهلة على قيم قديمة)
  const flushRef = useRef(flush);
  flushRef.current = flush;

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => flushRef.current(), 550);
  }, []);

  const onCellChange = (studentId: number, componentId: number, raw: string) => {
    setValues((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [componentId]: raw } }));
    setDirty((prev) => new Set(prev).add(`${studentId}:${componentId}`));
    scheduleSave();
  };

  const onCellBlur = () => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    flushRef.current();
  };

  // ===== تنقّل لوحة المفاتيح (أسهم + Enter) — الجدول RTL =====
  const onGridKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    const r = Number(target.dataset.row);
    const c = Number(target.dataset.col);
    let nextR = r, nextC = c;

    const focusCell = (row: number, col: number) => {
      const el = document.querySelector<HTMLInputElement>(`input[data-cell="${row}-${col}"]`);
      el?.focus();
      el?.select();
    };

    switch (e.key) {
      case "ArrowUp": e.preventDefault(); nextR = Math.max(0, r - 1); break;
      case "ArrowDown": e.preventDefault(); nextR = Math.min(students.length - 1, r + 1); break;
      case "ArrowRight": e.preventDefault(); nextC = Math.max(0, c - 1); break; // RTL: يمين = خانة أقرب للبداية
      case "ArrowLeft": e.preventDefault(); nextC = Math.min(components.length - 1, c + 1); break;
      case "Enter":
        e.preventDefault();
        nextR = e.shiftKey ? Math.max(0, r - 1) : Math.min(students.length - 1, r + 1);
        break;
      case "Tab":
        e.preventDefault();
        if (e.shiftKey) { nextC = c - 1; if (nextC < 0) { nextC = components.length - 1; nextR = r - 1; } }
        else { nextC = c + 1; if (nextC >= components.length) { nextC = 0; nextR = r + 1; } }
        if (nextR < 0) nextR = 0;
        if (nextR >= students.length) { nextR = students.length - 1; }
        break;
      default: return;
    }
    if (nextR !== r || nextC !== c) focusCell(nextR, nextC);
  };

  const filteredStudents = useMemo(() => {
    const q = query.trim();
    if (!q) return students;
    return students.filter((s) => s.full_name.includes(q) || s.national_id.includes(q));
  }, [students, query]);

  const activeClass = classes.find((c) => String(c.id) === classId);
  const activeSubject = linkedSubjects.find((s) => String(s.id) === subjectId) ?? subjects.find((s) => String(s.id) === subjectId);

  return (
    <div className="space-y-4">
      {/* ===== رأس صفحة الرصد ===== */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-[#0a4630]"><ClipboardCheck className="text-[#c9a24b]" /> رصد الدرجات</h2>
          <p className="text-[0.72rem] font-semibold text-[#5c6f65]">تنقّل بالأسهم وEnter — كل تعديل يُحفظ تلقائياً في السحابة</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* مؤشر الحفظ */}
          <span className={`chip !px-3 !py-1.5 text-[0.7rem] ring-1 ${
            saveState === "saving" ? "bg-amber-50 text-amber-800 ring-amber-300"
            : saveState === "saved" ? "bg-emerald-50 text-emerald-800 ring-emerald-300"
            : saveState === "error" ? "bg-red-50 text-red-700 ring-red-300"
            : "bg-[#eef1ec] text-[#5c6f65] ring-[#e3e4dd]"}`}>
            {saveState === "saving" && <><Loader2 size={13} className="animate-spin save-dot" /> جارٍ الحفظ…</>}
            {saveState === "saved" && <><CloudCheck size={14} /> حُفظ سحابياً {savedAt && `· ${savedAt}`}</>}
            {saveState === "error" && <><CloudOff size={14} /> تعذر الحفظ — ستُعاد المحاولة</>}
            {saveState === "idle" && <><Save size={13} /> الحفظ التلقائي مفعّل</>}
          </span>
          <button onClick={() => { if (debounceRef.current) clearTimeout(debounceRef.current); flushRef.current(); }} className="btn btn-ghost !py-2 text-[0.75rem]"><RefreshCw size={15} /> حفظ الآن</button>
          {classId && subjectId && (
            <Link href={`/reports?classId=${classId}&subjectId=${subjectId}&semester=${semester}&period=${period}`} className="btn btn-primary !py-2 text-[0.75rem]"><Printer size={15} /> طباعة الكشف</Link>
          )}
        </div>
      </div>

      {/* ===== أدوات الاختيار ===== */}
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <label className="flex items-center gap-2">
          <span className="text-[0.7rem] font-extrabold text-[#5c6f65]">الفصل</span>
          <div className="relative">
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className="input !w-auto appearance-none !pe-8 font-bold">
              {classes.map((c) => <option key={c.id} value={c.id}>{c.grade_label} — {c.name}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a968d]" />
          </div>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-[0.7rem] font-extrabold text-[#5c6f65]">المادة</span>
          <div className="relative">
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="input !w-auto appearance-none !pe-8 font-bold">
              {linkedSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a968d]" />
          </div>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-[0.7rem] font-extrabold text-[#5c6f65]">الفصل الدراسي</span>
          <div className="relative">
            <select value={semester} onChange={(e) => setSemester(e.target.value)} className="input !w-auto appearance-none !pe-8 font-bold">
              <option value="1">الفصل الأول</option>
              <option value="2">الفصل الثاني</option>
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a968d]" />
          </div>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-[0.7rem] font-extrabold text-[#5c6f65]">الفترة</span>
          <div className="relative">
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="input !w-auto appearance-none !pe-8 font-bold">
              <option value="1">الفترة الأولى</option>
              <option value="2">الفترة الثانية</option>
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a968d]" />
          </div>
        </label>
        <div className="relative min-w-[180px] flex-1">
          <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8a968d]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث داخل الكشف…" className="input !ps-9" />
        </div>
        <label className="flex cursor-pointer select-none items-center gap-2 rounded-xl border border-[#e3e4dd] bg-white px-3 py-2 text-[0.7rem] font-extrabold text-[#3c4f44] hover:shadow-sm">
          <input type="checkbox" className="accent-[#b91c1c]" checked={highlightFailing} onChange={(e) => setHighlightFailing(e.target.checked)} />
          إبراز المتعثرين
        </label>
        {activeSubject && <span className="chip bg-[#eef6f0] text-[#0e5c3a] ring-1 ring-emerald-200">العظمى {maxTotal} · النجاح {passScore}</span>}
      </div>

      {/* ===== إحصائيات سريعة ===== */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { icon: Users, label: "طلاب في الكشف", value: students.length, tone: "text-[#0a4630]" },
          { icon: TrendingUp, label: "أعلى مجموع", value: stats.topTotal, tone: "text-emerald-700" },
          { icon: ClipboardCheck, label: "رُصدت درجاتهم", value: stats.graded, tone: "text-blue-800" },
          { icon: ShieldAlert, label: "دون درجة النجاح", value: stats.failing, tone: stats.failing > 0 ? "text-red-600" : "text-emerald-700" },
        ].map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} className="card flex items-center gap-3 p-3">
              <Icon size={20} className={k.tone} />
              <div>
                <div className="text-xl font-black tabular-nums text-[#22332a]">{k.value}</div>
                <div className="text-[0.6rem] font-bold text-[#8a968d]">{k.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== شبكة الرصد ===== */}
      <div className="card overflow-hidden">
        {loadingGrid ? (
          <div className="p-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="shimmer mb-2 h-9 rounded" />)}</div>
        ) : notLinked ? (
          <div className="p-12 text-center">
            <AlertTriangle className="mx-auto text-amber-500" size={36} />
            <p className="mt-2 font-bold text-[#5c6f65]">هذه المادة غير مرتبطة بهذا الصف</p>
            <p className="mt-1 text-[0.72rem] text-[#8a968d]">اربط المادة بالصف من صفحة المواد والتوزيع لتظهر هنا</p>
            <Link href="/subjects" className="btn btn-primary mt-3">ربط المواد بالصفوف</Link>
          </div>
        ) : linkedSubjects.length === 0 ? (
          <div className="p-12 text-center">
            <AlertTriangle className="mx-auto text-amber-500" size={36} />
            <p className="mt-2 font-bold text-[#5c6f65]">لا توجد مواد مرتبطة بصف هذا الفصل</p>
            <Link href="/subjects" className="btn btn-primary mt-3">ربط المواد بالصفوف</Link>
          </div>
        ) : components.length === 0 ? (
          <div className="p-12 text-center">
            <AlertTriangle className="mx-auto text-amber-500" size={36} />
            <p className="mt-2 font-bold text-[#5c6f65]">هذه المادة بلا خانات درجات مفعّلة</p>
            <Link href="/subjects" className="btn btn-primary mt-3">ضبط توزيع الدرجات</Link>
          </div>
        ) : (
          <div className="max-h-[64vh] overflow-auto">
            <table className="grade-grid w-full min-w-[900px] border-collapse text-[0.78rem]">
              <thead className="sticky top-0 z-20">
                <tr className="bg-[#0a4630] text-white">
                  <th rowSpan={2} className="sticky right-0 z-10 min-w-[230px] border-white/10 bg-[#0a4630] px-3 py-2 text-right align-middle text-[0.72rem] font-extrabold text-[#e7cf9a]">
                    الطالب {activeClass && <span className="block text-[0.58rem] font-semibold text-emerald-200/80">{activeClass.grade_label} — {activeClass.name}</span>}
                  </th>
                  {components.map((c) => (
                    <th key={c.id} className="min-w-[86px] border-white/10 border-s px-1 py-1.5 text-center align-middle">
                      <div className="text-[0.66rem] font-extrabold leading-tight text-white">{c.name}</div>
                      <div className="mt-0.5 text-[0.56rem] font-bold text-[#c9a24b]">{c.category === "performance" ? "أدائية" : "تحريرية"} · {Number(c.max_score)}</div>
                    </th>
                  ))}
                  <th rowSpan={2} className="min-w-[72px] border-s border-white/10 bg-[#083d28] px-2 text-center align-middle text-[0.7rem] font-black text-[#e7cf9a]">المجموع<br /><span className="text-[0.55rem] font-bold text-emerald-200/70">/ {maxTotal}</span></th>
                  <th rowSpan={2} className="min-w-[52px] border-s border-white/10 bg-[#083d28] px-2 text-center align-middle text-[0.7rem] font-black text-[#e7cf9a]">النسبة</th>
                  <th rowSpan={2} className="min-w-[66px] border-s border-white/10 bg-[#083d28] px-2 text-center align-middle text-[0.7rem] font-black text-[#e7cf9a]">التقدير</th>
                </tr>
                <tr className="bg-[#0c4a2f] text-[0.58rem] text-emerald-100/80">
                  {components.map((c) => <th key={c.id} className="border-s border-white/10 px-1 pb-1 pt-0 font-semibold">من {Number(c.max_score)}</th>)}
                </tr>
              </thead>
              <tbody className="bg-white">
                {filteredStudents.map((s) => {
                  const idx = students.findIndex((x) => x.id === s.id);
                  const t = totals.get(s.id);
                  const total = t?.total ?? 0;
                  const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
                  const b = band(pct);
                  const failing = t && t.filled > 0 && total < passScore;
                  return (
                    <tr key={s.id} className={`transition-colors hover:bg-[#fbfdf9] ${highlightFailing && failing ? "bg-red-50/60" : idx % 2 ? "bg-[#fcfdfb]" : ""}`}>
                      <td className="sticky right-0 z-10 border-e border-[#e3e6dd] bg-inherit px-3 py-1" style={{ background: "inherit" }}>
                        <div className="flex items-center gap-2">
                          <span className="w-6 text-center text-[0.65rem] font-bold tabular-nums text-[#a3ada5]">{idx + 1}</span>
                          <div className="min-w-0">
                            <div className="max-w-[200px] truncate text-[0.76rem] font-extrabold text-[#22332a]" title={s.full_name}>{s.full_name}</div>
                            <div className="text-[0.56rem] font-semibold tabular-nums text-[#a3ada5]" dir="ltr">{s.national_id || "—"}</div>
                          </div>
                        </div>
                      </td>
                      {components.map((c, colIdx) => {
                        const raw = values[s.id]?.[c.id] ?? "";
                        const n = parseFloat(toLatinDigits(raw));
                        const over = raw !== "" && !Number.isNaN(n) && n > Number(c.max_score);
                        const isDirty = dirty.has(`${s.id}:${c.id}`);
                        return (
                          <td key={c.id} className={`grade-cell ${over ? "overmax" : ""} ${isDirty ? "modified" : ""} border-l border-[#eef0ea] p-0 align-middle`}>
                            <input
                              className="grade-input"
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              data-row={idx}
                              data-col={colIdx}
                              data-cell={`${idx}-${colIdx}`}
                              value={raw}
                              placeholder="·"
                              aria-label={`${s.full_name} — ${c.name}`}
                              onChange={(e) => onCellChange(s.id, c.id, e.target.value)}
                              onBlur={onCellBlur}
                              onKeyDown={onGridKeyDown}
                              onFocus={(e) => e.target.select()}
                            />
                          </td>
                        );
                      })}
                      <td className="border-l border-[#eef0ea] bg-[#fbfbf8] px-2 text-center text-[0.82rem] font-black tabular-nums text-[#0a4630]">{(t?.filled ?? 0) > 0 ? total : "—"}</td>
                      <td className="border-l border-[#eef0ea] bg-[#fbfbf8] px-2 text-center text-[0.7rem] font-bold tabular-nums text-[#5c6f65]">{(t?.filled ?? 0) > 0 ? `${pct.toFixed(1)}%` : "—"}</td>
                      <td className="border-l border-[#eef0ea] bg-[#fbfbf8] px-2 text-center">
                        {(t?.filled ?? 0) > 0 ? <span className={`chip ${b.cls}`}>{b.label}</span> : <span className="text-[#cfd4cb]">—</span>}
                      </td>
                    </tr>
                  );
                })}
                {filteredStudents.length === 0 && (
                  <tr><td colSpan={components.length + 4} className="px-4 py-10 text-center text-sm font-bold text-[#8a968d]">لا يوجد طلاب مطابقون للبحث</td></tr>
                )}
              </tbody>
              {filteredStudents.length > 0 && (
                <tfoot>
                  <tr className="bg-[#eef1ec] text-[0.66rem] font-extrabold text-[#3c4f44]">
                    <td className="sticky right-0 z-10 bg-[#eef1ec] px-3 py-2 text-[#0a4630]">متوسط الكشف</td>
                    {columnAverages.map((avg, i) => <td key={i} className="border-l border-[#dfe2da] px-1 py-2 text-center tabular-nums">{avg.toFixed(1)}</td>)}
                    <td className="border-l border-[#dfe2da] px-2 py-2 text-center tabular-nums">{(filteredStudents.reduce((a, s) => a + (totals.get(s.id)?.total ?? 0), 0) / Math.max(1, stats.graded)).toFixed(1)}</td>
                    <td className="border-l border-[#dfe2da]"></td>
                    <td className="border-l border-[#dfe2da]"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-[0.62rem] font-semibold text-[#8a968d]">
        <AlertTriangle size={12} /> الخانات ذات الخلفية الحمراء تجاوزت العظمى المسموحة، والصفوف الوردية دون درجة النجاح — راجعها قبل اعتماد الكشف.
      </p>
    </div>
  );
}
