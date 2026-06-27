import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema";

// Cache database connection in development to prevent connection leaks on hot reloads
const globalForDb = globalThis as unknown as {
  conn: pg.Pool | undefined;
};

const conn =
  globalForDb.conn ??
  new pg.Pool({
    connectionString: process.env.POSTGRES_URL!,
    max: 10, // Limit maximum connections per pool instance
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

if (process.env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle({
  client: conn,
  schema,
  casing: "snake_case",
});

