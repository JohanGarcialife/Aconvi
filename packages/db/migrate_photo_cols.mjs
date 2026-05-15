import pg from 'pg';
const { Client } = pg;

async function main() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
  });
  
  await client.connect();
  
  console.log('Running direct migration to alter photoUrl and finalPhotoUrl to TEXT...');
  try {
    await client.query(`ALTER TABLE "incident" ALTER COLUMN "photo_url" TYPE TEXT;`);
    console.log('Successfully altered photo_url to TEXT.');
    await client.query(`ALTER TABLE "incident" ALTER COLUMN "final_photo_url" TYPE TEXT;`);
    console.log('Successfully altered final_photo_url to TEXT.');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await client.end();
  }
}

main();
