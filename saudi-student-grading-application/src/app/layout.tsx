import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "رصد | منظومة إدارة ورصد درجات الطلاب — نظام نور",
  description:
    "نظام عربي متكامل لإدارة الطلاب والفصول والمواد ورصد الدرجات وفق لائحة تقويم الطالب في التعليم العام السعودي، مع تقارير PDF رسمية وتصدير Excel مطابق لقوالب نظام نور.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a4630",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#f4f5f0] text-[#16241d] antialiased">{children}</body>
    </html>
  );
}
