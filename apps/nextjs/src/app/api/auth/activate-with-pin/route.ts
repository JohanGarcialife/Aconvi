import { type NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@acme/db/client";
import { user } from "@acme/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { username: string; pin: string };
    const username_input = body.username?.trim().toLowerCase();
    const pin_input = body.pin?.trim();

    if (!username_input || !pin_input) {
      return NextResponse.json(
        { ok: false, error: "Usuario y PIN requeridos.", code: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    // Find user
    const foundUser = await db.query.user.findFirst({
      where: eq(user.corporateUsername, username_input),
    });

    if (!foundUser) {
      return NextResponse.json(
        { ok: false, error: "Usuario corporativo no encontrado.", code: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Already activated — for jluis.test, we skip this to allow re-testing
    if (foundUser.pinActivated && foundUser.corporateUsername !== "jluis.test") {
      return NextResponse.json(
        { ok: false, error: "Esta cuenta ya ha sido activada. Usa el flujo de acceso estándar.", code: "ALREADY_ACTIVATED" },
        { status: 400 }
      );
    }

    // No PIN set (shouldn't happen in production)
    if (!foundUser.initialPinHash) {
      return NextResponse.json(
        { ok: false, error: "Esta cuenta no tiene PIN de activación configurado. Contacta a soporte.", code: "NO_PIN" },
        { status: 400 }
      );
    }

    // Verify PIN (SHA-256 comparison)
    const pinHash = createHash("sha256").update(pin_input).digest("hex");
    if (pinHash !== foundUser.initialPinHash) {
      return NextResponse.json(
        { ok: false, error: "PIN incorrecto. Verifica el PIN recibido.", code: "INVALID_PIN" },
        { status: 401 }
      );
    }

    // Mark account as activated (PIN consumed — one time use)
    await db.update(user)
      .set({ pinActivated: true, initialPinHash: null }) // Remove hash after use
      .where(eq(user.id, foundUser.id));

    // Create a session directly via DB (Better Auth programmatic bypass)
    const { session } = await import("@acme/db/schema");
    const { randomUUID } = await import("crypto");
    
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry
    
    const now = new Date();
    await db.insert(session).values({
      id: token,
      token,
      userId: foundUser.id,
      expiresAt,
      createdAt: now,
      updatedAt: now,
      ipAddress: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown",
      userAgent: req.headers.get("user-agent") ?? "Web",
    });

    console.log(`[ACTIVATE_PIN] User ${foundUser.corporateUsername} activated account and logged in.`);

    return NextResponse.json({ ok: true, sessionToken: token });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("[API_ACTIVATE_WITH_PIN]", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
