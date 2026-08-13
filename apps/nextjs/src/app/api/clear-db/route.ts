import { NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { incident, incidentHistory, incidentNote } from "@acme/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.delete(incidentNote);
    await db.delete(incidentHistory);
    await db.delete(incident);
    return NextResponse.json({ success: true, message: "Todas las incidencias han sido eliminadas correctamente." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
