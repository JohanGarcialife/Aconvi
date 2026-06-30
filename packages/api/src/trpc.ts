/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 3)
 *
 * tl;dr - this is where all the tRPC server stuff is created and plugged in.
 * The pieces you will need to use are documented accordingly near the end
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z, ZodError } from "zod/v4";

import type { Auth } from "@acme/auth";
import { db } from "@acme/db/client";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */

import { eq } from "drizzle-orm";
import { user as userSchema, session as sessionSchema } from "@acme/db/schema";

export const createTRPCContext = async (opts: {
  headers: Headers;
  auth: Auth;
}) => {
  const authApi = opts.auth.api;
  const authHeader = opts.headers.get("authorization") || opts.headers.get("Authorization") || "";
  console.log("[createTRPCContext] trpc headers Authorization:", authHeader);
  
  let sessionResult = await authApi.getSession({
    headers: opts.headers,
  });

  if (!sessionResult && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7).trim();
      const foundSession = await db.query.session.findFirst({
        where: eq(sessionSchema.token, token),
      });

      if (foundSession && foundSession.expiresAt > new Date()) {
        const foundUser = await db.query.user.findFirst({
          where: eq(userSchema.id, foundSession.userId),
        });

        if (foundUser) {
          sessionResult = {
            session: {
              id: foundSession.id,
              userId: foundSession.userId,
              token: foundSession.token,
              expiresAt: foundSession.expiresAt,
            },
            user: {
              id: foundUser.id,
              email: foundUser.email,
              name: foundUser.name,
              image: foundUser.image,
              role: foundUser.role ?? "Vecino",
            },
          };
        }
      }
    } catch (err) {
      console.error("[createTRPCContext] Failed to manual resolve session:", err);
    }
  }

  console.log("[createTRPCContext] resolved session user:", sessionResult?.user?.id, "role:", sessionResult?.user?.role);
  return {
    authApi: authApi as any,
    session: sessionResult as {
      user: {
        id: string;
        email: string;
        name: string;
        image?: string | null;
        role?: string;
      };
      session: {
        id: string;
        userId: string;
        token: string;
        expiresAt: Date;
      };
    } | null,
    db,
  };
};
/**
 * 2. INITIALIZATION
 *
 * This is where the trpc api is initialized, connecting the context and
 * transformer
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError:
        error.cause instanceof ZodError
          ? z.flattenError(error.cause as ZodError<Record<string, unknown>>)
          : null,
    },
  }),
});

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these
 * a lot in the /src/server/api/routers folder
 */

/**
 * This is how you create new routers and subrouters in your tRPC API
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an articifial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev 100-500ms
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

/**
 * Public (unauthed) procedure
 *
 * This is the base piece you use to build new queries and mutations on your
 * tRPC API. It does not guarantee that a user querying is authorized, but you
 * can still access user session data if they are logged in
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        // infers the `session` as non-nullable
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  });

/**
 * Tenant (Comunidad) protected procedure
 *
 * This procedure enforces that the caller provides a `tenantId` and ensures
 * the authenticated user is an active member of that tenant.
 */
export const tenantProcedure = protectedProcedure
  .input(z.object({ tenantId: z.string().min(1) }))
  .use(async ({ ctx, input, next }) => {
    const memberRecord = await ctx.db.query.member.findFirst({
      where: (table, { eq, and }) =>
        and(
          eq(table.userId, ctx.session.user.id),
          eq(table.organizationId, input.tenantId)
        ),
    });

    if (!memberRecord) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "No tienes acceso a esta comunidad.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        tenant: {
          id: input.tenantId,
          role: memberRecord.role,
        },
      },
    });
  });



/**
 * SuperAdmin (SaaS) protected procedure
 *
 * This procedure enforces that the caller is a system administrator
 * ("SuperAdmin" or "AgenteAconvi") globally in the user table.
 */
export const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  // BetterAuth / DB user role
  const userRole = (ctx.session.user as any).role || "Vecino";
  if (userRole !== "SuperAdmin" && userRole !== "AgenteAconvi") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acceso denegado. Se requieren permisos de SuperAdmin.",
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.session.user,
    },
  });
});
