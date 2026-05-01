import { type NextRequest, NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { user } from "@acme/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { username: string; deviceToken: string };
    const username_input = body.username?.trim().toLowerCase();
    const deviceToken = body.deviceToken?.trim();

    if (!username_input || !deviceToken) {
      return NextResponse.json(
        { ok: false, error: "Usuario y deviceToken requeridos.", code: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    // Find professional user
    const foundUser = await db.query.user.findFirst({
      where: eq(user.corporateUsername, username_input),
    });

    if (!foundUser) {
      return NextResponse.json(
        { ok: false, error: "Usuario corporativo no encontrado.", code: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Must be web-activated first
    if (!foundUser.pinActivated) {
      return NextResponse.json(
        { ok: false, error: "Debes activar tu cuenta en la web antes de vincular un dispositivo.", code: "NOT_ACTIVATED" },
        { status: 403 }
      );
    }

    // Register device token
    await db.update(user)
      .set({ deviceToken, deviceActivatedAt: new Date() })
      .where(eq(user.id, foundUser.id));

    // TODO: Send push notification confirming device link
    // await sendPushNotification(deviceToken, { title: "Dispositivo vinculado", body: "Tu móvil ha sido registrado en Aconvi." });
    console.log(`[REGISTER_DEVICE] User ${foundUser.corporateUsername} registered device token.`);

    return NextResponse.json({ ok: true, message: "Dispositivo registrado correctamente." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("[API_REGISTER_DEVICE]", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
