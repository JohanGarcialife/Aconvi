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
    if (!pushToken && body.userId) {
      const row = await db.execute(sql`SELECT token FROM push_token WHERE user_id = ${body.userId} LIMIT 1`);
      pushToken = (row.rows[0] as any)?.token;
    }
    if (!pushToken) return NextResponse.json({ ok: false, error: "No token" }, { status: 400 });
    const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ to: pushToken, title: "Test Aconvi", body: "Push funcionando.", sound: "default", priority: "high" }),
    });
    const expoData = await expoRes.json();
    return NextResponse.json({ ok: true, sentTo: pushToken, expoResponse: expoData });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
