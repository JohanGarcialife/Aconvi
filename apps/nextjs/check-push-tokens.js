const { Pool } = require('pg');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

async function run() {
  console.log("Connecting and checking push tokens in DB...");
  try {
    const res = await pool.query('SELECT * FROM push_token');
    const tokens = res.rows;
    console.log(`Found ${tokens.length} push tokens:`);
    for (const t of tokens) {
      const uRes = await pool.query('SELECT name, email FROM "user" WHERE id = $1', [t.user_id]);
      const u = uRes.rows[0];
      console.log(`- Token: ${t.token.slice(0, 30)}... | Platform: ${t.platform} | User: ${u ? u.name : 'Unknown'} (${u ? u.email : 'N/A'}) | UserID: ${t.user_id}`);
    }
  } catch (err) {
    console.error("Error querying DB:", err);
  } finally {
    await pool.end();
  }
}

run();
