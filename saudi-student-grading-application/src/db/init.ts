import { sql } from "drizzle-orm";
import { db } from "./index";
import { hashPassword } from "@/lib/auth";

/**
 * التهيئة التلقائية لقاعدة البيانات — تعمل عند أول تشغيل على أي استضافة
 * (Vercel + Neon) دون الحاجة لتنفيذ أي أمر SQL يدوياً.
 * آمنة للتكرار (idempotent): لا تمس أي بيانات موجودة، وتُهجّر الأعمدة الناقصة تلقائياً.
 */

const DDL = `
CREATE TABLE IF NOT EXISTS teachers (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL DEFAULT 'المعلم',
  job_title TEXT NOT NULL DEFAULT 'معلم أول',
  password_hash TEXT NOT NULL,
  school_name TEXT NOT NULL DEFAULT 'مدرسة المستقبل النموذجية',
  education_admin TEXT NOT NULL DEFAULT 'الإدارة العامة للتعليم بمنطقة الرياض',
  education_office TEXT NOT NULL DEFAULT 'مكتب التعليم بالمحافظة',
  city TEXT NOT NULL DEFAULT 'الرياض',
  principal_name TEXT NOT NULL DEFAULT 'أ. سعد بن فهد القحطاني',
  academic_year TEXT NOT NULL DEFAULT '1447هـ',
  semester TEXT NOT NULL DEFAULT 'الفصل الدراسي الأول',
  stage TEXT NOT NULL DEFAULT 'متوسط',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade_label TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'متوسط',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  national_id TEXT NOT NULL DEFAULT '',
  guardian_phone TEXT NOT NULL DEFAULT '',
  gender TEXT NOT NULL DEFAULT 'ذكر',
  notes TEXT NOT NULL DEFAULT '',
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_nid ON students(national_id);

CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  max_total NUMERIC(6,2) NOT NULL DEFAULT 100,
  pass_score NUMERIC(6,2) NOT NULL DEFAULT 50,
  color TEXT NOT NULL DEFAULT '#0f766e',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grade_components (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'performance',
  max_score NUMERIC(6,2) NOT NULL DEFAULT 10,
  weight_label TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_components_subject ON grade_components(subject_id);

CREATE TABLE IF NOT EXISTS grades (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  component_id INTEGER NOT NULL REFERENCES grade_components(id) ON DELETE CASCADE,
  semester SMALLINT NOT NULL DEFAULT 1,
  period SMALLINT NOT NULL DEFAULT 1,
  value NUMERIC(6,2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grades_component ON grades(component_id);

CREATE TABLE IF NOT EXISTS subject_grade_links (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  grade_label TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_subject_grade_link ON subject_grade_links(subject_id, grade_label);
CREATE INDEX IF NOT EXISTS idx_subject_grade_link_label ON subject_grade_links(grade_label);
`;

