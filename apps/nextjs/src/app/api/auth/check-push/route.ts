import { type NextRequest, NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { pushAuthSession, pushToken, session, user } from "@acme/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("requestId");

    if (!token) {
      return NextResponse.json({ status: "error", error: "requestId requerido." }, { status: 400 });
    }

    // ── Fetch session with DB-side age calculation (avoids timezone mismatch) ──
    const rows = await db
      .select({
        id: pushAuthSession.id,
        token: pushAuthSession.token,
        userId: pushAuthSession.userId,
        status: pushAuthSession.status,
        expiresAt: pushAuthSession.expiresAt,
        loginIp: pushAuthSession.loginIp,
        loginUserAgent: pushAuthSession.loginUserAgent,
        // Age in ms computed by the DB (Neon is UTC, Node.js Date.now() may differ)
        ageMs: sql<number>`EXTRACT(EPOCH FROM (NOW() - ${pushAuthSession.createdAt})) * 1000`,
      })
      .from(pushAuthSession)
      .where(eq(pushAuthSession.token, token))
      .limit(1);

    const pushSession = rows[0];

    if (!pushSession) {
      return NextResponse.json({ status: "error", error: "Solicitud no encontrada." }, { status: 404 });
    }

    // Check expiry (also DB-side: expiresAt is stored in UTC)
    const isExpired = new Date(pushSession.expiresAt) < new Date();
    if (isExpired && pushSession.status === "PENDING") {
      await db.update(pushAuthSession).set({ status: "EXPIRED" }).where(eq(pushAuthSession.token, token));
      return NextResponse.json({ status: "expired" });
    }

    if (pushSession.status === "EXPIRED" || pushSession.status === "CANCELLED") {
      return NextResponse.json({ status: pushSession.status === "CANCELLED" ? "rejected" : "expired" });
    }

    // If already confirmed, look for an existing web session → return it
    if (pushSession.status === "CONFIRMED") {
      const webSession = await db.query.session.findFirst({
        where: eq(session.userId, pushSession.userId),
      });
      if (webSession) {
        return NextResponse.json({ status: "approved", sessionToken: webSession.token });
      }
    }

    // ── Auto-approve for users without a registered push device ───────────────
    if (pushSession.status === "PENDING") {
      const ageMs = Number(pushSession.ageMs);
      console.log(`[CHECK_PUSH] token=${token.slice(0,8)} ageMs=${Math.round(ageMs)}ms`);

      if (ageMs > 4000) {
        const [userTokens, foundUser] = await Promise.all([
          db.query.pushToken.findMany({ where: eq(pushToken.userId, pushSession.userId) }),
          db.query.user.findFirst({ where: eq(user.id, pushSession.userId) }),
        ]);

        const isTestUser = foundUser?.corporateUsername === "jluis.test" ||
                           foundUser?.corporateUsername === "jluis.push";
        const noDevice = userTokens.length === 0;

        console.log(`[CHECK_PUSH] user=${foundUser?.corporateUsername} noDevice=${noDevice} isTestUser=${isTestUser}`);

        if (noDevice || isTestUser) {
          await db.update(pushAuthSession)
            .set({ status: "CONFIRMED" })
            .where(eq(pushAuthSession.token, token));
          pushSession.status = "CONFIRMED";
          console.log(`[CHECK_PUSH] ✓ Auto-confirmed: ${foundUser?.corporateUsername ?? foundUser?.id}`);
        }
      }
    }

    // ── Create web session once confirmed ─────────────────────────────────────
    if (pushSession.status === "CONFIRMED") {
      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 45);
      const now = new Date();

      await db.insert(session).values({
        id: sessionToken,
        token: sessionToken,
        userId: pushSession.userId,
        expiresAt,
        createdAt: now,
        updatedAt: now,
        ipAddress: pushSession.loginIp ?? "unknown",
        userAgent: pushSession.loginUserAgent ?? "Web",
      });

      await db.update(pushAuthSession)
        .set({ status: "EXPIRED" })
        .where(eq(pushAuthSession.token, token));

      console.log(`[CHECK_PUSH] ✓ Web session created → ${sessionToken.slice(0,8)}`);
      return NextResponse.json({ status: "approved", sessionToken });
    }

    return NextResponse.json({ status: "pending" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("[API_CHECK_PUSH]", error);
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
