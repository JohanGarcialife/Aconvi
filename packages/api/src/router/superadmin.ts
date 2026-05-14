import { count, eq, desc, inArray, gte, and } from "drizzle-orm";
import { z } from "zod";

import { organization, member, user, incident, voteSession, communityDocument, commonAreaBooking, session } from "@acme/db/schema";

import { createTRPCRouter, superAdminProcedure } from "../trpc";

export const superadminRouter = createTRPCRouter({
  // ── Global Stats ────────────────────────────────────────────────────────
  getStats: superAdminProcedure.query(async ({ ctx }) => {
    const [orgCountResult] = await ctx.db.select({ count: count() }).from(organization);

    const members = await ctx.db.query.member.findMany({ columns: { role: true } });
    const totalNeighbors = members.filter((m) => m.role.startsWith("vecino")).length;
    const totalOwners = members.filter((m) => m.role === "owner").length;

    const [providerCountResult] = await ctx.db
      .select({ count: count() })
      .from(user)
      .where(eq(user.role, "Proveedor"));

    // Count active sessions (last 7 days)
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [activeSessions] = await ctx.db
      .select({ count: count() })
      .from(session)
      .where(gte(session.createdAt, since7d));

    // Count open incidents
    const openIncidents = await ctx.db
      .select({ count: count() })
      .from(incident)
      .where(eq(incident.status, "RECIBIDA"));

    return {
      totalCommunities: orgCountResult?.count ?? 0,
      totalNeighbors,
      totalAdministrators: totalOwners,
      totalProviders: providerCountResult?.count ?? 0,
      activeSessions7d: activeSessions?.count ?? 0,
      openIncidents: openIncidents[0]?.count ?? 0,
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

  // ── Community detail with KPIs ──────────────────────────────────────────
  getCommunityDetail: superAdminProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.db.query.organization.findFirst({
        where: eq(organization.id, input.orgId),
        with: {
          members: { with: { user: { columns: { id: true, name: true, email: true, role: true, createdAt: true } } } },
        },
      });
      if (!org) throw new Error("Comunidad no encontrada");

      const [incidentCount] = await ctx.db.select({ count: count() }).from(incident).where(eq(incident.organizationId, input.orgId));
      const [docCount] = await ctx.db.select({ count: count() }).from(communityDocument).where(eq(communityDocument.organizationId, input.orgId));
      const [voteCount] = await ctx.db.select({ count: count() }).from(voteSession).where(eq(voteSession.organizationId, input.orgId));

      return {
        org,
        kpis: {
          incidents: incidentCount?.count ?? 0,
          documents: docCount?.count ?? 0,
          votes: voteCount?.count ?? 0,
          members: org.members.length,
        },
      };
    }),

  // ── Activity Feed (cross-tenant, most recent 60 actions) ────────────────
  getActivityFeed: superAdminProcedure.query(async ({ ctx }) => {
    const [recentIncidents, recentDocs, recentVotes, recentBookings] = await Promise.all([
      ctx.db.query.incident.findMany({
        orderBy: desc(incident.createdAt),
        limit: 15,
        columns: { id: true, title: true, status: true, organizationId: true, createdAt: true },
      }),
      ctx.db.query.communityDocument.findMany({
        orderBy: desc(communityDocument.createdAt),
        limit: 15,
        columns: { id: true, title: true, category: true, organizationId: true, createdAt: true },
      }),
      ctx.db.query.voteSession.findMany({
        orderBy: desc(voteSession.createdAt),
        limit: 15,
        columns: { id: true, title: true, status: true, organizationId: true, createdAt: true },
      }),
      ctx.db.query.commonAreaBooking.findMany({
        orderBy: desc(commonAreaBooking.createdAt),
        limit: 15,
        columns: { id: true, status: true, date: true, createdAt: true },
        with: { commonArea: { columns: { name: true, organizationId: true } } },
      }),
    ]);

    const feed = [
      ...recentIncidents.map((i) => ({
        id: i.id,
        type: "incident" as const,
        label: i.title,
        sublabel: `Estado: ${i.status}`,
        orgId: i.organizationId,
        at: i.createdAt,
      })),
      ...recentDocs.map((d) => ({
        id: d.id,
        type: "document" as const,
        label: d.title,
        sublabel: `Categoría: ${d.category}`,
        orgId: d.organizationId,
        at: d.createdAt,
      })),
      ...recentVotes.map((v) => ({
        id: v.id,
        type: "vote" as const,
        label: v.title,
        sublabel: `Estado: ${v.status}`,
        orgId: v.organizationId,
        at: v.createdAt,
      })),
      ...recentBookings.map((b) => ({
        id: b.id,
        type: "booking" as const,
        label: b.commonArea?.name ?? "Zona común",
        sublabel: `${b.date} · ${b.status}`,
        orgId: b.commonArea?.organizationId ?? "",
        at: b.createdAt,
      })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 60);

    return feed;
  }),

  // ── All Users (global directory) ────────────────────────────────────────
  getAllUsers: superAdminProcedure
    .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
    .query(async ({ ctx, input }) => {
      const users = await ctx.db.query.user.findMany({
        orderBy: desc(user.createdAt),
        limit: input.limit,
        offset: input.offset,
        columns: { id: true, name: true, email: true, role: true, createdAt: true, deviceActivatedAt: true },
      });
      const [total] = await ctx.db.select({ count: count() }).from(user);
      return { users, total: total?.count ?? 0 };
    }),

  // ── System Health ───────────────────────────────────────────────────────
  getSystemHealth: superAdminProcedure.query(async ({ ctx }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [openIncidents, activeVotes, docsToday, activeSessions] = await Promise.all([
      ctx.db.select({ count: count() }).from(incident).where(eq(incident.status, "RECIBIDA")),
      ctx.db.select({ count: count() }).from(voteSession).where(eq(voteSession.status, "OPEN")),
      ctx.db.select({ count: count() }).from(communityDocument).where(gte(communityDocument.createdAt, today)),
      ctx.db.select({ count: count() }).from(session).where(gte(session.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))),
    ]);

    return {
      openIncidents: openIncidents[0]?.count ?? 0,
      activeVoteSessions: activeVotes[0]?.count ?? 0,
      documentsUploadedToday: docsToday[0]?.count ?? 0,
      activeSessionsLast24h: activeSessions[0]?.count ?? 0,
    };
  }),

  // ── List all System Administrators (Global level) ───────────────────────
  getAdministrators: superAdminProcedure.query(async ({ ctx }) => {
    const users = await ctx.db.query.user.findMany({
      where: inArray(user.role, ["SuperAdmin", "AgenteAconvi", "AF"]),
      orderBy: desc(user.createdAt),
    });

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
