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
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { api, queryClient } from "~/utils/api";

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
      setStep("VOTE");
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

  const sessionList = (sessions as any[]) ?? [];
  const pendingOpen = sessionList.find(
    (s) => s.status === "OPEN" && !s.hasVoted,
  );

  const activeSession = selectedSessionId
    ? (sessionList.find((s) => s.id === selectedSessionId) ??
      pendingOpen ??
      sessionList[0])
    : (pendingOpen ?? sessionList[0]);

  useFocusEffect(
    useCallback(() => {
      void refetch();
      if (
        !activeSession?.hasVoted &&
        justVotedSessionId !== activeSession?.id
      ) {
        setStep("VOTE");
      }
    }, [
      refetch,
      activeSession?.hasVoted,
      justVotedSessionId,
      activeSession?.id,
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
      !activeSession.hasVoted &&
      justVotedSessionId !== activeSession.id
    ) {
      setStep("VOTE");
      setChoices({});
    }
  }, [activeSession?.id]);

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
        currentSelected.hasVoted
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
      setJustVotedSessionId(activeSession?.id ?? null);
      setStep("SUCCESS");
      void queryClient.invalidateQueries(
        api.voting.all.queryFilter({ tenantId: TENANT_ID }),
      );
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
    }

    setConfirmModalVisible(true);
  };

  const handleConfirmSubmit = () => {
    if (!activeSession) return;

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
      castMutation.mutate({
        sessionId: activeSession.id,
        tenantId: TENANT_ID,
        userId: USER_ID,
        choice: choices["__single__"] as ChoiceType,
        selectedProposalId: selectedProposals["__single__"] || undefined,
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
  const isClosed = activeSession.status === "CLOSED";
  const canVote = activeSession.userVotingStatus?.canVote ?? true;
  const isAlreadyVoted = Boolean(
    activeSession.hasVoted ||
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

  // Top header with Back + Title on left, Bell + User on right
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
      <View style={styles.headerRightIcons}>
        <TouchableOpacity
          onPress={() => router.push("/(vecino)/communication")}
          style={styles.headerIconBtn}
          activeOpacity={0.7}
        >
          <Feather name="bell" size={20} color={DARK} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerIconBtn}
          activeOpacity={0.7}
        >
          <Feather name="user" size={20} color={DARK} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSessionSwitcher = () => {
    if (!sessions || (sessions as any[]).length <= 1) return null;
    return (
      <View style={styles.sessionSwitcherBox}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sessionSwitcherContent}
        >
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
                  setJustVotedSessionId(null);
                  setChoices({});
                }}
                style={[
                  styles.sessionPill,
                  isSelected && styles.sessionPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.sessionPillText,
                    isSelected && styles.sessionPillTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {isVoted
                    ? "✓ "
                    : s.status === "CLOSED"
                      ? "🔒 "
                      : isJuntaType
                        ? "⚖️ "
                        : "🗳️ "}
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
        {renderHeader(isJunta ? "Junta extraordinaria" : "Votación activa")}
        {renderSessionSwitcher()}

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
        {renderSessionSwitcher()}

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

          {/* Botón Volver a Inicio (Outline blanco con borde teal) */}
          <TouchableOpacity
            style={styles.outlineReturnBtn}
            onPress={() => {
              setStep("VOTE");
              setJustVotedSessionId(null);
              setChoices({});
              router.replace("/(vecino)");
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.outlineReturnBtnText}>Volver a Inicio</Text>
          </TouchableOpacity>
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
            {isJunta ? "Confirmar y enviar mis votos" : "Confirmar y enviar"}
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
                const choiceLabel =
                  currentChoice === "APPROVE"
                    ? "Apruebo"
                    : currentChoice === "REJECT"
                      ? "Rechazo"
                      : "Me abstengo";

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

                    {!isJunta && (
                      <Text style={styles.modalAnswerLabel}>Tu respuesta</Text>
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

          {/* Botón Confirmar y enviar */}
          <TouchableOpacity
            style={styles.modalSubmitBtn}
            onPress={handleConfirmSubmit}
            disabled={castMutation.isPending}
            activeOpacity={0.85}
          >
            {castMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.modalSubmitBtnText}>Confirmar y enviar</Text>
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
        {renderSessionSwitcher()}

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
            return (
              <View key={item.id} style={styles.juntaItemCard}>
                <Text style={styles.juntaItemTitle}>
                  {`${idx + 1}. ${item.title}`}
                </Text>
                {item.budget ? (
                  <Text style={styles.juntaItemBudget}>{item.budget}</Text>
                ) : null}

                {/* 3 Horizontal buttons: Apruebo, Rechazo, Me abstengo */}
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
                        onPress={() => handleSelectChoice(item.id, opt.key)}
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

          {/* Submit button: "Confirmar y enviar mis votos" with lock icon when disabled */}
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
              Confirmar y enviar mis votos
            </Text>
            {!allAnswered && <Feather name="lock" size={16} color="#FFFFFF" />}
          </TouchableOpacity>
        </ScrollView>

        {renderConfirmModal()}
      </SafeAreaView>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PANTALLA PRINCIPAL DE VOTACIÓN INDIVIDUAL (MATCH EXACTO media_1788543451554.png)
  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      {/* 1. Header con flecha teal, texto 'Votación activa', campana y usuario */}
      {renderHeader("Votación activa")}
      {renderSessionSwitcher()}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Badge Pill de Cierre: "Cierre: 18 sept. · 23:59" */}
        <View style={styles.datePill}>
          <Text style={styles.datePillText}>Cierre: {formattedClose}</Text>
        </View>

        {/* 3. Items o Sesión única */}
        {itemsList.map((item: any, idx: number) => {
          const currentChoice = choices[item.id];
          const isPresentialOnly = item.onlineVotingEnabled === false;
          const itemProposals = (activeSession.budgetProposals || []).filter(
            (bp: any) => !bp.itemId || bp.itemId === item.id,
          );

          return (
            <View key={item.id} style={styles.itemWrapper}>
              {/* Título & Presupuesto (ej: "Reparación del ascensor" / "5.500 €") */}
              <Text style={styles.mainTitle}>{item.title}</Text>
              {item.budget ? (
                <Text style={styles.mainBudget}>{item.budget}</Text>
              ) : null}

              {/* 4. Tarjeta Propuesta */}
              <View style={styles.propuestaCard}>
                <Text style={styles.propuestaTitle}>Propuesta</Text>
                <Text style={styles.propuestaDesc}>
                  {item.description ||
                    activeSession.description ||
                    "Sustituir el motor del ascensor por uno más eficiente según el presupuesto adjunto."}
                </Text>

                {/* Si hay múltiples propuestas comparativas de empresas */}
                {itemProposals.length > 1 ? (
                  <View style={styles.multiProposalsBox}>
                    <Text style={styles.multiProposalsTitle}>
                      Propuestas recibidas:
                    </Text>
                    {itemProposals.map((prop: any) => {
                      const isPropSelected =
                        selectedProposals[item.id] === prop.id;
                      return (
                        <View
                          key={prop.id}
                          style={[
                            styles.proposalItemCard,
                            isPropSelected && styles.proposalItemCardSelected,
                          ]}
                        >
                          <View style={styles.proposalItemHeader}>
                            <Text style={styles.proposalCompany}>
                              {prop.companyName}
                            </Text>
                            <Text style={styles.proposalAmount}>
                              {prop.amount}
                            </Text>
                          </View>
                          {prop.description ? (
                            <Text style={styles.proposalItemDescText}>
                              {prop.description}
                            </Text>
                          ) : null}
                          <View style={styles.proposalItemFooter}>
                            <TouchableOpacity
                              style={styles.pdfLinkRow}
                              onPress={() =>
                                prop.fileUrl && Linking.openURL(prop.fileUrl)
                              }
                            >
                              <Feather
                                name="file-text"
                                size={15}
                                color={TEAL}
                              />
                              <Text style={styles.pdfLinkText}>
                                Ver {prop.fileName || "presupuesto.pdf"}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.selectPropBtn,
                                isPropSelected && styles.selectPropBtnActive,
                              ]}
                              onPress={() =>
                                setSelectedProposals((prev) => ({
                                  ...prev,
                                  [item.id]: prop.id,
                                }))
                              }
                            >
                              <Text
                                style={[
                                  styles.selectPropBtnText,
                                  isPropSelected &&
                                    styles.selectPropBtnTextActive,
                                ]}
                              >
                                {isPropSelected
                                  ? "✓ Seleccionada"
                                  : "Elegir propuesta"}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  /* Enlace único a Ver presupuesto.pdf con icono de archivo */
                  <TouchableOpacity
                    style={styles.pdfLinkRow}
                    onPress={() => {
                      const pdfUrl = itemProposals[0]?.fileUrl;
                      if (pdfUrl) {
                        void Linking.openURL(pdfUrl);
                      } else {
                        Alert.alert(
                          "Presupuesto",
                          "Presupuesto técnico detallado en formato PDF.",
                        );
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Feather name="file-text" size={16} color={TEAL} />
                    <Text style={styles.pdfLinkText}>
                      Ver {itemProposals[0]?.fileName || "presupuesto.pdf"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Si es sólo presencial */}
              {isPresentialOnly ? (
                <View style={styles.presentialNoticeBox}>
                  <Text style={{ fontSize: 24, marginRight: 10 }}>👥</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.presentialNoticeTitle}>
                      Votación presencial en Junta
                    </Text>
                    <Text style={styles.presentialNoticeText}>
                      Este punto se debatirá y votará presencialmente durante la
                      reunión de la Junta.
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  {/* 5. Pregunta destacada: "¿Apruebas la reparación del ascensor?" */}
                  <Text style={styles.questionPrompt}>
                    {formatQuestion(item.title)}
                  </Text>

                  {/* 6. Tres Opciones Verticales: Apruebo, Rechazo, Me abstengo */}
                  <View style={styles.optionsList}>
                    {VOTE_OPTIONS.map((opt) => {
                      const isSelected = currentChoice === opt.key;
                      return (
                        <TouchableOpacity
                          key={opt.key}
                          style={[
                            styles.verticalOptionCard,
                            isSelected && styles.verticalOptionCardSelected,
                          ]}
                          onPress={() => handleSelectChoice(item.id, opt.key)}
                          activeOpacity={0.8}
                        >
                          <View
                            style={[
                              styles.optionCircleIcon,
                              isSelected
                                ? styles.optionCircleIconSelected
                                : styles.optionCircleIconUnselected,
                            ]}
                          >
                            {isSelected ? (
                              <Feather name="check" size={14} color="#FFFFFF" />
                            ) : (
                              <Feather name="minus" size={12} color="#475569" />
                            )}
                          </View>
                          <Text
                            style={[
                              styles.verticalOptionText,
                              isSelected && styles.verticalOptionTextSelected,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          );
        })}

        {/* 7. Botón Inferior: "Confirmar y enviar" (abre el modal de confirmación) */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            { backgroundColor: allAnswered ? TEAL : "#CBD5E1" },
          ]}
          onPress={handleOpenConfirmModal}
          disabled={!allAnswered}
          activeOpacity={0.85}
        >
          <Text style={styles.submitBtnText}>Confirmar y enviar</Text>
        </TouchableOpacity>
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
});
