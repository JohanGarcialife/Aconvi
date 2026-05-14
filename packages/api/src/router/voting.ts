import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import {
  voteSession,
  voteOption,
  voteCast,
  voteMinute,
  member,
} from "@acme/db/schema";
import { createTRPCRouter, tenantProcedure, protectedProcedure } from "../trpc";
import { emitWebSocketEvent } from "../utils/ws";
import { sendPushToAllMembers } from "./notification";

export const votingRouter = createTRPCRouter({
  // ── List all sessions for a community ────────────────────────────────────────
  all: tenantProcedure.query(async ({ ctx, input }) => {
    return ctx.db.query.voteSession.findMany({
      where: eq(voteSession.organizationId, input.tenantId),
      with: {
        options: true,
        author: { columns: { id: true, name: true } },
        minute: { columns: { id: true, generatedAt: true } },
      },
      orderBy: [desc(voteSession.createdAt)],
    });
  }),

  // ── Get a session with full results ─────────────────────────────────────────
  results: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.db.query.voteSession.findFirst({
        where: eq(voteSession.id, input.sessionId),
        with: {
          options: { orderBy: (o, { asc }) => [asc(o.displayOrder)] },
          casts: { with: { user: { columns: { id: true, name: true } } } },
          minute: true,
        },
      });
      if (!session) throw new Error("Votación no encontrada");

      const totalVotes = session.casts.length;
      const totalWeighted = session.options.reduce(
        (acc, o) => acc + o.weightedTotal,
        0,
      );

      return {
        ...session,
        totalVotes,
        totalWeighted,
      };
    }),

  // ── Create a new voting session (AF only) ────────────────────────────────────
  create: tenantProcedure
    .input(
      z.object({
        title: z.string().min(1).max(256),
        description: z.string().optional(),
        options: z.array(z.string().min(1)).min(2).max(10),
        closesAt: z.string().datetime().optional(),
        coefficientWeighted: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sessionId = crypto.randomUUID();

      const [created] = await ctx.db.insert(voteSession).values({
        id: sessionId,
        organizationId: input.tenantId,
        authorId: ctx.session.user.id,
        title: input.title,
        description: input.description ?? null,
        status: "DRAFT",
        coefficientWeighted: input.coefficientWeighted,
        closesAt: input.closesAt ? new Date(input.closesAt) : null,
      }).returning();

      // Insert options
      await ctx.db.insert(voteOption).values(
        input.options.map((label, idx) => ({
          id: crypto.randomUUID(),
          sessionId,
          label,
          displayOrder: idx,
        })),
      );

      await emitWebSocketEvent(input.tenantId, "voting-created", created);

      return { sessionId };
    }),

  // ── Open a session (AF) ──────────────────────────────────────────────────────
  open: tenantProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.query.voteSession.findFirst({
        where: and(
          eq(voteSession.id, input.sessionId),
          eq(voteSession.organizationId, input.tenantId),
        ),
      });
      if (!session) throw new Error("Votación no encontrada");
      if (session.status !== "DRAFT") throw new Error("Solo se pueden abrir votaciones en borrador");

      const [updated] = await ctx.db
        .update(voteSession)
        .set({ status: "OPEN" })
        .where(eq(voteSession.id, input.sessionId))
        .returning();

      await emitWebSocketEvent(input.tenantId, "voting-opened", updated);

      // Notify all members that a new vote is open
      await sendPushToAllMembers(ctx.db, input.tenantId, {
        title: "🗳️ Nueva votación abierta",
        body: session.title,
        data: { type: "new_vote" },
      });

      return { ok: true };
    }),

  // ── Close a session + auto-generate minutes (AF) ─────────────────────────────
  close: tenantProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.query.voteSession.findFirst({
        where: and(
          eq(voteSession.id, input.sessionId),
          eq(voteSession.organizationId, input.tenantId),
        ),
        with: {
          options: { orderBy: (o, { asc }) => [asc(o.displayOrder)] },
          casts: { with: { user: { columns: { id: true, name: true } } } },
          author: { columns: { name: true } },
        },
      });
      if (!session) throw new Error("Votación no encontrada");
      if (session.status !== "OPEN") throw new Error("Solo se pueden cerrar votaciones abiertas");

      const now = new Date();
      const totalVotes = session.casts.length;
      const totalWeighted = session.options.reduce(
        (acc, o) => acc + o.weightedTotal,
        0,
      );

      // Build winning option
      const winner = [...session.options].sort(
        (a, b) =>
          session.coefficientWeighted
            ? b.weightedTotal - a.weightedTotal
            : b.voteCount - a.voteCount,
      )[0];

      // Generate plain-text minutes
      const minuteLines = [
        `ACTA DE VOTACIÓN — ${session.title}`,
        `Fecha de cierre: ${now.toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}`,
        `Autor: ${session.author?.name ?? "Administrador"}`,
        `Ponderación por coeficiente: ${session.coefficientWeighted ? "Sí" : "No"}`,
        `Total de votos emitidos: ${totalVotes}`,
        ``,
        `RESULTADOS:`,
        ...session.options.map((opt) => {
          const pct = session.coefficientWeighted
            ? totalWeighted > 0
              ? ((opt.weightedTotal / totalWeighted) * 100).toFixed(2)
              : "0.00"
            : totalVotes > 0
            ? ((opt.voteCount / totalVotes) * 100).toFixed(2)
            : "0.00";
          return `  - ${opt.label}: ${opt.voteCount} votos (${pct}%)${winner?.id === opt.id ? " ← GANADOR" : ""}`;
        }),
        ``,
        `VOTANTES:`,
        ...session.casts.map(
          (c) => `  - ${c.user?.name ?? c.userId} (coef: ${c.coefficient})`,
        ),
        ``,
        `Acta generada automáticamente por Aconvi el ${now.toISOString()}`,
      ];

      await ctx.db.insert(voteMinute).values({
        id: crypto.randomUUID(),
        sessionId: session.id,
        content: minuteLines.join("\n"),
      });

      await ctx.db
        .update(voteSession)
        .set({ status: "CLOSED", closedAt: now })
        .where(eq(voteSession.id, input.sessionId));

      return { ok: true, minuteContent: minuteLines.join("\n") };
    }),

  // ── Check if current user already voted in a session ─────────────────────────
  hasVoted: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const cast = await ctx.db.query.voteCast.findFirst({
        where: and(
          eq(voteCast.sessionId, input.sessionId),
          eq(voteCast.userId, ctx.session.user.id),
        ),
      });
      return { hasVoted: !!cast, optionId: cast?.optionId ?? null };
    }),

  // ── Cast a vote (Vecino) ──────────────────────────────────────────────────────
  cast: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        optionId: z.string().uuid(),
        tenantId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Validate session is open
      const session = await ctx.db.query.voteSession.findFirst({
        where: eq(voteSession.id, input.sessionId),
      });
      if (!session) throw new Error("Votación no encontrada");
      if (session.status !== "OPEN") throw new Error("Esta votación no está abierta");

      // Check not already voted
      const existing = await ctx.db.query.voteCast.findFirst({
        where: and(
          eq(voteCast.sessionId, input.sessionId),
          eq(voteCast.userId, ctx.session.user.id),
        ),
      });
      if (existing) throw new Error("Ya has emitido tu voto en esta votación");

      // Get voter's coefficient
      const memberRecord = await ctx.db.query.member.findFirst({
        where: and(
          eq(member.userId, ctx.session.user.id),
          eq(member.organizationId, session.organizationId),
        ),
      });
      const coefficient = memberRecord?.coefficient ?? 1;

      // Insert cast
      await ctx.db.insert(voteCast).values({
        id: crypto.randomUUID(),
        sessionId: input.sessionId,
        userId: ctx.session.user.id,
        optionId: input.optionId,
        coefficient,
      });

      // Update option counters
      const opt = await ctx.db.query.voteOption.findFirst({
        where: eq(voteOption.id, input.optionId),
      });
      if (opt) {
        await ctx.db
          .update(voteOption)
          .set({
            voteCount: opt.voteCount + 1,
            weightedTotal: opt.weightedTotal + coefficient,
          })
          .where(eq(voteOption.id, input.optionId));
      }

      return { ok: true };
    }),
});
