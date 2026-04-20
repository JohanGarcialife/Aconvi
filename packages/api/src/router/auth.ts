import type { TRPCRouterRecord } from "@trpc/server";

import { desc, eq } from "@acme/db";
import { verification } from "@acme/db/schema";
import { z } from "@acme/validators";

import { protectedProcedure, publicProcedure } from "../trpc";

export const authRouter = {
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session;
  }),
  getLatestOTP: publicProcedure
    .input(z.object({ phoneNumber: z.string() }))
    .query(async ({ ctx, input }) => {
      // Security: Only allow for the test number to prevent data leaks
      if (input.phoneNumber !== "+34 600 000 000") {
        throw new Error("OTP retrieval only allowed for test number");
      }

      const latest = await ctx.db.query.verification.findFirst({
        where: eq(verification.identifier, input.phoneNumber),
        orderBy: desc(verification.createdAt),
      });

      return latest?.value;
    }),
  getSecretMessage: protectedProcedure.query(() => {
    return "you can see this secret message!";
  }),
} satisfies TRPCRouterRecord;
