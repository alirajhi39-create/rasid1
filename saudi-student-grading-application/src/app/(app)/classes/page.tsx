"use client";

import { useEffect, useState } from "react";
import {
  School, Plus, Pencil, Trash2, X, Users, GraduationCap, Loader2, CheckCircle2, Link2,
} from "lucide-react";
import { toast } from "@/components/AppShell";

type ClassItem = { id: number; name: string; grade_label: string; stage: string; sort_order: number; student_count: number; subject_count?: number; total_subjects?: number };

const STAGES = ["ابتدائي", "متوسط", "ثانوي"] as const;
const GRADE_SUGGESTIONS: Record<string, string[]> = {
  "ابتدائي": ["الصف الأول الابتدائي", "الصف الثاني الابتدائي", "الصف الثالث الابتدائي", "الصف الرابع الابتدائي", "الصف الخامس الابتدائي", "الصف السادس الابتدائي"],
  "متوسط": ["الصف الأول المتوسط", "الصف الثاني المتوسط", "الصف الثالث المتوسط"],
  "ثانوي": ["الصف الأول الثانوي", "الصف الثاني الثانوي", "الصف الثالث الثانوي (مسارات)"],
};

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ClassItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassItem | null>(null);
  const [form, setForm] = useState({ name: "", gradeLabel: "", stage: "متوسط" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const r = await fetch("/api/classes", { cache: "no-store" });
    const d = await r.json();
    if (d.ok) setClasses(d.classes);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ name: "", gradeLabel: GRADE_SUGGESTIONS["متوسط"][0], stage: "متوسط" });
    setModalOpen(true);
  };
  const openEdit = (c: ClassItem) => {
    setEditTarget(c);
    setForm({ name: c.name, gradeLabel: c.grade_label, stage: c.stage });
    setModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const r = editTarget
      ? await fetch(`/api/classes/${editTarget.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      : await fetch("/api/classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await r.json();
    setSaving(false);
    if (d.ok) {
      toast(editTarget ? "حُدّثت بيانات الفصل" : "أُضيف الفصل — اربط المواد به من بطاقة الفصل");
      setModalOpen(false);
      load();
    } else toast(d.error ?? "تعذر الحفظ", "error");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const r = await fetch(`/api/classes/${deleteTarget.id}`, { method: "DELETE" });
    const d = await r.json();
    if (d.ok) {
      toast(`حُذف الفصل${d.deletedStudents ? ` مع ${d.deletedStudents} طالباً ودرجاتهم` : ""}`);
      setDeleteTarget(null);
      load();
    } else toast(d.error ?? "تعذر الحذف", "error");
  };

  const linkAllSubjects = async (c: ClassItem) => {
    const r = await fetch(`/api/classes/${c.id}/link-subjects`, { method: "POST" });
    const d = await r.json();
    if (d.ok) {
      toast(d.linked > 0 ? `رُبطت ${d.linked} مادة بالفصل «${c.grade_label} — ${c.name}»` : "كل المواد مرتبطة بهذا الفصل بالفعل");
      load();
    } else toast(d.error ?? "تعذر الربط", "error");
  };

  const totalStudents = classes.reduce((a, c) => a + Number(c.student_count), 0);
  const grouped = STAGES.map((stage) => ({ stage, items: classes.filter((c) => c.stage === stage) })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-[#0a4630]"><School className="text-[#c9a24b]" /> الفصول والصفوف</h2>
          <p className="text-[0.72rem] font-semibold text-[#5c6f65]">{classes.length} فصلاً يضم {totalStudents} طالباً — مرتبة حسب المرحلة</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={17} /> فصل جديد</button>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="shimmer h-40 rounded-3xl" />)}</div>
      ) : grouped.map((group) => (
        <section key={group.stage}>
          <div className="mb-2 flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#0a4630] text-[#e7cf9a]"><GraduationCap size={15} /></span>
            <h3 className="text-[0.82rem] font-black text-[#3c4f44]">المرحلة {group.stage}ة</h3>
            <span className="h-px flex-1 bg-[#dfe2da]" />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.items.map((c) => (
              <div key={c.id} className="card group relative overflow-hidden p-4 transition-shadow hover:shadow-lg">
                <div className="absolute left-0 top-0 h-full w-1.5" style={{ background: "linear-gradient(#c9a24b,#8a6a1f)" }} />
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[0.68rem] font-bold text-[#8a968d]">{c.grade_label}</div>
                    <div className="mt-0.5 text-3xl font-black text-[#0a4630]">فصل <span dir="ltr">{c.name}</span></div>
                  </div>
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#eef6f0] text-[#0e5c3a]">
                    <School size={26} />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#eef0ea] pt-3">
                  <div className="flex flex-col gap-1">
                    <span className="inline-flex items-center gap-1.5 text-[0.78rem] font-extrabold text-[#3c4f44]">
                      <Users size={15} className="text-[#0e5c3a]" /> {Number(c.student_count)} طالباً
                    </span>
                    {/* حالة ربط المواد بهذا الصف */}
                    {(c.subject_count ?? 0) < (c.total_subjects ?? 0) ? (
                      <button onClick={() => linkAllSubjects(c)}
                        title="ربط كل المواد النشطة بهذا الصف بنقرة واحدة"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1 text-[0.62rem] font-extrabold text-amber-800 ring-1 ring-amber-300 transition hover:bg-amber-100">
                        <Link2 size={12} /> المواد: {c.subject_count ?? 0} من {c.total_subjects ?? 0} — اربط الكل
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1 text-[0.62rem] font-extrabold text-emerald-800 ring-1 ring-emerald-200">
                        <CheckCircle2 size={12} /> المواد: {c.subject_count ?? 0} — كلها مرتبطة
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => openEdit(c)} className="grid h-8 w-8 place-items-center rounded-lg text-[#0e5c3a] transition hover:bg-emerald-50"><Pencil size={16} /></button>
                    <button onClick={() => setDeleteTarget(c)} className="grid h-8 w-8 place-items-center rounded-lg text-red-600 transition hover:bg-red-50"><Trash2 size={16} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      {!loading && classes.length === 0 && (
        <div className="card p-12 text-center text-[#8a968d]">
          <School size={40} className="mx-auto text-[#cfd4cb]" />
          <p className="mt-2 font-bold">لا توجد فصول بعد — أضف أول فصل للبدء</p>
        </div>
      )}

      {/* نافذة الإضافة/التعديل */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setModalOpen(false)}>
          <form onSubmit={submit} className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-black text-[#0a4630]">{editTarget ? "تعديل الفصل" : "فصل جديد"}</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-[#8a968d] hover:bg-[#f4f5f0]"><X size={18} /></button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="stage">المرحلة</label>
                <select id="stage" className="input font-bold" value={form.stage}
                  onChange={(e) => { const st = e.target.value; setForm({ ...form, stage: st, gradeLabel: GRADE_SUGGESTIONS[st][0] }); }}>
                  {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="name">رمز الشعبة</label>
                <input id="name" required className="input text-center text-lg font-black" placeholder="أ" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="gl">الصف / المرحلة الدراسية</label>
                <input id="gl" required list="grade-suggestions" className="input font-bold" value={form.gradeLabel} onChange={(e) => setForm({ ...form, gradeLabel: e.target.value })} />
                <datalist id="grade-suggestions">
                  {(GRADE_SUGGESTIONS[form.stage] ?? []).map((g) => <option key={g} value={g} />)}
                </datalist>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>إلغاء</button>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />} حفظ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* تأكيد الحذف */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-50"><Trash2 size={30} className="text-red-500" /></div>
            <h3 className="mt-3 text-lg font-black text-[#0a4630]">حذف «{deleteTarget.grade_label} — {deleteTarget.name}»؟</h3>
            <p className="mt-1 text-[0.82rem] font-semibold text-[#5c6f65]">سيُحذف معه <b>{deleteTarget.student_count}</b> طالباً وجميع درجاتهم المرصودة نهائياً.</p>
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
