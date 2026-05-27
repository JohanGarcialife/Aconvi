import { type NextRequest, NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { user, session } from "@acme/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/auth/get-session
 *
 * Returns the current user's session info including role.
 * Used by the Expo app after mobile-login to decide which flow to show.
 *
 * Auth: Bearer <sessionToken>  (stored in SecureStore as expo_session_token)
 */
export async function GET(req: NextRequest) {
  try {
    // Extract token from Authorization header: "Bearer <token>"
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    if (!token) {
      return NextResponse.json(
        { error: "No authorization token provided" },
        { status: 401 },
      );
    }

    // Look up the session in DB
    const foundSession = await db.query.session.findFirst({
      where: eq(session.token, token),
    });

    if (!foundSession) {
      return NextResponse.json(
        { error: "Session not found or expired" },
        { status: 401 },
      );
    }

    // Check session expiry
    if (foundSession.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Session expired" },
        { status: 401 },
      );
    }

    // Look up the user
    const foundUser = await db.query.user.findFirst({
      where: eq(user.id, foundSession.userId),
    });

    if (!foundUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      session: {
        id: foundSession.id,
        userId: foundSession.userId,
        expiresAt: foundSession.expiresAt,
      },
      user: {
        id: foundUser.id,
        name: foundUser.name,
        email: foundUser.email,
        role: foundUser.role,
        corporateUsername: foundUser.corporateUsername,
        image: foundUser.image,
      },
    });
  } catch (error: any) {
    console.error("[GET_SESSION]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
