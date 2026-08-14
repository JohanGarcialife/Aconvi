import { type NextRequest, NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tokens = await db.execute(sql`
      SELECT pt.id, pt.user_id, pt.token, pt.platform, pt.created_at,
             u.name, u.email, u.role, u.corporate_username
      FROM push_token pt
      JOIN "user" u ON u.id = pt.user_id
      ORDER BY pt.created_at DESC
      LIMIT 30
    `);
    const recentUsers = await db.execute(sql`
      SELECT id, name, email, role, corporate_username, created_at
      FROM "user"
      ORDER BY created_at DESC
      LIMIT 20
    `);
    return NextResponse.json({ ok: true, tokenCount: (tokens.rows as any[]).length, tokens: tokens.rows, recentUsers: recentUsers.rows });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { token?: string; userId?: string };
    let pushToken = body.token;
    let platform = "expo";

    if (!pushToken && body.userId) {
      const row = await db.execute(sql`SELECT token, platform FROM push_token WHERE user_id = ${body.userId} ORDER BY created_at DESC LIMIT 1`);
      pushToken = (row.rows[0] as any)?.token;
      platform = (row.rows[0] as any)?.platform ?? "expo";
    }

    if (!pushToken) return NextResponse.json({ ok: false, error: "No token" }, { status: 400 });

    // Detect if token is a native FCM token (not ExponentPushToken)
    const isExpoToken = pushToken.startsWith("ExponentPushToken[");
    const isFcmToken = !isExpoToken && !pushToken.startsWith("{"); // not web push subscription JSON

    if (isFcmToken || platform === "fcm") {
      // Use FCM V1 API directly
      const { sendPushToUser } = await import("@acme/api");
      // We import sendDirectFcmPush indirectly via sendPushToUser by storing as fcm platform
      // But for debug, let's call FCM directly
      const crypto = await import("crypto");

      const serviceAccount = {
        project_id: "creative-feel-agency",
        client_email: "firebase-adminsdk-6xe0d@creative-feel-agency.iam.gserviceaccount.com",
        private_key: process.env.FCM_PRIVATE_KEY ?? "",
      };

      // Get OAuth2 access token
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
        Buffer.from(str).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

      const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claim))}`;
      const signer = crypto.createSign("RSA-SHA256");
      signer.update(unsignedToken);

      // Use the embedded private key from notification.ts DEFAULT_FCM_SERVICE_ACCOUNT
      const privateKey = serviceAccount.private_key || `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDYwk5jQVu6OOCy
6nK7iZsXTajWOCGtaf0HeJkvZ/YRNuWZdxaQZsjdbcC5h8BZ3vuw/6YR6Vu5mzmE
Oz4Z506DEsT04NojOyzO2XmcAvu05wTpRBF6Yv44h64mLLvV+Wa0S9imyTq17bNP
XFDSDPK5S9pTJlSipSejeDLZw6JQfltWJkb89PjjByfhu/fZJUkBaivCSKJVuSl/a
DNI2eYWOdetCu4csA86qbYzAe5/VWg+LF4vKAUucQHz3ZWSzcZTHlOWO1H9o+PTL
rLyUalntSsE73cuVI00twOTjcafADOx2uodFi245q9GMSfq0tCMT+Sl1lJRItg5Y
ytf5NYSnAgMBAAECggEAE6XVPij7/A7Qy1b2DGrGPKAE+FoBL3tmfKlhVUs6okfU
GwuQ54jxlySuLgMQm/Ta4qnhr0j0UAgyd/p4wBdX5girArlo/H2OK7fJzqr0jurL
5qsNXIchnRUrY3l1k0k2lowzeLbP1BLWSJDJIwSO8/U2+mjDVUkGSy5i0Sw71PsH
6bgW73+UcgfEvJenqQGBRKuI/E510/O1Kki7epxn+09h7Oq7dzv86joIRJEZDvZz
jSldfV8FsNTzsrQLZBMBmZKs2+Q0QEv0v5VFRAb8xOAvUcxVzDurl70OWuKLqpJ3
jBzH3rIgVMJvvmAi4htYsDIlrivOHdWoHlMERdhI4QKBgQDyr0tWnzrdxtbJFdRd
iTE1kxvk1jX6+Oo7jcNqEhnhvLRzKWALcZY9DaD+HeHHn0J7RcgUx8PGhp/Ur7KR
APJIJb2pKAerihBtdPfRkhcfONgqV5f02jnCtkjVN+ZjQF+2ABfS/kMH3ZxghW5S
1peMiq+1JzYnZGMGpwxWX++woQKBgQDkpt0fkbADlLM+VFczaHJ6XQsKGnoKw+mx
XdoA7KLtXxwmfNVFpY0K5C/ChB4jR0lEFubY/o4lZofKcmpyTLawbzyNi3Ln40uD
gGvAObYpEFN3lamj8N4K031mnWRUdcJd5BoNySWUJuRu/OiSoiLugsltZbn3WNE2
G3210CaIRwKBgQCdCaGOo+rLp+dEp8OL40LckBz0r0iu5nNrpghVkvD8icea3aMw
xIebaj5LMbrwGbZDXpxiFgIxbNvwHOFHw30EAqf/1c9gyS5oJdBW5Fnh8j6u54+E
+dF2lc37avjCMN2+P8Eq3y0w4c5XBwCkyge3AedBKeZ5BxStMVtiaSIJAQKBgQC8
6ANubo4OF0+TYlj89wEFiVNykHdd54huakyky/a7yEVYovAM7368jdPLkB3aJa4p
XAZzJrRHwBLWNnstXaXd1LkhdCGF5argxTvAf6249W0QMo0KDhlUtnA3VDes8/GW
YrsHwrSSVyOJctevNddIWLOT92SSL0YBvuq4SHVdRwKBgCtdYe1rliGSV0fwUugE
iww3FQpVZjAgdED2zzBBP8nIK+Pu6HhL6Xl4jVTzPgjEaQqJXV3RPC3i3e1K9GS3
20iW19LkaNgHYIqOV1K+Ol++It8G/lcw7dsS6BsIV/uAmwrku74DV0VN5EQ4FePk
R68IoI2ve4sKfFr3WTXY2nil
-----END PRIVATE KEY-----
`;

      const signature = signer.sign(privateKey, "base64");
      const jwt = `${unsignedToken}.${signature.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`;

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: jwt,
        }),
      });
      const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };

      if (!tokenData.access_token) {
        return NextResponse.json({ ok: false, error: "OAuth2 failed", details: tokenData }, { status: 500 });
      }

      const fcmRes = await fetch(
        `https://fcm.googleapis.com/v1/projects/creative-feel-agency/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: pushToken,
              notification: { title: "Test Aconvi", body: "Push directo FCM V1 funcionando." },
              android: {
                priority: "high",
                notification: { sound: "default", channel_id: "default" },
              },
            },
          }),
        }
      );
      const fcmData = await fcmRes.json();
      return NextResponse.json({ ok: true, sentTo: pushToken, method: "fcm_v1_direct", fcmResponse: fcmData });
    }

    // Expo token relay
    const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ to: pushToken, title: "Test Aconvi", body: "Push funcionando.", sound: "default", priority: "high" }),
    });
    const expoData = await expoRes.json();
    return NextResponse.json({ ok: true, sentTo: pushToken, method: "expo_relay", expoResponse: expoData });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
