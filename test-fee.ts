import { db } from "./packages/db/src/client";
import { fee, user } from "./packages/db/src/schema";

async function main() {
  const users = await db.query.user.findMany();
  if (users.length === 0) {
    console.log("No users found");
    process.exit(1);
  }
  const u = users[0];
  await db.insert(fee).values({
    organizationId: "org_aconvi_demo",
    userId: u.id,
    amount: 150.0,
    description: "Cuota extraordinaria por reparaciones de mayo",
    dueDate: "2026-05-31",
    status: "PENDING"
  });
  console.log("Demo fee created for user", u.id);
  process.exit(0);
}
main();
