import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.POSTGRES_URL);

async function main() {
  try {
    await sql`ALTER TABLE provider ADD COLUMN avg_days_to_resolve integer DEFAULT 0`;
    console.log("Added avg_days_to_resolve");
  } catch (e) { console.log(e.message); }
  
  try {
    await sql`ALTER TABLE provider ADD COLUMN price_range_min integer`;
    console.log("Added price_range_min");
  } catch (e) { console.log(e.message); }
  
  try {
    await sql`ALTER TABLE provider ADD COLUMN price_range_max integer`;
    console.log("Added price_range_max");
  } catch (e) { console.log(e.message); }
  
  try {
    await sql`ALTER TABLE provider ADD COLUMN phone varchar(32)`;
    console.log("Added phone");
  } catch (e) { console.log(e.message); }
  
  try {
    await sql`ALTER TABLE provider ADD COLUMN email varchar(256)`;
    console.log("Added email");
  } catch (e) { console.log(e.message); }
  
  try {
    await sql`ALTER TABLE provider ADD COLUMN created_at timestamp with time zone DEFAULT now() NOT NULL`;
    console.log("Added created_at");
  } catch (e) { console.log(e.message); }
  
  try {
    await sql`ALTER TABLE provider ADD COLUMN updated_at timestamp with time zone DEFAULT now() NOT NULL`;
    console.log("Added updated_at");
  } catch (e) { console.log(e.message); }
  
  console.log("Done.");
}

main();
