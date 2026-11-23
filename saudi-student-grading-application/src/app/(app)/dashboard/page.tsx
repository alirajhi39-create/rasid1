"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, School, LibraryBig, Gauge, TrendingUp, Award, AlertTriangle,
  Printer, FileSpreadsheet, ClipboardCheck, ArrowUpLeft, CloudCheck, UserPlus,
} from "lucide-react";

type DashboardData = {
  ok: boolean;
  totals: { student_count: number; class_count: number; subject_count: number };
  completion: { filled: number; expected: number };
  perSubject: Array<{ id: number; name: string; color: string; avg_percent: number; graded: number }>;
  distribution: { excellent: number; veryGood: number; good: number; pass: number; fail: number };
  avgPercent: number;
  passRate: number;
  topStudents: Array<{ id: number; full_name: string; class_name: string; grade_label: string; avg_pct: number }>;
  lowStudents: Array<{ id: number; full_name: string; class_name: string; grade_label: string; avg_pct: number }>;
  recentStudents: Array<{ id: number; full_name: string; national_id: string; class_name: string; grade_label: string; created_at: string }>;
};

const DIST_META = [
  { key: "excellent", label: "ممتاز (90+)", color: "#047857" },
  { key: "veryGood", label: "جيد جداً (80–89)", color: "#0f766e" },
  { key: "good", label: "جيد (70–79)", color: "#1d4ed8" },
  { key: "pass", label: "مقبول (60–69)", color: "#d97706" },
  { key: "fail", label: "ضعيف (<60)", color: "#dc2626" },
] as const;

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (d.ok ? setData(d) : setError(d.error ?? "تعذر تحميل البيانات")))
      .catch(() => setError("تعذر الاتصال بالخادم"));
  }, []);

  if (error) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <AlertTriangle className="mx-auto text-amber-500" size={40} />
        <h2 className="mt-3 font-black text-[#0a4630]">تعذر تحميل لوحة المعلومات</h2>
        <p className="mt-1 text-sm text-[#5c6f65]">{error}</p>
        <button onClick={() => location.reload()} className="btn btn-primary mt-4">إعادة المحاولة</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="shimmer h-28 rounded-3xl" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="shimmer h-28 rounded-2xl" />)}
        </div>
        <div className="shimmer h-72 rounded-3xl" />
      </div>
    );
  }

  const totalDist = Math.max(1, Object.values(data.distribution).reduce((a, b) => a + b, 0));
  const completion = data.completion.expected > 0 ? Math.round((data.completion.filled / data.completion.expected) * 100) : 0;

  const kpis = [
    { label: "إجمالي الطلاب", value: data.totals.student_count, icon: Users, tone: "from-emerald-600 to-emerald-900", suffix: "طالب" },
    { label: "الفصول الدراسية", value: data.totals.class_count, icon: School, tone: "from-amber-500 to-amber-700", suffix: "فصل" },
    { label: "المواد النشطة", value: data.totals.subject_count, icon: LibraryBig, tone: "from-teal-600 to-cyan-900", suffix: "مادة" },
    { label: "نسبة اكتمال الرصد", value: completion, icon: Gauge, tone: "from-indigo-600 to-indigo-900", suffix: "%", isPercent: true },
  ];

  return (
    <div className="space-y-5">
      {/* ===== شريط الترحيب ===== */}
      <section className="relative overflow-hidden rounded-3xl p-5 text-white shadow-xl sm:p-6"
        style={{ background: "linear-gradient(120deg,#0e5c3a 0%,#0a4630 55%,#062e1f 100%)" }}>
        <svg aria-hidden className="absolute inset-0 h-full w-full opacity-10">
          <defs>
            <pattern id="gp" width="42" height="42" patternUnits="userSpaceOnUse">
              <path d="M0 21h42M21 0v42" stroke="#e7cf9a" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gp)" />
        </svg>
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[0.7rem] font-extrabold text-[#e7cf9a]">
              <CloudCheck size={14} /> بيانات حية من قاعدة PostgreSQL
            </div>
            <h2 className="mt-1 text-2xl font-black leading-snug">أهلاً بك — يوم دراسي موفّق!</h2>
            <p className="mt-1 max-w-lg text-[0.8rem] font-medium text-emerald-100/85">
              متوسط النسب العام <b className="text-[#e7cf9a]">{data.avgPercent.toFixed(1)}%</b> · نسبة النجاح <b className="text-[#e7cf9a]">{data.passRate}%</b> · {data.completion.filled} درجة مرصودة حتى الآن
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/grades" className="btn btn-gold !px-4 !py-2.5 text-[0.8rem]"><ClipboardCheck size={17} /> رصد الدرجات</Link>
            <Link href="/students" className="btn !bg-white/15 !text-white ring-1 ring-white/30 backdrop-blur hover:!bg-white/25"><UserPlus size={17} /> إضافة طالب</Link>
            <Link href="/reports" className="btn !bg-white/15 !text-white ring-1 ring-white/30 backdrop-blur hover:!bg-white/25"><Printer size={17} /> كشوف رسمية</Link>
          </div>
        </div>
      </section>

      {/* ===== لافتة البداية للمعلم الجديد ===== */}
      {data.totals.class_count === 0 && (
        <section className="fade-up flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-dashed border-[#0e5c3a]/40 bg-emerald-50/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0a4630] text-[#e7cf9a]"><UserPlus size={20} /></span>
            <div>
              <div className="text-[0.85rem] font-black text-[#0a4630]">مساحتك جاهزة للانطلاق!</div>
              <div className="text-[0.68rem] font-semibold text-[#3c5f4d]">جهّزنا لك 6 مواد جاهزة بتوزيع لائحي — أنشئ فصلك الأول، ثم أضف طلابك (يدوياً أو استيراداً من نور) وابدأ الرصد</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/classes" className="btn btn-primary !py-2 text-[0.75rem]"><UserPlus size={15} /> إنشاء فصل</Link>
            <Link href="/students" className="btn btn-ghost !py-2 text-[0.75rem]">استيراد من نور</Link>
          </div>
        </section>
      )}

      {/* ===== مؤشرات ===== */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="card group relative overflow-hidden p-4">
              <div className={`pointer-events-none absolute -left-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${k.tone} opacity-10 transition group-hover:opacity-20`} />
              <div className="flex items-center justify-between">
                <span className="text-[0.68rem] font-extrabold text-[#5c6f65]">{k.label}</span>
                <div className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${k.tone} text-white shadow`}>
                  <Icon size={18} />
                </div>
              </div>
              <div className="mt-2 text-3xl font-black tabular-nums text-[#0a4630]">
                {k.value}<span className="ms-1 text-[0.72rem] font-bold text-[#8a968d]">{k.suffix}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {/* ===== توزيع التقديرات ===== */}
        <section className="card p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-black text-[#0a4630]"><Award size={18} className="text-[#c9a24b]" /> توزيع التقديرات</h3>
              <p className="text-[0.65rem] font-semibold text-[#8a968d]">حسب لائحة تقويم الطالب (على جميع المواد)</p>
            </div>
            <div className="relative grid h-20 w-20 place-items-center">
              <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
                <circle cx="40" cy="40" r="33" stroke="#e8eae3" strokeWidth="10" fill="none" />
                <circle cx="40" cy="40" r="33" stroke="url(#okGrad)" strokeWidth="10" fill="none" strokeLinecap="round"
                  strokeDasharray={`${(data.passRate / 100) * 207.3} 207.3`} />
                <defs>
                  <linearGradient id="okGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#1d8a5c" /><stop offset="1" stopColor="#c9a24b" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="text-center leading-none">
                <div className="text-[0.95rem] font-black text-[#0a4630]">{data.passRate}%</div>
                <div className="text-[0.48rem] font-bold text-[#8a968d]">نجاح</div>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-2.5">
            {DIST_META.map((d) => {
              const value = data.distribution[d.key];
              const pct = (value / totalDist) * 100;
              return (
                <div key={d.key}>
                  <div className="mb-1 flex items-center justify-between text-[0.7rem] font-bold">
                    <span className="text-[#3c4f44]">{d.label}</span>
                    <span className="tabular-nums text-[#0a4630]">{value} <span className="text-[#a3ada5]">({pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="h-3.5 overflow-hidden rounded-full bg-[#eef0ea]">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${d.color}cc, ${d.color})` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ===== متوسط المواد ===== */}
        <section className="card p-5 xl:col-span-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-black text-[#0a4630]"><TrendingUp size={18} className="text-[#0e5c3a]" /> متوسط الأداء لكل مادة</h3>
              <p className="text-[0.65rem] font-semibold text-[#8a968d]">النسبة المئوية لمتوسط الدرجات المرصودة</p>
            </div>
            <Link href="/reports" className="text-[0.7rem] font-extrabold text-[#0e5c3a] hover:underline inline-flex items-center gap-1">
              تصدير لنور <ArrowUpLeft size={13} />
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {data.perSubject.map((s) => {
              const pct = Math.min(100, Math.max(0, s.avg_percent));
              const tone = pct >= 80 ? "#047857" : pct >= 60 ? "#b45309" : "#dc2626";
              return (
                <div key={s.id} className="rounded-2xl border border-[#e9eae3] bg-[#fbfbf8] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[0.78rem] font-extrabold text-[#22332a]">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                      {s.name}
                    </span>
                    <span className="text-lg font-black tabular-nums" style={{ color: tone }}>{pct.toFixed(1)}<span className="text-[0.6rem]">%</span></span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#e8eae3]">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${s.color}99, ${s.color})` }} />
                  </div>
                  <div className="mt-1.5 text-[0.58rem] font-bold text-[#a3ada5]">{s.graded} درجة مرصودة</div>
                </div>
              );
            })}
            {data.perSubject.length === 0 && (
              <p className="col-span-full py-6 text-center text-sm text-[#8a968d]">لا توجد مواد بعد — أضف مواد من صفحة «المواد وتوزيع الدرجات».</p>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ===== الأوائل ===== */}
        <section className="card p-5">
          <h3 className="flex items-center gap-2 font-black text-[#0a4630]"><Award size={18} className="text-[#c9a24b]" /> الطلاب الأوائل</h3>
          <ol className="mt-3 divide-y divide-[#eef0ea]">
            {data.topStudents.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[0.72rem] font-black ${
                  i === 0 ? "bg-[#c9a24b] text-[#33260a]" : i === 1 ? "bg-[#d9dee6] text-[#3f4a5a]" : i === 2 ? "bg-[#e7c9a1] text-[#6b4423]" : "bg-[#eef0ea] text-[#5c6f65]"
                }`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[0.8rem] font-extrabold text-[#22332a]">{s.full_name}</div>
                  <div className="text-[0.6rem] font-semibold text-[#8a968d]">{s.grade_label} · {s.class_name}</div>
                </div>
                <span className="text-[0.78rem] font-black tabular-nums text-emerald-700">{Number(s.avg_pct).toFixed(1)}%</span>
              </li>
            ))}
            {data.topStudents.length === 0 && <li className="py-6 text-center text-sm text-[#8a968d]">ستظهر النتائج بعد رصد الدرجات</li>}
          </ol>
        </section>

        {/* ===== يحتاجون دعماً ===== */}
        <section className="card p-5">
          <h3 className="flex items-center gap-2 font-black text-[#0a4630]"><AlertTriangle size={18} className="text-red-500" /> طلاب متعثرون — خطة دعم</h3>
          <ul className="mt-3 divide-y divide-[#eef0ea]">
            {data.lowStudents.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-red-50 text-[0.7rem] font-black text-red-600">!</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[0.8rem] font-extrabold text-[#22332a]">{s.full_name}</div>
                  <div className="text-[0.6rem] font-semibold text-[#8a968d]">{s.grade_label} · {s.class_name}</div>
                </div>
                <span className="text-[0.78rem] font-black tabular-nums text-red-600">{Number(s.avg_pct).toFixed(1)}%</span>
              </li>
            ))}
            {data.lowStudents.length === 0 && <li className="py-6 text-center text-sm text-[#8a968d]">لا توجد حالات تعثر مسجلة</li>}
          </ul>
        </section>

        {/* ===== أُضيفوا حديثاً ===== */}
        <section className="card p-5">
          <h3 className="flex items-center gap-2 font-black text-[#0a4630]"><Users size={18} className="text-[#0e5c3a]" /> أُضيفوا حديثاً</h3>
          <ul className="mt-3 divide-y divide-[#eef0ea]">
            {data.recentStudents.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-[0.75rem] font-black text-emerald-800">
                  {s.full_name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[0.78rem] font-extrabold text-[#22332a]">{s.full_name}</div>
                  <div className="text-[0.6rem] font-semibold text-[#8a968d]">{s.grade_label} · {s.class_name} {s.national_id && <>· <span dir="ltr" className="tabular-nums">{s.national_id}</span></>}</div>
                </div>
              </li>
            ))}
          </ul>
          <Link href="/students" className="btn btn-ghost mt-3 w-full justify-center text-[0.75rem]">إدارة الطلاب <ArrowUpLeft size={14} /></Link>
        </section>
      </div>

      {/* ===== تصدير سريع ===== */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e3d9b8] bg-gradient-to-l from-[#faf3dd] to-[#f5edd4] px-5 py-4">
        <div className="flex items-center gap-3">
          <FileSpreadsheet size={26} className="text-[#a8843a]" />
          <div>
            <div className="text-[0.85rem] font-black text-[#5c4a12]">جاهز للرفع على نظام نور؟</div>
            <div className="text-[0.65rem] font-semibold text-[#8a7434]">صدّر كشوف الدرجات بصيغة Excel مطابقة لقالب الاستيراد بنقرة واحدة</div>
          </div>
        </div>
        <Link href="/reports" className="btn btn-gold text-[0.78rem]"><FileSpreadsheet size={16} /> فتح مركز التصدير</Link>
      </section>
    </div>
  );
}
