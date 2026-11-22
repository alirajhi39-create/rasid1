"use client";

import { useEffect, useState } from "react";
import {
  Settings, School, Save, KeyRound, Database, Loader2, CheckCircle2, ShieldCheck,
  Eye, EyeOff, Server, Info, RefreshCw, Archive, Download, Clock, Upload,
} from "lucide-react";
import { toast } from "@/components/AppShell";

type TeacherForm = {
  full_name: string; job_title: string; school_name: string; education_admin: string;
  education_office: string; city: string; principal_name: string;
  academic_year: string; semester: string; stage: string; username?: string;
};

const EMPTY: TeacherForm = {
  full_name: "", job_title: "", school_name: "", education_admin: "", education_office: "",
  city: "", principal_name: "", academic_year: "1447هـ", semester: "الفصل الدراسي الأول", stage: "متوسط",
};

export default function SettingsPage() {
  const [form, setForm] = useState<TeacherForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [health, setHealth] = useState<"checking" | "ok" | "down">("checking");
  const [initBusy, setInitBusy] = useState(false);
  const [initReport, setInitReport] = useState<string>("");
  const [backupStatus, setBackupStatus] = useState<{ last: string | null; count: number } | null>(null);
  const [busyBackup, setBusyBackup] = useState<"" | "export" | "auto" | "restore">("");

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (d.ok && d.teacher) setForm({ ...EMPTY, ...d.teacher });
      setLoading(false);
    });
    fetch("/api/health", { cache: "no-store" }).then((r) => r.json()).then((d) => setHealth(d.ok ? "ok" : "down")).catch(() => setHealth("down"));
  }, []);

  const set = (k: keyof TeacherForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const r = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: form.full_name, jobTitle: form.job_title, schoolName: form.school_name,
        educationAdmin: form.education_admin, educationOffice: form.education_office, city: form.city,
        principalName: form.principal_name, academicYear: form.academic_year,
        semester: form.semester, stage: form.stage,
      }),
    });
    const d = await r.json();
    setSaving(false);
    if (d.ok) toast("حُفظت بيانات المدرسة والعام الدراسي");
    else toast(d.error ?? "تعذر الحفظ", "error");
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next !== pw.confirm) { toast("تأكيد كلمة المرور غير مطابق", "error"); return; }
    setPwBusy(true);
    const r = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current: pw.current, next: pw.next }),
    });
    const d = await r.json();
    setPwBusy(false);
    if (d.ok) { toast("تم تغيير كلمة المرور بنجاح"); setPw({ current: "", next: "", confirm: "" }); }
    else toast(d.error ?? "تعذر التغيير", "error");
  };

  const runInit = async () => {
    setInitBusy(true);
    setInitReport("");
    try {
      const r = await fetch("/api/init-db", { method: "POST" });
      const d = await r.json();
      setInitReport(JSON.stringify(d.report ?? d, null, 2));
      toast(d.ok ? "اكتملت تهيئة قاعدة البيانات" : "تعذرت التهيئة", d.ok ? "success" : "error");
    } catch {
      setInitReport("تعذر الاتصال بالمسار /api/init-db");
      toast("تعذر الاتصال بالخادم", "error");
    }
    setInitBusy(false);
  };

  // ===== النسخ الاحتياطي =====
  const loadBackupStatus = () =>
    fetch("/api/backup/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.ok && setBackupStatus({ last: d.last, count: d.count }))
      .catch(() => {});

  useEffect(() => { loadBackupStatus(); }, []);

  const downloadJson = (text: string, name: string) => {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  const exportBackup = async () => {
    setBusyBackup("export");
    try {
      const r = await fetch("/api/backup", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) { toast(d.error ?? "تعذر التصدير", "error"); return; }
      downloadJson(JSON.stringify(d, null, 2), `rased-backup-${new Date().toISOString().slice(0, 10)}.json`);
      toast("تم تنزيل النسخة الاحتياطية");
    } catch { toast("تعذر التصدير", "error"); }
    setBusyBackup("");
  };

  const downloadAutoBackup = async () => {
    setBusyBackup("auto");
    try {
      const r = await fetch("/api/backup/auto", { cache: "no-store" });
      if (!r.ok) { toast("لا توجد نسخة تلقائية محفوظة بعد", "error"); return; }
      const d = await r.json();
      const at = r.headers.get("X-Backup-At")?.slice(0, 16).replace("T", "-").replace(":", "-") ?? "latest";
      downloadJson(JSON.stringify(d, null, 2), `rased-autobackup-${at}.json`);
      toast("تم تنزيل آخر نسخة تلقائية");
    } catch { toast("تعذر التنزيل", "error"); }
    setBusyBackup("");
  };

  const restoreBackup = async (file: File) => {
    const ok = window.confirm(
      "استعادة نسخة احتياطية ستستبدل كل بياناتك الحالية (الفصول، الطلاب، المواد، الدرجات). هل أنت متأكد؟"
    );
    if (!ok) return;
    setBusyBackup("restore");
    try {
      const text = await file.text();
      const r = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const d = await r.json();
      if (!r.ok) { toast(d.error ?? "فشلت الاستعادة", "error"); return; }
      toast(`تمت الاستعادة: ${d.classes} فصل · ${d.students} طالب · ${d.subjects} مادة · ${d.grades} درجة`);
      loadBackupStatus();
    } catch { toast("تعذرت الاستعادة", "error"); }
    setBusyBackup("");
  };

  const backupDate = backupStatus?.last
    ? new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(new Date(backupStatus.last))
    : null;

  const field = (id: string, label: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, dir?: string) => (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="input font-bold" value={value} onChange={onChange} dir={dir} />
    </div>
  );

  if (loading) return <div className="shimmer h-96 rounded-3xl" />;

  return (
    <div className="grid gap-4 xl:grid-cols-12">
      {/* ===== بيانات المدرسة ===== */}
      <form onSubmit={save} className="card p-5 xl:col-span-7">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-black text-[#0a4630]"><School className="text-[#c9a24b]" /> بيانات المدرسة والعام الدراسي</h2>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} حفظ البيانات
          </button>
        </div>
        <p className="mt-1 text-[0.7rem] font-semibold text-[#8a968d]">تظهر هذه البيانات في ترويسة الكشوف المطبوعة وإشعارات الطلاب</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {field("ft", "اسم المعلم", form.full_name, set("full_name"))}
          {field("jt", "المسمى الوظيفي", form.job_title, set("job_title"))}
          <div className="sm:col-span-2">{field("sn", "اسم المدرسة", form.school_name, set("school_name"))}</div>
          {field("ea", "الإدارة العامة للتعليم", form.education_admin, set("education_admin"))}
          {field("eo", "مكتب التعليم", form.education_office, set("education_office"))}
          {field("ct", "المدينة / المحافظة", form.city, set("city"))}
          {field("pr", "اسم مدير المدرسة", form.principal_name, set("principal_name"))}
          <div>
            <label className="label" htmlFor="ay">العام الدراسي</label>
            <input id="ay" className="input font-bold" value={form.academic_year} onChange={set("academic_year")} />
          </div>
          <div>
            <label className="label" htmlFor="sm">الفصل الدراسي</label>
            <select id="sm" className="input font-bold" value={form.semester} onChange={set("semester")}>
              <option>الفصل الدراسي الأول</option>
              <option>الفصل الدراسي الثاني</option>
            </select>
          </div>
        </div>

        {/* بطاقة الترويسة الحية */}
        <div className="mt-4 rounded-2xl border border-[#e3d9b8] bg-[#fffdf2] p-3">
          <div className="flex items-center gap-1.5 text-[0.62rem] font-black text-[#a8843a]"><Info size={12} /> معاينة الترويسة المطبوعة</div>
          <div className="mt-1.5 text-center leading-relaxed text-[#3c2f0a]">
            <div className="text-[0.75rem] font-black">المملكة العربية السعودية — وزارة التعليم</div>
            <div className="text-[0.65rem] font-bold">{form.education_admin} · {form.education_office}</div>
            <div className="text-[0.8rem] font-black text-[#0a4630]">{form.school_name}</div>
            <div className="text-[0.62rem] font-semibold">{form.academic_year} · {form.semester} · المعلم: {form.full_name} · مدير المدرسة: {form.principal_name}</div>
          </div>
        </div>
      </form>

      <div className="space-y-4 xl:col-span-5">
        {/* ===== تغيير كلمة المرور ===== */}
        <form onSubmit={changePassword} className="card p-5">
          <h2 className="flex items-center gap-2 text-lg font-black text-[#0a4630]"><KeyRound className="text-[#c9a24b]" /> كلمة مرور حسابك</h2>
          <p className="mt-1 text-[0.7rem] font-semibold text-[#8a968d]">خاصة بك أنت فقط — لا يراها أي معلم آخر ولا حتى مدير المنصة، ونحتفظ بها مشفّرة بتشفير scrypt</p>
          <div className="mt-3 space-y-3">
            <div>
              <label className="label" htmlFor="cur">كلمة المرور الحالية</label>
              <div className="relative">
                <input id="cur" type={showPw ? "text" : "password"} required autoComplete="current-password" className="input !pe-10" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} dir="ltr" style={{ textAlign: "left" }} />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 text-[#8a968d] hover:text-[#0a4630]" aria-label="إظهار">
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="new">الجديدة</label>
                <input id="new" type="password" required minLength={6} autoComplete="new-password" className="input" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} dir="ltr" style={{ textAlign: "left" }} />
              </div>
              <div>
                <label className="label" htmlFor="cf">تأكيدها</label>
                <input id="cf" type="password" required autoComplete="new-password" className="input" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} dir="ltr" style={{ textAlign: "left" }} />
              </div>
            </div>
            <button type="submit" disabled={pwBusy} className="btn btn-primary w-full justify-center">
              {pwBusy ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />} تحديث كلمة المرور
            </button>
          </div>
        </form>

        {/* ===== حسابات معلمين آخرين ===== */}
        <div className="card border-[#e3d9b8] bg-gradient-to-br from-[#fffdf2] to-white p-5">
          <h2 className="flex items-center gap-2 text-lg font-black text-[#0a4630]"><Info className="text-[#c9a24b]" /> معلمون آخرون في مدرستك؟</h2>
          <p className="mt-1 text-[0.72rem] leading-relaxed font-semibold text-[#6b5518]">المنصة متعددة الفضاءات: كل معلم ينشئ حسابه بنفسه من صفحة التسجيل، وتحصل مساحته على فصولها وموادها ودرجاتها المعزولة تماماً — بلا مشاركة أي بيانات.</p>
          <a href="/register" className="btn btn-gold mt-3 text-[0.75rem]">صفحة تسجيل معلم جديد <span aria-hidden>←</span></a>
        </div>

        {/* ===== حالة قاعدة البيانات ===== */}
        <div className="card p-5">
          <h2 className="flex items-center gap-2 text-lg font-black text-[#0a4630]"><Database className="text-[#c9a24b]" /> قاعدة البيانات والنشر</h2>
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-[#e6e7e0] bg-[#fbfbf8] p-3">
            <div className="flex items-center gap-2">
              <Server size={18} className="text-[#0e5c3a]" />
              <div>
                <div className="text-[0.75rem] font-extrabold text-[#22332a]">PostgreSQL — متغير <code dir="ltr" className="rounded bg-[#eef1ec] px-1.5 py-0.5 text-[0.62rem]">DATABASE_URL</code></div>
                <div className="text-[0.62rem] font-semibold text-[#8a968d]">متوافق مع Neon عبر Vercel Marketplace — SSL يُفعّل تلقائياً</div>
              </div>
            </div>
            <span className={`chip ring-1 ${health === "ok" ? "bg-emerald-50 text-emerald-800 ring-emerald-300" : health === "down" ? "bg-red-50 text-red-700 ring-red-300" : "bg-amber-50 text-amber-800 ring-amber-300"}`}>
              {health === "ok" ? "متصلة" : health === "down" ? "متعذرة" : "جارٍ الفحص…"}
            </span>
          </div>
          <p className="mt-3 text-[0.7rem] leading-relaxed text-[#5c6f65]">
            عند أول نشر على Vercel، زُر المسار <code dir="ltr" className="rounded bg-[#eef1ec] px-1.5 py-0.5 text-[0.65rem] font-bold">/api/init-db</code> أو سجّل الدخول مباشرة — تُنشأ الجداول والحساب والبيانات الأولية تلقائياً دون أوامر يدوية. التهيئة آمنة ولا تمسح أي بيانات.
          </p>
          <button onClick={runInit} disabled={initBusy} className="btn btn-ghost mt-3 w-full justify-center">
            {initBusy ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />} تشغيل التهيئة الآن
          </button>
          {initReport && (
            <pre dir="ltr" className="mt-2 max-h-36 overflow-auto rounded-xl bg-[#0c1a12] p-3 text-left text-[0.62rem] leading-relaxed text-emerald-300">{initReport}</pre>
          )}
          <ul className="mt-3 space-y-1 text-[0.62rem] font-semibold text-[#8a968d]">
            <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600" /> تشفير scrypt لكلمات المرور + جلسة JWT في httpOnly cookie</li>
            <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600" /> CREATE TABLE IF NOT EXISTS — لا يمس البيانات القائمة</li>
            <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600" /> البيانات التجريبية تُزرع فقط عند قاعدة فارغة تماماً</li>
          </ul>
        </div>

        {/* ===== النسخ الاحتياطي ===== */}
        <div className="card p-5">
          <h2 className="flex items-center gap-2 text-lg font-black text-[#0a4630]"><Archive className="text-[#c9a24b]" /> النسخ الاحتياطي</h2>
          <p className="mt-1 text-[0.7rem] leading-relaxed text-[#5c6f65]">
            صدّر أسماء الطلاب ودرجاتهم وكل مساحتك في ملف واحد، أو احفظ نسخة تلقائية يُحدَّث عند كل تعديل.
          </p>

          <div className="mt-3 rounded-2xl border border-[#e6e7e0] bg-[#fbfbf8] p-3">
            <div className="flex items-center justify-between text-[0.68rem] font-bold">
              <span className="text-[#5c6f65]">آخر نسخة تلقائية محفوظة</span>
              <span className={backupStatus?.last ? "text-emerald-700" : "text-[#a3ada5]"}>
                {backupDate ?? "لا توجد بعد"}
              </span>
            </div>
            {backupStatus?.last && (
              <div className="mt-1 text-[0.62rem] font-semibold text-[#8a968d]">{backupStatus.count} نسخ محفوظة (الأحدث 5)</div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button onClick={exportBackup} disabled={busyBackup !== ""} className="btn btn-primary justify-center">
              {busyBackup === "export" ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
              تنزيل نسخة احتياطية
            </button>
            <button onClick={downloadAutoBackup} disabled={busyBackup !== ""} className="btn btn-ghost justify-center">
              {busyBackup === "auto" ? <Loader2 size={17} className="animate-spin" /> : <Clock size={17} />}
              تنزيل آخر نسخة تلقائية
            </button>
          </div>

          <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#cfd4cb] bg-[#fbfbf8] px-4 py-3 text-[0.78rem] font-extrabold text-[#22332a] transition hover:border-[#0e5c3a] hover:bg-emerald-50/40">
            {busyBackup === "restore" ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
            استعادة من ملف نسخة احتياطية
            <input type="file" accept="application/json,.json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) restoreBackup(f); e.target.value = ""; }} />
          </label>
          <p className="mt-2 flex items-center gap-1 text-[0.6rem] font-semibold text-amber-800">
            <Info size={11} /> الاستعادة تستبدل كل بيانات مساحتك الحالية بمحتوى الملف — نزّل نسخة جديدة قبل أي استعادة.
          </p>
        </div>
      </div>
    </div>
  );
}
