import { type NextRequest, NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { voteSession, voteMinute, voteOption, voteCast, user } from "@acme/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "~/auth/server";
import { headers } from "next/headers";

/**
 * GET /api/votes/[sessionId]/pdf
 * Generates a properly formatted PDF acta for a closed voting session.
 * Uses a streaming approach to generate PDF bytes inline.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const { sessionId } = await params;

    // Fetch voting session with all related data
    const votingSession = await db.query.voteSession.findFirst({
      where: eq(voteSession.id, sessionId),
      with: {
        options: { orderBy: (o, { desc }) => [desc(o.weightedTotal)] },
        casts: {
          with: {
            user: { columns: { id: true, name: true, email: true } },
            option: { columns: { label: true } },
          },
        },
        author: { columns: { name: true } },
        minute: true,
      },
    });

    if (!votingSession) {
      return NextResponse.json({ error: "Votación no encontrada." }, { status: 404 });
    }

    if (votingSession.status !== "CLOSED") {
      return NextResponse.json({ error: "Solo se pueden descargar actas de votaciones cerradas." }, { status: 400 });
    }

    const totalVotes = votingSession.casts.length;
    const totalWeighted = votingSession.options.reduce((acc, o) => acc + o.weightedTotal, 0);
    const closedAt = votingSession.closedAt ?? new Date();
    const dateStr = closedAt.toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });
    const timeStr = closedAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

    // Winner
    const winner = votingSession.options[0];

    // ── Build PDF as HTML → convert to PDF bytes ──────────────────────────────
    // We use a dynamic import of @react-pdf/renderer server-side renderer
    const { renderToBuffer, Document, Page, Text, View, StyleSheet, Font } = await import("@react-pdf/renderer");

    const styles = StyleSheet.create({
      page: { padding: 48, fontFamily: "Helvetica", fontSize: 10, color: "#1f2937", backgroundColor: "#ffffff" },
      header: { borderBottom: "2px solid #00BDA5", paddingBottom: 16, marginBottom: 20 },
      title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#0F1B2B", marginBottom: 4 },
      subtitle: { fontSize: 10, color: "#6b7280" },
      badge: { fontSize: 8, color: "#ffffff", backgroundColor: "#00BDA5", borderRadius: 4, padding: "2 6", alignSelf: "flex-start", marginTop: 6 },
      section: { marginBottom: 18 },
      sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0F1B2B", borderBottom: "1px solid #e5e7eb", paddingBottom: 4, marginBottom: 10 },
      row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 5, borderBottom: "1px solid #f3f4f6" },
      optionLabel: { flex: 3, fontSize: 9, color: "#374151" },
      optionWinner: { flex: 3, fontSize: 9, color: "#00BDA5", fontFamily: "Helvetica-Bold" },
      optionPct: { flex: 1, textAlign: "right", fontSize: 9, color: "#6b7280" },
      optionCount: { flex: 1, textAlign: "center", fontSize: 9, color: "#374151" },
      voterRow: { flexDirection: "row", paddingVertical: 3, borderBottom: "1px solid #f9fafb" },
      voterName: { flex: 2, fontSize: 8, color: "#374151" },
      voterOption: { flex: 2, fontSize: 8, color: "#6b7280" },
      voterCoef: { flex: 1, textAlign: "right", fontSize: 8, color: "#9ca3af" },
      footer: { position: "absolute", bottom: 24, left: 48, right: 48, textAlign: "center", fontSize: 8, color: "#9ca3af", borderTop: "1px solid #f3f4f6", paddingTop: 8 },
      metaRow: { flexDirection: "row", gap: 24, marginTop: 8 },
      metaItem: { flexDirection: "column" },
      metaLabel: { fontSize: 7, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 },
      metaValue: { fontSize: 9, color: "#374151", fontFamily: "Helvetica-Bold", marginTop: 2 },
      winnerBox: { backgroundColor: "#f0fdfb", borderLeft: "3px solid #00BDA5", padding: "8 12", marginBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
      winnerLabel: { fontSize: 9, color: "#6b7280" },
      winnerValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#00BDA5" },
    });

    const pdfDoc = (
      <Document
        title={`Acta — ${votingSession.title}`}
        author="Aconvi"
        subject="Acta de Votación"
        creator="Aconvi Platform"
      >
        <Page size="A4" style={styles.page}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>ACTA DE VOTACIÓN</Text>
            <Text style={{ fontSize: 13, color: "#374151", marginTop: 2 }}>{votingSession.title}</Text>
            {votingSession.description ? (
              <Text style={{ fontSize: 9, color: "#9ca3af", marginTop: 4 }}>{votingSession.description}</Text>
            ) : null}
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Fecha de Cierre</Text>
                <Text style={styles.metaValue}>{dateStr} — {timeStr}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Administrador</Text>
                <Text style={styles.metaValue}>{votingSession.author?.name ?? "N/A"}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Total Votos</Text>
                <Text style={styles.metaValue}>{totalVotes}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Ponderación</Text>
                <Text style={styles.metaValue}>{votingSession.coefficientWeighted ? "Por Coeficiente" : "Un voto por vecino"}</Text>
              </View>
            </View>
          </View>

          {/* Winner highlight */}
          {winner && (
            <View style={styles.winnerBox}>
              <View>
                <Text style={styles.winnerLabel}>Opción Ganadora</Text>
                <Text style={styles.winnerValue}>{winner.label}</Text>
              </View>
              <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: "#00BDA5" }}>
                {votingSession.coefficientWeighted && totalWeighted > 0
                  ? `${((winner.weightedTotal / totalWeighted) * 100).toFixed(1)}%`
                  : totalVotes > 0
                  ? `${((winner.voteCount / totalVotes) * 100).toFixed(1)}%`
                  : "0%"}
              </Text>
            </View>
          )}

          {/* Results */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>RESULTADOS</Text>
            <View style={[styles.row, { backgroundColor: "#f9fafb" }]}>
              <Text style={[styles.optionLabel, { fontSize: 8, color: "#9ca3af" }]}>OPCIÓN</Text>
              <Text style={[styles.optionCount, { fontSize: 8, color: "#9ca3af" }]}>VOTOS</Text>
              <Text style={[styles.optionPct, { fontSize: 8, color: "#9ca3af" }]}>%</Text>
            </View>
            {votingSession.options.map((opt) => {
              const pct = votingSession.coefficientWeighted && totalWeighted > 0
                ? ((opt.weightedTotal / totalWeighted) * 100).toFixed(2)
                : totalVotes > 0
                ? ((opt.voteCount / totalVotes) * 100).toFixed(2)
                : "0.00";
              const isWinner = winner?.id === opt.id;
              return (
                <View key={opt.id} style={styles.row}>
                  <Text style={isWinner ? styles.optionWinner : styles.optionLabel}>
                    {isWinner ? "★ " : ""}{opt.label}
                  </Text>
                  <Text style={styles.optionCount}>{opt.voteCount}</Text>
                  <Text style={styles.optionPct}>{pct}%</Text>
                </View>
              );
            })}
          </View>

          {/* Voters list */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>REGISTRO DE VOTANTES</Text>
            <View style={[styles.voterRow, { backgroundColor: "#f9fafb" }]}>
              <Text style={[styles.voterName, { fontSize: 7, color: "#9ca3af" }]}>VECINO</Text>
              <Text style={[styles.voterOption, { fontSize: 7, color: "#9ca3af" }]}>OPCIÓN ELEGIDA</Text>
              <Text style={[styles.voterCoef, { fontSize: 7, color: "#9ca3af" }]}>COEF.</Text>
            </View>
            {votingSession.casts.map((cast) => (
              <View key={cast.id} style={styles.voterRow}>
                <Text style={styles.voterName}>{cast.user?.name ?? cast.userId}</Text>
                <Text style={styles.voterOption}>{cast.option?.label ?? "—"}</Text>
                <Text style={styles.voterCoef}>{cast.coefficient.toFixed(3)}</Text>
              </View>
            ))}
          </View>

          {/* Legal footer */}
          <Text style={styles.footer}>
            Acta generada automáticamente por Aconvi el {new Date().toISOString()} · 
            Este documento tiene validez legal según la normativa de comunidades de propietarios. · 
            Plataforma Aconvi — aconvi.app
          </Text>
        </Page>
      </Document>
    );

    const pdfBuffer = await renderToBuffer(pdfDoc);
    const safeTitle = votingSession.title.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 60);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="acta-${safeTitle}-${closedAt.toISOString().slice(0, 10)}.pdf"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    console.error("[API_VOTES_PDF]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
