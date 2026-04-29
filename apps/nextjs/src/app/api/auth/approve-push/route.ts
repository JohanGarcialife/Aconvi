import { type NextRequest, NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { pushLoginRequest } from "@acme/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "~/auth/server";

/**
 * Internal endpoint for the mobile app to approve a push login request.
 * Called from the Expo app after the user taps "Aprobar acceso" in their notification.
 * 
 * POST /api/auth/approve-push
 * Body: { requestId: string, deviceToken: string }
 * Headers: Authorization: Bearer <session_token_from_app>
 */
export async function POST(req: NextRequest) {
  try {
    // The mobile app must be authenticated to call this endpoint
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
    }

    const body = await req.json() as { requestId: string };
    const { requestId } = body;

    if (!requestId) {
      return NextResponse.json({ ok: false, error: "requestId requerido." }, { status: 400 });
    }

    // Verify the request belongs to the authenticated user
    const loginReq = await db.query.pushLoginRequest.findFirst({
      where: eq(pushLoginRequest.id, requestId),
    });

    if (!loginReq) {
      return NextResponse.json({ ok: false, error: "Solicitud no encontrada." }, { status: 404 });
    }

    if (loginReq.userId !== session.user.id) {
      return NextResponse.json({ ok: false, error: "Esta solicitud no te pertenece." }, { status: 403 });
    }

    if (loginReq.status !== "PENDING") {
      return NextResponse.json({ ok: false, error: `La solicitud ya está en estado: ${loginReq.status}` }, { status: 409 });
    }

    if (new Date() > loginReq.expiresAt) {
      await db.update(pushLoginRequest).set({ status: "EXPIRED" }).where(eq(pushLoginRequest.id, requestId));
      return NextResponse.json({ ok: false, error: "La solicitud ha expirado." }, { status: 410 });
    }

    // Create a web session for this user through Better Auth
    // We reuse the app session token so the web can set its own cookie
    const webSessionToken = session.session.token;

    // Mark the push request as approved and store the session token
    await db
      .update(pushLoginRequest)
      .set({
        status: "APPROVED",
        sessionToken: webSessionToken,
      })
      .where(eq(pushLoginRequest.id, requestId));

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("[API_APPROVE_PUSH]", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
