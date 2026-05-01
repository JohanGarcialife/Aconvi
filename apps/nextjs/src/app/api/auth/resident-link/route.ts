import { type NextRequest, NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { user } from "@acme/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { phoneNumber: string; deviceToken: string };
    const phone = body.phoneNumber?.trim();
    const deviceToken = body.deviceToken?.trim();

    if (!phone || !deviceToken) {
      return NextResponse.json(
        { ok: false, error: "Número de móvil y deviceToken requeridos.", code: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    // Normalize: ensure starts with + and only digits after
    const normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;

    // Look up resident by phone number
    const resident = await db.query.user.findFirst({
      where: eq(user.phoneNumber, normalizedPhone),
    });

    if (!resident) {
      // Security: do NOT reveal whether the number exists or not
      console.log(`[RESIDENT_LINK] Phone ${normalizedPhone} not found — silent rejection.`);
      return NextResponse.json({
        ok: false,
        error: "Número de móvil no autorizado. Contacta a tu administrador de finca.",
        code: "PHONE_NOT_FOUND"
      }, { status: 404 });
    }

    // Must be a Vecino (residents only flow)
    if (resident.role !== "Vecino") {
      return NextResponse.json(
        { ok: false, error: "Este flujo es exclusivo para vecinos. Los profesionales usan otro método de acceso.", code: "WRONG_ROLE" },
        { status: 403 }
      );
    }

    // Register device token and mark as phone verified
    await db.update(user)
      .set({
        deviceToken,
        deviceActivatedAt: new Date(),
        phoneNumberVerified: true,
      })
      .where(eq(user.id, resident.id));

    // TODO: Send push confirmation to same device token
    // await sendPushNotification(deviceToken, {
    //   title: "Bienvenido a Aconvi",
    //   body: "Tu número ha sido verificado. Ya puedes acceder a tu comunidad."
    // });
    console.log(`[RESIDENT_LINK] Resident phone ${normalizedPhone} linked device successfully.`);

    return NextResponse.json({ ok: true, message: "Dispositivo vinculado. ¡Bienvenido a Aconvi!" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("[API_RESIDENT_LINK]", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
