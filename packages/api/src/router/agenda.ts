import { eq, and, desc, asc } from "drizzle-orm";
import { z } from "zod";
import { agendaTask } from "@acme/db/schema";
import { createTRPCRouter, tenantProcedure, protectedProcedure } from "../trpc";

export const AGENDA_CATEGORIES = [
  "MANTENIMIENTO",
  "LEGAL",
  "ADMINISTRATIVO",
  "FINANCIERO",
  "OTRO",
] as const;

export const AGENDA_RECURRENCES = ["NONE", "WEEKLY", "MONTHLY", "ANNUAL"] as const;

export const agendaRouter = createTRPCRouter({
  // ── List all tasks for a community ───────────────────────────────────────────
  all: tenantProcedure
    .input(
      z.object({
        category: z.string().optional(),
        showDone: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(agendaTask.organizationId, input.tenantId)];
      if (!input.showDone) conditions.push(eq(agendaTask.isDone, false));
      if (input.category) conditions.push(eq(agendaTask.category, input.category));

      return ctx.db.query.agendaTask.findMany({
        where: and(...conditions),
        with: {
          author: { columns: { id: true, name: true } },
        },
        orderBy: [asc(agendaTask.dueDate)],
      });
    }),

  // ── Create a task ────────────────────────────────────────────────────────────
  create: tenantProcedure
    .input(
      z.object({
        title: z.string().min(1).max(256),
        description: z.string().optional(),
        category: z.enum(AGENDA_CATEGORIES).default("ADMINISTRATIVO"),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        recurrence: z.enum(AGENDA_RECURRENCES).default("NONE"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [task] = await ctx.db
        .insert(agendaTask)
        .values({
          id: crypto.randomUUID(),
          organizationId: input.tenantId,
          authorId: ctx.session.user.id,
          title: input.title,
          description: input.description ?? null,
          category: input.category,
          dueDate: input.dueDate,
          recurrence: input.recurrence,
          isDone: false,
        })
        .returning();
      return task;
    }),

  // ── Mark task as done ────────────────────────────────────────────────────────
  done: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(agendaTask)
        .set({ isDone: true, doneAt: new Date() })
        .where(eq(agendaTask.id, input.id));
      return { ok: true };
    }),

  // ── Reopen a task ────────────────────────────────────────────────────────────
  reopen: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(agendaTask)
        .set({ isDone: false, doneAt: null })
        .where(eq(agendaTask.id, input.id));
      return { ok: true };
    }),

  // ── Delete a task ────────────────────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(agendaTask).where(eq(agendaTask.id, input.id));
      return { ok: true };
    }),
});
