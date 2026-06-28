import { type NextRequest, NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { auth } from "@acme/auth";
import { pushToken } from "@acme/db/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    const body = await req.json() as { token?: string; platform?: string };
    if (!body.token) {
      return NextResponse.json({ ok: false, error: "token required" }, { status: 400 });
    }
    const platform = body.platform ?? "expo";
    const userId = session.user.id;
    await db.execute(sql`DELETE FROM push_token WHERE user_id = ${userId} AND platform = ${platform}`);
    await db.insert(pushToken).values({ userId, token: body.token, platform });
    console.log("[PUSH_TOKEN] Registered for user", userId, body.token.slice(0, 30));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[PUSH_TOKEN_ERROR]", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
