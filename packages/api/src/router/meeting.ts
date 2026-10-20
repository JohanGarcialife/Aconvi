import crypto from "crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import {
  fee,
  incident,
  meetingAttendance,
  member,
  organization,
  user,
  voteBudgetProposal,
  voteCast,
  voteItem,
  voteSession,
} from "@acme/db/schema";

import { createTRPCRouter, publicProcedure } from "../trpc";
import { emitWebSocketEvent } from "../utils/ws";

let meetingTablesEnsured = false;

const DEMO_OWNERS_SEED = [
  {
    id: "usr_owner_ana_ruiz",
    memberId: "mem_owner_ana_ruiz",
    name: "Ana Ruiz Torres",
    email: "ana.ruiz@jardines.es",
    phone: "611223344",
    door: "3B",
    coefficient: 4.9,
    defaultPresent: true,
  },
  {
    id: "usr_owner_desarrollos_costa",
    memberId: "mem_owner_desarrollos_costa",
    name: "Desarrollos Costa, S.A.",
    email: "admin@desarrolloscosta.es",
    phone: "963112233",
    door: "1A",
    coefficient: 10.25,
    defaultPresent: false,
  },
  {
    id: "usr_owner_juan_rodriguez",
    memberId: "mem_owner_juan_rodriguez",
    name: "Juan Rodríguez Martínez",
    email: "juan.rodriguez@jardines.es",
    phone: "600123456",
    door: "4C",
    coefficient: 5.3,
    defaultPresent: false,
  },
  {
    id: "usr_owner_maria_lopez",
    memberId: "mem_owner_maria_lopez",
    name: "María López Sánchez",
    email: "maria.lopez@jardines.es",
    phone: "622334455",
    door: "2D",
    coefficient: 3.75,
    defaultPresent: false,
  },
  {
    id: "usr_owner_vicente_perez",
    memberId: "mem_owner_vicente_perez",
    name: "Vicente Pérez Gómez",
    email: "vicente.perez@jardines.es",
    phone: "633445566",
    door: "5A",
    coefficient: 2.85,
    defaultPresent: false,
  },
  {
    id: "usr_owner_luis_cano",
    memberId: "mem_owner_luis_cano",
    name: "Luis Cano Beltrán",
    email: "luis.cano@jardines.es",
    phone: "644556677",
    door: "6B",
    coefficient: 4.1,
    defaultPresent: false,
  },
  {
    id: "usr_owner_carmen_navarro",
    memberId: "mem_owner_carmen_navarro",
    name: "Carmen Navarro Gil",
    email: "carmen.navarro@jardines.es",
    phone: "655667788",
    door: "1B",
    coefficient: 6.45,
    defaultPresent: true,
  },
  {
    id: "usr_owner_roberto_serrano",
    memberId: "mem_owner_roberto_serrano",
    name: "Roberto Serrano Vidal",
    email: "roberto.serrano@jardines.es",
    phone: "666778899",
    door: "2A",
    coefficient: 7.8,
    defaultPresent: true,
  },
  {
    id: "usr_owner_elena_morales",
    memberId: "mem_owner_elena_morales",
    name: "Elena Morales Pardo",
    email: "elena.morales@jardines.es",
    phone: "677889900",
    door: "3A",
    coefficient: 6.5,
    defaultPresent: true,
  },
  {
    id: "usr_owner_inversiones_turia",
    memberId: "mem_owner_inversiones_turia",
    name: "Inversiones Turia, S.L.",
    email: "info@inversionesturia.es",
    phone: "963998877",
    door: "Bajo A",
    coefficient: 9.2,
    defaultPresent: true,
  },
  {
    id: "usr_owner_francisco_molina",
    memberId: "mem_owner_francisco_molina",
    name: "Francisco Molina Ortiz",
    email: "francisco.molina@jardines.es",
    phone: "688990011",
    door: "4A",
    coefficient: 7.5,
    defaultPresent: true,
  },
  {
    id: "usr_owner_laura_dominguez",
    memberId: "mem_owner_laura_dominguez",
    name: "Laura Domínguez Sanz",
    email: "laura.dominguez@jardines.es",
    phone: "699001122",
    door: "5B",
    coefficient: 5.4,
    defaultPresent: false,
  },
];

