import { type NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@acme/db/client";
import { user, session } from "@acme/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/auth/mobile-login
 * 
 * Authenticates a professional user from the mobile app using their
 * corporate username and PIN. Returns a session token to store in SecureStore.
 * 
 * - For first-time mobile login: uses initialPinHash (set during account creation).
 *   After use, copies it to mobilePinHash so subsequent logins keep working.
 * - For repeat logins: uses mobilePinHash (permanent mobile credential).
 * - For jluis.test / jluis.push: always uses PIN 123456.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { username: string; pin: string };
    const username_input = body.username?.trim().toLowerCase();
    const pin_input = body.pin?.trim();

    if (!username_input || !pin_input) {
      return NextResponse.json({ ok: false, error: "Usuario y PIN requeridos." }, { status: 400 });
    }

    // ── Ensure mobilePinHash column exists ───────────────────────────────────
    const { sql } = await import("drizzle-orm");
    try {
      await db.execute(sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS mobile_pin_hash text;`);
    } catch { /* already exists */ }

    // ── Simulation users ─────────────────────────────────────────────────────
    if (username_input === "jluis.test" || username_input === "jluis.push") {
      const pinHash = "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92";
      const inputHash = createHash("sha256").update(pin_input).digest("hex");
      if (inputHash !== pinHash) {
        return NextResponse.json({ ok: false, error: "PIN incorrecto." }, { status: 401 });
      }
      let simUser = await db.query.user.findFirst({ where: eq(user.corporateUsername, username_input) });
      if (!simUser) {
        const [newUser] = await db.insert(user).values({
          id: `test-${username_input}-${Date.now()}`,
          name: username_input === "jluis.push" ? "José Luis (Test Push)" : "José Luis (Test PIN)",
          email: `${username_input}@aconvi.app`,
          corporateUsername: username_input,
          role: "Administrador",
          pinActivated: true,
        }).returning();
        simUser = newUser;
      }
      return createMobileSession(simUser.id, req);
    }

    // ── Find user ─────────────────────────────────────────────────────────────
    const foundUser = await db.query.user.findFirst({
      where: eq(user.corporateUsername, username_input),
    });

    if (!foundUser) {
      return NextResponse.json({ ok: false, error: "Usuario no encontrado.", code: "USER_NOT_FOUND" }, { status: 404 });
    }

    // ── Verify PIN ────────────────────────────────────────────────────────────
    const pinHash = createHash("sha256").update(pin_input).digest("hex");

    // Try mobilePinHash first (repeat logins), then initialPinHash (first mobile login)
    const mobilePinHash = (foundUser as any).mobilePinHash as string | null;
    const initialPinHash = foundUser.initialPinHash;
    const validHash = mobilePinHash ?? initialPinHash;

    if (!validHash) {
      return NextResponse.json({
        ok: false,
        error: "Esta cuenta no tiene PIN de acceso móvil configurado. Actívala primero en el portal web.",
        code: "NO_PIN",
      }, { status: 400 });
    }

    if (pinHash !== validHash) {
      return NextResponse.json({ ok: false, error: "PIN incorrecto.", code: "INVALID_PIN" }, { status: 401 });
    }

    // ── On first mobile login: copy initialPinHash → mobilePinHash (persistent) 
    if (!mobilePinHash && initialPinHash) {
      await db.execute(sql`
        UPDATE "user" SET mobile_pin_hash = ${initialPinHash} WHERE id = ${foundUser.id}
      `);
    }

    console.log(`[MOBILE_LOGIN] ✅ ${foundUser.corporateUsername} authenticated via mobile PIN`);
    return createMobileSession(foundUser.id, req);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("[API_MOBILE_LOGIN]", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// ── Helper: create session in DB + return token ──────────────────────────────
async function createMobileSession(userId: string, req: NextRequest) {
  const { sql } = await import("drizzle-orm");
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 45);
  const now = new Date();

  await db.insert(session).values({
    id: token,
    token,
    userId,
    expiresAt,
    createdAt: now,
    updatedAt: now,
    ipAddress: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "mobile",
    userAgent: req.headers.get("user-agent") ?? "Expo",
  });

  return NextResponse.json({ ok: true, sessionToken: token });
}