// تهجير القواعد القائمة: إضافة teacher_id وفهرسة — آمن للتكرار دائماً
const MIGRATION = `
ALTER TABLE classes ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE;
UPDATE classes SET teacher_id = (SELECT MIN(id) FROM teachers) WHERE teacher_id IS NULL;
UPDATE subjects SET teacher_id = (SELECT MIN(id) FROM teachers) WHERE teacher_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_subjects_teacher ON subjects(teacher_id);

-- فصلان دراسيان وفترتان لكل فصل: إضافة أبعاد الفصل والفترة على الدرجات
ALTER TABLE grades ADD COLUMN IF NOT EXISTS semester SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE grades ADD COLUMN IF NOT EXISTS period SMALLINT NOT NULL DEFAULT 1;
DROP INDEX IF EXISTS uq_grade_student_component;
CREATE UNIQUE INDEX IF NOT EXISTS uq_grade_student_component_sem_per ON grades(student_id, component_id, semester, period);

-- جدول الربط القديم (نحتفظ به للرجوع، ولا يُستخدم)
CREATE TABLE IF NOT EXISTS subject_grade_links (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  grade_label TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_subject_grade_link ON subject_grade_links(subject_id, grade_label);
CREATE INDEX IF NOT EXISTS idx_subject_grade_link_label ON subject_grade_links(grade_label);

-- الربط المباشر لكل فصل: المادة تظهر فقط في الفصول المرتبطة بها (بدون غموض أسامي الصفوف)
CREATE TABLE IF NOT EXISTS subject_class_links (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_subject_class_link ON subject_class_links(subject_id, class_id);
CREATE INDEX IF NOT EXISTS idx_subject_class_link_class ON subject_class_links(class_id);

-- النسخ الاحتياطية التلقائية (لقطات JSONB لمساحة عمل كل معلم — آخر 5)
CREATE TABLE IF NOT EXISTS backups (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_backups_teacher ON backups(teacher_id);

-- النموذج الجديد: المهام الأدائية 40 + التقويمات التحريرية 60 (آمن للتكرار)
-- 1) الأعمدة الأدائية أولاً: المهام الأدائية والمشاركة
UPDATE grade_components SET category='performance' WHERE category='formative' AND (name ILIKE '%أدائ%' OR name ILIKE '%مشاركة%' OR name ILIKE '%تفاعل%');
-- 2) ما تبقى من formative وfinal وcustom → تحريرية
UPDATE grade_components SET category='written' WHERE category IN ('formative','final','custom');
-- 3) ضبط الأعظميات للنموذج الجديد
UPDATE grade_components SET max_score=25 WHERE name='المهام الأدائية' AND max_score=20;
UPDATE grade_components SET max_score=20 WHERE name='الاختبار القصير' AND max_score=15;
UPDATE grade_components SET name='الاختبارات القصيرة' WHERE name='الاختبار القصير';
UPDATE grade_components SET name='الاختبار النهائي التحريري' WHERE name='الاختبار النهائي — تحريري';
-- 4) عمود «عملي / شفهي» القديم: يُرحَّل للأدائية ويُوقَف مع الاحتفاظ بدرجاته
UPDATE grade_components SET category='performance', is_active=FALSE WHERE name='الاختبار النهائي — عملي / شفهي';
`;

// Backfill يُنفذ مرة واحدة في العمر عبر جدول rased_meta —
// حتى لا تُعاد كتابة الروابط بعد أن يفك المعلم ربطها
const BACKFILL_LINKS = `
INSERT INTO subject_grade_links (subject_id, grade_label)
SELECT DISTINCT s.id, c.grade_label
FROM subjects s JOIN classes c ON c.teacher_id = s.teacher_id
ON CONFLICT (subject_id, grade_label) DO NOTHING;
`;

// توزيع الدرجات الافتراضي: المهام الأدائية 40 + التقويمات التحريرية 60 = 100
const DEFAULT_COMPONENTS = [
  { name: "المهام الأدائية", category: "performance", maxScore: 25, weightLabel: "أداء عملي", sortOrder: 1 },
  { name: "المشاركة والتفاعل الصفي", category: "performance", maxScore: 15, weightLabel: "", sortOrder: 2 },
  { name: "الواجبات والتطبيقات", category: "written", maxScore: 10, weightLabel: "", sortOrder: 3 },
  { name: "الاختبارات القصيرة", category: "written", maxScore: 20, weightLabel: "تحريري", sortOrder: 4 },
  { name: "الاختبار النهائي التحريري", category: "written", maxScore: 30, weightLabel: "نهائي", sortOrder: 5 },
] as const;

const DEFAULT_SUBJECTS: Array<{ name: string; color: string }> = [
  { name: "الرياضيات", color: "#0e5c3a" },
  { name: "لغتي الخالدة", color: "#8a5a00" },
  { name: "العلوم", color: "#0f766e" },
  { name: "الدراسات الاجتماعية", color: "#4338ca" },
  { name: "اللغة الإنجليزية", color: "#be123d" },
  { name: "الحاسب الآلي", color: "#0369a1" },
];

const DEMO_CLASSES = [
  { name: "3/أ", gradeLabel: "الصف الثالث المتوسط", stage: "متوسط", sortOrder: 1 },
  { name: "3/ب", gradeLabel: "الصف الثالث المتوسط", stage: "متوسط", sortOrder: 2 },
  { name: "2/أ", gradeLabel: "الصف الثاني الثانوي", stage: "ثانوي", sortOrder: 3 },
];

