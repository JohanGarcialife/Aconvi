import { NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { incident, incidentHistory } from "@acme/db/schema";
import { eq, and, isNotNull, lt } from "drizzle-orm";
import { emitWebSocketEvent, sendPushToAFs, sendPushToUser } from "@acme/api";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const NO_SHOW_BUFFER_MS = 60 * 60 * 1000;
    const threshold = new Date(Date.now() - NO_SHOW_BUFFER_MS);

    const noShowIncidents = await db.query.incident.findMany({
      where: and(
        eq(incident.status, "AGENDADA"),
        isNotNull(incident.scheduledAt),
        lt(incident.scheduledAt, threshold)
      ),
    });

    let noShowCount = 0;

    for (const inc of noShowIncidents) {
      await db
        .update(incident)
        .set({
          status: "NO_PRESENTADA",
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
        action: "NO_SHOW",
        previousStatus: "AGENDADA",
        newStatus: "NO_PRESENTADA",
        comment: "El proveedor acepto y agendo la intervencion pero no se presento en el plazo de 1 hora desde la hora programada.",
      });

      // Push notification to all AFs of the org
      void sendPushToAFs(db, inc.organizationId, {
        title: "OT No presentada",
        body: `El proveedor no inició la intervención agendada para "${inc.title}" tras 1 hora. La OT ha quedado liberada para reasignar.`,
        data: { type: "no_show", incidentId: inc.id },
      }).catch(console.error);

      // Push notification to vecino
      if (inc.reporterId) {
        void sendPushToUser(db, inc.reporterId, {
          title: "Actualización de tu incidencia",
          body: `La intervención prevista para "${inc.title}" no se ha iniciado. Estamos gestionando una nueva actuación.`,
          data: { type: "no_show", incidentId: inc.id },
        }).catch(console.error);
      }

      void emitWebSocketEvent(inc.organizationId, "incident-updated", {
        ...inc,
        status: "NO_PRESENTADA",
        providerId: null,
      });

      noShowCount++;
    }

    return NextResponse.json({ ok: true, noShowCount });
  } catch (error) {
    console.error("[CRON NO-SHOW] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
