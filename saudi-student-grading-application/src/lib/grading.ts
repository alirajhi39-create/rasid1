// ============================================================
//  أدوات التقويم والتقدير — لائحة تقويم الطالب في التعليم العام السعودي
// ============================================================

export type GradeBand = {
  label: string;
  min: number; // النسبة المئوية
  color: string;
  bg: string;
  text: string;
};

export const GRADE_BANDS: GradeBand[] = [
  { label: "ممتاز", min: 90, color: "#047857", bg: "#d1fae5", text: "#065f46" },
  { label: "جيد جداً", min: 80, color: "#0f766e", bg: "#ccfbf1", text: "#115e59" },
  { label: "جيد", min: 70, color: "#1d4ed8", bg: "#dbeafe", text: "#1e40af" },
  { label: "مقبول", min: 60, color: "#b45309", bg: "#fef3c7", text: "#92400e" },
  { label: "ضعيف", min: 0, color: "#b91c1c", bg: "#fee2e2", text: "#991b1b" },
];

/** التقدير حسب النسبة المئوية من العظمى */
export function gradeBand(percent: number): GradeBand {
  for (const b of GRADE_BANDS) if (percent >= b.min) return b;
  return GRADE_BANDS[GRADE_BANDS.length - 1];
}

/** التقدير بلفظ اللائحة (+ امتياز/لم يجتز إن رغبت الوزارة) */
export function gradeLabel(percent: number): string {
  return gradeBand(percent).label;
}

export function percent(total: number, maxTotal: number): number {
  if (!maxTotal) return 0;
  return Math.round((total / maxTotal) * 1000) / 10;
}

export function isPassing(total: number, passScore: number): boolean {
  return total >= passScore;
}

export function formatNumber(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(digits).replace(/\.0$/, "");
}

export function classDisplay(c: { name: string; gradeLabel: string }): string {
  return `${c.gradeLabel} — ${c.name}`;
}
