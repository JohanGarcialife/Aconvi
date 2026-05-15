import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";

import { incident, incidentNote, provider, incidentHistory } from "@acme/db/schema";
import { sendPushToUser } from "./notification";
import { emitWebSocketEvent } from "../utils/ws";

import { createTRPCRouter, publicProcedure } from "../trpc";

// Demo fallback author when no session is present
const DEMO_AUTHOR_ID = "test-user-jluis-1776971864823";

const INCIDENT_STATUSES = [
  "RECIBIDA",
  "EN_REVISION",
  "AGENDADA",
  "EN_CURSO",
  "RESUELTA",
  "RECHAZADA",
] as const;

export const incidentRouter = createTRPCRouter({
  // ─── List (public) ────────────────────────────────────────────────────────
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
          history: {
            orderBy: (h, { asc }) => asc(h.createdAt),
          },
        },
      });
    }),

  // ─── Single detail (public) ──────────────────────────────────────────────
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
          history: {
            orderBy: (h, { asc }) => asc(h.createdAt),
          },
        },
      });
    }),

  // ─── Create (public for demo) ─────────────────────────────────────────────
  create: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        title: z.string().min(1).max(256),
        description: z.string().min(1),
        // Categoría seleccionada por el vecino
        category: z.string().default("otro"),
        photoUrl: z.string().optional(),
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
          reporterId: DEMO_AUTHOR_ID,
          status: "RECIBIDA",
        })
        .returning();

      // Log history
      await ctx.db.insert(incidentHistory).values({
        incidentId: created.id,
        actorName: "Vecino (Reportero)",
        action: "CREATED",
        newStatus: "RECIBIDA",
      });

      // Emit realtime event to the tenant room
      await emitWebSocketEvent(tenantId, "incident-created", created);

      return created;
    }),

  // ─── Update status ────────────────────────────────────────────────────────
  updateStatus: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        id: z.string().uuid(),
        status: z.enum(INCIDENT_STATUSES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const previous = await ctx.db.query.incident.findFirst({
        where: and(
          eq(incident.id, input.id),
          eq(incident.organizationId, input.tenantId),
        ),
      });

      if (!previous) throw new Error("Incidencia no encontrada");

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

      if (previous.status !== updated.status) {
        await ctx.db.insert(incidentHistory).values({
          incidentId: updated.id,
          actorName: "Administrador / Agente",
          action: "STATUS_CHANGED",
          previousStatus: previous.status,
          newStatus: updated.status,
        });

        if (updated.reporterId) {
          await sendPushToUser(ctx.db, updated.reporterId, {
            title: "Actualización de incidencia",
            body: `Tu reporte "${updated.title}" cambió de estado a ${updated.status}.`,
            data: { type: "new_incident", incidentId: updated.id },
          });
        }
      }

      // Emit realtime event to the tenant room
      await emitWebSocketEvent(input.tenantId, "incident-updated", updated);

      return updated;
    }),

  // ─── Assign provider → auto EN_REVISION ─────────────────────────────────
  assignProvider: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        id: z.string().uuid(),
        providerId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(incident)
        .set({ 
          providerId: input.providerId, 
          status: "EN_REVISION",
          assignedAt: new Date()
        })
        .where(
          and(
            eq(incident.id, input.id),
            eq(incident.organizationId, input.tenantId),
          ),
        )
        .returning();

      // Notify provider user room
      await emitWebSocketEvent(input.providerId, "incident-assigned", updated);

      // Push notification to provider with deep link data
      if (updated.providerId) {
        // Find the user linked to this provider
        const prov = await ctx.db.query.provider.findFirst({
          where: eq(provider.id, updated.providerId),
        });
        if (prov?.userId) {
          await sendPushToUser(ctx.db, prov.userId, {
            title: "📋 Nueva incidencia asignada",
            body: `Se te ha asignado: ${updated.title}`,
            data: { type: "job_assigned", incidentId: updated.id },
          });
        }
      }

      // Log history
      await ctx.db.insert(incidentHistory).values({
        incidentId: updated.id,
        actorName: "Administrador / Agente",
        action: "ASSIGNED",
        newStatus: "EN_REVISION",
        comment: "Se asignó un proveedor",
      });

      // Emit realtime event to the tenant room
      await emitWebSocketEvent(input.tenantId, "incident-updated", updated);

      // Push notification to reporter (vecino)
      if (updated.reporterId) {
        await sendPushToUser(ctx.db, updated.reporterId, {
          title: "Proveedor asignado",
          body: `Hemos asignado un especialista a tu incidencia: "${updated.title}".`,
          data: { type: "new_incident", incidentId: updated.id },
        });
      }

      return updated;
    }),

  // ─── Reject (No procede) ─────────────────────────────────────────────────
  reject: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        id: z.string().uuid(),
      }),
    )
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
      return updated;
    }),

  // ─── Add internal note ───────────────────────────────────────────────────
  addNote: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        incidentId: z.string().uuid(),
        content: z.string().min(1).max(2000),
        authorId: z.string().optional(), // optional: falls back to demo user
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
          authorId: input.authorId ?? DEMO_AUTHOR_ID,
          content: input.content,
        })
        .returning();
      return note;
    }),

  // ─── Provider: list incidents assigned to them ────────────────────────────
  assignedToProvider: publicProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        tenantId: z.string().min(1).optional(),
      }),
    )
    .query(({ ctx, input }) => {
      return ctx.db.query.incident.findMany({
        where: and(
          eq(incident.providerId, input.providerId),
          input.tenantId ? eq(incident.organizationId, input.tenantId) : undefined,
        ),
        orderBy: desc(incident.createdAt),
        with: {
          reporter: { columns: { id: true, name: true, phoneNumber: true } },
          provider: true,
          notes: {
            orderBy: (n, { asc }) => asc(n.createdAt),
          },
          history: {
            orderBy: (h, { asc }) => asc(h.createdAt),
          },
        },
      });
    }),

  // ─── Provider: accept job (→ EN_CURSO) ────────────────────────────────────
  providerAccept: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        tenantId: z.string().min(1),
        providerId: z.string().uuid(),
        estimatedDays: z.number().int().min(1).optional(),
        estimatedCost: z.number().min(0).optional(),
        notes: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(incident)
        .set({ 
          status: "EN_CURSO", 
          providerId: input.providerId,
          estimatedCost: input.estimatedCost,
          estimatedDays: input.estimatedDays,
        })
        .where(
          and(
            eq(incident.id, input.id),
            eq(incident.organizationId, input.tenantId),
          ),
        )
        .returning();

      // Save estimate as internal note
      if (input.notes || input.estimatedCost || input.estimatedDays) {
        let noteLines = [];
        if (input.notes) noteLines.push(input.notes);
        if (input.estimatedCost) noteLines.push(`💰 Presupuesto estimado: ${input.estimatedCost}€`);
        if (input.estimatedDays) noteLines.push(`⏳ Tiempo estimado: ${input.estimatedDays} días`);

        await ctx.db.insert(incidentNote).values({
          incidentId: input.id,
          authorId: input.providerId, // In real app, relate to provider user
          content: noteLines.join('\n'),
        });
      }

      // Log history
      await ctx.db.insert(incidentHistory).values({
        incidentId: updated.id,
        actorName: "Proveedor",
        action: "STATUS_CHANGED",
        previousStatus: "EN_REVISION",
        newStatus: "EN_CURSO",
        comment: input.notes ? `Notas: ${input.notes}` : "Trabajo aceptado",
      });

      return updated;
    }),

  // ─── Provider: complete job (→ RESUELTA) ──────────────────────────────────
  providerComplete: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        tenantId: z.string().min(1),
        providerId: z.string().uuid(),
        completionNote: z.string().max(1000).optional(),
        finalPhotoUrl: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(incident)
        .set({
          status: "RESUELTA",
          resolvedAt: new Date(),
          // Persistir la foto final del proveedor en la BD
          ...(input.finalPhotoUrl ? { finalPhotoUrl: input.finalPhotoUrl } : {}),
        })
        .where(
          and(
            eq(incident.id, input.id),
            eq(incident.organizationId, input.tenantId),
          ),
        )
        .returning();

      const noteContent = [
        "✅ Trabajo completado",
        input.completionNote,
        input.finalPhotoUrl ? `Foto final: ${input.finalPhotoUrl}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      await ctx.db.insert(incidentNote).values({
        incidentId: input.id,
        authorId: input.providerId,
        content: noteContent,
      });

      // Log history
      await ctx.db.insert(incidentHistory).values({
        incidentId: updated.id,
        actorName: "Proveedor",
        action: "COMPLETED",
        previousStatus: "EN_CURSO",
        newStatus: "RESUELTA",
        comment: input.completionNote || "Trabajo finalizado",
      });

      // Push notification to reporter (vecino) with deep link
      if (updated.reporterId) {
        await sendPushToUser(ctx.db, updated.reporterId, {
          title: "✅ Tu incidencia ha sido resuelta",
          body: `${updated.title} — El proveedor ha completado el trabajo.`,
          data: { type: "new_incident", incidentId: updated.id },
        });
      }

      return updated;
    }),
});
