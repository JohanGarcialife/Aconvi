import { db } from "./src/client";
import { user, incident, organization } from "./src/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

async function main() {
  const TENANT_ID = "org_aconvi_demo";
  try {
    const DEMO_REPORTER_ID = crypto.randomUUID();
    await db.insert(user).values({
      id: DEMO_REPORTER_ID,
      name: "Vecino Demo",
      role: "Vecino",
      updatedAt: new Date()
    });
    
    await db.insert(incident).values([{
      title: "Test",
      description: "Test",
      category: "otro",
      status: "RECIBIDA",
      priority: "BAJA",
      reporterId: DEMO_REPORTER_ID,
      organizationId: TENANT_ID,
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
    
    console.log("SUCCESS!");
  } catch(e) {
    console.error("ERROR CAUSE:", e);
  }
}

main();
