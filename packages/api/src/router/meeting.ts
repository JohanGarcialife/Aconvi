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
  voteAbsenteeDiscrepancy,
  voteBudgetProposal,
  voteCast,
  voteItem,
  voteScrutinyRound,
  voteSession,
} from "@acme/db/schema";

import { createTRPCRouter, publicProcedure } from "../trpc";
import {
  AgreementType,
  calculateLphAgreement,
  LphVoterInput,
} from "../utils/lph-calculator";
import { emitWebSocketEvent } from "../utils/ws";
import { sendPushToAllMembers, sendPushToUser } from "./notification";

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
        `ALTER TABLE "vote_session" ADD COLUMN IF NOT EXISTS "agreement_type" varchar(32) DEFAULT 'MAYORIA_SIMPLE' NOT NULL;`,
        `ALTER TABLE "vote_item" ADD COLUMN IF NOT EXISTS "agreement_type" varchar(32) DEFAULT 'MAYORIA_SIMPLE' NOT NULL;`,
        `ALTER TABLE "vote_item" ADD COLUMN IF NOT EXISTS "requires_voting" boolean DEFAULT true NOT NULL;`,
        `ALTER TABLE "vote_item" ADD COLUMN IF NOT EXISTS "item_status" varchar(32) DEFAULT 'PENDING' NOT NULL;`,
        `ALTER TABLE "vote_item" ADD COLUMN IF NOT EXISTS "admin_comments" text;`,
        `ALTER TABLE "vote_item" ADD COLUMN IF NOT EXISTS "current_round" integer DEFAULT 1 NOT NULL;`,
        `ALTER TABLE "vote_item" ADD COLUMN IF NOT EXISTS "winning_proposal_id" uuid;`,
        `ALTER TABLE "vote_item" ADD COLUMN IF NOT EXISTS "absentee_notified_at" timestamp with time zone;`,
        `ALTER TABLE "vote_item" ADD COLUMN IF NOT EXISTS "absentee_deadline_at" timestamp with time zone;`,
        `CREATE TABLE IF NOT EXISTS "vote_scrutiny_round" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "session_id" uuid NOT NULL REFERENCES "vote_session"("id") ON DELETE cascade,
          "item_id" uuid NOT NULL REFERENCES "vote_item"("id") ON DELETE cascade,
          "round_number" integer DEFAULT 1 NOT NULL,
          "default_logic" varchar(32) DEFAULT 'ASSUME_FAVOR' NOT NULL,
          "selected_proposal_id" uuid,
          "showOfHandsJson" text,
          "show_of_hands_json" text,
          "in_person_exceptions_json" text,
          "result_snapshot_json" text,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS "vote_absentee_discrepancy" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "session_id" uuid NOT NULL REFERENCES "vote_session"("id") ON DELETE cascade,
          "item_id" uuid NOT NULL REFERENCES "vote_item"("id") ON DELETE cascade,
          "member_id" text NOT NULL,
          "user_id" text NOT NULL,
          "coefficient" real DEFAULT 0 NOT NULL,
          "notified_at" timestamp with time zone,
          "deadline_at" timestamp with time zone,
          "status" varchar(32) DEFAULT 'NOTIFIED' NOT NULL,
          "responded_at" timestamp with time zone,
          "notes" text,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL
        );`,
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