async function ensureMeetingTables(db: any, tenantId: string) {
  if (!meetingTablesEnsured) {
    try {
      const statements = [
        `CREATE TABLE IF NOT EXISTS "meeting_attendance" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "session_id" uuid NOT NULL REFERENCES "vote_session"("id") ON DELETE cascade,
          "member_id" text NOT NULL,
          "user_id" text NOT NULL,
          "present" boolean DEFAULT false NOT NULL,
          "status" varchar(32) DEFAULT 'ABSENT' NOT NULL,
          "coefficient" real DEFAULT 0 NOT NULL,
          "rep_name" varchar(256),
          "rep_doc_id" varchar(64),
          "rep_phone" varchar(64),
          "rep_email" varchar(256),
          "rep_doc_verified" boolean DEFAULT false NOT NULL,
          "check_in_method" varchar(32) DEFAULT 'MANUAL' NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        );`,
        `ALTER TABLE "vote_session" ADD COLUMN IF NOT EXISTS "meeting_started_at" timestamp with time zone;`,
        `ALTER TABLE "vote_session" ADD COLUMN IF NOT EXISTS "meeting_call" varchar(16);`,
        `ALTER TABLE "vote_session" ADD COLUMN IF NOT EXISTS "meeting_ended_at" timestamp with time zone;`,
      ];
      for (const stmt of statements) {
        try {
          await db.execute(sql.raw(stmt));
        } catch (e: any) {
          console.warn("[ensureMeetingTables] SQL warning:", e?.message);
        }
      }
      meetingTablesEnsured = true;
    } catch (err) {
      console.error("[ensureMeetingTables] Error:", err);
    }
  }

  // Ensure demo owners exist in tenantId so attendance list has realistic owners & coefficients
  try {
    for (const owner of DEMO_OWNERS_SEED) {
      await db.execute(
        sql`INSERT INTO "user" ("id", "name", "email", "phone_number", "role", "email_verified", "phone_number_verified", "created_at", "updated_at")
            VALUES (${owner.id}, ${owner.name}, ${owner.email}, ${owner.phone}, 'Vecino', false, false, now(), now())
            ON CONFLICT ("id") DO NOTHING`,
      );
      await db.execute(
        sql`INSERT INTO "member" ("id", "organization_id", "user_id", "role", "coefficient", "voting_override", "created_at")
            VALUES (${owner.memberId}, ${tenantId}, ${owner.id}, ${`vecino:${owner.door}`}, ${owner.coefficient}, false, now())
            ON CONFLICT ("id") DO UPDATE SET "coefficient" = ${owner.coefficient}, "role" = ${`vecino:${owner.door}`}`,
      );
    }
  } catch (seedErr: any) {
    console.warn("[ensureMeetingTables] Owner seed warning:", seedErr?.message);
  }
}

