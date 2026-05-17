import { NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { incident, incidentHistory, user, organization } from "@acme/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const TENANT_ID = "org_aconvi_demo";

export async function GET() {
  let createdCount = 0;
  try {
    const DEMO_REPORTER_ID = crypto.randomUUID();
    
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`
      INSERT INTO organization (id, name, slug, created_at) 
      VALUES (${TENANT_ID}, 'Aconvi Demo', 'aconvi-demo', now())
      ON CONFLICT (id) DO NOTHING;
    `);

    await db.delete(incident).where(eq(incident.organizationId, TENANT_ID));

    const insertedUsers = await db.insert(user).values({
      id: DEMO_REPORTER_ID,
      name: "Vecino Demo",
      role: "Vecino",
      updatedAt: new Date()
    }).returning({ id: user.id });

    if (!insertedUsers || insertedUsers.length === 0) {
      throw new Error(`CRITICAL DB ANOMALY: insert into user succeeded but returned no rows!`);
    }

    const verifyUser = await db.query.user.findFirst({
      where: eq(user.id, DEMO_REPORTER_ID)
    });

    if (!verifyUser) {
      throw new Error(`CRITICAL DB ANOMALY: user ${DEMO_REPORTER_ID} was returned by INSERT but cannot be found by SELECT!`);
    }

    const providersList = await db.query.provider.findMany({ 
      where: eq(incident.organizationId, TENANT_ID),
      limit: 4 
    });
    
    const prov1 = providersList[0]?.id || null;
    const prov2 = providersList[1]?.id || prov1;
    const prov3 = providersList[2]?.id || prov1;
    const prov4 = providersList[3]?.id || prov1;

    const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

    const demoIncidents = [
      {
        title: "Gotera en tejado - 3ª planta",
        description: "Se ha producido una gotera...",
        category: "fontaneria",
        status: "RECIBIDA" as const,
        priority: "ALTA",
        providerId: null,
        reporterId: DEMO_REPORTER_ID,
        organizationId: TENANT_ID,
        createdAt: daysAgo(0),
        updatedAt: daysAgo(0)
      }
    ];

    const [newIncident] = await db.insert(incident).values(demoIncidents).returning({ id: incident.id });
    createdCount++;

    return NextResponse.json({ success: true, message: `Created ${createdCount} demo incidents` });
  } catch (error: any) {
    let diagnostics = {};
    try {
      const dbUrl = process.env.POSTGRES_URL || "UNDEFINED";
      const maskedUrl = dbUrl.replace(/:[^:@]*@/, ":***@");
      const { sql } = await import("drizzle-orm");
      const res = await db.execute(sql`
        SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='incident';
      `);
      diagnostics = {
        database_host: maskedUrl.split('@')[1] || maskedUrl,
        foreign_keys: res.rows
      };
    } catch (diagError: any) {
      diagnostics = { error: diagError.message };
    }

    return NextResponse.json({ 
      error_message: error.message, 
      error_cause_message: error.cause ? (error.cause as any).message : "No cause",
      error_name: error.name,
      error_code: error.code || (error.cause && (error.cause as any).code),
      error_detail: error.detail || (error.cause && (error.cause as any).detail) || "No detail",
      error_constraint: error.constraint || (error.cause && (error.cause as any).constraint) || "No constraint",
      error_routine: error.routine || (error.cause && (error.cause as any).routine),
      error_stack: error.stack,
      diagnostics 
    }, { status: 500 });
  }
}
