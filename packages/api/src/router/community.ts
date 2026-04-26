import { eq, desc, and, count } from "drizzle-orm";
import { z } from "zod";

import { organization, member, user } from "@acme/db/schema";

import { createTRPCRouter, publicProcedure } from "../trpc";

// Demo fallback user for operations that require an author
const DEMO_OWNER_ID = "test-user-jluis-1776971864823";

export const communityRouter = createTRPCRouter({
  // ── List all communities the demo AF manages ──────────────────────────────
  all: publicProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.query.member.findMany({
      where: eq(member.userId, DEMO_OWNER_ID),
      with: { organization: true },
    });
    return memberships.map((m) => m.organization);
  }),

  // ── Community stats (vecinos totales etc.) ────────────────────────────────
  stats: publicProcedure
    .input(z.object({ tenantId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const members = await ctx.db.query.member.findMany({
        where: eq(member.organizationId, input.tenantId),
      });
      const vecinos = members.filter((m) => m.role.startsWith("vecino"));
      return {
        total: members.length,
        vecinos: vecinos.length,
        units: vecinos.filter((m) => m.role.includes(":")).length,
      };
    }),

  // ── Create a new community (Finca) ────────────────────────────────────────
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(256),
        address: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const slug = `${input.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")}-${Date.now()}`;

      const now = new Date();
      const [org] = await ctx.db
        .insert(organization)
        .values({
          id: crypto.randomUUID(),
          name: input.name,
          slug,
          metadata: input.address ? JSON.stringify({ address: input.address }) : null,
          createdAt: now,
        })
        .returning();

      if (!org) throw new Error("Error creando comunidad");

      await ctx.db.insert(member).values({
        id: crypto.randomUUID(),
        organizationId: org.id,
        userId: DEMO_OWNER_ID,
        role: "owner",
        createdAt: now,
      });

      return org;
    }),

  // ── Update community name/address ─────────────────────────────────────────
  update: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(256).optional(),
        address: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get current metadata to merge
      const current = await ctx.db.query.organization.findFirst({
        where: eq(organization.id, input.id),
      });
      if (!current) throw new Error("Comunidad no encontrada");

      const currentMeta = current.metadata ? JSON.parse(current.metadata) : {};
      const newMeta = input.address !== undefined
        ? { ...currentMeta, address: input.address }
        : currentMeta;

      const [updated] = await ctx.db
        .update(organization)
        .set({
          ...(input.name ? { name: input.name } : {}),
          metadata: JSON.stringify(newMeta),
        })
        .where(eq(organization.id, input.id))
        .returning();

      return updated;
    }),

  // ── Delete community ────────────────────────────────────────────────────
  delete: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // cascade handles members, incidents etc.
      await ctx.db.delete(organization).where(eq(organization.id, input.id));
      return { ok: true };
    }),

  // ── List members (vecinos) of a community ─────────────────────────────────
  neighbors: publicProcedure
    .input(z.object({ tenantId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const members = await ctx.db.query.member.findMany({
        where: eq(member.organizationId, input.tenantId),
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
              phoneNumber: true,
              role: true,
              createdAt: true,
            },
          },
        },
        orderBy: desc(member.createdAt),
      });
      return members.map((m) => ({
        ...m.user,
        memberId: m.id,
        memberRole: m.role,
        coefficient: m.coefficient,
      }));
    }),

  // ── Add a neighbor (vecino) ───────────────────────────────────────────────
  addNeighbor: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        name: z.string().min(1).max(256),
        email: z.string().email(),
        phone: z.string().optional(),
        unit: z.string().optional(),
        coefficient: z.number().min(0).max(100).optional().default(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { tenantId, name, email, phone, unit, coefficient } = input;

      let existingUser = await ctx.db.query.user.findFirst({
        where: eq(user.email, email),
      });

      if (!existingUser) {
        const [newUser] = await ctx.db
          .insert(user)
          .values({
            id: crypto.randomUUID(),
            name,
            email,
            phoneNumber: phone ?? null,
            emailVerified: false,
            phoneNumberVerified: false,
            role: "Vecino",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        existingUser = newUser;
      }

      if (!existingUser) throw new Error("Error creando vecino");

      const existing = await ctx.db.query.member.findFirst({
        where: and(
          eq(member.organizationId, tenantId),
          eq(member.userId, existingUser.id),
        ),
      });

      if (existing) throw new Error("Este vecino ya pertenece a la comunidad");

      const [newMember] = await ctx.db
        .insert(member)
        .values({
          id: crypto.randomUUID(),
          organizationId: tenantId,
          userId: existingUser.id,
          role: unit ? `vecino:${unit}` : "vecino",
          coefficient: coefficient ?? 100,
          createdAt: new Date(),
        })
        .returning();

      return { user: existingUser, member: newMember };
    }),

  // ── Update neighbor (name, phone, unit, coefficient) ─────────────────────
  updateNeighbor: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        memberId: z.string().min(1),
        userId: z.string().min(1),
        name: z.string().min(1).max(256).optional(),
        phone: z.string().optional(),
        unit: z.string().optional(),
        coefficient: z.number().min(0).max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Update user fields (name, phone)
      if (input.name || input.phone !== undefined) {
        await ctx.db
          .update(user)
          .set({
            ...(input.name ? { name: input.name } : {}),
            ...(input.phone !== undefined ? { phoneNumber: input.phone || null } : {}),
          })
          .where(eq(user.id, input.userId));
      }

      // Update member fields (role/unit, coefficient)
      const memberUpdates: Record<string, any> = {};
      if (input.unit !== undefined) {
        memberUpdates.role = input.unit ? `vecino:${input.unit}` : "vecino";
      }
      if (input.coefficient !== undefined) {
        memberUpdates.coefficient = input.coefficient;
      }

      if (Object.keys(memberUpdates).length > 0) {
        await ctx.db
          .update(member)
          .set(memberUpdates)
          .where(
            and(
              eq(member.id, input.memberId),
              eq(member.organizationId, input.tenantId),
            ),
          );
      }

      return { ok: true };
    }),

  // ── Remove a neighbor ─────────────────────────────────────────────────────
  removeNeighbor: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        memberId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db
        .delete(member)
        .where(
          and(
            eq(member.id, input.memberId),
            eq(member.organizationId, input.tenantId),
          ),
        );
    }),

  // ── Bulk import from Excel ────────────────────────────────────────────────
  import: publicProcedure
    .input(
      z.object({
        communities: z.array(
          z.object({
            name: z.string().min(1),
            address: z.string().optional(),
            neighbors: z
              .array(
                z.object({
                  name: z.string(),
                  email: z.string().email(),
                  phone: z.string().optional(),
                  unit: z.string().optional(),
                  coefficient: z.number().min(0).max(100).optional(),
                }),
              )
              .optional()
              .default([]),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const results = { communities: 0, neighbors: 0, errors: [] as string[] };
      const now = new Date();

      for (const comm of input.communities) {
        try {
          const slug = `${comm.name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "")}-${Date.now()}`;

          const [org] = await ctx.db
            .insert(organization)
            .values({
              id: crypto.randomUUID(),
              name: comm.name,
              slug,
              metadata: comm.address ? JSON.stringify({ address: comm.address }) : null,
              createdAt: now,
            })
            .returning();

          if (!org) continue;

          // Add demo AF as owner
          await ctx.db.insert(member).values({
            id: crypto.randomUUID(),
            organizationId: org.id,
            userId: DEMO_OWNER_ID,
            role: "owner",
            createdAt: now,
          });

          results.communities++;

          // Add neighbors
          for (const n of comm.neighbors ?? []) {
            try {
              let u = await ctx.db.query.user.findFirst({
                where: eq(user.email, n.email),
              });

              if (!u) {
                const [created] = await ctx.db
                  .insert(user)
                  .values({
                    id: crypto.randomUUID(),
                    name: n.name,
                    email: n.email,
                    phoneNumber: n.phone ?? null,
                    emailVerified: false,
                    phoneNumberVerified: false,
                    role: "Vecino",
                    createdAt: now,
                    updatedAt: now,
                  })
                  .returning();
                u = created;
              }

              if (u) {
                await ctx.db.insert(member).values({
                  id: crypto.randomUUID(),
                  organizationId: org.id,
                  userId: u.id,
                  role: n.unit ? `vecino:${n.unit}` : "vecino",
                  coefficient: n.coefficient ?? 100,
                  createdAt: now,
                });
                results.neighbors++;
              }
            } catch (e: any) {
              results.errors.push(`Vecino ${n.email}: ${e.message}`);
            }
          }
        } catch (e: any) {
          results.errors.push(`Comunidad ${comm.name}: ${e.message}`);
        }
      }

      return results;
    }),
});
