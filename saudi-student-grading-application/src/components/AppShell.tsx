"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, School, LibraryBig, ClipboardCheck, FileText,
  Settings, LogOut, Menu, X, GraduationCap, ChevronDown, CalendarDays, CloudCheck,
} from "lucide-react";
import type { ReactNode } from "react";

// ============ نظام تنبيهات خفيف (Toast) يعمل عبر حدث متصفح ============
export type ToastKind = "success" | "error" | "info";
export function toast(message: string, kind: ToastKind = "success") {
  window.dispatchEvent(new CustomEvent("rased-toast", { detail: { message, kind } }));
}

type ToastItem = { id: number; message: string; kind: ToastKind };

const NAV = [
  { href: "/dashboard", label: "لوحة المعلومات", icon: LayoutDashboard, desc: "نظرة شاملة على الأداء" },
  { href: "/grades", label: "رصد الدرجات", icon: ClipboardCheck, desc: "إدخال وحفظ تلقائي" },
  { href: "/students", label: "شؤون الطلاب", icon: Users, desc: "إضافة، استيراد، نقل" },
  { href: "/classes", label: "الفصول والصفوف", icon: School, desc: "إدارة الشعب الدراسية" },
  { href: "/subjects", label: "المواد والتوزيع", icon: LibraryBig, desc: "خانات الدرجات والعظمى" },
  { href: "/reports", label: "التقارير والطباعة", icon: FileText, desc: "كشوف رسمية + تصدير نور" },
  { href: "/settings", label: "الإعدادات", icon: Settings, desc: "المدرسة وكلمة المرور" },
];

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "لوحة المعلومات",
  "/grades": "رصد الدرجات",
  "/students": "شؤون الطلاب",
  "/classes": "الفصول والصفوف",
  "/subjects": "المواد وتوزيع الدرجات",
  "/reports": "التقارير والطباعة",
  "/settings": "الإعدادات",
};

