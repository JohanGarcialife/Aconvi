import { db } from "@acme/db/client";

import { incident, incidentHistory, user } from "@acme/db/schema";

async function main() {
  try {
    const TENANT_ID = "org_aconvi_demo";
    const DEMO_REPORTER_ID = "demo-reporter-id";
    const userQuery = db.insert(user).values({
      id: DEMO_REPORTER_ID,
      name: "Vecino Demo",
      role: "Vecino"
    }).onConflictDoNothing();
    
    console.log("User query:", userQuery.toSQL());
    await userQuery;

    const [newIncident] = await db.insert(incident).values({
      organizationId: TENANT_ID,
      title: "Gotera en tejado",
      description: "Gotera...",
      category: "fontaneria",
      status: "RECIBIDA",
      priority: "ALTA",
      reporterId: DEMO_REPORTER_ID,
      providerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning({ id: incident.id });
    console.log("Incident inserted:", newIncident);
  } catch (e: any) {
    console.error("Error occurred!", e.message);
    if (e.cause) console.error("Cause:", e.cause);
  }
}

main().catch(console.error);
