import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { oAuthProxy, magicLink, organization, phoneNumber } from "better-auth/plugins";

import { db } from "@acme/db/client";
import * as schema from "@acme/db/schema";

export function initAuth<
  TExtraPlugins extends BetterAuthPlugin[] = [],
>(options: {
  baseUrl: string;
  productionUrl: string;
  secret: string | undefined;

  discordClientId: string;
  discordClientSecret: string;
  extraPlugins?: TExtraPlugins;
}) {
  const config = {
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        ...schema,
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification
      }
    }),
    baseURL: options.baseUrl,
    secret: options.secret,
    session: {
      expiresIn: 60 * 60 * 24 * 365, // 1 year (Estilo WhatsApp)
      updateAge: 60 * 60 * 24, // Update session every 1 day
    },
    plugins: [
      oAuthProxy({
        productionURL: options.productionUrl,
      }),
      expo(),
      magicLink({
        sendMagicLink: async ({ email, token, url }) => {
          console.log(`[AUTH] Magic link for ${email}: ${url}`);
        },
      }),
      phoneNumber({
        sendOTP: async ({ phoneNumber, code }, request) => {
          console.log(`[AUTH] OTP requested for ${phoneNumber}: ${code}`);
          // Send SMS logic goes here (e.g., Twilio)
        },
        signUpOnVerification: {
          getTempEmail: (phoneNumber) => `${phoneNumber.replace("+", "")}@aconvi.app`,
          getTempName: () => "Vecino",
        },
      }),
      organization(),
      ...(options.extraPlugins ?? []),
    ],
    socialProviders: {
      discord: {
        clientId: options.discordClientId,
        clientSecret: options.discordClientSecret,
        redirectURI: `${options.productionUrl}/api/auth/callback/discord`,
      },
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: true,
          defaultValue: "Vecino",
        },
      },
    },
    trustedOrigins: ["expo://"],
    onAPIError: {
      onError(error, ctx) {
        console.error("BETTER AUTH API ERROR", error, ctx);
      },
    },
  } satisfies BetterAuthOptions;

  return betterAuth(config);
}

export type Auth = ReturnType<typeof initAuth>;
export type Session = Auth["$Infer"]["Session"];
