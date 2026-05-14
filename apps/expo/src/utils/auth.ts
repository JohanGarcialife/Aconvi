import * as SecureStore from "expo-secure-store";
import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import { magicLinkClient, phoneNumberClient } from "better-auth/client/plugins";

import { getBaseUrl } from "./base-url";

export const authClient = createAuthClient({
  baseURL: getBaseUrl(),
  fetchOptions: {
    onRequest: async (ctx: any) => {
      // Inyectar manualmente el token en todas las llamadas por seguridad
      try {
        const token = await SecureStore.getItemAsync("expo_session_token");
        if (token) {
          ctx.headers = { ...ctx.headers, Authorization: `Bearer ${token}` };
        }
      } catch (e) {}
      return ctx;
    }
  },
  plugins: [
    expoClient({
      scheme: "expo",
      storagePrefix: "expo",
      storage: SecureStore,
    }),
    magicLinkClient(),
    phoneNumberClient(),
  ],
});
