import { db } from './src/client';
import { sql } from 'drizzle-orm';

async function run() {
  try {
    console.log("Creating vote_session table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "vote_session" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE cascade,
        "author_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
        "title" varchar(256) NOT NULL,
        "description" text,
        "status" varchar(32) DEFAULT 'DRAFT' NOT NULL,
        "coefficient_weighted" boolean DEFAULT false NOT NULL,
        "closes_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "closed_at" timestamp with time zone
      );
    `);
    console.log('✅ Tabla vote_session creada exitosamente');
  } catch (error) {
    console.error("Error creating table:", error);
  } finally {
    process.exit(0);
  }
}
run();
