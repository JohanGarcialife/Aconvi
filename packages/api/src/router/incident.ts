import { eq, desc, and, isNull, isNotNull, sql, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { join } from "path";
import { writeFileSync, existsSync, mkdirSync } from "fs";

import { incident, incidentNote, provider, incidentHistory, user } from "@acme/db/schema";
import { sendPushToUser, sendPushToAFs } from "./notification";
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

// OT expiration duration in minutes (2 hours)
const OT_EXPIRATION_MINUTES = 120;

/** Prevent duplicate consecutive history entries with the same newStatus */
async function insertHistoryIfNotDuplicate(db: any, entry: {
  incidentId: string;
  actorName: string;
  action: string;
  previousStatus?: string;
  newStatus: string;
  comment?: string;
}) {
  const lastEntry = await db.query.incidentHistory.findFirst({
    where: eq(incidentHistory.incidentId, entry.incidentId),
    orderBy: desc(incidentHistory.createdAt),
  });
  // Skip if last entry has same newStatus (prevents duplicates like double AGENDADA)
  if (lastEntry && lastEntry.newStatus === entry.newStatus && lastEntry.action === entry.action) {
    console.log(`[History] Skipping duplicate: ${entry.action} -> ${entry.newStatus}`);
    return;
  }
  await db.insert(incidentHistory).values(entry);
}

const INCIDENT_STATUSES = [
  "RECIBIDA",
  "EN_REVISION",
  "AGENDADA",
  "EN_CURSO",
  "RESUELTA",
  "RECHAZADA",
  "CADUCADA",
  "NO_PRESENTADA",
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

let columnsEnsured = false;

async function ensureIncidentColumns(db: any) {
  try {
    const { sql } = await import("drizzle-orm");
    const statements = [
      "ALTER TABLE incident ADD COLUMN IF NOT EXISTS started_at timestamp with time zone;",
      "ALTER TABLE incident ADD COLUMN IF NOT EXISTS final_photo_url text;",
      "ALTER TABLE incident ADD COLUMN IF NOT EXISTS category varchar(64) DEFAULT 'otro';",
      "ALTER TABLE incident ADD COLUMN IF NOT EXISTS assigned_at timestamp with time zone;",
      "ALTER TABLE incident ADD COLUMN IF NOT EXISTS resolved_at timestamp with time zone;",
      "ALTER TABLE incident ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone;",
      "ALTER TABLE incident ADD COLUMN IF NOT EXISTS estimated_cost real;",
      "ALTER TABLE incident ADD COLUMN IF NOT EXISTS estimated_days integer;",
      "ALTER TABLE incident ADD COLUMN IF NOT EXISTS rating integer;",
      "ALTER TABLE incident ADD COLUMN IF NOT EXISTS rating_comment text;",
      "ALTER TABLE incident ADD COLUMN IF NOT EXISTS scheduled_at timestamp with time zone;",
      "ALTER TABLE incident ADD COLUMN IF NOT EXISTS estimated_duration varchar(32);",
      "ALTER TABLE incident ADD COLUMN IF NOT EXISTS expired_provider_id varchar(128);"
    ];
    for (const stmt of statements) {
      try {
        await db.execute(sql.raw(stmt));
      } catch (e: any) {
        console.warn("[ensureIncidentColumns] Statement warning:", e?.message);
      }
    }
    columnsEnsured = true;
  } catch (err) {
    console.error("[ensureIncidentColumns] Error running self-healing migration:", err);
  }
}

// ─── Automatic evaluation sweep for overdue OTs (CADUCADA & NO_PRESENTADA) ──────
async function processOverdueIncidents(db: any, organizationId?: string | null) {
  try {
    const now = Date.now();

    // 1. Check for expired OTs (EN_REVISION assigned > 2 hours ago without provider acceptance)
    const EXPIRATION_MS = 120 * 60 * 1000;
    const expirationThreshold = new Date(now - EXPIRATION_MS);

    const expiredList = await db.query.incident.findMany({
      where: and(
        organizationId ? eq(incident.organizationId, organizationId) : undefined,
        eq(incident.status, "EN_REVISION"),
        isNotNull(incident.assignedAt),
        lt(incident.assignedAt, expirationThreshold)
      ),
    });

    for (const inc of expiredList) {
      console.log(`[OverdueSweep] Marking incident ${inc.id} (${inc.title}) as CADUCADA`);
      const [updated] = await db
        .update(incident)
        .set({
          status: "CADUCADA",
          expiredProviderId: inc.providerId,
          providerId: null,
          estimatedCost: null,
          estimatedDays: null,
          scheduledAt: null,
          estimatedDuration: null,
        })
        .where(eq(incident.id, inc.id))
        .returning();

      if (updated) {
        await insertHistoryIfNotDuplicate(db, {
          incidentId: updated.id,
          actorName: "Sistema",
          action: "OT_EXPIRED",
          previousStatus: "EN_REVISION",
          newStatus: "CADUCADA",
          comment: "La orden de trabajo caducó por superar el límite de tiempo de respuesta (2 horas).",
        });

        // Push notification to AFs
        void sendPushToAFs(db, updated.organizationId, {
          title: "OT Caducada",
          body: `La incidencia "${updated.title}" ha caducado por falta de respuesta del proveedor. Ya puedes reasignarla.`,
          data: { type: "ot_expired", incidentId: updated.id },
        }).catch(console.error);

        void emitWebSocketEvent(updated.organizationId, "incident-updated", updated);
      }
    }

    // 2. Check for No-Show OTs (AGENDADA scheduled > 1 hour ago with no startedAt)
    const NO_SHOW_BUFFER_MS = 60 * 60 * 1000;
    const noShowThreshold = new Date(now - NO_SHOW_BUFFER_MS);

    const noShowList = await db.query.incident.findMany({
      where: and(
        organizationId ? eq(incident.organizationId, organizationId) : undefined,
        eq(incident.status, "AGENDADA"),
        isNotNull(incident.scheduledAt),
        isNull(incident.startedAt),
        lt(incident.scheduledAt, noShowThreshold)
      ),
    });

    for (const inc of noShowList) {
      console.log(`[OverdueSweep] Marking incident ${inc.id} (${inc.title}) as NO_PRESENTADA`);
      const [updated] = await db
        .update(incident)
        .set({
          status: "NO_PRESENTADA",
          providerId: null,
          estimatedCost: null,
          estimatedDays: null,
          scheduledAt: null,
          estimatedDuration: null,
        })
        .where(eq(incident.id, inc.id))
        .returning();

      if (updated) {
        await insertHistoryIfNotDuplicate(db, {
          incidentId: updated.id,
          actorName: "Sistema",
          action: "NO_SHOW",
          previousStatus: "AGENDADA",
          newStatus: "NO_PRESENTADA",
          comment: "El proveedor no inició la intervención tras 1 hora de la hora programada.",
        });

        // Push notification to AFs
        void sendPushToAFs(db, updated.organizationId, {
          title: "OT No presentada",
          body: `El proveedor no inició la intervención agendada para "${updated.title}" tras 1 hora. La OT ha quedado liberada para reasignar.`,
          data: { type: "no_show", incidentId: updated.id },
        }).catch(console.error);

        void emitWebSocketEvent(updated.organizationId, "incident-updated", updated);
      }
    }
  } catch (err) {
    console.error("[processOverdueIncidents] Error running sweep:", err);
  }
}

export const incidentRouter = createTRPCRouter({
  clearAll: publicProcedure.mutation(async ({ ctx }) => {
    const { sql } = await import("drizzle-orm");
    await ctx.db.execute(sql.raw("TRUNCATE TABLE incident_note, incident_history, incident CASCADE;"));
    return { success: true };
  }),

  // ─── List (public) ────────────────────────────────────────────────────────
  all: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        status: z.enum(INCIDENT_STATUSES).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await ensureIncidentColumns(ctx.db);
      await processOverdueIncidents(ctx.db, input.tenantId);

      try {
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
      } catch (err) {
        console.error("[incident.all] Primary query error, falling back:", err);
        const fallbackResults = await ctx.db.query.incident.findMany({
          where: and(
            eq(incident.organizationId, input.tenantId),
            input.status ? eq(incident.status, input.status) : undefined,
          ),
          orderBy: desc(incident.createdAt),
        });
        return fallbackResults.map((r) => ({
          ...r,
          photoUrl: r.photoUrl?.startsWith("data:image/") ? null : r.photoUrl,
          notes: [],
          history: [],
        }));
      }
    }),

  // ─── Single detail (public) ──────────────────────────────────────────────
  byId: publicProcedure
    .input(z.object({ id: z.string().uuid(), tenantId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await ensureIncidentColumns(ctx.db);
      await processOverdueIncidents(ctx.db, input.tenantId);

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
      await ensureIncidentColumns(ctx.db);
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

      // Deduplication guard: prevent duplicate creation within 15 seconds
      const recentDuplicate = await ctx.db.query.incident.findFirst({
        where: and(
          eq(incident.organizationId, tenantId),
          eq(incident.reporterId, resolvedReporterId),
          eq(incident.title, sanitizedTitle),
        ),
        orderBy: desc(incident.createdAt),
      });

      if (recentDuplicate) {
        const timeDiffMs = Date.now() - new Date(recentDuplicate.createdAt).getTime();
        if (timeDiffMs < 15000) {
          console.log(`[incident.create] Suppressed duplicate creation (${timeDiffMs}ms ago) for "${sanitizedTitle}"`);
          return recentDuplicate;
        }
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

      // Fire-and-forget: Push to AFs
      void sendPushToAFs(ctx.db, tenantId, {
        title: "📋 Nueva incidencia recibida",
        body: `Un vecino ha reportado: "${created.title}".`,
        data: { type: "new_incident", incidentId: created.id },
      }).catch(console.error);

      // Fire-and-forget: Push confirmation to Vecino
      if (created.reporterId) {
        void sendPushToUser(ctx.db, created.reporterId, {
          title: "Incidencia recibida",
          body: `Tu incidencia "${created.title}" ha sido registrada con éxito.`,
          data: { type: "new_incident", incidentId: created.id },
        }).catch(console.error);
      }

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
      await ensureIncidentColumns(ctx.db);
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
        await insertHistoryIfNotDuplicate(ctx.db, {
          incidentId: updated.id,
          actorName: "Administrador / Agente",
          action: "STATUS_CHANGED",
          previousStatus: previous.status,
          newStatus: updated.status,
        });

        if (updated.reporterId) {
          const statusLabels: Record<string, string> = {
            RECIBIDA: "Incidencia recibida",
            EN_REVISION: "Profesional asignado",
            AGENDADA: "Intervención confirmada",
            EN_CURSO: "En intervención",
            RESUELTA: "Intervención finalizada",
            CERRADA: "Incidencia cerrada",
            RECHAZADA: "No procede",
          };
          void sendPushToUser(ctx.db, updated.reporterId, {
            title: statusLabels[updated.status] ?? "Actualización de incidencia",
            body: `Tu incidencia "${updated.title}" ha cambiado de estado.`,
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
      await ensureIncidentColumns(ctx.db);

      // Check if incident already has an active OT (provider assigned and not rejected/expired)
      const current = await ctx.db.query.incident.findFirst({
        where: and(
          eq(incident.id, input.id),
          eq(incident.organizationId, input.tenantId),
        ),
      });
      if (!current) throw new Error("Incidencia no encontrada.");
      
      // Block reassignment if OT already has a provider assigned (pending response or accepted)
      if (current.providerId && !["RECIBIDA", "CADUCADA", "RECHAZADA", "NO_PRESENTADA"].includes(current.status)) {
        throw new Error(
          "Esta incidencia ya está asignada a un proveedor y no puede reasignarse mientras la OT esté activa."
        );
      }

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
            let usr: any = null;
            if (prov?.email) {
              usr = await ctx.db.query.user.findFirst({
                where: eq(sql`lower(${user.email})`, prov.email.toLowerCase()),
              });
            }
            if (!usr && prov?.phone) {
              usr = await ctx.db.query.user.findFirst({
                where: eq(user.phoneNumber, prov.phone),
              });
            }
            if (!usr && prov?.name) {
              usr = await ctx.db.query.user.findFirst({
                where: eq(sql`lower(${user.name})`, prov.name.toLowerCase()),
              });
            }
            if (!usr) {
              usr = await ctx.db.query.user.findFirst({
                where: eq(user.role, "Proveedor"),
              });
            }
            if (usr?.id) {
              console.log("[PushAssign] Calling sendPushToUser for userId:", usr.id);
              await sendPushToUser(ctx.db, usr.id, {
                title: "📋 Nueva incidencia asignada",
                body: `Se te ha asignado: ${updated.title}`,
                data: { type: "job_assigned", incidentId: updated.id },
              });
              console.log("[PushAssign] sendPushToUser completed successfully");
            } else {
              console.warn("[PushAssign] No user found for provider:", prov?.name);
            }
          } catch (err) {
            console.error("[PushAssign] Failed in push notification promise chain:", err);
          }
        })();
      }

      // Check if this incident was ever assigned before (to prevent push to vecino on reassignment)
      const previousAssignment = await ctx.db.query.incidentHistory.findFirst({
        where: and(
          eq(incidentHistory.incidentId, input.id),
          eq(incidentHistory.action, "ASSIGNED")
        ),
      });
      const isReassignment = Boolean(current.providerId) || Boolean(current.assignedAt) || Boolean(previousAssignment);

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

      // Fire-and-forget push to vecino - ONLY on first assignment (never on reassignment)
      if (updated.reporterId && !isReassignment) {
        void sendPushToUser(ctx.db, updated.reporterId, {
          title: "Profesional asignado",
          body: `Hemos asignado un profesional para atender tu incidencia: "${updated.title}".`,
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
      await ensureIncidentColumns(ctx.db);
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

  // ─── Provider: reject assigned OT (→ RECHAZADA) ───────────────────────────
  providerReject: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        tenantId: z.string().min(1),
        providerId: z.string().min(1),
        reason: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureIncidentColumns(ctx.db);
      // Set to RECHAZADA and clear provider assignment — admin will see it as "Rechazada" and can reassign
      const [updated] = await ctx.db
        .update(incident)
        .set({
          status: "RECHAZADA",
          providerId: null,
          estimatedCost: null,
          estimatedDays: null,
          scheduledAt: null,
          estimatedDuration: null,
        })
        .where(
          and(
            eq(incident.id, input.id),
            eq(incident.organizationId, input.tenantId),
          ),
        )
        .returning();

      if (!updated) throw new Error("No se pudo rechazar la orden de trabajo.");

      // Log history
      await insertHistoryIfNotDuplicate(ctx.db, {
        incidentId: updated.id,
        actorName: "Proveedor",
        action: "PROVIDER_REJECTED",
        previousStatus: "EN_REVISION",
        newStatus: "RECHAZADA",
        comment: input.reason ? `Motivo: ${input.reason}` : "El proveedor ha rechazado la orden de trabajo.",
      });

      // Notify AFs that provider rejected the OT so it can be reassigned
      void sendPushToAFs(ctx.db, input.tenantId, {
        title: "OT Rechazada",
        body: `El proveedor rechazó la incidencia "${updated.title}". La OT ha quedado liberada para reasignar.`,
        data: { type: "provider_rejected", incidentId: updated.id },
      }).catch(console.error);

      if (updated.assigneeId) {
        void sendPushToUser(ctx.db, updated.assigneeId, {
          title: "OT Rechazada",
          body: `El proveedor rechazó la incidencia "${updated.title}". Puedes reasignarla a otro proveedor.`,
          data: { type: "provider_rejected", incidentId: updated.id },
        }).catch(console.error);
      }

      // WS event so admin dashboard updates in real-time
      void emitWebSocketEvent(input.tenantId, "incident-updated", updated);

      return updated;
    }),

  providerExpire: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        tenantId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureIncidentColumns(ctx.db);
      const inc = await ctx.db.query.incident.findFirst({
        where: eq(incident.id, input.id),
      });
      if (!inc) throw new Error("Incidencia no encontrada");

      // Revert to CADUCADA and clear provider assignment
      const [updated] = await ctx.db
        .update(incident)
        .set({
          status: "CADUCADA",
          expiredProviderId: inc.providerId,
          providerId: null,
          estimatedCost: null,
          estimatedDays: null,
          scheduledAt: null,
          estimatedDuration: null,
        })
        .where(eq(incident.id, input.id))
        .returning();

      if (!updated) throw new Error("No se pudo registrar la caducidad de la OT.");

      // Log history
      await insertHistoryIfNotDuplicate(ctx.db, {
        incidentId: updated.id,
        actorName: "Sistema",
        action: "OT_EXPIRED",
        previousStatus: "EN_REVISION",
        newStatus: "CADUCADA",
        comment: "La orden de trabajo caducó por falta de respuesta del proveedor.",
      });

      // Notify AFs that OT has expired and can be reassigned
      void sendPushToAFs(ctx.db, updated.organizationId, {
        title: "OT Caducada",
        body: `La incidencia "${updated.title}" ha caducado por falta de respuesta del proveedor. Ya puedes reasignarla.`,
        data: { type: "ot_expired", incidentId: updated.id },
      }).catch(console.error);

      if (updated.assigneeId) {
        void sendPushToUser(ctx.db, updated.assigneeId, {
          title: "OT Caducada",
          body: `La incidencia "${updated.title}" ha caducado. El proveedor no respondió a tiempo. Puedes reasignarla.`,
          data: { type: "ot_expired", incidentId: updated.id },
        }).catch(console.error);
      }

      // Fire-and-forget WS event to tenant room so Admin Panel updates in real-time
      void emitWebSocketEvent(updated.organizationId, "incident-updated", updated);

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
      await ensureIncidentColumns(ctx.db);
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
        tenantId: z.string().nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await ensureIncidentColumns(ctx.db);
      await processOverdueIncidents(ctx.db, input.tenantId);

      const items = await ctx.db.query.incident.findMany({
        where: and(
          eq(incident.providerId, input.providerId),
          input.tenantId ? eq(incident.organizationId, input.tenantId) : undefined,
        ),
        orderBy: desc(incident.createdAt),
        with: {
          reporter: { columns: { id: true, name: true, phoneNumber: true } },
          provider: true,
          organization: true,
        },
      });

      // Strip large base64 data URLs in list query to prevent client OutOfMemoryError
      return items.map((item) => ({
        ...item,
        photoUrl: item.photoUrl?.startsWith("data:") ? undefined : item.photoUrl,
        finalPhotoUrl: item.finalPhotoUrl?.startsWith("data:") ? undefined : item.finalPhotoUrl,
      }));
    }),

  // ─── Provider: list incidents that expired while assigned to them ──────────
  expiredByProvider: publicProcedure
    .input(
      z.object({
        providerId: z.string().min(1),
        tenantId: z.string().nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await ensureIncidentColumns(ctx.db);

      const items = await ctx.db.query.incident.findMany({
        where: and(
          eq(incident.expiredProviderId, input.providerId),
          input.tenantId ? eq(incident.organizationId, input.tenantId) : undefined,
        ),
        orderBy: desc(incident.updatedAt),
        with: {
          reporter: { columns: { id: true, name: true, phoneNumber: true } },
          organization: true,
        },
      });

      return items.map((item) => ({
        ...item,
        photoUrl: item.photoUrl?.startsWith("data:") ? undefined : item.photoUrl,
        finalPhotoUrl: item.finalPhotoUrl?.startsWith("data:") ? undefined : item.finalPhotoUrl,
      }));
    }),

  // ─── Provider: accept job (→ AGENDADA) ────────────────────────────────────
  providerAccept: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        tenantId: z.string().min(1).optional(),
        providerId: z.string().min(1),
        estimatedDays: z.number().int().min(0).optional(),
        estimatedCost: z.number().min(0).optional(),
        notes: z.string().max(1000).optional(),
        scheduledAt: z.string().datetime().optional(),
        scheduledHour: z.string().max(16).optional(),
        estimatedDuration: z.string().max(32).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureIncidentColumns(ctx.db);
      
      const current = await ctx.db.query.incident.findFirst({
        where: eq(incident.id, input.id),
      });
      if (!current) throw new Error("Incidencia no encontrada.");

      const actualTenantId = current.organizationId;

      const [updated] = await ctx.db
        .update(incident)
        .set({ 
          status: "AGENDADA", 
          providerId: input.providerId,
          estimatedCost: input.estimatedCost,
          estimatedDays: input.estimatedDays,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
          estimatedDuration: input.estimatedDuration,
        })
        .where(eq(incident.id, input.id))
        .returning();

      if (!updated) throw new Error("No se pudo aceptar la incidencia.");

      // Save estimate as internal note
      if (input.notes || input.estimatedCost !== undefined || input.estimatedDays !== undefined || input.scheduledAt) {
        let noteLines = [];
        if (input.notes) noteLines.push(input.notes);
        if (input.estimatedCost !== undefined) noteLines.push(`💰 Presupuesto estimado: ${input.estimatedCost}€`);
        if (input.estimatedDays !== undefined) {
          noteLines.push(`⏳ Tiempo estimado: ${input.estimatedDays === 0 ? "Hoy mismo" : `${input.estimatedDays} días`}`);
        }
        if (input.scheduledAt) {
          const d = new Date(input.scheduledAt);
          const dateStr = d.toLocaleDateString("es-ES", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "Europe/Madrid",
          });
          const timeStr =
            input.scheduledHour ||
            d.toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Europe/Madrid",
            });
          noteLines.push(`📅 Programado: ${dateStr} a las ${timeStr}`);
        }
        if (input.estimatedDuration) noteLines.push(`⏱️ Duración estimada: ${input.estimatedDuration}`);

        await ctx.db.insert(incidentNote).values({
          incidentId: input.id,
          authorId: DEMO_AUTHOR_ID, 
          content: noteLines.join("\n"),
          createdAt: new Date(),
        });
      }

      // Log history
      await insertHistoryIfNotDuplicate(ctx.db, {
        incidentId: updated.id,
        actorName: "Proveedor",
        action: "PROVIDER_ACCEPTED",
        previousStatus: current.status,
        newStatus: "AGENDADA",
        comment: input.notes ? `Notas: ${input.notes}` : "Trabajo agendado por el proveedor",
      });

      // Fire-and-forget push to vecino
      if (updated.reporterId) {
        void sendPushToUser(ctx.db, updated.reporterId, {
          title: "Intervención confirmada",
          body: `El profesional ha confirmado la intervención para "${updated.title}".`,
          data: { type: "new_incident", incidentId: updated.id },
        }).catch(console.error);
      }

      // Fire-and-forget push to AFs
      void sendPushToAFs(ctx.db, actualTenantId, {
        title: "OT Aceptada",
        body: `El profesional ha aceptado y agendado la intervención para "${updated.title}".`,
        data: { type: "provider_accepted", incidentId: updated.id },
      }).catch(console.error);

      // Fire-and-forget: WS event to tenant room
      void emitWebSocketEvent(actualTenantId, "incident-updated", updated);

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
      await ensureIncidentColumns(ctx.db);
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
          title: "Intervención finalizada",
          body: `La intervención para "${updated.title}" ha finalizado.`,
          data: { type: "new_incident", incidentId: updated.id },
        }).catch(console.error);
      }

      // Fire-and-forget push to AFs
      void sendPushToAFs(ctx.db, input.tenantId, {
        title: "Intervención finalizada por proveedor",
        body: `El proveedor ha completado el trabajo de "${updated.title}". Pendiente de validación.`,
        data: { type: "provider_completed", incidentId: updated.id },
      }).catch(console.error);

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
      await ensureIncidentColumns(ctx.db);
      const inc = await ctx.db.query.incident.findFirst({
        where: and(
          eq(incident.id, input.id),
          eq(incident.organizationId, input.tenantId),
        ),
      });

      if (!inc) throw new Error("Incidencia no encontrada");

      // Block arrival before scheduled time
      if ((inc as any).scheduledAt) {
        const scheduledTime = new Date((inc as any).scheduledAt).getTime();
        const now = Date.now();
        // Allow arrival up to 15 minutes before scheduled time
        const EARLY_BUFFER_MS = 15 * 60 * 1000;
        if (now < scheduledTime - EARLY_BUFFER_MS) {
          const scheduledDate = new Date((inc as any).scheduledAt);
          const formattedDate = scheduledDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' });
          const formattedTime = scheduledDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
          throw new Error(
            `La intervención está programada para el ${formattedDate} a las ${formattedTime}. No puedes registrar la llegada antes de esa fecha y hora.`
          );
        }
      }

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
          title: "En intervención",
          body: `El profesional ya está atendiendo tu incidencia "${inc.title}".`,
          data: { type: "new_incident", incidentId: inc.id },
        }).catch(console.error);
      }

      // Fire-and-forget push to AFs
      void sendPushToAFs(ctx.db, inc.organizationId, {
        title: "Proveedor en sitio",
        body: `El profesional ha iniciado la intervención de "${inc.title}".`,
        data: { type: "provider_arrived", incidentId: inc.id },
      }).catch(console.error);

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
      await ensureIncidentColumns(ctx.db);
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
          title: "Incidencia cerrada",
          body: `Tu incidencia "${updated.title}" ha sido validada y cerrada. Ya puedes valorar el servicio.`,
          data: { type: "rating", incidentId: updated.id },
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
      await ensureIncidentColumns(ctx.db);
      const [updated] = await ctx.db
        .update(incident)
        .set({
          rating: input.rating,
          ratingComment: input.comment ? sanitizeText(input.comment) : null,
          status: "CERRADA",
        })
        .where(
          and(
            eq(incident.id, input.id),
            eq(incident.organizationId, input.tenantId),
            inArray(incident.status, ["RESUELTA", "CERRADA"]),
            isNull(incident.rating),
          ),
        )
        .returning();

      if (!updated) throw new Error("No se pudo registrar la valoración.");

      // Log history event (not state change)
      await ctx.db.insert(incidentHistory).values({
        incidentId: updated.id,
        actorName: "Vecino",
        action: "RATED",
        previousStatus: updated.status,
        newStatus: "CERRADA",
        comment: `Valoró con ${input.rating} estrellas: "${input.comment ?? "Sin comentario"}"`,
      });

      // Push notification to AFs
      void sendPushToAFs(ctx.db, input.tenantId, {
        title: "Nueva valoración recibida",
        body: `El vecino ha valorado la incidencia "${updated.title}" con ${input.rating} estrellas.`,
        data: { type: "rating_submitted", incidentId: updated.id },
      }).catch(console.error);

      // Update provider statistics and notify provider if any
      if (updated.providerId) {
        // Find all incidents for this provider that have a valid rating
        const ratedIncidents = await ctx.db.query.incident.findMany({
          where: and(
            eq(incident.providerId, updated.providerId),
            isNotNull(incident.rating),
          ),
        });

        const ratings = ratedIncidents
          .map((i) => i.rating)
          .filter((r): r is number => typeof r === "number" && !isNaN(r));

        const totalRatings = ratings.length;
        const avgRating = totalRatings > 0 
          ? Number((ratings.reduce((sum, r) => sum + r, 0) / totalRatings).toFixed(2))
          : 5.0;

        await ctx.db
          .update(provider)
          .set({
            rating: avgRating,
            completedJobs: totalRatings,
          })
          .where(eq(provider.id, updated.providerId));

        // Push notification to provider user
        void (async () => {
          try {
            const prov = await ctx.db.query.provider.findFirst({
              where: eq(provider.id, updated.providerId!),
            });
            let provUsr: any = null;
            if (prov?.email) {
              provUsr = await ctx.db.query.user.findFirst({
                where: eq(sql`lower(${user.email})`, prov.email.toLowerCase()),
              });
            }
            if (!provUsr && prov?.phone) {
              provUsr = await ctx.db.query.user.findFirst({
                where: eq(user.phoneNumber, prov.phone),
              });
            }
            if (!provUsr && prov?.name) {
              provUsr = await ctx.db.query.user.findFirst({
                where: eq(sql`lower(${user.name})`, prov.name.toLowerCase()),
              });
            }
            if (provUsr?.id) {
              await sendPushToUser(ctx.db, provUsr.id, {
                title: "Nueva valoración de cliente",
                body: `Has recibido una valoración de ${input.rating} estrellas por la intervención "${updated.title}".`,
                data: { type: "rating_submitted", incidentId: updated.id },
              });
            }
          } catch (e) {
            console.error("[submitRating] Error notifying provider:", e);
          }
        })();
      }

      // Fire-and-forget: WS event to tenant room
      void emitWebSocketEvent(input.tenantId, "incident-updated", updated);

      return updated;
    }),
});
