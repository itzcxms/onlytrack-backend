// Reference: blueprint:javascript_database
import "dotenv/config";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = mysql.createPool(process.env.DATABASE_URL);
export const db = drizzle(pool, { schema, mode: "default" });

// Test database connection
export async function testConnection() {
  try {
    const [result] = await pool.query("SELECT NOW() as now");
    console.log("✅ Database connection successful");
    console.log("🕒 Server time:", (result as any)[0].now);
    return true;
  } catch (error: any) {
    console.error("❌ Database connection failed:", error.message);
    console.error(
      "Connection string:",
      process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@"),
    );
    return false;
  }
}
