import { type NextRequest, NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { pushLoginRequest } from "@acme/db/schema";
import { user } from "@acme/db/schema";
import { eq, and, gt } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { username: string };
    const username_input = body.username?.trim().toLowerCase();

    if (!username_input) {
      return NextResponse.json({ ok: false, error: "Usuario requerido.", code: "MISSING_USERNAME" }, { status: 400 });
    }

    // Look up the user by corporate username
    let foundUser = await db.query.user.findFirst({
      where: eq(user.corporateUsername, username_input),
    });

    // SIMULACIÓN: Crear el usuario jluis.test si no existe para la demo
    if (!foundUser && username_input === "jluis.test") {
      const [newUser] = await db.insert(user).values({
        id: "test-user-" + Date.now(),
        name: "José Luis (Simulación)",
        email: "jluis.test@aconvi.app",
        corporateUsername: "jluis.test",
        role: "Administrador",
      }).returning();
      foundUser = newUser;
    }

    if (!foundUser) {
      return NextResponse.json({ ok: false, error: "Usuario corporativo no encontrado.", code: "USER_NOT_FOUND" }, { status: 404 });
    }

    // Expire any previous pending requests for this user
    await db
      .update(pushLoginRequest)
      .set({ status: "EXPIRED" })
      .where(and(
        eq(pushLoginRequest.userId, foundUser.id),
        eq(pushLoginRequest.status, "PENDING"),
      ));

    // Create a new push login request (expires in 5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const [newRequest] = await db
      .insert(pushLoginRequest)
      .values({
        userId: foundUser.id,
        status: "PENDING",
        requestIp: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null,
        requestUserAgent: req.headers.get("user-agent") ?? null,
        expiresAt,
      })
      .returning();

    // TODO (Phase 2): Send actual push notification via Expo Push API to user's registered device
    // For now, we log the request and allow the mobile app to poll/receive it via WebSocket
    console.log(`[PUSH_LOGIN] User ${foundUser.corporateUsername} requested push login. Request ID: ${newRequest!.id}`);

    return NextResponse.json({
      ok: true,
      requestId: newRequest!.id,
      // Include user info for the push notification (sent to the app)
      userDisplayName: foundUser.name,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("[API_REQUEST_PUSH_LOGIN]", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
