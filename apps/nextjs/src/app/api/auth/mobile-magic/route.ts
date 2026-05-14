import { type NextRequest, NextResponse } from "next/server";

/**
 * Magic Link callback handler for Expo deep link.
 * When the user taps the Magic Link in their email, better-auth redirects to:
 *   /api/auth/mobile-magic?token=xxx
 * This endpoint redirects to the Expo deep link scheme (aconvi://)
 * so the Expo plugin can capture the session.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", req.url));
  }

  // Redirect to Expo deep link — the @better-auth/expo plugin will intercept this
  // and exchange the token for a session stored in SecureStore
  const expoDeepLink = `aconvi://auth?token=${encodeURIComponent(token)}`;
  return NextResponse.redirect(expoDeepLink);
}
