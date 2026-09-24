import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { api, queryClient } from "~/utils/api";
import { useVotedSessions, markSessionAsVoted } from "~/utils/voting-tracker";

const TENANT_ID = "org_aconvi_demo";

// ─── Colors ───────────────────────────────────────────────────────────────────
const TEAL = "#027580";
const TEAL_LIGHT = "#E6F7F5";
const DARK = "#0F172A";
const MUTED = "#475569";
const BORDER = "#E2E8F0";
const BG = "#FFFFFF";
const PILL_BG = "#F1F5F9";
const GREEN_BTN = "#16A34A";
const RED_BTN = "#DC2626";
const GRAY_BTN = "#475569";

type ChoiceType = "APPROVE" | "REJECT" | "ABSTAIN";

export default function VotingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const [USER_ID, setUserId] = useState<string>(
    "00000000-0000-0000-0000-000000000000",
  );

  // Selected session to vote on
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    params.sessionId ?? null,
  );

  // Step state for active session: 'VOTE' | 'CONFIRM' | 'SUCCESS'
  const [step, setStep] = useState<"VOTE" | "CONFIRM" | "SUCCESS">("VOTE");

  // Track which session was just submitted in this component lifecycle
  const [justVotedSessionId, setJustVotedSessionId] = useState<string | null>(
    null,
  );

  const { isSessionVoted } = useVotedSessions();

  // Modal de confirmación (Bottom sheet)
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);

  // Local choices before confirming: map of itemId -> choice (or '__single__' -> choice)
  const [choices, setChoices] = useState<Record<string, ChoiceType>>({});

  // Selected budget proposal per item (or '__single__')
  const [selectedProposals, setSelectedProposals] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (params.sessionId) {
      setSelectedSessionId(params.sessionId);
      setJustVotedSessionId(null);
      setChoices({});
    }
  }, [params.sessionId]);

  useEffect(() => {
    SecureStore.getItemAsync("expo_user_id")
      .then((id) => {
        if (id) setUserId(id);
      })
      .catch(console.warn);
  }, []);

  const {
    data: sessions,
    isLoading,
    refetch,
  } = useQuery({
    ...api.voting.all.queryOptions({ tenantId: TENANT_ID, userId: USER_ID }),
    refetchInterval: 3000,
  });

  const toDayString = (d: string | Date | null | undefined) => {
    if (!d) return null;
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return null;
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  };

  const isSessionEffectivelyClosed = (s: any) =>
    Boolean(
      !s ||
        s.status === "CLOSED" ||
        (s.closesAt && new Date(s.closesAt).getTime() < Date.now()) ||
        (s.type === "JUNTA" && s.meetingDate && new Date(s.meetingDate).getTime() < Date.now()),
    );

  const isVotedSession = (session: any) =>
    Boolean(session && (session.hasVoted || isSessionVoted(session.id)));

  const rawList = (sessions as any[]) ?? [];
  const sessionList = [...rawList].sort((a: any, b: any) => {
    const isClosedA = isSessionEffectivelyClosed(a);
    const isClosedB = isSessionEffectivelyClosed(b);
    if (!isClosedA && isClosedB) return -1;
    if (isClosedA && !isClosedB) return 1;

    const timeA = a.closesAt ? new Date(a.closesAt).getTime() : Infinity;
    const timeB = b.closesAt ? new Date(b.closesAt).getTime() : Infinity;

    const dayA = toDayString(a.closesAt);
    const dayB = toDayString(b.closesAt);

    if (dayA && dayB && dayA !== dayB) {
      return timeA - timeB;
    }
    if (dayA && !dayB) return -1;
    if (!dayA && dayB) return 1;

    const hasVotedA = isVotedSession(a);
    const hasVotedB = isVotedSession(b);
    if (!hasVotedA && hasVotedB) return -1;
    if (hasVotedA && !hasVotedB) return 1;

    if (timeA !== timeB) return timeA - timeB;

    const prioDiff = (b.priority || 0) - (a.priority || 0);
    if (prioDiff !== 0) return prioDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const pendingOpen = sessionList.find(
    (s) => !isSessionEffectivelyClosed(s) && !isVotedSession(s),
  );

  const activeSession = selectedSessionId
    ? (sessionList.find((s) => s.id === selectedSessionId) ?? sessionList[0])
    : sessionList[0];

  useFocusEffect(
    useCallback(() => {
      void refetch();
      if (
        activeSession &&
        !isVotedSession(activeSession) &&
        justVotedSessionId !== activeSession.id
      ) {
        setStep("VOTE");
      }
    }, [
      refetch,
      activeSession,
      isSessionVoted,
      justVotedSessionId,
    ]),
  );

  useEffect(() => {
    if (activeSession && !selectedSessionId) {
      setSelectedSessionId(activeSession.id);
    }
  }, [activeSession, selectedSessionId]);

  useEffect(() => {
    if (
      activeSession &&
      !isVotedSession(activeSession) &&
      justVotedSessionId !== activeSession.id
    ) {
      setStep("VOTE");
      setChoices({});
    }
  }, [activeSession?.id, isSessionVoted, justVotedSessionId]);

  useEffect(() => {
    if (
      !params.sessionId &&
      pendingOpen &&
      selectedSessionId !== pendingOpen.id
    ) {
      const currentSelected = sessionList.find(
        (s) => s.id === selectedSessionId,
      );
      if (
        !currentSelected ||
        currentSelected.status === "CLOSED" ||
        isVotedSession(currentSelected)
      ) {
        setSelectedSessionId(pendingOpen.id);
        setStep("VOTE");
        setJustVotedSessionId(null);
        setChoices({});
      }
    }
  }, [sessions, pendingOpen, selectedSessionId, params.sessionId]);

  const castMutation = useMutation({
    ...api.voting.cast.mutationOptions(),
    onSuccess: () => {
      setConfirmModalVisible(false);
      const votedId = activeSession?.id;
      if (votedId) {
        void markSessionAsVoted(votedId);
      }
      setJustVotedSessionId(votedId ?? null);
      setStep("SUCCESS");

      // Optimistic synchronous update of query cache so navigating to Home immediately reflects vote
      queryClient.setQueriesData(
        { queryKey: api.voting.all.queryKey() },
        (oldData: any) => {
          if (!Array.isArray(oldData)) return oldData;
          return oldData.map((s: any) =>
            s.id === votedId
              ? {
                  ...s,
                  hasVoted: true,
                  userCasts: [
                    ...(s.userCasts || []),
                    { sessionId: s.id, userId: USER_ID },
                  ],
                }
              : s,
          );
        },
      );

      void queryClient.invalidateQueries({
        queryKey: api.voting.all.queryKey(),
      });
      void refetch();
    },
    onError: (err: any) => {
      Alert.alert(
        "Error al registrar voto",
        err.message || "No se pudo registrar el voto.",
      );
    },
  });

  const handleSelectChoice = (itemId: string, choice: ChoiceType) => {
    setChoices((prev) => ({
      ...prev,
      [itemId]: choice,
    }));
  };

  const handleOpenConfirmModal = () => {
    if (!activeSession) return;

    if (isSessionEffectivelyClosed(activeSession)) {
      Alert.alert(
        "Votación cerrada",
        "El plazo para votar en esta convocatoria ha finalizado.",
      );
      return;
    }

    if (activeSession.type === "JUNTA" && activeSession.items?.length > 0) {
      const onlineItems = activeSession.items.filter(
        (i: any) => i.onlineVotingEnabled !== false,
      );
      const answeredCount = onlineItems.filter(
        (i: any) => !!choices[i.id],
      ).length;
      if (answeredCount < onlineItems.length) {
        Alert.alert(
          "Faltan respuestas",
          `Debes responder a todos los puntos habilitados para votación online (${answeredCount} de ${onlineItems.length}) antes de continuar.`,
        );
        return;
      }
    } else {
      if (!choices["__single__"]) {
        Alert.alert(
          "Selección requerida",
          "Por favor selecciona una opción para tu voto.",
        );
        return;
      }
      const singleProposals = (activeSession.budgetProposals || []).filter(
        (bp: any) => !bp.itemId || bp.itemId === activeSession.id,
      );
      if (
        singleProposals.length > 1 &&
        choices["__single__"] === "APPROVE" &&
        !selectedProposals["__single__"]
      ) {
        Alert.alert(
          "Selección de presupuesto requerida",
          "Por favor selecciona una de las opciones antes de confirmar tu voto a favor.",
        );
        return;
      }
    }

    setConfirmModalVisible(true);
  };

  const handleConfirmSubmit = () => {
    if (!activeSession) return;

    if (isSessionEffectivelyClosed(activeSession)) {
      setConfirmModalVisible(false);
      Alert.alert(
        "Votación cerrada",
        "El plazo para votar en esta convocatoria ha finalizado.",
      );
      return;
    }

    if (activeSession.type === "JUNTA" && activeSession.items?.length > 0) {
      const onlineItems = activeSession.items.filter(
        (item: any) => item.onlineVotingEnabled !== false,
      );
      const votesPayload = onlineItems.map((item: any) => ({
        itemId: item.id,
        choice: choices[item.id] as ChoiceType,
        selectedProposalId: selectedProposals[item.id] || undefined,
      }));

      castMutation.mutate({
        sessionId: activeSession.id,
        tenantId: TENANT_ID,
        userId: USER_ID,
        votes: votesPayload,
      });
    } else {
      const singleProposals = (activeSession.budgetProposals || []).filter(
        (bp: any) => !bp.itemId || bp.itemId === activeSession.id,
      );
      const chosenProposalId =
        selectedProposals["__single__"] ||
        (singleProposals.length === 1 ? singleProposals[0]?.id : undefined);

      castMutation.mutate({
        sessionId: activeSession.id,
        tenantId: TENANT_ID,
        userId: USER_ID,
        choice: choices["__single__"] as ChoiceType,
        selectedProposalId: chosenProposalId || undefined,
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
          Tu Administrador de Fincas publicará aquí las próximas votaciones y
          juntas extraordinarias.
        </Text>
      </SafeAreaView>
    );
  }

  if (!activeSession) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.emptyEmoji}>✓</Text>
        <Text style={styles.emptyTitle}>Votaciones completadas</Text>
        <Text style={styles.emptySubtitle}>
          Has participado en todas las votaciones abiertas.
        </Text>
      </SafeAreaView>
    );
  }

  const isJunta = activeSession.type === "JUNTA";
  const primaryThemeColor = TEAL;
  // Cerrada si status CLOSED o si el plazo ya expiró
  const isClosed = isSessionEffectivelyClosed(activeSession);
  const canVote = activeSession.userVotingStatus?.canVote ?? true;
  const isAlreadyVoted = Boolean(
    activeSession.hasVoted ||
      isSessionVoted(activeSession.id) ||
      (justVotedSessionId === activeSession.id && step === "SUCCESS"),
  );

  const itemsList =
    activeSession.items && activeSession.items.length > 0
      ? activeSession.items
      : [
          {
            id: "__single__",
            title: activeSession.title,
            budget: activeSession.budget,
            description: activeSession.description,
            onlineVotingEnabled: true,
          },
        ];

  const onlineItems = isJunta
    ? itemsList.filter((i: any) => i.onlineVotingEnabled !== false)
    : itemsList;

  const answeredCount = isJunta
    ? onlineItems.filter((i: any) => !!choices[i.id]).length
    : choices["__single__"]
      ? 1
      : 0;
  const totalCount = onlineItems.length;
  const allAnswered = totalCount > 0 && answeredCount === totalCount;

  // Format close date pill: e.g. "Cierre: 18 sept. · 23:59"
  const formattedClose = activeSession.closesAt
    ? format(new Date(activeSession.closesAt), "d MMM. · HH:mm", { locale: es })
    : "18 sept. · 23:59";

  // Top header with Back + Title
  const renderHeader = (titleText: string) => (
    <View style={styles.headerBar}>
      <TouchableOpacity
        onPress={() => {
          setStep("VOTE");
          setJustVotedSessionId(null);
          setChoices({});
          router.back();
        }}
        style={styles.headerBackBtn}
        activeOpacity={0.7}
      >
        <Feather name="arrow-left" size={22} color={TEAL} />
        <Text style={styles.headerTitle}>{titleText}</Text>
      </TouchableOpacity>
    </View>
  );

  // ═════════════════════════════════════════════════════════════════════════════
  // CASO ESPECIAL: USUARIO SIN DERECHO A VOTO (Y SESIÓN NO CERRADA)
  // ═════════════════════════════════════════════════════════════════════════════
  if (!canVote && !isAlreadyVoted && !isClosed) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        {renderHeader(isJunta ? "Junta extraordinaria" : "Votación activa")}

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.debtCard}>
            <View style={styles.debtIconBox}>
              <Text style={{ fontSize: 36 }}>🔒</Text>
            </View>
            <Text style={styles.debtTitle}>
              {isJunta
                ? "No puedes votar en esta junta"
                : "No puedes votar en esta votación"}
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
              Conforme a la Ley de Propiedad Horizontal, los propietarios que no
              estén al corriente en el pago de las deudas vencidas con la
              comunidad carecen de derecho de voto en las juntas.
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
      ? format(new Date(activeSession.closedAt), "d MMM. · HH:mm", {
          locale: es,
        })
      : formattedClose;

    const userCastRecord = activeSession.userCasts?.[0];
    const castDate = userCastRecord?.castAt
      ? new Date(userCastRecord.castAt)
      : new Date();
    const formattedCastDate = format(castDate, "d MMM. · HH:mm", {
      locale: es,
    });

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        {renderHeader(
          isClosed && !isAlreadyVoted
            ? "Votación cerrada"
            : isJunta
              ? "Votos registrados"
              : "Voto registrado",
        )}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Círculo con checkmark verde/teal o candado */}
          <View
            style={[
              styles.successCircleLarge,
              isClosed && !isAlreadyVoted && { backgroundColor: "#F1F5F9" },
            ]}
          >
            {isClosed && !isAlreadyVoted ? (
              <Text style={{ fontSize: 36, color: "#64748B" }}>🔒</Text>
            ) : (
              <Feather name="check" size={38} color={TEAL} />
            )}
          </View>

          {/* Título y Subtítulo */}
          <Text style={styles.successTitleText}>
            {isClosed && !isAlreadyVoted
              ? "Votación cerrada"
              : isJunta
                ? "¡Votos registrados!"
                : "¡Voto registrado!"}
          </Text>
          <Text style={styles.successSubtitleText}>
            {isClosed && !isAlreadyVoted
              ? `Esta votación fue cerrada el ${formattedClosedDate} y ya no admite nuevos votos.`
              : isJunta
                ? "Tus respuestas han quedado registradas correctamente."
                : "Tu respuesta ha quedado registrada correctamente."}
          </Text>

          {/* Resultado oficial si la votación está cerrada */}
          {isClosed && activeSession.resultSummary && (
            <View style={styles.officialResultCard}>
              <Text style={styles.officialResultBadge}>
                RESULTADO DE LA VOTACIÓN
              </Text>
              <Text style={styles.officialResultTitle}>
                {activeSession.resultSummary}
              </Text>
            </View>
          )}

          {/* Tarjeta de resumen de voto (Fiel a media_1788544476617.png / media_1788544403855.png) */}
          {isAlreadyVoted ? (
            <View style={styles.votedSummaryCard}>
              {itemsList.map((item: any, idx: number) => {
                const castForThisItem = activeSession.userCasts?.find(
                  (c: any) =>
                    c.itemId === item.id ||
                    (!c.itemId && item.id === "__single__"),
                );
                const userChoice =
                  choices[item.id] ||
                  choices["__single__"] ||
                  castForThisItem?.choice;
                const choiceLabel =
                  userChoice === "APPROVE"
                    ? "Apruebo"
                    : userChoice === "REJECT"
                      ? "Rechazo"
                      : userChoice === "ABSTAIN"
                        ? "Me abstengo"
                        : "Voto registrado";

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.votedItemSection,
                      idx > 0 && {
                        borderTopWidth: 1,
                        borderTopColor: "#F1F5F9",
                        paddingTop: 14,
                        marginTop: 14,
                      },
                    ]}
                  >
                    <Text style={styles.votedItemTitle}>
                      {isJunta ? `${idx + 1}. ` : ""}
                      {item.title}
                    </Text>
                    {item.budget ? (
                      <Text style={styles.votedItemBudget}>{item.budget}</Text>
                    ) : null}

                    {!isJunta && (
                      <Text style={styles.votedResponseLabel}>
                        Tu respuesta
                      </Text>
                    )}
                    <View style={styles.votedChoiceRow}>
                      <View style={styles.votedChoiceCheckCircle}>
                        <Feather name="check" size={12} color="#FFFFFF" />
                      </View>
                      <Text style={styles.votedChoiceText}>{choiceLabel}</Text>
                    </View>
                  </View>
                );
              })}

              {/* Timestamp: Enviado el 18 sept. · 18:42 */}
              <Text style={styles.votedSentDateText}>
                Enviado el{" "}
                {activeSession.userCasts?.[0]?.castAt
                  ? format(
                      new Date(activeSession.userCasts[0].castAt),
                      "d MMM. · HH:mm",
                      { locale: es },
                    )
                  : format(new Date(), "d MMM. · HH:mm", { locale: es })}
              </Text>
            </View>
          ) : (
            <View style={styles.votedSummaryCard}>
              <Text style={styles.votedResponseLabel}>
                Puntos de la votación
              </Text>
              {itemsList.map((item: any, idx: number) => (
                <View key={item.id} style={{ marginTop: 8 }}>
                  <Text style={styles.votedItemTitle}>
                    {isJunta ? `${idx + 1}. ` : ""}
                    {item.title}
                  </Text>
                  {item.budget ? (
                    <Text style={styles.votedItemBudget}>{item.budget}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Helper to format clean question prompt
  const formatQuestion = (title: string) => {
    if (!title) return "¿Apruebas la propuesta?";
    const clean = title.trim();
    if (clean.startsWith("¿")) return clean;
    if (clean.toLowerCase().includes("reparación"))
      return "¿Apruebas la reparación del ascensor?";
    return `¿Apruebas ${clean.charAt(0).toLowerCase() + clean.slice(1)}?`;
  };

  const VOTE_OPTIONS: { key: ChoiceType; label: string }[] = [
    { key: "APPROVE", label: "Apruebo" },
    { key: "REJECT", label: "Rechazo" },
    { key: "ABSTAIN", label: "Me abstengo" },
  ];

  const renderConfirmModal = () => (
    <Modal
      visible={confirmModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setConfirmModalVisible(false)}
    >
      <View style={styles.modalBackdrop}>
        <TouchableOpacity
          style={styles.modalBackdropTouchable}
          activeOpacity={1}
          onPress={() => setConfirmModalVisible(false)}
        />
        <View style={styles.modalCard}>
          {/* Botón cerrar X */}
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={() => setConfirmModalVisible(false)}
            activeOpacity={0.7}
          >
            <Feather name="x" size={20} color="#475569" />
          </TouchableOpacity>

          {/* Escudo en círculo menta */}
          <View style={styles.shieldIconContainer}>
            <Feather name="shield" size={26} color={TEAL} />
          </View>

          {/* Título & Subtítulo (Screen 08) */}
          <Text style={styles.modalTitle}>
            {isJunta ? "Enviar mis votos" : "Enviar"}
          </Text>
          <Text style={styles.modalSubtitle}>
            {isJunta
              ? `Vas a enviar tus ${totalCount} votos.`
              : "Vas a enviar tu voto."}
          </Text>

          {/* Tarjeta con los datos de la decisión y la respuesta */}
          <View style={styles.modalSummaryCard}>
            <ScrollView
              style={{ maxHeight: 240 }}
              showsVerticalScrollIndicator={false}
            >
              {onlineItems.map((item: any, idx: number) => {
                const currentChoice = choices[item.id];
                const choiceLabel = !isJunta
                  ? currentChoice === "APPROVE"
                    ? "A favor"
                    : currentChoice === "REJECT"
                      ? "En contra"
                      : "Me abstengo"
                  : currentChoice === "APPROVE"
                    ? "Apruebo"
                    : currentChoice === "REJECT"
                      ? "Rechazo"
                      : "Me abstengo";

                // For single vote: look in session-level budgetProposals
                // For junta items with proposals: look in item.budgetProposals
                const chosenProp = selectedProposals[item.id]
                  ? isJunta
                    ? (item.budgetProposals || []).find(
                        (p: any) => p.id === selectedProposals[item.id],
                      )
                    : (activeSession.budgetProposals || []).find(
                        (p: any) => p.id === selectedProposals[item.id],
                      )
                  : null;

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.modalSummaryItem,
                      idx > 0 && {
                        borderTopWidth: 1,
                        borderTopColor: "#F1F5F9",
                        paddingTop: 12,
                        marginTop: 12,
                      },
                    ]}
                  >
                    <Text style={styles.modalItemTitle}>
                      {isJunta ? `${idx + 1}. ` : ""}
                      {item.title}
                    </Text>
                    {item.budget ? (
                      <Text style={styles.modalItemBudget}>{item.budget}</Text>
                    ) : null}

                    {chosenProp && (
                      <View
                        style={{
                          backgroundColor: "#F8FAFC",
                          padding: 10,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: "#E2E8F0",
                          marginVertical: 6,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            color: "#64748B",
                            fontWeight: "600",
                          }}
                        >
                          Presupuesto seleccionado:
                        </Text>
                        <Text
                          style={{
                            fontSize: 13,
                            color: "#0F172A",
                            fontWeight: "700",
                            marginTop: 2,
                          }}
                        >
                          {chosenProp.companyName} — {chosenProp.amount}
                        </Text>
                      </View>
                    )}

                    {!isJunta && (
                      <Text style={styles.modalAnswerLabel}>Tu voto</Text>
                    )}
                    <View style={styles.modalChoiceRow}>
                      <View style={styles.modalChoiceCheck}>
                        <Feather name="check" size={11} color="#FFFFFF" />
                      </View>
                      <Text style={styles.modalChoiceText}>{choiceLabel}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {/* Aviso: Una vez enviados, no podrás modificar tus votos. */}
          <View style={styles.modalNoticeBox}>
            <Feather name="info" size={18} color="#334155" />
            <Text style={styles.modalNoticeText}>
              {isJunta
                ? "Una vez enviados, no podrás modificar tus votos."
                : "Una vez enviado, no podrás modificar tu voto."}
            </Text>
          </View>

          {/* Botón Enviar */}
          <TouchableOpacity
            style={styles.modalSubmitBtn}
            onPress={handleConfirmSubmit}
            disabled={castMutation.isPending}
            activeOpacity={0.85}
          >
            {castMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.modalSubmitBtnText}>
                {isJunta ? "Enviar mis votos" : "Enviar"}
              </Text>
            )}
          </TouchableOpacity>

          {/* Botón Cancelar */}
          <TouchableOpacity
            style={styles.modalCancelBtn}
            onPress={() => setConfirmModalVisible(false)}
            disabled={castMutation.isPending}
            activeOpacity={0.7}
          >
            <Text style={styles.modalCancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ═════════════════════════════════════════════════════════════════════════════
  // PANTALLA JUNTA MULTI-PUNTOS (MATCH EXACTO media_1788544461209.png - SCREEN 07)
  // ═════════════════════════════════════════════════════════════════════════════
  if (isJunta) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        {renderHeader("Junta extraordinaria")}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Badge Pill de Cierre: "Cierre: 18 sept. · 23:59" */}
          <View style={styles.datePill}>
            <Text style={styles.datePillText}>Cierre: {formattedClose}</Text>
          </View>

          {/* Title & Counter: "3 decisiones para votar" / "2 de 3 respondidas" */}
          <Text style={styles.juntaHeaderTitle}>
            {totalCount}{" "}
            {totalCount === 1 ? "decisión para votar" : "decisiones para votar"}
          </Text>
          <Text style={styles.juntaHeaderSubtitle}>
            {answeredCount} de {totalCount} respondidas
          </Text>

          {/* List of online points */}
          {onlineItems.map((item: any, idx: number) => {
            const currentChoice = choices[item.id];
            const itemProposals: any[] = item.budgetProposals || [];
            const hasProposals = itemProposals.length > 0;
            const selectedPropId = selectedProposals[item.id];

            return (
              <View key={item.id} style={styles.juntaItemCard}>
                {/* Header row: number badge + title + type label */}
                <View style={styles.juntaItemHeaderRow}>
                  <View style={styles.juntaItemNumBadge}>
                    <Text style={styles.juntaItemNumText}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.juntaItemTitle}>{item.title}</Text>
                    <Text style={styles.juntaItemTypeLabel}>
                      {hasProposals ? "Votación con opciones" : "Votación simple"}
                    </Text>
                  </View>
                </View>

                {item.budget ? (
                  <Text style={styles.juntaItemBudget}>{item.budget}</Text>
                ) : null}

                {/* Proposals radio cards for multi-option items */}
                {hasProposals && (
                  <View style={styles.juntaProposalsContainer}>
                    {itemProposals.map((bp: any) => {
                      const isSelected = selectedPropId === bp.id;
                      return (
                        <TouchableOpacity
                          key={bp.id}
                          style={[
                            styles.juntaProposalCard,
                            isSelected && styles.juntaProposalCardSelected,
                          ]}
                          onPress={() => {
                            setSelectedProposals((prev: any) => ({
                              ...prev,
                              [item.id]: bp.id,
                            }));
                            // Auto-select APPROVE when a proposal is chosen
                            handleSelectChoice(item.id, "APPROVE");
                          }}
                          activeOpacity={0.75}
                        >
                          <View
                            style={[
                              styles.juntaProposalRadioOuter,
                              isSelected && styles.juntaProposalRadioOuterSelected,
                            ]}
                          >
                            {isSelected && (
                              <View style={styles.juntaProposalRadioInner} />
                            )}
                          </View>
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.juntaProposalCompany}>
                              {bp.companyName}
                            </Text>
                            {bp.description ? (
                              <Text style={styles.juntaProposalDesc}>
                                {bp.description}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={styles.juntaProposalAmount}>
                            {bp.amount}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    {/* Ver detalles y documentos link */}
                    <TouchableOpacity
                      onPress={() =>
                        Alert.alert(
                          "Documentos",
                          "Los documentos detallados de cada propuesta están disponibles en el panel de la comunidad.",
                        )
                      }
                      activeOpacity={0.7}
                    >
                      <Text style={styles.juntaProposalDocsLink}>
                        Ver detalles y documentos
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* 3 Horizontal buttons: A favor / En contra / Me abstengo */}
                <View style={styles.juntaOptionsRow}>
                  {VOTE_OPTIONS.map((opt) => {
                    const isSelected = currentChoice === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[
                          styles.juntaOptionBtn,
                          isSelected && styles.juntaOptionBtnSelected,
                        ]}
                        onPress={() => {
                          handleSelectChoice(item.id, opt.key);
                          // If switching away from APPROVE on multi-option item, clear proposal
                          if (hasProposals && opt.key !== "APPROVE") {
                            setSelectedProposals((prev: any) => ({
                              ...prev,
                              [item.id]: undefined,
                            }));
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        {isSelected && (
                          <View style={styles.juntaOptionCircle}>
                            <Feather name="check" size={10} color="#FFFFFF" />
                          </View>
                        )}
                        <Text
                          style={[
                            styles.juntaOptionText,
                            isSelected && styles.juntaOptionTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {/* Missing decisions warning box */}
          {!allAnswered && (
            <View style={styles.missingWarningBox}>
              <Feather name="alert-circle" size={24} color="#B45309" />
              <View style={{ flex: 1 }}>
                <Text style={styles.missingWarningTitle}>
                  {totalCount - answeredCount === 1
                    ? "Falta 1 decisión por responder"
                    : `Faltan ${totalCount - answeredCount} decisiones por responder`}
                </Text>
                <Text style={styles.missingWarningSubtitle}>
                  Completa todos los puntos para poder enviar tus votos.
                </Text>
              </View>
            </View>
          )}

          {/* Submit button: "Enviar mis votos" with lock icon when disabled */}
          <TouchableOpacity
            style={[
              styles.juntaSubmitBtn,
              { backgroundColor: allAnswered ? TEAL : "#80BEC4" },
            ]}
            onPress={handleOpenConfirmModal}
            disabled={!allAnswered}
            activeOpacity={0.85}
          >
            <Text style={styles.juntaSubmitBtnText}>
              Enviar mis votos
            </Text>
            {!allAnswered && <Feather name="lock" size={16} color="#FFFFFF" />}
          </TouchableOpacity>
        </ScrollView>

        {renderConfirmModal()}
      </SafeAreaView>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PANTALLA PRINCIPAL DE VOTACIÓN INDIVIDUAL (BIFURCADA SEGÚN NÚMERO DE PROPUESTAS)
  // ═════════════════════════════════════════════════════════════════════════════
  const singleProposals = (activeSession.budgetProposals || []).filter(
    (bp: any) =>
      !bp.itemId ||
      bp.itemId === activeSession.id ||
      bp.itemId === itemsList[0]?.id,
  );
  const isMultiProposal = singleProposals.length >= 2;

  const formatCloseDateLabel = (dateStr?: string | null) => {
    if (!dateStr) return "Cierra próximamente";
    try {
      const d = new Date(dateStr);
      const months = [
        "enero",
        "febr.",
        "marzo",
        "abr.",
        "mayo",
        "jun.",
        "jul.",
        "agosto",
        "sept.",
        "oct.",
        "nov.",
        "dic.",
      ];
      const day = d.getDate();
      const monthStr = months[d.getMonth()] || format(d, "MMM.", { locale: es });
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `Cierra el ${day} ${monthStr} a las ${hours}:${minutes}`;
    } catch {
      return "Cierra próximamente";
    }
  };

  if (isMultiProposal) {
    // ─────────────────────────────────────────────────────────────────────────
    // ESCENARIO 1: MÚLTIPLES PROPUESTAS (2+ OPCIONES / PRESUPUESTOS)
    // Coincidencia exacta con mockup media_1790086439892.jpg
    // ─────────────────────────────────────────────────────────────────────────
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Botón Volver (Flecha atrás simple) */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtnOnly}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={24} color={DARK} />
          </TouchableOpacity>

          {/* Título de la votación */}
          <Text style={styles.multiTitle}>{activeSession.title}</Text>
          <Text style={styles.multiSubtitle}>
            Selecciona el presupuesto que prefieres
          </Text>

          {/* Fila de metadatos: N presupuestos & Cierre */}
          <View style={styles.multiMetaRow}>
            <View style={styles.multiMetaItem}>
              <Feather name="file-text" size={15} color="#64748B" />
              <Text style={styles.multiMetaText}>
                {singleProposals.length} presupuestos
              </Text>
            </View>
            <View style={styles.multiMetaItem}>
              <Feather name="clock" size={15} color="#64748B" />
              <Text style={styles.multiMetaText}>
                {formatCloseDateLabel(activeSession.closesAt)}
              </Text>
            </View>
          </View>

          {/* Lista de tarjetas con Radio Button */}
          {singleProposals.map((prop: any) => {
            const isSelected = selectedProposals["__single__"] === prop.id;
            return (
              <TouchableOpacity
                key={prop.id}
                activeOpacity={0.85}
                style={[
                  styles.multiPropCard,
                  isSelected && styles.multiPropCardSelected,
                ]}
                onPress={() => {
                  setSelectedProposals((prev) => ({
                    ...prev,
                    ["__single__"]: prop.id,
                  }));
                  // Al seleccionar opción, activa automáticamente "A favor"
                  setChoices((prev) => ({
                    ...prev,
                    ["__single__"]: "APPROVE",
                  }));
                }}
              >
                <View
                  style={[
                    styles.multiRadioCircle,
                    isSelected && styles.multiRadioCircleSelected,
                  ]}
                >
                  {isSelected && <View style={styles.multiRadioInnerDot} />}
                </View>

                <View style={{ flex: 1, marginLeft: 14 }}>
                  <View style={styles.multiCardTopRow}>
                    <Text style={styles.multiCardCompany}>
                      {prop.companyName}
                    </Text>
                    <Text style={styles.multiCardAmount}>{prop.amount}</Text>
                  </View>

                  <View style={styles.multiCardSecondRow}>
                    <Text style={styles.multiCardDesc} numberOfLines={1}>
                      {prop.description || "Presupuesto detallado"}
                    </Text>
                    <Text style={styles.multiCardVat}>IVA incluido</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.multiCardPdfRow}
                    onPress={() => {
                      if (prop.fileUrl) {
                        void Linking.openURL(prop.fileUrl);
                      } else {
                        Alert.alert(
                          "Presupuesto",
                          "Presupuesto técnico detallado en formato PDF.",
                        );
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.multiCardPdfText}>
                      Ver presupuesto
                    </Text>
                    <Feather name="chevron-right" size={16} color="#008075" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Sección: ¿Cómo quieres votar? */}
          <View style={styles.multiVoteSection}>
            <Text style={styles.multiVoteHeading}>¿Cómo quieres votar?</Text>
            <Text style={styles.multiVoteSubheading}>
              Tu voto se registrará para el presupuesto seleccionado
            </Text>

            <View style={styles.multiVoteButtonsRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.multiVoteStanceBtn,
                  choices["__single__"] === "APPROVE" &&
                    styles.multiVoteStanceBtnSelected,
                ]}
                onPress={() => handleSelectChoice("__single__", "APPROVE")}
              >
                <Feather
                  name="thumbs-up"
                  size={18}
                  color={
                    choices["__single__"] === "APPROVE" ? "#008075" : "#0F172A"
                  }
                />
                <Text
                  style={[
                    styles.multiVoteStanceText,
                    choices["__single__"] === "APPROVE" &&
                      styles.multiVoteStanceTextSelected,
                  ]}
                >
                  A favor
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.multiVoteStanceBtn,
                  choices["__single__"] === "REJECT" &&
                    styles.multiVoteStanceBtnSelected,
                ]}
                onPress={() => handleSelectChoice("__single__", "REJECT")}
              >
                <Feather
                  name="thumbs-down"
                  size={18}
                  color={
                    choices["__single__"] === "REJECT" ? "#008075" : "#0F172A"
                  }
                />
                <Text
                  style={[
                    styles.multiVoteStanceText,
                    choices["__single__"] === "REJECT" &&
                      styles.multiVoteStanceTextSelected,
                  ]}
                >
                  En contra
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.multiVoteStanceBtn,
                  choices["__single__"] === "ABSTAIN" &&
                    styles.multiVoteStanceBtnSelected,
                ]}
                onPress={() => handleSelectChoice("__single__", "ABSTAIN")}
              >
                <Ionicons
                  name="hand-left-outline"
                  size={18}
                  color={
                    choices["__single__"] === "ABSTAIN" ? "#008075" : "#0F172A"
                  }
                />
                <Text
                  style={[
                    styles.multiVoteStanceText,
                    choices["__single__"] === "ABSTAIN" &&
                      styles.multiVoteStanceTextSelected,
                  ]}
                >
                  Me abstengo
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.mainConfirmVoteBtn,
                {
                  backgroundColor: choices["__single__"]
                    ? "#008075"
                    : "#CBD5E1",
                },
              ]}
              onPress={handleOpenConfirmModal}
              disabled={!choices["__single__"]}
              activeOpacity={0.85}
            >
              <Text style={styles.mainConfirmVoteBtnText}>Confirmar voto</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {renderConfirmModal()}
      </SafeAreaView>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ESCENARIO 2: UNA SOLA OPCIÓN / DECISIÓN DIRECTA (0 ó 1 PROPUESTA)
  // Coincidencia exacta con mockup media_1790086439903.png
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Botón Volver (Flecha atrás simple) */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtnOnly}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={24} color={DARK} />
        </TouchableOpacity>

        {/* Título y subtítulo */}
        <Text style={styles.singleTitle}>{activeSession.title}</Text>
        <Text style={styles.singleSubtitle}>
          {activeSession.description || "Presupuesto anual de la comunidad"}
        </Text>

        {/* Gran Tarjeta Central de Importe y Documento */}
        {(() => {
          const singleAmount = singleProposals[0]?.amount || activeSession.budget;
          const hasAmount = !!singleAmount;
          return (
            <View style={styles.singleBigCard}>
              {hasAmount && (
                <>
                  <View style={styles.singleEuroIconCircle}>
                    <View style={styles.singleEuroDocWrap}>
                      <Feather name="file-text" size={22} color="#008075" />
                      <Text style={styles.singleDocEuroSign}>€</Text>
                    </View>
                  </View>

                  <Text style={styles.singleAmountDisplay}>{singleAmount}</Text>
                  <Text style={styles.singleAmountSub}>Importe total</Text>

                  <View style={styles.singleCardDivider} />
                </>
              )}

              <TouchableOpacity
                style={styles.singleFileRow}
                onPress={() => {
                  const url = singleProposals[0]?.fileUrl;
                  if (url) {
                    void Linking.openURL(url);
                  } else {
                    Alert.alert(
                      "Documento",
                      "Documento detallado de la votación en formato PDF.",
                    );
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.singlePdfBadge}>
                  <Feather name="file-text" size={20} color="#008075" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.singleFileTitle}>
                    Ver documento completo
                  </Text>
                  <Text style={styles.singleFileSubtitle}>
                    Documento detallado
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* Pastilla de fecha de cierre */}
        <View style={styles.singleDatePillContainer}>
          <Feather
            name="calendar"
            size={16}
            color="#008075"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.singleDatePillText}>
            {formatCloseDateLabel(activeSession.closesAt)}
          </Text>
        </View>

        {/* Sección: ¿Cuál es tu voto? */}
        <View style={styles.singleVoteSection}>
          <Text style={styles.singleVoteHeading}>¿Cuál es tu voto?</Text>
          <Text style={styles.singleVoteSubheading}>
            Tu voto quedará registrado de forma segura.
          </Text>

          <View style={styles.singleVoteCardsRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.singleChoiceCard,
                choices["__single__"] === "APPROVE" &&
                  styles.singleChoiceCardSelected,
              ]}
              onPress={() => handleSelectChoice("__single__", "APPROVE")}
            >
              <Feather
                name="thumbs-up"
                size={24}
                color={
                  choices["__single__"] === "APPROVE" ? "#008075" : "#0F172A"
                }
              />
              <Text
                style={[
                  styles.singleChoiceCardText,
                  choices["__single__"] === "APPROVE" &&
                    styles.singleChoiceCardTextSelected,
                ]}
              >
                A favor
              </Text>
              <View
                style={[
                  styles.singleChoiceRadio,
                  choices["__single__"] === "APPROVE" &&
                    styles.singleChoiceRadioSelected,
                ]}
              >
                {choices["__single__"] === "APPROVE" && (
                  <View style={styles.singleChoiceRadioDot} />
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.singleChoiceCard,
                choices["__single__"] === "REJECT" &&
                  styles.singleChoiceCardSelected,
              ]}
              onPress={() => handleSelectChoice("__single__", "REJECT")}
            >
              <Feather
                name="thumbs-down"
                size={24}
                color={
                  choices["__single__"] === "REJECT" ? "#008075" : "#0F172A"
                }
              />
              <Text
                style={[
                  styles.singleChoiceCardText,
                  choices["__single__"] === "REJECT" &&
                    styles.singleChoiceCardTextSelected,
                ]}
              >
                En contra
              </Text>
              <View
                style={[
                  styles.singleChoiceRadio,
                  choices["__single__"] === "REJECT" &&
                    styles.singleChoiceRadioSelected,
                ]}
              >
                {choices["__single__"] === "REJECT" && (
                  <View style={styles.singleChoiceRadioDot} />
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.singleChoiceCard,
                choices["__single__"] === "ABSTAIN" &&
                  styles.singleChoiceCardSelected,
              ]}
              onPress={() => handleSelectChoice("__single__", "ABSTAIN")}
            >
              <Ionicons
                name="hand-left-outline"
                size={24}
                color={
                  choices["__single__"] === "ABSTAIN" ? "#008075" : "#0F172A"
                }
              />
              <Text
                style={[
                  styles.singleChoiceCardText,
                  choices["__single__"] === "ABSTAIN" &&
                    styles.singleChoiceCardTextSelected,
                ]}
              >
                Me abstengo
              </Text>
              <View
                style={[
                  styles.singleChoiceRadio,
                  choices["__single__"] === "ABSTAIN" &&
                    styles.singleChoiceRadioSelected,
                ]}
              >
                {choices["__single__"] === "ABSTAIN" && (
                  <View style={styles.singleChoiceRadioDot} />
                )}
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.mainConfirmVoteBtn,
              {
                backgroundColor: choices["__single__"]
                  ? "#008075"
                  : "#CBD5E1",
              },
            ]}
            onPress={handleOpenConfirmModal}
            disabled={!choices["__single__"]}
            activeOpacity={0.85}
          >
            <Text style={styles.mainConfirmVoteBtnText}>Confirmar voto</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {renderConfirmModal()}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: BG,
  },
  loadingText: { marginTop: 12, fontSize: 14, color: MUTED, fontWeight: "500" },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: DARK, marginBottom: 6 },
  emptySubtitle: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    lineHeight: 22,
  },

  // Header superior
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: TEAL,
  },
  headerRightIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerIconBtn: {
    padding: 4,
  },

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
  sessionPillActive: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },
  sessionPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  sessionPillTextActive: {
    color: "#FFFFFF",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
  },

  // Badge Pill de Cierre
  datePill: {
    backgroundColor: PILL_BG,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: "flex-start",
    marginBottom: 14,
  },
  datePillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },

  // Item wrapper
  itemWrapper: {
    marginBottom: 16,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: DARK,
    marginBottom: 2,
  },
  mainBudget: {
    fontSize: 22,
    fontWeight: "800",
    color: DARK,
    marginBottom: 18,
  },

  // Tarjeta Propuesta
  propuestaCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 24,
  },
  propuestaTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: DARK,
    marginBottom: 6,
  },
  propuestaDesc: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 19,
    marginBottom: 12,
  },
  pdfLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  pdfLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: TEAL,
  },

  // Alternativas de presupuestos si hay varias
  multiProposalsBox: {
    gap: 8,
    marginTop: 8,
  },
  multiProposalsTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: DARK,
    marginBottom: 4,
  },
  proposalItemCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
  },
  proposalItemCardSelected: {
    backgroundColor: TEAL_LIGHT,
    borderColor: TEAL,
    borderWidth: 1.5,
  },
  proposalItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  proposalCompany: {
    fontSize: 14,
    fontWeight: "700",
    color: DARK,
    flex: 1,
  },
  proposalAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: TEAL,
  },
  proposalItemDescText: {
    fontSize: 12,
    color: MUTED,
    marginBottom: 8,
  },
  proposalItemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    gap: 8,
  },
  selectPropBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
  },
  selectPropBtnActive: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },
  selectPropBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: DARK,
  },
  selectPropBtnTextActive: {
    color: "#FFFFFF",
  },

  // Pregunta destacada
  questionPrompt: {
    fontSize: 18,
    fontWeight: "800",
    color: DARK,
    marginBottom: 16,
  },

  // Lista de 3 Opciones Verticales
  optionsList: {
    gap: 10,
    marginBottom: 8,
  },
  verticalOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  verticalOptionCardSelected: {
    borderColor: TEAL,
    borderWidth: 1.5,
    backgroundColor: TEAL_LIGHT,
  },
  optionCircleIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  optionCircleIconSelected: {
    backgroundColor: TEAL,
  },
  optionCircleIconUnselected: {
    borderWidth: 1.5,
    borderColor: "#475569",
    backgroundColor: "transparent",
  },
  verticalOptionText: {
    fontSize: 15,
    fontWeight: "600",
    color: DARK,
    marginLeft: 14,
  },
  verticalOptionTextSelected: {
    fontWeight: "700",
    color: DARK,
  },

  // Junta counter
  counterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 12,
    marginBottom: 8,
  },
  counterText: { fontSize: 14, fontWeight: "700", color: DARK },
  counterReady: { fontSize: 12, fontWeight: "700", color: GREEN_BTN },
  counterPending: { fontSize: 12, fontWeight: "600", color: "#E11D48" },

  // Botón Principal Confirmar y Enviar
  submitBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 24,
    shadowColor: TEAL,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // ─── Screen 07: Junta Multi-Decisión Styles ──────────────────────────────
  juntaHeaderTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: DARK,
    marginBottom: 4,
  },
  juntaHeaderSubtitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TEAL,
    marginBottom: 18,
  },
  juntaItemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 12,
  },
  juntaItemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: DARK,
    marginBottom: 2,
  },
  juntaItemBudget: {
    fontSize: 14,
    fontWeight: "700",
    color: DARK,
    marginBottom: 12,
  },
  juntaItemHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  juntaItemNumBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  juntaItemNumText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  juntaItemTypeLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#94A3B8",
    marginTop: 2,
  },
  juntaProposalsContainer: {
    marginBottom: 12,
    gap: 8,
  },
  juntaProposalCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FAFAFA",
  },
  juntaProposalCardSelected: {
    borderColor: TEAL,
    borderWidth: 1.5,
    backgroundColor: TEAL_LIGHT,
  },
  juntaProposalRadioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  juntaProposalRadioOuterSelected: {
    borderColor: TEAL,
  },
  juntaProposalRadioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: TEAL,
  },
  juntaProposalCompany: {
    fontSize: 13,
    fontWeight: "700",
    color: DARK,
  },
  juntaProposalDesc: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  juntaProposalAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: TEAL,
    marginLeft: 8,
    flexShrink: 0,
  },
  juntaProposalDocsLink: {
    fontSize: 13,
    fontWeight: "600",
    color: TEAL,
    textAlign: "center",
    paddingVertical: 6,
  },
  juntaOptionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  juntaOptionBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  juntaOptionBtnSelected: {
    borderColor: TEAL,
    borderWidth: 1.5,
    backgroundColor: TEAL_LIGHT,
  },
  juntaOptionCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  juntaOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  juntaOptionTextSelected: {
    fontWeight: "700",
    color: TEAL,
  },
  missingWarningBox: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FEF3C7",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
    marginBottom: 16,
  },
  missingWarningTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400E",
  },
  missingWarningSubtitle: {
    fontSize: 12,
    color: "#B45309",
    marginTop: 2,
    lineHeight: 17,
  },
  juntaSubmitBtn: {
    flexDirection: "row",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 24,
    gap: 8,
    shadowColor: TEAL,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  juntaSubmitBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Presencial Notice
  presentialNoticeBox: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    marginTop: 6,
    marginBottom: 16,
  },
  presentialNoticeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: DARK,
    marginBottom: 2,
  },
  presentialNoticeText: {
    fontSize: 12,
    color: MUTED,
    lineHeight: 16,
  },

  // Pantalla de Éxito / Cerrada
  successHeader: { alignItems: "center", marginBottom: 24 },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: DARK,
    marginBottom: 6,
    textAlign: "center",
  },
  successSubtitle: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    lineHeight: 20,
  },
  officialResultCard: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
    borderColor: "#86EFAC",
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    alignItems: "center",
    width: "100%",
  },
  officialResultBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#15803D",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  officialResultTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#166534",
    textAlign: "center",
  },

  // Resumen
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  summaryCardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: DARK,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 8,
  },
  summaryItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  summaryItemTitle: { fontSize: 14, fontWeight: "700", color: DARK },
  summaryItemBudget: {
    fontSize: 13,
    fontWeight: "700",
    color: TEAL,
    marginTop: 2,
  },
  choiceTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  choiceTagText: { fontSize: 12, fontWeight: "800" },
  summaryFooter: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  summaryTimestamp: { fontSize: 12, color: MUTED, marginBottom: 4 },
  summaryCoef: { fontSize: 12, fontWeight: "600", color: DARK },

  // Deudores
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
  debtTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#9F1239",
    marginBottom: 8,
    textAlign: "center",
  },
  debtSubtitle: {
    fontSize: 13,
    color: "#881337",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
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
  infoBoxTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: DARK,
    marginBottom: 4,
  },
  infoBoxText: { fontSize: 12, color: MUTED, lineHeight: 18 },

  // ─── Modal de Confirmación (Exacto media_1788543618779.png) ───────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  modalBackdropTouchable: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 36,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalCloseBtn: {
    position: "absolute",
    top: 20,
    right: 20,
    padding: 6,
    zIndex: 10,
  },
  shieldIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: TEAL_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: DARK,
    textAlign: "center",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: MUTED,
    textAlign: "center",
    marginBottom: 18,
  },
  modalSummaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 16,
  },
  modalSummaryItem: {
    width: "100%",
  },
  modalItemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: DARK,
    marginBottom: 2,
  },
  modalItemBudget: {
    fontSize: 15,
    fontWeight: "800",
    color: DARK,
    marginBottom: 12,
  },
  modalAnswerLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: MUTED,
    marginBottom: 8,
  },
  modalChoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalChoiceCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  modalChoiceText: {
    fontSize: 14,
    fontWeight: "700",
    color: TEAL,
  },
  modalNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    marginBottom: 20,
  },
  modalNoticeText: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "500",
    flex: 1,
    lineHeight: 17,
  },
  modalSubmitBtn: {
    backgroundColor: TEAL,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: TEAL,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  modalSubmitBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalCancelBtn: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: TEAL,
  },

  // ─── Pantalla Voto Registrado (Exacto media_1788544403855.png) ────────────
  successCircleLarge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: TEAL_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 24,
    marginBottom: 16,
  },
  successTitleText: {
    fontSize: 22,
    fontWeight: "800",
    color: DARK,
    textAlign: "center",
    marginBottom: 6,
  },
  successSubtitleText: {
    fontSize: 14,
    fontWeight: "500",
    color: MUTED,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  votedSummaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
    marginBottom: 20,
  },
  votedItemSection: {
    width: "100%",
  },
  votedItemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: DARK,
    marginBottom: 2,
  },
  votedItemBudget: {
    fontSize: 15,
    fontWeight: "800",
    color: DARK,
    marginBottom: 14,
  },
  votedResponseLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: MUTED,
    marginBottom: 8,
  },
  votedChoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  votedChoiceCheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  votedChoiceText: {
    fontSize: 14,
    fontWeight: "700",
    color: TEAL,
  },
  votedSentDateText: {
    fontSize: 13,
    fontWeight: "500",
    color: MUTED,
    marginTop: 16,
  },
  outlineReturnBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: TEAL,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 28,
  },
  outlineReturnBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: TEAL,
  },

  // ─── Screen 1: Multi-Proposal Styles (Exact Mockup 1) ──────────────────────
  backBtnOnly: {
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  multiTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: DARK,
    marginBottom: 4,
  },
  multiSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 14,
  },
  multiMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 18,
  },
  multiMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  multiMetaText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  multiPropCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  multiPropCardSelected: {
    borderColor: "#008075",
    backgroundColor: "#F0FDF9",
  },
  multiRadioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  multiRadioCircleSelected: {
    borderColor: "#008075",
  },
  multiRadioInnerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#008075",
  },
  multiCardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  multiCardCompany: {
    fontSize: 15,
    fontWeight: "700",
    color: DARK,
  },
  multiCardAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: DARK,
  },
  multiCardSecondRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  multiCardDesc: {
    fontSize: 12,
    color: "#64748B",
    flex: 1,
    marginRight: 8,
  },
  multiCardVat: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "500",
  },
  multiCardPdfRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 2,
  },
  multiCardPdfText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#008075",
  },
  multiVoteSection: {
    marginTop: 12,
  },
  multiVoteHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: DARK,
  },
  multiVoteSubheading: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 3,
    marginBottom: 14,
  },
  multiVoteButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  multiVoteStanceBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  multiVoteStanceBtnSelected: {
    borderColor: "#008075",
    backgroundColor: "#E6F7F5",
  },
  multiVoteStanceText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  multiVoteStanceTextSelected: {
    color: "#008075",
    fontWeight: "700",
  },
  mainConfirmVoteBtn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  mainConfirmVoteBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // ─── Screen 2: Single-Option Styles (Exact Mockup 2) ───────────────────────
  singleTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: DARK,
    marginBottom: 4,
  },
  singleSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 20,
  },
  singleBigCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 14,
  },
  singleEuroIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E6F7F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  singleEuroDocWrap: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  singleDocEuroSign: {
    position: "absolute",
    fontSize: 10,
    fontWeight: "900",
    color: "#008075",
    top: 5,
  },
  singleAmountDisplay: {
    fontSize: 38,
    fontWeight: "800",
    color: "#008075",
    letterSpacing: -0.5,
  },
  singleAmountSub: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "500",
    marginTop: 2,
    marginBottom: 18,
  },
  singleCardDivider: {
    width: "100%",
    height: 1,
    backgroundColor: "#F1F5F9",
    marginBottom: 14,
  },
  singleFileRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  singlePdfBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#F0FDF9",
    alignItems: "center",
    justifyContent: "center",
  },
  singleFileTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: DARK,
  },
  singleFileSubtitle: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 1,
  },
  singleDatePillContainer: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  singleDatePillText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
  },
  singleVoteSection: {
    marginTop: 4,
  },
  singleVoteHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: DARK,
  },
  singleVoteSubheading: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 3,
    marginBottom: 14,
  },
  singleVoteCardsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  singleChoiceCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: BORDER,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  singleChoiceCardSelected: {
    borderColor: "#008075",
    backgroundColor: "#E6F7F5",
  },
  singleChoiceCardText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  singleChoiceCardTextSelected: {
    color: "#0F172A",
    fontWeight: "700",
  },
  singleChoiceRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  singleChoiceRadioSelected: {
    borderColor: "#008075",
    borderWidth: 2,
  },
  singleChoiceRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#008075",
  },
});
