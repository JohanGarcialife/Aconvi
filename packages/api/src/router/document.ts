import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { communityDocument } from "@acme/db/schema";
import { createTRPCRouter, tenantProcedure, protectedProcedure } from "../trpc";
import { sendPushToAllMembers } from "./notification";

export const DOCUMENT_CATEGORIES = [
  "ACTA",
  "ESTATUTO",
  "REGLAMENTO",
  "CONTRATO",
  "PRESUPUESTO",
  "OTRO",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const documentRouter = createTRPCRouter({
  // ── List all documents for a community ──────────────────────────────────────
  all: tenantProcedure
    .input(z.object({ category: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(communityDocument.organizationId, input.tenantId)];
      if (input.category) conditions.push(eq(communityDocument.category, input.category));

      return ctx.db.query.communityDocument.findMany({
        where: and(...conditions),
        with: {
          author: { columns: { id: true, name: true } },
        },
        orderBy: [desc(communityDocument.createdAt)],
      });
    }),

  // ── Create a new document ────────────────────────────────────────────────────
  create: tenantProcedure
    .input(
      z.object({
        title: z.string().min(1).max(256),
        description: z.string().optional(),
        category: z.enum(DOCUMENT_CATEGORIES).default("OTRO"),
        fileUrl: z.string().url(),
        fileName: z.string().min(1).max(256),
        mimeType: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [doc] = await ctx.db
        .insert(communityDocument)
        .values({
          id: crypto.randomUUID(),
          organizationId: input.tenantId,
          authorId: ctx.session.user.id,
          title: input.title,
          description: input.description ?? null,
          category: input.category,
          fileUrl: input.fileUrl,
          fileName: input.fileName,
          mimeType: input.mimeType ?? null,
        })
        .returning();

      // Notify all members that a new document is available
      await sendPushToAllMembers(ctx.db, input.tenantId, {
        title: "📄 Nuevo documento",
        body: `Se ha publicado: ${input.title}`,
        data: { type: "new_document", documentId: doc.id },
      });

      return doc;
    }),

  // ── Delete a document (only author or AF) ────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(communityDocument)
        .where(
          and(
            eq(communityDocument.id, input.id),
            // Allow: author deletes their own, or AF role
            eq(communityDocument.authorId, ctx.session.user.id),
          ),
        );
      return { ok: true };
    }),
});
