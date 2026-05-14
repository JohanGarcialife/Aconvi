import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { communityDocument } from "@acme/db/schema";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const DOCUMENT_CATEGORIES = [
  "ACTA",
  "ESTATUTO",
  "REGLAMENTO",
  "CONTRATO",
  "PRESUPUESTO",
  "OTRO",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

const DEMO_AUTHOR_ID = "user_admin";

export const documentRouter = createTRPCRouter({
  // ── List all documents for a community ──────────────────────────────────────
  all: publicProcedure
    .input(z.object({ tenantId: z.string().min(1), category: z.string().optional() }))
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
  create: publicProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        title: z.string().min(1).max(256),
        description: z.string().optional(),
        category: z.enum(DOCUMENT_CATEGORIES).default("OTRO"),
        fileUrl: z.string().url(),
        fileName: z.string().min(1).max(256),
        mimeType: z.string().optional(),
        authorId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [doc] = await ctx.db
        .insert(communityDocument)
        .values({
          id: crypto.randomUUID(),
          organizationId: input.tenantId,
          authorId: input.authorId ?? DEMO_AUTHOR_ID,
          title: input.title,
          description: input.description ?? null,
          category: input.category,
          fileUrl: input.fileUrl,
          fileName: input.fileName,
          mimeType: input.mimeType ?? null,
        })
        .returning();

      return doc;
    }),

  // ── Delete a document ────────────────────────────────────────────────────────
  delete: publicProcedure
    .input(z.object({ tenantId: z.string().min(1), id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(communityDocument)
        .where(
          and(
            eq(communityDocument.id, input.id),
            eq(communityDocument.organizationId, input.tenantId),
          ),
        );
      return { ok: true };
    }),
});
