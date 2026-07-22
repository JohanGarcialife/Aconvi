import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { join } from "path";
import { writeFileSync, existsSync, mkdirSync } from "fs";

import { incident, incidentNote, provider, incidentHistory, user } from "@acme/db/schema";
import { sendPushToUser } from "./notification";
import { emitWebSocketEvent } from "../utils/ws";

import { createTRPCRouter, publicProcedure } from "../trpc";

// Save base64 image data to the local file system on the Next.js server
function saveBase64Image(base64Data: string): string | undefined {
  try {
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return base64Data; // Already a URL or direct string
    }

    const fileType = matches[1];
    const base64ImageBytes = matches[2];
    
    let extension = "jpg";
    if (fileType?.includes("png")) extension = "png";
    if (fileType?.includes("webp")) extension = "webp";

    const filename = `incident_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${extension}`;
    
    // Adapt to Turborepo monorepo structure where cwd is /app but public is in apps/nextjs/public
    let baseDir = process.cwd();
    const monorepoPublicDir = join(baseDir, "apps/nextjs/public");
    if (existsSync(monorepoPublicDir)) {
      baseDir = monorepoPublicDir;
    } else {
      baseDir = join(baseDir, "public");
    }

    const uploadDir = join(baseDir, "uploads");
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = join(uploadDir, filename);
    writeFileSync(filePath, Buffer.from(base64ImageBytes!, "base64"));
    
    return `/uploads/${filename}`;
  } catch (err) {
    console.error("[saveBase64Image] Error saving uploaded image file:", err);
    return undefined;
  }
}

// Demo fallback author when no session is present
const DEMO_AUTHOR_ID = "test-user-jluis-1776971864823";

const INCIDENT_STATUSES = [
  "RECIBIDA",
  "EN_REVISION",
  "AGENDADA",
  "EN_CURSO",
  "RESUELTA",
  "RECHAZADA",
  "CERRADA",
] as const;

function sanitizeText(str: string): string {
  const map: Record<string, string> = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
    'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
    'ñ': 'n', 'Ñ': 'N',
    'ü': 'u', 'Ü': 'U'
  };
  return str.split('').map(c => map[c] || c).join('');
}

