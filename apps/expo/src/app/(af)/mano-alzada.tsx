import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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
const BORDER = "#E2E8F0";
const BG = "#F8FAFC";

function formatEuro(val?: string | number | null): string {
  if (val === undefined || val === null) return "";
  const str = String(val).trim();
  if (!str) return "";
  const clean = str.replace(/[€\s]/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(clean)) return `${clean} €`;
  const match = clean.match(/^(\d+)(?:[.,](\d+))?$/);
  if (match && match[1]) {
    const intPart = match[1].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const decPart = match[2];
    return decPart ? `${intPart},${decPart} €` : `${intPart} €`;
  }
  if (!str.includes("€")) return `${str} €`;
  return str;
}

export default function ManoAlzadaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    sessionId?: string;
    itemId?: string;
  }>();

  const sessionId = params.sessionId;
  const itemId = params.itemId;

  const [handCounts, setHandCounts] = useState<Record<string, number>>({});
  const [againstAllCount, setAgainstAllCount] = useState(0);
  const [abstainCount, setAbstainCount] = useState(0);
  const [discardedIds, setDiscardedIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: handsData,
    isLoading,
    refetch,
  } = useQuery({
    ...api.meeting.getShowOfHands.queryOptions({
      tenantId: TENANT_ID,
      itemId: itemId || "00000000-0000-0000-0000-000000000000",
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

  const saveMutation = useMutation(
    api.meeting.saveShowOfHands.mutationOptions({
      onSuccess: async (data) => {
        await queryClient.invalidateQueries();
        router.push({
          pathname: "/(af)/escrutinio" as any,
          params: {
            sessionId,
            itemId,
            winningProposalId: data.winningProposalId || undefined,
          },
        });
      },
      onError: (err: any) => {
        Alert.alert("Error", err?.message || "No se pudo guardar el recuento.");
      },
    }),
  );

  const proposals = handsData?.proposals ?? [];

  // Determine highest voted proposal
  const { maxVotes, mostVotedProposalId } = useMemo(() => {
    let max = -1;
    let bestId: string | null = null;
    for (const p of proposals) {
      if (discardedIds.includes(p.id)) continue;
      const count = handCounts[p.id] ?? p.votes ?? 0;
      if (count > max && count > 0) {
        max = count;
        bestId = p.id;
      }
    }
    return { maxVotes: max, mostVotedProposalId: bestId };
  }, [proposals, handCounts, discardedIds]);

  const handleIncrement = (proposalId: string) => {
    setHandCounts((prev) => {
      const current =
        prev[proposalId] ??
        proposals.find((p) => p.id === proposalId)?.votes ??
        0;
      return {
        ...prev,
        [proposalId]: current + 1,
      };
    });
  };

  const handleDecrement = (proposalId: string) => {
    setHandCounts((prev) => {
      const current =
        prev[proposalId] ??
        proposals.find((p) => p.id === proposalId)?.votes ??
        0;
      return {
        ...prev,
        [proposalId]: Math.max(0, current - 1),
      };
    });
  };

  const handleDiscard = (proposalId: string) => {
    setDiscardedIds((prev) => [...prev, proposalId]);
    // set count to 0 on discard
    setHandCounts((prev) => ({
      ...prev,
      [proposalId]: 0,
    }));
  };

  const handleRestore = (proposalId: string) => {
    setDiscardedIds((prev) => prev.filter((id) => id !== proposalId));
  };

  const handleResetAll = () => {
    Alert.alert(
      "Reiniciar recuentos",
      "¿Deseas reiniciar todos los contadores de mano alzada a cero?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Reiniciar",
          style: "destructive",
          onPress: () => {
            const zeros: Record<string, number> = {};
            for (const p of proposals) {
              zeros[p.id] = 0;
            }
            setHandCounts(zeros);
            setAgainstAllCount(0);
            setAbstainCount(0);
            setDiscardedIds([]);
          },
        },
      ],
    );
  };

  const handleContinueToScrutiny = () => {
    if (!itemId) return;

    const countsMap: Record<string, number> = {};
    for (const p of proposals) {
      countsMap[p.id] = handCounts[p.id] ?? p.votes ?? 0;
    }

    saveMutation.mutate({
      tenantId: TENANT_ID,
      itemId,
      roundNumber: handsData?.roundNumber ?? 1,
      counts: countsMap,
      discardedIds,
      againstAllCount,
      abstainCount,
      winningProposalId: mostVotedProposalId || undefined,
    });
  };

  const itemTitle = handsData?.item?.title || "Renovación pintura fachada";
  const roundNumber = handsData?.roundNumber ?? 1;

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
          <Text style={styles.topBarTitle}>Recuento a mano alzada</Text>
          <Text style={styles.topBarSub} numberOfLines={1}>
            {itemTitle}
          </Text>
        </View>

        <View style={styles.roundBadge}>
          <Text style={styles.roundBadgeText}>RONDA {roundNumber}</Text>
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
            colors={[GREEN]}
          />
        }
      >
        {isLoading && !handsData ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={GREEN} />
          </View>
        ) : null}

        <View style={styles.instructionBox}>
          <Ionicons name="hand-right-outline" size={17} color={GREEN} />
          <Text style={styles.instructionText}>
            Cuenta los votos emitidos alzando la mano para cada presupuesto. La
            opción ganadora se formalizará en el escrutinio con coeficientes.
          </Text>
        </View>

        {/* Proposals List (Mockup Pantalla 3) */}
        <View style={styles.proposalsList}>
          {proposals.map((proposal) => {
            const isDiscarded = discardedIds.includes(proposal.id);
            const votes = handCounts[proposal.id] ?? proposal.votes ?? 0;
            const isMostVoted =
              !isDiscarded &&
              proposal.id === mostVotedProposalId &&
              maxVotes > 0;

            if (isDiscarded) {
              return (
                <View
                  key={proposal.id}
                  style={[styles.proposalCard, styles.proposalCardDiscarded]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.proposalTitle,
                        styles.proposalTitleDiscarded,
                      ]}
                    >
                      {proposal.companyName} · {formatEuro(proposal.amount)}
                    </Text>
                    <View style={styles.discardedBadge}>
                      <Text style={styles.discardedBadgeText}>
                        Descartada (0 votos)
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.restoreBtn}
                    onPress={() => handleRestore(proposal.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="arrow-undo-outline"
                      size={18}
                      color={NAVY}
                    />
                  </TouchableOpacity>
                </View>
              );
            }

            return (
              <View
                key={proposal.id}
                style={[
                  styles.proposalCard,
                  isMostVoted && styles.proposalCardMostVoted,
                ]}
              >
                <View style={styles.proposalInfoCol}>
                  <Text style={styles.proposalTitle}>
                    {proposal.companyName}
                  </Text>
                  <Text style={styles.proposalAmount}>
                    {formatEuro(proposal.amount)}
                  </Text>
                  {isMostVoted && (
                    <View style={styles.mostVotedBadge}>
                      <Ionicons
                        name="checkmark-circle"
                        size={13}
                        color={GREEN_SUCCESS}
                      />
                      <Text style={styles.mostVotedBadgeText}>
                        Opción más votada
                      </Text>
                    </View>
                  )}
                </View>

                {/* Counter controls + Discard */}
                <View style={styles.proposalActionsRight}>
                  <View style={styles.counterBox}>
                    <TouchableOpacity
                      style={styles.counterBtn}
                      onPress={() => handleDecrement(proposal.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="remove" size={18} color={NAVY} />
                    </TouchableOpacity>

                    <Text style={styles.counterNumber}>{votes}</Text>

                    <TouchableOpacity
                      style={styles.counterBtn}
                      onPress={() => handleIncrement(proposal.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={18} color={NAVY} />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.trashBtn}
                    onPress={() => handleDiscard(proposal.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {/* Fixed bottom row 1: En contra de todos */}
          <View style={styles.fixedOptionCard}>
            <Text style={styles.fixedOptionTitle}>En contra de todos</Text>
            <View style={styles.counterBox}>
              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() =>
                  setAgainstAllCount((prev) => Math.max(0, prev - 1))
                }
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={18} color={NAVY} />
              </TouchableOpacity>

              <Text style={styles.counterNumber}>{againstAllCount}</Text>

              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() => setAgainstAllCount((prev) => prev + 1)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={18} color={NAVY} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Fixed bottom row 2: Abstención */}
          <View style={styles.fixedOptionCard}>
            <Text style={styles.fixedOptionTitle}>Abstención</Text>
            <View style={styles.counterBox}>
              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() => setAbstainCount((prev) => Math.max(0, prev - 1))}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={18} color={NAVY} />
              </TouchableOpacity>

              <Text style={styles.counterNumber}>{abstainCount}</Text>

              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() => setAbstainCount((prev) => prev + 1)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={18} color={NAVY} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Actions */}
      <View style={styles.bottomFooter}>
        <TouchableOpacity
          style={styles.resetBtn}
          onPress={handleResetAll}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh-outline" size={17} color={NAVY} />
          <Text style={styles.resetBtnText}>Reiniciar todos los recuentos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.continueBtn}
          onPress={handleContinueToScrutiny}
          activeOpacity={0.85}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Text style={styles.continueBtnText}>Continuar a escrutinio</Text>
              <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
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
  instructionBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#E6F5F3",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  instructionText: {
    fontSize: 12,
    color: "#0F766E",
    flex: 1,
    lineHeight: 17,
  },
  proposalsList: {
    gap: 12,
  },
  proposalCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  proposalCardMostVoted: {
    borderColor: GREEN_SUCCESS,
    backgroundColor: "#F0FDF4",
  },
  proposalCardDiscarded: {
    backgroundColor: "#FFF1F2",
    borderColor: "#FECDD3",
  },
  proposalInfoCol: {
    flex: 1,
    marginRight: 10,
  },
  proposalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: NAVY_DARK,
  },
  proposalTitleDiscarded: {
    color: "#94A3B8",
    textDecorationLine: "line-through",
  },
  proposalAmount: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600",
  },
  mostVotedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  mostVotedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#166534",
  },
  discardedBadge: {
    marginTop: 4,
    backgroundColor: "#FFE4E6",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  discardedBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#BE123C",
  },
  proposalActionsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  counterBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    overflow: "hidden",
  },
  counterBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  counterNumber: {
    width: 32,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "800",
    color: NAVY,
  },
  trashBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
  },
  restoreBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  fixedOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  fixedOptionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: NAVY,
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
    fontSize: 12.5,
    fontWeight: "600",
    color: NAVY,
    textAlign: "center",
  },
  continueBtn: {
    flex: 1.2,
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
  continueBtnText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
