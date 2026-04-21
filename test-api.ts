import { db } from "./packages/db/src/client";
import { initAuth } from "./packages/auth/src/index";

export const auth = initAuth({
  baseUrl: "http://localhost:3000",
  productionUrl: "http://localhost:3000",
  secret: "testing123",
  discordClientId: "discord",
  discordClientSecret: "discordsecret"
});

async function run() {
  try {
    const sendRes = await auth.api.sendOTP({
      body: { phoneNumber: "+34600000000" },
      headers: new Headers()
    });
    console.log("Send res:", sendRes);

    const getQuery = await db.query.verification.findFirst({
        orderBy: (v, { desc }) => [desc(v.createdAt)]
    });
    console.log("Found:", getQuery);
    const code = getQuery?.value.split(":")[0];

    const verifyRes = await auth.api.verifyOTP({
      body: { phoneNumber: "+34600000000", code: code }
    });
    console.log("Verify res:", verifyRes);
  } catch (e: any) {
    console.error("CAUGHT ERROR:", e);
    console.error(e.message, e.stack, e.context);
  }
}

run();
