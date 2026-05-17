import pg from "pg";

const { Client } = pg;

const client = new Client({
  connectionString:
    "postgresql://neondb_owner:npg_IgHweKx57Xqs@ep-long-voice-amt10dnk-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require",
});

await client.connect();
console.log("✅ Conectado a la base de datos");

try {
  await client.query(`
    ALTER TABLE incident
      ADD COLUMN IF NOT EXISTS category VARCHAR(64) NOT NULL DEFAULT 'otro',
      ADD COLUMN IF NOT EXISTS final_photo_url VARCHAR(1024);
  `);
  console.log("✅ Columnas 'category' y 'final_photo_url' añadidas correctamente");

  const res = await client.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'incident'
      AND column_name IN ('category', 'final_photo_url', 'photo_url', 'status', 'priority')
    ORDER BY column_name;
  `);
  console.log("\n📊 Columnas verificadas en tabla 'incident':");
  console.table(res.rows);
} catch (err) {
  console.error("❌ Error:", err.message);
} finally {
  await client.end();
  console.log("✅ Conexión cerrada");
}
