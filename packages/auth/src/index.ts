import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { oAuthProxy, organization, phoneNumber, magicLink, bearer } from "better-auth/plugins";
import { Resend } from "resend";

import { db } from "@acme/db/client";
import * as schema from "@acme/db/schema";

export function initAuth<
  TExtraPlugins extends BetterAuthPlugin[] = [],
>(options: {
  baseUrl: string;
  productionUrl: string;
  secret: string | undefined;
  resendApiKey?: string;
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
      expiresIn: 60 * 60 * 24 * 45, // 45 days (Requisito corporativo)
      updateAge: 60 * 60 * 24, // Update session every 1 day
    },
    plugins: [
      oAuthProxy({
        productionURL: options.productionUrl,
      }),
      expo(),
      bearer(),
      phoneNumber({
        sendOTP: async ({ phoneNumber, code }) => {
          console.log(`[AUTH] OTP requested for ${phoneNumber}: ${code}`);
          // Send SMS logic goes here (e.g., Twilio)
        },
        signUpOnVerification: {
          getTempEmail: (phoneNumber) => `${phoneNumber.replace("+", "")}@aconvi.app`,
          getTempName: () => "Vecino",
        },
      }),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          if (!options.resendApiKey) {
            // Dev mode: just log the link
            console.log(`[MAGIC LINK DEV] To: ${email} | URL: ${url}`);
            return;
          }
          const resend = new Resend(options.resendApiKey);
          await resend.emails.send({
            from: "Aconvi <noreply@aconvi.app>",
            to: email,
            subject: "Tu enlace de acceso — Aconvi",
            html: `
              <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                <img src="https://aconvi.app/logo.png" alt="Aconvi" width="120" style="margin-bottom: 24px;" />
                <h1 style="font-size: 22px; color: #0F1B2B; margin: 0 0 12px;">Tu enlace de acceso</h1>
                <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                  Haz clic en el botón de abajo para acceder a Aconvi. El enlace expira en <strong>15 minutos</strong>.
                </p>
                <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #00BDA5, #0891b2); color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 16px;">Entrar a Aconvi</a>
                <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">Si no solicitaste este enlace, ignora este email. No es necesaria ninguna acción.</p>
              </div>
            `,
          });
        },
        expiresIn: 60 * 15, // 15 minutes
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
