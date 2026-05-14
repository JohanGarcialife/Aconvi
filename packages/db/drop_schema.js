import pg from 'pg';
const { Client } = pg;

async function main() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();

  try {
    await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;");
    console.log("Database cleared successfully.");
  } catch (e) {
    console.error(e);
  }

  await client.end();
}

main();
