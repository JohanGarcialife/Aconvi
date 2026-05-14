import pg from 'pg';
const { Client } = pg;

async function main() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();

  const queries = [
    `ALTER TABLE incident ADD COLUMN assigned_at timestamp with time zone`,
    `ALTER TABLE incident ADD COLUMN resolved_at timestamp with time zone`,
    `ALTER TABLE incident ADD COLUMN rejected_at timestamp with time zone`
  ];

  for (const q of queries) {
    try {
      await client.query(q);
      console.log("Success: ", q);
    } catch (e) {
      console.log("Error for: ", q, " -> ", e.message);
    }
  }

  await client.end();
  console.log("Done.");
}

main();
