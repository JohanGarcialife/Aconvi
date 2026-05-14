import pg from 'pg';
import crypto from 'crypto';
const { Client } = pg;

const URL = "postgresql://neondb_owner:npg_IgHweKx57Xqs@ep-long-voice-amt10dnk-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const client = new Client({ connectionString: URL });
  await client.connect();

  const orgId = 'org_aconvi_demo';

  try {
    // ── 1. Check what tables exist
    console.log("Checking providers...");

    const existingProviders = await client.query(`SELECT id FROM "provider" WHERE organization_id = $1`, [orgId]);
    if (existingProviders.rows.length === 0) {
      console.log("Adding demo providers...");
      await client.query(`
        INSERT INTO "provider" (id, organization_id, name, avatar_initials, speciality, rating, is_trusted, completed_jobs, avg_days_to_resolve, phone, email, price_range_min, price_range_max)
        VALUES
          ($1, $2, 'Electricidad Martínez', 'EM', 'Electricidad', 4.8, true, 47, 2, '+34 612 345 678', 'martinez@electrico.es', 80, 200),
          ($3, $2, 'Fontanería García', 'FG', 'Fontanería', 4.5, true, 32, 3, '+34 623 456 789', 'garcia@fontaneros.es', 60, 180),
          ($4, $2, 'Cerrajería Rápida', 'CR', 'Cerrajería', 4.9, true, 85, 1, '+34 634 567 890', 'info@cerrajeria.es', 50, 150),
          ($5, $2, 'Pinturas López', 'PL', 'Pintura', 4.2, false, 18, 5, '+34 645 678 901', 'lopez@pinturas.es', 100, 400)
        ON CONFLICT DO NOTHING
      `, [
        crypto.randomUUID(), orgId,
        crypto.randomUUID(),
        crypto.randomUUID(),
        crypto.randomUUID()
      ]);
      console.log("Demo providers added");
    } else {
      console.log(`Providers already exist (${existingProviders.rows.length}), skipping`);
    }

    // ── 3. Show current state
    const stats = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM "notice" WHERE organization_id = $1) as notices,
        (SELECT COUNT(*) FROM "common_area" WHERE organization_id = $1) as common_areas,
        (SELECT COUNT(*) FROM "community_document" WHERE organization_id = $1) as documents,
        (SELECT COUNT(*) FROM "provider" WHERE organization_id = $1) as providers,
        (SELECT COUNT(*) FROM "incident" WHERE organization_id = $1) as incidents
    `, [orgId]);
    
    console.log("\n✅ Current DB state for org_aconvi_demo:");
    console.table(stats.rows[0]);

  } catch (e) {
    console.error("❌ Error:", e.message);
    console.error(e);
  }

  await client.end();
}

main();
