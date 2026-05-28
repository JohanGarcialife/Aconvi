import { db } from "./src/client";
import { user, account } from "./src/schema";

async function main() {
  const users = await db.select().from(user);
  console.log("Users:", users.map(u => ({ id: u.id, name: u.name, role: u.role, email: u.email, corporateUsername: u.corporateUsername })));
  process.exit(0);
}
main();
