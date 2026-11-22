"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LibraryBig, Plus, Trash2, X, Loader2, CheckCircle2, Eye, EyeOff, Save,
  GripVertical, Calculator, BookOpenCheck, FlaskConical, Pencil, Info, GraduationCap,
} from "lucide-react";
import { toast } from "@/components/AppShell";

type Component = {
  id: number; name: string; category: "performance" | "written";
  maxScore: number; weightLabel: string; isActive: boolean; sortOrder: number;
};
type Subject = {
  id: number; name: string; max_total: string | number; pass_score: string | number;
  color: string; is_active: boolean; components: Component[]; grade_labels?: string[];
};
type ClassItem = { id: number; name: string; grade_label: string; stage: string };

const CATEGORY_META = {
  performance: { label: "المهام الأدائية", hint: "مجموعها 40 درجة", target: 40, tone: "bg-teal-50 text-teal-800 ring-teal-200", bar: "#0f766e" },
  written: { label: "التقويمات التحريرية", hint: "مجموعها 60 درجة", target: 60, tone: "bg-indigo-50 text-indigo-800 ring-indigo-200", bar: "#3730a3" },
} as const;

const PALETTE = ["#0e5c3a", "#0f766e", "#1d4ed8", "#be123d", "#8a5a00", "#4338ca", "#0369a1", "#a21caf"];

