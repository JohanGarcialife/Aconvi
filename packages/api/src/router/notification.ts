import crypto from "crypto";
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
      signal: AbortSignal.timeout(2000),
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
  console.log("[sendPushToUser] Querying push tokens for userId:", userId);
  const tokens = await db.query.pushToken.findMany({
    where: eq(pushToken.userId, userId),
  });
  console.log("[sendPushToUser] Found tokens count:", tokens.length);

  for (const tok of tokens) {
    console.log("[sendPushToUser] Dispatching token platform:", tok.platform, "token:", tok.token?.slice(0, 30));
    if (tok.platform === "fcm") {
      // Native Android FCM token → FCM V1 API direct
      await sendDirectFcmPush(tok.token, notification).catch((err) => {
        console.error("[sendPushToUser] sendDirectFcmPush failed for token:", tok.token?.slice(0, 30), err);
      });
    } else if (tok.platform === "expo") {
      await sendExpoPush(tok.token, notification).catch((err) => {
        console.error("[sendPushToUser] sendExpoPush failed for token:", tok.token?.slice(0, 30), err);
      });
    } else if (tok.platform === "web") {
      await sendWebPush(tok.token, notification).catch((err) => {
        console.error("[sendPushToUser] sendWebPush failed for token:", tok.token?.slice(0, 30), err);
      });
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

  const userIds = [...new Set(members.map((m: any) => m.userId as string))] as string[];
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

// ─── Direct FCM V1 HTTP API helper (bypasses Expo for native Android FCM tokens)
async function getFcmAccessToken(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const base64UrlEncode = (str: string) =>
    Buffer.from(str)
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claim))}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedToken);
  const signature = signer.sign(serviceAccount.private_key, "base64");
  const jwt = `${unsignedToken}.${signature.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) {
    throw new Error(`Failed to get OAuth2 access token for FCM: ${data.error ?? JSON.stringify(data)}`);
  }
  return data.access_token;
}

const DEFAULT_FCM_SERVICE_ACCOUNT = {
  project_id: "creative-feel-agency",
  client_email: "firebase-adminsdk-6xe0d@creative-feel-agency.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDYwk5jQVu6OOCy\n6nK7iZsXTajWOCGtaf0HeJkvZ/YRNuWZdxaQZsjdbcC5h8BZ3vuw/6YR6Vu5mzmE\nOz4Z506DEsT04NojOyzO2XmcAvu05wTpRBF6Yv44h64mLLvV+Wa0S9imyTq17bNP\nXFDsDk5S9pTJlSipSejeDLZw6JQfltWJkb89PjjByfhu/fZJUkBaivCSKJVuSl/a\nDNI2eYWOdetCu4csA86qbYzAe5/VWg+LF4vKAUucQHz3ZWSzcZTHlOWO1H9o+PTL\nrLyUalntSsE73cuVI00twOTjcafADOx2uodFi245q9GMSfq0tCMT+Sl1lJRItg5Y\nytf5NYSnAgMBAAECggEAE6XVPij7/A7Qy1b2DGrGPKAE+FoBL3tmfKlhVUs6okfU\nGwuQ54jxlySuLgMQm/Ta4qnhr0j0UAgyd/p4wBdX5girArlo/H2OK7fJzqr0jurL\n5qsNXIchnRUrY3l1k0k2lowzeLbP1BLWSJDJIwSO8/U2+mjDVUkGSy5i0Sw71PsH\n6bgW73+UcgfEvJenqQGBRKuI/E510/O1Kki7epxn+09h7Oq7dzv86joIRJEZDvZz\njSldfV8FsNTzsrQLZBMBmZKs2+Q0QEv0v5VFRAb8xOAvUcxVzDurl70OWuKLqpJ3\njBzH3rIgVMJvvmAi4htYsDIlrivOHdWoHlMERdhI4QKBgQDyr0tWnzrdxtbJFdRd\niTE1kxvk1jX6+Oo7jcNqEhnhvLRzKWALcZY9DaD+HeHHn0J7RcgUx8PGhp/Ur7KR\nAPJIJb2pKAerihBtdPfRkhcfONgqV5f02jnCtkjVN+ZjQF+2ABfS/kMH3ZxghW5S\n1peMiq+1JzYnZGMGpwxWX++woQKBgQDkpt0fkbADlLM+VFczaHJ6XQsKGnoKw+mx\nXdoa7KLtXxwmfNVFpY0K5C/ChB4jR0lEFubY/o4lZofKcmpyTLawbzyNi3Ln40uD\ngGvAObYpEFN3lamj8N4K031mnWRUdcJd5BoNySWUJuRu/OiSoiLugsltZbn3WNE2\nG3210CaIRwKBgQCdCaGOo+rLp+dEp8OL40LckBz0r0iu5nNrpghVkvD8icea3aMw\nxIebaj5LMbrwGbZDXpxiFgIxbNvwHOFHw30EAqf/1c9gyS5oJdBW5Fnh8j6u54+E\n+dF2lc37avjCMN2+P8Eq3y0w4c5XBwCkyge3AedBKeZ5BxStMVtiaSIJAQKBgQC8\n6ANubo4OF0+TYlj89wEFiVNykHdd54huakyky/a7yEVYovAM7368jdPLkB3aJa4p\nXAZzJrRHwBLWNnstXaXd1LkhdCGF5argxTvAf6249W0QMo0KDhlUtnA3VDes8/GW\nYrsHwrSSVyOJctevNddIWLOT92SSL0YBvuq4SHVdRwKBgCtdYe1rliGSV0fwUugE\niww3FQpVZjAgdED2zzBBP8nIK+Pu6HhL6Xl4jVTzPgjEaQqJXV3RPC3i3e1K9GS3\n20iW19LkaNgHYIqOV1K+Ol++It8G/lcw7dsS6BsIV/uAmwrku74DV0VN5EQ4FePk\nR68IoI2ve4sKfFr3WTXY2nil\n-----END PRIVATE KEY-----\n",
};

async function sendDirectFcmPush(
  fcmToken: string,
  notification: { title: string; body: string; data?: Record<string, string> },
) {
  try {
    const serviceAccount = process.env.FCM_SERVICE_ACCOUNT_JSON
      ? (JSON.parse(process.env.FCM_SERVICE_ACCOUNT_JSON) as {
          project_id: string;
          client_email: string;
          private_key: string;
        })
      : DEFAULT_FCM_SERVICE_ACCOUNT;

    const accessToken = await getFcmAccessToken(serviceAccount);

    const payload = {
      message: {
        token: fcmToken,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data ?? {},
        android: {
          priority: "high",
          notification: {
            sound: "default",
            channel_id: "default",
          },
        },
      },
    };

    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const result = await res.json();
    console.log("[FCM_DIRECT_RESPONSE]", JSON.stringify(result));
  } catch (err) {
    console.error("[FCM_DIRECT_ERROR]", err);
  }
}

// ─── Expo Push helper ─────────────────────────────────────────────────────────
async function sendExpoPush(
  expoPushToken: string,
  notification: { title: string; body: string; data?: Record<string, string> },
) {
  const { Expo } = await import("expo-server-sdk");
  const expo = new Expo();

  if (!Expo.isExpoPushToken(expoPushToken)) {
    console.warn("[Push] Token is not an Expo token, routing to direct FCM:", expoPushToken.slice(0, 25));
    await sendDirectFcmPush(expoPushToken, notification);
    return;
  }

  const messages = [
    {
      to: expoPushToken,
      sound: "default" as const,
      title: notification.title,
      body: notification.body,
      data: notification.data ?? {},
      priority: "high" as const,
      channelId: "default",
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
        platform: z.enum(["web", "expo", "fcm"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Upsert: if this exact token is already stored, ensure it belongs to the current user
      const existing = await ctx.db.query.pushToken.findFirst({
        where: eq(pushToken.token, input.token),
      });

      if (existing) {
        if (existing.userId === userId) {
          return { ok: true };
        } else {
          // Token is currently assigned to another user (device shared/login swap), re-assign it
          await ctx.db
            .update(pushToken)
            .set({ userId })
            .where(eq(pushToken.id, existing.id));
          return { ok: true };
        }
      }

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
