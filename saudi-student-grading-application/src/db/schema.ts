import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ============================================================
//  نظام رصد | مخطط قاعدة البيانات (متوافق مع نور ولائحة تقويم الطالب)
// ============================================================

export const teachers = pgTable("teachers", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  fullName: text("full_name").notNull().default("المعلم"),
  jobTitle: text("job_title").notNull().default("معلم أول"),
  passwordHash: text("password_hash").notNull(),
  schoolName: text("school_name").notNull().default("مدرسة المستقبل النموذجية"),
  educationAdmin: text("education_admin").notNull().default("الإدارة العامة للتعليم بمنطقة الرياض"),
  educationOffice: text("education_office").notNull().default("مكتب التعليم بالمحافظة"),
  city: text("city").notNull().default("الرياض"),
  principalName: text("principal_name").notNull().default("أ. سعد بن فهد القحطاني"),
  academicYear: text("academic_year").notNull().default("1447هـ"),
  semester: text("semester").notNull().default("الفصل الدراسي الأول"),
  stage: text("stage").notNull().default("متوسط"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const classes = pgTable(
  "classes",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id").references(() => teachers.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // مثال: 3/أ
    gradeLabel: text("grade_label").notNull(), // مثال: الصف الثالث المتوسط
    stage: text("stage").notNull().default("متوسط"), // ابتدائي | متوسط | ثانوي
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("idx_classes_teacher").on(t.teacherId)]
);

export const students = pgTable(
  "students",
  {
    id: serial("id").primaryKey(),
    fullName: text("full_name").notNull(),
    nationalId: text("national_id").notNull().default(""),
    guardianPhone: text("guardian_phone").notNull().default(""),
    gender: text("gender").notNull().default("ذكر"),
    notes: text("notes").notNull().default(""),
    classId: integer("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_students_class").on(t.classId),
    index("idx_students_nid").on(t.nationalId),
  ]
);

export const subjects = pgTable(
  "subjects",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id").references(() => teachers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    maxTotal: numeric("max_total", { precision: 6, scale: 2 }).notNull().default("100"),
    passScore: numeric("pass_score", { precision: 6, scale: 2 }).notNull().default("50"),
    color: text("color").notNull().default("#0f766e"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("idx_subjects_teacher").on(t.teacherId)]
);

export const gradeComponents = pgTable(
  "grade_components",
  {
    id: serial("id").primaryKey(),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // مثال: الاختبار القصير
    category: text("category").notNull().default("formative"), // formative | final | custom
    maxScore: numeric("max_score", { precision: 6, scale: 2 }).notNull().default("10"),
    weightLabel: text("weight_label").notNull().default(""), // وصف اختياري: (تحريري / عملي)
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("idx_components_subject").on(t.subjectId)]
);

export const grades = pgTable(
  "grades",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    componentId: integer("component_id")
      .notNull()
      .references(() => gradeComponents.id, { onDelete: "cascade" }),
    value: numeric("value", { precision: 6, scale: 2 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_grade_student_component").on(t.studentId, t.componentId),
    index("idx_grades_component").on(t.componentId),
  ]
);
