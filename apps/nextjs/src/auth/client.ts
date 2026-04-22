import { createAuthClient } from "better-auth/react";
import { phoneNumberClient, magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [phoneNumberClient(), magicLinkClient()],
});
