import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";

import { notice } from "@acme/db/schema";

import { createTRPCRouter, tenantProcedure } from "../trpc";

export const NOTICE_TYPES = ["COMUNICADO", "AVISO", "URGENTE"] as const;

export const noticeRouter = createTRPCRouter({
  all: tenantProcedure.query(({ ctx, input }) => {
    return ctx.db.query.notice.findMany({
      where: eq(notice.organizationId, input.tenantId),
      orderBy: desc(notice.createdAt),
      with: {
        author: {
          columns: { id: true, name: true },
        },
      },
    });
  }),

  create: tenantProcedure
    .input(
      z.object({
        title: z.string().min(1).max(256),
        content: z.string().min(1),
        type: z.enum(NOTICE_TYPES).default("COMUNICADO"),
        pinned: z.boolean().optional().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { tenantId, ...data } = input;
      const [created] = await ctx.db
        .insert(notice)
        .values({
          ...data,
          organizationId: tenantId,
          authorId: ctx.session.user.id,
        })
        .returning();
      return created;
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db
        .delete(notice)
        .where(
          and(
            eq(notice.id, input.id),
            eq(notice.organizationId, input.tenantId),
          ),
        );
    }),
});
