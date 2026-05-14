import pg from 'pg';
const { Client } = pg;

async function main() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();

  try {
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log(res.rows.map(r => r.table_name));
  } catch (e) {
    console.error(e);
  }

  await client.end();
}

main();
