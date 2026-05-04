import { type NextRequest, NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { session, user } from "@acme/db/schema";
import { eq, and, gt } from "drizzle-orm";

/**
 * GET /api/auth/set-session?token=<sessionToken>
 *
 * Validates the session token in the DB and sets a proper
 * server-side HttpOnly cookie so Better Auth's getSession() can read it.
 * Then redirects to /communities or /superadmin.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  // Build the correct public base URL from forwarded headers (Coolify reverse proxy)
  const forwardedProto = req.headers.get("x-forwarded-proto") ?? "https";
  const forwardedHost =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    "aconvi.com";
  const baseUrl = `${forwardedProto}://${forwardedHost}`;

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/login?error=missing_token`);
  }

  // Verify the session actually exists and is not expired
  const foundSession = await db.query.session
    .findFirst({
      where: and(eq(session.token, token), gt(session.expiresAt, new Date())),
    })
    .catch(() => null);

  if (!foundSession) {
    console.warn(`[SET_SESSION] Session not found or expired for token: ${token.slice(0, 8)}...`);
    return NextResponse.redirect(`${baseUrl}/login?error=invalid_session`);
  }

  // Look up the user role to determine where to redirect
  const foundUser = await db.query.user
    .findFirst({ where: eq(user.id, foundSession.userId) })
    .catch(() => null);

  const redirectPath =
    foundUser?.role === "SuperAdmin" ? "/superadmin" : "/communities";
  const redirectUrl = `${baseUrl}${redirectPath}`;

  // Build the response with a proper Set-Cookie header
  const response = NextResponse.redirect(redirectUrl);

  // Set both cookie variants so it works on HTTP and HTTPS
  const maxAge = 45 * 24 * 60 * 60; // 45 days
  const isSecure = forwardedProto === "https";

  // Standard cookie (works on HTTP and HTTPS)
  response.cookies.set("better-auth.session_token", token, {
    path: "/",
    maxAge,
    httpOnly: true,
    sameSite: "lax",
    secure: false, // Allow on HTTP too
  });

  // Secure variant (only gets set if HTTPS — browsers ignore __Secure- on HTTP)
  if (isSecure) {
    response.cookies.set("__Secure-better-auth.session_token", token, {
      path: "/",
      maxAge,
      httpOnly: true,
      sameSite: "lax",
      secure: true,
    });
  }

  console.log(
    `[SET_SESSION] ✅ Session set for user "${foundUser?.name ?? foundSession.userId}" → redirecting to ${redirectUrl}`,
  );
  return response;
}
