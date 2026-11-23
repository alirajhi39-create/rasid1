import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

// دعم Neon تلقائياً: عند الربط عبر Vercel + Neon يُفعَّل SSL تلقائياً
const needsSsl =
  /sslmode=(require|verify-ca|verify-full)/i.test(databaseUrl) ||
  /neon\.tech/i.test(databaseUrl) ||
  process.env.PGSSL === "true";

const globalForDb = globalThis as typeof globalThis & {
  __rasedPool?: Pool;
};

export const pool =
  globalForDb.__rasedPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 15_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__rasedPool = pool;
}

export const db = drizzle(pool, { schema });
