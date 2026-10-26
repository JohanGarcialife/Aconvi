import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";

import { api, queryClient } from "~/utils/api";

const TENANT_ID = "org_aconvi_demo";

const NAVY = "#0F2942";
const SUBTEXT = "#5A7690";
const GREEN = "#00875A";
const GREEN_BG = "#E6F4EF";
const RED = "#EF4444";
const RED_BG = "#FEF2F2";
const AMBER = "#D97706";
const AMBER_BG = "#FEF3C7";
const SLATE = "#475569";
const SLATE_BG = "#E8EEF3";
const CARD_BORDER = "#E8EEF3";
const BG = "#F7FAFC";

function buildQrMatrix(seed: string): boolean[][] {
  const size = 21;
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );

  const placeFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        if (grid[r0 + r]) {
          grid[r0 + r]![c0 + c] = isBorder || isCenter;
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= size - 8;
      const inBottomLeft = r >= size - 8 && c < 8;
      if (inTopLeft || inTopRight || inBottomLeft) continue;
      if (r === 6 || c === 6) {
        grid[r]![c] = (r + c) % 2 === 0;
        continue;
      }
      hash ^= (r * 31 + c * 17) & 0xff;
      hash = Math.imul(hash, 16777619);
      grid[r]![c] = Math.abs(hash) % 10 < 5;
    }
  }
  return grid;
}

