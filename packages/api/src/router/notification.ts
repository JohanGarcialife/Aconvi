import { eq } from "drizzle-orm";
import { z } from "zod";
import { pushToken } from "@acme/db/schema";
import { createTRPCRouter, protectedProcedure } from "../trpc";

// ─── Internal broadcast to WS server ─────────────────────────────────────────
// The WS server exposes a POST /internal/emit endpoint that forwards events
// to the correct tenant/user socket rooms from Next.js API routes.
async function broadcastToWS(event: string, data: unknown): Promise<void> {
  const wsUrl =
    process.env.NEXT_PUBLIC_WS_URL ??
    process.env.WS_INTERNAL_URL ??
    "http://localhost:3001";
  try {
    await fetch(`${wsUrl}/internal/emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": process.env.WS_INTERNAL_SECRET ?? "aconvi-dev",
      },
      body: JSON.stringify({ event, data }),
    });
  } catch {
    // WS server may be down (dev) — non-fatal
    console.warn("[WS] Could not broadcast to WebSocket server:", event);
  }
}

// ─── Push notification sender ─────────────────────────────────────────────────
// Called internally by other routers (e.g. when an incident is closed).
export async function sendPushToUser(
  db: any,
  userId: string,
  notification: { title: string; body: string; data?: Record<string, string> },
): Promise<void> {
  const tokens = await db.query.pushToken.findMany({
    where: eq(pushToken.userId, userId),
  });

  for (const tok of tokens) {
    if (tok.platform === "expo") {
      await sendExpoPush(tok.token, notification).catch(console.error);
    } else if (tok.platform === "web") {
      await sendWebPush(tok.token, notification).catch(console.error);
    }
  }
}

// ─── Broadcast push to ALL members of an org ─────────────────────────────
// Call this when publishing a notice/aviso to reach all org vecinos
export async function sendPushToAllMembers(
  db: any,
  organizationId: string,
  notification: { title: string; body: string; data?: Record<string, string> },
): Promise<{ sent: number; failed: number }> {
  const { member } = await import("@acme/db/schema");
  const { eq } = await import("drizzle-orm");

  const members = await db.query.member.findMany({
    where: eq(member.organizationId, organizationId),
  });

  const userIds = [...new Set(members.map((m: any) => m.userId as string))];
  let sent = 0;
  let failed = 0;

  for (const uid of userIds) {
    try {
      await sendPushToUser(db, uid, notification);
      sent++;
    } catch {
      failed++;
    }
  }

  return { sent, failed };
}

// ─── Expo Push helper ─────────────────────────────────────────────────────────
async function sendExpoPush(
  expoPushToken: string,
  notification: { title: string; body: string; data?: Record<string, string> },
) {
  const { Expo } = await import("expo-server-sdk");
  const expo = new Expo();

  if (!Expo.isExpoPushToken(expoPushToken)) {
    console.warn("[Push] Invalid Expo push token:", expoPushToken);
    return;
  }

  const messages = [
    {
      to: expoPushToken,
      sound: "default" as const,
      title: notification.title,
      body: notification.body,
      data: notification.data ?? {},
    },
  ];

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    await expo.sendPushNotificationsAsync(chunk);
  }
}

// ─── Web Push helper ──────────────────────────────────────────────────────────
async function sendWebPush(
  subscriptionJson: string,
  notification: { title: string; body: string; data?: Record<string, string> },
) {
  const webpush = await import("web-push");

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:admin@aconvi.app";

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("[WebPush] VAPID keys not configured. Skipping web push.");
    return;
  }

  webpush.default.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const subscription = JSON.parse(subscriptionJson);
  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    data: notification.data,
  });

  await webpush.default.sendNotification(subscription, payload);
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const notificationRouter = createTRPCRouter({
  // Save a push token (called once on login / app start)
  registerToken: protectedProcedure
    .input(
      z.object({
        token: z.string().min(1),
        platform: z.enum(["web", "expo"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Upsert: if this exact token is already stored, don't duplicate
      const existing = await ctx.db.query.pushToken.findFirst({
        where: eq(pushToken.token, input.token),
      });

      if (existing) return { ok: true };

      await ctx.db.insert(pushToken).values({
        id: crypto.randomUUID(),
        userId,
        token: input.token,
        platform: input.platform,
      });

      return { ok: true };
    }),

  // Remove a push token (called on logout or permission revoke)
  unregisterToken: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(pushToken)
        .where(eq(pushToken.token, input.token));
      return { ok: true };
    }),

  // Test: send a push notification to the current logged-in user
  sendTest: protectedProcedure.mutation(async ({ ctx }) => {
    await sendPushToUser(ctx.db, ctx.session.user.id, {
      title: "🔔 Aconvi",
      body: "Las notificaciones están activas correctamente.",
      data: { type: "test" },
    });
    await broadcastToWS("notify-test", {
      userId: ctx.session.user.id,
      message: "Test WS event",
    });
    return { ok: true };
  }),
});
