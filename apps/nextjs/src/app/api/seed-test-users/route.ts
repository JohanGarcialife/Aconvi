import { NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { sql } from "drizzle-orm";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

// ─── PIN de prueba para todos los usuarios de test ────────────────────────────
// PIN: 123456  →  SHA-256: 8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92
const TEST_PIN = "123456";
const TEST_PIN_HASH = createHash("sha256").update(TEST_PIN).digest("hex");

const TEST_USERS = [
  {
    id: "test-user-vecino-001",
    name: "María García",
    email: "vecino@test.aconvi.com",
    corporateUsername: "vecino.test",
    role: "Vecino",
  },
  {
    id: "test-user-admin-001",
    name: "Carlos López",
    email: "admin@test.aconvi.com",
    corporateUsername: "admin.test",
    role: "Administrador",
  },
  {
    id: "test-user-proveedor-001",
    name: "Pedro Martínez",
    email: "proveedor@test.aconvi.com",
    corporateUsername: "proveedor.test",
    role: "Proveedor",
  },
];

export async function GET() {
  try {
    // Ensure mobile_pin_hash column exists (idempotent)
    await db.execute(
      sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS mobile_pin_hash text;`,
    );

    const results = [];

    for (const testUser of TEST_USERS) {
      await db.execute(sql`
        INSERT INTO "user" (
          id, name, email, email_verified, role,
          corporate_username, initial_pin_hash, mobile_pin_hash,
          pin_activated, updated_at, created_at
        )
        VALUES (
          ${testUser.id},
          ${testUser.name},
          ${testUser.email},
          true,
          ${testUser.role},
          ${testUser.corporateUsername},
          ${TEST_PIN_HASH},
          ${TEST_PIN_HASH},
          true,
          now(),
          now()
        )
        ON CONFLICT (email) DO UPDATE SET
          name                 = EXCLUDED.name,
          role                 = EXCLUDED.role,
          email_verified       = true,
          corporate_username   = EXCLUDED.corporate_username,
          initial_pin_hash     = EXCLUDED.initial_pin_hash,
          mobile_pin_hash      = EXCLUDED.mobile_pin_hash,
          pin_activated        = true,
          updated_at           = now();
      `);

      const row = await db.execute(sql`
        SELECT id, name, email, role, corporate_username, pin_activated
        FROM "user"
        WHERE email = ${testUser.email}
        LIMIT 1;
      `);

      results.push(row.rows[0]);
    }

    // Ensure organization exists
    await db.execute(sql`
      INSERT INTO "organization" (id, name, slug, created_at) 
      VALUES ('org_aconvi_demo', 'Aconvi Demo', 'aconvi-demo', now())
      ON CONFLICT (id) DO NOTHING;
    `);

    // Ensure provider record exists for the test provider user
    await db.execute(sql`
      INSERT INTO "provider" (
        id, organization_id, name, speciality, email, rating, is_trusted, completed_jobs, avg_days_to_resolve, created_at, updated_at
      )
      VALUES (
        '11111111-2222-3333-4444-555555555555',
        'org_aconvi_demo',
        'Pedro Martínez',
        'fontaneria',
        'proveedor@test.aconvi.com',
        5.0,
        true,
        12,
        2,
        now(),
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        updated_at = now();
    `);

    return NextResponse.json({
      success: true,
      message: "✅ Usuarios de prueba listos con PIN configurado",
      pin: TEST_PIN,
      users: results.map((r: any) => ({
        name: r.name,
        email: r.email,
        role: r.role,
        corporateUsername: r.corporate_username,
        pinActivated: r.pin_activated,
        loginInstructions: {
          usuario: r.corporate_username,
          pin: TEST_PIN,
        },
      })),
    });
  } catch (error: any) {
    console.error("[seed-test-users] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
