"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import HeroPanel from "@/components/HeroPanel";
import {
  GraduationCap, UserRound, KeyRound, Eye, EyeOff, Loader2, UserPlus,
  ChevronDown, School, ShieldCheck, BookOpenCheck, Printer,
} from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"account" | "school">("account");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    fullName: "", jobTitle: "", username: "", password: "", confirm: "",
    schoolName: "", educationAdmin: "", educationOffice: "", city: "",
    principalName: "", academicYear: "1447هـ", semester: "الفصل الدراسي الأول", stage: "متوسط",
  });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) { setError("تأكيد كلمة المرور غير مطابق"); return; }
    if (form.password.length < 6) { setError("كلمة المرور يجب ألا تقل عن 6 أحرف"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName, jobTitle: form.jobTitle || "معلم",
          username: form.username, password: form.password,
          schoolName: form.schoolName || undefined,
          educationAdmin: form.educationAdmin || undefined,
          educationOffice: form.educationOffice || undefined,
          city: form.city || undefined,
          principalName: form.principalName || undefined,
          academicYear: form.academicYear, semester: form.semester, stage: form.stage,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setError(data.error ?? "تعذر إنشاء الحساب"); setLoading(false); return; }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخادم");
      setLoading(false);
    }
  };

  const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-[0.88rem] font-bold text-white outline-none transition placeholder:text-emerald-100/30 focus:border-[#c9a24b]/60 focus:bg-white/10 focus:ring-2 focus:ring-[#c9a24b]/25";

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-[#062e1f]">
      {/* العمود البصري */}
      <HeroPanel className="lg:block">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#c9a24b]/50 bg-black/35 px-4 py-1.5 text-[0.72rem] font-extrabold text-[#e7cf9a] backdrop-blur-md">
          <GraduationCap size={13} /> منصة المعلمين — فضاء مستقل لكل معلم
        </div>
        <h2 className="max-w-xl text-3xl font-black leading-[1.4] text-white drop-shadow-lg">
          حسابك الخاص…<br />
          <span className="text-[#e7cf9a]">مدرستك، فصولك، موادك — كلها لك وحدك</span>
        </h2>
        <ul className="mt-4 space-y-2 text-[0.78rem] font-semibold text-emerald-100/85">
          <li className="flex items-center gap-2"><BookOpenCheck size={14} className="text-[#c9a24b]" /> مواد جاهزة بتوزيع لائحي (مهام أدائية 40 + تقويمات تحريرية 60)</li>
          <li className="flex items-center gap-2"><Printer size={14} className="text-[#c9a24b]" /> كشوف مطبوعة بترويسة مدرستك ومديرها</li>
          <li className="flex items-center gap-2"><ShieldCheck size={14} className="text-[#c9a24b]" /> بياناتك لا يراها أي معلم آخر — تشفير كامل</li>
        </ul>
      </HeroPanel>

      {/* نموذج التسجيل */}
      <div className="relative flex flex-1 items-center justify-center px-5 py-8 sm:px-10">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-[#14704a]/25 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#c9a24b]/10 blur-3xl" />
        </div>

        <div className="relative w-full max-w-lg">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#e7cf9a] to-[#c9a24b] shadow-lg">
              <GraduationCap size={26} strokeWidth={2.2} className="text-[#3d2e07]" />
            </div>
            <div>
              <div className="text-2xl font-black leading-none text-white">إنشاء حساب معلم</div>
              <div className="mt-1 text-[0.65rem] font-bold text-emerald-200/80">تعمل فوراً بعد التسجيل — بلا موافقات ولا انتظار</div>
            </div>
          </div>

          <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-[#0c3a26]/80 p-6 shadow-2xl backdrop-blur-xl">
            {/* مؤشر الخطوات */}
            <div className="flex items-center gap-2 text-[0.68rem] font-extrabold">
              <button type="button" onClick={() => setStep("account")}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${step === "account" ? "bg-[#c9a24b] text-[#33260a]" : "bg-white/10 text-emerald-100/80"}`}>
                <span className="grid h-4 w-4 place-items-center rounded-full bg-black/20 text-[0.6rem]">1</span> بيانات الحساب
              </button>
              <span className="text-emerald-200/40">←</span>
              <button type="button" onClick={() => setStep("school")}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${step === "school" ? "bg-[#c9a24b] text-[#33260a]" : "bg-white/10 text-emerald-100/80"}`}>
                <span className="grid h-4 w-4 place-items-center rounded-full bg-black/20 text-[0.6rem]">2</span> بيانات المدرسة
              </button>
            </div>

            {/* الخطوة 1 — الحساب */}
            {step === "account" && (
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-[0.7rem] font-extrabold text-emerald-100/85" htmlFor="fullName">الاسم الرباعي للمعلم <span className="text-[#e7cf9a]">*</span></label>
                    <input id="fullName" required className={inputCls} placeholder="أ. محمد عبدالله الشمري" value={form.fullName} onChange={set("fullName")} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-[0.7rem] font-extrabold text-emerald-100/85" htmlFor="jobTitle">التخصص / المسمى الوظيفي</label>
                    <input id="jobTitle" className={inputCls} placeholder="معلم رياضيات — معلم أول" value={form.jobTitle} onChange={set("jobTitle")} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[0.7rem] font-extrabold text-emerald-100/85" htmlFor="username">اسم المستخدم <span className="text-[#e7cf9a]">*</span></label>
                    <div className="relative">
                      <UserRound size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-300/60" />
                      <input id="username" required autoComplete="username" className={`${inputCls} pe-10`} placeholder="moal_math" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s/g, "") })} dir="ltr" style={{ textAlign: "left" }} />
                    </div>
                  </div>
                  <div className="hidden sm:block" />
                  <div>
                    <label className="mb-1.5 block text-[0.7rem] font-extrabold text-emerald-100/85" htmlFor="p1">كلمة المرور <span className="text-[#e7cf9a]">*</span></label>
                    <div className="relative">
                      <KeyRound size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-300/60" />
                      <input id="p1" type={show ? "text" : "password"} required autoComplete="new-password" minLength={6} className={`${inputCls} pe-10 ps-10`} placeholder="6 أحرف فأكثر" value={form.password} onChange={set("password")} dir="ltr" style={{ textAlign: "left" }} />
                      <button type="button" onClick={() => setShow((v) => !v)} className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-emerald-200/70 hover:text-white" aria-label="إظهار">
                        {show ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[0.7rem] font-extrabold text-emerald-100/85" htmlFor="p2">تأكيد كلمة المرور <span className="text-[#e7cf9a]">*</span></label>
                    <input id="p2" type={show ? "text" : "password"} required autoComplete="new-password" className={inputCls} placeholder="أعد إدخالها" value={form.confirm} onChange={set("confirm")} dir="ltr" style={{ textAlign: "left" }} />
                  </div>
                </div>
                <button type="button" onClick={() => setStep("school")} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-3 text-[0.85rem] font-extrabold text-emerald-50 ring-1 ring-white/15 transition hover:bg-white/15">
                  التالي: بيانات المدرسة <ChevronDown size={16} className="-rotate-90" />
                </button>
              </div>
            )}

            {/* الخطوة 2 — المدرسة */}
            {step === "school" && (
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-[0.7rem] font-extrabold text-emerald-100/85" htmlFor="schoolName"><School size={11} className="inline" /> اسم المدرسة</label>
                    <input id="schoolName" className={inputCls} placeholder="مدرسة…" value={form.schoolName} onChange={set("schoolName")} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[0.7rem] font-extrabold text-emerald-100/85" htmlFor="ea">الإدارة العامة للتعليم</label>
                    <input id="ea" className={inputCls} placeholder="الإدارة العامة للتعليم بمنطقة…" value={form.educationAdmin} onChange={set("educationAdmin")} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[0.7rem] font-extrabold text-emerald-100/85" htmlFor="eo">مكتب التعليم</label>
                    <input id="eo" className={inputCls} placeholder="مكتب التعليم بـ…" value={form.educationOffice} onChange={set("educationOffice")} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[0.7rem] font-extrabold text-emerald-100/85" htmlFor="city">المدينة / المحافظة</label>
                    <input id="city" className={inputCls} placeholder="الرياض" value={form.city} onChange={set("city")} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[0.7rem] font-extrabold text-emerald-100/85" htmlFor="principal">اسم مدير المدرسة</label>
                    <input id="principal" className={inputCls} placeholder="أ. مدير المدرسة" value={form.principalName} onChange={set("principalName")} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[0.7rem] font-extrabold text-emerald-100/85" htmlFor="ay">العام الدراسي</label>
                    <input id="ay" className={inputCls} value={form.academicYear} onChange={set("academicYear")} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[0.7rem] font-extrabold text-emerald-100/85" htmlFor="sm">الفصل الدراسي</label>
                    <select id="sm" className={inputCls} value={form.semester} onChange={set("semester")}>
                      <option>الفصل الدراسي الأول</option>
                      <option>الفصل الدراسي الثاني</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-[0.7rem] font-extrabold text-emerald-100/85" htmlFor="stage">المرحلة</label>
                    <select id="stage" className={inputCls} value={form.stage} onChange={set("stage")}>
                      <option value="ابتدائي">ابتدائي</option>
                      <option value="متوسط">متوسط</option>
                      <option value="ثانوي">ثانوي</option>
                    </select>
                  </div>
                </div>
                <p className="text-[0.62rem] font-semibold leading-relaxed text-emerald-100/55">يمكنك تعديل كل هذه البيانات لاحقاً من «الإعدادات»، وستظهر في ترويسة كشوفك المطبوعة.</p>
              </div>
            )}

            {error && (
              <div role="alert" className="mt-3 rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-2.5 text-[0.78rem] font-bold text-red-200">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#e7cf9a] via-[#c9a24b] to-[#a8843a] py-3.5 text-[0.92rem] font-black text-[#33260a] shadow-lg transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60">
              {loading ? <><Loader2 size={19} className="animate-spin" /> جارٍ إنشاء حسابك…</> : <><UserPlus size={18} /> إنشاء الحساب والدخول فوراً</>}
            </button>

            <p className="mt-3 text-center text-[0.72rem] font-bold text-emerald-100/65">
              لديك حساب بالفعل؟ <Link href="/login" className="text-[#e7cf9a] hover:underline">تسجيل الدخول</Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
