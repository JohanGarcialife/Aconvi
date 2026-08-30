import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { api, queryClient } from "~/utils/api";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const TENANT_ID = "org_aconvi_demo";

// ─── Colors ───────────────────────────────────────────────────────────────────
const TEAL = "#009689";
const PURPLE = "#5B21B6";
const DARK = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";
const BG = "#F8FAFC";
const GREEN_BTN = "#16A34A";
const RED_BTN = "#DC2626";
const GRAY_BTN = "#475569";

type ChoiceType = "APPROVE" | "REJECT" | "ABSTAIN";

export default function VotingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const [USER_ID, setUserId] = useState<string>("00000000-0000-0000-0000-000000000000");

  // Selected session to vote on
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(params.sessionId ?? null);

  // Step state for active session: 'VOTE' | 'CONFIRM' | 'SUCCESS'
  const [step, setStep] = useState<"VOTE" | "CONFIRM" | "SUCCESS">("VOTE");

  // Local choices before confirming: map of itemId -> choice (or '__single__' -> choice)
  const [choices, setChoices] = useState<Record<string, ChoiceType>>({});

  useEffect(() => {
    if (params.sessionId) {
      setSelectedSessionId(params.sessionId);
    }
  }, [params.sessionId]);

  useEffect(() => {
    SecureStore.getItemAsync("expo_user_id")
      .then((id) => {
        if (id) setUserId(id);
      })
      .catch(console.warn);
  }, []);

  const { data: sessions, isLoading, refetch } = useQuery({
    ...api.voting.all.queryOptions({ tenantId: TENANT_ID, userId: USER_ID }),
    refetchInterval: 3000,
  });

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const activeSession = (sessions as any[])?.find((s) => s.id === selectedSessionId) ??
    (sessions as any[])?.find((s) => s.status === "OPEN" && !s.hasVoted) ??
    (sessions as any[])?.[0];

  useEffect(() => {
    if (activeSession && !selectedSessionId) {
      setSelectedSessionId(activeSession.id);
    }
  }, [activeSession, selectedSessionId]);

  const castMutation = useMutation({
    ...api.voting.cast.mutationOptions(),
    onSuccess: () => {
      setStep("SUCCESS");
      void queryClient.invalidateQueries(api.voting.all.queryFilter({ tenantId: TENANT_ID }));
      void refetch();
    },
    onError: (err: any) => {
      Alert.alert("Error al registrar voto", err.message || "No se pudo registrar el voto.");
    },
  });

  const handleSelectChoice = (itemId: string, choice: ChoiceType) => {
    setChoices((prev) => ({
      ...prev,
      [itemId]: choice,
    }));
  };

  const handleGoToConfirm = () => {
    if (!activeSession) return;

    if (activeSession.type === "JUNTA" && activeSession.items?.length > 0) {
      const answeredCount = activeSession.items.filter((i: any) => !!choices[i.id]).length;
      if (answeredCount < activeSession.items.length) {
        Alert.alert(
          "Faltan respuestas",
          `Debes responder a todos los puntos (${answeredCount} de ${activeSession.items.length}) antes de continuar.`,
        );
        return;
      }
    } else {
      if (!choices["__single__"]) {
        Alert.alert("Selección requerida", "Por favor selecciona una opción para tu voto.");
        return;
      }
    }

    setStep("CONFIRM");
  };

  const handleConfirmSubmit = () => {
    if (!activeSession) return;

    if (activeSession.type === "JUNTA" && activeSession.items?.length > 0) {
      const votesPayload = activeSession.items.map((item: any) => ({
        itemId: item.id,
        choice: choices[item.id] as ChoiceType,
      }));

      castMutation.mutate({
        sessionId: activeSession.id,
        tenantId: TENANT_ID,
        userId: USER_ID,
        votes: votesPayload,
      });
    } else {
      castMutation.mutate({
        sessionId: activeSession.id,
        tenantId: TENANT_ID,
        userId: USER_ID,
        choice: choices["__single__"] as ChoiceType,
      });
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={TEAL} />
        <Text style={styles.loadingText}>Cargando votaciones...</Text>
      </SafeAreaView>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.emptyEmoji}>🗳️</Text>
        <Text style={styles.emptyTitle}>Sin votaciones activas</Text>
        <Text style={styles.emptySubtitle}>
          Tu Administrador de Fincas publicará aquí las próximas votaciones y juntas extraordinarias.
        </Text>
      </SafeAreaView>
    );
  }

  if (!activeSession) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.emptyEmoji}>✓</Text>
        <Text style={styles.emptyTitle}>Votaciones completadas</Text>
        <Text style={styles.emptySubtitle}>Has participado en todas las votaciones abiertas.</Text>
      </SafeAreaView>
    );
  }

  const isJunta = activeSession.type === "JUNTA";
  const primaryThemeColor = isJunta ? PURPLE : TEAL;
  const isClosed = activeSession.status === "CLOSED";
  const canVote = activeSession.userVotingStatus?.canVote ?? true;
  const isAlreadyVoted = activeSession.hasVoted || step === "SUCCESS";

  const itemsList = activeSession.items && activeSession.items.length > 0
    ? activeSession.items
    : [{ id: "__single__", title: activeSession.title, budget: activeSession.budget, description: activeSession.description }];

  const answeredCount = isJunta
    ? itemsList.filter((i: any) => !!choices[i.id]).length
    : choices["__single__"] ? 1 : 0;
  const totalCount = itemsList.length;
  const allAnswered = answeredCount === totalCount;

  // Format close date
  const formattedClose = activeSession.closesAt
    ? format(new Date(activeSession.closesAt), "dd 'de' MMMM · HH:mm", { locale: es })
    : "Sin fecha límite";

  const renderSessionSwitcher = () => {
    if (!sessions || (sessions as any[]).length <= 1) return null;
    return (
      <View style={styles.sessionSwitcherBox}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sessionSwitcherContent}>
          {(sessions as any[]).map((s: any) => {
            const isSelected = s.id === activeSession.id;
            const isVoted = s.hasVoted;
            const isJuntaType = s.type === "JUNTA";
            return (
              <TouchableOpacity
                key={s.id}
                onPress={() => {
                  setSelectedSessionId(s.id);
                  setStep("VOTE");
                  setChoices({});
                }}
                style={[
                  styles.sessionPill,
                  isSelected && (isJuntaType ? styles.sessionPillActivePurple : styles.sessionPillActiveTeal),
                ]}
              >
                <Text
                  style={[
                    styles.sessionPillText,
                    isSelected && styles.sessionPillTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {isVoted ? "✓ " : s.status === "CLOSED" ? "🔒 " : isJuntaType ? "⚖️ " : "🗳️ "}
                  {s.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // ═════════════════════════════════════════════════════════════════════════════
  // CASO ESPECIAL: USUARIO SIN DERECHO A VOTO (Y SESIÓN NO CERRADA)
  // ═════════════════════════════════════════════════════════════════════════════
  if (!canVote && !isAlreadyVoted && !isClosed) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.topNav}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Volver</Text>
          </TouchableOpacity>
        </View>
        {renderSessionSwitcher()}

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.debtCard}>
            <View style={styles.debtIconBox}>
              <Text style={{ fontSize: 36 }}>🔒</Text>
            </View>
            <Text style={styles.debtTitle}>
              {isJunta ? "No puedes votar en esta junta" : "No puedes votar en esta votación"}
            </Text>
            <Text style={styles.debtSubtitle}>
              {activeSession.userVotingStatus?.reason ??
                "Tienes pagos pendientes con la comunidad y no tendrás derecho a voto. Ponte al día para poder participar en las votaciones."}
            </Text>
            <TouchableOpacity
              style={styles.payBtn}
              onPress={() => router.push("/(vecino)/fees")}
            >
              <Text style={styles.payBtnText}>Ver mis cuotas pendientes →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoBoxTitle}>ⓘ Importante</Text>
            <Text style={styles.infoBoxText}>
              Conforme a la Ley de Propiedad Horizontal, los propietarios que no estén al corriente en el pago de las deudas vencidas con la comunidad carecen de derecho de voto en las juntas.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PASO 4: SESIÓN CERRADA O VOTO(S) YA REGISTRADOS
  // ═════════════════════════════════════════════════════════════════════════════
  if (isClosed || isAlreadyVoted) {
    const formattedClosedDate = activeSession.closedAt
      ? format(new Date(activeSession.closedAt), "dd 'de' MMMM · HH:mm", { locale: es })
      : formattedClose;

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.topNav}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Inicio</Text>
          </TouchableOpacity>
        </View>
        {renderSessionSwitcher()}

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.successHeader}>
            <View
              style={[
                styles.successCircle,
                isClosed && !isAlreadyVoted
                  ? { backgroundColor: "#F1F5F9" }
                  : { backgroundColor: isJunta ? "#EDE9FE" : "#DCFCE7" },
              ]}
            >
              <Text
                style={{
                  fontSize: 36,
                  color: isClosed && !isAlreadyVoted ? "#64748B" : primaryThemeColor,
                }}
              >
                {isClosed && !isAlreadyVoted ? "🔒" : "✓"}
              </Text>
            </View>
            <Text style={styles.successTitle}>
              {isClosed
                ? isAlreadyVoted
                  ? "Votación cerrada · Voto registrado"
                  : "Votación cerrada"
                : isJunta
                ? "¡Votos registrados!"
                : "¡Voto registrado!"}
            </Text>
            <Text style={styles.successSubtitle}>
              {isClosed
                ? isAlreadyVoted
                  ? `Esta votación fue cerrada el ${formattedClosedDate}. Tus votos quedaron registrados en el acta oficial.`
                  : `Esta votación fue cerrada por el Administrador de Fincas el ${formattedClosedDate} y ya no admite nuevos votos.`
                : isJunta
                ? "Tus respuestas se han registrado correctamente."
                : "Tu voto se ha registrado correctamente."}
            </Text>
          </View>

          {isAlreadyVoted ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryCardTitle}>Resumen de tus votos</Text>
              {itemsList.map((item: any, idx: number) => {
                const userChoice =
                  choices[item.id] ||
                  activeSession.userCasts?.find(
                    (c: any) => c.itemId === item.id || (!c.itemId && item.id === "__single__"),
                  )?.choice ||
                  "APPROVE";
                const choiceLabel =
                  userChoice === "APPROVE" ? "Apruebo" : userChoice === "REJECT" ? "Rechazo" : "Me abstengo";
                const choiceColor =
                  userChoice === "APPROVE" ? GREEN_BTN : userChoice === "REJECT" ? RED_BTN : GRAY_BTN;

                return (
                  <View key={item.id} style={styles.summaryItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.summaryItemTitle}>
                        {isJunta ? `${idx + 1}. ` : ""}
                        {item.title}
                      </Text>
                      {item.budget ? <Text style={styles.summaryItemBudget}>{item.budget}</Text> : null}
                    </View>
                    <View style={[styles.choiceTag, { backgroundColor: choiceColor + "15", borderColor: choiceColor }]}>
                      <Text style={[styles.choiceTagText, { color: choiceColor }]}>{choiceLabel}</Text>
                    </View>
                  </View>
                );
              })}

              <View style={styles.summaryFooter}>
                <Text style={styles.summaryTimestamp}>
                  🔒 Registro digital emitido conforme a la Ley de Propiedad Horizontal.
                </Text>
                <Text style={styles.summaryCoef}>
                  Coeficiente computado: {activeSession.userVotingStatus?.coefficient ?? 1}%
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryCardTitle}>Puntos incluidos en el acta</Text>
              {itemsList.map((item: any, idx: number) => (
                <View key={item.id} style={styles.summaryItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.summaryItemTitle}>
                      {isJunta ? `${idx + 1}. ` : ""}
                      {item.title}
                    </Text>
                    {item.budget ? <Text style={styles.summaryItemBudget}>{item.budget}</Text> : null}
                  </View>
                  <View style={[styles.choiceTag, { backgroundColor: "#F1F5F9", borderColor: "#CBD5E1" }]}>
                    <Text style={[styles.choiceTagText, { color: "#64748B" }]}>Cerrado</Text>
                  </View>
                </View>
              ))}
              <View style={styles.summaryFooter}>
                <Text style={styles.summaryTimestamp}>
                  El acta oficial ya ha sido generada por el Administrador de Fincas.
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: primaryThemeColor }]}
            onPress={() => router.back()}
          >
            <Text style={styles.primaryActionBtnText}>Volver al Inicio</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PASO 3: CONFIRMACIÓN Y RESUMEN PREVIO AL ENVÍO
  // ═════════════════════════════════════════════════════════════════════════════
  if (step === "CONFIRM") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.topNav}>
          <TouchableOpacity onPress={() => setStep("VOTE")} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Modificar respuestas</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.confirmHeader}>
            <View style={[styles.sendCircle, { backgroundColor: isJunta ? "#EDE9FE" : "#CCFBF1" }]}>
              <Text style={{ fontSize: 32 }}>✈️</Text>
            </View>
            <Text style={styles.confirmTitle}>
              {isJunta ? "Vas a enviar tus votos" : "Vas a enviar tu voto"}
            </Text>
            <Text style={styles.confirmSubtitle}>
              Esta acción es definitiva. No podrás modificar tus respuestas una vez confirmadas.
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardTitle}>
              {isJunta ? `${totalCount} decisiones a enviar` : "Tu respuesta"}
            </Text>

            {itemsList.map((item: any, idx: number) => {
              const selectedChoice = choices[item.id];
              const choiceLabel =
                selectedChoice === "APPROVE"
                  ? "Apruebo"
                  : selectedChoice === "REJECT"
                  ? "Rechazo"
                  : "Me abstengo";
              const choiceColor =
                selectedChoice === "APPROVE" ? GREEN_BTN : selectedChoice === "REJECT" ? RED_BTN : GRAY_BTN;

              return (
                <View key={item.id} style={styles.summaryItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.summaryItemTitle}>
                      {isJunta ? `${idx + 1}. ` : ""}{item.title}
                    </Text>
                    {item.budget ? <Text style={styles.summaryItemBudget}>{item.budget}</Text> : null}
                  </View>
                  <View style={[styles.choiceTag, { backgroundColor: choiceColor + "15", borderColor: choiceColor }]}>
                    <Text style={[styles.choiceTagText, { color: choiceColor }]}>{choiceLabel}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: primaryThemeColor, marginTop: 24 }]}
            onPress={handleConfirmSubmit}
            disabled={castMutation.isPending}
          >
            {castMutation.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryActionBtnText}>Confirmar y Enviar</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelActionBtn}
            onPress={() => setStep("VOTE")}
            disabled={castMutation.isPending}
          >
            <Text style={styles.cancelActionBtnText}>Cancelar y volver a revisar</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PASO 2: PANTALLA DE VOTACIÓN (FLUJO A y FLUJO B EN PANTALLA ÚNICA)
  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      {/* Top Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <View style={styles.badgeBox}>
          <Text style={[styles.badgeText, { color: primaryThemeColor }]}>
            {isJunta ? "Junta Extraordinaria" : "Votación Activa"}
          </Text>
        </View>
      </View>
      {renderSessionSwitcher()}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Title & Date */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>{activeSession.title}</Text>
          <Text style={styles.closeDateText}>🕒 Cierre: {formattedClose}</Text>
          {activeSession.description ? (
            <Text style={styles.sessionDesc}>{activeSession.description}</Text>
          ) : null}
        </View>

        {/* List of Points / Items */}
        <View style={{ gap: 16, marginBottom: 20 }}>
          {itemsList.map((item: any, idx: number) => {
            const currentChoice = choices[item.id];

            return (
              <View key={item.id} style={styles.voteItemCard}>
                <View style={styles.voteItemHeader}>
                  <Text style={styles.voteItemTitle}>
                    {isJunta ? `${idx + 1}. ` : ""}{item.title}
                  </Text>
                  {item.budget ? (
                    <Text style={styles.voteItemBudget}>{item.budget}</Text>
                  ) : null}
                </View>

                {item.description ? (
                  <Text style={styles.voteItemDesc}>{item.description}</Text>
                ) : null}

                <Text style={styles.questionPrompt}>
                  {isJunta ? "¿Cuál es tu voto para este punto?" : `¿Apruebas ${item.title.toLowerCase()}?`}
                </Text>

                {/* 3 Standard Options: Apruebo • Rechazo • Me abstengo */}
                <View style={styles.optionsRow}>
                  {/* Apruebo */}
                  <TouchableOpacity
                    style={[
                      styles.optionBtn,
                      currentChoice === "APPROVE" ? styles.optionApproveActive : styles.optionInactive,
                    ]}
                    onPress={() => handleSelectChoice(item.id, "APPROVE")}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionBtnText,
                        currentChoice === "APPROVE" ? styles.textActive : styles.textInactive,
                      ]}
                    >
                      Apruebo
                    </Text>
                  </TouchableOpacity>

                  {/* Rechazo */}
                  <TouchableOpacity
                    style={[
                      styles.optionBtn,
                      currentChoice === "REJECT" ? styles.optionRejectActive : styles.optionInactive,
                    ]}
                    onPress={() => handleSelectChoice(item.id, "REJECT")}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionBtnText,
                        currentChoice === "REJECT" ? styles.textActive : styles.textInactive,
                      ]}
                    >
                      Rechazo
                    </Text>
                  </TouchableOpacity>

                  {/* Me abstengo */}
                  <TouchableOpacity
                    style={[
                      styles.optionBtn,
                      currentChoice === "ABSTAIN" ? styles.optionAbstainActive : styles.optionInactive,
                    ]}
                    onPress={() => handleSelectChoice(item.id, "ABSTAIN")}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionBtnText,
                        currentChoice === "ABSTAIN" ? styles.textActive : styles.textInactive,
                      ]}
                    >
                      Me abstengo
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {/* Counter for Junta */}
        {isJunta && (
          <View style={styles.counterRow}>
            <Text style={styles.counterText}>
              {answeredCount} de {totalCount} respondidas
            </Text>
            {allAnswered ? (
              <Text style={styles.counterReady}>✓ Todo listo para enviar</Text>
            ) : (
              <Text style={styles.counterPending}>Faltan {totalCount - answeredCount} puntos</Text>
            )}
          </View>
        )}

        {/* Note before submit */}
        <View style={styles.infoFootnote}>
          <Text style={styles.infoFootnoteText}>
            ⓘ Una vez enviado y confirmado, no podrás modificar tu voto.
          </Text>
        </View>

        {/* Primary Action Button */}
        <TouchableOpacity
          style={[
            styles.primaryActionBtn,
            { backgroundColor: allAnswered ? primaryThemeColor : "#CBD5E1" },
          ]}
          onPress={handleGoToConfirm}
          disabled={!allAnswered}
        >
          <Text style={styles.primaryActionBtnText}>
            {isJunta ? "Enviar mis votos →" : "Enviar mi voto →"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: BG },
  loadingText: { marginTop: 12, fontSize: 14, color: MUTED, fontWeight: "500" },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: DARK, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: MUTED, textAlign: "center", lineHeight: 22 },

  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  topNav: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  backBtn: { paddingVertical: 4 },
  backBtnText: { fontSize: 14, fontWeight: "600", color: DARK },
  badgeBox: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { fontSize: 12, fontWeight: "700" },

  scrollContent: { padding: 20, paddingBottom: 40 },
  titleSection: { marginBottom: 20 },
  mainTitle: { fontSize: 24, fontWeight: "800", color: DARK, marginBottom: 4 },
  closeDateText: { fontSize: 13, color: MUTED, fontWeight: "500", marginBottom: 8 },
  sessionDesc: { fontSize: 14, color: "#334155", lineHeight: 20 },

  // Vote Item Card
  voteItemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  voteItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  voteItemTitle: { fontSize: 16, fontWeight: "700", color: DARK, flex: 1, marginRight: 8 },
  voteItemBudget: { fontSize: 16, fontWeight: "800", color: TEAL },
  voteItemDesc: { fontSize: 13, color: MUTED, marginBottom: 12, lineHeight: 18 },
  questionPrompt: { fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 12 },

  // Options
  optionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  optionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  optionInactive: {
    backgroundColor: "#F8FAFC",
    borderColor: BORDER,
  },
  optionApproveActive: {
    backgroundColor: GREEN_BTN,
    borderColor: GREEN_BTN,
  },
  optionRejectActive: {
    backgroundColor: RED_BTN,
    borderColor: RED_BTN,
  },
  optionAbstainActive: {
    backgroundColor: GRAY_BTN,
    borderColor: GRAY_BTN,
  },
  optionBtnText: { fontSize: 13, fontWeight: "700" },
  textInactive: { color: "#334155" },
  textActive: { color: "#FFFFFF" },

  // Counter
  counterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  counterText: { fontSize: 14, fontWeight: "700", color: DARK },
  counterReady: { fontSize: 12, fontWeight: "700", color: GREEN_BTN },
  counterPending: { fontSize: 12, fontWeight: "600", color: "#E11D48" },

  // Info Footnote
  infoFootnote: { marginBottom: 20 },
  infoFootnoteText: { fontSize: 12, color: MUTED, textAlign: "center" },

  // Primary Action
  primaryActionBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  primaryActionBtnText: { fontSize: 16, fontWeight: "800", color: "#FFFFFF" },

  // Cancel Action
  cancelActionBtn: {
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  cancelActionBtnText: { fontSize: 14, fontWeight: "600", color: MUTED },

  // Confirm Step
  confirmHeader: { alignItems: "center", marginBottom: 24 },
  sendCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  confirmTitle: { fontSize: 22, fontWeight: "800", color: DARK, marginBottom: 6, textAlign: "center" },
  confirmSubtitle: { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 20, paddingHorizontal: 16 },

  // Success Step
  successHeader: { alignItems: "center", marginBottom: 24 },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  successTitle: { fontSize: 24, fontWeight: "800", color: DARK, marginBottom: 6, textAlign: "center" },
  successSubtitle: { fontSize: 14, color: MUTED, textAlign: "center", lineHeight: 20 },

  // Summary Card
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  summaryCardTitle: { fontSize: 15, fontWeight: "800", color: DARK, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", paddingBottom: 8 },
  summaryItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  summaryItemTitle: { fontSize: 14, fontWeight: "700", color: DARK },
  summaryItemBudget: { fontSize: 13, fontWeight: "700", color: TEAL, marginTop: 2 },
  choiceTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  choiceTagText: { fontSize: 12, fontWeight: "800" },
  summaryFooter: { marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  summaryTimestamp: { fontSize: 12, color: MUTED, marginBottom: 4 },
  summaryCoef: { fontSize: 12, fontWeight: "600", color: DARK },

  // Debtor Block
  debtCard: {
    backgroundColor: "#FFF1F2",
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: "#FECDD3",
    alignItems: "center",
    marginBottom: 16,
  },
  debtIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFE4E6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  debtTitle: { fontSize: 18, fontWeight: "800", color: "#9F1239", marginBottom: 8, textAlign: "center" },
  debtSubtitle: { fontSize: 13, color: "#881337", textAlign: "center", lineHeight: 20, marginBottom: 16 },
  payBtn: {
    backgroundColor: "#E11D48",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  payBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  infoBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  infoBoxTitle: { fontSize: 13, fontWeight: "700", color: DARK, marginBottom: 4 },
  infoBoxText: { fontSize: 12, color: MUTED, lineHeight: 18 },

  // Session Switcher
  sessionSwitcherBox: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  sessionSwitcherContent: {
    gap: 8,
  },
  sessionPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sessionPillActiveTeal: {
    backgroundColor: "#009689",
    borderColor: "#009689",
  },
  sessionPillActivePurple: {
    backgroundColor: "#5B21B6",
    borderColor: "#5B21B6",
  },
  sessionPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  sessionPillTextActive: {
    color: "#FFFFFF",
  },
});
