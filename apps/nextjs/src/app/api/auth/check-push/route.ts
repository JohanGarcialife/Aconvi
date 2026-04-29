import { type NextRequest, NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { pushLoginRequest } from "@acme/db/schema";
import { eq, and, gt } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get("requestId");

    if (!requestId) {
      return NextResponse.json({ status: "error", error: "requestId requerido." }, { status: 400 });
    }

    const loginReq = await db.query.pushLoginRequest.findFirst({
      where: eq(pushLoginRequest.id, requestId),
    });

    if (!loginReq) {
      return NextResponse.json({ status: "error", error: "Solicitud no encontrada." }, { status: 404 });
    }

    // Check expiry
    if (new Date() > loginReq.expiresAt) {
      // Mark as expired if still pending
      if (loginReq.status === "PENDING") {
        await db
          .update(pushLoginRequest)
          .set({ status: "EXPIRED" })
          .where(eq(pushLoginRequest.id, requestId));
      }
      return NextResponse.json({ status: "expired" });
    }

    if (loginReq.status === "APPROVED" && loginReq.sessionToken) {
      return NextResponse.json({ status: "approved", sessionToken: loginReq.sessionToken });
    }

    if (loginReq.status === "REJECTED") {
      return NextResponse.json({ status: "rejected" });
    }

    if (loginReq.status === "EXPIRED") {
      return NextResponse.json({ status: "expired" });
    }

    // Still pending
    return NextResponse.json({ status: "pending" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("[API_CHECK_PUSH]", error);
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
