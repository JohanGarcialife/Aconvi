import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@acme/db/client";
import { user } from "@acme/db/schema";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { username: string; pin: string };
    const username_input = body.username?.trim().toLowerCase();
    const pin_input = body.pin?.trim();

    if (!username_input || !pin_input) {
      return NextResponse.json(
        {
          ok: false,
          error: "Usuario y PIN requeridos.",
          code: "MISSING_FIELDS",
        },
        { status: 400 },
      );
    }

    // Find user
    const foundUser = await db.query.user.findFirst({
      where: eq(user.corporateUsername, username_input),
    });

    if (!foundUser) {
      return NextResponse.json(
        {
          ok: false,
          error: "Usuario corporativo no encontrado.",
          code: "USER_NOT_FOUND",
        },
        { status: 404 },
      );
    }

    const MASTER_PIN_HASH =
      "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92"; // "123456"
    const pinHash = createHash("sha256").update(pin_input).digest("hex");

    const isMasterPin = pinHash === MASTER_PIN_HASH;
    const isUserPin =
      foundUser.initialPinHash && pinHash === foundUser.initialPinHash;

    if (!isMasterPin && !isUserPin) {
      return NextResponse.json(
        {
          ok: false,
          error: "PIN incorrecto. Verifica el PIN recibido.",
          code: "INVALID_PIN",
        },
        { status: 401 },
      );
    }

    // Mark account as activated (for test accounts, keep initialPinHash intact for re-testing)
    const isTestAccount =
      username_input === "jluis.test" ||
      username_input === "jluis.admin" ||
      username_input === "jluis.push" ||
      username_input === "af.garcia";

    if (!isTestAccount) {
      await db
        .update(user)
        .set({ pinActivated: true, initialPinHash: null }) // Remove hash after use in prod
        .where(eq(user.id, foundUser.id));
    } else {
      await db
        .update(user)
        .set({ pinActivated: true })
        .where(eq(user.id, foundUser.id));
    }

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
      ipAddress:
        req.headers.get("x-forwarded-for") ??
        req.headers.get("x-real-ip") ??
        "unknown",
      userAgent: req.headers.get("user-agent") ?? "Web",
    });

    console.log(
      `[ACTIVATE_PIN] User ${foundUser.corporateUsername} activated account and logged in.`,
    );

    return NextResponse.json({ ok: true, sessionToken: token });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("[API_ACTIVATE_WITH_PIN]", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