const DEMO_STUDENTS: Array<[string, string, number]> = [
  ["محمد عبدالله الشمري", "1100456781", 0],
  ["فهد سعد العتيبي", "1100456782", 0],
  ["عبدالعزيز خالد القحطاني", "1100456783", 0],
  ["يوسف ناصر الدوسري", "1100456784", 0],
  ["سلطان فواز الزامل", "1100456785", 0],
  ["تركي مبارك العجمي", "1100456786", 0],
  ["راكان حمد النجار", "1100456787", 0],
  ["بندر علي الغامدي", "1100456788", 0],
  ["ماجد سلمان الخالدي", "1100456789", 0],
  ["زياد وليد المطيري", "1100456790", 0],
  ["عمر فارس الرشيدي", "1100456791", 0],
  ["غسان ماهر الزهراني", "1100456792", 0],
  ["آدم خليل الشهراني", "1100456793", 1],
  ["جاسم حسن البقمي", "1100456794", 1],
  ["لوئي طلال الجهني", "1100456795", 1],
  ["كنان رائد السلمي", "1100456796", 1],
  ["يزيد منصور العنزي", "1100456797", 1],
  ["شهاب جمال العسيري", "1100456798", 1],
  ["مؤمن طاهر القرشي", "1100456799", 1],
  ["ريان عصام المهيري", "1100456800", 1],
  ["تالين وائل الأحمدي", "1100456801", 1],
  ["همام رامي النويصر", "1100456802", 1],
  ["لؤي أمير خاشقجي", "1100456803", 2],
  ["جود أيمن بصفر", "1100456804", 2],
  ["يزن كريم عثمان", "1100456805", 2],
  ["آدم تامر كردي", "1100456806", 2],
  ["ليان طارق جابر", "1100456807", 2],
  ["سديم مروان خطاطبه", "1100456808", 2],
];

// مولّد أرقام شبه عشوائية ثابت (لبيانات تجريبية واقعية لا تتغير بين التشغيلات)
function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** تبذير المواد الافتراضية + توزيع لائحي لكل خانة — يُستخدم عند التسجيل لمساحة عمل معلم جديد */
export async function seedDefaultSubjectsForTeacher(teacherId: number): Promise<number> {
  let created = 0;
  for (let i = 0; i < DEFAULT_SUBJECTS.length; i++) {
    const s = DEFAULT_SUBJECTS[i];
    const inserted = await db.execute<{ id: number }>(sql`
      INSERT INTO subjects (teacher_id, name, max_total, pass_score, color, sort_order)
      VALUES (${teacherId}, ${s.name}, 100, 50, ${s.color}, ${i + 1})
      RETURNING id
    `);
    const subjectId = inserted.rows[0]?.id;
    if (subjectId) {
      for (const c of DEFAULT_COMPONENTS) {
        await db.execute(sql`
          INSERT INTO grade_components (subject_id, name, category, max_score, weight_label, is_active, sort_order)
          VALUES (${subjectId}, ${c.name}, ${c.category}, ${c.maxScore}, ${c.weightLabel}, TRUE, ${c.sortOrder})
        `);
      }
      created++;
    }
  }
  return created;
}

export type InitReport = {
  tablesCreated: boolean;
  teacherSeeded: boolean;
  classesSeeded: number;
  studentsSeeded: number;
  subjectsSeeded: number;
  gradesSeeded: number;
};

let initPromise: Promise<InitReport> | null = null;

