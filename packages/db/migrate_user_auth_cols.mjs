import pg from 'pg';
const { Client } = pg;

async function main() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
  });

  await client.connect();
  console.log('Connected. Running user auth columns migration...\n');

  const alterations = [
    // phone_number / phone_number_verified (better-auth phone plugin)
    `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone_number" text UNIQUE`,
    `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone_number_verified" boolean NOT NULL DEFAULT false`,

    // Corporate username used for mobile login (e.g. "vecino.test", "jluis.admin")
    `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "corporate_username" text UNIQUE`,

    // One-time initial PIN (SHA-256 hash) used for first-login activation
    `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "initial_pin_hash" text`,
    `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "pin_activated" boolean NOT NULL DEFAULT false`,

    // Mobile PIN hash used for push-based authentication
    `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "mobile_pin_hash" text`,

    // Device token (Expo / FCM / APNs) bound to this account
    `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "device_token" text`,
    `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "device_activated_at" timestamp with time zone`,

    // name and email can be NULL in Aconvi (not all users have email)
    // safe no-op if constraints already exist or don't exist
  ];

  let success = 0;
  let skipped = 0;
  for (const sql of alterations) {
    try {
      await client.query(sql);
      const col = sql.match(/ADD COLUMN IF NOT EXISTS "([^"]+)"/)?.[1] ?? sql;
      console.log(`  ✅  ${col}`);
      success++;
    } catch (err) {
      const col = sql.match(/ADD COLUMN IF NOT EXISTS "([^"]+)"/)?.[1] ?? sql;
      console.warn(`  ⚠️  ${col}: ${err.message}`);
      skipped++;
    }
  }

  // Allow email to be NULL (some users log in only with corporate_username)
  try {
    await client.query(`ALTER TABLE "user" ALTER COLUMN "email" DROP NOT NULL`);
    console.log('  ✅  email NOT NULL constraint removed (nullable for corporate-only users)');
    success++;
  } catch (err) {
    // Already nullable — OK
    console.log('  ⏭️   email already nullable — skipping');
    skipped++;
  }

  // Allow name to have a default
  try {
    await client.query(`ALTER TABLE "user" ALTER COLUMN "name" SET DEFAULT 'Vecino'`);
    console.log('  ✅  name default set to Vecino');
    success++;
  } catch (err) {
    console.warn(`  ⚠️  name default: ${err.message}`);
    skipped++;
  }

  console.log(`\nDone. ${success} applied, ${skipped} skipped/already existed.`);
  await client.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
