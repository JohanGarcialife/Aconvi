import { type NextRequest, NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { pushAuthSession, pushToken, session, user } from "@acme/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    // requestId is actually the pushAuthSession token (for API compatibility)
    const token = searchParams.get("requestId");

    if (!token) {
      return NextResponse.json({ status: "error", error: "requestId requerido." }, { status: 400 });
    }

    const pushSession = await db.query.pushAuthSession.findFirst({
      where: eq(pushAuthSession.token, token),
    });

    if (!pushSession) {
      return NextResponse.json({ status: "error", error: "Solicitud no encontrada." }, { status: 404 });
    }

    // Check expiry
    if (new Date() > pushSession.expiresAt && pushSession.status === "PENDING") {
      await db.update(pushAuthSession).set({ status: "EXPIRED" }).where(eq(pushAuthSession.token, token));
      return NextResponse.json({ status: "expired" });
    }

    if (pushSession.status === "EXPIRED" || pushSession.status === "CANCELLED") {
      return NextResponse.json({ status: pushSession.status === "CANCELLED" ? "rejected" : "expired" });
    }

    // If already confirmed and session token stored → return it
    if (pushSession.status === "CONFIRMED") {
      // Look up an existing web session for this user to return
      const webSession = await db.query.session.findFirst({
        where: eq(session.userId, pushSession.userId),
      });
      if (webSession) {
        return NextResponse.json({ status: "approved", sessionToken: webSession.token });
      }
    }

    // ── Auto-approve for demo users without a registered device ───────────────
    if (pushSession.status === "PENDING") {
      const ageMs = Date.now() - pushSession.createdAt.getTime();
      if (ageMs > 4000) {
        const userTokens = await db.query.pushToken.findMany({
          where: eq(pushToken.userId, pushSession.userId),
        });
        const foundUser = await db.query.user.findFirst({
          where: eq(user.id, pushSession.userId),
        });
        const isTestUser = foundUser?.corporateUsername === "jluis.test" ||
                           foundUser?.corporateUsername === "jluis.push";

        if (userTokens.length === 0 && isTestUser) {
          // Mark confirmed (demo auto-approve)
          await db.update(pushAuthSession)
            .set({ status: "CONFIRMED" })
            .where(eq(pushAuthSession.token, token));
          pushSession.status = "CONFIRMED";
          console.log(`[CHECK_PUSH] Demo auto-confirmed for ${foundUser?.corporateUsername}`);
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

      // Mark session as used (prevent double session creation)
      await db.update(pushAuthSession)
        .set({ status: "EXPIRED" })
        .where(eq(pushAuthSession.token, token));

      return NextResponse.json({ status: "approved", sessionToken });
    }

    // Still pending
    return NextResponse.json({ status: "pending" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("[API_CHECK_PUSH]", error);
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
