import { NextResponse } from "next/server";
import { and, eq, isNull, lte } from "drizzle-orm";

import { db } from "@acme/db/client";
import { voteSession } from "@acme/db/schema";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 48 hours ago
    const cutoff = new Date(Date.now() - 48 * 3600 * 1000);

    const expired = await db.query.voteSession.findMany({
      where: and(
        eq(voteSession.status, "CLOSED"),
        lte(voteSession.closedAt, cutoff),
        isNull(voteSession.archivedAt),
      ),
    });

    for (const session of expired) {
      await db
        .update(voteSession)
        .set({ archivedAt: new Date() })
        .where(eq(voteSession.id, session.id));
    }

    return NextResponse.json({
      ok: true,
      archivedSessionsCount: expired.length,
    });
  } catch (error) {
    console.error("[CRON AUTO-ARCHIVE] Error archiving sessions:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
