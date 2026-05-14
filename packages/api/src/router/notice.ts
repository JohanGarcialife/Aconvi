import { eq, desc, and, sql } from "drizzle-orm";
import { z } from "zod";

import { notice, member } from "@acme/db/schema";
import { sendPushToAllMembers } from "./notification";

import { createTRPCRouter, publicProcedure } from "../trpc";

const DEMO_AUTHOR_ID = "test-user-jluis-1776971864823";

export const NOTICE_TYPES = ["COMUNICADO", "AVISO", "URGENTE"] as const;

export const noticeRouter = createTRPCRouter({
  // ── List all notices for an org (pinned first, then by date) ──────────────
  all: publicProcedure
    .input(z.object({ tenantId: z.string().min(1) }))
    .query(({ ctx, input }) => {
      return ctx.db.query.notice.findMany({
        where: eq(notice.organizationId, input.tenantId),
        orderBy: [
          // pinned notices come first
          sql`${notice.pinned} DESC`,
          desc(notice.createdAt),
        ],
        with: {
          author: {
            columns: { id: true, name: true },
          },
        },
      });
    }),

  // ── Create notice + push broadcast to all org members ────────────────────
  create: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        title: z.string().min(1).max(256),
        content: z.string().min(1),
        type: z.enum(NOTICE_TYPES).default("COMUNICADO"),
        pinned: z.boolean().optional().default(false),
        authorId: z.string().optional(), // falls back to demo user
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { tenantId, authorId, ...data } = input;
      const [created] = await ctx.db
        .insert(notice)
        .values({
          ...data,
          organizationId: tenantId,
          authorId: authorId ?? DEMO_AUTHOR_ID,
        })
        .returning();

      // Count members for the response (before push)
      const orgMembers = await ctx.db.query.member.findMany({
        where: eq(member.organizationId, tenantId),
      });
      const recipientCount = orgMembers.filter((m) => m.role !== "owner").length;

      // Fire push to all members (non-blocking — don't await in full)
      const emoji = data.type === "URGENTE" ? "🚨" : data.type === "AVISO" ? "📢" : "📋";
      sendPushToAllMembers(ctx.db, tenantId, {
        title: `${emoji} ${data.title}`,
        body: data.content.slice(0, 120),
        data: { type: "notice", noticeId: created?.id ?? "" },
      }).catch(console.error);

      return { ...created, recipientCount };
    }),

  // ── Toggle pin on a notice ─────────────────────────────────────────────────
  togglePin: publicProcedure
    .input(z.object({ tenantId: z.string().min(1), id: z.string().uuid(), pinned: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db
        .update(notice)
        .set({ pinned: input.pinned })
        .where(
          and(
            eq(notice.id, input.id),
            eq(notice.organizationId, input.tenantId),
          ),
        );
    }),

  // ── Delete a notice ────────────────────────────────────────────────────────
  delete: publicProcedure
    .input(z.object({ tenantId: z.string().min(1), id: z.string().uuid() }))
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
