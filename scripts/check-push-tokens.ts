import { db } from "../packages/db/src/client";
import { pushToken, user } from "../packages/db/src/schema";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

async function run() {
  console.log("Checking push tokens in database...");
  try {
    const tokens = await db.select().from(pushToken);
    console.log(`Found ${tokens.length} push tokens in database:`);
    for (const t of tokens) {
      const u = await db.query.user.findFirst({
        where: eq(user.id, t.userId),
      });
      console.log(`- Token: ${t.token.slice(0, 30)}... | Platform: ${t.platform} | User: ${u?.name} (${u?.email}) | ID: ${t.userId}`);
    }
  } catch (err) {
    console.error("Error querying push tokens:", err);
  }
  process.exit(0);
}

run();
