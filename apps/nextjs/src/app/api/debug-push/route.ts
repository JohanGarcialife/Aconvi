import { NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { pushToken, user } from "@acme/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const tokens = await db.select().from(pushToken);
    const results = [];
    for (const t of tokens) {
      const u = await db.query.user.findFirst({
        where: eq(user.id, t.userId),
      });
      results.push({
        tokenId: t.id,
        userId: t.userId,
        token: t.token,
        platform: t.platform,
        createdAt: t.createdAt,
        user: u ? { name: u.name, email: u.email } : null,
      });
    }
    return NextResponse.json({ ok: true, count: tokens.length, tokens: results });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message });
  }
}
