import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";

import {
  fee,
  member,
  notice,
  voteBudgetProposal,
  voteCast,
  voteItem,
  voteMinute,
  voteOption,
  voteSession,
} from "@acme/db/schema";

import { createTRPCRouter, publicProcedure } from "../trpc";
import { emitWebSocketEvent } from "../utils/ws";
import { sendPushToAllMembers } from "./notification";

const DEMO_AUTHOR_ID = "00000000-0000-0000-0000-000000000000";

export const votingRouter = createTRPCRouter({
  // ── List all sessions for a community with user-specific voting status ─────────
  all: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        userId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const resolvedUserId =
        ctx.session?.user?.id ?? input.userId ?? DEMO_AUTHOR_ID;

      const sessions = await ctx.db.query.voteSession.findMany({
        where: eq(voteSession.organizationId, input.tenantId),
        with: {
          items: { orderBy: (item, { asc }) => [asc(item.orderIndex)] },
          options: { orderBy: (opt, { asc }) => [asc(opt.displayOrder)] },
          budgetProposals: { orderBy: (bp, { asc }) => [asc(bp.displayOrder)] },
          casts: true,
          author: { columns: { id: true, name: true } },
          minute: { columns: { id: true, generatedAt: true } },
        },
        orderBy: [
          desc(voteSession.priority),
          asc(voteSession.closesAt),
          desc(voteSession.createdAt),
        ],
      });

      // Check if the user has pending/overdue debts (disqualifies from voting)
      const userDebts = await ctx.db.query.fee.findMany({
        where: and(
          eq(fee.organizationId, input.tenantId),
          eq(fee.userId, resolvedUserId),
          inArray(fee.status, ["OVERDUE", "PENDING"]),
        ),
      });
      const hasDebt = userDebts.length > 0;
      const debtAmount = userDebts.reduce((sum, f) => sum + (f.amount || 0), 0);

      // Get user's coefficient and AF override status
      const memberRecord = await ctx.db.query.member.findFirst({
        where: and(
          eq(member.organizationId, input.tenantId),
          eq(member.userId, resolvedUserId),
        ),
      });
      const userCoefficient = memberRecord?.coefficient ?? 1;
      const hasOverride = Boolean(memberRecord?.votingOverride);
      const canVote = !hasDebt || hasOverride;

      return sessions.map((session) => {
        const userCasts = session.casts.filter(
          (c) => c.userId === resolvedUserId,
        );
        const hasVoted = userCasts.length > 0;

        // Auto calculate archive status (closed > 48h or archivedAt present)
        const isArchived = Boolean(
          session.archivedAt != null ||
            (session.status === "CLOSED" &&
              session.closedAt &&
              Date.now() - new Date(session.closedAt).getTime() >
                48 * 3600 * 1000),
        );

        // Result summary string for closed cards (e.g. "Aprobado por el 82 % de las cuotas")
        let resultSummary: string | null = null;
        if (session.status === "CLOSED") {
          if (session.type === "SINGLE" || !session.items.length) {
            const approveW = session.casts
              .filter((c) => c.choice === "APPROVE")
              .reduce((sum, c) => sum + c.coefficient, 0);
            const rejectW = session.casts
              .filter((c) => c.choice === "REJECT")
              .reduce((sum, c) => sum + c.coefficient, 0);
            const abstainW = session.casts
              .filter((c) => c.choice === "ABSTAIN")
              .reduce((sum, c) => sum + c.coefficient, 0);
            const totalW = approveW + rejectW + abstainW;
            if (totalW > 0) {
              const pct = Math.round((approveW / totalW) * 100);
              resultSummary =
                approveW > rejectW
                  ? `Aprobado por el ${pct} % de las cuotas`
                  : `Rechazado (${Math.round((rejectW / totalW) * 100)} % en contra)`;
            } else {
              resultSummary = "Cerrada sin votos emitidos";
            }
          } else {
            const onlineItems = session.items.filter(
              (i) => i.onlineVotingEnabled,
            );
            const relevantItems =
              onlineItems.length > 0 ? onlineItems : session.items;
            let approvedCount = 0;
            for (const item of relevantItems) {
              const itemCasts = session.casts.filter(
                (c) => c.itemId === item.id,
              );
              const app = itemCasts
                .filter((c) => c.choice === "APPROVE")
                .reduce((s, c) => s + c.coefficient, 0);
              const rej = itemCasts
                .filter((c) => c.choice === "REJECT")
                .reduce((s, c) => s + c.coefficient, 0);
              if (app > rej) approvedCount++;
            }
            resultSummary = `${approvedCount} de ${relevantItems.length} acuerdos aprobados`;
          }
        }

        return {
          ...session,
          hasVoted,
          isArchived,
          resultSummary,
          userCasts: userCasts.map((c) => ({
            itemId: c.itemId,
            choice: c.choice,
            selectedProposalId: c.selectedProposalId,
            castAt: c.castAt,
          })),
          userVotingStatus: {
            canVote,
            hasOverride,
            reason: hasDebt
              ? hasOverride
                ? "Derecho a voto habilitado excepcionalmente por el Administrador de Fincas."
                : `Tienes pagos pendientes (${debtAmount > 0 ? debtAmount.toLocaleString("es-ES") + " €" : "cuotas pendientes"}) con la comunidad y no tendrás derecho a voto. Ponte al día para poder participar en las votaciones.`
              : null,
            coefficient: userCoefficient,
          },
        };
      });
    }),

  // ── Get detailed session and results ──────────────────────────────────────────
  results: publicProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.db.query.voteSession.findFirst({
        where: eq(voteSession.id, input.sessionId),
        with: {
          items: { orderBy: (item, { asc }) => [asc(item.orderIndex)] },
          options: { orderBy: (opt, { asc }) => [asc(opt.displayOrder)] },
          budgetProposals: { orderBy: (bp, { asc }) => [asc(bp.displayOrder)] },
          casts: {
            with: { user: { columns: { id: true, name: true, email: true } } },
          },
          author: { columns: { id: true, name: true } },
          minute: true,
        },
      });
      if (!session) throw new Error("Votación no encontrada");

      const totalVotes = session.casts.length;

      // Proposals breakdown if proposals exist
      const proposalsBreakdown = session.budgetProposals.map((bp) => {
        const votesForBp = session.casts.filter(
          (c) => c.selectedProposalId === bp.id,
        );
        const weighted = votesForBp.reduce((s, c) => s + c.coefficient, 0);
        return {
          ...bp,
          voteCount: votesForBp.length,
          weighted,
        };
      });

      // Single calculation
      if (session.type === "SINGLE" || !session.items.length) {
        const approveWeighted = session.casts
          .filter((c) => c.choice === "APPROVE")
          .reduce((sum, c) => sum + c.coefficient, 0);
        const rejectWeighted = session.casts
          .filter((c) => c.choice === "REJECT")
          .reduce((sum, c) => sum + c.coefficient, 0);
        const abstainWeighted = session.casts
          .filter((c) => c.choice === "ABSTAIN")
          .reduce((sum, c) => sum + c.coefficient, 0);
        const totalWeighted =
          approveWeighted + rejectWeighted + abstainWeighted;

        return {
          ...session,
          totalVotes,
          totalWeighted,
          proposalsBreakdown,
          breakdown: {
            approve: {
              count: session.casts.filter((c) => c.choice === "APPROVE").length,
              weighted: approveWeighted,
              pct:
                totalWeighted > 0
                  ? ((approveWeighted / totalWeighted) * 100).toFixed(1)
                  : "0.0",
            },
            reject: {
              count: session.casts.filter((c) => c.choice === "REJECT").length,
              weighted: rejectWeighted,
              pct:
                totalWeighted > 0
                  ? ((rejectWeighted / totalWeighted) * 100).toFixed(1)
                  : "0.0",
            },
            abstain: {
              count: session.casts.filter((c) => c.choice === "ABSTAIN").length,
              weighted: abstainWeighted,
              pct:
                totalWeighted > 0
                  ? ((abstainWeighted / totalWeighted) * 100).toFixed(1)
                  : "0.0",
            },
          },
        };
      }

      // Junta calculation for each item
      const itemBreakdowns = session.items.map((item) => {
        const itemCasts = session.casts.filter((c) => c.itemId === item.id);
        const approveWeighted = itemCasts
          .filter((c) => c.choice === "APPROVE")
          .reduce((sum, c) => sum + c.coefficient, 0);
        const rejectWeighted = itemCasts
          .filter((c) => c.choice === "REJECT")
          .reduce((sum, c) => sum + c.coefficient, 0);
        const abstainWeighted = itemCasts
          .filter((c) => c.choice === "ABSTAIN")
          .reduce((sum, c) => sum + c.coefficient, 0);
        const totalWeighted =
          approveWeighted + rejectWeighted + abstainWeighted;

        return {
          ...item,
          totalVotes: itemCasts.length,
          totalWeighted,
          breakdown: {
            approve: {
              count: itemCasts.filter((c) => c.choice === "APPROVE").length,
              weighted: approveWeighted,
              pct:
                totalWeighted > 0
                  ? ((approveWeighted / totalWeighted) * 100).toFixed(1)
                  : "0.0",
            },
            reject: {
              count: itemCasts.filter((c) => c.choice === "REJECT").length,
              weighted: rejectWeighted,
              pct:
                totalWeighted > 0
                  ? ((rejectWeighted / totalWeighted) * 100).toFixed(1)
                  : "0.0",
            },
            abstain: {
              count: itemCasts.filter((c) => c.choice === "ABSTAIN").length,
              weighted: abstainWeighted,
              pct:
                totalWeighted > 0
                  ? ((abstainWeighted / totalWeighted) * 100).toFixed(1)
                  : "0.0",
            },
          },
        };
      });

      return {
        ...session,
        totalVotes,
        proposalsBreakdown,
        itemsWithBreakdown: itemBreakdowns,
      };
    }),

  // ── Create a new voting session (AF only) ────────────────────────────────────
  create: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        type: z.enum(["SINGLE", "JUNTA"]).default("SINGLE"),
        title: z.string().min(1).max(256),
        budget: z.string().optional(),
        description: z.string().optional(),
        closesAt: z.string().optional(),
        priority: z.number().int().optional().default(0),
        budgetProposals: z
          .array(
            z.object({
              companyName: z.string().min(1),
              amount: z.string().min(1),
              description: z.string().optional(),
              fileUrl: z.string().optional(),
              fileName: z.string().optional(),
            }),
          )
          .optional(),
        items: z
          .array(
            z.object({
              title: z.string().min(1),
              budget: z.string().optional(),
              description: z.string().optional(),
              onlineVotingEnabled: z.boolean().optional().default(true),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sessionId = crypto.randomUUID();
      const authorId = ctx.session?.user?.id ?? DEMO_AUTHOR_ID;

      // Check how many sessions are currently open to alert if reaching >2
      const openCountResult = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(voteSession)
        .where(
          and(
            eq(voteSession.organizationId, input.tenantId),
            eq(voteSession.status, "OPEN"),
          ),
        );
      const currentOpenCount = openCountResult[0]?.count ?? 0;
      const warning =
        currentOpenCount >= 2
          ? "Aviso: Ya hay 2 votaciones activas en primer plano. Esta votación se creará y se mostrará en el carrusel de 'Otras votaciones pendientes'."
          : null;

      const [created] = await ctx.db
        .insert(voteSession)
        .values({
          id: sessionId,
          organizationId: input.tenantId,
          authorId,
          type: input.type,
          title: input.title,
          budget: input.budget ?? null,
          description: input.description ?? null,
          status: "OPEN",
          coefficientWeighted: true,
          priority: input.priority ?? 0,
          closesAt: input.closesAt ? new Date(input.closesAt) : null,
        })
        .returning();

      // If Junta with items, insert vote_items
      if (input.type === "JUNTA" && input.items && input.items.length > 0) {
        await ctx.db.insert(voteItem).values(
          input.items.map((item, idx) => ({
            id: crypto.randomUUID(),
            sessionId,
            orderIndex: idx + 1,
            title: item.title,
            budget: item.budget ?? null,
            description: item.description ?? null,
            onlineVotingEnabled: item.onlineVotingEnabled ?? true,
          })),
        );
      }

      // If budget proposals provided, insert them
      if (input.budgetProposals && input.budgetProposals.length > 0) {
        await ctx.db.insert(voteBudgetProposal).values(
          input.budgetProposals.map((bp, idx) => ({
            id: crypto.randomUUID(),
            sessionId,
            companyName: bp.companyName,
            amount: bp.amount,
            description: bp.description ?? null,
            fileUrl: bp.fileUrl ?? null,
            fileName: bp.fileName ?? null,
            displayOrder: idx,
          })),
        );
      }

      // Insert standard options for backwards compatibility
      await ctx.db.insert(voteOption).values([
        {
          id: crypto.randomUUID(),
          sessionId,
          label: "Apruebo",
          displayOrder: 0,
        },
        {
          id: crypto.randomUUID(),
          sessionId,
          label: "Rechazo",
          displayOrder: 1,
        },
        {
          id: crypto.randomUUID(),
          sessionId,
          label: "Me abstengo",
          displayOrder: 2,
        },
      ]);

      try {
        await emitWebSocketEvent(input.tenantId, "voting-created", created);
      } catch (wsErr) {
        console.warn("[voting.create] WebSocket emit failed:", wsErr);
      }

      // Notify all members
      try {
        await sendPushToAllMembers(ctx.db, input.tenantId, {
          title:
            input.type === "JUNTA"
              ? "🗳️ Junta extraordinaria abierta"
              : "🗳️ Nueva votación abierta",
          body: input.title,
          data: { type: "new_vote", sessionId },
        });
      } catch (pushErr) {
        console.warn("[voting.create] Push broadcast failed:", pushErr);
      }

      return { sessionId, warning };
    }),

  // ── Convocatoria y Votación sincronizadas — “Crear Junta” (AF only) ───────────
  createMeeting: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        title: z.string().min(1).max(256),
        description: z.string().optional(),
        meetingDate: z.string(), // ISO String
        meetingLocation: z.string().min(1),
        secondCallDate: z.string().optional(),
        closesAt: z.string().optional(), // Fecha límite para votar online
        priority: z.number().int().optional().default(1),
        items: z
          .array(
            z.object({
              title: z.string().min(1),
              budget: z.string().optional(),
              description: z.string().optional(),
              onlineVotingEnabled: z.boolean().default(true),
              proposals: z
                .array(
                  z.object({
                    companyName: z.string().min(1),
                    amount: z.string().min(1),
                    description: z.string().optional(),
                    fileUrl: z.string().optional(),
                    fileName: z.string().optional(),
                  }),
                )
                .optional(),
            }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sessionId = crypto.randomUUID();
      const authorId = ctx.session?.user?.id ?? DEMO_AUTHOR_ID;

      // Check open sessions count
      const openCountResult = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(voteSession)
        .where(
          and(
            eq(voteSession.organizationId, input.tenantId),
            eq(voteSession.status, "OPEN"),
          ),
        );
      const currentOpenCount = openCountResult[0]?.count ?? 0;
      const warning =
        currentOpenCount >= 2
          ? "Aviso: Ya hay 2 votaciones activas en primer plano. Esta junta se creará y se mostrará en el carrusel de 'Otras votaciones pendientes'."
          : null;

      const now = new Date();
      const meetingD = new Date(input.meetingDate);
      const secondCallD = input.secondCallDate
        ? new Date(input.secondCallDate)
        : null;
      const closesD = input.closesAt ? new Date(input.closesAt) : null;

      // 1. Insert Vote Session
      const [createdSession] = await ctx.db
        .insert(voteSession)
        .values({
          id: sessionId,
          organizationId: input.tenantId,
          authorId,
          type: "JUNTA",
          title: input.title,
          description: input.description ?? null,
          status: "OPEN",
          coefficientWeighted: true,
          priority: input.priority ?? 1,
          closesAt: closesD,
          meetingDate: meetingD,
          meetingLocation: input.meetingLocation,
          secondCallDate: secondCallD,
          convocationGeneratedAt: now,
        })
        .returning();

      // 2. Insert items & their proposals
      for (let idx = 0; idx < input.items.length; idx++) {
        const itemInput = input.items[idx]!;
        const itemId = crypto.randomUUID();

        await ctx.db.insert(voteItem).values({
          id: itemId,
          sessionId,
          orderIndex: idx + 1,
          title: itemInput.title,
          budget: itemInput.budget ?? null,
          description: itemInput.description ?? null,
          onlineVotingEnabled: itemInput.onlineVotingEnabled ?? true,
        });

        if (itemInput.proposals && itemInput.proposals.length > 0) {
          await ctx.db.insert(voteBudgetProposal).values(
            itemInput.proposals.map((bp, pIdx) => ({
              id: crypto.randomUUID(),
              sessionId,
              itemId,
              companyName: bp.companyName,
              amount: bp.amount,
              description: bp.description ?? null,
              fileUrl: bp.fileUrl ?? null,
              fileName: bp.fileName ?? null,
              displayOrder: pIdx,
            })),
          );
        }
      }

      // Legacy fallback options
      await ctx.db.insert(voteOption).values([
        {
          id: crypto.randomUUID(),
          sessionId,
          label: "Apruebo",
          displayOrder: 0,
        },
        {
          id: crypto.randomUUID(),
          sessionId,
          label: "Rechazo",
          displayOrder: 1,
        },
        {
          id: crypto.randomUUID(),
          sessionId,
          label: "Me abstengo",
          displayOrder: 2,
        },
      ]);

      // 3. Auto-generate Official Convocatoria Notice
      const meetingFormatted = meetingD.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const secondCallFormatted = secondCallD
        ? secondCallD.toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : null;
      const closesFormatted = closesD
        ? closesD.toLocaleDateString("es-ES", {
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })
        : null;

      const agendaPoints = input.items
        .map((it, idx) => {
          const modeTag = it.onlineVotingEnabled
            ? "🗳️ [Voto telemático habilitado en la App]"
            : "👥 [Votación presencial en la Junta]";
          const budgetTag = it.budget ? ` · Presupuesto: ${it.budget}` : "";
          return `${idx + 1}. ${it.title}${budgetTag}\n   Modalidad: ${modeTag}`;
        })
        .join("\n\n");

      const noticeBody = `CONVOCATORIA OFICIAL DE JUNTA GENERAL EXTRAORDINARIA
Comunidad de Propietarios

Por medio de la presente y conforme a lo dispuesto en la Ley de Propiedad Horizontal, se convoca a los señores propietarios a la celebración de la Junta General:

📅 FECHA Y HORA (1ª convocatoria): ${meetingFormatted}
${secondCallFormatted ? `⏰ SEGUNDA CONVOCATORIA: ${secondCallFormatted} del mismo día\n` : ""}📍 LUGAR: ${input.meetingLocation}

══════════════════════════════════════════════════════
ORDEN DEL DÍA
══════════════════════════════════════════════════════
${agendaPoints}

${
  closesFormatted
    ? `🗳️ VOTACIÓN TELEMÁTICA PREVIA:\nAquellos puntos señalados con voto telemático habilitado pueden ser votados a través de la aplicación Aconvi hasta el ${closesFormatted}.\n`
    : ""
}⚖️ DERECHO DE VOTO (Art. 15.2 LPH):
Se recuerda a los propietarios que, conforme a la normativa vigente, aquellos que mantengan deudas vencidas y no liquidadas con la comunidad al momento de la votación carecen de derecho a voto, salvo que conste habilitación expresa de la Administración.

Fdo. La Administración de Fincas`;

      await ctx.db.insert(notice).values({
        id: crypto.randomUUID(),
        organizationId: input.tenantId,
        authorId,
        title: `📋 Convocatoria: ${input.title}`,
        content: noticeBody,
        type: "COMUNICADO",
        pinned: true,
      });

      // 4. Real-time Events & Notifications
      try {
        await emitWebSocketEvent(
          input.tenantId,
          "voting-created",
          createdSession,
        );
        await emitWebSocketEvent(input.tenantId, "notice-created", {
          title: input.title,
        });
      } catch (wsErr) {
        console.warn("[voting.createMeeting] WebSocket emit failed:", wsErr);
      }

      try {
        await sendPushToAllMembers(ctx.db, input.tenantId, {
          title: `📋 Convocatoria Oficial: ${input.title}`,
          body: `Se ha convocado Junta para el ${meetingFormatted}. Votación telemática disponible en la App.`,
          data: { type: "new_vote", sessionId },
        });
      } catch (pushErr) {
        console.warn("[voting.createMeeting] Push broadcast failed:", pushErr);
      }

      return { sessionId, warning };
    }),

  // ── Cast Vote(s) — Flujo A (Decisión única) y Flujo B (Junta multipunto) ───────
  cast: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        tenantId: z.string().min(1),
        userId: z.string().optional(),
        // For Single Decision
        choice: z.enum(["APPROVE", "REJECT", "ABSTAIN"]).optional(),
        selectedProposalId: z.string().uuid().optional(),
        // For Junta Multi-point
        votes: z
          .array(
            z.object({
              itemId: z.string().uuid(),
              choice: z.enum(["APPROVE", "REJECT", "ABSTAIN"]),
              selectedProposalId: z.string().uuid().optional(),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolvedUserId =
        ctx.session?.user?.id ?? input.userId ?? DEMO_AUTHOR_ID;

      // 1. Validate session
      const session = await ctx.db.query.voteSession.findFirst({
        where: eq(voteSession.id, input.sessionId),
        with: {
          items: { orderBy: (item, { asc }) => [asc(item.orderIndex)] },
        },
      });
      if (!session) throw new Error("Votación no encontrada");
      if (session.status !== "OPEN")
        throw new Error("Esta votación no está abierta");

      // 2. Validate user right to vote (check for debts unless override by AF)
      const memberRecord = await ctx.db.query.member.findFirst({
        where: and(
          eq(member.userId, resolvedUserId),
          eq(member.organizationId, session.organizationId),
        ),
      });
      const hasOverride = Boolean(memberRecord?.votingOverride);

      if (!hasOverride) {
        const userDebts = await ctx.db.query.fee.findMany({
          where: and(
            eq(fee.organizationId, input.tenantId),
            eq(fee.userId, resolvedUserId),
            inArray(fee.status, ["OVERDUE", "PENDING"]),
          ),
        });
        if (userDebts.length > 0) {
          throw new Error(
            "No puedes votar en esta votación. Tienes pagos pendientes con la comunidad. Ponte al día para poder participar.",
          );
        }
      }

      // 3. Check if user already voted (votes are final and immutable)
      const existing = await ctx.db.query.voteCast.findFirst({
        where: and(
          eq(voteCast.sessionId, input.sessionId),
          eq(voteCast.userId, resolvedUserId),
        ),
      });
      if (existing) {
        throw new Error(
          "Tus votos ya han sido registrados anteriormente y no pueden modificarse.",
        );
      }

      // 4. Get voter's coefficient
      const coefficient = memberRecord?.coefficient ?? 1;
      const castAt = new Date();

      // 5. Handle Junta (Multi-point) — Only require votes for items where onlineVotingEnabled = true!
      if (session.type === "JUNTA" && session.items.length > 0) {
        const onlineItems = session.items.filter((i) => i.onlineVotingEnabled);

        if (onlineItems.length > 0) {
          if (!input.votes || input.votes.length !== onlineItems.length) {
            throw new Error(
              `Debes responder a todos los puntos con votación telemática habilitada (${onlineItems.length} de ${onlineItems.length}) antes de enviar tus votos.`,
            );
          }

          // Verify all item IDs belong to online-enabled items
          const validItemIds = new Set(onlineItems.map((i) => i.id));
          for (const v of input.votes) {
            if (!validItemIds.has(v.itemId)) {
              throw new Error(
                `Punto de votación inválido o no habilitado para voto online: ${v.itemId}`,
              );
            }
          }

          // Insert all votes
          await ctx.db.insert(voteCast).values(
            input.votes.map((v) => ({
              id: crypto.randomUUID(),
              sessionId: input.sessionId,
              itemId: v.itemId,
              userId: resolvedUserId,
              choice: v.choice,
              selectedProposalId: v.selectedProposalId ?? null,
              coefficient,
              castAt,
            })),
          );
        } else {
          throw new Error(
            "Esta junta no contiene puntos habilitados para votación online.",
          );
        }
      } else {
        // Handle Single Decision
        const singleChoice = input.choice ?? input.votes?.[0]?.choice;
        const selectedProposalId =
          input.selectedProposalId ??
          input.votes?.[0]?.selectedProposalId ??
          null;

        if (!singleChoice) {
          throw new Error(
            "Debes seleccionar una opción (Apruebo, Rechazo o Me abstengo).",
          );
        }

        await ctx.db.insert(voteCast).values({
          id: crypto.randomUUID(),
          sessionId: input.sessionId,
          itemId: session.items[0]?.id ?? null,
          userId: resolvedUserId,
          choice: singleChoice,
          selectedProposalId,
          coefficient,
          castAt,
        });
      }

      await emitWebSocketEvent(input.tenantId, "voting-cast", {
        sessionId: input.sessionId,
        userId: resolvedUserId,
        castAt,
      });

      return {
        ok: true,
        castAt: castAt.toISOString(),
        message: "¡Votos registrados correctamente!",
      };
    }),

  // ── Close a session + generate minutes ───────────────────────────────────────
  close: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        tenantId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.query.voteSession.findFirst({
        where: and(
          eq(voteSession.id, input.sessionId),
          eq(voteSession.organizationId, input.tenantId),
        ),
        with: {
          items: { orderBy: (i, { asc }) => [asc(i.orderIndex)] },
          casts: { with: { user: { columns: { id: true, name: true } } } },
          author: { columns: { name: true } },
        },
      });
      if (!session) throw new Error("Votación no encontrada");
      if (session.status !== "OPEN")
        throw new Error("Solo se pueden cerrar votaciones abiertas");

      const now = new Date();
      const dateStr = now.toLocaleDateString("es-ES", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const lines: string[] = [
        `ACTA DE VOTACIÓN OFICIAL — ${session.title}`,
        `Tipo: ${session.type === "JUNTA" ? "Junta Extraordinaria (Varios Puntos)" : "Decisión sin Junta"}`,
        `Fecha de cierre: ${dateStr}`,
        `Administrador: ${session.author?.name ?? "Administración"}`,
        `Total de votantes: ${new Set(session.casts.map((c) => c.userId)).size}`,
        ``,
        `═══════════════════════════════════════════════════════════════════`,
        `RESULTADOS DE LA VOTACIÓN:`,
        `═══════════════════════════════════════════════════════════════════`,
      ];

      if (session.type === "JUNTA" && session.items.length > 0) {
        for (const item of session.items) {
          const itemCasts = session.casts.filter((c) => c.itemId === item.id);
          const app = itemCasts
            .filter((c) => c.choice === "APPROVE")
            .reduce((s, c) => s + c.coefficient, 0);
          const rej = itemCasts
            .filter((c) => c.choice === "REJECT")
            .reduce((s, c) => s + c.coefficient, 0);
          const abs = itemCasts
            .filter((c) => c.choice === "ABSTAIN")
            .reduce((s, c) => s + c.coefficient, 0);
          const tot = app + rej + abs || 1;

          const winner = app > rej ? "APROBADO" : "RECHAZADO";

          lines.push(
            `\nPUNTO ${item.orderIndex}: ${item.title} ${item.budget ? `(${item.budget})` : ""}`,
          );
          lines.push(
            `  • Apruebo:     ${itemCasts.filter((c) => c.choice === "APPROVE").length} votos (${((app / tot) * 100).toFixed(1)}% coef.)`,
          );
          lines.push(
            `  • Rechazo:     ${itemCasts.filter((c) => c.choice === "REJECT").length} votos (${((rej / tot) * 100).toFixed(1)}% coef.)`,
          );
          lines.push(
            `  • Me abstengo: ${itemCasts.filter((c) => c.choice === "ABSTAIN").length} votos (${((abs / tot) * 100).toFixed(1)}% coef.)`,
          );
          lines.push(`  → Resultado: ${winner}`);
        }
      } else {
        const app = session.casts
          .filter((c) => c.choice === "APPROVE")
          .reduce((s, c) => s + c.coefficient, 0);
        const rej = session.casts
          .filter((c) => c.choice === "REJECT")
          .reduce((s, c) => s + c.coefficient, 0);
        const abs = session.casts
          .filter((c) => c.choice === "ABSTAIN")
          .reduce((s, c) => s + c.coefficient, 0);
        const tot = app + rej + abs || 1;

        lines.push(
          `\nDECISIÓN: ${session.title} ${session.budget ? `(${session.budget})` : ""}`,
        );
        lines.push(
          `  • Apruebo:     ${session.casts.filter((c) => c.choice === "APPROVE").length} votos (${((app / tot) * 100).toFixed(1)}% coef.)`,
        );
        lines.push(
          `  • Rechazo:     ${session.casts.filter((c) => c.choice === "REJECT").length} votos (${((rej / tot) * 100).toFixed(1)}% coef.)`,
        );
        lines.push(
          `  • Me abstengo: ${session.casts.filter((c) => c.choice === "ABSTAIN").length} votos (${((abs / tot) * 100).toFixed(1)}% coef.)`,
        );
        lines.push(`  → Resultado: ${app > rej ? "APROBADO" : "RECHAZADO"}`);
      }

      lines.push(
        `\nDocumento emitido y sellado legalmente por la plataforma Aconvi.`,
      );

      await ctx.db.insert(voteMinute).values({
        id: crypto.randomUUID(),
        sessionId: session.id,
        content: lines.join("\n"),
      });

      await ctx.db
        .update(voteSession)
        .set({ status: "CLOSED", closedAt: now })
        .where(eq(voteSession.id, input.sessionId));

      try {
        await emitWebSocketEvent(input.tenantId, "voting-closed", {
          sessionId: input.sessionId,
          closedAt: now,
        });
      } catch (wsErr) {
        console.warn("[voting.close] WebSocket emit failed:", wsErr);
      }

      // Send push notification to all members that the session is closed
      try {
        await sendPushToAllMembers(ctx.db, input.tenantId, {
          title: `📋 Votación cerrada: ${session.title}`,
          body: "El Administrador de Fincas ha cerrado la votación y generado el acta oficial. Ya puedes consultar los resultados.",
          data: { type: "vote_closed", sessionId: session.id },
        });
      } catch (pushErr) {
        console.warn("[voting.close] Push broadcast failed:", pushErr);
      }

      return { ok: true, minuteContent: lines.join("\n") };
    }),

  // ── Override Voting Right (AF only) ──────────────────────────────────────────
  overrideVotingRight: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        userId: z.string().min(1),
        enable: z.boolean(),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const mem = await ctx.db.query.member.findFirst({
        where: and(
          eq(member.organizationId, input.tenantId),
          eq(member.userId, input.userId),
        ),
      });
      if (!mem) throw new Error("Miembro no encontrado en la comunidad");

      await ctx.db
        .update(member)
        .set({
          votingOverride: input.enable,
          votingOverrideReason: input.reason ?? null,
        })
        .where(eq(member.id, mem.id));

      return { ok: true, enable: input.enable };
    }),

  // ── Auto-Archive Expired Sessions (>48h after closed) ────────────────────────
  archiveExpired: publicProcedure
    .input(z.object({ tenantId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const cutoff = new Date(Date.now() - 48 * 3600 * 1000);
      const expired = await ctx.db.query.voteSession.findMany({
        where: and(
          eq(voteSession.organizationId, input.tenantId),
          eq(voteSession.status, "CLOSED"),
          lte(voteSession.closedAt, cutoff),
        ),
      });

      let count = 0;
      for (const s of expired) {
        if (!s.archivedAt) {
          await ctx.db
            .update(voteSession)
            .set({ archivedAt: new Date() })
            .where(eq(voteSession.id, s.id));
          count++;
        }
      }

      return { ok: true, archivedCount: count };
    }),
});
