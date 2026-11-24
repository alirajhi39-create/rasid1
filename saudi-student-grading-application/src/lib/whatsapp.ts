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

/** قائمة الملاحظات (الأماكن القابلة للاستبدال) في صيغة الرسالة */
export const WA_PLACEHOLDERS: Array<{ key: string; label: string }> = [
  { key: "{student}", label: "اسم الطالب" },
  { key: "{subject}", label: "المادة" },
  { key: "{class}", label: "الفصل/الشعبة" },
  { key: "{axis}", label: "الفصل الدراسي والفترة" },
  { key: "{perf}", label: "درجة المهام الأدائية" },
  { key: "{written}", label: "درجة التقويمات التحريرية" },
  { key: "{total}", label: "المجموع" },
  { key: "{max}", label: "الدرجة العظمى" },
  { key: "{pct}", label: "النسبة المئوية" },
  { key: "{band}", label: "التقدير" },
  { key: "{school}", label: "اسم المدرسة" },
  { key: "{teacher}", label: "اسم المعلم" },
];

/** الصيغة الافتراضية لرسالة ولي الأمر */
export const WA_DEFAULT_TEMPLATE = [
  "أهلاً وسهلاً، ولي أمر الطالب/ة {student}",
  "{school}",
  "المادة: {subject} — {class}",
  "الفترة: {axis}",
  "--------------------------",
  "المهام الأدائية: {perf}",
  "التقويمات التحريرية: {written}",
  "المجموع: {total} من {max}",
  "النسبة: {pct}",
  "التقدير: {band}",
  "--------------------------",
  "مع خالص التحية — {teacher}",
].join("\n");

/** استبدال أماكن الاستبدال في الصيغة بالقيم الفعلية */
export function renderTemplate(
  template: string,
  data: Record<string, string | number | null>
): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => {
    const v = data[key];
    return v === null || v === undefined ? "—" : String(v);
  });
}

/** رابط wa.me مع الرسالة (يفتح واتساب بالرسالة جاهزة للإرسال) */
export function waLink(phone: string, message: string): string | null {
  const p = normalizeSaudiPhone(phone);
  if (!p) return null;
  return `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
}

/** رابط SMS (يفتح تطبيق الرسائل في الجوال بالرسالة جاهزة) */
export function smsLink(phone: string, message: string): string | null {
  const p = normalizeSaudiPhone(phone);
  if (!p) return null;
  return `sms:+${p}?body=${encodeURIComponent(message)}`;
}

export type WaChannel = "wa" | "sms";

/** بناء رابط حسب القناة (واتساب أو رسالة نصية) */
export function channelLink(channel: WaChannel, phone: string, message: string): string | null {
  return channel === "sms" ? smsLink(phone, message) : waLink(phone, message);
}

export function openWhatsApp(phone: string, message: string): boolean {
  const link = waLink(phone, message);
  if (!link) return false;
  window.open(link, "_blank", "noopener,noreferrer");
  return true;
}
