import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { api, queryClient } from "~/utils/api";

const TENANT_ID = "org_aconvi_demo";

const NAVY = "#133A63";
const NAVY_DARK = "#0F2B48";
const BLUE_MUTED = "#5B87B5";
const GREEN = "#008075";
const GREEN_LIGHT = "#E6F5F3";
const GREEN_SUCCESS = "#16A34A";
const RED_REJECT = "#DC2626";
const BORDER = "#E2E8F0";
const BG = "#F8FAFC";

export default function OrdenDelDiaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = params.sessionId;

  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
    {},
  );
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: agendaData,
    isLoading,
    refetch,
  } = useQuery({
    ...api.meeting.getLiveAgenda.queryOptions({
      tenantId: TENANT_ID,
      sessionId,
    }),
    refetchInterval: 3000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const updateStateMutation = useMutation(
    api.meeting.updateAgendaItemState.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries();
      },
      onError: (err: any) => {
        Alert.alert("Error", err?.message || "No se pudo actualizar el punto.");
      },
    }),
  );

  const notifyAbsenteesMutation = useMutation(
    api.meeting.notifyAbsenteesForPendingItem.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries();
        Alert.alert(
          "Notificación enviada",
          "Se ha notificado formalmente a los propietarios ausentes concediendo el plazo legal de 30 días naturales para manifestar discrepancia (Art. 17.8 LPH).",
        );
      },
      onError: (err: any) => {
        Alert.alert(
          "Error",
          err?.message || "No se pudo notificar a ausentes.",
        );
      },
    }),
  );

  const confirmAgreementMutation = useMutation(
    api.meeting.confirmPendingAgreement.mutationOptions({
      onSuccess: async (data) => {
        await queryClient.invalidateQueries();
        Alert.alert(
          "Acuerdo formalizado",
          data.finalStatus === "APPROVED"
            ? "El acuerdo ha sido formalizado como APROBADO al no haberse alcanzado las discrepancias necesarias."
            : "El acuerdo ha sido RECHAZADO por las discrepancias comunicadas en plazo.",
        );
      },
      onError: (err: any) => {
        Alert.alert(
          "Error",
          err?.message || "No se pudo formalizar el acuerdo.",
        );
      },
    }),
  );

  const closeMeetingMutation = useMutation(
    api.voting.close.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries();
        Alert.alert(
          "Junta finalizada",
          "Se ha finalizado la junta y formalizado el acta con los acuerdos definitivos.",
          [
            {
              text: "Aceptar",
              onPress: () => router.push("/(af)/juntas" as any),
            },
          ],
        );
      },
      onError: (err: any) => {
        Alert.alert("Error", err?.message || "No se pudo finalizar la junta.");
      },
    }),
  );

  const handleToggleExpand = (item: any) => {
    if (expandedItemId === item.id) {
      setExpandedItemId(null);
    } else {
      setExpandedItemId(item.id);
      if (
        item.adminComments !== undefined &&
        commentDrafts[item.id] === undefined
      ) {
        setCommentDrafts((prev) => ({
          ...prev,
          [item.id]: item.adminComments || "",
        }));
      }
    }
  };

  const handleSaveComment = (item: any) => {
    const draft = commentDrafts[item.id];
    if (draft === undefined || draft === item.adminComments) return;
    updateStateMutation.mutate({
      tenantId: TENANT_ID,
      itemId: item.id,
      adminComments: draft,
    });
  };

  const handleQuickStatus = (
    item: any,
    newStatus: "APPROVED" | "REJECTED" | "PENDING",
  ) => {
    updateStateMutation.mutate({
      tenantId: TENANT_ID,
      itemId: item.id,
      itemStatus: newStatus,
    });
  };

  const handleRegisterVote = (item: any) => {
    const activeSessionId = agendaData?.session?.id || sessionId || "";
    const proposalCount = item.proposals?.length ?? 0;
    if (proposalCount > 1) {
      router.push({
        pathname: "/(af)/mano-alzada" as any,
        params: {
          sessionId: activeSessionId,
          itemId: item.id,
        },
      });
    } else {
      router.push({
        pathname: "/(af)/escrutinio" as any,
        params: {
          sessionId: activeSessionId,
          itemId: item.id,
        },
      });
    }
  };

  const handleFinalizeMeeting = () => {
    Alert.alert(
      "Finalizar junta",
      "¿Deseas finalizar la sesión? Se cerrarán las votaciones y se generará el acta definitiva con el escrutinio final.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sí, finalizar",
          style: "destructive",
          onPress: () => {
            const sid = agendaData?.session?.id || sessionId;
            if (sid) {
              closeMeetingMutation.mutate({
                sessionId: sid,
                tenantId: TENANT_ID,
              });
            }
          },
        },
      ],
    );
  };

  const session = agendaData?.session;
  const items = agendaData?.items ?? [];

  const formattedDate = session?.meetingDate
    ? format(new Date(session.meetingDate), "d 'de' MMMM, HH:mm", {
        locale: es,
      })
    : "14 de marzo, 18:30";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.push("/(af)/juntas" as any)}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={NAVY} />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>Orden del día</Text>
          <Text style={styles.topBarSub}>
            Jardines del Turia · {formattedDate}
          </Text>
        </View>

        <View style={styles.liveChip}>
          <View style={styles.livePulseDot} />
          <Text style={styles.liveChipText}>En curso</Text>
        </View>
      </View>

      {/* Main Agenda List */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={GREEN}
              colors={[GREEN]}
            />
          }
        >
          {isLoading && items.length === 0 ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={GREEN} />
            </View>
          ) : null}

          <View style={styles.itemsList}>
            {items.map((item: any, idx: number) => {
              const isExpanded = expandedItemId === item.id;
              const hasComment = Boolean(
                item.adminComments && item.adminComments.trim().length > 0,
              );
              const isApproved = item.itemStatus === "APPROVED";
              const isRejected = item.itemStatus === "REJECTED";
              const isPendingAbsentees =
                item.itemStatus === "PENDING_ABSENTEES";
              const isPending =
                !isApproved && !isRejected && !isPendingAbsentees;

              return (
                <View key={item.id} style={styles.itemCard}>
                  {/* Item Header Row */}
                  <TouchableOpacity
                    style={styles.itemHeaderRow}
                    activeOpacity={0.8}
                    onPress={() => handleToggleExpand(item)}
                  >
                    <Text
                      style={styles.itemTitle}
                      numberOfLines={isExpanded ? undefined : 2}
                    >
                      {idx + 1}. {item.title}
                    </Text>

                    <View style={styles.itemHeaderRight}>
                      {/* Speech bubble comment icon: ONLY when annotations exist */}
                      {hasComment && (
                        <View style={styles.commentBubbleIcon}>
                          <Ionicons
                            name="chatbubble-ellipses-outline"
                            size={18}
                            color="#3B82F6"
                          />
                        </View>
                      )}

                      {/* Status indicator on header */}
                      {isApproved && (
                        <View style={styles.approvedHeaderBadge}>
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color={GREEN_SUCCESS}
                          />
                        </View>
                      )}

                      {isRejected && (
                        <View style={styles.rejectedHeaderBadge}>
                          <Ionicons
                            name="close-circle"
                            size={20}
                            color={RED_REJECT}
                          />
                        </View>
                      )}

                      {isPendingAbsentees && (
                        <View style={styles.pendingAbsenteesHeaderBadge}>
                          <Ionicons
                            name="time-outline"
                            size={18}
                            color="#D97706"
                          />
                        </View>
                      )}

                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={BLUE_MUTED}
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Content View (Punto 2 & Mockup Pantalla 1) */}
                  {isExpanded && (
                    <View style={styles.expandedContent}>
                      {/* Status Pill & Quick Action Buttons */}
                      <View style={styles.expandedStatusRow}>
                        <View
                          style={[
                            styles.statusPill,
                            isApproved
                              ? styles.statusPillApproved
                              : isRejected
                                ? styles.statusPillRejected
                                : isPendingAbsentees
                                  ? styles.statusPillAbsentee
                                  : styles.statusPillVoting,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusPillText,
                              isApproved
                                ? styles.statusPillTextApproved
                                : isRejected
                                  ? styles.statusPillTextRejected
                                  : isPendingAbsentees
                                    ? styles.statusPillTextAbsentee
                                    : styles.statusPillTextVoting,
                            ]}
                          >
                            {isApproved
                              ? "APROBADO"
                              : isRejected
                                ? "RECHAZADO"
                                : isPendingAbsentees
                                  ? "PENDIENTE DE AUSENTES"
                                  : item.requiresVoting !== false
                                    ? "EN VOTACIÓN"
                                    : "INFORMATIVO"}
                          </Text>
                        </View>

                        {/* Quick outcome toggles */}
                        <View style={styles.quickButtonsRow}>
                          <TouchableOpacity
                            style={[
                              styles.quickBtn,
                              styles.quickBtnApprove,
                              isApproved && styles.quickBtnApproveActive,
                            ]}
                            activeOpacity={0.8}
                            onPress={() =>
                              handleQuickStatus(
                                item,
                                isApproved ? "PENDING" : "APPROVED",
                              )
                            }
                          >
                            <Ionicons
                              name="checkmark"
                              size={18}
                              color={isApproved ? "#FFFFFF" : GREEN_SUCCESS}
                            />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.quickBtn,
                              styles.quickBtnReject,
                              isRejected && styles.quickBtnRejectActive,
                            ]}
                            activeOpacity={0.8}
                            onPress={() =>
                              handleQuickStatus(
                                item,
                                isRejected ? "PENDING" : "REJECTED",
                              )
                            }
                          >
                            <Ionicons
                              name="close"
                              size={18}
                              color={isRejected ? "#FFFFFF" : RED_REJECT}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Section for PENDING_ABSENTEES (Punto 6: Art. 17.8 LPH) */}
                      {isPendingAbsentees && (
                        <View style={styles.absenteeCard}>
                          <View style={styles.absenteeHeaderRow}>
                            <Ionicons
                              name="mail-outline"
                              size={16}
                              color="#B45309"
                            />
                            <Text style={styles.absenteeTitle}>
                              Acuerdo pendiente de ausentes (Art. 17.8 LPH)
                            </Text>
                          </View>
                          <Text style={styles.absenteeDesc}>
                            {item.absenteeNotifiedAt
                              ? `Notificado el ${format(new Date(item.absenteeNotifiedAt), "d 'de' MMMM", { locale: es })}. Plazo legal de 30 días naturales para manifestar discrepancia.`
                              : "La mayoría en sala es favorable pero requiere computar el voto presunto de ausentes para formalizar el acuerdo."}
                          </Text>

                          {!item.absenteeNotifiedAt ? (
                            <TouchableOpacity
                              style={styles.notifyAbsenteesBtn}
                              activeOpacity={0.85}
                              onPress={() =>
                                notifyAbsenteesMutation.mutate({
                                  tenantId: TENANT_ID,
                                  itemId: item.id,
                                })
                              }
                              disabled={notifyAbsenteesMutation.isPending}
                            >
                              <Ionicons
                                name="send-outline"
                                size={15}
                                color="#FFFFFF"
                              />
                              <Text style={styles.notifyAbsenteesBtnText}>
                                Notificar a ausentes (30 días)
                              </Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={styles.confirmAgreementBtn}
                              activeOpacity={0.85}
                              onPress={() =>
                                confirmAgreementMutation.mutate({
                                  tenantId: TENANT_ID,
                                  itemId: item.id,
                                })
                              }
                              disabled={confirmAgreementMutation.isPending}
                            >
                              <Ionicons
                                name="checkmark-done"
                                size={16}
                                color="#FFFFFF"
                              />
                              <Text style={styles.confirmAgreementBtnText}>
                                Confirmar acuerdo definitivo
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}

                      {/* Primary Action Button: "Registrar votación" (Punto 2: Oculto si es informativo/sin votación) */}
                      {item.requiresVoting !== false ? (
                        <TouchableOpacity
                          style={styles.registerVoteBtn}
                          activeOpacity={0.85}
                          onPress={() => handleRegisterVote(item)}
                        >
                          <Ionicons
                            name="file-tray-full-outline"
                            size={18}
                            color="#FFFFFF"
                          />
                          <Text style={styles.registerVoteBtnText}>
                            Registrar votación
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.informationalBox}>
                          <Ionicons
                            name="information-circle-outline"
                            size={17}
                            color="#64748B"
                          />
                          <Text style={styles.informationalText}>
                            Punto informativo o de ruegos y preguntas (sin
                            votación requerida).
                          </Text>
                        </View>
                      )}

                      {/* Comments Input (Para el acta) */}
                      <View style={styles.commentsWrap}>
                        <View style={styles.commentsHeaderRow}>
                          <Ionicons
                            name="create-outline"
                            size={15}
                            color={BLUE_MUTED}
                          />
                          <Text style={styles.commentsHeaderTitle}>
                            Comentarios para el acta
                          </Text>
                        </View>
                        <TextInput
                          style={styles.commentsInput}
                          placeholder="Añadir comentarios..."
                          placeholderTextColor="#94A3B8"
                          multiline
                          numberOfLines={3}
                          value={
                            commentDrafts[item.id] !== undefined
                              ? commentDrafts[item.id]
                              : item.adminComments || ""
                          }
                          onChangeText={(text) =>
                            setCommentDrafts((prev) => ({
                              ...prev,
                              [item.id]: text,
                            }))
                          }
                          onBlur={() => handleSaveComment(item)}
                        />
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky Bottom Footer */}
      <View style={styles.bottomFooter}>
        <TouchableOpacity
          style={styles.finalizeMeetingBtn}
          activeOpacity={0.85}
          onPress={handleFinalizeMeeting}
          disabled={closeMeetingMutation.isPending}
        >
          {closeMeetingMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
              <Text style={styles.finalizeMeetingBtnText}>Finalizar junta</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: {
    padding: 6,
    marginRight: 6,
  },
  topBarCenter: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
  },
  topBarSub: {
    fontSize: 12.5,
    color: BLUE_MUTED,
    marginTop: 1,
  },
  liveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#16A34A",
  },
  liveChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  loadingBox: {
    paddingVertical: 24,
    alignItems: "center",
  },
  itemsList: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  itemHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: NAVY_DARK,
    flex: 1,
    marginRight: 12,
    lineHeight: 21,
  },
  itemHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commentBubbleIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  approvedHeaderBadge: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectedHeaderBadge: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingAbsenteesHeaderBadge: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    backgroundColor: "#FBFDFF",
  },
  expandedStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 14,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillVoting: {
    backgroundColor: "#E0F2FE",
  },
  statusPillApproved: {
    backgroundColor: "#DCFCE7",
  },
  statusPillRejected: {
    backgroundColor: "#FEE2E2",
  },
  statusPillAbsentee: {
    backgroundColor: "#FEF3C7",
  },
  statusPillText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  statusPillTextVoting: {
    color: "#0369A1",
  },
  statusPillTextApproved: {
    color: "#166534",
  },
  statusPillTextRejected: {
    color: "#991B1B",
  },
  statusPillTextAbsentee: {
    color: "#B45309",
  },
  absenteeCard: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  absenteeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  absenteeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400E",
  },
  absenteeDesc: {
    fontSize: 12,
    color: "#78350F",
    lineHeight: 17,
    marginBottom: 10,
  },
  notifyAbsenteesBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#D97706",
    paddingVertical: 10,
    borderRadius: 8,
  },
  notifyAbsenteesBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  confirmAgreementBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: GREEN,
    paddingVertical: 10,
    borderRadius: 8,
  },
  confirmAgreementBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  quickButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quickBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  quickBtnApprove: {
    borderColor: GREEN_SUCCESS,
    backgroundColor: "#FFFFFF",
  },
  quickBtnApproveActive: {
    backgroundColor: GREEN_SUCCESS,
  },
  quickBtnReject: {
    borderColor: RED_REJECT,
    backgroundColor: "#FFFFFF",
  },
  quickBtnRejectActive: {
    backgroundColor: RED_REJECT,
  },
  registerVoteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: GREEN,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 14,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  registerVoteBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  informationalBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  informationalText: {
    fontSize: 12,
    color: "#64748B",
    flex: 1,
  },
  commentsWrap: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
  },
  commentsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  commentsHeaderTitle: {
    fontSize: 11.5,
    fontWeight: "600",
    color: BLUE_MUTED,
  },
  commentsInput: {
    fontSize: 13,
    color: NAVY_DARK,
    lineHeight: 18,
    minHeight: 52,
    textAlignVertical: "top",
    padding: 0,
  },
  bottomFooter: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  finalizeMeetingBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: GREEN,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  finalizeMeetingBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