export const incidentRouter = createTRPCRouter({
  // ─── List (public) ────────────────────────────────────────────────────────
  all: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        status: z.enum(INCIDENT_STATUSES).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const results = await ctx.db.query.incident.findMany({
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

      return results.map((r) => ({
        ...r,
        photoUrl: r.photoUrl?.startsWith("data:image/") ? null : r.photoUrl,
      }));
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
          organization: true,
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
        // Real user ID of the logged-in vecino — required for push notifications
        reporterId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { tenantId, reporterId: inputReporterId, ...data } = input;
      const sanitizedTitle = sanitizeText(data.title);
      const sanitizedDescription = sanitizeText(data.description);
      // Priority: session user ID (from Bearer token) > client-sent reporterId > demo fallback
      const resolvedReporterId = ctx.session?.user?.id ?? inputReporterId ?? DEMO_AUTHOR_ID;
      console.log("[incident.create] resolvedReporterId:", resolvedReporterId, "session:", ctx.session?.user?.id, "input:", inputReporterId);

      // Save base64 image data to the local file system on the Next.js server
      let resolvedPhotoUrl = data.photoUrl;
      if (resolvedPhotoUrl && resolvedPhotoUrl.startsWith("data:image/")) {
        resolvedPhotoUrl = saveBase64Image(resolvedPhotoUrl);
      }

      const [created] = await ctx.db
        .insert(incident)
        .values({
          ...data,
          photoUrl: resolvedPhotoUrl,
          title: sanitizedTitle,
          description: sanitizedDescription,
          organizationId: tenantId,
          reporterId: resolvedReporterId,
          status: "RECIBIDA",
        })
        .returning();

      if (!created) throw new Error("No se pudo crear la incidencia.");

      // Log history
      await ctx.db.insert(incidentHistory).values({
        incidentId: created.id,
        actorName: "Vecino (Reportero)",
        action: "CREATED",
        newStatus: "RECIBIDA",
      });

      // Fire-and-forget: WS event doesn't block the mutation response
      void emitWebSocketEvent(tenantId, "incident-created", created);

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

      if (!updated) throw new Error("No se pudo actualizar el estado de la incidencia.");

      if (previous.status !== updated.status) {
        await ctx.db.insert(incidentHistory).values({
          incidentId: updated.id,
          actorName: "Administrador / Agente",
          action: "STATUS_CHANGED",
          previousStatus: previous.status,
          newStatus: updated.status,
        });

        if (updated.reporterId) {
          void sendPushToUser(ctx.db, updated.reporterId, {
            title: "Actualización de incidencia",
            body: `Tu reporte "${updated.title}" cambió de estado a ${updated.status}.`,
            data: { type: "new_incident", incidentId: updated.id },
          }).catch(console.error);
        }
      }

      // Fire-and-forget: WS event doesn't block the mutation response
      void emitWebSocketEvent(input.tenantId, "incident-updated", updated);

      return updated;
    }),

  // ─── Assign provider → auto EN_REVISION ─────────────────────────────────
  assignProvider: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        id: z.string().uuid(),
        providerId: z.string().min(1),
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

      if (!updated) throw new Error("No se pudo asignar el proveedor.");

      // Fire-and-forget: notify provider user room
      void emitWebSocketEvent(input.providerId, "incident-assigned", updated);

      // Fire-and-forget push to provider
      if (updated.providerId) {
        const provId = updated.providerId; // narrowed: string (not null)
        void (async () => {
          console.log("[PushAssign] Triggered IIFE for providerId:", provId);
          try {
            const prov = await ctx.db.query.provider.findFirst({
              where: eq(provider.id, provId),
            });
            console.log("[PushAssign] Found provider in DB:", prov?.name, "email:", prov?.email);
            if (prov?.email) {
              const usr = await ctx.db.query.user.findFirst({
                where: eq(user.email, prov.email),
              });
              console.log("[PushAssign] Found user in DB:", usr?.name, "id:", usr?.id);
              if (usr?.id) {
                console.log("[PushAssign] Calling sendPushToUser for userId:", usr.id);
                await sendPushToUser(ctx.db, usr.id, {
                  title: "📋 Nueva incidencia asignada",
                  body: `Se te ha asignado: ${updated.title}`,
                  data: { type: "job_assigned", incidentId: updated.id },
                });
                console.log("[PushAssign] sendPushToUser completed successfully");
              } else {
                console.warn("[PushAssign] No user found for provider email:", prov.email);
              }
            } else {
              console.warn("[PushAssign] Provider has no email address configured");
            }
          } catch (err) {
            console.error("[PushAssign] Failed in push notification promise chain:", err);
          }
        })();
      }

      // Log history safely
      try {
        await ctx.db.insert(incidentHistory).values({
          incidentId: updated.id,
          actorName: "Administrador / Agente",
          action: "ASSIGNED",
          newStatus: "EN_REVISION",
          comment: "Se asignó un proveedor",
        });
      } catch (err) {
        console.error("[assignProvider] Error inserting history:", err);
      }

      // Fire-and-forget: WS event to tenant room
      void emitWebSocketEvent(input.tenantId, "incident-updated", updated);

      // Fire-and-forget push to vecino
      if (updated.reporterId) {
        void sendPushToUser(ctx.db, updated.reporterId, {
          title: "Proveedor asignado",
          body: `Hemos asignado un especialista a tu incidencia: "${updated.title}".`,
          data: { type: "new_incident", incidentId: updated.id },
        }).catch(console.error);
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
      if (!updated) throw new Error("No se pudo rechazar la incidencia.");
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
          content: sanitizeText(input.content),
        })
        .returning();
      return note;
    }),

  // ─── Provider: list incidents assigned to them ────────────────────────────
  assignedToProvider: publicProcedure
    .input(
      z.object({
        providerId: z.string().min(1),
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

  // ─── Provider: accept job (→ AGENDADA) ────────────────────────────────────
  providerAccept: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        tenantId: z.string().min(1),
        providerId: z.string().min(1),
        estimatedDays: z.number().int().min(0).optional(),
        estimatedCost: z.number().min(0).optional(),
        notes: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(incident)
        .set({ 
          status: "AGENDADA", 
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

      if (!updated) throw new Error("No se pudo aceptar la incidencia.");

      // Save estimate as internal note
      if (input.notes || input.estimatedCost !== undefined || input.estimatedDays !== undefined) {
        let noteLines = [];
        if (input.notes) noteLines.push(input.notes);
        if (input.estimatedCost !== undefined) noteLines.push(`💰 Presupuesto estimado: ${input.estimatedCost}€`);
        if (input.estimatedDays !== undefined) {
          noteLines.push(`⏳ Tiempo estimado: ${input.estimatedDays === 0 ? "Hoy mismo" : `${input.estimatedDays} días`}`);
        }

        // Use a valid user ID (fallback to demo) instead of providerId which is not in 'user' table
        await ctx.db.insert(incidentNote).values({
          incidentId: input.id,
          authorId: DEMO_AUTHOR_ID, 
          content: noteLines.join('\n'),
        });
      }

      // Log history
      await ctx.db.insert(incidentHistory).values({
        incidentId: updated.id,
        actorName: "Proveedor",
        action: "PROVIDER_ACCEPTED",
        previousStatus: "EN_REVISION",
        newStatus: "AGENDADA",
        comment: input.notes ? `Notas: ${input.notes}` : "Trabajo agendado por el proveedor",
      });

      // Fire-and-forget push to vecino
      if (updated.reporterId) {
        void sendPushToUser(ctx.db, updated.reporterId, {
          title: "📅 Tu cita ha sido agendada",
          body: `Un especialista ha aceptado tu incidencia "${updated.title}" y coordinará la visita.`,
          data: { type: "new_incident", incidentId: updated.id },
        }).catch(console.error);
      }

      // Fire-and-forget: WS event to tenant room
      void emitWebSocketEvent(input.tenantId, "incident-updated", updated);

      return updated;
    }),

  // ─── Provider: complete job (→ RESUELTA) ──────────────────────────────────
  providerComplete: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        tenantId: z.string().min(1),
        providerId: z.string().min(1),
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

      if (!updated) throw new Error("No se pudo completar el trabajo.");

      const noteContent = [
        "✅ Trabajo completado",
        input.completionNote,
        input.finalPhotoUrl ? `Foto final: ${input.finalPhotoUrl}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      await ctx.db.insert(incidentNote).values({
        incidentId: input.id,
        authorId: DEMO_AUTHOR_ID,
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

      // Fire-and-forget push to vecino
      if (updated.reporterId) {
        void sendPushToUser(ctx.db, updated.reporterId, {
          title: "✅ Tu incidencia ha sido resuelta",
          body: `${updated.title} — El proveedor ha completado el trabajo.`,
          data: { type: "new_incident", incidentId: updated.id },
        }).catch(console.error);
      }

      // Fire-and-forget: WS event to tenant room
      void emitWebSocketEvent(input.tenantId, "incident-updated", updated);

      return updated;
    }),

  // ─── Provider: arrived on site ────────────────────────────────────────────
  providerArrived: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        tenantId: z.string().min(1),
        providerId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const inc = await ctx.db.query.incident.findFirst({
        where: and(
          eq(incident.id, input.id),
          eq(incident.organizationId, input.tenantId),
        ),
      });

      if (!inc) throw new Error("Incidencia no encontrada");

      // Update status to EN_CURSO — provider is now on site
      let arrivedInc;
      try {
        [arrivedInc] = await ctx.db
          .update(incident)
          .set({ status: "EN_CURSO", startedAt: new Date() })
          .where(
            and(
              eq(incident.id, input.id),
              eq(incident.organizationId, input.tenantId),
            ),
          )
          .returning();
      } catch {
        [arrivedInc] = await ctx.db
          .update(incident)
          .set({ status: "EN_CURSO" })
          .where(
            and(
              eq(incident.id, input.id),
              eq(incident.organizationId, input.tenantId),
            ),
          )
          .returning();
      }

      // Add internal note recording arrival
      await ctx.db.insert(incidentNote).values({
        incidentId: input.id,
        authorId: DEMO_AUTHOR_ID,
        content: "📍 Proveedor llegó al lugar de la incidencia",
      });

      // Log history — action ARRIVED for distinct timeline entry
      await ctx.db.insert(incidentHistory).values({
        incidentId: input.id,
        actorName: "Proveedor",
        action: "ARRIVED",
        previousStatus: "AGENDADA",
        newStatus: "EN_CURSO",
        comment: "Proveedor llegó al lugar e inicia el trabajo",
      });

      // Fire-and-forget push to vecino
      if (inc.reporterId) {
        void sendPushToUser(ctx.db, inc.reporterId, {
          title: "🔧 Tu técnico ha llegado y está trabajando",
          body: `El especialista ha llegado y está atendiendo "${inc.title}".`,
          data: { type: "new_incident", incidentId: inc.id },
        }).catch(console.error);
      }

      // Fire-and-forget: WS event to tenant room
      void emitWebSocketEvent(input.tenantId, "incident-updated", arrivedInc ?? inc);

      return arrivedInc ?? inc;
    }),

  // ─── AF: close incident (RESUELTA → CERRADA) ─────────────────────────────
  closeIncident: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        tenantId: z.string().min(1),
        closingComment: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(incident)
        .set({ status: "CERRADA" })
        .where(
          and(
            eq(incident.id, input.id),
            eq(incident.organizationId, input.tenantId),
          ),
        )
        .returning();

      if (!updated) throw new Error("No se pudo cerrar la incidencia.");

      // Log history
      await ctx.db.insert(incidentHistory).values({
        incidentId: updated.id,
        actorName: "Administrador de Finca",
        action: "STATUS_CHANGED",
        previousStatus: "RESUELTA",
        newStatus: "CERRADA",
        comment: input.closingComment || "Incidencia revisada y cerrada por el administrador",
      });

      // Notify vecino
      if (updated.reporterId) {
        void sendPushToUser(ctx.db, updated.reporterId, {
          title: "✅ Incidencia cerrada",
          body: `Tu incidencia "${updated.title}" ha sido revisada y cerrada oficialmente.`,
          data: { type: "new_incident", incidentId: updated.id },
        }).catch(console.error);
      }

      void emitWebSocketEvent(input.tenantId, "incident-updated", updated);
      return updated;
    }),

  // ─── Neighbor: submit rating (feedback) ──────────────────────────────────
  submitRating: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        id: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(incident)
        .set({
          rating: input.rating,
          ratingComment: input.comment ? sanitizeText(input.comment) : null,
        })
        .where(
          and(
            eq(incident.id, input.id),
            eq(incident.organizationId, input.tenantId),
          ),
        )
        .returning();

      if (!updated) throw new Error("No se pudo registrar la valoración.");

      // Log history event (not state change)
      await ctx.db.insert(incidentHistory).values({
        incidentId: updated.id,
        actorName: "Vecino",
        action: "RATED",
        previousStatus: "RESUELTA",
        newStatus: "RESUELTA",
        comment: `Valoró con ${input.rating} estrellas: "${input.comment ?? "Sin comentario"}"`,
      });

      // Update provider statistics if any
      if (updated.providerId) {
        // Find all resolved incidents for this provider that have a rating
        const ratedIncidents = await ctx.db.query.incident.findMany({
          where: and(
            eq(incident.providerId, updated.providerId),
            eq(incident.status, "RESUELTA"),
          ),
        });

        const ratings = ratedIncidents
          .map((i) => i.rating)
          .filter((r): r is number => r !== null && r !== undefined);

        const totalRatings = ratings.length;
        const avgRating = totalRatings > 0 
          ? ratings.reduce((sum, r) => sum + r, 0) / totalRatings 
          : 5.0;

        await ctx.db
          .update(provider)
          .set({
            rating: avgRating,
            completedJobs: totalRatings,
          })
          .where(eq(provider.id, updated.providerId));
      }

      // Fire-and-forget: WS event to tenant room
      void emitWebSocketEvent(input.tenantId, "incident-updated", updated);

      return updated;
    }),
});
