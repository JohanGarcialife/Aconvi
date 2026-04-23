import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { desc, eq } from "@acme/db";
import { pushAuthSession, pushToken, user, verification } from "@acme/db/schema";
import { sendPushToUser } from "./notification";

import { protectedProcedure, publicProcedure } from "../trpc";

// ─── Shared push auth session map (in-memory for dev intercept mode) ──────────
// @ts-ignore
if (!globalThis.__pushAuthSessions) globalThis.__pushAuthSessions = new Map();

export const authRouter = {
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session;
  }),

  // ─── LEGACY: OTP for mobile phone auth ───────────────────────────────────────
  getLatestOTP: publicProcedure
    .input(z.object({ phoneNumber: z.string() }))
    .query(async ({ ctx, input }) => {
      if (input.phoneNumber !== "+34600000000" && input.phoneNumber !== "+34 600 000 000") {
        throw new Error("OTP retrieval only allowed for test number");
      }
      const latest = await ctx.db.query.verification.findFirst({
        where: eq(verification.identifier, input.phoneNumber),
        orderBy: desc(verification.createdAt),
      });
      return latest?.value;
    }),

  // ─── STEP 1: Request push-based access ───────────────────────────────────────
  // Called by the web login form when the user submits their corporate username.
  // 1. Resolves the user by corporateUsername
  // 2. Creates a pushAuthSession (3 min expiry)
  // 3. Sends a push notification to the user's linked device
  // 4. Returns the session token so the web can poll for confirmation
  requestPushAccess: publicProcedure
    .input(z.object({ corporateUsername: z.string().min(2).max(64), loginUserAgent: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      // Find user by corporate username (case-insensitive)
      const found = await ctx.db.query.user.findFirst({
        where: eq(user.corporateUsername, input.corporateUsername.toLowerCase().trim()),
      });

      if (!found) {
        throw new Error("Usuario corporativo no encontrado. Verifica tu usuario e inténtalo de nuevo.");
      }

      // Check if only professional roles can access the web portal
      const allowedRoles = ["AF", "Agente AF", "SuperAdmin Aconvi", "Agente Aconvi", "Proveedor", "Tecnico"];
      if (!allowedRoles.includes(found.role)) {
        throw new Error("Tu usuario no tiene acceso al portal web profesional.");
      }

      // Create push auth session (3 min expiry)
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

      await ctx.db.insert(pushAuthSession).values({
        id: crypto.randomUUID(),
        userId: found.id,
        token,
        status: "PENDING",
        loginUserAgent: input.loginUserAgent,
        expiresAt,
      });

      // Store in dev intercept map
      // @ts-ignore
      (globalThis.__pushAuthSessions as Map<string, string>).set(token, "PENDING");

      // Check if user has any push tokens registered
      const userTokens = await ctx.db.query.pushToken.findMany({
        where: eq(pushToken.userId, found.id),
      });

      if (userTokens.length === 0) {
        // Dev mode: no device linked yet — auto-confirm after short delay (for testing)
        console.log(`[PushAuth] No device tokens for user ${found.corporateUsername}. Dev mode: token=${token}`);
        // Auto-confirm immediately for demo users
        setTimeout(async () => {
          await ctx.db
            .update(pushAuthSession)
            .set({ status: "CONFIRMED" })
            .where(eq(pushAuthSession.token, token));
          // @ts-ignore
          (globalThis.__pushAuthSessions as Map<string, string>).set(token, "CONFIRMED");
          console.log(`[PushAuth] Dev auto-confirmed token=${token}`);
        }, 3000); // 3 seconds for demo
      } else {
        // Send push notification to all linked devices
        await sendPushToUser(ctx.db, found.id, {
          title: "🔐 Aconvi — Confirmar acceso",
          body: `${found.name || found.corporateUsername} quiere iniciar sesión. Toca para confirmar.`,
          data: {
            type: "auth_confirm",
            token,
            username: found.corporateUsername ?? "",
          },
        });
        console.log(`[PushAuth] Push sent for ${found.corporateUsername} — token=${token}`);
      }

      return { token, userDisplayName: found.name ?? found.corporateUsername };
    }),

  // ─── STEP 2: Poll status (web polls every 2 seconds) ─────────────────────────
  pollPushStatus: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.db.query.pushAuthSession.findFirst({
        where: eq(pushAuthSession.token, input.token),
      });

      if (!session) return { status: "NOT_FOUND" as const };

      // Check expiry
      if (new Date() > session.expiresAt && session.status === "PENDING") {
        await ctx.db
          .update(pushAuthSession)
          .set({ status: "EXPIRED" })
          .where(eq(pushAuthSession.token, input.token));
        return { status: "EXPIRED" as const };
      }

      if (session.status === "CONFIRMED") {
        const found = await ctx.db.query.user.findFirst({
          where: eq(user.id, session.userId),
        });
        return {
          status: "CONFIRMED" as const,
          userId: session.userId,
          userName: found?.name ?? found?.corporateUsername ?? "",
        };
      }

      return { status: session.status as "PENDING" | "CANCELLED" | "EXPIRED" };
    }),


  // ─── STEP 3: Confirm from mobile app ─────────────────────────────────────────
  // Called by the Expo app when the user taps "Confirmar" on the push notification.
  confirmPushAccess: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.query.pushAuthSession.findFirst({
        where: eq(pushAuthSession.token, input.token),
      });

      if (!session) throw new Error("Sesión no encontrada.");
      if (session.status !== "PENDING") throw new Error("Esta solicitud ya fue procesada.");
      if (new Date() > session.expiresAt) {
        await ctx.db
          .update(pushAuthSession)
          .set({ status: "EXPIRED" })
          .where(eq(pushAuthSession.token, input.token));
        throw new Error("Esta solicitud ha caducado.");
      }

      await ctx.db
        .update(pushAuthSession)
        .set({ status: "CONFIRMED" })
        .where(eq(pushAuthSession.token, input.token));

      // @ts-ignore
      (globalThis.__pushAuthSessions as Map<string, string>).set(input.token, "CONFIRMED");

      console.log(`[PushAuth] Confirmed by device for token=${input.token}`);
      return { ok: true };
    }),

  // ─── STEP 4: Cancel pending session ──────────────────────────────────────────
  cancelPushAccess: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(pushAuthSession)
        .set({ status: "CANCELLED" })
        .where(eq(pushAuthSession.token, input.token));
      return { ok: true };
    }),

  getSecretMessage: protectedProcedure.query(() => {
    return "you can see this secret message!";
  }),
} satisfies TRPCRouterRecord;
