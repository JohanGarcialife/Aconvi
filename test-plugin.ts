import { betterAuth } from "better-auth";
import { phoneNumber } from "better-auth/plugins";
import Database from "better-sqlite3";

const auth = betterAuth({
  database: new Database(":memory:"),
  plugins: [
    phoneNumber()
  ]
});

async function main() {
  const sendRes = await auth.api.sendOTP({
    body: { phoneNumber: "+34600000000" },
    headers: new Headers()
  }).catch(e => console.log("send error", e));
  
  console.log("Send:", sendRes);

  const verifyRes = await auth.api.verifyOTP({
      body: { phoneNumber: "+34600000000", code: "" }
  });
}
main();
