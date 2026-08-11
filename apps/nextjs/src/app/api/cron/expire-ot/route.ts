import { NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { incident, incidentHistory } from "@acme/db/schema";
import { eq, and, isNotNull, lt } from "drizzle-orm";
import { emitWebSocketEvent } from "@acme/api";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const EXPIRATION_MS = 120 * 60 * 1000; // 2 hours
    const expirationThreshold = new Date(Date.now() - EXPIRATION_MS);

    // Find all EN_REVISION incidents assigned more than 2 hours ago
    const expiredIncidents = await db.query.incident.findMany({
      where: and(
        eq(incident.status, "EN_REVISION"),
        isNotNull(incident.assignedAt),
        lt(incident.assignedAt, expirationThreshold)
      ),
    });

    let expiredCount = 0;

    for (const inc of expiredIncidents) {
      await db
        .update(incident)
        .set({
          status: "RECIBIDA",
          providerId: null,
          estimatedCost: null,
          estimatedDays: null,
          scheduledAt: null,
          estimatedDuration: null,
        })
        .where(eq(incident.id, inc.id));

      await db.insert(incidentHistory).values({
        incidentId: inc.id,
        actorName: "Sistema",
        action: "OT_EXPIRED",
        previousStatus: "EN_REVISION",
        newStatus: "RECIBIDA",
        comment: "OT Caducada por límite de tiempo de respuesta.",
      });

      void emitWebSocketEvent(inc.organizationId, "incident-updated", { ...inc, status: "RECIBIDA", providerId: null });
      expiredCount++;
    }

    return NextResponse.json({
      ok: true,
      expiredCount,
    });
  } catch (error) {
    console.error("[CRON EXPIRE OT] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
