"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { KeyRound, Mail, ArrowRight, Loader2, CheckCircle2, Copy, ExternalLink } from "lucide-react";

function ForgotInner() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ message: string; devLink?: string; configured?: boolean } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const d = await r.json();
      if (!d.ok) { setError(d.error ?? "تعذر المعالجة"); return; }
      setResult({ message: d.message, devLink: d.devLink, configured: d.configured });
    } catch {
      setError("تعذر الاتصال بالخادم");
    }
    setLoading(false);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#062e1f] px-5 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-[#14704a]/25 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-[#c9a24b]/10 blur-3xl" />
      </div>
      <div className="relative w-full max-w-md">
        <div className="mb-5 flex items-center gap-3">
          <Link href="/login" className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#e7cf9a] to-[#c9a24b] shadow-lg">
            <KeyRound size={24} className="text-[#3d2e07]" />
          </Link>
          <div>
            <div className="text-2xl font-black leading-none text-white">استعادة كلمة المرور</div>
            <div className="mt-1 text-[0.65rem] font-bold text-emerald-200/80">منظومة رَصْد — المملكة العربية السعودية · وزارة التعليم</div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#0c3a26]/80 p-6 shadow-2xl backdrop-blur-xl">
          {!result ? (
            <>
              <h1 className="text-lg font-black text-white">أدخل بريدك الإلكتروني المسجل</h1>
              <p className="mt-1 text-[0.75rem] font-medium text-emerald-100/70">
                سنرسل لك رابطاً آمناً صالحاً لمدة ساعة لتعيين كلمة مرور جديدة.
              </p>
              <form onSubmit={submit} className="mt-4 space-y-3">
                <div className="relative">
                  <Mail size={17} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-300/60" />
                  <input
                    type="email" required value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pe-4 ps-11 text-[0.9rem] font-bold text-white outline-none transition placeholder:text-emerald-100/30 focus:border-[#c9a24b]/60 focus:bg-white/10 focus:ring-2 focus:ring-[#c9a24b]/25"
                    placeholder="teacher@school.edu.sa" dir="ltr" style={{ textAlign: "left" }}
                  />
                </div>
                {error && <div className="rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-2.5 text-[0.78rem] font-bold text-red-200">{error}</div>}
                <button type="submit" disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#e7cf9a] via-[#c9a24b] to-[#a8843a] py-3.5 text-[0.92rem] font-black text-[#33260a] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60">
                  {loading ? <><Loader2 size={18} className="animate-spin" /> جارٍ الإرسال…</> : <>إرسال رابط الاستعادة <ArrowRight size={18} /></>}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/20">
                <CheckCircle2 size={30} className="text-emerald-300" />
              </div>
              <h1 className="mt-3 text-center text-lg font-black text-white">تم طلب الاستعادة</h1>
              <p className="mt-2 text-center text-[0.78rem] font-medium leading-relaxed text-emerald-100/80">{result.message}</p>
              {result.devLink && (
                <div className="mt-4 rounded-2xl border border-[#c9a24b]/40 bg-[#c9a24b]/10 p-3">
                  <div className="break-all rounded-lg bg-black/30 p-2 text-left text-[0.68rem] font-bold text-emerald-50" dir="ltr">{result.devLink}</div>
                  <div className="mt-2 flex gap-2">
                    <a href={result.devLink} target="_blank" rel="noreferrer"
                      className="btn btn-gold flex-1 justify-center !py-2 text-[0.72rem]"><ExternalLink size={14} /> فتح الرابط</a>
                    <button onClick={() => { navigator.clipboard.writeText(result.devLink!); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                      className="btn btn-ghost !py-2 text-[0.72rem]">{copied ? <CheckCircle2 size={14} /> : <Copy size={14} />} نسخ</button>
                  </div>
                </div>
              )}
              {result.configured === false && (
                <div className="mt-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-[0.7rem] leading-relaxed text-amber-100">
                  <div className="font-black text-amber-200">لتفعيل الإرسال الفعلي إلى البريد: </div>
                  <ol className="mt-1 list-decimal space-y-1 pr-4">
                    <li>أنشئ حساباً مجانياً في <b dir="ltr">resend.com</b> وانسخ مفتاح API.</li>
                    <li>في لوحة Vercel ← Project ← <b dir="ltr">Settings</b> ← <b dir="ltr">Environment Variables</b> أضف: <b dir="ltr">RESEND_API_KEY</b> و <b dir="ltr">RESEND_FROM</b>.</li>
                    <li>أعد النشر، وسيصل الرابط تلقائياً إلى بريدك المسجّل في الإعدادات.</li>
                  </ol>
                </div>
              )}
            </>
          )}
          <div className="mt-4 text-center">
            <Link href="/login" className="text-[0.75rem] font-extrabold text-[#e7cf9a] hover:underline">← العودة إلى تسجيل الدخول</Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotInner />
    </Suspense>
  );
}
