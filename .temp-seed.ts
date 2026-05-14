import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { organization, member, notice, user, commonArea, document } from "./packages/db/src/schema";
import { eq, and } from "drizzle-orm";
import { resolve } from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), ".env") });

async function seed() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is not set");
  }

  const client = postgres(process.env.POSTGRES_URL);
  const db = drizzle(client);

  const TENANT_ID = "org_aconvi_demo";
  const USER_ID = "user_admin";

  console.log("Comprobando organización demo...");
  
  // Create or verify org
  let [org] = await db.select().from(organization).where(eq(organization.id, TENANT_ID));
  if (!org) {
    console.log("Creando organización demo...");
    [org] = await db.insert(organization).values({
      id: TENANT_ID,
      name: "Residencial Aconvi Demo",
      slug: "residencial-aconvi-demo",
      createdAt: new Date(),
    }).returning();
  }

  // Create or verify user_admin
  let [admin] = await db.select().from(user).where(eq(user.id, USER_ID));
  if (!admin) {
    console.log("Creando usuario admin...");
    [admin] = await db.insert(user).values({
      id: USER_ID,
      name: "Admin Demo",
      email: "admin@aconvi.com",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: true,
    }).returning();
  }

  // Verify membership
  const [membership] = await db.select().from(member).where(
    and(eq(member.organizationId, TENANT_ID), eq(member.userId, USER_ID))
  );
  
  if (!membership) {
    console.log("Añadiendo admin como owner de la organización...");
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: TENANT_ID,
      userId: USER_ID,
      role: "owner",
      createdAt: new Date(),
    });
  }

  console.log("Añadiendo comunicados...");
  await db.insert(notice).values([
    {
      id: crypto.randomUUID(),
      organizationId: TENANT_ID,
      title: "Mantenimiento de ascensores",
      content: "El próximo lunes de 10:00 a 14:00 se realizará el mantenimiento preventivo de los ascensores de todas las torres.",
      type: "AVISO",
      authorId: USER_ID,
      pinned: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 días
    },
    {
      id: crypto.randomUUID(),
      organizationId: TENANT_ID,
      title: "Corte de agua programado",
      content: "Aviso urgente: corte de agua programado para mañana debido a una reparación en la tubería principal de la calle.",
      type: "URGENTE",
      authorId: USER_ID,
      pinned: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 horas
    },
    {
      id: crypto.randomUUID(),
      organizationId: TENANT_ID,
      title: "Nueva normativa de piscina",
      content: "Ya está publicada la normativa de uso de la piscina para este verano. Pueden consultarla en la sección de documentos.",
      type: "COMUNICADO",
      authorId: USER_ID,
      pinned: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 días
    }
  ]);

  console.log("Añadiendo zonas comunes...");
  await db.insert(commonArea).values([
    {
      id: crypto.randomUUID(),
      organizationId: TENANT_ID,
      name: "Pista de Pádel",
      description: "Pista de pádel de cristal con iluminación LED.",
      status: "ACTIVE",
      rules: JSON.stringify(["Reserva máxima de 2 horas", "Uso obligatorio de calzado deportivo"]),
      settings: JSON.stringify({ maxAdvanceDays: 7, slotsPerDay: 8 }),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: crypto.randomUUID(),
      organizationId: TENANT_ID,
      name: "Sala Multiusos",
      description: "Espacio para cumpleaños y reuniones.",
      status: "ACTIVE",
      rules: JSON.stringify(["Prohibido pegar decoraciones en las paredes", "Dejar limpio tras el uso"]),
      settings: JSON.stringify({ maxAdvanceDays: 30, slotsPerDay: 2 }),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ]);

  console.log("Añadiendo documentos...");
  await db.insert(document).values([
    {
      id: crypto.randomUUID(),
      organizationId: TENANT_ID,
      title: "Acta Junta Ordinaria",
      category: "ACTA",
      fileUrl: "https://example.com/acta.pdf",
      authorId: USER_ID,
      visibility: "ALL",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
    },
    {
      id: crypto.randomUUID(),
      organizationId: TENANT_ID,
      title: "Presupuesto anual",
      category: "PRESUPUESTO",
      fileUrl: "https://example.com/presupuesto.pdf",
      authorId: USER_ID,
      visibility: "ALL",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15),
    }
  ]);

  console.log("✅ Datos de demostración insertados con éxito");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Error seeding:", err);
  process.exit(1);
});