export default function AfJuntasScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanSuccessMessage, setScanSuccessMessage] = useState<string | null>(
    null,
  );
  const [agendaVisible, setAgendaVisible] = useState(false);

  const { data: portfolio, isLoading } = useQuery(
    api.meeting.portfolio.queryOptions({ tenantId: TENANT_ID }),
  );

  const activeJunta = portfolio?.featuredJunta;

  const { data: attendanceData } = useQuery({
    ...api.meeting.attendance.queryOptions({
      tenantId: TENANT_ID,
      sessionId: activeJunta?.id ?? "00000000-0000-0000-0000-000000000000",
    }),
    enabled: Boolean(activeJunta?.id),
    refetchInterval: 3000,
  });

  const quorumReached =
    (attendanceData?.missingForQuorumPct ?? 100) <= 0 ||
    (attendanceData?.participationPct ?? 0) >= 50;

  const startMeetingMutation = useMutation(
    api.meeting.startMeeting.mutationOptions({
      onSuccess: (data) => {
        void queryClient.invalidateQueries();
        router.push({
          pathname: "/(af)/orden-del-dia" as any,
          params: { sessionId: data.sessionId },
        });
      },
      onError: (err: any) => {
        Alert.alert("Error", err?.message || "No se pudo iniciar la junta.");
      },
    }),
  );

  const scanAttendanceQrMutation = useMutation(
    api.meeting.scanAttendanceQr.mutationOptions({
      onSuccess: async (data) => {
        await queryClient.invalidateQueries();
        setScanSuccessMessage(
          `¡Asistencia registrada! ${data.owner.name} (${data.owner.door} · ${data.owner.coefficient} %)`,
        );
        setTimeout(() => setScanSuccessMessage(null), 4000);
        setScannerVisible(false);
      },
      onError: (err: any) => {
        Alert.alert(
          "Error al escanear",
          err?.message || "Código QR no válido.",
        );
      },
    }),
  );

  const closeSessionMutation = useMutation(
    api.voting.close.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries();
        setAgendaVisible(false);
        Alert.alert(
          "Junta cerrada",
          "Se ha cerrado la junta, generado el acta automáticamente y creado las órdenes de trabajo aprobadas.",
        );
      },
      onError: (err: any) => {
        Alert.alert("Error", err?.message || "No se pudo cerrar la junta.");
      },
    }),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const qrMatrix = useMemo(
    () => buildQrMatrix(activeJunta?.id ?? "junta-jardines-del-turia"),
    [activeJunta?.id],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Image
          source={require("../../../assets/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => router.push("/(af)/comunicados" as any)}
          >
            <Ionicons name="notifications-outline" size={24} color={NAVY} />
            <View style={styles.bellDot} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.avatarCircle}
            onPress={() => router.push("/(af)/comunidades" as any)}
          >
            <Text style={styles.avatarInitials}>JL</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={GREEN}
          />
        }
      >
        {/* Community Header */}
        <TouchableOpacity
          style={styles.communityHeader}
          activeOpacity={0.8}
          onPress={() => router.push("/(af)/comunidades" as any)}
        >
          <View style={styles.communityIconBox}>
            <Ionicons name="business-outline" size={28} color={GREEN} />
          </View>
          <View style={styles.communityHeaderText}>
            <View style={styles.communityTitleRow}>
              <Text style={styles.communityName}>Jardines del Turia</Text>
              <Ionicons name="chevron-down" size={20} color={NAVY} />
            </View>
            <Text style={styles.communityAddress}>
              C/ Poeta Querol, 8 · Valencia
            </Text>
            <Text style={styles.communityOwners}>42 propietarios</Text>
          </View>
        </TouchableOpacity>

        {isLoading && !portfolio ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={GREEN} />
          </View>
        ) : null}

        {/* Juntas Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="calendar-outline" size={22} color={GREEN} />
              <Text style={styles.cardTitle}>Juntas</Text>
            </View>
            <TouchableOpacity
              style={styles.seeAllBtn}
              onPress={() => setAgendaVisible(true)}
            >
              <Text style={styles.seeAllText}>Ver calendario</Text>
              <Ionicons name="chevron-forward" size={15} color={GREEN} />
            </TouchableOpacity>
          </View>

          <View style={styles.juntaInnerCard}>
            <TouchableOpacity
              style={styles.juntaTopRow}
              activeOpacity={0.85}
              onPress={() => setAgendaVisible(true)}
            >
              <View style={styles.timeBadge}>
                <Text style={styles.timeBadgeText}>08:45</Text>
              </View>
              <View style={styles.juntaInfoCol}>
                <Text style={styles.juntaTitle}>
                  {activeJunta?.title ?? "Junta ordinaria"}
                </Text>
                <Text style={styles.juntaSub}>
                  1ª convocatoria · 2ª a las 09:15
                </Text>
                <Text style={styles.juntaSub}>42 propietarios</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.juntaDivider} />

            <View style={styles.juntaActionsRow}>
              <TouchableOpacity
                style={styles.primaryActionBtn}
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: "/(af)/asistencia" as any,
                    params: activeJunta?.id
                      ? { sessionId: activeJunta.id }
                      : {},
                  })
                }
              >
                <Ionicons name="people-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>Asistencia</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionBtn}
                activeOpacity={0.85}
                onPress={() => setScannerVisible(true)}
              >
                <Ionicons name="qr-code-outline" size={17} color={NAVY} />
                <Text style={styles.secondaryActionText}>Escanear QR</Text>
              </TouchableOpacity>

              {quorumReached && (
                <TouchableOpacity
                  style={styles.startMeetingInlineBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (activeJunta?.id) {
                      startMeetingMutation.mutate({
                        tenantId: TENANT_ID,
                        sessionId: activeJunta.id,
                      });
                    }
                  }}
                  disabled={startMeetingMutation.isPending}
                >
                  {startMeetingMutation.isPending ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="play" size={16} color="#FFFFFF" />
                      <Text style={styles.startMeetingInlineText}>
                        Iniciar junta
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {scanSuccessMessage && (
              <View style={styles.scanSuccessBanner}>
                <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                <Text style={styles.scanSuccessText}>{scanSuccessMessage}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Pendientes Section Header */}
        <View style={styles.pendingSectionHeader}>
          <View style={styles.pendingHeaderLeft}>
            <Ionicons name="checkmark-circle-outline" size={26} color={GREEN} />
            <View>
              <Text style={styles.pendingSectionTitle}>Pendientes</Text>
              <Text style={styles.pendingSectionSub}>3 requieren atención</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.seeAllBtn}
            onPress={() => router.push("/(af)/incidencias" as any)}
          >
            <Text style={styles.seeAllText}>Ver todos</Text>
            <Ionicons name="chevron-forward" size={15} color={GREEN} />
          </TouchableOpacity>
        </View>

        {/* Pendientes List Card */}
        <View style={styles.card}>
          {/* Item 1 */}
          <View style={styles.pendingRow}>
            <View
              style={[styles.pendingIconCircle, { backgroundColor: RED_BG }]}
            >
              <Ionicons name="warning-outline" size={20} color={RED} />
            </View>
            <View style={styles.pendingTextCol}>
              <Text style={styles.pendingItemTitle}>Ascensor averiado</Text>
              <Text style={styles.pendingItemSub}>
                Portal 1 · Asignar proveedor
              </Text>
              <View style={styles.statusDotRow}>
                <View style={[styles.statusDot, { backgroundColor: RED }]} />
                <Text style={[styles.statusTimeText, { color: RED }]}>
                  Hace 12 min
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.pillBtn}
              onPress={() => router.push("/(af)/incidencias" as any)}
            >
              <Text style={styles.pillBtnText}>Gestionar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rowDivider} />

          {/* Item 2 */}
          <View style={styles.pendingRow}>
            <View
              style={[styles.pendingIconCircle, { backgroundColor: AMBER_BG }]}
            >
              <Ionicons name="water-outline" size={20} color={AMBER} />
            </View>
            <View style={styles.pendingTextCol}>
              <Text style={styles.pendingItemTitle}>Fuga de agua</Text>
              <Text style={styles.pendingItemSub}>
                Portal 2 · Aprobar presupuesto
              </Text>
              <View style={styles.statusDotRow}>
                <View style={[styles.statusDot, { backgroundColor: AMBER }]} />
                <Text style={[styles.statusTimeText, { color: AMBER }]}>
                  Hace 1h
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.pillBtn}
              onPress={() => router.push("/(af)/incidencias" as any)}
            >
              <Text style={styles.pillBtnText}>Gestionar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rowDivider} />

          {/* Item 3 */}
          <View style={styles.pendingRow}>
            <View
              style={[styles.pendingIconCircle, { backgroundColor: SLATE_BG }]}
            >
              <Ionicons name="sparkles-outline" size={20} color={SLATE} />
            </View>
            <View style={styles.pendingTextCol}>
              <Text style={styles.pendingItemTitle}>Limpieza de portales</Text>
              <Text style={styles.pendingItemSub}>
                Portal 1 · Validar trabajo
              </Text>
              <View style={styles.statusDotRow}>
                <View
                  style={[styles.statusDot, { backgroundColor: SUBTEXT }]}
                />
                <Text style={[styles.statusTimeText, { color: SUBTEXT }]}>
                  Hace 2h
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.pillBtn}
              onPress={() => router.push("/(af)/incidencias" as any)}
            >
              <Text style={styles.pillBtnText}>Gestionar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom CTA: Ver todas las comunidades */}
        <TouchableOpacity
          style={styles.allCommunitiesCard}
          activeOpacity={0.85}
          onPress={() => router.push("/(af)/comunidades" as any)}
        >
          <View style={styles.allCommunitiesIcon}>
            <Ionicons name="business-outline" size={20} color={GREEN} />
          </View>
          <Text style={styles.allCommunitiesText}>
            Ver todas las comunidades
          </Text>
          <Ionicons name="chevron-forward" size={18} color={SUBTEXT} />
        </TouchableOpacity>
      </ScrollView>

      {/* QR Code Modal */}
      <Modal
        visible={qrVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQrVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setQrVisible(false)}
        >
          <View
            style={styles.qrModalCard}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>Código QR de asistencia</Text>
              <TouchableOpacity onPress={() => setQrVisible(false)}>
                <Ionicons name="close" size={24} color={NAVY} />
              </TouchableOpacity>
            </View>
            <Text style={styles.qrModalSub}>
              Jardines del Turia · {activeJunta?.title ?? "Junta ordinaria"}
            </Text>

            <View style={styles.qrBox}>
              {qrMatrix.map((row, rIdx) => (
                <View key={rIdx} style={styles.qrRow}>
                  {row.map((cell, cIdx) => (
                    <View
                      key={cIdx}
                      style={[
                        styles.qrCell,
                        { backgroundColor: cell ? NAVY : "#FFFFFF" },
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>

            <Text style={styles.qrHelpText}>
              Muestra este código en la entrada de la sala para registrar la
              asistencia de los propietarios automáticamente.
            </Text>

            <TouchableOpacity
              style={styles.qrPrimaryBtn}
              onPress={() => {
                setQrVisible(false);
                router.push({
                  pathname: "/(af)/asistencia" as any,
                  params: activeJunta?.id ? { sessionId: activeJunta.id } : {},
                });
              }}
            >
              <Ionicons name="people-outline" size={18} color="#FFFFFF" />
              <Text style={styles.qrPrimaryBtnText}>
                Ir a lista de asistencia
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Agenda / Junta Details Modal */}
      <Modal
        visible={agendaVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAgendaVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.agendaModalCard}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>
                {activeJunta?.title ?? "Junta ordinaria"}
              </Text>
              <TouchableOpacity onPress={() => setAgendaVisible(false)}>
                <Ionicons name="close" size={24} color={NAVY} />
              </TouchableOpacity>
            </View>
            <Text style={styles.qrModalSub}>
              Jardines del Turia · 1ª conv. 08:45 · 2ª conv. 09:15
            </Text>

            <ScrollView style={{ maxHeight: 320, marginVertical: 12 }}>
              <Text style={styles.agendaSectionLabel}>ORDEN DEL DÍA</Text>
              {(activeJunta?.items ?? []).length > 0 ? (
                (activeJunta?.items ?? []).map((item: any, idx: number) => (
                  <View key={item.id ?? idx} style={styles.agendaItemBox}>
                    <Text style={styles.agendaItemTitle}>
                      Punto {idx + 1}. {item.title}
                    </Text>
                    {item.budget ? (
                      <Text style={styles.agendaItemBudget}>
                        Importe / Presupuesto: {item.budget}
                      </Text>
                    ) : null}
                  </View>
                ))
              ) : (
                <View style={styles.agendaItemBox}>
                  <Text style={styles.agendaItemTitle}>
                    Punto 1. Aprobación de cuentas anuales y presupuesto 2026
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={styles.qrPrimaryBtn}
                onPress={() => {
                  setAgendaVisible(false);
                  router.push({
                    pathname: "/(af)/asistencia" as any,
                    params: activeJunta?.id
                      ? { sessionId: activeJunta.id }
                      : {},
                  });
                }}
              >
                <Ionicons name="people-outline" size={18} color="#FFFFFF" />
                <Text style={styles.qrPrimaryBtnText}>
                  Pasar lista de asistencia
                </Text>
              </TouchableOpacity>

              {activeJunta?.id && activeJunta.status === "OPEN" && (
                <TouchableOpacity
                  style={styles.closeJuntaBtn}
                  disabled={closeSessionMutation.isPending}
                  onPress={() => {
                    closeSessionMutation.mutate({
                      tenantId: TENANT_ID,
                      sessionId: activeJunta.id,
                    });
                  }}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color={NAVY}
                  />
                  <Text style={styles.closeJuntaBtnText}>
                    {closeSessionMutation.isPending
                      ? "Cerrando junta y generando acta..."
                      : "Cerrar junta y generar acta"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
      {/* Scanner Modal (Rol AF) */}
      <Modal
        visible={scannerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setScannerVisible(false)}
      >
        <View style={styles.scannerModalOverlay}>
          <View style={styles.scannerModalCard}>
            <View style={styles.scannerModalHeader}>
              <View>
                <Text style={styles.scannerModalTitle}>Escanear código QR</Text>
                <Text style={styles.scannerModalSub}>
                  Apunta a la pantalla del móvil del propietario
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setScannerVisible(false)}
                style={styles.scannerCloseBtn}
              >
                <Ionicons name="close" size={24} color={NAVY} />
              </TouchableOpacity>
            </View>

            {/* Viewfinder Graphic */}
            <View style={styles.viewfinderBox}>
              <View style={styles.viewfinderFrame}>
                <View style={styles.viewfinderCornerTL} />
                <View style={styles.viewfinderCornerTR} />
                <View style={styles.viewfinderCornerBL} />
                <View style={styles.viewfinderCornerBR} />
                <View style={styles.viewfinderScanLine} />
              </View>
              <Text style={styles.viewfinderHint}>
                Cámara lista para lectura de QR
              </Text>
            </View>

            {/* Quick scan for registered absent owners */}
            <View style={styles.quickScanSection}>
              <Text style={styles.quickScanSectionTitle}>
                Simular escaneo de vecino presente:
              </Text>
              <ScrollView
                style={{ maxHeight: 180 }}
                showsVerticalScrollIndicator={false}
              >
                {(attendanceData?.owners ?? [])
                  .filter((o: any) => !o.present)
                  .slice(0, 5)
                  .map((o: any) => (
                    <TouchableOpacity
                      key={o.memberId}
                      style={styles.quickScanItem}
                      onPress={() => {
                        if (activeJunta?.id) {
                          scanAttendanceQrMutation.mutate({
                            tenantId: TENANT_ID,
                            sessionId: activeJunta.id,
                            qrPayload: `ACONVI_QR:${activeJunta.id}:${o.memberId}:${o.userId}`,
                          });
                        }
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.quickScanOwnerName}>{o.name}</Text>
                        <Text style={styles.quickScanOwnerMeta}>
                          Puerta {o.door} · {o.coefficient} %
                        </Text>
                      </View>
                      <View style={styles.quickScanActionBadge}>
                        <Ionicons
                          name="qr-code-outline"
                          size={15}
                          color="#FFFFFF"
                        />
                        <Text style={styles.quickScanActionText}>Escanear</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>

            <TouchableOpacity
              style={styles.scannerCancelBtn}
              onPress={() => setScannerVisible(false)}
            >
              <Text style={styles.scannerCancelBtnText}>Cerrar lector</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: BG,
  },
  logo: {
    width: 132,
    height: 36,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  bellBtn: {
    position: "relative",
    padding: 4,
  },
  bellDot: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: RED,
    borderWidth: 1.5,
    borderColor: BG,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#D1E3F0",
  },
  avatarInitials: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 32,
  },
  communityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 6,
    marginBottom: 18,
  },
  communityIconBox: {
    width: 62,
    height: 62,
    borderRadius: 16,
    backgroundColor: "#D7F1E7",
    alignItems: "center",
    justifyContent: "center",
  },
  communityHeaderText: {
    flex: 1,
  },
  communityTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  communityName: {
    fontSize: 22,
    fontWeight: "700",
    color: NAVY,
  },
  communityAddress: {
    fontSize: 14,
    color: SUBTEXT,
    marginTop: 2,
  },
  communityOwners: {
    fontSize: 14,
    color: SUBTEXT,
    marginTop: 1,
  },
  loadingBox: {
    paddingVertical: 20,
    alignItems: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    shadowColor: NAVY,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: NAVY,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: GREEN,
  },
  juntaInnerCard: {
    backgroundColor: "#F9FBFC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EBF1F6",
  },
  juntaTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  timeBadge: {
    backgroundColor: "#DFF4EC",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  timeBadgeText: {
    color: GREEN,
    fontWeight: "700",
    fontSize: 14,
  },
  juntaInfoCol: {
    flex: 1,
  },
  juntaTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: NAVY,
  },
  juntaSub: {
    fontSize: 13.5,
    color: SUBTEXT,
    marginTop: 2,
  },
  juntaDivider: {
    height: 1,
    backgroundColor: "#E6EEF5",
    marginVertical: 14,
  },
  juntaActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  primaryActionBtn: {
    flex: 1,
    backgroundColor: GREEN,
    borderRadius: 24,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryActionBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#CBD8E6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  secondaryActionText: {
    color: NAVY,
    fontSize: 14,
    fontWeight: "600",
  },
  startMeetingInlineBtn: {
    backgroundColor: "#0D9488",
    borderRadius: 24,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#0D9488",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  startMeetingInlineText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
  },
  scanSuccessBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#DCFCE7",
    borderColor: "#86EFAC",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
  },
  scanSuccessText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#166534",
    flex: 1,
  },
  scannerModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "flex-end",
  },
  scannerModalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "85%",
  },
  scannerModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  scannerModalTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: NAVY,
  },
  scannerModalSub: {
    fontSize: 13,
    color: SUBTEXT,
    marginTop: 2,
  },
  scannerCloseBtn: {
    padding: 4,
  },
  viewfinderBox: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F172A",
    borderRadius: 16,
    paddingVertical: 24,
    marginBottom: 18,
  },
  viewfinderFrame: {
    width: 140,
    height: 140,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  viewfinderCornerTL: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: "#10B981",
  },
  viewfinderCornerTR: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: "#10B981",
  },
  viewfinderCornerBL: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: "#10B981",
  },
  viewfinderCornerBR: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: "#10B981",
  },
  viewfinderScanLine: {
    width: 120,
    height: 2,
    backgroundColor: "#34D399",
    shadowColor: "#34D399",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  viewfinderHint: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 12,
  },
  quickScanSection: {
    marginBottom: 16,
  },
  quickScanSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: NAVY,
    marginBottom: 8,
  },
  quickScanItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 8,
  },
  quickScanOwnerName: {
    fontSize: 13.5,
    fontWeight: "600",
    color: NAVY,
  },
  quickScanOwnerMeta: {
    fontSize: 11.5,
    color: SUBTEXT,
    marginTop: 2,
  },
  quickScanActionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: GREEN,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  quickScanActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  scannerCancelBtn: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  scannerCancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
  },
  pendingSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  pendingHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pendingSectionTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: NAVY,
  },
  pendingSectionSub: {
    fontSize: 13.5,
    color: SUBTEXT,
    marginTop: 1,
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pendingIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingTextCol: {
    flex: 1,
  },
  pendingItemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: NAVY,
  },
  pendingItemSub: {
    fontSize: 13,
    color: SUBTEXT,
    marginTop: 2,
  },
  statusDotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusTimeText: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  pillBtn: {
    backgroundColor: GREEN_BG,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  pillBtnText: {
    color: GREEN,
    fontSize: 13.5,
    fontWeight: "600",
  },
  rowDivider: {
    height: 1,
    backgroundColor: "#EEF3F7",
    marginVertical: 14,
  },
  allCommunitiesCard: {
    backgroundColor: "#EDF7F3",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#D9EDE4",
  },
  allCommunitiesIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#D7F1E7",
    alignItems: "center",
    justifyContent: "center",
  },
  allCommunitiesText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: NAVY,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 41, 66, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 22,
  },
  qrModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
  },
  agendaModalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 22,
  },
  qrModalHeader: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  qrModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
  },
  qrModalSub: {
    width: "100%",
    fontSize: 13.5,
    color: SUBTEXT,
    marginTop: 4,
    marginBottom: 18,
  },
  qrBox: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DCE6F0",
    marginBottom: 16,
  },
  qrRow: {
    flexDirection: "row",
  },
  qrCell: {
    width: 9,
    height: 9,
  },
  qrHelpText: {
    fontSize: 13,
    color: SUBTEXT,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 18,
  },
  qrPrimaryBtn: {
    width: "100%",
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  qrPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontWeight: "700",
  },
  agendaSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: SUBTEXT,
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  agendaItemBox: {
    backgroundColor: "#F7FAFC",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E8EEF3",
  },
  agendaItemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
  },
  agendaItemBudget: {
    fontSize: 13,
    color: GREEN,
    fontWeight: "600",
    marginTop: 4,
  },
  closeJuntaBtn: {
    width: "100%",
    backgroundColor: "#EEF3F8",
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  closeJuntaBtnText: {
    color: NAVY,
    fontSize: 14,
    fontWeight: "700",
  },
});
