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

    const r1 = crypto.randomUUID();
    const r2 = crypto.randomUUID();
    const r3 = crypto.randomUUID();

    const insertedUsers = await db.insert(user).values([
      { id: r1, name: "Vecino Demo 1", role: "Vecino", updatedAt: new Date() },
      { id: r2, name: "Vecino Demo 2", role: "Vecino", updatedAt: new Date() },
      { id: r3, name: "Vecino Demo 3", role: "Vecino", updatedAt: new Date() }
    ]).returning({ id: user.id });

    if (!insertedUsers || insertedUsers.length === 0) {
      throw new Error(`CRITICAL DB ANOMALY: insert into user succeeded but returned no rows!`);
    }

    const reporters = [r1, r2, r3];

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
        description: "Se ha producido una gotera grande en el techo del ático. El agua está cayendo al suelo y puede dañar el parqué. Es urgente revisarlo antes de que empeoren los daños estructurales.",
        category: "fontaneria",
        status: "RECIBIDA" as const,
        priority: "ALTA",
        providerId: null,
        reporterId: reporters[0],
        organizationId: TENANT_ID,
        createdAt: daysAgo(0),
        updatedAt: daysAgo(0)
      },
      {
        title: "Ascensor bloqueado en planta baja",
        description: "El ascensor principal se ha quedado atascado con las puertas cerradas. No hay nadie atrapado, pero el panel de botones no responde y hace un ruido extraño.",
        category: "ascensores",
        status: "ASIGNADA" as const,
        priority: "URGENTE",
        providerId: prov1,
        reporterId: reporters[1],
        organizationId: TENANT_ID,
        createdAt: daysAgo(1),
        updatedAt: daysAgo(1)
      },
      {
        title: "Luz fundida en pasillo 2º B",
        description: "La bombilla del pasillo frente al apartamento 2B lleva parpadeando varios días y hoy se ha fundido por completo. El pasillo está muy oscuro.",
        category: "electricidad",
        status: "EN_PROCESO" as const,
        priority: "MEDIA",
        providerId: prov2,
        reporterId: reporters[0],
        organizationId: TENANT_ID,
        createdAt: daysAgo(2),
        updatedAt: daysAgo(2)
      },
      {
        title: "Pared desconchada en recepción",
        description: "Alguien rozó la pared cerca de la entrada principal al mudar unos muebles. Hay una marca negra y falta un poco de pintura. Sería bueno arreglarlo por estética.",
        category: "otro",
        status: "RESUELTA" as const,
        priority: "BAJA",
        providerId: prov3,
        reporterId: reporters[2],
        organizationId: TENANT_ID,
        createdAt: daysAgo(3),
        updatedAt: daysAgo(3)
      }
    ];


    // TEMPORARY FIX: The Coolify production database is missing the 'category' column 
    // because drizzle-kit push was not run there. We patch it directly.
    try {
      await db.execute(sql`ALTER TABLE incident ADD COLUMN IF NOT EXISTS category varchar(64) NOT NULL DEFAULT 'otro'`);
      await db.execute(sql`ALTER TABLE incident ADD COLUMN IF NOT EXISTS final_photo_url text`);
      console.log("Patched category and final_photo_url columns in incident table");
    } catch (e) {
      console.error("Could not patch columns:", e);
    }

    const newIncidents = await db.insert(incident).values(demoIncidents).returning({ id: incident.id });
    createdCount += newIncidents.length;

    // 4. Create dummy history for the created incidents
    const historyData = [];
    if (newIncidents[0]) {
      historyData.push({
        incidentId: newIncidents[0].id,
        changedBy: reporters[0],
        action: "CREACIÓN",
        details: "El vecino ha reportado la incidencia con prioridad ALTA.",
        createdAt: daysAgo(0)
      });
    }
    if (newIncidents[1]) {
      historyData.push({
        incidentId: newIncidents[1].id,
        changedBy: reporters[1],
        action: "CREACIÓN",
        details: "El vecino ha reportado la incidencia.",
        createdAt: daysAgo(1)
      });
      historyData.push({
        incidentId: newIncidents[1].id,
        changedBy: reporters[1],
        action: "CAMBIO_ESTADO",
        details: "El estado ha cambiado a ASIGNADA. Se ha notificado al proveedor.",
        createdAt: new Date(daysAgo(1).getTime() + 2 * 3600000)
      });
    }
    if (newIncidents[2]) {
      historyData.push({
        incidentId: newIncidents[2].id,
        changedBy: reporters[0],
        action: "CREACIÓN",
        details: "El vecino ha reportado la incidencia.",
        createdAt: daysAgo(2)
      });
      historyData.push({
        incidentId: newIncidents[2].id,
        changedBy: reporters[0],
        action: "CAMBIO_ESTADO",
        details: "El estado ha cambiado a EN_PROCESO. El proveedor está trabajando en ello.",
        createdAt: new Date(daysAgo(2).getTime() + 24 * 3600000)
      });
    }
    if (newIncidents[3]) {
      historyData.push({
        incidentId: newIncidents[3].id,
        changedBy: reporters[2],
        action: "CREACIÓN",
        details: "El vecino ha reportado la incidencia.",
        createdAt: daysAgo(3)
      });
      historyData.push({
        incidentId: newIncidents[3].id,
        changedBy: reporters[2],
        action: "RESOLUCIÓN",
        details: "El proveedor ha marcado la incidencia como RESUELTA.",
        createdAt: new Date(daysAgo(3).getTime() + 48 * 3600000)
      });
    }

    if (historyData.length > 0) {
      await db.insert(incidentHistory).values(historyData);
    }

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
