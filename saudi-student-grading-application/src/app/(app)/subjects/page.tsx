"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LibraryBig, Plus, Trash2, X, Loader2, CheckCircle2, Eye, EyeOff, Save,
  GripVertical, Calculator, BookOpenCheck, FlaskConical, Pencil, Info,
} from "lucide-react";
import { toast } from "@/components/AppShell";

type Component = {
  id: number; name: string; category: "formative" | "final" | "custom";
  maxScore: number; weightLabel: string; isActive: boolean; sortOrder: number;
};
type Subject = {
  id: number; name: string; max_total: string | number; pass_score: string | number;
  color: string; is_active: boolean; components: Component[];
};

const CATEGORY_META = {
  formative: { label: "أعمال السنة", hint: "يُفترض أن يكون مجموعها 60", tone: "bg-teal-50 text-teal-800 ring-teal-200" },
  final: { label: "الاختبار النهائي", hint: "يُفترض أن يكون مجموعها 40", tone: "bg-indigo-50 text-indigo-800 ring-indigo-200" },
  custom: { label: "خانة مخصصة", hint: "خانة إضافية مرنة", tone: "bg-amber-50 text-amber-800 ring-amber-200" },
} as const;

const PALETTE = ["#0e5c3a", "#0f766e", "#1d4ed8", "#be123d", "#8a5a00", "#4338ca", "#0369a1", "#a21caf"];

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingDist, setSavingDist] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [withDefaults, setWithDefaults] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const load = async () => {
    const r = await fetch("/api/subjects", { cache: "no-store" });
    const d = await r.json();
    if (d.ok) {
      const list: Subject[] = d.subjects.map((s: Subject) => ({
        ...s,
        components: (s.components ?? []).map((c) => ({ ...c, maxScore: Number(c.maxScore), isActive: Boolean(c.isActive) })),
      }));
      setSubjects(list);
      if (list.length && (selectedId === null || !list.find((s) => s.id === selectedId))) {
        setSelectedId(list[0].id);
      }
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

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
      { id: 0, name: category === "final" ? "خانة نهائية جديدة" : category === "custom" ? "خانة مخصصة جديدة" : "خانة أعمال سنة جديدة",
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
    if (!selected) return { formative: 0, final: 0, custom: 0, total: 0 };
    let formative = 0, final = 0, custom = 0;
    for (const c of selected.components) {
      if (!c.isActive) continue;
      if (c.category === "formative") formative += Number(c.maxScore) || 0;
      else if (c.category === "final") final += Number(c.maxScore) || 0;
      else custom += Number(c.maxScore) || 0;
    }
    return { formative, final, custom, total: formative + final + custom };
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

            {/* ملخص المطابقة مع اللائحة */}
            <div className="grid gap-2 border-b border-[#eef0ea] bg-white px-5 py-3 sm:grid-cols-3">
              {([
                { label: "أعمال السنة", value: sums.formative, target: 60 },
                { label: "الاختبار النهائي", value: sums.final, target: 40 },
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

            {/* جدول الخانات */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-[0.8rem]">
                <thead>
                  <tr className="bg-[#f4f5f0] text-[#3c4f44]">
                    <th className="w-10 px-2 py-2"></th>
                    <th className="px-3 py-2 text-right text-[0.7rem] font-extrabold">الخانة</th>
                    <th className="px-3 py-2 text-right text-[0.7rem] font-extrabold">التصنيف</th>
                    <th className="px-3 py-2 text-right text-[0.7rem] font-extrabold">ملاحظة</th>
                    <th className="px-3 py-2 text-center text-[0.7rem] font-extrabold">العظمى</th>
                    <th className="px-3 py-2 text-center text-[0.7rem] font-extrabold">الحالة</th>
                    <th className="w-12 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef0ea]">
                  {selected.components.map((c, idx) => (
                    <tr key={idx} className={`transition ${c.isActive ? "" : "bg-[#fafaf8] opacity-60"}`}>
                      <td className="px-2 text-center text-[#cfd4cb]"><GripVertical size={15} className="mx-auto" /></td>
                      <td className="px-3 py-1.5">
                        <input className="input !border-transparent !bg-transparent !py-1.5 font-extrabold hover:!border-[#dfe2da] focus:!border-[#0e5c3a]"
                          value={c.name} onChange={(e) => updateComponent(idx, { name: e.target.value })} aria-label="اسم الخانة" />
                      </td>
                      <td className="px-3 py-1.5">
                        <select className={`chip !cursor-pointer border-0 outline-none ring-1 ${CATEGORY_META[c.category].tone}`}
                          value={c.category} onChange={(e) => updateComponent(idx, { category: e.target.value as Component["category"] })}>
                          <option value="formative">أعمال السنة</option>
                          <option value="final">الاختبار النهائي</option>
                          <option value="custom">مخصصة</option>
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <input className="input !border-transparent !bg-transparent !py-1.5 text-[0.72rem] hover:!border-[#dfe2da] focus:!border-[#0e5c3a]"
                          placeholder="تحريري / شفهي…" value={c.weightLabel} onChange={(e) => updateComponent(idx, { weightLabel: e.target.value })} />
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <input type="number" min={0} max={1000} step={0.5}
                          className="input mx-auto !w-20 !border-[#dfe2da] !py-1.5 text-center font-black tabular-nums"
                          value={c.maxScore} onChange={(e) => updateComponent(idx, { maxScore: Number(e.target.value) })} />
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <button onClick={() => updateComponent(idx, { isActive: !c.isActive })}
                          className={`relative h-6 w-11 rounded-full transition ${c.isActive ? "bg-emerald-600" : "bg-[#d8dbd2]"}`}
                          title={c.isActive ? "الخانة مفتوحة — اضغط للإغلاق" : "الخانة مغلقة — اضغط للفتح"} aria-pressed={c.isActive}>
                          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${c.isActive ? "right-0.5" : "right-[22px]"}`} />
                        </button>
                      </td>
                      <td className="px-2 text-center">
                        <button onClick={() => removeComponent(idx)} className="grid h-8 w-8 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                  {selected.components.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-sm font-bold text-[#8a968d]">لا توجد خانات — أضف خانات من الأزرار بالأسفل</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* أزرار الإضافة والحفظ */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eef0ea] bg-[#fbfbf8] px-5 py-3">
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => addComponent("formative")} className="btn btn-ghost !py-1.5 text-[0.7rem]"><Plus size={14} /> خانة أعمال سنة</button>
                <button onClick={() => addComponent("final")} className="btn btn-ghost !py-1.5 text-[0.7rem]"><Plus size={14} /> خانة نهائية</button>
                <button onClick={() => addComponent("custom")} className="btn btn-ghost !py-1.5 text-[0.7rem]"><Plus size={14} /> خانة مخصصة</button>
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
                <span className="block text-[0.62rem] font-semibold text-[#8a968d]">مهام أدائية 20 + مشاركة 15 + واجبات 10 + اختبار قصير 15 (أعمال السنة 60) + نهائي تحريري 30 + عملي/شفهي 10 (النهائي 40)</span>
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
