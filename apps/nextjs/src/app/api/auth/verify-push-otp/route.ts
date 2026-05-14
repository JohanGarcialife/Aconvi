import { type NextRequest, NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { pushAuthSession, session } from "@acme/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { requestId: string; otpCode: string };
    const { requestId, otpCode } = body;

    if (!requestId || !otpCode) {
      return NextResponse.json({ ok: false, error: "Faltan parámetros requeridos." }, { status: 400 });
    }

    const pushSession = await db.query.pushAuthSession.findFirst({
      where: eq(pushAuthSession.token, requestId),
    });

    if (!pushSession) {
      return NextResponse.json({ ok: false, error: "Solicitud no encontrada." }, { status: 404 });
    }

    if (pushSession.status !== "PENDING") {
      return NextResponse.json({ ok: false, error: `La solicitud está en estado: ${pushSession.status}` }, { status: 400 });
    }

    if (new Date() > pushSession.expiresAt) {
      await db.update(pushAuthSession).set({ status: "EXPIRED" }).where(eq(pushAuthSession.token, requestId));
      return NextResponse.json({ ok: false, error: "El código ha expirado." }, { status: 410 });
    }

    if (pushSession.otpCode !== otpCode.trim()) {
      return NextResponse.json({ ok: false, error: "El código ingresado es incorrecto." }, { status: 401 });
    }

    // ── OTP Correct -> Create Session ──────────────────────────────────────────
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 45); // 45 days
    const now = new Date();

    await db.insert(session).values({
      id: sessionToken,
      token: sessionToken,
      userId: pushSession.userId,
      expiresAt,
      createdAt: now,
      updatedAt: now,
      ipAddress: pushSession.loginIp ?? req.headers.get("x-forwarded-for") ?? "unknown",
      userAgent: pushSession.loginUserAgent ?? req.headers.get("user-agent") ?? "Web",
    });

    // Mark push session as used
    await db.update(pushAuthSession)
      .set({ status: "CONFIRMED" })
      .where(eq(pushAuthSession.token, requestId));

    console.log(`[VERIFY_OTP] ✓ Success for user ${pushSession.userId}. Session created.`);
    
    return NextResponse.json({ ok: true, sessionToken });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("[API_VERIFY_OTP]", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
