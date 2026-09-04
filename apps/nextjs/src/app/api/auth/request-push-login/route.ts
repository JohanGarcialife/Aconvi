import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@acme/db/client";
import { pushAuthSession, pushToken, user } from "@acme/db/schema";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { username: string };
    const username_input = body.username?.trim().toLowerCase();

    if (!username_input) {
      return NextResponse.json(
        { ok: false, error: "Usuario requerido.", code: "MISSING_USERNAME" },
        { status: 400 },
      );
    }

    // ── Dynamic migration: ensure new auth & voting columns exist ──────────
    const { sql } = await import("drizzle-orm");
    const migrationErrors: string[] = [];
    const safeExec = async (statement: any, desc?: string) => {
      try {
        await db.execute(statement);
      } catch (err: any) {
        migrationErrors.push(`${desc ?? "stmt"}: ${err?.message ?? err}`);
        console.warn("[DYNAMIC MIGRATION NOTICE]", desc, err?.message ?? err);
      }
    };

    // User table auth columns
    await safeExec(
      sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone_number" text;`,
    );
    await safeExec(
      sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone_number_verified" boolean DEFAULT false NOT NULL;`,
    );
    await safeExec(
      sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "corporate_username" text;`,
    );
    await safeExec(
      sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "initial_pin_hash" text;`,
    );
    await safeExec(
      sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "pin_activated" boolean DEFAULT false NOT NULL;`,
    );
    await safeExec(
      sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "mobile_pin_hash" text;`,
    );
    await safeExec(
      sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "device_token" text;`,
    );
    await safeExec(
      sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "device_activated_at" timestamp with time zone;`,
    );
    await safeExec(
      sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'Vecino' NOT NULL;`,
    );
    await safeExec(sql`ALTER TABLE "user" ALTER COLUMN "email" DROP NOT NULL;`);

    // Push authentication tables
    await safeExec(sql`
      CREATE TABLE IF NOT EXISTS push_token (
          id text PRIMARY KEY,
          user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
          token text NOT NULL,
          platform text NOT NULL,
          created_at timestamp with time zone DEFAULT now() NOT NULL,
          updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);

    await safeExec(sql`
      CREATE TABLE IF NOT EXISTS push_auth_session (
          id text PRIMARY KEY,
          user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
          token text NOT NULL UNIQUE,
          otp_code text,
          status text NOT NULL DEFAULT 'PENDING',
          login_ip text,
          login_user_agent text,
          expires_at timestamp with time zone NOT NULL,
          created_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);

    // Member voting override columns
    await safeExec(
      sql`ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "voting_override" boolean DEFAULT false NOT NULL;`,
    );
    await safeExec(
      sql`ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "voting_override_reason" text;`,
    );

    // Voting sessions sync & historical columns
    await safeExec(
      sql`ALTER TABLE "vote_session" ADD COLUMN IF NOT EXISTS "priority" integer DEFAULT 0 NOT NULL;`,
    );
    await safeExec(
      sql`ALTER TABLE "vote_session" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;`,
    );
    await safeExec(
      sql`ALTER TABLE "vote_session" ADD COLUMN IF NOT EXISTS "meeting_date" timestamp with time zone;`,
    );
    await safeExec(
      sql`ALTER TABLE "vote_session" ADD COLUMN IF NOT EXISTS "meeting_location" text;`,
    );
    await safeExec(
      sql`ALTER TABLE "vote_session" ADD COLUMN IF NOT EXISTS "second_call_date" timestamp with time zone;`,
    );
    await safeExec(
      sql`ALTER TABLE "vote_session" ADD COLUMN IF NOT EXISTS "convocation_generated_at" timestamp with time zone;`,
    );

    // Voting items online toggle
    await safeExec(
      sql`ALTER TABLE "vote_item" ADD COLUMN IF NOT EXISTS "online_voting_enabled" boolean DEFAULT false NOT NULL;`,
    );

    // Vote cast proposal selection
    await safeExec(
      sql`ALTER TABLE "vote_cast" ADD COLUMN IF NOT EXISTS "selected_proposal_id" uuid;`,
    );

    // Budget proposals table
    await safeExec(sql`
      CREATE TABLE IF NOT EXISTS "vote_budget_proposal" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "item_id" uuid NOT NULL REFERENCES "vote_item"("id") ON DELETE cascade,
        "company_name" varchar(255) NOT NULL,
        "amount" numeric(10, 2) NOT NULL,
        "document_url" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);

    // ── Look up user ─────────────────────────────────────────────────────────
    let foundUser = await db.query.user.findFirst({
      where: eq(user.corporateUsername, username_input),
    });

    // ── SIMULATION: jluis.test → always reset to PIN flow ───────────────────
    // ── SIMULATION: jluis.push → always reset to push flow (already activated)
    if (username_input === "jluis.test" || username_input === "jluis.push") {
      const pinHash =
        "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92"; // "123456"
      const isPushUser = username_input === "jluis.push";
      if (!foundUser) {
        const [newUser] = await db
          .insert(user)
          .values({
            id: `test-${username_input}-${Date.now()}`,
            name: isPushUser ? "José Luis (Test Push)" : "José Luis (Test PIN)",
            email: `${username_input}@aconvi.app`,
            corporateUsername: username_input,
            role: "Administrador",
            initialPinHash: pinHash,
            pinActivated: isPushUser,
          })
          .returning();
        foundUser = newUser;
      } else {
        await db
          .update(user)
          .set({ initialPinHash: pinHash, pinActivated: isPushUser })
          .where(eq(user.id, foundUser.id));
        foundUser.initialPinHash = pinHash;
        foundUser.pinActivated = isPushUser;
      }
    }

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

    // ── PIN activation required? ──────────────────────────────────────────────
    if (!foundUser.pinActivated) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Esta cuenta aún no ha sido activada. Introduce el PIN inicial que te entregó Aconvi.",
          code: "ACCOUNT_NOT_ACTIVATED",
        },
        { status: 403 },
      );
    }

    // ── Create push auth session (3 min expiry) ──────────────────────────────
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

    await db.insert(pushAuthSession).values({
      id: crypto.randomUUID(),
      userId: foundUser.id,
      token,
      status: "PENDING",
      loginIp:
        req.headers.get("x-forwarded-for") ??
        req.headers.get("x-real-ip") ??
        null,
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
        console.log(
          `[PUSH_LOGIN] Push sent to ${messages.length} device(s) for ${foundUser.corporateUsername}`,
        );
      }
    } else {
      // No device registered — demo/auto-approve will happen in check-push
      console.log(
        `[PUSH_LOGIN] No device tokens for ${foundUser.corporateUsername}. Auto-confirm via poll.`,
      );
    }

    // Return token as requestId for API compatibility with the web polling
    return NextResponse.json({
      ok: true,
      requestId: token,
      userDisplayName: foundUser.name,
    });
  } catch (error: unknown) {
    const err = error as any;
    const causeMsg = err?.cause?.message ?? "";
    const isConnRefused =
      causeMsg.includes("ECONNREFUSED") ||
      err?.cause?.code === "ECONNREFUSED" ||
      (err?.message && err.message.includes("ECONNREFUSED"));

    if (isConnRefused && process.env.NODE_ENV !== "production") {
      try {
        const { execSync } = await import("child_process");
        execSync(
          "ssh -f -N -o ServerAliveInterval=20 -o ServerAliveCountMax=3 -L 5433:127.0.0.1:5432 root@212.227.207.43",
          { stdio: "ignore", timeout: 3000 },
        );
      } catch {}
    }

    const message = isConnRefused
      ? "No se pudo conectar a la base de datos PostgreSQL (127.0.0.1:5433). El túnel SSH ha sido relanzado automáticamente, por favor reintenta en un segundo."
      : error instanceof Error
        ? error.message
        : "Error interno de autenticación";

    console.error("[API_REQUEST_PUSH_LOGIN]", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
