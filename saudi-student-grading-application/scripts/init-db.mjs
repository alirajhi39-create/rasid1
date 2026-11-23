// ============================================================
//  إنشاء/تحديث جداول Neon تلقائياً عند البناء على Vercel
//  يُنفَّذ عبر buildCommand في vercel.json — آمن للتكرار (idempotent)
//  ولا يفشل البناء أبداً (يُسجّل التحذير ويُكمِل) حتى لو تعذّر الوصول لقاعدة البيانات
// ============================================================

import pg from "pg";

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

CREATE TABLE IF NOT EXISTS subject_class_links (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_subject_class_link ON subject_class_links(subject_id, class_id);
CREATE INDEX IF NOT EXISTS idx_subject_class_link_class ON subject_class_links(class_id);

CREATE TABLE IF NOT EXISTS backups (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_backups_teacher ON backups(teacher_id);

-- تحجيرات آمنة (إضافة أعمدة إن لم تكن موجودة)
ALTER TABLE classes ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE;
ALTER TABLE grades ADD COLUMN IF NOT EXISTS semester SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE grades ADD COLUMN IF NOT EXISTS period SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS band_excellent_min SMALLINT NOT NULL DEFAULT 90;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS band_very_good_min SMALLINT NOT NULL DEFAULT 80;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS band_good_min SMALLINT NOT NULL DEFAULT 70;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS band_pass_min SMALLINT NOT NULL DEFAULT 60;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS teacher_sig TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS principal_sig TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_subjects_teacher ON subjects(teacher_id);
DROP INDEX IF EXISTS uq_grade_student_component;
CREATE UNIQUE INDEX IF NOT EXISTS uq_grade_student_component_sem_per ON grades(student_id, component_id, semester, period);
`;

const url = process.env.DATABASE_URL;

async function main() {
  if (!url) {
    console.warn("⚠️  [init-db] DATABASE_URL غير مضبوط — تُتخطى تهيئة قاعدة البيانات عند البناء.");
    return;
  }
  const needsSsl = /sslmode=(require|verify-ca|verify-full)/i.test(url) || /neon\.tech/i.test(url);
  const client = new pg.Client({
    connectionString: url,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 15000,
  });
  try {
    await client.connect();
    await client.query(DDL);
    console.log("✅ [init-db] تم إنشاء/تحديث جداول قاعدة البيانات تلقائياً.");
  } catch (err) {
    // لا نفشل البناء — التهيئة تتم أيضاً ذاتياً عند أول طلب runtime
    console.warn("⚠️  [init-db] تعذّر الوصول لقاعدة البيانات عند البناء: " + (err?.message ?? err));
    console.warn("   لا تقلق — سيُتم إنشاء الجداول تلقائياً عند أول استخدام للتطبيق (تسجيل دخول/تسجيل).");
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
  process.exit(0);
}

main();
