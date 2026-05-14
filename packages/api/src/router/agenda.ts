import { eq, and, desc, asc, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { agendaTask, voteSession, incident } from "@acme/db/schema";
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

  // ── Unified Calendar Events (tasks + vote sessions + incidents) ───────────
  getCalendarEvents: tenantProcedure
    .input(
      z.object({
        year: z.number().int().min(2020).max(2100),
        month: z.number().int().min(1).max(12),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { tenantId, year, month } = input;

      // Date range for the month (with a 1-week buffer on each side)
      const startDate = new Date(year, month - 1, 1);
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date(year, month, 0); // last day of month
      endDate.setDate(endDate.getDate() + 7);

      const startStr = startDate.toISOString().slice(0, 10);
      const endStr = endDate.toISOString().slice(0, 10);

      const [tasks, votes, incidents] = await Promise.all([
        // Agenda tasks in this month range
        ctx.db.query.agendaTask.findMany({
          where: and(
            eq(agendaTask.organizationId, tenantId),
            gte(agendaTask.dueDate, startStr),
            lte(agendaTask.dueDate, endStr),
          ),
          columns: {
            id: true,
            title: true,
            dueDate: true,
            category: true,
            isDone: true,
            recurrence: true,
          },
        }),

        // Vote sessions closing this month
        ctx.db.query.voteSession.findMany({
          where: and(
            eq(voteSession.organizationId, tenantId),
          ),
          columns: {
            id: true,
            title: true,
            status: true,
            closesAt: true,
            createdAt: true,
          },
        }),

        // Open incidents (created this month range) as reminders
        ctx.db.query.incident.findMany({
          where: and(
            eq(incident.organizationId, tenantId),
          ),
          columns: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
          },
          limit: 30,
          orderBy: desc(incident.createdAt),
        }),
      ]);

      // Build unified events array
      const events: {
        id: string;
        type: "task" | "vote" | "incident";
        label: string;
        date: string; // YYYY-MM-DD
        status: string;
        category?: string;
        isDone?: boolean;
      }[] = [
        ...tasks.map((t) => ({
          id: t.id,
          type: "task" as const,
          label: t.title,
          date: t.dueDate,
          status: t.isDone ? "DONE" : "PENDING",
          category: t.category,
          isDone: t.isDone,
        })),

        ...votes
          .filter((v) => v.closesAt)
          .map((v) => ({
            id: v.id,
            type: "vote" as const,
            label: `🗳️ ${v.title}`,
            date: v.closesAt!.toISOString().slice(0, 10),
            status: v.status,
          })),

        // Include vote creation dates too (as "session opens" event)
        ...votes
          .filter((v) => {
            const d = v.createdAt.toISOString().slice(0, 10);
            return d >= startStr && d <= endStr;
          })
          .map((v) => ({
            id: `${v.id}-open`,
            type: "vote" as const,
            label: `📋 Votación: ${v.title}`,
            date: v.createdAt.toISOString().slice(0, 10),
            status: v.status,
          })),

        ...incidents
          .filter((i) => {
            const d = i.createdAt.toISOString().slice(0, 10);
            return d >= startStr && d <= endStr;
          })
          .map((i) => ({
            id: i.id,
            type: "incident" as const,
            label: `🔧 ${i.title}`,
            date: i.createdAt.toISOString().slice(0, 10),
            status: i.status,
          })),
      ];

      return events;
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



