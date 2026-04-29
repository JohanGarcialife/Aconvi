import { NextRequest, NextResponse } from "next/server";
import * as xlsx from "xlsx";
import { db } from "@acme/db/client";
import { user, member, excelImportJob } from "@acme/db/schema";
import { auth } from "~/auth/server";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return new NextResponse("No autorizado", { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const tenantId = formData.get("tenantId") as string | null;

    if (!file || !tenantId) {
      return new NextResponse("Archivo o tenantId faltante", { status: 400 });
    }

    // 1. Create a tracking job
    const [job] = await db
      .insert(excelImportJob)
      .values({
        organizationId: tenantId,
        status: "PROCESSING",
      })
      .returning();

    // 2. Read file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = xlsx.read(buffer, { type: "buffer" });

    if (!workbook.SheetNames.length) {
      return new NextResponse("El archivo Excel está vacío", { status: 400 });
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    // Expected headers: Nombre, Email, Teléfono, Coeficiente
    const rawData = xlsx.utils.sheet_to_json<Record<string, any>>(worksheet);

    let successCount = 0;
    let errorCount = 0;

    for (const row of rawData) {
      const nombre = row["Nombre"] || row["nombre"] || row["Name"] || "Vecino";
      const email = row["Email"] || row["email"] || row["Correo"];
      let telefono = row["Teléfono"] || row["telefono"] || row["Phone"];
      const coeficiente = parseFloat(row["Coeficiente"] || row["coeficiente"] || "100") || 100;

      // Un vecino necesita al menos un email o teléfono
      if (!email && !telefono) {
        errorCount++;
        continue;
      }

      // Format phone logic if needed (e.g. +34...)
      if (telefono && !telefono.toString().startsWith("+")) {
        telefono = `+34${telefono}`; // Defaulting to Spain for demo, adjust as needed
      }

      try {
        // Find existing user or create stub
        // We use dummy ID and do ON CONFLICT to avoid failing if they exist
        const newUserId = crypto.randomUUID();
        
        await db.insert(user).values({
          id: newUserId,
          name: nombre,
          email: email ? email.toString().toLowerCase() : null,
          phoneNumber: telefono ? telefono.toString() : null,
          role: "vecino",
        }).onConflictDoNothing({ target: user.email }); 
        
        // At this point we might not know the user ID if it existed and was skipped by ON CONFLICT.
        // Let's fetch it to be safe.
        const existingUser = await db.query.user.findFirst({
          where: (u, { eq, or }) => or(
            email ? eq(u.email, email.toString().toLowerCase()) : undefined,
            telefono ? eq(u.phoneNumber, telefono.toString()) : undefined
          ),
        });

        if (!existingUser) {
           errorCount++;
           continue;
        }

        // Add to community (member table)
        await db.insert(member).values({
          id: crypto.randomUUID(),
          organizationId: tenantId,
          userId: existingUser.id,
          role: "vecino",
          coefficient: coeficiente,
          createdAt: new Date(),
        }).onConflictDoNothing(); // if already member, skip

        successCount++;
      } catch (err) {
        console.error("Error importing row:", err);
        errorCount++;
      }
    }

    // Update job status
    const resultJson = JSON.stringify({ successCount, errorCount, total: rawData.length });
    
    await db
      .update(excelImportJob)
      .set({
        status: "COMPLETED",
        resultJson,
      })
      .where(eq(excelImportJob.id, job.id));

    return NextResponse.json({
      ok: true,
      successCount,
      errorCount,
      total: rawData.length,
    });
  } catch (error: any) {
    console.error("[API_IMPORT_EXCEL]", error);
    return new NextResponse(error.message || "Internal Error", { status: 500 });
  }
}
