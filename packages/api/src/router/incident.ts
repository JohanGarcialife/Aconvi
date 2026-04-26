import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";

import { incident, incidentNote, provider } from "@acme/db/schema";
import { sendPushToUser } from "./notification";

import { createTRPCRouter, publicProcedure, tenantProcedure } from "../trpc";

const INCIDENT_STATUSES = [
  "RECIBIDA",
  "EN_REVISION",
  "AGENDADA",
  "EN_CURSO",
  "RESUELTA",
  "RECHAZADA",
] as const;

export const incidentRouter = createTRPCRouter({
  // ─── List with optional status filter (public — no auth needed for viewing) ──
  all: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        status: z.enum(INCIDENT_STATUSES).optional(),
      }),
    )
    .query(({ ctx, input }) => {
      return ctx.db.query.incident.findMany({
        where: and(
          eq(incident.organizationId, input.tenantId),
          input.status ? eq(incident.status, input.status) : undefined,
        ),
        orderBy: desc(incident.createdAt),
        with: {
          reporter: { columns: { id: true, name: true, phoneNumber: true } },
          assignee: { columns: { id: true, name: true } },
          provider: true,
          notes: {
            with: { author: { columns: { id: true, name: true } } },
            orderBy: (n, { asc }) => asc(n.createdAt),
          },
        },
      });
    }),

  // ─── Single incident detail (public) ─────────────────────────────────────────
  byId: publicProcedure
    .input(z.object({ id: z.string().uuid(), tenantId: z.string().min(1) }))
    .query(({ ctx, input }) => {
      return ctx.db.query.incident.findFirst({
        where: and(
          eq(incident.id, input.id),
          eq(incident.organizationId, input.tenantId),
        ),
        with: {
          reporter: { columns: { id: true, name: true, phoneNumber: true } },
          assignee: { columns: { id: true, name: true } },
          provider: true,
          notes: {
            with: { author: { columns: { id: true, name: true } } },
            orderBy: (n, { asc }) => asc(n.createdAt),
          },
        },
      });
    }),

  // ─── Create ───────────────────────────────────────────────────────────────────
  create: tenantProcedure
    .input(
      z.object({
        title: z.string().min(1).max(256),
        description: z.string().min(1),
        photoUrl: z.string().url().optional(),
        priority: z.enum(["BAJA", "MEDIA", "ALTA", "URGENTE"]).default("MEDIA"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { tenantId, ...data } = input;
      const [created] = await ctx.db
        .insert(incident)
        .values({
          ...data,
          organizationId: tenantId,
          reporterId: ctx.session.user.id,
          status: "RECIBIDA",
        })
        .returning();
      return created;
    }),

  // ─── Update status (advance timeline) ────────────────────────────────────────
  updateStatus: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(INCIDENT_STATUSES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const extras: Record<string, Date | null> = {};
      if (input.status === "RESUELTA") extras.resolvedAt = new Date();
      if (input.status === "RECHAZADA") extras.rejectedAt = new Date();

      const [updated] = await ctx.db
        .update(incident)
        .set({ status: input.status, ...extras })
        .where(
          and(
            eq(incident.id, input.id),
            eq(incident.organizationId, input.tenantId),
          ),
        )
        .returning();
      return updated;
    }),

  // ─── Assign provider → auto-advances to EN_REVISION ──────────────────────────
  assignProvider: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        providerId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(incident)
        .set({ providerId: input.providerId, status: "EN_REVISION" })
        .where(
          and(
            eq(incident.id, input.id),
            eq(incident.organizationId, input.tenantId),
          ),
        )
        .returning();

      // Notify the reporter that a provider has been assigned
      if (updated?.reporterId) {
        await sendPushToUser(ctx.db, updated.reporterId, {
          title: "🔧 Proveedor asignado",
          body: `Se ha asignado un proveedor a tu incidencia: "${updated.title}"`,
          data: { type: "incident_update", incidentId: updated.id },
        });
      }

      return updated;
    }),

  // ─── Reject (No procede) ──────────────────────────────────────────────────────
  reject: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(incident)
        .set({ status: "RECHAZADA", rejectedAt: new Date() })
        .where(
          and(
            eq(incident.id, input.id),
            eq(incident.organizationId, input.tenantId),
          ),
        )
        .returning();

      if (updated?.reporterId) {
        await sendPushToUser(ctx.db, updated.reporterId, {
          title: "ℹ️ Incidencia no admitida",
          body: `La incidencia "${updated.title}" no ha sido admitida.`,
          data: { type: "incident_update", incidentId: updated.id },
        });
      }

      return updated;
    }),

  // ─── Add internal note ────────────────────────────────────────────────────────
  addNote: tenantProcedure
    .input(
      z.object({
        incidentId: z.string().uuid(),
        content: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify incident belongs to tenant
      const inc = await ctx.db.query.incident.findFirst({
        where: and(
          eq(incident.id, input.incidentId),
          eq(incident.organizationId, input.tenantId),
        ),
      });
      if (!inc) throw new Error("Incidencia no encontrada");

      const [note] = await ctx.db
        .insert(incidentNote)
        .values({
          incidentId: input.incidentId,
          authorId: ctx.session.user.id,
          content: input.content,
        })
        .returning();
      return note;
    }),
});