export async function initializeDatabase(): Promise<InitReport> {
  const report: InitReport = {
    tablesCreated: false,
    teacherSeeded: false,
    classesSeeded: 0,
    studentsSeeded: 0,
    subjectsSeeded: 0,
    gradesSeeded: 0,
  };

  // 1) إنشاء الجداول + تهجير القواعد القائمة (DDL آمن للتكرار)
  await db.execute(sql.raw(DDL));
  await db.execute(sql.raw(MIGRATION));
  // جدول الترحيل الأحادي (يمنع إعادة أي Backfill مستقبلاً)
  await db.execute(sql`CREATE TABLE IF NOT EXISTS rased_meta (key TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const mark = await db.execute<{ key: string }>(sql`
    INSERT INTO rased_meta (key) VALUES ('subject_links_backfill_v1')
    ON CONFLICT (key) DO NOTHING RETURNING key
  `);
  // يُنفذ Backfill مرة واحدة في العمر — والأفضل تنفيذه في النهاية بعد التبذير
  const linksBackfillPending = mark.rows.length > 0;
  // v2: تحويل الربط من أسماء الصفوف النصية إلى الربط المباشر بالفصول (مرة واحدة)
  const mark2 = await db.execute<{ key: string }>(sql`
    INSERT INTO rased_meta (key) VALUES ('subject_class_links_backfill_v2')
    ON CONFLICT (key) DO NOTHING RETURNING key
  `);
  const classLinksBackfillPending = mark2.rows.length > 0;
  report.tablesCreated = true;

  // 2) حساب أول معلم (يُنشأ فقط إذا لم توجد أي حسابات — الحساب المالك للبيانات الحالية)
  const teacherCount = await db.execute<{ c: string }>(sql`SELECT COUNT(*)::text AS c FROM teachers`);
  let ownerId: number | null = null;
  if (Number(teacherCount.rows[0]?.c ?? "0") === 0) {
    const hash = await hashPassword("123456");
    const inserted = await db.execute<{ id: number }>(sql`
      INSERT INTO teachers (username, full_name, job_title, password_hash, school_name, education_admin, education_office, city, principal_name, academic_year, semester, stage)
      VALUES ('teacher', 'أ. فواز عبدالرحمن العتيبي', 'معلم أول — رياضيات', ${hash}, 'مدرسة المستقبل النموذجية', 'الإدارة العامة للتعليم بمنطقة الرياض', 'مكتب التعليم بشمال الرياض', 'الرياض', 'أ. سعد بن فهد القحطاني', '1447هـ', 'الفصل الدراسي الأول', 'متوسط')
      RETURNING id
    `);
    ownerId = inserted.rows[0]?.id ?? null;
    report.teacherSeeded = true;
  }

  // مالك البيانات الحالية (أول معلم مسجل)
  if (ownerId === null) {
    const first = await db.execute<{ id: number }>(sql`SELECT MIN(id)::int AS id FROM teachers`);
    ownerId = first.rows[0]?.id ?? null;
  }

  // 3) المواد + التوزيع الافتراضي (فقط إذا لا توجد أي مواد لهذا المالك)
  const subjectCount = await db.execute<{ c: string }>(
    sql`SELECT COUNT(*)::text AS c FROM subjects WHERE teacher_id = ${ownerId}`
  );
  if (Number(subjectCount.rows[0]?.c ?? "0") === 0 && ownerId) {
    report.subjectsSeeded = await seedDefaultSubjectsForTeacher(ownerId);
  }

  // 4) فصول + طلاب تجريبيون (فقط إذا لا توجد أي فصول لهذا المالك)
  const classCount = await db.execute<{ c: string }>(
    sql`SELECT COUNT(*)::text AS c FROM classes WHERE teacher_id = ${ownerId}`
  );
  if (Number(classCount.rows[0]?.c ?? "0") === 0 && ownerId) {
    const classIds: number[] = [];
    for (const c of DEMO_CLASSES) {
      const inserted = await db.execute<{ id: number }>(sql`
        INSERT INTO classes (teacher_id, name, grade_label, stage, sort_order)
        VALUES (${ownerId}, ${c.name}, ${c.gradeLabel}, ${c.stage}, ${c.sortOrder})
        RETURNING id
      `);
      classIds.push(inserted.rows[0]?.id);
    }
    report.classesSeeded = classIds.length;

    const rand = seededRandom(20250507);
    const studentIds: Array<{ id: number; classIdx: number }> = [];
    for (const [name, nid, classIdx] of DEMO_STUDENTS) {
      const inserted = await db.execute<{ id: number }>(sql`
        INSERT INTO students (full_name, national_id, guardian_phone, gender, class_id)
        VALUES (${name}, ${nid}, ${"05" + String(Math.floor(rand() * 1e8)).padStart(8, "0")}, 'ذكر', ${classIds[classIdx]})
        RETURNING id
      `);
      studentIds.push({ id: inserted.rows[0]?.id, classIdx });
    }
    report.studentsSeeded = studentIds.length;
  }

  // 5) رصد درجات تجريبية واقعية للعام كاملاً (فقط إذا جدول الدرجات فارغ)
  const gradeCount = await db.execute<{ c: string }>(sql`SELECT COUNT(*)::text AS c FROM grades`);
  if (Number(gradeCount.rows[0]?.c ?? "0") === 0) {
    const comps = await db.execute<{ id: number; max_score: string }>(sql`
      SELECT gc.id, gc.max_score
      FROM grade_components gc JOIN subjects s ON s.id = gc.subject_id
      WHERE s.teacher_id = ${ownerId}
    `);
    const studentRows = await db.execute<{ id: number }>(sql`
      SELECT s.id FROM students s JOIN classes c ON c.id = s.class_id
      WHERE c.teacher_id = ${ownerId} ORDER BY s.id
    `);
    const rand = seededRandom(20250507);
    let insertedGrades = 0;
    for (const st of studentRows.rows) {
      const ability = 0.45 + rand() * 0.6;
      for (const comp of comps.rows) {
        const max = Number(comp.max_score);
        for (const semester of [1, 2]) {
          for (const period of [1, 2]) {
            if (rand() < 0.06) continue;
            const noise = (rand() - 0.5) * 0.25;
            const semesterShift = semester === 2 ? 0.03 : 0;
            let score = max * Math.min(1, Math.max(0.08, ability + semesterShift + noise));
            score = Math.round(score * 2) / 2;
            await db.execute(sql`
              INSERT INTO grades (student_id, component_id, semester, period, value)
              VALUES (${st.id}, ${comp.id}, ${semester}, ${period}, ${score})
              ON CONFLICT (student_id, component_id, semester, period) DO NOTHING
            `);
            insertedGrades++;
          }
        }
      }
    }
    report.gradesSeeded = insertedGrades;
  }

  // Backfill الأحادي للربط — يُنفذ في النهاية حتى يشمل البيانات المُبذَّرة في التشغيل الأول
  if (linksBackfillPending) {
    await db.execute(sql.raw(BACKFILL_LINKS));
  }

  // v2: الربط المباشر بالفصول — يُحوّل الروابط النصية (grade_label) إلى روابط (subject_id, class_id)
  if (classLinksBackfillPending) {
    await db.execute(sql`
      INSERT INTO subject_class_links (subject_id, class_id)
      SELECT s.id, c.id
      FROM subjects s
      JOIN classes c ON c.teacher_id = s.teacher_id
      JOIN subject_grade_links l ON l.subject_id = s.id AND l.grade_label = c.grade_label
      ON CONFLICT (subject_id, class_id) DO NOTHING
    `);
    // لا توجد أي روابط نصية: نربط كل المواد بكل فصول معلمها (حالة القاعدة الفارغة)
    const anyOld = await db.execute<{ c: string }>(sql`SELECT COUNT(*)::text AS c FROM subject_grade_links`);
    if (Number(anyOld.rows[0]?.c ?? "0") === 0) {
      await db.execute(sql`
        INSERT INTO subject_class_links (subject_id, class_id)
        SELECT s.id, c.id FROM subjects s JOIN classes c ON c.teacher_id = s.teacher_id
        ON CONFLICT (subject_id, class_id) DO NOTHING
      `);
    }
  }

  // ملاحظة: لا يوجد أي ربط تلقائي ضمني بعد هذه النقطة — الروابط تنشأ فقط عبر:
  // 1) Backfill الأحادي أعلاه (مرة واحدة في العمر — لا يمس ما يفكّه المعلم لاحقاً)
  // 2) إنشاء مادة جديدة (تُربط بكل الفصول — والمعلم يفك ما يشاء ويبقى مفكوكاً)
  return report;
}

/** نسخة مغلّفة بتخزين مؤقت — تُستدعى من المسارات والصفحات عند الحاجة */
export function ensureInitialized(): Promise<InitReport> {
  if (!initPromise) {
    initPromise = initializeDatabase().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}
