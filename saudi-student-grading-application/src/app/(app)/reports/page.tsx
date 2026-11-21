"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import {
  FileText, Printer, FileSpreadsheet, Loader2, Table2, UserRound,
  BarChart3, AlertCircle, Download,
} from "lucide-react";
import { toast } from "@/components/AppShell";

type ClassItem = { id: number; name: string; grade_label: string; stage: string };
type SubjectItem = { id: number; name: string; color: string; is_active: boolean };
type Component = { id: number; name: string; category: string; max_score: number; weight_label: string; is_active: boolean };
type StudentRow = { id: number; full_name: string; national_id: string };
type SubjectInfo = { id: number; name: string; max_total: string | number; pass_score: string | number; color: string };
type TeacherInfo = {
  full_name: string; school_name: string; education_admin: string; education_office: string;
  city: string; principal_name: string; academic_year: string; semester: string; job_title: string;
};
type TabKey = "sheet" | "notices" | "analysis";

function band(pct: number) {
  if (pct >= 90) return { label: "ممتاز", comment: "أداء متميز — نرجو المحافظة على التفوق" };
  if (pct >= 80) return { label: "جيد جداً", comment: "أداء مميز — بخطوات قليلة يصل للامتياز" };
  if (pct >= 70) return { label: "جيد", comment: "مستوى جيد — يحتاج مزيداً من التركيز في المذاكرة" };
  if (pct >= 60) return { label: "مقبول", comment: "مقبول — يُنصح بمراجعة الدروس أولاً بأول" };
  return { label: "ضعيف", comment: "يحتاج خطة علاجية ومتابعة منزلية عاجلة" };
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** شعار وزارة التعليم (مبسّط): نخلة متقاطعة مع سيفين في إطار دائري */
function EducationEmblem({ size = 74 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" role="img" aria-label="شعار وزارة التعليم">
      <circle cx="48" cy="48" r="46" fill="#0a4630" stroke="#c9a24b" strokeWidth="3.5" />
      <circle cx="48" cy="48" r="37.5" fill="none" stroke="#c9a24b" strokeWidth="1.1" opacity="0.85" />
      {/* السيفان المتقاطعان */}
      <g stroke="#e7cf9a" strokeWidth="2.6" strokeLinecap="round" fill="none">
        <path d="M22 62 Q48 74 74 62" />
        <path d="M20 56 L27 66" />
        <path d="M76 56 L69 66" />
      </g>
      {/* النخلة */}
      <g fill="#e7cf9a">
        <path d="M48 18 c-2.2 4.5 -2.2 9 0 13.5 c2.2 -4.5 2.2 -9 0 -13.5 Z" />
        <path d="M36 22 c4.4 2.4 7.8 6.4 9.4 11.8 c-5.6 -0.9 -9.4 -5 -9.4 -11.8 Z" />
        <path d="M60 22 c-4.4 2.4 -7.8 6.4 -9.4 11.8 c5.6 -0.9 9.4 -5 9.4 -11.8 Z" />
        <path d="M27 32 c5.2 1.6 8.8 5.7 10.4 11.2 c-5.5 -0.6 -9.3 -4.6 -10.4 -11.2 Z" />
        <path d="M69 32 c-5.2 1.6 -8.8 5.7 -10.4 11.2 c5.5 -0.6 9.3 -4.6 10.4 -11.2 Z" />
        <path d="M45.5 33 h5 l-0.9 18 h-3.2 Z" />
      </g>
    </svg>
  );
}

function ReportsInner() {
  const searchParams = useSearchParams();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classId, setClassId] = useState(searchParams.get("classId") ?? "");
  const [subjectId, setSubjectId] = useState(searchParams.get("subjectId") ?? "");
  const [tab, setTab] = useState<TabKey>("sheet");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [subject, setSubject] = useState<SubjectInfo | null>(null);
  const [grades, setGrades] = useState<Record<number, Record<number, number | null>>>({});
  const [teacher, setTeacher] = useState<TeacherInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" }).then((r) => r.json()).then((d) => d.ok && setTeacher(d.teacher));
    fetch("/api/classes", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (d.ok) {
        setClasses(d.classes);
        if (!classId && d.classes[0]) setClassId(String(d.classes[0].id));
      }
    });
    fetch("/api/subjects", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (d.ok) {
        setSubjects(d.subjects.filter((s: SubjectItem) => s.is_active));
        if (!subjectId && d.subjects[0]) setSubjectId(String(d.subjects[0].id));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!classId || !subjectId) return;
    setLoading(true);
    fetch(`/api/grades?classId=${classId}&subjectId=${subjectId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setStudents(d.students);
          setSubject(d.subject);
          setComponents(d.components.filter((c: Component) => c.is_active));
          setGrades(d.grades ?? {});
        }
      })
      .finally(() => setLoading(false));
  }, [classId, subjectId]);

  const maxTotal = useMemo(() => components.reduce((a, c) => a + Number(c.max_score), 0), [components]);
  const passScore = subject ? Number(subject.pass_score) : 50;
  const activeClass = classes.find((c) => String(c.id) === classId);
  const classLabel = activeClass ? `${activeClass.grade_label} — فصل ${activeClass.name}` : "";
  const today = new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "long", year: "numeric" }).format(new Date());

  const rows = useMemo(() => students.map((s) => {
    const perComp = components.map((c) => {
      const v = grades?.[s.id]?.[c.id];
      return v === null || v === undefined ? null : Number(v);
    });
    const total = perComp.reduce<number>((a, v) => a + (v ?? 0), 0);
    const filled = perComp.filter((v) => v !== null).length;
    const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
    return { s, perComp, total, filled, pct, band: band(pct) };
  }), [students, components, grades, maxTotal]);

  const classAvg = rows.length ? rows.reduce((a, r) => a + r.pct, 0) / rows.length : 0;
  const passCount = rows.filter((r) => r.total >= passScore && r.filled > 0).length;
  const gradedCount = rows.filter((r) => r.filled > 0).length;

  // ============ تصدير Excel مطابق لقالب نور ============
  const exportNoor = () => {
    if (!subject || !teacher) return;
    setExporting(true);
    try {
      const title = `كشف رصد درجات مادة ${subject.name} — ${classLabel}`;
      const header = ["م", "رقم السجل المدني", "اسم الطالب",
        ...components.map((c) => `${c.name} (${fmt(Number(c.max_score))})`),
        `المجموع (${fmt(maxTotal)})`, "النسبة %", "التقدير"];
      const aoa: (string | number)[][] = [
        ["المملكة العربية السعودية"],
        ["وزارة التعليم"],
        [teacher.education_admin],
        [`${teacher.school_name} — ${teacher.city}`],
        [title],
        [`${teacher.semester} · العام الدراسي ${teacher.academic_year} · المعلم: ${teacher.full_name}`],
        [],
        header,
        ...rows.map((r, i) => [
          i + 1,
          r.s.national_id || "",
          r.s.full_name,
          ...r.perComp.map((v) => (v === null ? "" : v)),
          r.filled > 0 ? r.total : "",
          r.filled > 0 ? Number(r.pct.toFixed(1)) : "",
          r.filled > 0 ? r.band.label : "",
        ]),
        [],
        [`إعداد المعلم: ${teacher.full_name}`, "", "", "", "", "", `مدير المدرسة: ${teacher.principal_name}`, "", "الختم والتوقيع"],
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!views"] = [{ rightToLeft: true, showGridLines: false }];
      ws["!cols"] = [{ wch: 5 }, { wch: 17 }, { wch: 32 }, ...components.map(() => ({ wch: 15 })), { wch: 13 }, { wch: 10 }, { wch: 11 }];
      const lastCol = header.length - 1;
      ws["!merges"] = [0, 1, 2, 3, 4, 5].map((r) => ({ s: { r, c: 0 }, e: { r, c: Math.min(lastCol, 8) } }));
      const wb = XLSX.utils.book_new();
      wb.Workbook = { Views: [{ RTL: true }] };
      XLSX.utils.book_append_sheet(wb, ws, "رصد الدرجات");
      const fileName = `نور-${subject.name}-${activeClass?.grade_label ?? ""}-${activeClass?.name ?? ""}-${teacher.semester}.xlsx`.replace(/[\\/:*?"<>|]/g, "-");
      XLSX.writeFile(wb, fileName);
      toast("تم تصدير ملف Excel مطابق لقالب نور");
    } catch (err) {
      console.error(err);
      toast("تعذر إنشاء ملف Excel", "error");
    } finally {
      setExporting(false);
    }
  };

  const TABS: Array<{ key: TabKey; label: string; icon: typeof Table2 }> = [
    { key: "sheet", label: "كشف الرصد الرسمي", icon: Table2 },
    { key: "notices", label: "الإشعارات الفردية", icon: UserRound },
    { key: "analysis", label: "تحليل أداء الفصل", icon: BarChart3 },
  ];

  return (
    <div className="space-y-4">
      {/* ===== شريط التحكم (لا يُطبع) ===== */}
      <div className="no-print space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-[#0a4630]"><FileText className="text-[#c9a24b]" /> التقارير والطباعة والتصدير</h2>
            <p className="text-[0.72rem] font-semibold text-[#5c6f65]">كشوف رسمية بترويسة وزارة التعليم — جاهزة للطباعة والتصدير لنظام نور</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportNoor} disabled={exporting || loading} className="btn btn-gold">
              {exporting ? <Loader2 size={17} className="animate-spin" /> : <FileSpreadsheet size={17} />}
              تصدير Excel لنور
            </button>
            <button onClick={() => window.print()} className="btn btn-primary">
              <Printer size={17} /> طباعة / PDF
            </button>
          </div>
        </div>

        <div className="card flex flex-wrap items-center gap-3 p-3">
          <label className="flex items-center gap-2">
            <span className="text-[0.7rem] font-extrabold text-[#5c6f65]">الفصل</span>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className="input !w-auto font-bold">
              {classes.map((c) => <option key={c.id} value={c.id}>{c.grade_label} — {c.name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-[0.7rem] font-extrabold text-[#5c6f65]">المادة</span>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="input !w-auto font-bold">
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <div className="ms-auto flex gap-1 rounded-xl bg-[#eef1ec] p-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[0.72rem] font-extrabold transition ${active ? "bg-white text-[#0a4630] shadow" : "text-[#5c6f65]"}`}>
                  <Icon size={15} /> {t.label}
                </button>
              );
            })}
          </div>
        </div>
        {!loading && gradedCount === 0 && (
          <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-[0.72rem] font-bold text-amber-800">
            <AlertCircle size={15} /> لا توجد درجات مرصودة لهذه المادة بعد — ستُطبع الخلايا فارغة. ارصد الدرجات أولاً من صفحة «رصد الدرجات».
          </div>
        )}
      </div>

      {/* ===== منطقة الطباعة ===== */}
      {loading ? (
        <div className="shimmer no-print h-96 rounded-3xl" />
      ) : (
        <div className="print-area">
          {tab === "sheet" && (
            <div className="print-sheet">
              <SheetHeader teacher={teacher} subjectName={subject?.name ?? ""} classLabel={classLabel} today={today} docTitle={`كشف رصد درجات مادة ${subject?.name ?? ""}`} />
              <table className="sheet-table">
                <thead>
                  <tr>
                    <th rowSpan={2}>م</th>
                    <th rowSpan={2}>رقم السجل<br />المدني</th>
                    <th rowSpan={2}>اسم الطالب</th>
                    <th colSpan={components.length}>توزيع الدرجات</th>
                    <th rowSpan={2}>المجموع<br />{fmt(maxTotal)}</th>
                    <th rowSpan={2}>النسبة</th>
                    <th rowSpan={2}>التقدير</th>
                    <th rowSpan={2}>توقيع ولي<br />الأمر</th>
                  </tr>
                  <tr>
                    {components.map((c) => (
                      <th key={c.id}>{c.name}<br /><span style={{ fontWeight: 600, fontSize: "0.58rem" }}>({fmt(Number(c.max_score))})</span></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.s.id} style={r.filled > 0 && r.total < passScore ? { background: "#fdf1f1" } : undefined}>
                      <td>{i + 1}</td>
                      <td dir="ltr">{r.s.national_id || "—"}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{r.s.full_name}</td>
                      {r.perComp.map((v, j) => <td key={j}>{v === null ? "" : fmt(v)}</td>)}
                      <td style={{ fontWeight: 800 }}>{r.filled > 0 ? fmt(r.total) : ""}</td>
                      <td>{r.filled > 0 ? `${r.pct.toFixed(1)}%` : ""}</td>
                      <td style={{ fontWeight: 800 }}>{r.filled > 0 ? r.band.label : ""}</td>
                      <td style={{ minWidth: 70 }}></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#eef3ee", fontWeight: 800 }}>
                    <td colSpan={3}>المتوسط العام للفصل / عدد الناجحين</td>
                    {components.map((_, j) => {
                      const colVals = rows.map((r) => r.perComp[j]).filter((v): v is number => v !== null);
                      const avg = colVals.length ? colVals.reduce((a, b) => a + b, 0) / colVals.length : 0;
                      return <td key={j}>{colVals.length ? avg.toFixed(1) : "—"}</td>;
                    })}
                    <td colSpan={2}>{gradedCount > 0 ? `${classAvg.toFixed(1)}%` : "—"}</td>
                    <td colSpan={2}>{gradedCount > 0 ? `${passCount} / ${gradedCount}` : "—"}</td>
                  </tr>
                </tfoot>
              </table>
              <SignatureRow teacher={teacher} />
            </div>
          )}

          {tab === "notices" && (
            <div>
              {rows.map((r, i) => (
                <div key={r.s.id} className={`print-sheet ${i < rows.length - 1 ? "page-break" : ""} mb-6`}>
                  <SheetHeader teacher={teacher} subjectName={subject?.name ?? ""} classLabel={classLabel} today={today} docTitle="إشعار درجات الطالب" />
                  <div className="mb-3 grid grid-cols-2 gap-2 text-[0.75rem] sm:grid-cols-4">
                    {[
                      ["اسم الطالب", r.s.full_name],
                      ["رقم السجل المدني", r.s.national_id || "—"],
                      ["الصف / الفصل", classLabel],
                      ["المادة", subject?.name ?? ""],
                    ].map(([k, v]) => (
                      <div key={k as string} className="rounded-lg border border-[#dfe3da] bg-[#fbfbf8] p-2 text-center">
                        <div className="text-[0.58rem] font-bold text-[#7a857d]">{k}</div>
                        <div className="mt-0.5 font-extrabold text-[#0a4630]">{v}</div>
                      </div>
                    ))}
                  </div>
                  <table className="sheet-table">
                    <thead>
                      <tr>
                        {components.map((c) => <th key={c.id}>{c.name}<br /><span style={{ fontWeight: 600, fontSize: "0.56rem" }}>من {fmt(Number(c.max_score))}</span></th>)}
                        <th>المجموع<br />{fmt(maxTotal)}</th>
                        <th>النسبة</th><th>التقدير</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {r.perComp.map((v, j) => <td key={j} style={{ fontWeight: 700 }}>{v === null ? "—" : fmt(v)}</td>)}
                        <td style={{ fontWeight: 800 }}>{r.filled > 0 ? fmt(r.total) : "—"}</td>
                        <td>{r.filled > 0 ? `${r.pct.toFixed(1)}%` : "—"}</td>
                        <td style={{ fontWeight: 800 }}>{r.filled > 0 ? r.band.label : "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="mt-3 rounded-xl border border-dashed border-[#c9a24b] bg-[#fffdf2] p-3 text-[0.78rem] font-bold text-[#6b5518]">
                    <span className="text-[#a8843a]">تعليق المعلم: </span>{r.filled > 0 ? r.band.comment : "لم تُرصد درجاته بعد"}
                  </div>
                  <SignatureRow teacher={teacher} notice />
                </div>
              ))}
              {rows.length === 0 && <p className="no-print card p-10 text-center text-sm font-bold text-[#8a968d]">لا يوجد طلاب في هذا الفصل</p>}
            </div>
          )}

          {tab === "analysis" && (
            <div className="print-sheet">
              <SheetHeader teacher={teacher} subjectName={subject?.name ?? ""} classLabel={classLabel} today={today} docTitle="تقرير تحليل أداء الفصل" />
              <table className="sheet-table">
                <thead>
                  <tr><th>الخانة</th><th>العظمى</th><th>متوسط الكشف</th><th>أعلى درجة</th><th>أدنى درجة</th><th>نسبة الإتقان ≥ 60%</th></tr>
                </thead>
                <tbody>
                  {components.map((c, j) => {
                    const vals = rows.map((r) => r.perComp[j]).filter((v): v is number => v !== null);
                    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                    const maxV = vals.length ? Math.max(...vals) : 0;
                    const minV = vals.length ? Math.min(...vals) : 0;
                    const mastery = vals.length ? (vals.filter((v) => v / Number(c.max_score) >= 0.6).length / vals.length) * 100 : 0;
                    return (
                      <tr key={c.id}>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{c.name}</td>
                        <td>{fmt(Number(c.max_score))}</td>
                        <td>{vals.length ? avg.toFixed(2) : "—"}</td>
                        <td>{vals.length ? fmt(maxV) : "—"}</td>
                        <td>{vals.length ? fmt(minV) : "—"}</td>
                        <td>{vals.length ? `${mastery.toFixed(0)}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#eef3ee", fontWeight: 800 }}>
                    <td style={{ textAlign: "right" }}>الإجمالي</td>
                    <td>{fmt(maxTotal)}</td>
                    <td>{gradedCount > 0 ? (rows.reduce((a, r) => a + r.total, 0) / gradedCount).toFixed(2) : "—"}</td>
                    <td>{gradedCount > 0 ? fmt(Math.max(...rows.map((r) => r.total))) : "—"}</td>
                    <td>{gradedCount > 0 ? fmt(Math.min(...rows.map((r) => r.total))) : "—"}</td>
                    <td>{gradedCount > 0 ? `${((passCount / gradedCount) * 100).toFixed(0)}%` : "—"}</td>
                  </tr>
                </tfoot>
              </table>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                {[
                  ["عدد الطلاب", String(students.length)],
                  ["تم رصدهم", String(gradedCount)],
                  ["الناجحون", `${passCount} (${gradedCount ? Math.round((passCount / gradedCount) * 100) : 0}%)`],
                  ["المتوسط العام", `${classAvg.toFixed(1)}%`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-[#dfe3da] bg-[#fbfbf8] p-3">
                    <div className="text-xl font-black text-[#0a4630]">{v}</div>
                    <div className="text-[0.6rem] font-bold text-[#7a857d]">{k}</div>
                  </div>
                ))}
              </div>
              <SignatureRow teacher={teacher} />
            </div>
          )}
        </div>
      )}

      {/* زر تحميل عائم للجوال */}
      <button onClick={exportNoor} disabled={exporting}
        className="no-print fixed bottom-5 left-5 z-40 grid h-14 w-14 place-items-center rounded-2xl bg-[#0a4630] text-[#e7cf9a] shadow-2xl transition hover:scale-105 lg:hidden"
        aria-label="تصدير نور">
        {exporting ? <Loader2 size={22} className="animate-spin" /> : <Download size={22} />}
      </button>
    </div>
  );
}

/** ترويسة وزارة التعليم المشتركة */
function SheetHeader({ teacher, subjectName, classLabel, today, docTitle }: {
  teacher: TeacherInfo | null; subjectName: string; classLabel: string; today: string; docTitle: string;
}) {
  return (
    <>
      <div className="ministry-head">
        <div className="col" style={{ textAlign: "right", flex: 1 }}>
          <strong style={{ fontSize: "0.82rem" }}>المملكة العربية السعودية</strong><br />
          <strong style={{ fontSize: "0.82rem" }}>وزارة التعليم</strong><br />
          <span style={{ fontSize: "0.68rem" }}>{teacher?.education_admin}</span><br />
          <span style={{ fontSize: "0.68rem" }}>{teacher?.education_office}</span>
        </div>
        <div className="col"><EducationEmblem size={78} /></div>
        <div className="col" style={{ textAlign: "left", flex: 1 }}>
          <strong style={{ fontSize: "0.82rem" }}>{teacher?.school_name}</strong><br />
          <span style={{ fontSize: "0.68rem" }}>إدارة المدرسة · {teacher?.city}</span><br />
          <span style={{ fontSize: "0.68rem" }}>{teacher?.academic_year} · {teacher?.semester}</span><br />
          <span style={{ fontSize: "0.68rem" }}>تاريخ الإصدار: {today}</span>
        </div>
      </div>
      <div className="doc-title">
        {docTitle}
        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#333", marginTop: 2 }}>
          {classLabel} · المادة: {subjectName} · المعلم: {teacher?.full_name} ({teacher?.job_title})
        </div>
      </div>
    </>
  );
}

/** صف التوقيعات */
function SignatureRow({ teacher, notice = false }: { teacher: TeacherInfo | null; notice?: boolean }) {
  return (
    <div className="sign-row">
      <div className="sign-box">
        <div style={{ fontWeight: 800, fontSize: "0.72rem" }}>معلم المادة</div>
        <div className="sign-line" />
        <div style={{ fontSize: "0.72rem" }}>{teacher?.full_name}</div>
      </div>
      {!notice && (
        <div className="sign-box">
          <div style={{ fontWeight: 800, fontSize: "0.72rem" }}>رائد النشاط / ولي الأمر</div>
          <div className="sign-line" />
          <div style={{ fontSize: "0.72rem" }}>الاسم والتوقيع</div>
        </div>
      )}
      <div className="sign-box">
        <div style={{ fontWeight: 800, fontSize: "0.72rem" }}>مدير المدرسة</div>
        <div className="sign-line" />
        <div style={{ fontSize: "0.72rem" }}>{teacher?.principal_name}</div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="shimmer h-96 rounded-3xl" />}>
      <ReportsInner />
    </Suspense>
  );
}
