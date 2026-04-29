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

    // SIMULATION FOR TESTING (jluis.test)
    if (loginReq.status === "PENDING") {
      const { user } = await import("@acme/db/schema");
      const userForReq = await db.query.user.findFirst({ where: eq(user.id, loginReq.userId) });
      
      if (userForReq?.corporateUsername === "jluis.test") {
        const timeElapsed = new Date().getTime() - loginReq.createdAt.getTime();
        
        // Auto-approve after 4 seconds to simulate waiting for mobile push
        if (timeElapsed > 4000) {
          const { auth } = await import("~/auth/server");
          
          // Let Better Auth natively create the session and generate a valid token
          const session = await auth.api.createSession({
            body: {
              userId: userForReq.id,
              userAgent: req.headers.get("user-agent") ?? "Simulation",
              ipAddress: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "127.0.0.1",
            },
            headers: req.headers,
          });

          await db.update(pushLoginRequest)
            .set({ status: "APPROVED", sessionToken: session.token })
            .where(eq(pushLoginRequest.id, requestId));
            
          return NextResponse.json({ status: "approved", sessionToken: session.token });
        }
      }
    }

    // Still pending
    return NextResponse.json({ status: "pending" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("[API_CHECK_PUSH]", error);
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
