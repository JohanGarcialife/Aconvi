import { type NextRequest, NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { pushToken, session } from "@acme/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/register-push-token
 * Body: { token: string, platform?: "expo" | "web" }
 * Auth: Bearer <session_token>
 *
 * Registers a push token for the authenticated user.
 * Resolves session via DB lookup (same as get-session route).
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Extract Bearer token
    const authHeader = req.headers.get("authorization") ?? "";
    const sessionToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    if (!sessionToken) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    // 2. Resolve session from DB
    const foundSession = await db.query.session.findFirst({
      where: eq(session.token, sessionToken),
    });

    if (!foundSession || foundSession.expiresAt < new Date()) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = foundSession.userId;

    // 3. Parse body
    const body = await req.json() as { token?: string; platform?: string };
    if (!body.token) {
      return NextResponse.json({ ok: false, error: "token required" }, { status: 400 });
    }

    const platform = body.platform ?? "expo";

    // 4. Upsert: ensure token exclusivity (delete it from other users first)
    await db.execute(sql`DELETE FROM push_token WHERE token = ${body.token}`);
    await db.execute(sql`DELETE FROM push_token WHERE user_id = ${userId} AND platform = ${platform}`);
    await db.insert(pushToken).values({ id: crypto.randomUUID(), userId, token: body.token, platform });


    console.log(`[PUSH_TOKEN] Registered for user ${userId}: ${body.token.slice(0, 30)}...`);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[PUSH_TOKEN_ERROR]", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
