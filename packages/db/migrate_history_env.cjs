const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_IgHweKx57Xqs@ep-long-voice-amt10dnk-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require",
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("Creating incident_history table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "incident_history" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "incident_id" uuid NOT NULL,
        "actor_name" varchar(128) NOT NULL,
        "action" varchar(64) NOT NULL,
        "previous_status" varchar(64),
        "new_status" varchar(64),
        "comment" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    
    // Add foreign key constraint safely
    try {
      await client.query(`
        ALTER TABLE "incident_history" ADD CONSTRAINT "incident_history_incident_id_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident"("id") ON DELETE cascade ON UPDATE no action;
      `);
      console.log("FK constraint added.");
    } catch (e) {
      if (e.code === '42710') { // duplicate_object
        console.log("FK constraint already exists.");
      } else {
        throw e;
      }
    }
    console.log("Done!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    client.release();
    pool.end();
  }
}
run();