/** صف خانة واحدة في محرر التوزيع — مشترك بين المجموعتين */
function ComponentRow({ c, idx, onChange, onRemove }: {
  c: Component;
  idx: number;
  onChange: (idx: number, patch: Partial<Component>) => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <tr className={`transition ${c.isActive ? "" : "bg-[#fafaf8] opacity-60"}`}>
      <td className="px-2 text-center text-[#cfd4cb]"><GripVertical size={15} className="mx-auto" /></td>
      <td className="px-3 py-1.5">
        <input className="input !border-transparent !bg-transparent !py-1.5 font-extrabold hover:!border-[#dfe2da] focus:!border-[#0e5c3a]"
          value={c.name} onChange={(e) => onChange(idx, { name: e.target.value })} aria-label="اسم الخانة" />
      </td>
      <td className="px-3 py-1.5">
        <select className={`chip !cursor-pointer border-0 outline-none ring-1 ${CATEGORY_META[c.category].tone}`}
          value={c.category} onChange={(e) => onChange(idx, { category: e.target.value as Component["category"] })}>
          <option value="performance">المهام الأدائية</option>
          <option value="written">التقويمات التحريرية</option>
        </select>
      </td>
      <td className="px-3 py-1.5">
        <input className="input !border-transparent !bg-transparent !py-1.5 text-[0.72rem] hover:!border-[#dfe2da] focus:!border-[#0e5c3a]"
          placeholder="أداء عملي / شفهي…" value={c.weightLabel} onChange={(e) => onChange(idx, { weightLabel: e.target.value })} />
      </td>
      <td className="px-3 py-1.5 text-center">
        <input type="number" min={0} max={1000} step={0.5}
          className="input mx-auto !w-20 !border-[#dfe2da] !py-1.5 text-center font-black tabular-nums"
          value={c.maxScore} onChange={(e) => onChange(idx, { maxScore: Number(e.target.value) })} />
      </td>
      <td className="px-3 py-1.5 text-center">
        <button onClick={() => onChange(idx, { isActive: !c.isActive })}
          className={`relative h-6 w-11 rounded-full transition ${c.isActive ? "bg-emerald-600" : "bg-[#d8dbd2]"}`}
          title={c.isActive ? "الخانة مفتوحة — اضغط للإغلاق" : "الخانة مغلقة — اضغط للفتح"} aria-pressed={c.isActive}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${c.isActive ? "right-0.5" : "right-[22px]"}`} />
        </button>
      </td>
      <td className="px-2 text-center">
        <button onClick={() => onRemove(idx)} className="grid h-8 w-8 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"><Trash2 size={16} /></button>
      </td>
    </tr>
  );
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classMeta, setClassMeta] = useState<ClassItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingDist, setSavingDist] = useState(false);
  const [savingLinks, setSavingLinks] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [withDefaults, setWithDefaults] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const loadClasses = async () => {
    const r = await fetch("/api/classes", { cache: "no-store" });
    const d = await r.json();
    if (d.ok) setClassMeta(d.classes);
  };

  const load = async () => {
    const r = await fetch("/api/subjects", { cache: "no-store" });
    const d = await r.json();
    if (d.ok) {
      const list: Subject[] = d.subjects.map((s: Subject) => ({
        ...s,
        components: (s.components ?? []).map((c) => ({ ...c, maxScore: Number(c.maxScore), isActive: Boolean(c.isActive) })),
        grade_labels: s.grade_labels ?? [],
      }));
      setSubjects(list);
      if (list.length && (selectedId === null || !list.find((s) => s.id === selectedId))) {
        setSelectedId(list[0].id);
      }
    }
    setLoading(false);
  };
  useEffect(() => { load(); loadClasses(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const allGradeLabels = useMemo(
    () => [...new Set(classMeta.map((c) => c.grade_label))],
    [classMeta]
  );

  const setLinks = async (subject: Subject, gradeLabels: string[]) => {
    setSavingLinks(true);
    // تحديث تفاؤلي
    setSubjects((prev) => prev.map((s) => (s.id === subject.id ? { ...s, grade_labels: gradeLabels } : s)));
    const r = await fetch(`/api/subjects/${subject.id}/links`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gradeLabels }),
    });
    const d = await r.json();
    setSavingLinks(false);
    if (!d.ok) {
      toast("تعذر حفظ الربط", "error");
      load();
    }
  };

  const toggleLink = (subject: Subject, label: string) => {
    const current = new Set(subject.grade_labels ?? []);
    if (current.has(label)) current.delete(label); else current.add(label);
    setLinks(subject, [...current]);
  };

  const selected = subjects.find((s) => s.id === selectedId) ?? null;

  const updateComponent = (idx: number, patch: Partial<Component>) => {
    if (!selected) return;
    const components = selected.components.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    setSubjects(subjects.map((s) => (s.id === selected.id ? { ...s, components } : s)));
  };

  const addComponent = (category: Component["category"]) => {
    if (!selected) return;
    const components = [
      ...selected.components,
      { id: 0, name: category === "performance" ? "مهمة أدائية جديدة" : "تقويم تحريري جديد",
        category, maxScore: 10, weightLabel: "", isActive: true, sortOrder: selected.components.length + 1 },
    ];
    setSubjects(subjects.map((s) => (s.id === selected.id ? { ...s, components } : s)));
  };

  const removeComponent = (idx: number) => {
    if (!selected) return;
    const components = selected.components.filter((_, i) => i !== idx);
    setSubjects(subjects.map((s) => (s.id === selected.id ? { ...s, components } : s)));
  };

  const sums = useMemo(() => {
    if (!selected) return { performance: 0, written: 0, total: 0 };
    let performance = 0, written = 0;
    for (const c of selected.components) {
      if (!c.isActive) continue;
      if (c.category === "performance") performance += Number(c.maxScore) || 0;
      else written += Number(c.maxScore) || 0;
    }
    return { performance, written, total: performance + written };
  }, [selected]);

  const saveDistribution = async () => {
    if (!selected) return;
    setSavingDist(true);
    const r = await fetch(`/api/subjects/${selected.id}/components`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ components: selected.components }),
    });
    const d = await r.json();
    setSavingDist(false);
    if (d.ok) {
      toast(`حُفظ التوزيع — العظمى الكلية ${d.maxTotal} درجة`);
      load();
    } else toast(d.error ?? "تعذر الحفظ", "error");
  };

  const addSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch("/api/subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, color: newColor, withDefaults }),
    });
    const d = await r.json();
    if (d.ok) {
      toast("أُضيفت المادة بتوزيع لائحي افتراضي");
      setAddOpen(false);
      setNewName("");
      setSelectedId(d.id);
      load();
    } else toast(d.error ?? "تعذر الإضافة", "error");
  };

  const patchSubject = async (patch: Record<string, unknown>) => {
    if (!selected) return;
    await fetch(`/api/subjects/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const r = await fetch(`/api/subjects/${deleteTarget.id}`, { method: "DELETE" });
    const d = await r.json();
    if (d.ok) { toast("حُذفت المادة وجميع درجاتها"); setDeleteTarget(null); setSelectedId(null); load(); }
    else toast(d.error ?? "تعذر الحذف", "error");
  };

  const progress = (value: number, target: number) => Math.min(100, (value / target) * 100);
  const sumTone = (value: number, target: number) => value === target ? "text-emerald-700" : value > target ? "text-red-600" : "text-amber-700";

  return (
    <div className="grid gap-4 xl:grid-cols-12">
      {/* ===== قائمة المواد ===== */}
      <div className="space-y-3 xl:col-span-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-[#0a4630]"><LibraryBig className="text-[#c9a24b]" /> المواد الدراسية</h2>
            <p className="text-[0.7rem] font-semibold text-[#5c6f65]">{subjects.length} مادة — لكل مادة توزيع مستقل</p>
          </div>
          <button className="btn btn-primary !px-3" onClick={() => setAddOpen(true)}><Plus size={17} /> مادة</button>
        </div>

        {loading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="shimmer h-20 rounded-2xl" />) : (
          <div className="max-h-[68vh] space-y-2 overflow-y-auto pl-1">
            {subjects.map((s) => {
              const active = s.id === selectedId;
              const activeCount = s.components.filter((c) => c.isActive).length;
              return (
                <button key={s.id} onClick={() => setSelectedId(s.id)}
                  className={`group flex w-full items-center gap-3 rounded-2xl border p-3 text-right transition-all ${
                    active ? "border-[#0e5c3a] bg-white shadow-lg ring-2 ring-[#0e5c3a]/25" : "border-[#e6e7e0] bg-white hover:shadow-md"
                  } ${!s.is_active ? "opacity-55" : ""}`}>
                  <span className="h-12 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.88rem] font-black text-[#22332a]">{s.name}</span>
                    <span className="mt-0.5 block text-[0.62rem] font-bold text-[#8a968d]">
                      {activeCount} خانة مفعّلة · العظمى {Number(s.max_total)}
                      {!s.is_active && " · موقوفة"}
                    </span>
                    <span className={`mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.58rem] font-bold ${(s.grade_labels?.length ?? 0) === 0 ? "bg-amber-50 text-amber-800 ring-1 ring-amber-300" : "bg-emerald-50 text-emerald-800"}`}>
                      {(s.grade_labels?.length ?? 0) === 0 ? "غير مرتبطة بأي صف!" : `تظهر في ${s.grade_labels!.length} صف/مرحلة`}
                    </span>
                  </span>
                  {active && <span className="h-2.5 w-2.5 rounded-full bg-[#0e5c3a]" />}
                </button>
              );
            })}
            {subjects.length === 0 && <p className="card p-6 text-center text-sm text-[#8a968d]">لا توجد مواد — أضف أول مادة</p>}
          </div>
        )}
      </div>

      {/* ===== محرر التوزيع ===== */}
      <div className="xl:col-span-8">
        {selected ? (
          <div className="card overflow-hidden">
            {/* رأس المادة */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef0ea] bg-[#fbfbf8] px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl text-white shadow" style={{ background: selected.color }}>
                  <BookOpenCheck size={22} />
                </span>
                <div>
                  {editingName ? (
                    <form onSubmit={(e) => { e.preventDefault(); setEditingName(false); patchSubject({ name: nameDraft }); }} className="flex items-center gap-1">
                      <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className="input !w-48 !py-1.5 font-black" />
                      <button className="btn btn-primary !px-2 !py-1.5"><CheckCircle2 size={15} /></button>
                    </form>
                  ) : (
                    <button className="group flex items-center gap-2 text-lg font-black text-[#0a4630]" onClick={() => { setNameDraft(selected.name); setEditingName(true); }}>
                      {selected.name} <Pencil size={13} className="text-[#a3ada5] opacity-0 transition group-hover:opacity-100" />
                    </button>
                  )}
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[0.62rem] font-bold text-[#8a968d]">
                    <span>درجة النجاح: <b className="text-[#0a4630]">{Number(selected.pass_score)}</b></span>
                    <span>·</span>
                    <span>العظمى الكلية: <b className="text-[#0a4630]">{sums.total}</b></span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <label className="flex items-center gap-1.5 rounded-xl border border-[#e3e4dd] bg-white px-2.5 py-1.5 text-[0.65rem] font-extrabold text-[#3c4f44]">
                  درجة النجاح
                  <input type="number" min={0} className="w-12 bg-transparent text-center font-black outline-none" defaultValue={Number(selected.pass_score)}
                    onBlur={(e) => patchSubject({ passScore: Number(e.target.value) })} />
                </label>
                <button title={selected.is_active ? "إيقاف المادة (إخفاء من الرصد)" : "تفعيل المادة"}
                  onClick={() => patchSubject({ isActive: !selected.is_active })}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-[#e3e4dd] bg-white text-[#3c4f44] transition hover:shadow">
                  {selected.is_active ? <Eye size={17} /> : <EyeOff size={17} />}
                </button>
                <button title="حذف المادة" onClick={() => setDeleteTarget(selected)} className="grid h-9 w-9 place-items-center rounded-xl border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100">
                  <Trash2 size={17} />
                </button>
              </div>
            </div>

            {/* ربط المادة بالصفوف — تظهر فقط في الصفوف المحددة */}
            <div className="border-b border-[#eef0ea] bg-white px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="flex items-center gap-2 text-[0.72rem] font-black text-[#0a4630]">
                    <GraduationCap size={14} className="text-[#c9a24b]" /> الصفوف التي تظهر فيها المادة
                    {savingLinks && <Loader2 size={12} className="animate-spin text-[#5c6f65]" />}
                  </span>
                  <span className="mt-0.5 block text-[0.58rem] font-semibold text-[#8a968d]">فعّل الصفوف المطلوبة — المادة لن تظهر في غيرها (الرصد والتقارير والتصدير)</span>
                </div>
                <div className="flex gap-1.5">
                  <button className="btn btn-ghost !px-2.5 !py-1 text-[0.62rem]" onClick={() => setLinks(selected, [...allGradeLabels])}>ربط الكل</button>
                  <button className="btn btn-ghost !px-2.5 !py-1 text-[0.62rem]" onClick={() => setLinks(selected, [])}>إلغاء الكل</button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {allGradeLabels.length === 0 && (
                  <span className="text-[0.68rem] font-bold text-[#8a968d]">لا توجد فصول بعد — أضف فصلاً من صفحة الفصول ليظهر هنا</span>
                )}
                {allGradeLabels.map((label) => {
                  const linked = (selected.grade_labels ?? []).includes(label);
                  return (
                    <button key={label} onClick={() => toggleLink(selected, label)}
                      aria-pressed={linked}
                      className={`rounded-xl border px-3 py-1.5 text-[0.68rem] font-extrabold transition-all ${
                        linked
                          ? "border-[#0e5c3a] bg-[#0e5c3a] text-[#e7cf9a] shadow-md"
                          : "border-[#dfe2da] bg-[#fbfbf8] text-[#5c6f65] hover:border-[#0e5c3a]/50"
                      }`}>
                      {linked ? "✓ " : ""}{label}
                    </button>
                  );
                })}
              </div>
              {(selected.grade_labels ?? []).length === 0 && (
                <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[0.62rem] font-bold text-amber-800">
                  <Info size={12} /> هذه المادة غير مرتبطة بأي صف — لن تظهر في الرصد ولا في التقارير حتى تربطها بصف واحد على الأقل.
                </div>
              )}
            </div>

            {/* ملخص المطابقة مع اللائحة */}
            <div className="grid gap-2 border-b border-[#eef0ea] bg-white px-5 py-3 sm:grid-cols-3">
              {([
                { label: "المهام الأدائية", value: sums.performance, target: 40 },
                { label: "التقويمات التحريرية", value: sums.written, target: 60 },
                { label: "المجموع الكلي", value: sums.total, target: 100 },
              ]).map((row) => (
                <div key={row.label} className="rounded-2xl border border-[#eef0ea] bg-[#fbfbf8] p-2.5">
                  <div className="flex items-center justify-between text-[0.68rem] font-extrabold">
                    <span className="text-[#5c6f65]">{row.label}</span>
                    <span className={`tabular-nums ${sumTone(row.value, row.target)}`}>{row.value} / {row.target}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#e8eae3]">
                    <div className={`h-full rounded-full transition-all duration-500 ${row.value === row.target ? "bg-emerald-500" : row.value > row.target ? "bg-red-500" : "bg-amber-400"}`}
                      style={{ width: `${progress(row.value, row.target)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* جدول الخانات — مقسّم إلى مجموعتين */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-[0.8rem]">
                <thead>
                  <tr className="bg-[#f4f5f0] text-[#3c4f44]">
                    <th className="w-10 px-2 py-2"></th>
                    <th className="px-3 py-2 text-right text-[0.7rem] font-extrabold">الخانة</th>
                    <th className="px-3 py-2 text-right text-[0.7rem] font-extrabold">المجموعة</th>
                    <th className="px-3 py-2 text-right text-[0.7rem] font-extrabold">ملاحظة</th>
                    <th className="px-3 py-2 text-center text-[0.7rem] font-extrabold">العظمى</th>
                    <th className="px-3 py-2 text-center text-[0.7rem] font-extrabold">الحالة</th>
                    <th className="w-12 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef0ea]">
                  {/* ===== المهام الأدائية (مجموعها 40) ===== */}
                  <tr className="bg-teal-50/70">
                    <td colSpan={7} className="px-3 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[0.72rem] font-black text-teal-900">المهام الأدائية — مجموع {sums.performance} / 40</span>
                        <button onClick={() => addComponent("performance")} className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-2.5 py-1 text-[0.62rem] font-extrabold text-white transition hover:bg-teal-800">
                          <Plus size={12} /> خانة أدائية
                        </button>
                      </div>
                    </td>
                  </tr>
                  {selected.components.map((c, idx) => c.category !== "performance" ? null : (
                    <ComponentRow key={`p-${idx}`} c={c} idx={idx} onChange={updateComponent} onRemove={removeComponent} />
                  ))}
                  {selected.components.every((c) => c.category !== "performance") && (
                    <tr><td colSpan={7} className="px-4 py-3 text-center text-[0.68rem] font-bold text-teal-700">لا توجد خانات أدائية — أضف أول خانة من الزر أعلاه</td></tr>
                  )}
                  {/* ===== التقويمات التحريرية (مجموعها 60) ===== */}
                  <tr className="bg-indigo-50/70">
                    <td colSpan={7} className="px-3 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[0.72rem] font-black text-indigo-900">التقويمات التحريرية — مجموع {sums.written} / 60</span>
                        <button onClick={() => addComponent("written")} className="inline-flex items-center gap-1 rounded-lg bg-indigo-800 px-2.5 py-1 text-[0.62rem] font-extrabold text-white transition hover:bg-indigo-900">
                          <Plus size={12} /> خانة تحريرية
                        </button>
                      </div>
                    </td>
                  </tr>
                  {selected.components.map((c, idx) => c.category !== "written" ? null : (
                    <ComponentRow key={`w-${idx}`} c={c} idx={idx} onChange={updateComponent} onRemove={removeComponent} />
                  ))}
                  {selected.components.every((c) => c.category !== "written") && (
                    <tr><td colSpan={7} className="px-4 py-3 text-center text-[0.68rem] font-bold text-indigo-700">لا توجد خانات تحريرية — أضف أول خانة من الزر أعلاه</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* حفظ التوزيع */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eef0ea] bg-[#fbfbf8] px-5 py-3">
              <div className="flex items-center gap-2 text-[0.7rem] font-extrabold text-[#5c6f65]">
                <Info size={14} /> أضف عدة خانات تحت كل مجموعة — المجموع النهائي يجب أن يكون 100
              </div>
              <button onClick={saveDistribution} disabled={savingDist} className="btn btn-primary">
                {savingDist ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} حفظ التوزيع
              </button>
            </div>
            <p className="flex items-start gap-1.5 border-t border-[#eef0ea] px-5 py-2 text-[0.62rem] font-semibold text-[#8a968d]">
              <Info size={13} className="mt-0.5 shrink-0" />
              إغلاق الخانة يستبعدها من الرصد والطباعة وتصدير نور دون حذف درجاتها — العظمى الكلية تُحدَّث تلقائياً من مجموع الخانات المفتوحة.
            </p>
          </div>
        ) : (
          <div className="card grid h-full min-h-[420px] place-items-center p-10 text-center">
            <div>
              <Calculator size={44} className="mx-auto text-[#cfd4cb]" />
              <p className="mt-3 font-bold text-[#8a968d]">اختر مادة من القائمة لضبط توزيع درجاتها</p>
            </div>
          </div>
        )}
      </div>

      {/* ===== نافذة إضافة مادة ===== */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={() => setAddOpen(false)}>
          <form onSubmit={addSubject} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-black text-[#0a4630]"><FlaskConical size={18} /> مادة جديدة</h3>
              <button type="button" onClick={() => setAddOpen(false)} className="rounded-lg p-1.5 text-[#8a968d] hover:bg-[#f4f5f0]"><X size={18} /></button>
            </div>
            <label className="label mt-4" htmlFor="sn">اسم المادة <span className="text-red-500">*</span></label>
            <input id="sn" required autoFocus className="input" placeholder="مثال: الفيزياء، الكيمياء، الدراسات الإسلامية…" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <label className="label mt-3">لون تمييز المادة</label>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((c) => (
                <button key={c} type="button" onClick={() => setNewColor(c)} aria-label={c}
                  className={`h-8 w-8 rounded-xl transition ${newColor === c ? "ring-2 ring-[#0a4630] ring-offset-2 scale-110" : ""}`}
                  style={{ background: c }} />
              ))}
            </div>
            <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-2xl border border-[#e3e4dd] bg-[#fbfbf8] p-3">
              <input type="checkbox" className="mt-1 accent-[#0e5c3a]" checked={withDefaults} onChange={(e) => setWithDefaults(e.target.checked)} />
              <span className="text-[0.74rem] font-bold text-[#3c4f44]">
                إنشاء التوزيع اللائحي الافتراضي تلقائياً
                <span className="block text-[0.62rem] font-semibold text-[#8a968d]">مهام أدائية 25 + مشاركة وتفاعل 15 (المهام الأدائية 40) + واجبات 10 + اختبارات قصيرة 20 + اختبار نهائي تحريري 30 (التقويمات التحريرية 60)</span>
              </span>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setAddOpen(false)}>إلغاء</button>
              <button type="submit" className="btn btn-primary"><Plus size={16} /> إضافة المادة</button>
            </div>
          </form>
        </div>
      )}

      {/* تأكيد حذف مادة */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-50"><Trash2 size={30} className="text-red-500" /></div>
            <h3 className="mt-3 text-lg font-black text-[#0a4630]">حذف «{deleteTarget.name}»؟</h3>
            <p className="mt-1 text-[0.82rem] font-semibold text-[#5c6f65]">ستُحذف المادة بكل خاناتها وجميع الدرجات المرصودة فيها نهائياً.</p>
            <div className="mt-4 flex justify-center gap-2">
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>تراجع</button>
              <button className="btn btn-danger" onClick={confirmDelete}><Trash2 size={16} /> حذف نهائياً</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
