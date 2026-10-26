import { useCallback, useMemo, useState } from "react";
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

import { api, queryClient } from "~/utils/api";

const TENANT_ID = "org_aconvi_demo";

const NAVY = "#133A63";
const NAVY_DARK = "#0F2B48";
const BLUE_MUTED = "#5B87B5";
const GREEN = "#008075";
const GREEN_SUCCESS = "#16A34A";
const GREEN_BG = "#DCFCE7";
const RED_REJECT = "#DC2626";
const RED_BG = "#FEE2E2";
const YELLOW_ABSTAIN = "#D97706";
const YELLOW_BG = "#FEF3C7";
const BORDER = "#E2E8F0";
const BG = "#F8FAFC";

export default function EscrutinioScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    sessionId?: string;
    itemId?: string;
    winningProposalId?: string;
  }>();

  const sessionId = params.sessionId;
  const itemId = params.itemId;
  const winningProposalId = params.winningProposalId;

  const [searchQuery, setSearchQuery] = useState("");
  const [invertLogic, setInvertLogic] = useState(false); // false: default Favor; true: default Contra
  const [inPersonOverrides, setInPersonOverrides] = useState<
    Record<string, "APPROVE" | "REJECT" | "ABSTAIN">
  >({});
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: scrutinyData,
    isLoading,
    refetch,
  } = useQuery({
    ...api.meeting.getScrutinyState.queryOptions({
      tenantId: TENANT_ID,
      itemId: itemId || "00000000-0000-0000-0000-000000000000",
      defaultLogic: invertLogic ? "ASSUME_AGAINST" : "ASSUME_FAVOR",
    }),
    enabled: Boolean(itemId),
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

  const saveRoundMutation = useMutation(
    api.meeting.saveScrutinyRound.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries();
        Alert.alert(
          "Escrutinio guardado",
          "Los resultados de la votación presencial han sido registrados conforme a la LPH.",
          [
            {
              text: "Continuar",
              onPress: () =>
                router.push({
                  pathname: "/(af)/orden-del-dia" as any,
                  params: { sessionId },
                }),
            },
          ],
        );
      },
      onError: (err: any) => {
        Alert.alert(
          "Error",
          err?.message || "No se pudo guardar el escrutinio.",
        );
      },
    }),
  );

  const newRoundMutation = useMutation(
    api.meeting.startNewScrutinyRound.mutationOptions({
      onSuccess: async (data) => {
        await refetch();
        setInPersonOverrides({});
        Alert.alert(
          "Nueva ronda iniciada",
          `Se ha iniciado la Ronda ${data.currentRound}.`,
        );
      },
      onError: (err: any) => {
        Alert.alert(
          "Error",
          err?.message || "No se pudo iniciar una nueva ronda.",
        );
      },
    }),
  );

  const allVoterRows = scrutinyData?.voterRows ?? [];
  const presentOwners = useMemo(
    () => allVoterRows.filter((v: any) => v.inPersonPresent),
    [allVoterRows],
  );
  const homeVoters = useMemo(
    () => allVoterRows.filter((v: any) => v.fromHome),
    [allVoterRows],
  );
  const homeVotesMap = useMemo(() => {
    const map = new Map<string, "APPROVE" | "REJECT" | "ABSTAIN">();
    for (const hv of homeVoters) {
      map.set(hv.memberId, hv.choice as any);
    }
    return map;
  }, [homeVoters]);

  // Compute live counts with current overrides and invert logic
  const liveScrutiny = useMemo(() => {
    let favorCount = 0;
    let favorCoeff = 0;
    let againstCount = 0;
    let againstCoeff = 0;
    let abstainCount = 0;
    let abstainCoeff = 0;

    // 1. Home voters
    for (const hv of homeVoters) {
      if (hv.choice === "APPROVE") {
        favorCount += 1;
        favorCoeff += hv.coefficient || 0;
      } else if (hv.choice === "REJECT") {
        againstCount += 1;
        againstCoeff += hv.coefficient || 0;
      } else {
        abstainCount += 1;
        abstainCoeff += hv.coefficient || 0;
      }
    }

    // 2. In-person attendees who did not vote from home
    const defaultChoice: "APPROVE" | "REJECT" = invertLogic
      ? "REJECT"
      : "APPROVE";

    for (const owner of presentOwners) {
      if (homeVotesMap.has(owner.memberId)) continue; // avoid double voting

      const choice = inPersonOverrides[owner.memberId] ?? defaultChoice;
      if (choice === "APPROVE") {
        favorCount += 1;
        favorCoeff += owner.coefficient || 0;
      } else if (choice === "REJECT") {
        againstCount += 1;
        againstCoeff += owner.coefficient || 0;
      } else {
        abstainCount += 1;
        abstainCoeff += owner.coefficient || 0;
      }
    }

    const totalCommunityOwners = 42;
    const requiredThresholdPct =
      scrutinyData?.calculation?.ownersThresholdPct ?? 60;

    const favorVotesPct =
      totalCommunityOwners > 0 ? (favorCount / totalCommunityOwners) * 100 : 0;
    const favorCoeffPct = favorCoeff;

    const targetFavorVotes = Math.ceil(
      (requiredThresholdPct / 100) * totalCommunityOwners,
    );
    const missingFavorVotes = Math.max(0, targetFavorVotes - favorCount);

    const votesMet = favorVotesPct >= requiredThresholdPct;
    const coeffMet = favorCoeffPct >= requiredThresholdPct;

    return {
      favorCount,
      againstCount,
      abstainCount,
      favorCoeff,
      againstCoeff,
      abstainCoeff,
      favorVotesPct,
      favorCoeffPct,
      targetFavorVotes,
      missingFavorVotes,
      votesMet,
      coeffMet,
      requiredThresholdPct,
    };
  }, [
    homeVoters,
    presentOwners,
    homeVotesMap,
    inPersonOverrides,
    invertLogic,
    scrutinyData,
  ]);

  const handleToggleVote = (
    memberId: string,
    targetChoice: "REJECT" | "ABSTAIN",
  ) => {
    setInPersonOverrides((prev) => {
      const current = prev[memberId];
      if (current === targetChoice) {
        // Toggle off -> returns to default
        const next = { ...prev };
        delete next[memberId];
        return next;
      }
      return {
        ...prev,
        [memberId]: targetChoice,
      };
    });
  };

  const handleReset = () => {
    setInPersonOverrides({});
  };

  const handleSave = () => {
    if (!itemId) return;

    saveRoundMutation.mutate({
      tenantId: TENANT_ID,
      itemId,
      roundNumber: scrutinyData?.roundNumber ?? 1,
      defaultLogic: invertLogic ? "ASSUME_AGAINST" : "ASSUME_FAVOR",
      inPersonExceptions: inPersonOverrides,
    });
  };

  const handleStartNewRound = () => {
    Alert.alert(
      "Nueva ronda de escrutinio",
      "¿Deseas abrir una nueva ronda para este punto? Los votos presenciales se reiniciarán pero quedará registrado el historial de la ronda anterior.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Iniciar ronda",
          onPress: () => {
            if (itemId) {
              newRoundMutation.mutate({
                tenantId: TENANT_ID,
                itemId,
              });
            }
          },
        },
      ],
    );
  };

  const filteredOwners = useMemo(() => {
    if (!searchQuery.trim()) return presentOwners;
    const q = searchQuery.toLowerCase().trim();
    return presentOwners.filter(
      (o) =>
        o.name.toLowerCase().includes(q) || o.door.toLowerCase().includes(q),
    );
  }, [presentOwners, searchQuery]);

  const itemTitle = scrutinyData?.item?.title || "Renovación pintura fachada";
  const roundNumber = scrutinyData?.roundNumber ?? 1;
  const agreementLabel =
    scrutinyData?.calculation?.statusLabel || "3/5 del total";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={NAVY} />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>Escrutinio presencial</Text>
          <Text style={styles.topBarSub} numberOfLines={1}>
            {itemTitle}
          </Text>
        </View>

        <View style={styles.roundCol}>
          <View style={styles.roundBadge}>
            <Text style={styles.roundBadgeText}>RONDA {roundNumber}</Text>
          </View>
          <TouchableOpacity
            style={styles.newRoundBtn}
            onPress={handleStartNewRound}
            activeOpacity={0.7}
          >
            <Text style={styles.newRoundBtnText}>+ Nueva ronda</Text>
          </TouchableOpacity>
        </View>
      </View>

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
          {isLoading && !scrutinyData ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={GREEN} />
            </View>
          ) : null}

          {/* 3 Summary Cards (Favor, Contra, Abstención) - Mockup Pantalla 2 */}
          <View style={styles.summaryRow}>
            {/* A favor */}
            <View style={[styles.summaryCard, styles.summaryCardFavor]}>
              <Text style={[styles.summaryNumber, styles.summaryNumberFavor]}>
                {liveScrutiny.favorCount}
              </Text>
              <Text style={[styles.summaryLabel, styles.summaryLabelFavor]}>
                A favor
              </Text>
            </View>

            {/* En contra */}
            <View style={[styles.summaryCard, styles.summaryCardAgainst]}>
              <Text style={[styles.summaryNumber, styles.summaryNumberAgainst]}>
                {liveScrutiny.againstCount}
              </Text>
              <Text style={[styles.summaryLabel, styles.summaryLabelAgainst]}>
                En contra
              </Text>
            </View>

            {/* Abstención */}
            <View style={[styles.summaryCard, styles.summaryCardAbstain]}>
              <Text style={[styles.summaryNumber, styles.summaryNumberAbstain]}>
                {liveScrutiny.abstainCount}
              </Text>
              <Text style={[styles.summaryLabel, styles.summaryLabelAbstain]}>
                Abstención
              </Text>
            </View>
          </View>

          {/* Subtitle breakdown "De los cuales..." */}
          <Text style={styles.homeVotesBreakdownText}>
            De los cuales: {scrutinyData?.calculation?.approveFromHome ?? 2} a
            favor desde casa | {scrutinyData?.calculation?.rejectFromHome ?? 4}{" "}
            en contra desde casa |{" "}
            {scrutinyData?.calculation?.abstainFromHome ?? 1} abstención desde
            casa
          </Text>

          {/* Majority Needed Card (Pantalla 2) */}
          <View style={styles.majorityCard}>
            <View style={styles.majorityCardHeader}>
              <Ionicons name="ribbon-outline" size={17} color={NAVY} />
              <Text style={styles.majorityCardTitle}>
                Mayoría necesaria: {agreementLabel}
              </Text>
            </View>

            {/* Metric 1: Votos favorables */}
            <View style={styles.metricRow}>
              <View style={styles.metricLabelRow}>
                <Text style={styles.metricLabel}>Votos favorables</Text>
                <Text style={styles.metricValue}>
                  {liveScrutiny.favorVotesPct.toFixed(2).replace(".", ",")} % /{" "}
                  {liveScrutiny.requiredThresholdPct} %
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(100, Math.max(2, liveScrutiny.favorVotesPct))}%`,
                      backgroundColor: liveScrutiny.votesMet
                        ? GREEN_SUCCESS
                        : "#F59E0B",
                    },
                  ]}
                />
                <View
                  style={[
                    styles.thresholdLine,
                    { left: `${liveScrutiny.requiredThresholdPct}%` },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.metricStatusHint,
                  { color: liveScrutiny.votesMet ? GREEN_SUCCESS : RED_REJECT },
                ]}
              >
                {liveScrutiny.votesMet
                  ? "Requisito alcanzado"
                  : `Faltan ${liveScrutiny.missingFavorVotes} votos favorables`}
              </Text>
            </View>

            {/* Metric 2: Coeficiente de participación */}
            <View style={styles.metricRow}>
              <View style={styles.metricLabelRow}>
                <Text style={styles.metricLabel}>
                  Coeficiente de participación
                </Text>
                <Text style={styles.metricValue}>
                  {liveScrutiny.favorCoeffPct.toFixed(0)} % /{" "}
                  {liveScrutiny.requiredThresholdPct} %
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(100, Math.max(2, liveScrutiny.favorCoeffPct))}%`,
                      backgroundColor: liveScrutiny.coeffMet
                        ? GREEN_SUCCESS
                        : "#F59E0B",
                    },
                  ]}
                />
                <View
                  style={[
                    styles.thresholdLine,
                    { left: `${liveScrutiny.requiredThresholdPct}%` },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.metricStatusHint,
                  { color: liveScrutiny.coeffMet ? GREEN_SUCCESS : RED_REJECT },
                ]}
              >
                {liveScrutiny.coeffMet
                  ? "Requisito alcanzado"
                  : "Coeficiente insuficiente"}
              </Text>
            </View>
          </View>

          {/* Propietarios List Section */}
          <View style={styles.listSectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.listSectionTitle}>
                Seleccionar votos en contra o abstención
              </Text>
              <Text style={styles.listSectionSub}>
                {invertLogic
                  ? "Lógica invertida: por defecto votan en contra"
                  : "Por defecto todos los presentes votan a favor"}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.invertLogicBtn}
              onPress={() => setInvertLogic((prev) => !prev)}
              activeOpacity={0.8}
            >
              <Ionicons name="swap-horizontal" size={15} color={NAVY} />
              <Text style={styles.invertLogicBtnText}>Invertir lógica</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar propietario..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Owners List */}
          <View style={styles.ownersList}>
            {filteredOwners.map((owner) => {
              const homeChoice = homeVotesMap.get(owner.memberId);
              const hasVotedHome = Boolean(homeChoice);

              const currentChoice = hasVotedHome
                ? homeChoice
                : (inPersonOverrides[owner.memberId] ??
                  (invertLogic ? "REJECT" : "APPROVE"));

              const isRejectSelected = currentChoice === "REJECT";
              const isAbstainSelected = currentChoice === "ABSTAIN";
              const isFavorSelected = currentChoice === "APPROVE";

              return (
                <View key={owner.memberId} style={styles.ownerCard}>
                  <View style={styles.ownerInfoCol}>
                    <Text style={styles.ownerName}>{owner.name}</Text>
                    <Text style={styles.ownerMeta}>
                      {owner.door} · {owner.coefficient} %
                    </Text>

                    {/* Voto desde casa pill */}
                    {hasVotedHome && (
                      <View style={styles.homeVoteBadge}>
                        <Ionicons
                          name="home-outline"
                          size={12}
                          color="#0369A1"
                        />
                        <Text style={styles.homeVoteBadgeText}>
                          Voto online emitido:{" "}
                          {homeChoice === "APPROVE"
                            ? "A favor"
                            : homeChoice === "REJECT"
                              ? "En contra"
                              : "Abstención"}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Actions right */}
                  {hasVotedHome ? (
                    <View style={styles.lockedVoteBox}>
                      <Ionicons name="lock-closed" size={14} color="#94A3B8" />
                      <Text style={styles.lockedVoteText}>Registrado</Text>
                    </View>
                  ) : (
                    <View style={styles.voteTogglesRow}>
                      <TouchableOpacity
                        style={[
                          styles.toggleBtn,
                          styles.toggleBtnReject,
                          isRejectSelected && styles.toggleBtnRejectActive,
                        ]}
                        activeOpacity={0.8}
                        onPress={() =>
                          handleToggleVote(owner.memberId, "REJECT")
                        }
                      >
                        <Text
                          style={[
                            styles.toggleBtnText,
                            styles.toggleBtnTextReject,
                            isRejectSelected &&
                              styles.toggleBtnTextRejectActive,
                          ]}
                        >
                          Contra
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.toggleBtn,
                          styles.toggleBtnAbstain,
                          isAbstainSelected && styles.toggleBtnAbstainActive,
                        ]}
                        activeOpacity={0.8}
                        onPress={() =>
                          handleToggleVote(owner.memberId, "ABSTAIN")
                        }
                      >
                        <Text
                          style={[
                            styles.toggleBtnText,
                            styles.toggleBtnTextAbstain,
                            isAbstainSelected &&
                              styles.toggleBtnTextAbstainActive,
                          ]}
                        >
                          Abstención
                        </Text>
                      </TouchableOpacity>

                      {isFavorSelected && (
                        <View style={styles.implicitFavorBadge}>
                          <Ionicons
                            name="checkmark"
                            size={14}
                            color={GREEN_SUCCESS}
                          />
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Sticky Action Buttons */}
      <View style={styles.bottomFooter}>
        <TouchableOpacity
          style={styles.resetBtn}
          onPress={handleReset}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh-outline" size={17} color={NAVY} />
          <Text style={styles.resetBtnText}>Reiniciar votación</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={saveRoundMutation.isPending}
        >
          {saveRoundMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>Guardar escrutinio</Text>
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
  roundCol: {
    alignItems: "flex-end",
  },
  roundBadge: {
    backgroundColor: NAVY,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roundBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  newRoundBtn: {
    marginTop: 3,
  },
  newRoundBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: GREEN,
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
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  summaryCardFavor: {
    backgroundColor: "#F0FDF4",
    borderColor: "#86EFAC",
  },
  summaryCardAgainst: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  summaryCardAbstain: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  summaryNumber: {
    fontSize: 28,
    fontWeight: "800",
  },
  summaryNumberFavor: {
    color: GREEN_SUCCESS,
  },
  summaryNumberAgainst: {
    color: RED_REJECT,
  },
  summaryNumberAbstain: {
    color: YELLOW_ABSTAIN,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  summaryLabelFavor: {
    color: "#166534",
  },
  summaryLabelAgainst: {
    color: "#991B1B",
  },
  summaryLabelAbstain: {
    color: "#92400E",
  },
  homeVotesBreakdownText: {
    fontSize: 11.5,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 14,
    lineHeight: 16,
  },
  majorityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  majorityCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  majorityCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: NAVY,
  },
  metricRow: {
    marginBottom: 10,
  },
  metricLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  metricValue: {
    fontSize: 12,
    fontWeight: "700",
    color: NAVY_DARK,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
    position: "relative",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  thresholdLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: NAVY,
  },
  metricStatusHint: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
  },
  listSectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 8,
  },
  listSectionTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: NAVY,
  },
  listSectionSub: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
  },
  invertLogicBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  invertLogicBtnText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: NAVY,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: NAVY_DARK,
    padding: 0,
  },
  ownersList: {
    gap: 8,
  },
  ownerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  ownerInfoCol: {
    flex: 1,
    marginRight: 10,
  },
  ownerName: {
    fontSize: 14,
    fontWeight: "700",
    color: NAVY_DARK,
  },
  ownerMeta: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  homeVoteBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  homeVoteBadgeText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#0369A1",
  },
  lockedVoteBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  lockedVoteText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#64748B",
  },
  voteTogglesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  toggleBtnReject: {
    borderColor: RED_REJECT,
    backgroundColor: "#FFFFFF",
  },
  toggleBtnRejectActive: {
    backgroundColor: RED_REJECT,
  },
  toggleBtnAbstain: {
    borderColor: YELLOW_ABSTAIN,
    backgroundColor: "#FFFFFF",
  },
  toggleBtnAbstainActive: {
    backgroundColor: YELLOW_ABSTAIN,
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  toggleBtnTextReject: {
    color: RED_REJECT,
  },
  toggleBtnTextRejectActive: {
    color: "#FFFFFF",
  },
  toggleBtnTextAbstain: {
    color: YELLOW_ABSTAIN,
  },
  toggleBtnTextAbstainActive: {
    color: "#FFFFFF",
  },
  implicitFavorBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  resetBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
  },
  resetBtnText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: NAVY,
  },
  saveBtn: {
    flex: 1.3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: GREEN,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