export default function AppShell({
  teacher,
  children,
}: {
  teacher: {
    full_name: string;
    school_name: string;
    academic_year: string;
    semester: string;
    job_title: string;
  } | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  const pushToast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, message, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      pushToast(d.message, d.kind);
    };
    window.addEventListener("rased-toast", handler as EventListener);
    return () => window.removeEventListener("rased-toast", handler as EventListener);
  }, [pushToast]);

  useEffect(() => { setOpen(false); setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  const title = PAGE_TITLES[pathname] ?? "رصد";
  const hijri = new Intl.DateTimeFormat("ar-SA-u-ca-islamic", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const gregorian = new Intl.DateTimeFormat("ar", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  const sidebar = (
    <aside className="app-chrome flex h-full w-[280px] flex-col text-emerald-50"
      style={{ background: "linear-gradient(168deg,#0c4a2f 0%,#083d28 45%,#062e1f 100%)" }}>
      {/* الشعار */}
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#e7cf9a] to-[#c9a24b] shadow-lg shadow-black/30">
          <GraduationCap size={26} strokeWidth={2.2} className="text-[#3d2e07]" />
        </div>
        <div className="min-w-0">
          <div className="text-[1.55rem] font-black leading-none tracking-tight text-white">رَصْد</div>
          <div className="mt-1 text-[0.62rem] font-semibold leading-snug text-emerald-200/90">
            منظومة تقويم ورصد درجات الطلاب<br />وفق لائحة التعليم العام السعودي
          </div>
        </div>
      </div>

      {/* بيانات المدرسة */}
      <div className="mx-4 mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-[0.7rem] font-bold text-[#e7cf9a]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#c9a24b]" />
          المنشأة التعليمية
        </div>
        <div className="mt-1 truncate text-[0.85rem] font-extrabold text-white">{teacher?.school_name ?? "مدرسة المستقبل النموذجية"}</div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[0.62rem] font-bold text-emerald-100/90">
          <span className="rounded-md bg-white/10 px-2 py-0.5">{teacher?.academic_year ?? "1447هـ"}</span>
          <span className="rounded-md bg-white/10 px-2 py-0.5">{teacher?.semester ?? "الفصل الدراسي الأول"}</span>
        </div>
      </div>

      {/* التنقل */}
      <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-4">
        <div className="px-2 text-[0.62rem] font-black uppercase tracking-[0.18em] text-emerald-300/70">القوائم الرئيسية</div>
        <ul className="mt-2 space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2 transition-all duration-200 ${
                    active
                      ? "bg-gradient-to-l from-[#c9a24b] to-[#dbb95e] text-[#33260a] shadow-lg shadow-black/25"
                      : "text-emerald-50/90 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon size={19} strokeWidth={2.1} className={active ? "text-[#33260a]" : "text-emerald-300/90 group-hover:text-[#e7cf9a]"} />
                  <span className="flex-1">
                    <span className="block text-[0.82rem] font-extrabold leading-tight">{item.label}</span>
                    <span className={`block text-[0.6rem] font-medium ${active ? "text-[#4d3c12]" : "text-emerald-200/60"}`}>{item.desc}</span>
                  </span>
                  {active && <span className="h-2 w-2 rounded-full bg-[#33260a]" />}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 rounded-2xl border border-[#c9a24b]/25 bg-gradient-to-br from-[#c9a24b]/15 to-transparent p-3">
          <div className="flex items-center gap-2 text-[0.72rem] font-extrabold text-[#e7cf9a]">
            <CloudCheck size={15} /> حفظ سحابي تلقائي
          </div>
          <p className="mt-1 text-[0.62rem] leading-relaxed text-emerald-100/75">
            كل تعديل في شبكة الرصد يُحفظ فوراً في قاعدة البيانات مع مؤشر حالة لحظي.
          </p>
        </div>
      </nav>

      {/* المستخدم */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-800/80 text-sm font-black text-[#e7cf9a] ring-1 ring-white/15">
            {(teacher?.full_name ?? "م").trim().charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[0.78rem] font-extrabold text-white">{teacher?.full_name ?? "المعلم"}</div>
            <div className="truncate text-[0.62rem] text-emerald-200/70">{teacher?.job_title ?? "معلم أول"}</div>
          </div>
          <button onClick={logout} title="تسجيل الخروج"
            className="grid h-9 w-9 place-items-center rounded-lg text-emerald-100/80 transition hover:bg-red-500/20 hover:text-red-200">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-[#f4f5f0]">
      {/* شريط جانبي — سطح المكتب */}
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block">{sidebar}</div>

      {/* درج الجوال */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[280px] shadow-2xl">{sidebar}</div>
        </div>
      )}

      {/* المحتوى */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* الشريط العلوي */}
        <header className="app-chrome sticky top-0 z-30 border-b border-[#e3e4dd] bg-[#fbfbf8]/85 backdrop-blur-lg">
          <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
            <button onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-[#e3e4dd] bg-white text-[#0e5c3a] shadow-sm lg:hidden" aria-label="القائمة">
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-[1.05rem] font-black text-[#0a4630]">{title}</h1>
              <div className="hidden items-center gap-2 text-[0.65rem] font-semibold text-[#5c6f65] sm:flex">
                <CalendarDays size={12} />
                <span>{gregorian} · {hijri}</span>
              </div>
            </div>
            <div className="ms-auto flex items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[0.65rem] font-extrabold text-emerald-800 md:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                متصل بـ PostgreSQL السحابية
              </span>
              {/* قائمة المستخدم */}
              <div className="relative">
                <button onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-xl border border-[#e3e4dd] bg-white py-1.5 pe-2 ps-1.5 shadow-sm transition hover:shadow">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#0a4630] text-[0.7rem] font-black text-[#e7cf9a]">
                    {(teacher?.full_name ?? "م").trim().charAt(0)}
                  </div>
                  <ChevronDown size={14} className={`text-[#5c6f65] transition-transform ${menuOpen ? "rotate-180" : ""}`} />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute left-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-[#e6e7e0] bg-white shadow-2xl">
                      <div className="border-b bg-[#fbfbf8] px-4 py-3">
                        <div className="text-[0.8rem] font-extrabold text-[#0a4630]">{teacher?.full_name}</div>
                        <div className="text-[0.65rem] text-[#5c6f65]">{teacher?.school_name}</div>
                      </div>
                      <Link href="/settings" className="flex items-center gap-2 px-4 py-2.5 text-[0.8rem] font-bold text-[#16241d] transition hover:bg-[#f4f5f0]">
                        <Settings size={16} className="text-[#0e5c3a]" /> الإعدادات والحساب
                      </Link>
                      <button onClick={logout} className="flex w-full items-center gap-2 px-4 py-2.5 text-[0.8rem] font-bold text-red-700 transition hover:bg-red-50">
                        <LogOut size={16} /> تسجيل الخروج
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* المحتوى الرئيسي */}
        <main className="app-main mx-auto w-full max-w-[1500px] flex-1 px-4 py-5 sm:px-6">{children}</main>

        {/* تذييل */}
        <footer className="app-chrome border-t border-[#e6e7e0] bg-[#fbfbf8] px-6 py-2.5 text-center text-[0.62rem] font-semibold text-[#8a968d]">
          رَصْد — منظومة تقويم ورصد الطلاب · متوافقة مع لائحة تقويم الطالب ونظام نور · المملكة العربية السعودية، وزارة التعليم · {teacher?.academic_year}
        </footer>
      </div>

      {/* التنبيهات */}
      <div className="no-print pointer-events-none fixed bottom-4 right-1/2 z-50 flex w-full max-w-md translate-x-1/2 flex-col gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id}
            className={`pointer-events-auto flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[0.8rem] font-bold shadow-2xl ring-1 backdrop-blur ${
              t.kind === "success" ? "bg-emerald-900/95 text-emerald-50 ring-emerald-700"
              : t.kind === "error" ? "bg-red-800/95 text-red-50 ring-red-600"
              : "bg-slate-800/95 text-slate-50 ring-slate-600"
            }`}>
            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.7rem] ${
              t.kind === "success" ? "bg-emerald-500 text-emerald-950" : t.kind === "error" ? "bg-red-400 text-red-950" : "bg-slate-500 text-slate-950"
            }`}>{t.kind === "success" ? "✓" : t.kind === "error" ? "!" : "i"}</span>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
