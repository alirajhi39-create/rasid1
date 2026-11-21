"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Users, UserPlus, Upload, Search, Pencil, Trash2, X, FileSpreadsheet,
  ClipboardPaste, School, Phone, IdCard, Loader2, CheckCircle2, AlertCircle, Filter,
} from "lucide-react";
import { toast } from "@/components/AppShell";

type ClassItem = { id: number; name: string; grade_label: string; stage: string; student_count?: number };
type Student = {
  id: number; full_name: string; national_id: string; guardian_phone: string;
  gender: string; notes: string; class_id: number; class_name: string; grade_label: string;
};

type ImportRow = { fullName: string; nationalId: string; guardianPhone: string; gender: string };

export default function StudentsPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classId, setClassId] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Student | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // نموذج الإضافة/التعديل
  const [form, setForm] = useState({ fullName: "", nationalId: "", classId: "", guardianPhone: "", gender: "ذكر" });
  const [saving, setSaving] = useState(false);

  // الاستيراد
  const [importTab, setImportTab] = useState<"paste" | "file">("paste");
  const [pasteText, setPasteText] = useState("");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ImportRow[]>([]);
  const [nameCol, setNameCol] = useState(1);
  const [idCol, setIdCol] = useState(0);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [importClassId, setImportClassId] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadClasses = async () => {
    const r = await fetch("/api/classes", { cache: "no-store" });
    const d = await r.json();
    if (d.ok) setClasses(d.classes);
  };

  const loadStudents = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (classId !== "all") params.set("classId", classId);
    if (query.trim()) params.set("q", query.trim());
    const r = await fetch(`/api/students?${params}`, { cache: "no-store" });
    const d = await r.json();
    if (d.ok) setStudents(d.students);
    setLoading(false);
  };

  useEffect(() => { loadClasses(); }, []);
  useEffect(() => {
    const t = setTimeout(loadStudents, 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, query]);

  const openAdd = () => {
    setForm({ fullName: "", nationalId: "", classId: classId !== "all" ? classId : classes[0]?.id?.toString() ?? "", guardianPhone: "", gender: "ذكر" });
    setAddOpen(true);
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const r = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, classId: Number(form.classId) }),
    });
    const d = await r.json();
    setSaving(false);
    if (d.ok) {
      toast("أُضيف الطالب بنجاح");
      setAddOpen(false);
      loadStudents();
      loadClasses();
    } else toast(d.error ?? "تعذر الإضافة", "error");
  };

  const openEdit = (s: Student) => {
    setEditTarget(s);
    setForm({ fullName: s.full_name, nationalId: s.national_id, classId: String(s.class_id), guardianPhone: s.guardian_phone, gender: s.gender });
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    const r = await fetch(`/api/students/${editTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, classId: Number(form.classId) }),
    });
    const d = await r.json();
    setSaving(false);
    if (d.ok) {
      toast(editTarget.class_id !== Number(form.classId) ? "حُفظت التعديلات ونُقل الطالب بين الفصول" : "حُفظت التعديلات");
      setEditTarget(null);
      loadStudents();
      loadClasses();
    } else toast(d.error ?? "تعذر الحفظ", "error");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const r = await fetch(`/api/students/${deleteTarget.id}`, { method: "DELETE" });
    const d = await r.json();
    if (d.ok) {
      toast("حُذف الطالب ودرجاته نهائياً");
      setDeleteTarget(null);
      loadStudents();
      loadClasses();
    } else toast(d.error ?? "تعذر الحذف", "error");
  };

  // ============ الاستيراد ============
  const looksLikeNid = (v: string) => /^[12]?\d{8,10}$/.test(v.replace(/\s/g, ""));

  const detectColumns = (rows: string[][]) => {
    const sample = rows.slice(0, 30);
    let bestId = -1, bestName = -1;
    const colCount = Math.max(...sample.map((r) => r.length), 0);
    for (let c = 0; c < colCount; c++) {
      const nidHits = sample.filter((r) => r[c] && looksLikeNid(String(r[c]))).length;
      if (nidHits >= 2 && bestId === -1) bestId = c;
    }
    for (let c = 0; c < colCount; c++) {
      if (c === bestId) continue;
      const nameHits = sample.filter((r) => {
        const v = String(r[c] ?? "").trim();
        return v.length >= 6 && /[\u0600-\u06FF ]/.test(v) && !/اسم|الاسم|الطالب/.test(v);
      }).length;
      if (nameHits >= 2) { bestName = c; break; }
    }
    setIdCol(bestId === -1 ? 0 : bestId);
    setNameCol(bestName === -1 ? (bestId === 0 ? 1 : 0) : bestName);
    return { bestId, bestName };
  };

  const applyColumns = (rows: string[][], nc: number, ic: number) => {
    const out: ImportRow[] = [];
    for (const r of rows) {
      const name = String(r[nc] ?? "").trim().replace(/\s+/g, " ");
      let nid = String(r[ic] ?? "").replace(/\D/g, "");
      if (nid.length > 10) nid = nid.slice(-10);
      const phone = r.map(String).find((c) => /^05\d{8}$/.test(c.replace(/\s/g, ""))) ?? "";
      if (name.length >= 3 && !/^(الاسم|اسم الطالب|اسم)$/i.test(name)) {
        out.push({ fullName: name, nationalId: nid, guardianPhone: phone, gender: "ذكر" });
      }
    }
    setParsed(out);
  };

  const parseMatrix = (matrix: unknown[][]) => {
    const rows = matrix
      .map((r) => r.map((c) => String(c ?? "").trim()))
      .filter((r) => r.some((c) => c.length > 0));
    setRawRows(rows);
    const { bestId, bestName } = detectColumns(rows);
    applyColumns(rows, bestName === -1 ? (bestId === 0 ? 1 : 0) : bestName, bestId === -1 ? 0 : bestId);
  };

  const onPasteAnalyze = () => {
    const lines = pasteText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const delim = pasteText.includes("\t") ? "\t" : pasteText.includes(";") ? ";" : ",";
    parseMatrix(lines.map((l) => l.split(delim)));
  };

  const onFile = async (file: File) => {
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
    parseMatrix(matrix);
  };

  const updateColumnChoice = (nc: number, ic: number) => {
    setNameCol(nc); setIdCol(ic);
    applyColumns(rawRows, nc, ic);
  };

  const doImport = async () => {
    if (!importClassId || parsed.length === 0) return;
    setImporting(true);
    setImportResult(null);
    const r = await fetch("/api/students/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId: Number(importClassId), rows: parsed }),
    });
    const d = await r.json();
    setImporting(false);
    if (d.ok) {
      setImportResult({ inserted: d.inserted, skipped: d.skipped });
      toast(`تم استيراد ${d.inserted} طالباً`);
      loadStudents();
      loadClasses();
    } else toast(d.error ?? "تعذر الاستيراد", "error");
  };

  const resetImport = () => {
    setPasteText(""); setFileName(""); setParsed([]); setRawRows([]); setImportResult(null);
  };

  const totalShown = students.length;
  const filteredClass = classes.find((c) => String(c.id) === classId);

  const modalWrap = (children: React.ReactNode, wide = false) => (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => { setAddOpen(false); setEditTarget(null); setImportOpen(false); setDeleteTarget(null); }}>
      <div className={`max-h-[96vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6 ${wide ? "max-w-4xl" : "max-w-lg"}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );

  const classOptions = (
    <>
      {classes.map((c) => <option key={c.id} value={c.id}>{c.grade_label} — {c.name}</option>)}
    </>
  );

  return (
    <div className="space-y-4">
      {/* ===== رأس الصفحة ===== */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-[#0a4630]"><Users className="text-[#c9a24b]" /> شؤون الطلاب</h2>
          <p className="text-[0.72rem] font-semibold text-[#5c6f65]">
            {filteredClass ? <>تعرض طلاب <b>{filteredClass.grade_label} — {filteredClass.name}</b> ({totalShown})</> : <>جميع الطلاب في {classes.length} فصول ({totalShown})</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={() => { resetImport(); setImportOpen(true); }}>
            <Upload size={17} /> استيراد من نور / Excel
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <UserPlus size={17} /> إضافة طالب
          </button>
        </div>
      </div>

      {/* ===== شريط البحث والفلترة ===== */}
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={17} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8a968d]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالاسم أو رقم الهوية…"
            className="input !ps-9" aria-label="بحث" />
        </div>
        <div className="relative">
          <Filter size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8a968d]" />
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="input !w-auto !ps-9 font-bold" aria-label="الفصل">
            <option value="all">كل الفصول ({students.length === 0 && classId === "all" ? "" : ""})</option>
            {classOptions}
          </select>
        </div>
        <div className="ms-auto text-[0.72rem] font-extrabold text-[#5c6f65]">
          <span className="rounded-lg bg-[#eef1ec] px-3 py-1.5 tabular-nums">{students.length} طالب</span>
        </div>
      </div>

      {/* ===== الجدول ===== */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[0.8rem]">
            <thead>
              <tr className="bg-[#0a4630] text-[#e7cf9a]">
                <th className="px-4 py-2.5 text-right text-[0.72rem] font-extrabold">#</th>
                <th className="px-4 py-2.5 text-right text-[0.72rem] font-extrabold">الاسم الرباعي</th>
                <th className="px-4 py-2.5 text-right text-[0.72rem] font-extrabold">رقم الهوية / السجل المدني</th>
                <th className="px-4 py-2.5 text-right text-[0.72rem] font-extrabold">الفصل</th>
                <th className="px-4 py-2.5 text-right text-[0.72rem] font-extrabold">جوال ولي الأمر</th>
                <th className="px-4 py-2.5 text-center text-[0.72rem] font-extrabold">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef0ea]">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="shimmer h-6 rounded" /></td></tr>
                ))
              ) : students.map((s, i) => (
                <tr key={s.id} className="transition hover:bg-[#fbfdf9]">
                  <td className="px-4 py-2.5 font-bold tabular-nums text-[#8a968d]">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[0.8rem] font-black text-emerald-800">{s.full_name.charAt(0)}</div>
                      <span className="font-extrabold text-[#22332a]">{s.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-[#3c4f44]" dir="ltr"><span className="float-right">{s.national_id || "—"}</span></td>
                  <td className="px-4 py-2.5"><span className="chip bg-[#eef6f0] text-[#0e5c3a] ring-1 ring-emerald-200">{s.grade_label} · {s.class_name}</span></td>
                  <td className="px-4 py-2.5 tabular-nums text-[#3c4f44]" dir="ltr"><span className="float-right">{s.guardian_phone || "—"}</span></td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={() => openEdit(s)} title="تعديل / نقل بين الفصول" className="grid h-8 w-8 place-items-center rounded-lg text-[#0e5c3a] transition hover:bg-emerald-50"><Pencil size={16} /></button>
                      <button onClick={() => setDeleteTarget(s)} title="حذف" className="grid h-8 w-8 place-items-center rounded-lg text-red-600 transition hover:bg-red-50"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && students.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center">
                  <Users size={36} className="mx-auto text-[#cfd4cb]" />
                  <p className="mt-2 font-bold text-[#8a968d]">لا يوجد طلاب مطابقون — جرّب تعديل البحث أو أضف طلاباً جدداً</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== نافذة الإضافة/التعديل ===== */}
      {(addOpen || editTarget) && modalWrap(
        <form onSubmit={editTarget ? submitEdit : submitAdd}>
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-black text-[#0a4630]">
              {editTarget ? <Pencil size={18} /> : <UserPlus size={18} />}
              {editTarget ? "تعديل بيانات الطالب / نقله" : "إضافة طالب جديد"}
            </h3>
            <button type="button" onClick={() => { setAddOpen(false); setEditTarget(null); }} className="rounded-lg p-1.5 text-[#8a968d] hover:bg-[#f4f5f0]"><X size={18} /></button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="fn">الاسم الرباعي <span className="text-red-500">*</span></label>
              <input id="fn" required className="input" placeholder="مثال: محمد عبدالله سعد الشمري" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="nid">رقم الهوية / السجل المدني</label>
              <input id="nid" inputMode="numeric" dir="ltr" maxLength={10} className="input text-left tabular-nums" placeholder="1xxxxxxxxx" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value.replace(/\D/g, "") })} />
            </div>
            <div>
              <label className="label" htmlFor="ph"><span className="inline-flex items-center gap-1"><Phone size={12} /> جوال ولي الأمر</span></label>
              <input id="ph" inputMode="tel" dir="ltr" className="input text-left tabular-nums" placeholder="05xxxxxxxx" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="cl"><span className="inline-flex items-center gap-1"><School size={12} /> الفصل / الشعبة <span className="text-red-500">*</span></span></label>
              <select id="cl" required className="input font-bold" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
                <option value="">— اختر الفصل —</option>
                {classOptions}
              </select>
              {editTarget && <p className="mt-1 text-[0.62rem] font-semibold text-amber-700">تغيير الفصل هنا = نقل الطالب بين الشعب</p>}
            </div>
            <div>
              <label className="label" htmlFor="gd">الجنس</label>
              <select id="gd" className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option>ذكر</option><option>أنثى</option>
              </select>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => { setAddOpen(false); setEditTarget(null); }}>إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
              {editTarget ? "حفظ التعديلات" : "إضافة الطالب"}
            </button>
          </div>
        </form>
      )}

      {/* ===== نافذة الاستيراد ===== */}
      {importOpen && modalWrap(
        <div>
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-black text-[#0a4630]"><FileSpreadsheet size={18} /> استيراد كشوف الطلاب</h3>
            <button onClick={() => setImportOpen(false)} className="rounded-lg p-1.5 text-[#8a968d] hover:bg-[#f4f5f0]"><X size={18} /></button>
          </div>

          {/* التبويبات */}
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-[#eef1ec] p-1">
            <button onClick={() => setImportTab("paste")}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-[0.78rem] font-extrabold transition ${importTab === "paste" ? "bg-white text-[#0a4630] shadow" : "text-[#5c6f65]"}`}>
              <ClipboardPaste size={16} /> لصق من نظام نور
            </button>
            <button onClick={() => setImportTab("file")}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-[0.78rem] font-extrabold transition ${importTab === "file" ? "bg-white text-[#0a4630] shadow" : "text-[#5c6f65]"}`}>
              <Upload size={16} /> رفع ملف Excel / CSV
            </button>
          </div>

          {importTab === "paste" ? (
            <div className="mt-3">
              <label className="label">الصق كشف الأسماء كما هو من نور أو Excel (الأعمدة تُكتشف تلقائياً)</label>
              <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={5}
                className="input font-mono text-[0.72rem] leading-relaxed" dir="rtl"
                placeholder={"م\tالسجل المدني\tاسم الطالب\n1\t1100456781\tمحمد عبدالله الشمري\n2\t1100456782\tفهد سعد العتيبي"} />
              <button className="btn btn-ghost mt-2" onClick={onPasteAnalyze} disabled={!pasteText.trim()}><Search size={15} /> تحليل البيانات</button>
            </div>
          ) : (
            <div className="mt-3">
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
              <button onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#cfd4cb] bg-[#fbfbf8] px-4 py-7 text-center transition hover:border-[#0e5c3a] hover:bg-emerald-50/40">
                <Upload size={30} className="text-[#0e5c3a]" />
                <span className="text-[0.85rem] font-extrabold text-[#22332a]">{fileName || "اختر ملف .xlsx أو .csv"}</span>
                <span className="text-[0.65rem] font-semibold text-[#8a968d]">يدعم كشوف الأسماء المصدّرة من نظام نور وملفات Excel</span>
              </button>
            </div>
          )}

          {/* معاينة + ضبط الأعمدة */}
          {parsed.length > 0 && (
            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[0.78rem] font-black text-emerald-800">
                  <CheckCircle2 size={15} /> تم اكتشاف {parsed.length} طالباً
                </span>
                <div className="flex items-center gap-2 text-[0.68rem] font-bold">
                  <label className="text-[#5c6f65]">عمود الاسم
                    <select className="input !mt-1 !w-auto !py-1 text-[0.7rem]" value={nameCol} onChange={(e) => updateColumnChoice(Number(e.target.value), idCol)}>
                      {rawRows[0]?.map((_, i) => <option key={i} value={i}>العمود {i + 1}</option>)}
                    </select>
                  </label>
                  <label className="text-[#5c6f65]">عمود الهوية
                    <select className="input !mt-1 !w-auto !py-1 text-[0.7rem]" value={idCol} onChange={(e) => updateColumnChoice(nameCol, Number(e.target.value))}>
                      {rawRows[0]?.map((_, i) => <option key={i} value={i}>العمود {i + 1}</option>)}
                    </select>
                  </label>
                </div>
              </div>
              <div className="mt-2 max-h-40 overflow-auto rounded-xl border border-emerald-100 bg-white">
                <table className="w-full text-[0.68rem]">
                  <thead className="sticky top-0 bg-[#eef6f0]"><tr><th className="px-2 py-1.5 text-right">#</th><th className="px-2 py-1.5 text-right">الاسم</th><th className="px-2 py-1.5 text-right">الهوية</th></tr></thead>
                  <tbody>{parsed.slice(0, 8).map((r, i) => (
                    <tr key={i} className="border-t border-[#eef0ea]"><td className="px-2 py-1 tabular-nums">{i + 1}</td><td className="px-2 py-1 font-bold">{r.fullName}</td><td className="px-2 py-1 tabular-nums" dir="ltr">{r.nationalId || "—"}</td></tr>
                  ))}</tbody>
                </table>
                {parsed.length > 8 && <div className="border-t bg-[#fbfbf8] px-2 py-1 text-center text-[0.62rem] font-bold text-[#8a968d]">…و {parsed.length - 8} طالباً إضافياً</div>}
              </div>
            </div>
          )}

          {importResult && (
            <div className="mt-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-[0.78rem] font-extrabold text-emerald-900">
              <CheckCircle2 size={16} className="mb-1" /> اكتمل الاستيراد: أُضيف <b>{importResult.inserted}</b> طالباً{importResult.skipped > 0 && <> · تم تخطي <b>{importResult.skipped}</b> (مكرر أو بيانات ناقصة)</>}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <IdCard size={16} className="text-[#5c6f65]" />
              <select className="input !w-auto font-bold" value={importClassId} onChange={(e) => setImportClassId(e.target.value)}>
                <option value="">— إلى أي فصل؟ —</option>
                {classOptions}
              </select>
            </div>
            <button className="btn btn-primary" disabled={!importClassId || parsed.length === 0 || importing} onClick={doImport}>
              {importing ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
              استيراد {parsed.length > 0 ? `(${parsed.length})` : ""}
            </button>
          </div>
          {parsed.length > 0 && <p className="mt-2 flex items-center gap-1 text-[0.62rem] font-semibold text-amber-800"><AlertCircle size={12} /> الأرقام الوطنية المكررة تُستثنى تلقائياً حفاظاً على سلامة كشوف نور.</p>}
        </div>,
        true
      )}

      {/* ===== تأكيد الحذف ===== */}
      {deleteTarget && modalWrap(
        <div className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-50"><Trash2 size={30} className="text-red-500" /></div>
          <h3 className="mt-3 text-lg font-black text-[#0a4630]">حذف الطالب نهائياً؟</h3>
          <p className="mt-1 text-[0.82rem] font-semibold text-[#5c6f65]">سيُحذف <b>{deleteTarget.full_name}</b> مع جميع درجاته المرصودة. لا يمكن التراجع.</p>
          <div className="mt-4 flex justify-center gap-2">
            <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>تراجع</button>
            <button className="btn btn-danger" onClick={confirmDelete}><Trash2 size={16} /> حذف نهائياً</button>
          </div>
        </div>
      )}
    </div>
  );
}
