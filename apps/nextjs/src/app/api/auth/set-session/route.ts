import { type NextRequest, NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { session, user } from "@acme/db/schema";
import { eq, and, gt } from "drizzle-orm";

/**
 * GET /api/auth/set-session?token=<sessionToken>
 *
 * Validates the session token in the DB and sets a proper
 * server-side cookie so Better Auth's getSession() can read it.
 * Then redirects to /auth-success.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", req.url));
  }

  // Verify the session actually exists and is not expired
  const foundSession = await db.query.session.findFirst({
    where: and(
      eq(session.token, token),
      gt(session.expiresAt, new Date()),
    ),
  }).catch(() => null);

  if (!foundSession) {
    return NextResponse.redirect(new URL("/login?error=invalid_session", req.url));
  }

  // Look up the user role to determine where to redirect
  const foundUser = await db.query.user.findFirst({
    where: eq(user.id, foundSession.userId),
  }).catch(() => null);

  const redirectPath = foundUser?.role === "SuperAdmin" ? "/superadmin" : "/communities";

  // Build the response with a proper Set-Cookie header
  const response = NextResponse.redirect(new URL(redirectPath, req.url));

  // Set the session cookie in the same way Better Auth expects it
  // Better Auth reads "better-auth.session_token" (HTTP) or "__Secure-better-auth.session_token" (HTTPS)
  const isSecure = req.url.startsWith("https://");
  const cookieName = isSecure
    ? "__Secure-better-auth.session_token"
    : "better-auth.session_token";
  const maxAge = 45 * 24 * 60 * 60; // 45 days

  response.cookies.set(cookieName, token, {
    path: "/",
    maxAge,
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
  });

  console.log(`[SET_SESSION] Session set for user ${foundUser?.name ?? foundSession.userId}, redirecting to ${redirectPath}`);
  return response;
}
