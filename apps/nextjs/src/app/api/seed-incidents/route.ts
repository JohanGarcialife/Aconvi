import { NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { incident, incidentHistory, user } from "@acme/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const TENANT_ID = "org_aconvi_demo";

export async function GET() {
  try {
    // 0. Ensure organization exists
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`
      INSERT INTO organization (id, name, slug, created_at) 
      VALUES (${TENANT_ID}, 'Aconvi Demo', 'aconvi-demo', now())
      ON CONFLICT (id) DO NOTHING;
    `);

    // 1. Delete existing demo incidents for this tenant
    await db.delete(incident).where(eq(incident.organizationId, TENANT_ID));

    // 2. Create a specific Demo User to ensure foreign keys work 100% of the time
    // We use a random UUID so that every request gets a unique user and bypasses ANY Next.js fetch caching.
    const DEMO_REPORTER_ID = crypto.randomUUID();
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
      throw new Error(`CRITICAL DB ANOMALY: user ${DEMO_REPORTER_ID} was returned by INSERT but cannot be found by SELECT! Database might be using aggressive read replicas or rolling back implicitly!`);
    }

    const reporters = [DEMO_REPORTER_ID, DEMO_REPORTER_ID, DEMO_REPORTER_ID];

    // 3. Fetch existing providers to assign
    const providersList = await db.query.provider.findMany({ 
      where: eq(incident.organizationId, TENANT_ID),
      limit: 4 
    });
    
    const prov1 = providersList[0]?.id;
    const prov2 = providersList[1]?.id ?? prov1;
    const prov3 = providersList[2]?.id ?? prov1;
    const prov4 = providersList[3]?.id ?? prov1;

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
        createdAt: daysAgo(0),
        updatedAt: daysAgo(0),
        history: [
          { actorName: "Vecino", action: "CREATED", newStatus: "RECIBIDA", hoursAfter: 0 }
        ]
      },
      {
        title: "Ascensor bloqueado - Portal A",
        description: "El ascensor del portal A lleva bloqueado desde esta mañana. Vecinos mayores no pueden subir a sus pisos. Se requiere intervención urgente del técnico.",
        category: "electricidad",
        status: "EN_REVISION" as const,
        priority: "URGENTE",
        providerId: prov1,
        reporterId: reporters[1],
        createdAt: daysAgo(1),
        updatedAt: daysAgo(1),
        history: [
          { actorName: "Vecino", action: "CREATED", newStatus: "RECIBIDA", hoursAfter: 0 },
          { actorName: "Admin", action: "ASSIGNED", previousStatus: "RECIBIDA", newStatus: "EN_REVISION", comment: "Asignado a Electricidad Martínez", hoursAfter: 2 }
        ]
      },
      {
        title: "Piscina - Agua turbia y con olor",
        description: "El agua de la piscina comunitaria está turbia y presenta mal olor. Posible fallo en el sistema de filtrado. Varios vecinos han notado irritación en los ojos.",
        category: "piscina",
        status: "AGENDADA" as const,
        priority: "MEDIA",
        providerId: prov2,
        reporterId: reporters[0],
        createdAt: daysAgo(3),
        updatedAt: daysAgo(3),
        history: [
          { actorName: "Vecino", action: "CREATED", newStatus: "RECIBIDA", hoursAfter: 0 },
          { actorName: "Admin", action: "STATUS_CHANGED", previousStatus: "RECIBIDA", newStatus: "EN_REVISION", hoursAfter: 4 },
          { actorName: "Admin", action: "STATUS_CHANGED", previousStatus: "EN_REVISION", newStatus: "AGENDADA", comment: "Visita el viernes 9:00h", hoursAfter: 24 }
        ]
      },
      {
        title: "Bajante atascada - Portal 2",
        description: "La bajante de aguas residuales del portal 2 está atascada. Hay mal olor en el portal y en las plantas bajas. El agua del baño no desagua correctamente.",
        category: "fontaneria",
        status: "EN_CURSO" as const,
        priority: "MEDIA",
        providerId: prov2,
        reporterId: reporters[2],
        createdAt: daysAgo(5),
        updatedAt: daysAgo(5),
        history: [
          { actorName: "Vecino", action: "CREATED", newStatus: "RECIBIDA", hoursAfter: 0 },
          { actorName: "Admin", action: "STATUS_CHANGED", previousStatus: "RECIBIDA", newStatus: "EN_REVISION", hoursAfter: 3 },
          { actorName: "Fontanero", action: "STATUS_CHANGED", previousStatus: "EN_REVISION", newStatus: "EN_CURSO", comment: "Desatasco en proceso", hoursAfter: 48 }
        ]
      },
      {
        title: "Baja presión de agua - 2ª planta",
        description: "Los vecinos del 2º piso reportan baja presión de agua en todos los grifos desde hace 4 días. La ducha apenas funciona. No afecta a otras plantas.",
        category: "fontaneria",
        status: "RECIBIDA" as const,
        priority: "BAJA",
        providerId: null,
        reporterId: reporters[1],
        createdAt: daysAgo(4),
        updatedAt: daysAgo(4),
        history: [
          { actorName: "Vecino", action: "CREATED", newStatus: "RECIBIDA", hoursAfter: 0 }
        ]
      },
      {
        title: "Luces del garaje fundidas",
        description: "Las luces del garaje en la planta -1 no funcionan desde hace una semana. Riesgo de seguridad. Se han instalado luces de emergencia.",
        category: "electricidad",
        status: "RESUELTA" as const,
        priority: "MEDIA",
        providerId: prov1,
        reporterId: reporters[0],
        createdAt: daysAgo(10),
        updatedAt: daysAgo(10),
        resolvedAt: daysAgo(6),
        history: [
          { actorName: "Vecino", action: "CREATED", newStatus: "RECIBIDA", hoursAfter: 0 },
          { actorName: "Electricista", action: "COMPLETED", previousStatus: "EN_CURSO", newStatus: "RESUELTA", comment: "Fluorescentes sustituidos", hoursAfter: 50 }
        ]
      },
      {
        title: "Portón de acceso no cierra",
        description: "El portón de acceso principal al garaje no cierra correctamente. Al bajar, queda entreabierto unos 20cm.",
        category: "cerrajeria",
        status: "RESUELTA" as const,
        priority: "ALTA",
        providerId: prov3,
        reporterId: reporters[2],
        createdAt: daysAgo(15),
        updatedAt: daysAgo(15),
        resolvedAt: daysAgo(11),
        history: [
          { actorName: "Vecino", action: "CREATED", newStatus: "RECIBIDA", hoursAfter: 0 },
          { actorName: "Cerrajero", action: "COMPLETED", previousStatus: "EN_CURSO", newStatus: "RESUELTA", comment: "Motor sustituido", hoursAfter: 10 }
        ]
      },
      {
        title: "Pinturas en zona comunitaria",
        description: "La pintura del hall de entrada y la escalera principal presenta descascarados. Afecta a la imagen de la comunidad.",
        category: "otro",
        status: "EN_REVISION" as const,
        priority: "BAJA",
        providerId: prov4,
        reporterId: reporters[1],
        createdAt: daysAgo(7),
        updatedAt: daysAgo(7),
        history: [
          { actorName: "Vecino", action: "CREATED", newStatus: "RECIBIDA", hoursAfter: 0 },
          { actorName: "Admin", action: "ASSIGNED", previousStatus: "RECIBIDA", newStatus: "EN_REVISION", comment: "Esperando presupuesto", hoursAfter: 48 }
        ]
      }
    ];

    let createdCount = 0;
    for (const inc of demoIncidents) {
      const [newIncident] = await db.insert(incident).values({
        organizationId: TENANT_ID,
        title: inc.title,
        description: inc.description,
        category: inc.category,
        status: inc.status,
        priority: inc.priority,
        reporterId: inc.reporterId,
        providerId: inc.providerId,
        createdAt: inc.createdAt,
        updatedAt: inc.updatedAt,
        resolvedAt: inc.resolvedAt,
      }).returning({ id: incident.id });

      for (const h of inc.history) {
        await db.insert(incidentHistory).values({
          incidentId: newIncident!.id,
          actorName: h.actorName,
          action: h.action,
          previousStatus: h.previousStatus || null,
          newStatus: h.newStatus,
          comment: h.comment || null,
          createdAt: new Date(inc.createdAt.getTime() + h.hoursAfter * 3600000)
        });
      }
      createdCount++;
    }

    return NextResponse.json({ success: true, message: `Created ${createdCount} demo incidents` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
