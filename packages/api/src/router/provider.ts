import { eq, desc } from "drizzle-orm";
import { z } from "zod";

import { provider } from "@acme/db/schema";

import { createTRPCRouter, tenantProcedure } from "../trpc";

export const providerRouter = createTRPCRouter({
  // List all providers for a tenant (organization)
  listByOrg: tenantProcedure.query(({ ctx, input }) => {
    return ctx.db.query.provider.findMany({
      where: eq(provider.organizationId, input.tenantId),
      orderBy: [desc(provider.isTrusted), desc(provider.rating)],
    });
  }),

  // Create a new provider
  create: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1).max(256),
        avatarInitials: z.string().max(4).optional(),
        speciality: z.string().max(128).optional(),
        rating: z.number().min(0).max(5).optional(),
        isTrusted: z.boolean().optional(),
        completedJobs: z.number().int().min(0).optional(),
        avgDaysToResolve: z.number().int().min(0).optional(),
        priceRangeMin: z.number().int().min(0).optional(),
        priceRangeMax: z.number().int().min(0).optional(),
        phone: z.string().max(32).optional(),
        email: z.string().email().max(256).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { tenantId, ...data } = input;
      const initials = data.avatarInitials ??
        data.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
      const [created] = await ctx.db
        .insert(provider)
        .values({ ...data, avatarInitials: initials, organizationId: tenantId })
        .returning();
      return created;
    }),
});
