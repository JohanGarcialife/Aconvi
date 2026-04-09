import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";

import { organization, member, user } from "@acme/db/schema";

import { createTRPCRouter, protectedProcedure, tenantProcedure } from "../trpc";

export const communityRouter = createTRPCRouter({
  // ── List all communities the current AF manages ───────────────────────────
  all: protectedProcedure.query(async ({ ctx }) => {
    const userGroups = await ctx.db.query.member.findMany({
      where: eq(member.userId, ctx.session.user.id),
      with: { organization: true },
    });
    return userGroups.map((g) => g.organization);
  }),

  // ── Create a new community (Finca) ────────────────────────────────────────
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(256),
        address: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const slug = input.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const now = new Date();

      const [org] = await ctx.db
        .insert(organization)
        .values({
          id: crypto.randomUUID(),
          name: input.name,
          slug: `${slug}-${Date.now()}`,
          metadata: input.address ? JSON.stringify({ address: input.address }) : null,
          createdAt: now,
        })
        .returning();

      if (!org) throw new Error("Error creando comunidad");

      // Add current user as owner/AF
      await ctx.db.insert(member).values({
        id: crypto.randomUUID(),
        organizationId: org.id,
        userId: ctx.session.user.id,
        role: "owner",
        createdAt: now,
      });

      return org;
    }),

  // ── List members (vecinos) of a community ─────────────────────────────────
  neighbors: tenantProcedure.query(async ({ ctx, input }) => {
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
    return members.map((m) => ({ ...m.user, memberId: m.id, memberRole: m.role }));
  }),

  // ── Add a neighbor (vecino) to a community ────────────────────────────────
  addNeighbor: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1).max(256),
        email: z.string().email(),
        phone: z.string().optional(),
        unit: z.string().optional(), // piso/puerta e.g. "2B"
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { tenantId, name, email, phone, unit } = input;

      // Check if user exists already
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

      // Check they're not already a member
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
          createdAt: new Date(),
        })
        .returning();

      return { user: existingUser, member: newMember };
    }),

  // ── Remove a neighbor from a community ───────────────────────────────────
  removeNeighbor: tenantProcedure
    .input(z.object({ memberId: z.string() }))
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
  import: protectedProcedure
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

          // Add AF as owner
          await ctx.db.insert(member).values({
            id: crypto.randomUUID(),
            organizationId: org.id,
            userId: ctx.session.user.id,
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
