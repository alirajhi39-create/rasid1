"use client";

import { useState } from "react";
import { GraduationCap } from "lucide-react";
import type { ReactNode } from "react";
// الصورة مضمّنة كـ base64 داخل الحزمة البرمجية — تظهر دائماً دون أي اعتماد على ملفات ثنائية
import { HERO_SRC } from "@/assets/hero";

/**
 * العمود البصري لصفحتي الدخول والتسجيل.
 * يستخدم وسماً <img> مباشراً (بدون next/image) ليضمن ظهور الصورة على أي استضافة،
 * مع بديل زخرفي أنيق في حال تعذر تحميلها.
 */
export default function HeroPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const [imgOk, setImgOk] = useState(true);

  return (
    <div className={`relative hidden lg:block w-[46%] shrink-0 xl:w-[52%] ${className}`}>
      {imgOk ? (
        <>
          <img
            src={HERO_SRC}
            alt="فصل دراسي سعودي حديث"
            className="absolute inset-0 h-full w-full object-cover object-center"
            onError={() => setImgOk(false)}
          />
          <div className="absolute inset-0 bg-gradient-to-l from-[#062e1f] via-[#062e1f3d] to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#062e1f] via-transparent to-transparent" />
        </>
      ) : (
        /* بديل زخرفي أنيق */
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(155deg, #0e5c3a 0%, #0a4630 45%, #062e1f 100%)" }}
        >
          <svg className="absolute inset-0 h-full w-full opacity-[0.14]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="hero-pattern" width="56" height="56" patternUnits="userSpaceOnUse">
                <path d="M28 4 L52 28 L28 52 L4 28 Z" fill="none" stroke="#c9a24b" strokeWidth="1.2" />
                <circle cx="28" cy="28" r="4" fill="none" stroke="#e7cf9a" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-pattern)" />
          </svg>
          <div className="absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-[#c9a24b]/15 blur-3xl" />
          <div className="absolute top-1/3 right-10 grid h-40 w-40 place-items-center rounded-[2.5rem] border border-[#c9a24b]/30 bg-white/5 backdrop-blur-sm">
            <GraduationCap size={90} strokeWidth={1.4} className="text-[#e7cf9a]/80" />
          </div>
        </div>
      )}
      {/* المحتوى النصي فوق */}
      <div className="absolute bottom-0 right-0 p-10 text-white">{children}</div>
    </div>
  );
}
