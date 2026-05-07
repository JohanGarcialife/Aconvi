import { type NextRequest, NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { pushAuthSession, pushToken, user } from "@acme/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { username: string };
    const username_input = body.username?.trim().toLowerCase();

    if (!username_input) {
      return NextResponse.json({ ok: false, error: "Usuario requerido.", code: "MISSING_USERNAME" }, { status: 400 });
    }

    // ── Dynamic migration: ensure new auth columns exist ────────────────────
    const { sql } = await import("drizzle-orm");
    try {
      await db.execute(sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS initial_pin_hash text;`);
      await db.execute(sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS pin_activated boolean DEFAULT false NOT NULL;`);
      await db.execute(sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS device_token text;`);
      await db.execute(sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS mobile_pin_hash text;`);
    } catch { /* already exists */ }

    // ── Look up user ─────────────────────────────────────────────────────────
    let foundUser = await db.query.user.findFirst({
      where: eq(user.corporateUsername, username_input),
    });

    // ── SIMULATION: jluis.test → always reset to PIN flow ───────────────────
    // ── SIMULATION: jluis.push → always reset to push flow (already activated)
    if (username_input === "jluis.test" || username_input === "jluis.push") {
      const pinHash = "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92"; // "123456"
      const isPushUser = username_input === "jluis.push";
      if (!foundUser) {
        const [newUser] = await db.insert(user).values({
          id: `test-${username_input}-${Date.now()}`,
          name: isPushUser ? "José Luis (Test Push)" : "José Luis (Test PIN)",
          email: `${username_input}@aconvi.app`,
          corporateUsername: username_input,
          role: "Administrador",
          initialPinHash: pinHash,
          pinActivated: isPushUser,
        }).returning();
        foundUser = newUser;
      } else {
        await db.update(user)
          .set({ initialPinHash: pinHash, pinActivated: isPushUser })
          .where(eq(user.id, foundUser.id));
        foundUser.initialPinHash = pinHash;
        foundUser.pinActivated = isPushUser;
      }
    }

    if (!foundUser) {
      return NextResponse.json({ ok: false, error: "Usuario corporativo no encontrado.", code: "USER_NOT_FOUND" }, { status: 404 });
    }

    // ── PIN activation required? ──────────────────────────────────────────────
    if (!foundUser.pinActivated) {
      return NextResponse.json({
        ok: false,
        error: "Esta cuenta aún no ha sido activada. Introduce el PIN inicial que te entregó Aconvi.",
        code: "ACCOUNT_NOT_ACTIVATED",
      }, { status: 403 });
    }

    // ── Create push auth session (3 min expiry) ──────────────────────────────
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

    await db.insert(pushAuthSession).values({
      id: crypto.randomUUID(),
      userId: foundUser.id,
      token,
      status: "PENDING",
      loginIp: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null,
      loginUserAgent: req.headers.get("user-agent") ?? null,
      expiresAt,
    });

    // ── Send real push notification if device registered ─────────────────────
    const userTokens = await db.query.pushToken.findMany({
      where: eq(pushToken.userId, foundUser.id),
    });

    if (userTokens.length > 0) {
      const { Expo } = await import("expo-server-sdk");
      const expo = new Expo();
      const messages = userTokens
        .filter((t) => t.platform === "expo" && Expo.isExpoPushToken(t.token))
        .map((t) => ({
          to: t.token,
          sound: "default" as const,
          title: "🔐 Aconvi — Confirmar acceso",
          body: `${foundUser!.name ?? foundUser!.corporateUsername} quiere iniciar sesión. Toca para confirmar.`,
          data: { type: "auth_confirm", token },
        }));
      if (messages.length > 0) {
        const chunks = expo.chunkPushNotifications(messages);
        for (const chunk of chunks) {
          await expo.sendPushNotificationsAsync(chunk).catch(console.error);
        }
        console.log(`[PUSH_LOGIN] Push sent to ${messages.length} device(s) for ${foundUser.corporateUsername}`);
      }
    } else {
      // No device registered — demo/auto-approve will happen in check-push
      console.log(`[PUSH_LOGIN] No device tokens for ${foundUser.corporateUsername}. Auto-confirm via poll.`);
    }

    // Return token as requestId for API compatibility with the web polling
    return NextResponse.json({
      ok: true,
      requestId: token,
      userDisplayName: foundUser.name,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("[API_REQUEST_PUSH_LOGIN]", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
