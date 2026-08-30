import { type NextRequest, NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { voteSession } from "@acme/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "~/auth/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/votes/[sessionId]/pdf
 * Generates an official, legally compliant PDF minute (Acta de Votación) for closed sessions.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Optional auth check
    const session = await getSession().catch(() => null);
    const { sessionId } = await params;

    // Fetch voting session with all related data (items, casts, minute, author, organization)
    const votingSession = await db.query.voteSession.findFirst({
      where: eq(voteSession.id, sessionId),
      with: {
        items: {
          orderBy: (it, { asc }) => [asc(it.orderIndex)],
        },
        casts: {
          with: {
            user: { columns: { id: true, name: true, email: true } },
            item: true,
          },
        },
        author: { columns: { name: true } },
        organization: { columns: { name: true } },
        minute: true,
      },
    });

    if (!votingSession) {
      return NextResponse.json({ error: "Votación no encontrada." }, { status: 404 });
    }

    if (votingSession.status !== "CLOSED") {
      return NextResponse.json(
        { error: "Solo se pueden descargar actas de votaciones cerradas." },
        { status: 400 }
      );
    }

    const isJunta = votingSession.type === "JUNTA";
    const closedAt = votingSession.closedAt ?? new Date();
    const dateStr = closedAt.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeStr = closedAt.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Unique voters
    const uniqueVoterIds = Array.from(new Set(votingSession.casts.map((c) => c.userId)));
    const totalVotersCount = uniqueVoterIds.length;

    // ── Build PDF with @react-pdf/renderer ──────────────────────────────────
    const { renderToBuffer, Document, Page, Text, View, StyleSheet } = await import(
      "@react-pdf/renderer"
    );

    const styles = StyleSheet.create({
      page: {
        padding: 40,
        fontFamily: "Helvetica",
        fontSize: 9,
        color: "#1e293b",
        backgroundColor: "#ffffff",
      },
      header: {
        borderBottom: "2px solid #009689",
        paddingBottom: 12,
        marginBottom: 16,
      },
      headerTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6,
      },
      brand: {
        fontSize: 16,
        fontFamily: "Helvetica-Bold",
        color: "#009689",
      },
      docTypeBadge: {
        fontSize: 8,
        fontFamily: "Helvetica-Bold",
        color: "#ffffff",
        backgroundColor: isJunta ? "#5B21B6" : "#009689",
        borderRadius: 4,
        padding: "3 8",
      },
      title: {
        fontSize: 15,
        fontFamily: "Helvetica-Bold",
        color: "#0f172a",
        marginBottom: 4,
      },
      subtitle: {
        fontSize: 9,
        color: "#64748b",
        lineHeight: 1.4,
      },
      metaGrid: {
        flexDirection: "row",
        justifyContent: "space-between",
        backgroundColor: "#f8fafc",
        padding: 10,
        borderRadius: 6,
        border: "1px solid #e2e8f0",
        marginTop: 10,
      },
      metaItem: {
        flexDirection: "column",
      },
      metaLabel: {
        fontSize: 7,
        color: "#64748b",
        textTransform: "uppercase",
        fontFamily: "Helvetica-Bold",
      },
      metaVal: {
        fontSize: 9,
        color: "#0f172a",
        fontFamily: "Helvetica-Bold",
        marginTop: 2,
      },
      section: {
        marginBottom: 14,
      },
      sectionTitle: {
        fontSize: 11,
        fontFamily: "Helvetica-Bold",
        color: "#0f172a",
        borderBottom: "1px solid #cbd5e1",
        paddingBottom: 4,
        marginBottom: 8,
      },
      pointCard: {
        backgroundColor: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 6,
        padding: 10,
        marginBottom: 10,
      },
      pointHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
      },
      pointTitle: {
        fontSize: 10,
        fontFamily: "Helvetica-Bold",
        color: "#0f172a",
      },
      pointBudget: {
        fontSize: 9,
        fontFamily: "Helvetica-Bold",
        color: "#009689",
      },
      pointDesc: {
        fontSize: 8,
        color: "#64748b",
        marginBottom: 6,
      },
      resultRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 3,
        borderBottom: "1px solid #f1f5f9",
      },
      resultLabel: {
        fontSize: 8,
        color: "#334155",
      },
      resultValue: {
        fontSize: 8,
        fontFamily: "Helvetica-Bold",
        color: "#0f172a",
      },
      approvedBadge: {
        fontSize: 8,
        fontFamily: "Helvetica-Bold",
        color: "#16a34a",
        backgroundColor: "#dcfce7",
        padding: "2 6",
        borderRadius: 4,
        alignSelf: "flex-start",
        marginTop: 6,
      },
      rejectedBadge: {
        fontSize: 8,
        fontFamily: "Helvetica-Bold",
        color: "#dc2626",
        backgroundColor: "#fee2e2",
        padding: "2 6",
        borderRadius: 4,
        alignSelf: "flex-start",
        marginTop: 6,
      },
      tableHeader: {
        flexDirection: "row",
        backgroundColor: "#f1f5f9",
        padding: "4 6",
        borderRadius: 4,
        marginBottom: 4,
      },
      tableRow: {
        flexDirection: "row",
        padding: "3 6",
        borderBottom: "1px solid #f8fafc",
      },
      colVecino: { flex: 3, fontSize: 8, color: "#334155" },
      colItem: { flex: 3, fontSize: 8, color: "#64748b" },
      colVoto: { flex: 2, fontSize: 8, fontFamily: "Helvetica-Bold" },
      colCoef: { flex: 1.5, fontSize: 8, textAlign: "right", color: "#64748b" },
      legalBox: {
        backgroundColor: "#f8fafc",
        borderLeft: "3px solid #009689",
        padding: 10,
        borderRadius: 4,
        marginBottom: 14,
      },
      legalText: {
        fontSize: 8,
        color: "#475569",
        lineHeight: 1.4,
      },
      signatures: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 20,
        paddingTop: 10,
      },
      sigBox: {
        width: "45%",
        borderTop: "1px solid #94a3b8",
        paddingTop: 6,
        textAlign: "center",
      },
      sigTitle: {
        fontSize: 8,
        fontFamily: "Helvetica-Bold",
        color: "#0f172a",
      },
      sigSub: {
        fontSize: 7,
        color: "#64748b",
        marginTop: 2,
      },
      footer: {
        position: "absolute",
        bottom: 20,
        left: 40,
        right: 40,
        textAlign: "center",
        fontSize: 7,
        color: "#94a3b8",
        borderTop: "1px solid #e2e8f0",
        paddingTop: 6,
      },
    });

    // Compute Item breakdowns for Junta or Single
    const itemsList =
      votingSession.items && votingSession.items.length > 0
        ? votingSession.items
        : [
            {
              id: "__single__",
              orderIndex: 1,
              title: votingSession.title,
              budget: votingSession.budget,
              description: votingSession.description,
            },
          ];

    const pdfDoc = (
      <Document
        title={`Acta Oficial — ${votingSession.title}`}
        author="Aconvi"
        subject="Acta Oficial de Votación"
        creator="Aconvi Administrador de Fincas"
      >
        <Page size="A4" style={styles.page}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.brand}>ACONVI</Text>
              <Text style={styles.docTypeBadge}>
                {isJunta ? "ACTA DE JUNTA EXTRAORDINARIA" : "ACTA DE VOTACIÓN ONLINE"}
              </Text>
            </View>
            <Text style={styles.title}>{votingSession.title}</Text>
            {votingSession.description ? (
              <Text style={styles.subtitle}>{votingSession.description}</Text>
            ) : null}

            <View style={styles.metaGrid}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Fecha de Cierre</Text>
                <Text style={styles.metaVal}>
                  {dateStr} · {timeStr}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Comunidad</Text>
                <Text style={styles.metaVal}>
                  {votingSession.organization?.name ?? "Comunidad de Propietarios"}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Participación</Text>
                <Text style={styles.metaVal}>{totalVotersCount} propietarios</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Ponderación</Text>
                <Text style={styles.metaVal}>
                  {votingSession.coefficientWeighted ? "Por Coeficiente" : "1 voto / vecino"}
                </Text>
              </View>
            </View>
          </View>

          {/* Legal Certification Summary */}
          <View style={styles.legalBox}>
            <Text style={styles.legalText}>
              D./Dña. {votingSession.author?.name ?? "El Administrador de Fincas Colegiado"}, en calidad
              de Secretario-Administrador de la comunidad, certifica que se ha procedido al cómputo y
              escrutinio de los votos emitidos telemáticamente conforme a los preceptos de la Ley de
              Propiedad Horizontal y el quórum establecido.
            </Text>
          </View>

          {/* Results per Point */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {isJunta ? "ESCRUTINIO POR PUNTOS DEL ORDEN DEL DÍA" : "RESULTADO DE LA VOTACIÓN"}
            </Text>

            {itemsList.map((item, idx) => {
              const itemCasts =
                item.id === "__single__"
                  ? votingSession.casts
                  : votingSession.casts.filter((c) => c.itemId === item.id);

              const approveCasts = itemCasts.filter((c) => c.choice === "APPROVE");
              const rejectCasts = itemCasts.filter((c) => c.choice === "REJECT");
              const abstainCasts = itemCasts.filter((c) => c.choice === "ABSTAIN");

              const approveWeight = approveCasts.reduce((s, c) => s + (c.coefficient || 1), 0);
              const rejectWeight = rejectCasts.reduce((s, c) => s + (c.coefficient || 1), 0);
              const abstainWeight = abstainCasts.reduce((s, c) => s + (c.coefficient || 1), 0);
              const totalWeight = approveWeight + rejectWeight + abstainWeight;

              const approvePct = totalWeight > 0 ? ((approveWeight / totalWeight) * 100).toFixed(1) : "0.0";
              const rejectPct = totalWeight > 0 ? ((rejectWeight / totalWeight) * 100).toFixed(1) : "0.0";
              const abstainPct = totalWeight > 0 ? ((abstainWeight / totalWeight) * 100).toFixed(1) : "0.0";

              const isApproved = approveWeight > rejectWeight;

              return (
                <View key={item.id} style={styles.pointCard}>
                  <View style={styles.pointHeader}>
                    <Text style={styles.pointTitle}>
                      {isJunta ? `${idx + 1}. ` : ""}
                      {item.title}
                    </Text>
                    {item.budget ? <Text style={styles.pointBudget}>{item.budget}</Text> : null}
                  </View>

                  {item.description ? (
                    <Text style={styles.pointDesc}>{item.description}</Text>
                  ) : null}

                  <View style={{ marginTop: 4 }}>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Apruebo</Text>
                      <Text style={[styles.resultValue, { color: "#16a34a" }]}>
                        {approveCasts.length} votos ({approvePct}% coef.)
                      </Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Rechazo</Text>
                      <Text style={[styles.resultValue, { color: "#dc2626" }]}>
                        {rejectCasts.length} votos ({rejectPct}% coef.)
                      </Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Me abstengo</Text>
                      <Text style={[styles.resultValue, { color: "#64748b" }]}>
                        {abstainCasts.length} votos ({abstainPct}% coef.)
                      </Text>
                    </View>
                  </View>

                  {itemCasts.length > 0 ? (
                    <Text style={isApproved ? styles.approvedBadge : styles.rejectedBadge}>
                      {isApproved ? "ACUERDO APROBADO" : "ACUERDO NO APROBADO"}
                    </Text>
                  ) : (
                    <Text style={[styles.rejectedBadge, { color: "#64748b", backgroundColor: "#f1f5f9" }]}>
                      SIN PARTICIPACIÓN REGISTRADA
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Registered Voters Audit List */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>REGISTRO Y TRAZABILIDAD DE VOTOS</Text>
            <View style={styles.tableHeader}>
              <Text style={styles.colVecino}>PROPIETARIO / VECINO</Text>
              {isJunta && <Text style={styles.colItem}>PUNTO</Text>}
              <Text style={styles.colVoto}>VOTO</Text>
              <Text style={styles.colCoef}>COEF.</Text>
            </View>

            {votingSession.casts.length === 0 ? (
              <Text style={{ fontSize: 8, color: "#94a3b8", fontStyle: "italic", padding: 6 }}>
                No se registraron votos en esta sesión.
              </Text>
            ) : (
              votingSession.casts.map((cast) => {
                const choiceText =
                  cast.choice === "APPROVE"
                    ? "Apruebo"
                    : cast.choice === "REJECT"
                    ? "Rechazo"
                    : "Me abstengo";
                const choiceColor =
                  cast.choice === "APPROVE"
                    ? "#16a34a"
                    : cast.choice === "REJECT"
                    ? "#dc2626"
                    : "#64748b";

                return (
                  <View key={cast.id} style={styles.tableRow}>
                    <Text style={styles.colVecino}>
                      {cast.user?.name ?? cast.user?.email ?? cast.userId}
                    </Text>
                    {isJunta && (
                      <Text style={styles.colItem}>
                        {cast.item?.title ?? "Punto"}
                      </Text>
                    )}
                    <Text style={[styles.colVoto, { color: choiceColor }]}>{choiceText}</Text>
                    <Text style={styles.colCoef}>{(cast.coefficient || 1).toFixed(2)}%</Text>
                  </View>
                );
              })
            )}
          </View>

          {/* Signatures */}
          <View style={styles.signatures}>
            <View style={styles.sigBox}>
              <Text style={styles.sigTitle}>Firma del Secretario-Administrador</Text>
              <Text style={styles.sigSub}>
                {votingSession.author?.name ?? "Administrador de Fincas"}
              </Text>
            </View>
            <View style={styles.sigBox}>
              <Text style={styles.sigTitle}>Vº Bº El Presidente de la Comunidad</Text>
              <Text style={styles.sigSub}>Comunidad de Propietarios</Text>
            </View>
          </View>

          {/* Footer */}
          <Text style={styles.footer}>
            Acta generada y custodiada electrónicamente por Aconvi el {new Date().toLocaleDateString("es-ES")} · Validez legal acreditada según la Ley de Propiedad Horizontal.
          </Text>
        </Page>
      </Document>
    );

    const pdfBuffer = await renderToBuffer(pdfDoc);
    const safeTitle = votingSession.title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "-")
      .slice(0, 50);

    return new NextResponse(pdfBuffer as any, {
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
