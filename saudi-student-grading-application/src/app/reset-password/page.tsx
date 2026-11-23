"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { KeyRound, Eye, EyeOff, Loader2, CheckCircle2, ShieldCheck, AlertTriangle } from "lucide-react";

function ResetInner() {
  const search = useSearchParams();
  const token = search.get("token") ?? "";
  const [name, setName] = useState("");
  const [valid, setValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setValid(false); return; }
    fetch(`/api/auth/reset?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setValid(!!d.ok); if (d.ok) setName(d.name); })
      .catch(() => setValid(false));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("تأكيد كلمة المرور غير مطابق"); return; }
    if (password.length < 6) { setError("كلمة المرور يجب ألا تقل عن 6 أحرف"); return; }
    setLoading(true);
    const r = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const d = await r.json();
    setLoading(false);
    if (!d.ok) { setError(d.error ?? "تعذر الحفظ"); return; }
    setDone(true);
  };

  const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-[0.9rem] font-bold text-white outline-none transition placeholder:text-emerald-100/30 focus:border-[#c9a24b]/60 focus:bg-white/10 focus:ring-2 focus:ring-[#c9a24b]/25";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#062e1f] px-5 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-[#14704a]/25 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-[#c9a24b]/10 blur-3xl" />
      </div>
      <div className="relative w-full max-w-md">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#e7cf9a] to-[#c9a24b] shadow-lg">
            <KeyRound size={24} className="text-[#3d2e07]" />
          </div>
          <div>
            <div className="text-2xl font-black leading-none text-white">تعيين كلمة مرور جديدة</div>
            <div className="mt-1 text-[0.65rem] font-bold text-emerald-200/80">منظومة رَصْد — المملكة العربية السعودية · وزارة التعليم</div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#0c3a26]/80 p-6 shadow-2xl backdrop-blur-xl">
          {valid === null ? (
            <div className="py-8 text-center"><Loader2 size={26} className="mx-auto animate-spin text-[#c9a24b]" /></div>
          ) : !valid ? (
            <div className="py-6 text-center">
              <AlertTriangle size={36} className="mx-auto text-amber-400" />
              <h1 className="mt-3 text-lg font-black text-white">الرابط غير صالح أو منتهي الصلاحية</h1>
              <p className="mt-1 text-[0.75rem] font-medium text-emerald-100/70">الروابط صالحة لمدة ساعة واحدة فقط.</p>
              <Link href="/forgot-password" className="btn btn-gold mt-4">طلب رابط جديد</Link>
            </div>
          ) : done ? (
            <div className="py-6 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/20"><CheckCircle2 size={30} className="text-emerald-300" /></div>
              <h1 className="mt-3 text-lg font-black text-white">تم تغيير كلمة المرور بنجاح</h1>
              <p className="mt-1 text-[0.78rem] font-medium text-emerald-100/80">يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.</p>
              <Link href="/login" className="btn btn-gold mt-4">تسجيل الدخول الآن</Link>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-black text-white">مرحباً{name ? ` ${name}` : ""} 👋</h1>
              <p className="mt-1 text-[0.75rem] font-medium text-emerald-100/70">أدخل كلمة المرور الجديدة لحسابك.</p>
              <form onSubmit={submit} className="mt-4 space-y-3">
                <div className="relative">
                  <input type={show ? "text" : "password"} required minLength={6} value={password}
                    onChange={(e) => setPassword(e.target.value)} autoFocus
                    className={`${inputCls} pe-11`} placeholder="كلمة المرور الجديدة" dir="ltr" style={{ textAlign: "left" }} autoComplete="new-password" />
                  <button type="button" onClick={() => setShow((v) => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-emerald-200/70 hover:text-white">
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <input type={show ? "text" : "password"} required value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} className={inputCls}
                  placeholder="تأكيد كلمة المرور" dir="ltr" style={{ textAlign: "left" }} autoComplete="new-password" />
                {error && <div className="rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-2.5 text-[0.78rem] font-bold text-red-200">{error}</div>}
                <button type="submit" disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#e7cf9a] via-[#c9a24b] to-[#a8843a] py-3.5 text-[0.92rem] font-black text-[#33260a] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />} حفظ كلمة المرور الجديدة
                </button>
              </form>
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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetInner />
    </Suspense>
  );
}