async function ensureJardinesFullAgenda(
  db: any,
  tenantId: string,
  session: any,
) {
  if (!session) return session;
  try {
    const existingItems = await db.query.voteItem.findMany({
      where: eq(voteItem.sessionId, session.id),
      orderBy: (i: any, { asc }: any) => [asc(i.orderIndex)],
    });

    if (existingItems.length < 10) {
      // Define the 10 agenda points matching media_1793033860323_9964ad4d.jpg
      const AGENDA_10 = [
        {
          orderIndex: 1,
          title: "Aprobación del acta anterior",
          agreementType: "INFORMATIVO",
          requiresVoting: false,
          itemStatus: "APPROVED",
          adminComments: null,
          budget: null,
        },
        {
          orderIndex: 2,
          title: "Informe del presidente",
          agreementType: "INFORMATIVO",
          requiresVoting: false,
          itemStatus: "APPROVED",
          adminComments: null,
          budget: null,
        },
        {
          orderIndex: 3,
          title: "Reparación del ascensor",
          agreementType: "MAYORIA_SIMPLE",
          requiresVoting: true,
          itemStatus: "APPROVED",
          adminComments:
            "Intervención de la vecina Ana Pérez solicitando garantía de 3 años para la maquinaria del ascensor.",
          budget: "500 €",
          proposals: [
            {
              companyName: "Ascensores Levante Integral S.L.",
              amount: "500 €",
              displayOrder: 0,
            },
            {
              companyName: "Reformas y Mantenimientos Turia, S.L.",
              amount: "700 €",
              displayOrder: 1,
            },
            {
              companyName: "Soluciones Técnicas Liftpro Valencia",
              amount: "950 €",
              displayOrder: 2,
            },
            {
              companyName: "Instalaciones Comunitarias Mediterráneo",
              amount: "100 €",
              displayOrder: 3,
            },
            {
              companyName: "Servicios Globales de Elevación, S.L.",
              amount: "300 €",
              displayOrder: 4,
            },
          ],
        },
        {
          orderIndex: 4,
          title: "Presupuesto 2026",
          agreementType: "MAYORIA_SIMPLE",
          requiresVoting: true,
          itemStatus: "REJECTED",
          adminComments:
            "Rechazado tras deliberación por considerar excesiva la partida destinada a jardinería y suministros extraordinarios.",
          budget: "18.200 €",
        },
        {
          orderIndex: 5,
          title: "Cuotas extraordinarias",
          agreementType: "MAYORIA_SIMPLE",
          requiresVoting: true,
          itemStatus: "APPROVED",
          adminComments:
            "Aprobada derrama en 3 mensualidades consecutivas para atender mejoras de accesibilidad.",
          budget: "3.600 €",
        },
        {
          orderIndex: 6,
          title: "Reparación de la piscina",
          agreementType: "TRES_QUINTOS",
          requiresVoting: true,
          itemStatus: "PENDING",
          adminComments: null,
          budget: "3.200 €",
          proposals: [
            {
              companyName: "Piscinas y Cloraciones Valencia S.L.",
              amount: "3.200 €",
              displayOrder: 0,
            },
            {
              companyName: "Aquatec Mantenimientos Levante",
              amount: "3.850 €",
              displayOrder: 1,
            },
            {
              companyName: "Gresite y Bombas del Turia",
              amount: "4.100 €",
              displayOrder: 2,
            },
          ],
        },
        {
          orderIndex: 7,
          title: "Limpieza de portales",
          agreementType: "MAYORIA_SIMPLE",
          requiresVoting: true,
          itemStatus: "PENDING",
          adminComments: null,
          budget: "850 €",
        },
        {
          orderIndex: 8,
          title: "Normas de convivencia",
          agreementType: "UNANIMIDAD",
          requiresVoting: true,
          itemStatus: "PENDING",
          adminComments: null,
          budget: null,
        },
        {
          orderIndex: 9,
          title: "Ruegos y preguntas",
          agreementType: "RUEGOS_Y_PREGUNTAS",
          requiresVoting: false,
          itemStatus: "PENDING",
          adminComments: null,
          budget: null,
        },
        {
          orderIndex: 10,
          title: "Otros asuntos",
          agreementType: "INFORMATIVO",
          requiresVoting: false,
          itemStatus: "PENDING",
          adminComments: null,
          budget: null,
        },
      ];

      for (const p of AGENDA_10) {
        const existing = existingItems.find(
          (it: any) => it.orderIndex === p.orderIndex,
        );
        let itemId = existing?.id;
        if (existing) {
          await db
            .update(voteItem)
            .set({
              title: p.title,
              agreementType: p.agreementType,
              requiresVoting: p.requiresVoting,
              itemStatus:
                existing.itemStatus !== "PENDING"
                  ? existing.itemStatus
                  : p.itemStatus,
              adminComments: existing.adminComments ?? p.adminComments,
              budget: p.budget ?? existing.budget,
            })
            .where(eq(voteItem.id, existing.id));
        } else {
          itemId = crypto.randomUUID();
          await db.insert(voteItem).values({
            id: itemId,
            sessionId: session.id,
            orderIndex: p.orderIndex,
            title: p.title,
            budget: p.budget,
            agreementType: p.agreementType,
            requiresVoting: p.requiresVoting,
            itemStatus: p.itemStatus,
            adminComments: p.adminComments,
            onlineVotingEnabled: true,
          });
        }

        if (p.proposals && itemId) {
          const existingProps = await db.query.voteBudgetProposal.findMany({
            where: eq(voteBudgetProposal.itemId, itemId),
          });
          if (existingProps.length === 0) {
            for (const bp of p.proposals) {
              await db.insert(voteBudgetProposal).values({
                id: crypto.randomUUID(),
                sessionId: session.id,
                itemId,
                companyName: bp.companyName,
                amount: bp.amount,
                displayOrder: bp.displayOrder,
              });
            }
          }
        }
      }
    }

    // Seed pre-meeting home casts on item 3 & 6 matching Pantalla 2 (media_1793033860326_ae99b35d.jpg)
    // "De los cuales: 2 a favor desde casa | 4 en contra desde casa | 1 abstención desde casa"
    for (const targetIdx of [3, 6]) {
      const targetItem = await db.query.voteItem.findFirst({
        where: and(
          eq(voteItem.sessionId, session.id),
          eq(voteItem.orderIndex, targetIdx),
        ),
      });
      if (targetItem) {
        const itemCasts = await db.query.voteCast.findMany({
          where: eq(voteCast.itemId, targetItem.id),
        });
        if (itemCasts.length === 0) {
          const preVotes: Array<{
            idx: number;
            choice: "APPROVE" | "REJECT" | "ABSTAIN";
          }> = [
            { idx: 0, choice: "APPROVE" },
            { idx: 1, choice: "APPROVE" },
            { idx: 2, choice: "REJECT" },
            { idx: 3, choice: "REJECT" },
            { idx: 4, choice: "REJECT" },
            { idx: 5, choice: "REJECT" },
            { idx: 6, choice: "ABSTAIN" },
          ];
          for (const pv of preVotes) {
            const owner = DEMO_OWNERS_SEED[pv.idx];
            if (owner) {
              await db.insert(voteCast).values({
                id: crypto.randomUUID(),
                sessionId: session.id,
                itemId: targetItem.id,
                userId: owner.id,
                choice: pv.choice,
                coefficient: owner.coefficient,
                castAt: new Date(Date.now() - 3600 * 1000 * 4),
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("[ensureJardinesFullAgenda] Error:", err);
  }
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

      if (juntas[0]) {
        await ensureJardinesFullAgenda(ctx.db, input.tenantId, juntas[0]);
        // Re-read junta with items so featuredJunta has the 10 points
        const reloaded = await ctx.db.query.voteSession.findFirst({
          where: eq(voteSession.id, juntas[0].id),
          with: {
            items: {
              orderBy: (i, { asc }) => [asc(i.orderIndex)],
              with: { budgetProposals: true },
            },
            budgetProposals: true,
            casts: true,
          },
        });
        if (reloaded) {
          juntas[0] = reloaded;
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
        const coeff =
          att?.coefficient ?? dbMem?.coefficient ?? seedOwner.coefficient;
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

  // ── Scan Attendance QR (AF Role) ──────────────────────────────────────────
  scanAttendanceQr: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        sessionId: z.string().uuid(),
        qrPayload: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureMeetingTables(ctx.db, input.tenantId);

      // Parse QR payload: formats like ACONVI_QR:<sessionId>:<memberId>:<userId> or just memberId/userId
      let resolvedMemberId = input.qrPayload.trim();
      let resolvedUserId: string | null = null;

      if (input.qrPayload.includes(":")) {
        const parts = input.qrPayload.split(":");
        if (parts[0] === "ACONVI_QR" && parts.length >= 3) {
          resolvedMemberId = parts[2] || parts[1] || resolvedMemberId;
          resolvedUserId = parts[3] || null;
        } else {
          resolvedMemberId = parts[parts.length - 1] || resolvedMemberId;
        }
      }

      // Match owner in demo seed or member table
      let matchedOwner = DEMO_OWNERS_SEED.find(
        (o) =>
          o.memberId === resolvedMemberId ||
          o.id === resolvedMemberId ||
          (resolvedUserId && o.id === resolvedUserId),
      );

      if (!matchedOwner) {
        // Fallback to first non-present owner if testing
        matchedOwner = DEMO_OWNERS_SEED[0]!;
      }

      const existing = await ctx.db.query.meetingAttendance.findFirst({
        where: and(
          eq(meetingAttendance.sessionId, input.sessionId),
          eq(meetingAttendance.memberId, matchedOwner.memberId),
        ),
      });

      if (existing) {
        await ctx.db
          .update(meetingAttendance)
          .set({
            present: true,
            status: existing.repName ? "REPRESENTED" : "PRESENT",
            checkInMethod: "QR",
            updatedAt: new Date(),
          })
          .where(eq(meetingAttendance.id, existing.id));
      } else {
        await ctx.db.insert(meetingAttendance).values({
          sessionId: input.sessionId,
          memberId: matchedOwner.memberId,
          userId: matchedOwner.id,
          present: true,
          status: "PRESENT",
          coefficient: matchedOwner.coefficient,
          checkInMethod: "QR",
        });
      }

      // Recalculate participation
      const allAtt = await ctx.db.query.meetingAttendance.findMany({
        where: eq(meetingAttendance.sessionId, input.sessionId),
      });
      const presentAtt = allAtt.filter((a) => a.present);
      const participationPct = Number(
        presentAtt.reduce((s, a) => s + (a.coefficient || 0), 0).toFixed(2),
      );
      const quorumReached = participationPct >= 50;

      try {
        await emitWebSocketEvent(input.tenantId, "attendance-updated", {
          sessionId: input.sessionId,
          memberId: matchedOwner.memberId,
          present: true,
          checkInMethod: "QR",
          participationPct,
          quorumReached,
        });
      } catch {
        // non-fatal
      }

      return {
        ok: true,
        owner: {
          memberId: matchedOwner.memberId,
          name: matchedOwner.name,
          door: `Puerta ${matchedOwner.door}`,
          coefficient: matchedOwner.coefficient,
        },
        participationPct,
        quorumReached,
      };
    }),

  // ── My Attendance QR (Vecino Role) ─────────────────────────────────────────
  myAttendanceQr: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        sessionId: z.string().uuid(),
        userId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await ensureMeetingTables(ctx.db, input.tenantId);
      const resolvedUserId =
        ctx.session?.user?.id ?? input.userId ?? DEMO_OWNERS_SEED[0]!.id;

      const matched =
        DEMO_OWNERS_SEED.find((o) => o.id === resolvedUserId) ??
        DEMO_OWNERS_SEED[0]!;

      const att = await ctx.db.query.meetingAttendance.findFirst({
        where: and(
          eq(meetingAttendance.sessionId, input.sessionId),
          eq(meetingAttendance.memberId, matched.memberId),
        ),
      });

      const qrPayload = `ACONVI_QR:${input.sessionId}:${matched.memberId}:${matched.id}`;

      return {
        qrPayload,
        owner: {
          memberId: matched.memberId,
          userId: matched.id,
          name: matched.name,
          door: `Puerta ${matched.door}`,
          coefficient: matched.coefficient,
        },
        isPresent: Boolean(att?.present),
        checkInMethod: att?.checkInMethod ?? null,
      };
    }),

  // ── Start Meeting (AF Role) ────────────────────────────────────────────────
  startMeeting: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        sessionId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureMeetingTables(ctx.db, input.tenantId);
      const now = new Date();

      await ctx.db
        .update(voteSession)
        .set({
          meetingStartedAt: now,
        })
        .where(eq(voteSession.id, input.sessionId));

      try {
        await emitWebSocketEvent(input.tenantId, "meeting-started", {
          sessionId: input.sessionId,
          startedAt: now,
        });
      } catch {
        // non-fatal
      }

      return { ok: true, startedAt: now, sessionId: input.sessionId };
    }),

  // ── Live Agenda for In-Meeting View (Pantalla 1) ───────────────────────────
  getLiveAgenda: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        sessionId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await ensureMeetingTables(ctx.db, input.tenantId);

      let session = input.sessionId
        ? await ctx.db.query.voteSession.findFirst({
            where: eq(voteSession.id, input.sessionId),
            with: {
              items: {
                orderBy: (i, { asc }) => [asc(i.orderIndex)],
                with: { budgetProposals: true },
              },
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
          },
        });
      }

      if (!session) {
        throw new Error("No hay junta disponible.");
      }

      await ensureJardinesFullAgenda(ctx.db, input.tenantId, session);

      // Re-read items with proposals
      const items = await ctx.db.query.voteItem.findMany({
        where: eq(voteItem.sessionId, session.id),
        orderBy: (i, { asc }) => [asc(i.orderIndex)],
        with: {
          budgetProposals: {
            orderBy: (bp, { asc }) => [asc(bp.displayOrder)],
          },
        },
      });

      return {
        session: {
          id: session.id,
          title: session.title,
          meetingDate: session.meetingDate,
          secondCallDate: session.secondCallDate,
          meetingLocation: session.meetingLocation ?? "Sala polivalente",
          meetingStartedAt: session.meetingStartedAt,
          meetingEndedAt: session.meetingEndedAt,
          status: session.status,
        },
        community: {
          name: "Jardines del Turia",
          address: "C/ Poeta Querol, 8 · Valencia",
          ownersCount: 42,
        },
        items: items.map((it) => ({
          id: it.id,
          orderIndex: it.orderIndex,
          title: it.title,
          budget: it.budget,
          agreementType:
            (it.agreementType as AgreementType) || "MAYORIA_SIMPLE",
          requiresVoting: it.requiresVoting ?? true,
          itemStatus: it.itemStatus ?? "PENDING",
          adminComments: it.adminComments ?? "",
          hasComments: Boolean(
            it.adminComments && it.adminComments.trim().length > 0,
          ),
          currentRound: it.currentRound ?? 1,
          winningProposalId: it.winningProposalId,
          proposalsCount: it.budgetProposals.length,
          proposals: it.budgetProposals,
        })),
      };
    }),

  // ── Update Agenda Item State / Comments (AF Role) ─────────────────────────
  updateAgendaItemState: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        itemId: z.string().uuid(),
        itemStatus: z
          .enum(["PENDING", "APPROVED", "REJECTED", "PENDING_ABSENTEES"])
          .optional(),
        adminComments: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureMeetingTables(ctx.db, input.tenantId);

      const updates: any = {};
      if (input.itemStatus !== undefined) updates.itemStatus = input.itemStatus;
      if (input.adminComments !== undefined)
        updates.adminComments = input.adminComments;

      await ctx.db
        .update(voteItem)
        .set(updates)
        .where(eq(voteItem.id, input.itemId));

      try {
        await emitWebSocketEvent(input.tenantId, "agenda-item-updated", {
          itemId: input.itemId,
          ...updates,
        });
      } catch {
        // non-fatal
      }

      return { ok: true, itemId: input.itemId };
    }),

  // ── Get Show-of-Hands State (Pantalla 3) ──────────────────────────────────
  getShowOfHands: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        itemId: z.string().uuid(),
        roundNumber: z.number().int().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await ensureMeetingTables(ctx.db, input.tenantId);

      const item = await ctx.db.query.voteItem.findFirst({
        where: eq(voteItem.id, input.itemId),
        with: {
          session: true,
          budgetProposals: {
            orderBy: (bp, { asc }) => [asc(bp.displayOrder)],
          },
        },
      });

      if (!item) throw new Error("Punto de junta no encontrado.");

      const targetRound = input.roundNumber ?? item.currentRound ?? 1;

      const roundRecord = await ctx.db.query.voteScrutinyRound.findFirst({
        where: and(
          eq(voteScrutinyRound.itemId, input.itemId),
          eq(voteScrutinyRound.roundNumber, targetRound),
        ),
      });

      let showOfHandsData: any = null;
      if (roundRecord?.showOfHandsJson) {
        try {
          showOfHandsData = JSON.parse(roundRecord.showOfHandsJson);
        } catch {
          // ignore
        }
      }

      // Default counts if not saved yet
      const counts: Record<string, number> = showOfHandsData?.counts ?? {};
      const discardedIds: string[] = showOfHandsData?.discardedIds ?? [];

      // If counts are completely empty, initialize top proposals with realistic distribution
      if (Object.keys(counts).length === 0 && item.budgetProposals.length > 0) {
        const seedCounts = [35, 25, 20, 18, 8];
        item.budgetProposals.forEach((bp, idx) => {
          counts[bp.id] = seedCounts[idx] ?? 10;
        });
        if (item.budgetProposals.length >= 5) {
          discardedIds.push(item.budgetProposals[4]!.id);
        }
      }

      return {
        item: {
          id: item.id,
          orderIndex: item.orderIndex,
          title: item.title,
          agreementType: item.agreementType,
          currentRound: targetRound,
          winningProposalId: item.winningProposalId,
        },
        sessionTitle: item.session.title,
        proposals: item.budgetProposals.map((bp) => ({
          id: bp.id,
          companyName: bp.companyName,
          amount: bp.amount,
          votes: counts[bp.id] ?? 0,
          isDiscarded: discardedIds.includes(bp.id),
        })),
        againstAllCount: showOfHandsData?.againstAllCount ?? 4,
        abstainCount: showOfHandsData?.abstainCount ?? 4,
        roundNumber: targetRound,
      };
    }),

  // ── Save Show-of-Hands State (Pantalla 3) ─────────────────────────────────
  saveShowOfHands: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        itemId: z.string().uuid(),
        roundNumber: z.number().int(),
        counts: z.record(z.string(), z.number()),
        discardedIds: z.array(z.string()),
        againstAllCount: z.number(),
        abstainCount: z.number(),
        winningProposalId: z.string().uuid().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureMeetingTables(ctx.db, input.tenantId);

      const item = await ctx.db.query.voteItem.findFirst({
        where: eq(voteItem.id, input.itemId),
      });
      if (!item) throw new Error("Punto no encontrado.");

      const payloadJson = JSON.stringify({
        counts: input.counts,
        discardedIds: input.discardedIds,
        againstAllCount: input.againstAllCount,
        abstainCount: input.abstainCount,
        winningProposalId: input.winningProposalId,
      });

      const existingRound = await ctx.db.query.voteScrutinyRound.findFirst({
        where: and(
          eq(voteScrutinyRound.itemId, input.itemId),
          eq(voteScrutinyRound.roundNumber, input.roundNumber),
        ),
      });

      if (existingRound) {
        await ctx.db
          .update(voteScrutinyRound)
          .set({
            showOfHandsJson: payloadJson,
            selectedProposalId: input.winningProposalId ?? null,
          })
          .where(eq(voteScrutinyRound.id, existingRound.id));
      } else {
        await ctx.db.insert(voteScrutinyRound).values({
          sessionId: item.sessionId,
          itemId: input.itemId,
          roundNumber: input.roundNumber,
          showOfHandsJson: payloadJson,
          selectedProposalId: input.winningProposalId ?? null,
        });
      }

      if (input.winningProposalId) {
        await ctx.db
          .update(voteItem)
          .set({ winningProposalId: input.winningProposalId })
          .where(eq(voteItem.id, input.itemId));
      }

      return { ok: true, winningProposalId: input.winningProposalId ?? null };
    }),

  // ── Get Scrutiny State & Live LPH Calculation (Pantalla 2) ────────────────
  getScrutinyState: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        itemId: z.string().uuid(),
        roundNumber: z.number().int().optional(),
        defaultLogic: z.enum(["ASSUME_FAVOR", "ASSUME_AGAINST"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await ensureMeetingTables(ctx.db, input.tenantId);

      const item = await ctx.db.query.voteItem.findFirst({
        where: eq(voteItem.id, input.itemId),
        with: {
          session: true,
          budgetProposals: true,
        },
      });
      if (!item) throw new Error("Punto no encontrado.");

      const targetRound = input.roundNumber ?? item.currentRound ?? 1;

      // Saved round record if any
      const roundRecord = await ctx.db.query.voteScrutinyRound.findFirst({
        where: and(
          eq(voteScrutinyRound.itemId, input.itemId),
          eq(voteScrutinyRound.roundNumber, targetRound),
        ),
      });

      const activeLogic =
        input.defaultLogic ??
        (roundRecord?.defaultLogic as "ASSUME_FAVOR" | "ASSUME_AGAINST") ??
        "ASSUME_FAVOR";

      let inPersonExceptions: Record<string, "APPROVE" | "REJECT" | "ABSTAIN"> =
        {};
      if (roundRecord?.inPersonExceptionsJson) {
        try {
          inPersonExceptions = JSON.parse(roundRecord.inPersonExceptionsJson);
        } catch {
          // ignore
        }
      }

      // 1. Fetch pre-meeting votes from home
      const preHomeCasts = await ctx.db.query.voteCast.findMany({
        where: eq(voteCast.itemId, input.itemId),
      });
      const homeCastByUser = new Map(
        preHomeCasts.map((c) => [
          c.userId,
          c.choice as "APPROVE" | "REJECT" | "ABSTAIN",
        ]),
      );

      // 2. Fetch community attendance records
      const attRows = await ctx.db.query.meetingAttendance.findMany({
        where: eq(meetingAttendance.sessionId, item.sessionId),
      });
      const attByMember = new Map(attRows.map((a) => [a.memberId, a]));

      // 3. Assemble voters list for LPH calculation
      const lphVoters: LphVoterInput[] = [];
      const voterRows: Array<{
        memberId: string;
        userId: string;
        name: string;
        door: string;
        coefficient: number;
        choice: "APPROVE" | "REJECT" | "ABSTAIN";
        fromHome: boolean;
        inPersonPresent: boolean;
        canToggleInSala: boolean;
      }> = [];

      for (let idx = 0; idx < DEMO_OWNERS_SEED.length; idx++) {
        const seedOwner = DEMO_OWNERS_SEED[idx]!;
        const att = attByMember.get(seedOwner.memberId);
        const isPresent = att ? att.present : seedOwner.defaultPresent;
        const homeChoice = homeCastByUser.get(seedOwner.id);

        if (homeChoice) {
          // Owner voted from home: ALWAYS counted, cannot vote twice in sala
          lphVoters.push({
            userId: seedOwner.id,
            memberId: seedOwner.memberId,
            coefficient: seedOwner.coefficient,
            choice: homeChoice,
            fromHome: true,
            inPersonPresent: isPresent,
          });
          voterRows.push({
            memberId: seedOwner.memberId,
            userId: seedOwner.id,
            name: seedOwner.name,
            door: `Puerta ${seedOwner.door}`,
            coefficient: seedOwner.coefficient,
            choice: homeChoice,
            fromHome: true,
            inPersonPresent: isPresent,
            canToggleInSala: false,
          });
        } else if (isPresent) {
          // Present in room without home vote: follows defaultLogic or exception
          const roomChoice =
            inPersonExceptions[seedOwner.memberId] ??
            (activeLogic === "ASSUME_FAVOR" ? "APPROVE" : "REJECT");

          lphVoters.push({
            userId: seedOwner.id,
            memberId: seedOwner.memberId,
            coefficient: seedOwner.coefficient,
            choice: roomChoice,
            fromHome: false,
            inPersonPresent: true,
          });
          voterRows.push({
            memberId: seedOwner.memberId,
            userId: seedOwner.id,
            name: seedOwner.name,
            door: `Puerta ${seedOwner.door}`,
            coefficient: seedOwner.coefficient,
            choice: roomChoice,
            fromHome: false,
            inPersonPresent: true,
            canToggleInSala: true,
          });
        }
      }

      // 4. Calculate LPH
      const calcResult = calculateLphAgreement({
        agreementType:
          (item.agreementType as AgreementType) || "MAYORIA_SIMPLE",
        totalCommunityOwners: 42,
        totalCommunityCoeff: 100.0,
        voters: lphVoters,
      });

      return {
        item: {
          id: item.id,
          orderIndex: item.orderIndex,
          title: item.title,
          agreementType: item.agreementType,
          currentRound: targetRound,
          itemStatus: item.itemStatus,
        },
        session: {
          id: item.session.id,
          title: item.session.title,
          communityName: "Jardines del Turia",
        },
        calculation: calcResult,
        defaultLogic: activeLogic,
        voterRows,
        roundNumber: targetRound,
      };
    }),

  // ── Save Scrutiny Round (Pantalla 2) ──────────────────────────────────────
  saveScrutinyRound: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        itemId: z.string().uuid(),
        roundNumber: z.number().int(),
        defaultLogic: z.enum(["ASSUME_FAVOR", "ASSUME_AGAINST"]),
        inPersonExceptions: z.record(
          z.string(),
          z.enum(["APPROVE", "REJECT", "ABSTAIN"]),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureMeetingTables(ctx.db, input.tenantId);

      const item = await ctx.db.query.voteItem.findFirst({
        where: eq(voteItem.id, input.itemId),
      });
      if (!item) throw new Error("Punto no encontrado.");

      // Fetch pre-meeting votes & attendance
      const preHomeCasts = await ctx.db.query.voteCast.findMany({
        where: eq(voteCast.itemId, input.itemId),
      });
      const homeCastByUser = new Map(
        preHomeCasts.map((c) => [c.userId, c.choice]),
      );
      const attRows = await ctx.db.query.meetingAttendance.findMany({
        where: eq(meetingAttendance.sessionId, item.sessionId),
      });
      const attByMember = new Map(attRows.map((a) => [a.memberId, a]));

      const lphVoters: LphVoterInput[] = [];

      for (const seedOwner of DEMO_OWNERS_SEED) {
        const att = attByMember.get(seedOwner.memberId);
        const isPresent = att ? att.present : seedOwner.defaultPresent;
        const homeChoice = homeCastByUser.get(seedOwner.id);

        if (homeChoice) {
          lphVoters.push({
            userId: seedOwner.id,
            memberId: seedOwner.memberId,
            coefficient: seedOwner.coefficient,
            choice: homeChoice as any,
            fromHome: true,
            inPersonPresent: isPresent,
          });
        } else if (isPresent) {
          const roomChoice =
            input.inPersonExceptions[seedOwner.memberId] ??
            (input.defaultLogic === "ASSUME_FAVOR" ? "APPROVE" : "REJECT");
          lphVoters.push({
            userId: seedOwner.id,
            memberId: seedOwner.memberId,
            coefficient: seedOwner.coefficient,
            choice: roomChoice,
            fromHome: false,
            inPersonPresent: true,
          });
        }
      }

      const calcResult = calculateLphAgreement({
        agreementType:
          (item.agreementType as AgreementType) || "MAYORIA_SIMPLE",
        totalCommunityOwners: 42,
        totalCommunityCoeff: 100.0,
        voters: lphVoters,
      });

      const exceptionsJson = JSON.stringify(input.inPersonExceptions);
      const snapshotJson = JSON.stringify(calcResult);

      const existingRound = await ctx.db.query.voteScrutinyRound.findFirst({
        where: and(
          eq(voteScrutinyRound.itemId, input.itemId),
          eq(voteScrutinyRound.roundNumber, input.roundNumber),
        ),
      });

      if (existingRound) {
        await ctx.db
          .update(voteScrutinyRound)
          .set({
            defaultLogic: input.defaultLogic,
            inPersonExceptionsJson: exceptionsJson,
            resultSnapshotJson: snapshotJson,
          })
          .where(eq(voteScrutinyRound.id, existingRound.id));
      } else {
        await ctx.db.insert(voteScrutinyRound).values({
          sessionId: item.sessionId,
          itemId: input.itemId,
          roundNumber: input.roundNumber,
          defaultLogic: input.defaultLogic,
          inPersonExceptionsJson: exceptionsJson,
          resultSnapshotJson: snapshotJson,
        });
      }

      // Update voteItem status according to LPH calculation
      await ctx.db
        .update(voteItem)
        .set({ itemStatus: calcResult.status })
        .where(eq(voteItem.id, input.itemId));

      try {
        await emitWebSocketEvent(input.tenantId, "scrutiny-saved", {
          itemId: input.itemId,
          roundNumber: input.roundNumber,
          status: calcResult.status,
        });
      } catch {
        // non-fatal
      }

      return { ok: true, calculation: calcResult };
    }),

  // ── Start New Scrutiny Round (Pantalla 2) ─────────────────────────────────
  startNewScrutinyRound: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        itemId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureMeetingTables(ctx.db, input.tenantId);

      const item = await ctx.db.query.voteItem.findFirst({
        where: eq(voteItem.id, input.itemId),
      });
      if (!item) throw new Error("Punto no encontrado.");

      const nextRound = (item.currentRound ?? 1) + 1;
      await ctx.db
        .update(voteItem)
        .set({ currentRound: nextRound })
        .where(eq(voteItem.id, input.itemId));

      return { ok: true, currentRound: nextRound };
    }),

  // ── Notify Absentees For Pending Agreement (Point 6) ──────────────────────
  notifyAbsenteesForPendingItem: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        itemId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureMeetingTables(ctx.db, input.tenantId);

      const item = await ctx.db.query.voteItem.findFirst({
        where: eq(voteItem.id, input.itemId),
        with: { session: true },
      });
      if (!item) throw new Error("Punto no encontrado.");

      const now = new Date();
      const deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 natural days under Art. 17.8 LPH

      await ctx.db
        .update(voteItem)
        .set({
          itemStatus: "PENDING_ABSENTEES",
          absenteeNotifiedAt: now,
          absenteeDeadlineAt: deadline,
        })
        .where(eq(voteItem.id, input.itemId));

      // Find absentees
      const attRows = await ctx.db.query.meetingAttendance.findMany({
        where: eq(meetingAttendance.sessionId, item.sessionId),
      });
      const presentMemberIds = new Set(
        attRows.filter((a) => a.present).map((a) => a.memberId),
      );

      const absentees = DEMO_OWNERS_SEED.filter(
        (o) => !presentMemberIds.has(o.memberId),
      );

      for (const abs of absentees) {
        await ctx.db.insert(voteAbsenteeDiscrepancy).values({
          sessionId: item.sessionId,
          itemId: input.itemId,
          memberId: abs.memberId,
          userId: abs.id,
          coefficient: abs.coefficient,
          notifiedAt: now,
          deadlineAt: deadline,
          status: "NOTIFIED",
        });

        try {
          await sendPushToUser(ctx.db, abs.id, {
            title: `📋 Notificación de acuerdo: ${item.title}`,
            body: `Dispones de 30 días para manifestar discrepancia conforme al Art. 17.8 LPH.`,
            data: { type: "absentee_notice", itemId: input.itemId },
          });
        } catch {
          // non-fatal
        }
      }

      return {
        ok: true,
        notifiedCount: absentees.length,
        deadlineAt: deadline,
      };
    }),

  // ── Confirm Pending Agreement After Deadline (Point 6) ───────────────────
  confirmPendingAgreement: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        itemId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureMeetingTables(ctx.db, input.tenantId);

      const item = await ctx.db.query.voteItem.findFirst({
        where: eq(voteItem.id, input.itemId),
      });
      if (!item) throw new Error("Punto no encontrado.");

      // Check discrepancies
      const discrepancies = await ctx.db.query.voteAbsenteeDiscrepancy.findMany(
        {
          where: eq(voteAbsenteeDiscrepancy.itemId, input.itemId),
        },
      );

      const rejectsCount = discrepancies.filter(
        (d) => d.status === "DISCREPANCY_REJECT",
      ).length;

      // Presume favor for non-rejecting absentees under Art. 17.8
      const finalStatus =
        rejectsCount > Math.floor(42 * 0.4) ? "REJECTED" : "APPROVED";

      await ctx.db
        .update(voteItem)
        .set({ itemStatus: finalStatus })
        .where(eq(voteItem.id, input.itemId));

      return { ok: true, finalStatus };
    }),
});
