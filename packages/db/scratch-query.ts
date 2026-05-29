import { db } from "./src/client";
import { provider, incident, user } from "./src/schema";

async function main() {
  const users = await db.select().from(user);
  console.log("Users in DB:");
  console.dir(users.map(u => ({ id: u.id, name: u.name, email: u.email, corporateUsername: u.corporateUsername, role: u.role, initialPinHash: u.initialPinHash })), { depth: null });

  const providers = await db.select().from(provider);
  console.log("\nProviders in DB:");
  console.dir(providers, { depth: null });

  const incidents = await db.select().from(incident);
  console.log("\nIncidents in DB:");
  console.dir(incidents.map(i => ({ id: i.id, title: i.title, status: i.status, providerId: i.providerId, organizationId: i.organizationId })), { depth: null });
}

main().catch(console.error);
