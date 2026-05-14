import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

import { fee } from "@acme/db/schema";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const feeRouter = createTRPCRouter({
  // ─── List user fees ────────────────────────────────────────────────────────
  myFees: publicProcedure
    .input(z.object({ tenantId: z.string().min(1), userId: z.string().min(1) }))
    .query(({ ctx, input }) => {
      return ctx.db.query.fee.findMany({
        where: and(
          eq(fee.organizationId, input.tenantId),
          eq(fee.userId, input.userId)
        ),
        orderBy: desc(fee.createdAt),
      });
    }),

  // ─── Simulate Payment ──────────────────────────────────────────────────────
  pay: publicProcedure
    .input(z.object({ id: z.string().uuid(), tenantId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(fee)
        .set({ status: "PAID", paidAt: new Date() })
        .where(
          and(
            eq(fee.id, input.id),
            eq(fee.organizationId, input.tenantId)
          )
        )
        .returning();

      return updated;
    }),

  // ─── Create Demo Fee (for testing) ─────────────────────────────────────────
  createDemoFee: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        userId: z.string().min(1),
        amount: z.number().positive(),
        description: z.string().min(1),
        dueDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(fee)
        .values({
          organizationId: input.tenantId,
          userId: input.userId,
          amount: input.amount,
          description: input.description,
          dueDate: input.dueDate,
          status: "PENDING",
        })
        .returning();

      return created;
    }),
});