function getInitials(name: string): string {
  const clean = name.replace(/[,().]/g, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase() || "PR";
}

function extractDoor(roleStr?: string | null, index = 0): string {
  if (roleStr && roleStr.includes(":")) {
    const unit = roleStr.split(":")[1]?.trim();
    if (unit) {
      return unit.toLowerCase().startsWith("puerta") ||
        unit.toLowerCase().startsWith("bajo")
        ? unit
        : `Puerta ${unit}`;
    }
  }
  const fallbackDoors = [
    "Puerta 1A",
    "Puerta 1B",
    "Puerta 2A",
    "Puerta 2B",
    "Puerta 3A",
    "Puerta 3B",
    "Puerta 4A",
    "Puerta 4C",
    "Puerta 5A",
    "Puerta 6B",
  ];
  return fallbackDoors[index % fallbackDoors.length]!;
}

export const meetingRouter = createTRPCRouter({
  // ── Portfolio overview for AF Home Screen ──────────────────────────────────
  portfolio: publicProcedure
    .input(z.object({ tenantId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await ensureMeetingTables(ctx.db, input.tenantId);

      // Fetch active incidents
      const allIncidents = await ctx.db.query.incident.findMany({
        where: eq(incident.organizationId, input.tenantId),
        orderBy: desc(incident.createdAt),
      });

      // Fetch all voting sessions (Juntas + Votaciones)
      const allSessions = await ctx.db.query.voteSession.findMany({
        where: eq(voteSession.organizationId, input.tenantId),
        orderBy: desc(voteSession.createdAt),
        with: {
          items: {
            orderBy: (i, { asc }) => [asc(i.orderIndex)],
            with: {
              budgetProposals: true,
            },
          },
          budgetProposals: true,
          casts: true,
        },
      });

      // Ensure at least one JUNTA exists so AF has a junta ready to manage
      let juntas = allSessions.filter((s) => s.type === "JUNTA");
      if (juntas.length === 0) {
        try {
          const newJuntaId = crypto.randomUUID();
          const now = new Date();
          const meetingDate = new Date(now.getTime() + 2 * 60 * 60 * 1000);
          const secondCall = new Date(meetingDate.getTime() + 30 * 60 * 1000);
          const closesAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

          await ctx.db.insert(voteSession).values({
            id: newJuntaId,
            organizationId: input.tenantId,
            authorId: "00000000-0000-0000-0000-000000000000",
            type: "JUNTA",
            title: "Junta ordinaria",
            description:
              "Junta General Ordinaria de propietarios de Jardines del Turia.",
            status: "OPEN",
            meetingDate,
            secondCallDate: secondCall,
            meetingLocation: "Salón Comunitario · Jardines del Turia",
            closesAt,
          });

          const item1Id = crypto.randomUUID();
          await ctx.db.insert(voteItem).values({
            id: item1Id,
            sessionId: newJuntaId,
            orderIndex: 1,
            title: "Aprobación de cuentas anuales y presupuesto ejercicio 2026",
            budget: "14.500 €",
            onlineVotingEnabled: true,
            autoGenerateOt: false,
          });

          const item2Id = crypto.randomUUID();
          await ctx.db.insert(voteItem).values({
            id: item2Id,
            sessionId: newJuntaId,
            orderIndex: 2,
            title: "Sustitución de bomba de presión del grupo hidroneumático",
            budget: "2.450 €",
            onlineVotingEnabled: true,
            autoGenerateOt: true,
          });

          const refreshed = await ctx.db.query.voteSession.findFirst({
            where: eq(voteSession.id, newJuntaId),
            with: {
              items: { with: { budgetProposals: true } },
              budgetProposals: true,
              casts: true,
            },
          });
          if (refreshed) juntas = [refreshed];
        } catch (e: any) {
          console.warn("[meeting.portfolio] Seed junta warning:", e?.message);
        }
      }

      const activeIncidents = allIncidents.filter(
        (i) => i.status !== "CERRADA" && i.status !== "RESUELTA",
      );
      const urgentIncidents = activeIncidents.filter(
        (i) =>
          i.status === "RECIBIDA" ||
          i.status === "CADUCADA" ||
          i.status === "NO_PRESENTADA",
      );
      const minorIncidents = activeIncidents.filter(
        (i) => !urgentIncidents.some((u) => u.id === i.id),
      );

      const singleVotes = allSessions.filter((s) => s.type !== "JUNTA");
      const openVotes = allSessions.filter((s) => s.status === "OPEN");
      const draftVotes = allSessions.filter((s) => s.status === "DRAFT");
      const closedVotes = allSessions.filter((s) => s.status === "CLOSED");

      return {
        stats: {
          managedCommunities: 7,
          activeCommunities: 3,
          totalOwners: 42,
          todayIncidentsCount: Math.min(activeIncidents.length, 3),
          todayJuntasCount: Math.max(
            1,
            juntas.filter((j) => j.status === "OPEN").length,
          ),
          totalActiveIncidents: activeIncidents.length,
          urgentIncidentsCount: urgentIncidents.length,
          minorIncidentsCount: minorIncidents.length,
          openVotesCount: openVotes.length,
          draftVotesCount: draftVotes.length,
          closedVotesCount: closedVotes.length,
        },
        featuredJunta: juntas[0] ?? null,
        juntas,
        recentIncidents: activeIncidents.slice(0, 5),
        recentVotes: singleVotes.slice(0, 5),
      };
    }),

  // ── List Communities in AF Portfolio ──────────────────────────────────────
  communities: publicProcedure
    .input(z.object({ tenantId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const dbOrgs = await ctx.db.query.organization.findMany();
      const staticPortfolio = [
        {
          id: input.tenantId,
          name: "Jardines del Turia",
          address: "C/ Poeta Querol, 8 · Valencia",
          ownersCount: 42,
          activeIncidents: 3,
          hasJuntaToday: true,
        },
        {
          id: "org_edificio_colon",
          name: "Edificio Colón",
          address: "C/ Colón, 56 · Valencia",
          ownersCount: 53,
          activeIncidents: 1,
          hasJuntaToday: false,
        },
        {
          id: "org_edificio_gran_via",
          name: "Edificio Gran Vía",
          address: "Gran Vía Marqués del Turia, 45 · Valencia",
          ownersCount: 18,
          activeIncidents: 0,
          hasJuntaToday: false,
        },
        {
          id: "org_residencial_alameda",
          name: "Residencial Alameda",
          address: "Av. de Francia, 12 · Valencia",
          ownersCount: 28,
          activeIncidents: 2,
          hasJuntaToday: false,
        },
        {
          id: "org_residencial_campanar",
          name: "Residencial Campanar",
          address: "C/ General Avilés, 14 · Valencia",
          ownersCount: 30,
          activeIncidents: 0,
          hasJuntaToday: false,
        },
        {
          id: "org_torre_malvarrosa",
          name: "Torre de la Malvarrosa",
          address: "Av. de la Malvarrosa, 120 · Valencia",
          ownersCount: 24,
          activeIncidents: 1,
          hasJuntaToday: false,
        },
        {
          id: "org_residencial_el_saler",
          name: "Residencial El Saler",
          address: "C/ Antonio Ferrandis, 22 · Valencia",
          ownersCount: 16,
          activeIncidents: 0,
          hasJuntaToday: false,
        },
      ];

      // Merge any custom created organizations from DB
      for (const org of dbOrgs) {
        if (
          org.id !== "org_aconvi_demo" &&
          !staticPortfolio.some(
            (s) => s.name.toLowerCase() === org.name.toLowerCase(),
          )
        ) {
          let addr = "Valencia";
          try {
            if (org.metadata) {
              const parsed = JSON.parse(org.metadata);
              if (parsed.address) addr = parsed.address;
            }
          } catch {
            // ignore
          }
          staticPortfolio.push({
            id: org.id,
            name: org.name,
            address: addr,
            ownersCount: 32,
            activeIncidents: 0,
            hasJuntaToday: false,
          });
        }
      }

      return staticPortfolio;
    }),

  // ── Full Attendance & Quorum state for a Junta session ────────────────────
  attendance: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        sessionId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await ensureMeetingTables(ctx.db, input.tenantId);

      // Resolve session: either explicit sessionId or latest JUNTA in tenant
      let session = input.sessionId
        ? await ctx.db.query.voteSession.findFirst({
            where: eq(voteSession.id, input.sessionId),
            with: {
              items: {
                orderBy: (i, { asc }) => [asc(i.orderIndex)],
                with: { budgetProposals: true },
              },
              budgetProposals: true,
              casts: true,
            },
          })
        : null;

      if (!session) {
        session = await ctx.db.query.voteSession.findFirst({
          where: and(
            eq(voteSession.organizationId, input.tenantId),
            eq(voteSession.type, "JUNTA"),
          ),
          orderBy: desc(voteSession.createdAt),
          with: {
            items: {
              orderBy: (i, { asc }) => [asc(i.orderIndex)],
              with: { budgetProposals: true },
            },
            budgetProposals: true,
            casts: true,
          },
        });
      }

      if (!session) {
        session = await ctx.db.query.voteSession.findFirst({
          where: eq(voteSession.organizationId, input.tenantId),
          orderBy: desc(voteSession.createdAt),
          with: {
            items: {
              orderBy: (i, { asc }) => [asc(i.orderIndex)],
              with: { budgetProposals: true },
            },
            budgetProposals: true,
            casts: true,
          },
        });
      }

      if (!session) {
        throw new Error("No hay junta activa disponible.");
      }

      // Query seeded owners for this community
      const seedIds = DEMO_OWNERS_SEED.map((o) => o.memberId);
      const dbMembers = await ctx.db.query.member.findMany({
        where: and(
          eq(member.organizationId, input.tenantId),
          inArray(member.id, seedIds),
        ),
        with: {
          user: true,
        },
      });

      // Check existing attendance rows for this session
      let attRows = await ctx.db.query.meetingAttendance.findMany({
        where: eq(meetingAttendance.sessionId, session.id),
      });

      // If no attendance records exist yet for this session, initialize default presence
      if (attRows.length === 0) {
        for (const seedOwner of DEMO_OWNERS_SEED) {
          await ctx.db.insert(meetingAttendance).values({
            sessionId: session.id,
            memberId: seedOwner.memberId,
            userId: seedOwner.id,
            present: seedOwner.defaultPresent,
            status: seedOwner.defaultPresent ? "PRESENT" : "ABSENT",
            coefficient: seedOwner.coefficient,
            checkInMethod: "MANUAL",
          });
        }
        attRows = await ctx.db.query.meetingAttendance.findMany({
          where: eq(meetingAttendance.sessionId, session.id),
        });
      }

      const attByMember = new Map(attRows.map((r) => [r.memberId, r]));

      // Order owners matching DEMO_OWNERS_SEED order first
      const owners = DEMO_OWNERS_SEED.map((seedOwner, idx) => {
        const dbMem = dbMembers.find((m) => m.id === seedOwner.memberId);
        const att = attByMember.get(seedOwner.memberId);
        const name = dbMem?.user?.name ?? seedOwner.name;
        const coeff = att?.coefficient ?? dbMem?.coefficient ?? seedOwner.coefficient;
        const isPresent = att ? att.present : seedOwner.defaultPresent;
        const status = att?.status ?? (isPresent ? "PRESENT" : "ABSENT");

        return {
          memberId: seedOwner.memberId,
          userId: seedOwner.id,
          name,
          initials: getInitials(name),
          door: extractDoor(dbMem?.role ?? `vecino:${seedOwner.door}`, idx),
          coefficient: coeff,
          email: dbMem?.user?.email ?? seedOwner.email,
          phone: dbMem?.user?.phoneNumber ?? seedOwner.phone,
          present: isPresent,
          status,
          repName: att?.repName ?? null,
          repDocId: att?.repDocId ?? null,
          repPhone: att?.repPhone ?? null,
          repEmail: att?.repEmail ?? null,
          repDocVerified: att?.repDocVerified ?? false,
          checkInMethod: att?.checkInMethod ?? "MANUAL",
        };
      });

      const presentOwners = owners.filter((o) => o.present);
      const participationPct = Number(
        presentOwners.reduce((sum, o) => sum + o.coefficient, 0).toFixed(2),
      );
      const quorumMinimumPct = 50;
      const missingForQuorumPct = Number(
        Math.max(0, quorumMinimumPct - participationPct).toFixed(2),
      );

      return {
        session: {
          id: session.id,
          title: session.title,
          type: session.type,
          status: session.status,
          meetingDate: session.meetingDate,
          secondCallDate: session.secondCallDate,
          meetingLocation:
            session.meetingLocation ?? "Jardines del Turia · Valencia",
          closesAt: session.closesAt,
          items: session.items ?? [],
        },
        communityName: "Jardines del Turia",
        communityAddress: "C/ Poeta Querol, 8 · Valencia",
        totalOwners: owners.length,
        presentCount: presentOwners.length,
        absentCount: owners.length - presentOwners.length,
        participationPct,
        missingForQuorumPct,
        quorumMinimumPct,
        quorumReached: participationPct >= quorumMinimumPct,
        owners,
      };
    }),

  // ── Toggle Owner Presence Checkbox ────────────────────────────────────────
  setPresence: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        sessionId: z.string().uuid(),
        memberId: z.string().min(1),
        present: z.boolean(),
        checkInMethod: z.enum(["MANUAL", "QR"]).optional().default("MANUAL"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureMeetingTables(ctx.db, input.tenantId);

      const existing = await ctx.db.query.meetingAttendance.findFirst({
        where: and(
          eq(meetingAttendance.sessionId, input.sessionId),
          eq(meetingAttendance.memberId, input.memberId),
        ),
      });

      const seedOwner = DEMO_OWNERS_SEED.find(
        (o) => o.memberId === input.memberId,
      );

      if (existing) {
        const nextStatus = input.present
          ? existing.repName
            ? "REPRESENTED"
            : "PRESENT"
          : "ABSENT";
        await ctx.db
          .update(meetingAttendance)
          .set({
            present: input.present,
            status: nextStatus,
            checkInMethod: input.checkInMethod,
            updatedAt: new Date(),
          })
          .where(eq(meetingAttendance.id, existing.id));
      } else {
        await ctx.db.insert(meetingAttendance).values({
          sessionId: input.sessionId,
          memberId: input.memberId,
          userId: seedOwner?.id ?? input.memberId,
          present: input.present,
          status: input.present ? "PRESENT" : "ABSENT",
          coefficient: seedOwner?.coefficient ?? 4.5,
          checkInMethod: input.checkInMethod,
        });
      }

      try {
        await emitWebSocketEvent(input.tenantId, "attendance-updated", {
          sessionId: input.sessionId,
          memberId: input.memberId,
          present: input.present,
        });
      } catch {
        // non-fatal
      }

      return { ok: true, memberId: input.memberId, present: input.present };
    }),

  // ── Save Representative for an Owner ──────────────────────────────────────
  saveRepresentative: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        sessionId: z.string().uuid(),
        memberId: z.string().min(1),
        repName: z.string().min(1, "Introduce el nombre y apellidos"),
        repDocId: z.string().min(1, "Introduce el DNI o CIF"),
        repPhone: z.string().optional(),
        repEmail: z.string().optional(),
        repDocVerified: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureMeetingTables(ctx.db, input.tenantId);

      const existing = await ctx.db.query.meetingAttendance.findFirst({
        where: and(
          eq(meetingAttendance.sessionId, input.sessionId),
          eq(meetingAttendance.memberId, input.memberId),
        ),
      });

      const seedOwner = DEMO_OWNERS_SEED.find(
        (o) => o.memberId === input.memberId,
      );

      if (existing) {
        await ctx.db
          .update(meetingAttendance)
          .set({
            present: true,
            status: "REPRESENTED",
            repName: input.repName.trim(),
            repDocId: input.repDocId.trim().toUpperCase(),
            repPhone: input.repPhone?.trim() || null,
            repEmail: input.repEmail?.trim() || null,
            repDocVerified: input.repDocVerified,
            updatedAt: new Date(),
          })
          .where(eq(meetingAttendance.id, existing.id));
      } else {
        await ctx.db.insert(meetingAttendance).values({
          sessionId: input.sessionId,
          memberId: input.memberId,
          userId: seedOwner?.id ?? input.memberId,
          present: true,
          status: "REPRESENTED",
          coefficient: seedOwner?.coefficient ?? 4.5,
          repName: input.repName.trim(),
          repDocId: input.repDocId.trim().toUpperCase(),
          repPhone: input.repPhone?.trim() || null,
          repEmail: input.repEmail?.trim() || null,
          repDocVerified: input.repDocVerified,
          checkInMethod: "MANUAL",
        });
      }

      try {
        await emitWebSocketEvent(input.tenantId, "attendance-updated", {
          sessionId: input.sessionId,
          memberId: input.memberId,
          present: true,
          status: "REPRESENTED",
        });
      } catch {
        // non-fatal
      }

      return { ok: true, memberId: input.memberId };
    }),
});
