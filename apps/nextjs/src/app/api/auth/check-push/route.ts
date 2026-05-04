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
          
          // Create a session directly via DB (Better Auth programmatic bypass)
          const { session } = await import("@acme/db/schema");
          const { randomUUID } = await import("crypto");
          
          const token = randomUUID();
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry
          
          await db.insert(session).values({
            id: token,
            token,
            userId: userForReq.id,
            expiresAt,
            ipAddress: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "127.0.0.1",
            userAgent: req.headers.get("user-agent") ?? "Simulation",
          });

          await db.update(pushLoginRequest)
            .set({ status: "APPROVED", sessionToken: token, updatedAt: new Date() })
            .where(eq(pushLoginRequest.id, requestId));

          return NextResponse.json({ status: "approved", sessionToken: token });
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
