import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";

import { incident } from "@acme/db/schema";

import { createTRPCRouter, tenantProcedure } from "../trpc";

export const incidentRouter = createTRPCRouter({
  all: tenantProcedure.query(({ ctx, input }) => {
    return ctx.db.query.incident.findMany({
      where: eq(incident.organizationId, input.tenantId),
      orderBy: desc(incident.createdAt),
      with: {
        reporter: {
          columns: {
            id: true,
            name: true,
            phoneNumber: true,
          },
        },
        assignee: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });
  }),

  byId: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) => {
      // NOTE: tenantProcedure ensures ctx.tenant.id matches input.tenantId
      return ctx.db.query.incident.findFirst({
        where: and(
          eq(incident.id, input.id),
          eq(incident.organizationId, input.tenantId),
        ),
        with: {
          reporter: {
            columns: {
              id: true,
              name: true,
              phoneNumber: true,
            },
          },
          assignee: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });
    }),

  create: tenantProcedure
    .input(
      z.object({
        title: z.string().min(1).max(256),
        description: z.string().min(1),
        photoUrl: z.string().url().optional(),
        priority: z.enum(["BAJA", "MEDIA", "ALTA"]).default("MEDIA"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { tenantId, ...data } = input;
      return ctx.db.insert(incident).values({
        ...data,
        organizationId: tenantId,
        reporterId: ctx.session.user.id,
      });
    }),

  updateStatus: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["PENDIENTE", "EN_CURSO", "RESUELTO", "RECHAZADO"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Basic tenant isolation check
      return ctx.db
        .update(incident)
        .set({ status: input.status })
        .where(
          and(
            eq(incident.id, input.id),
            eq(incident.organizationId, input.tenantId),
          ),
        );
    }),

  assignProvider: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        providerId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // AF Only Check could be implemented here or via roleProcedure
      return ctx.db
        .update(incident)
        .set({ assigneeId: input.providerId, status: "EN_CURSO" })
        .where(
          and(
            eq(incident.id, input.id),
            eq(incident.organizationId, input.tenantId),
          ),
        );
    }),
});
