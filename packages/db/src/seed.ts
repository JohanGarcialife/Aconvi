import { db } from "./client";
import { user, organization, member } from "./schema";

async function main() {
  console.log("Seeding Database...");

  const userId = "user_test_" + crypto.randomUUID().substring(0, 8);
  const orgId = "org_test_" + crypto.randomUUID().substring(0, 8);

  // Create a default test user
  await db.insert(user).values({
    id: userId,
    name: "Administrador de Pruebas",
    email: "test@aconvi.com",
    phoneNumber: "+34 600 000 000",
    role: "AF",
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoNothing();

  // Create a default organization
  await db.insert(organization).values({
    id: orgId,
    name: "Comunidad Ficticia Los Pinos",
    slug: "finca-los-pinos-" + orgId.substring(0, 4),
    createdAt: new Date(),
  }).onConflictDoNothing();

  // Link user to organization
  await db.insert(member).values({
    id: "member_" + crypto.randomUUID().substring(0, 8),
    userId,
    organizationId: orgId,
    role: "admin",
    createdAt: new Date(),
  }).onConflictDoNothing();

  console.log("Database seed completed!");
  console.log("-----------------------------------------");
  console.log("Test User Phone: +34 600 000 000");
  console.log("Finca Created: Comunidad Ficticia Los Pinos");
  console.log("-----------------------------------------");

  process.exit(0);
}

main().catch(console.error);
