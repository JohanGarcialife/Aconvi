import { NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// ─── Test users to seed ──────────────────────────────────────────────────────
const TEST_USERS = [
  {
    id: "test-user-vecino-001",
    name: "María García",
    email: "vecino@test.aconvi.com",
    role: "Vecino",
  },
  {
    id: "test-user-admin-001",
    name: "Carlos López",
    email: "admin@test.aconvi.com",
    role: "Administrador",
  },
  {
    id: "test-user-proveedor-001",
    name: "Pedro Martínez",
    email: "proveedor@test.aconvi.com",
    role: "Proveedor",
  },
];

export async function GET() {
  try {
    const results = [];

    for (const testUser of TEST_USERS) {
      // Upsert user — creates or updates role/name if already exists
      await db.execute(sql`
        INSERT INTO "user" (id, name, email, email_verified, role, updated_at, created_at)
        VALUES (
          ${testUser.id},
          ${testUser.name},
          ${testUser.email},
          true,
          ${testUser.role},
          now(),
          now()
        )
        ON CONFLICT (email) DO UPDATE SET
          name       = EXCLUDED.name,
          role       = EXCLUDED.role,
          email_verified = true,
          updated_at = now();
      `);

      // Read back to confirm final state
      const rows = await db.execute(sql`
        SELECT id, name, email, role, email_verified
        FROM "user"
        WHERE email = ${testUser.email}
        LIMIT 1;
      `);

      results.push(rows.rows[0]);
    }

    return NextResponse.json({
      success: true,
      message: "✅ Usuarios de prueba listos en la base de datos",
      users: results,
      howToLogin: {
        method: "Magic Link / OTP (passwordless)",
        webAdmin: {
          url: "/login",
          email: "admin@test.aconvi.com",
          note: "Introduce el email → el sistema envía un código OTP o magic link al correo",
        },
        appVecino: {
          email: "vecino@test.aconvi.com",
          note: "En la pantalla de login de la app, introduce el email y sigue el OTP",
        },
        appProveedor: {
          email: "proveedor@test.aconvi.com",
          note: "En la pantalla de login de la app, introduce el email y sigue el OTP",
        },
        devTip:
          "⚠️ En desarrollo local sin SMTP configurado, el OTP/magic-link se imprime directamente en los logs de la terminal (console.log). Revisa la consola donde corre 'pnpm dev'.",
      },
    });
  } catch (error: any) {
    console.error("[seed-test-users] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        hint: "Verifica que POSTGRES_URL esté configurada en las variables de entorno",
      },
      { status: 500 },
    );
  }
}
