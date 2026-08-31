import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  voteSession,
  voteItem,
  voteOption,
  voteCast,
  voteMinute,
  member,
  fee,
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
      const resolvedUserId = ctx.session?.user?.id ?? input.userId ?? DEMO_AUTHOR_ID;

      const sessions = await ctx.db.query.voteSession.findMany({
        where: eq(voteSession.organizationId, input.tenantId),
        with: {
          items: { orderBy: (item, { asc }) => [asc(item.orderIndex)] },
          options: { orderBy: (opt, { asc }) => [asc(opt.displayOrder)] },
          casts: true,
          author: { columns: { id: true, name: true } },
          minute: { columns: { id: true, generatedAt: true } },
        },
        orderBy: [desc(voteSession.createdAt)],
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

      // Get user's coefficient
      const memberRecord = await ctx.db.query.member.findFirst({
        where: and(
          eq(member.organizationId, input.tenantId),
          eq(member.userId, resolvedUserId),
        ),
      });
      const userCoefficient = memberRecord?.coefficient ?? 1;

      return sessions.map((session) => {
        const userCasts = session.casts.filter((c) => c.userId === resolvedUserId);
        const hasVoted = userCasts.length > 0;

        return {
          ...session,
          hasVoted,
          userCasts: userCasts.map((c) => ({
            itemId: c.itemId,
            choice: c.choice,
            castAt: c.castAt,
          })),
          userVotingStatus: {
            canVote: !hasDebt,
            reason: hasDebt
              ? `Tienes pagos pendientes (${debtAmount > 0 ? debtAmount.toLocaleString("es-ES") + " €" : "cuotas pendientes"}) con la comunidad y no tendrás derecho a voto. Ponte al día para poder participar en las votaciones.`
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
          casts: { with: { user: { columns: { id: true, name: true, email: true } } } },
          author: { columns: { id: true, name: true } },
          minute: true,
        },
      });
      if (!session) throw new Error("Votación no encontrada");

      const totalVotes = session.casts.length;

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
        const totalWeighted = approveWeighted + rejectWeighted + abstainWeighted;

        return {
          ...session,
          totalVotes,
          totalWeighted,
          breakdown: {
            approve: {
              count: session.casts.filter((c) => c.choice === "APPROVE").length,
              weighted: approveWeighted,
              pct: totalWeighted > 0 ? ((approveWeighted / totalWeighted) * 100).toFixed(1) : "0.0",
            },
            reject: {
              count: session.casts.filter((c) => c.choice === "REJECT").length,
              weighted: rejectWeighted,
              pct: totalWeighted > 0 ? ((rejectWeighted / totalWeighted) * 100).toFixed(1) : "0.0",
            },
            abstain: {
              count: session.casts.filter((c) => c.choice === "ABSTAIN").length,
              weighted: abstainWeighted,
              pct: totalWeighted > 0 ? ((abstainWeighted / totalWeighted) * 100).toFixed(1) : "0.0",
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
        const totalWeighted = approveWeighted + rejectWeighted + abstainWeighted;

        return {
          ...item,
          totalVotes: itemCasts.length,
          totalWeighted,
          breakdown: {
            approve: {
              count: itemCasts.filter((c) => c.choice === "APPROVE").length,
              weighted: approveWeighted,
              pct: totalWeighted > 0 ? ((approveWeighted / totalWeighted) * 100).toFixed(1) : "0.0",
            },
            reject: {
              count: itemCasts.filter((c) => c.choice === "REJECT").length,
              weighted: rejectWeighted,
              pct: totalWeighted > 0 ? ((rejectWeighted / totalWeighted) * 100).toFixed(1) : "0.0",
            },
            abstain: {
              count: itemCasts.filter((c) => c.choice === "ABSTAIN").length,
              weighted: abstainWeighted,
              pct: totalWeighted > 0 ? ((abstainWeighted / totalWeighted) * 100).toFixed(1) : "0.0",
            },
          },
        };
      });

      return {
        ...session,
        totalVotes,
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
        items: z
          .array(
            z.object({
              title: z.string().min(1),
              budget: z.string().optional(),
              description: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sessionId = crypto.randomUUID();
      const authorId = ctx.session?.user?.id ?? DEMO_AUTHOR_ID;

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
          })),
        );
      }

      // Insert standard options for backwards compatibility
      await ctx.db.insert(voteOption).values([
        { id: crypto.randomUUID(), sessionId, label: "Apruebo", displayOrder: 0 },
        { id: crypto.randomUUID(), sessionId, label: "Rechazo", displayOrder: 1 },
        { id: crypto.randomUUID(), sessionId, label: "Me abstengo", displayOrder: 2 },
      ]);

      try {
        await emitWebSocketEvent(input.tenantId, "voting-created", created);
      } catch (wsErr) {
        console.warn("[voting.create] WebSocket emit failed:", wsErr);
      }

      // Notify all members
      try {
        await sendPushToAllMembers(ctx.db, input.tenantId, {
          title: input.type === "JUNTA" ? "🗳️ Junta extraordinaria abierta" : "🗳️ Nueva votación abierta",
          body: input.title,
          data: { type: "new_vote", sessionId },
        });
      } catch (pushErr) {
        console.warn("[voting.create] Push broadcast failed:", pushErr);
      }

      return { sessionId };
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
        // For Junta Multi-point
        votes: z
          .array(
            z.object({
              itemId: z.string().uuid(),
              choice: z.enum(["APPROVE", "REJECT", "ABSTAIN"]),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolvedUserId = ctx.session?.user?.id ?? input.userId ?? DEMO_AUTHOR_ID;

      // 1. Validate session
      const session = await ctx.db.query.voteSession.findFirst({
        where: eq(voteSession.id, input.sessionId),
        with: {
          items: { orderBy: (item, { asc }) => [asc(item.orderIndex)] },
        },
      });
      if (!session) throw new Error("Votación no encontrada");
      if (session.status !== "OPEN") throw new Error("Esta votación no está abierta");

      // 2. Validate user right to vote (check for debts)
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

      // 3. Check if user already voted (votes are final and immutable)
      const existing = await ctx.db.query.voteCast.findFirst({
        where: and(
          eq(voteCast.sessionId, input.sessionId),
          eq(voteCast.userId, resolvedUserId),
        ),
      });
      if (existing) {
        throw new Error("Tus votos ya han sido registrados anteriormente y no pueden modificarse.");
      }

      // 4. Get voter's coefficient
      const memberRecord = await ctx.db.query.member.findFirst({
        where: and(
          eq(member.userId, resolvedUserId),
          eq(member.organizationId, session.organizationId),
        ),
      });
      const coefficient = memberRecord?.coefficient ?? 1;
      const castAt = new Date();

      // 5. Handle Junta (Multi-point)
      if (session.type === "JUNTA" && session.items.length > 0) {
        if (!input.votes || input.votes.length !== session.items.length) {
          throw new Error(
            `Debes responder a todos los puntos (${session.items.length} de ${session.items.length}) antes de enviar tus votos.`,
          );
        }

        // Verify all item IDs belong to this session
        const validItemIds = new Set(session.items.map((i) => i.id));
        for (const v of input.votes) {
          if (!validItemIds.has(v.itemId)) {
            throw new Error(`Punto de votación inválido: ${v.itemId}`);
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
            coefficient,
            castAt,
          })),
        );
      } else {
        // Handle Single Decision
        const singleChoice = input.choice ?? input.votes?.[0]?.choice;
        if (!singleChoice) {
          throw new Error("Debes seleccionar una opción (Apruebo, Rechazo o Me abstengo).");
        }

        await ctx.db.insert(voteCast).values({
          id: crypto.randomUUID(),
          sessionId: input.sessionId,
          itemId: session.items[0]?.id ?? null,
          userId: resolvedUserId,
          choice: singleChoice,
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
      if (session.status !== "OPEN") throw new Error("Solo se pueden cerrar votaciones abiertas");

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
          const app = itemCasts.filter((c) => c.choice === "APPROVE").reduce((s, c) => s + c.coefficient, 0);
          const rej = itemCasts.filter((c) => c.choice === "REJECT").reduce((s, c) => s + c.coefficient, 0);
          const abs = itemCasts.filter((c) => c.choice === "ABSTAIN").reduce((s, c) => s + c.coefficient, 0);
          const tot = app + rej + abs || 1;

          const winner = app > rej ? "APROBADO" : "RECHAZADO";

          lines.push(`\nPUNTO ${item.orderIndex}: ${item.title} ${item.budget ? `(${item.budget})` : ""}`);
          lines.push(`  • Apruebo:     ${itemCasts.filter((c) => c.choice === "APPROVE").length} votos (${((app / tot) * 100).toFixed(1)}% coef.)`);
          lines.push(`  • Rechazo:     ${itemCasts.filter((c) => c.choice === "REJECT").length} votos (${((rej / tot) * 100).toFixed(1)}% coef.)`);
          lines.push(`  • Me abstengo: ${itemCasts.filter((c) => c.choice === "ABSTAIN").length} votos (${((abs / tot) * 100).toFixed(1)}% coef.)`);
          lines.push(`  → Resultado: ${winner}`);
        }
      } else {
        const app = session.casts.filter((c) => c.choice === "APPROVE").reduce((s, c) => s + c.coefficient, 0);
        const rej = session.casts.filter((c) => c.choice === "REJECT").reduce((s, c) => s + c.coefficient, 0);
        const abs = session.casts.filter((c) => c.choice === "ABSTAIN").reduce((s, c) => s + c.coefficient, 0);
        const tot = app + rej + abs || 1;

        lines.push(`\nDECISIÓN: ${session.title} ${session.budget ? `(${session.budget})` : ""}`);
        lines.push(`  • Apruebo:     ${session.casts.filter((c) => c.choice === "APPROVE").length} votos (${((app / tot) * 100).toFixed(1)}% coef.)`);
        lines.push(`  • Rechazo:     ${session.casts.filter((c) => c.choice === "REJECT").length} votos (${((rej / tot) * 100).toFixed(1)}% coef.)`);
        lines.push(`  • Me abstengo: ${session.casts.filter((c) => c.choice === "ABSTAIN").length} votos (${((abs / tot) * 100).toFixed(1)}% coef.)`);
        lines.push(`  → Resultado: ${app > rej ? "APROBADO" : "RECHAZADO"}`);
      }

      lines.push(`\nDocumento emitido y sellado legalmente por la plataforma Aconvi.`);

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
});
