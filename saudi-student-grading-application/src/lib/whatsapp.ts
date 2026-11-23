// ============================================================
//  إرسال نتائج الطلاب لولي الأمر عبر واتساب
//  يعتمد روابط wa.me العميقة (تعمل على واتساب الموبايل والويب دون مفاتيح)
// ============================================================

/** تطبيع الرقم السعودي إلى صيغة دولية (966xxxxxxxxx) */
export function normalizeSaudiPhone(raw: string): string {
  let p = (raw ?? "").replace(/\D/g, "");
  if (!p) return "";
  if (p.startsWith("00966")) p = p.slice(3);
  if (p.startsWith("966")) return p;
  if (p.startsWith("0")) p = p.slice(1);
  if (p.length === 9 && p.startsWith("5")) return "966" + p;
  if (p.length === 10) return "966" + p.slice(1);
  if (p.length === 9) return "966" + p;
  return p;
}

export type WaResultData = {
  studentName: string;
  subject: string;
  classLabel: string;
  axisLabel: string;
  perf: number | null;
  perfMax: number;
  written: number | null;
  writtenMax: number;
  total: number | null;
  totalMax: number;
  pct: number | null;
  bandLabel: string;
  school: string;
  teacherName: string;
};

/** بناء نص الرسالة العربية لولي الأمر */
export function buildWaMessage(d: WaResultData): string {
  const f = (n: number | null, m: number) => (n === null ? "—" : `${n} من ${m}`);
  return [
    `أهلاً وسهلاً، ولي أمر الطالب/ة ${d.studentName}`,
    `${d.school}`,
    `المادة: ${d.subject} — ${d.classLabel}`,
    `الفترة: ${d.axisLabel}`,
    "--------------------------",
    `المهام الأدائية: ${f(d.perf, d.perfMax)}`,
    `التقويمات التحريرية: ${f(d.written, d.writtenMax)}`,
    `المجموع: ${f(d.total, d.totalMax)}`,
    `النسبة: ${d.pct === null ? "—" : d.pct.toFixed(1) + "%"}`,
    `التقدير: ${d.bandLabel}`,
    "--------------------------",
    `مع خالص التحية — ${d.teacherName}`,
  ].join("\n");
}

/** رابط wa.me مع الرسالة (يفتح واتساب بالرسالة جاهزة للإرسال) */
export function waLink(phone: string, message: string): string | null {
  const p = normalizeSaudiPhone(phone);
  if (!p) return null;
  return `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
}

export function openWhatsApp(phone: string, message: string): boolean {
  const link = waLink(phone, message);
  if (!link) return false;
  window.open(link, "_blank", "noopener,noreferrer");
  return true;
}
