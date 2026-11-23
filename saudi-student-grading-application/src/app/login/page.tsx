"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import HeroPanel from "@/components/HeroPanel";
import {
  GraduationCap, LockKeyhole, UserRound, Eye, EyeOff, ShieldCheck,
  Loader2, KeyRound, Sparkles, FileSpreadsheet, Printer, Keyboard,
} from "lucide-react";

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "تعذر تسجيل الدخول");
        setLoading(false);
        return;
      }
      const next = search.get("next") || "/dashboard";
      router.replace(next);
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخادم — تحقق من اتصال قاعدة البيانات");
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-[#062e1f]">
      {/* ===== العمود البصري (سطح المكتب) ===== */}
      <HeroPanel>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#c9a24b]/50 bg-black/35 px-4 py-1.5 text-[0.72rem] font-extrabold text-[#e7cf9a] backdrop-blur-md">
          <Sparkles size={13} /> لائحة تقويم الطالب في التعليم العام السعودي
        </div>
        <h2 className="max-w-xl text-3xl font-black leading-[1.35] text-white drop-shadow-lg xl:text-4xl">
          من الفصل إلى السحابة…<br />
          <span className="text-[#e7cf9a]">رصد دقيق، وطباعة رسمية، وتصدير لنور</span>
        </h2>
        <p className="mt-3 max-w-md text-[0.85rem] font-medium leading-relaxed text-emerald-50/85">
          إدارة كاملة للطلاب والمواد والدرجات: المهام الأدائية والتقويمات التحريرية، مع حساب التقدير والنسبة آلياً وحفظ سحابي فوري.
        </p>
      </HeroPanel>

      {/* ===== عمود الدخول ===== */}
      <div className="relative flex flex-1 items-center justify-center px-5 py-8 sm:px-10">
        {/* زخرفة خلفية */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-[#14704a]/25 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#c9a24b]/10 blur-3xl" />
          <svg className="absolute inset-0 h-full w-full opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.6" fill="#e7cf9a" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>

        <div className="relative w-full max-w-md">
          {/* الشعار */}
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#e7cf9a] to-[#c9a24b] shadow-[0_10px_30px_-8px_rgba(201,162,75,.6)]">
              <GraduationCap size={30} strokeWidth={2.2} className="text-[#3d2e07]" />
            </div>
            <div>
              <div className="text-3xl font-black leading-none text-white">رَصْد</div>
              <div className="mt-1 text-[0.65rem] font-bold text-emerald-200/80">المملكة العربية السعودية · وزارة التعليم</div>
            </div>
          </div>

          {/* البطاقة */}
          <div className="rounded-3xl border border-white/10 bg-[#0c3a26]/80 p-6 shadow-2xl backdrop-blur-xl sm:p-7">
            <div className="flex items-center gap-2 text-[0.7rem] font-extrabold uppercase tracking-[0.2em] text-[#c9a24b]">
              <LockKeyhole size={14} /> بوابة المعلم
            </div>
            <h1 className="mt-1.5 text-2xl font-black text-white">تسجيل الدخول للمنظومة</h1>
            <p className="mt-1 text-[0.78rem] font-medium text-emerald-100/70">أدخل بيانات حسابك لإدارة درجات طلابك</p>

            <form onSubmit={submit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="username" className="mb-1.5 block text-[0.72rem] font-extrabold text-emerald-100/85">اسم المستخدم</label>
                <div className="relative">
                  <UserRound size={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-300/60" />
                  <input
                    id="username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pe-11 ps-4 text-[0.9rem] font-bold text-white outline-none transition placeholder:text-emerald-100/30 focus:border-[#c9a24b]/60 focus:bg-white/10 focus:ring-2 focus:ring-[#c9a24b]/25"
                    placeholder="اسم المستخدم الخاص بك"
                    dir="auto"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-[0.72rem] font-extrabold text-emerald-100/85">كلمة المرور</label>
                <div className="relative">
                  <KeyRound size={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-300/60" />
                  <input
                    id="password"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pe-11 ps-11 text-[0.9rem] font-bold text-white outline-none transition placeholder:text-emerald-100/30 focus:border-[#c9a24b]/60 focus:bg-white/10 focus:ring-2 focus:ring-[#c9a24b]/25"
                    placeholder="••••••••"
                    dir="ltr"
                    style={{ textAlign: "left" }}
                  />
                  <button type="button" onClick={() => setShow((v) => !v)} aria-label="إظهار كلمة المرور"
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-emerald-200/70 transition hover:text-white">
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-2.5 text-[0.78rem] font-bold text-red-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-l from-[#e7cf9a] via-[#c9a24b] to-[#a8843a] py-3.5 text-[0.95rem] font-black text-[#33260a] shadow-[0_14px_36px_-10px_rgba(201,162,75,.65)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? (
                  <><Loader2 size={19} className="animate-spin" /> جارٍ التحقق…</>
                ) : (
                  <><ShieldCheck size={19} /> دخول إلى لوحة الرصد</>
                )}
              </button>
            </form>

            {/* التسجيل لمعلم جديد */}
            <div className="mt-5 rounded-2xl border border-[#c9a24b]/25 bg-[#c9a24b]/8 p-3 text-center">
              <div className="flex items-center justify-center gap-2 text-[0.72rem] font-extrabold text-emerald-100/85">
                <Sparkles size={13} className="text-[#e7cf9a]" /> معلم جديد في المنصة؟
              </div>
              <Link href="/register" className="mt-2 inline-flex items-center gap-2 rounded-xl border border-[#c9a24b]/45 bg-[#c9a24b]/15 px-4 py-2 text-[0.78rem] font-black text-[#e7cf9a] transition hover:bg-[#c9a24b]/25">
                أنشئ حسابك الخاص الآن <span aria-hidden>←</span>
              </Link>
              <p className="mt-2 text-[0.6rem] font-semibold text-emerald-100/50">فضاء مستقل لكل معلم: فصوله وطلابه ومواده ودرجاته بخصوصية كاملة</p>
            </div>
          </div>

          {/* مزايا سريعة */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[0.62rem] font-bold text-emerald-100/55">
            <span className="inline-flex items-center gap-1.5"><Keyboard size={13} /> تنقّل بالأسهم وEnter</span>
            <span className="inline-flex items-center gap-1.5"><FileSpreadsheet size={13} /> استيراد وتصدير Excel</span>
            <span className="inline-flex items-center gap-1.5"><Printer size={13} /> كشوف رسمية جاهزة للطباعة</span>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
