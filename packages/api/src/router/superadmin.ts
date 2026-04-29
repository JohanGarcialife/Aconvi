import { count, eq, desc, inArray } from "drizzle-orm";
import { z } from "zod";

import { organization, member, user } from "@acme/db/schema";

import { createTRPCRouter, superAdminProcedure } from "../trpc";

export const superadminRouter = createTRPCRouter({
  // ── Global Stats ────────────────────────────────────────────────────────
  getStats: superAdminProcedure.query(async ({ ctx }) => {
    // 1. Total tenants (organizations)
    const [orgCountResult] = await ctx.db
      .select({ count: count() })
      .from(organization);

    // 2. Total members grouped by generic types
    const members = await ctx.db.query.member.findMany({
      columns: { role: true },
    });

    const totalNeighbors = members.filter((m) =>
      m.role.startsWith("vecino")
    ).length;
    const totalOwners = members.filter((m) => m.role === "owner").length;

    // 3. Total providers globally
    const [providerCountResult] = await ctx.db
      .select({ count: count() })
      .from(user)
      .where(eq(user.role, "Proveedor"));

    return {
      totalCommunities: orgCountResult?.count ?? 0,
      totalNeighbors,
      totalAdministrators: totalOwners,
      totalProviders: providerCountResult?.count ?? 0,
    };
  }),

  // ── List all Communities globally ───────────────────────────────────────
  getCommunities: superAdminProcedure.query(async ({ ctx }) => {
    const orgs = await ctx.db.query.organization.findMany({
      with: {
        members: {
          where: eq(member.role, "owner"),
          with: { user: true },
        },
      },
      orderBy: desc(organization.createdAt),
    });

    return orgs.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      createdAt: org.createdAt,
      metadata: org.metadata,
      owners: org.members.map((m) => m.user.name ?? m.user.email),
    }));
  }),

  // ── List all System Administrators (Global level) ───────────────────────
  getAdministrators: superAdminProcedure.query(async ({ ctx }) => {
    // Encontramos los usuarios que tengan roles de administrador a nivel global o local
    const users = await ctx.db.query.user.findMany({
      where: inArray(user.role, ["SuperAdmin", "AgenteAconvi", "AF"]),
      orderBy: desc(user.createdAt),
    });

    // Podríamos también cruzar esto con la tabla members para ver cuántas fincas gestionan,
    // pero por ahora devolvemos el catálogo simple.
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      phoneNumber: u.phoneNumber,
      createdAt: u.createdAt,
    }));
  }),
});
