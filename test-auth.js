import { betterAuth } from "better-auth";
import { phoneNumber } from "better-auth/plugins";
import Database from "better-sqlite3";

const auth = betterAuth({
  database: new Database(":memory:"),
  plugins: [
    phoneNumber({
      sendOTP: ({ phoneNumber, code }) => console.log(phoneNumber, code)
    })
  ]
});

async function run() {
  await auth.api.sendOTP({
    body: { phoneNumber: "+34 600 000 000" },
    headers: new Headers()
  }).catch(e => console.log(e));
}
run();
