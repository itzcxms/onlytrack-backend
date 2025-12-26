import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./shared/schema.ts",
  out: "./drizzle",
  dialect: 'mysql',
  strict: true,
  verbose: true,
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
});
