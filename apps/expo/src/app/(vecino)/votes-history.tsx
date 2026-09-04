import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { api } from "~/utils/api";

const TENANT_ID = "org_aconvi_demo";

// ─── Colors ───────────────────────────────────────────────────────────────────
const TEAL = "#027580";
const TEAL_LIGHT = "#E6F7F5";
const DARK = "#0F172A";
const MUTED = "#475569";
const BORDER = "#E2E8F0";
const RED = "#DC2626";

export default function VotesHistoryScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>(
    "00000000-0000-0000-0000-000000000000",
  );
  const [expandedSessions, setExpandedSessions] = useState<
    Record<string, boolean>
  >({
    default_active: true,
  });

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
    ...api.voting.all.queryOptions({ tenantId: TENANT_ID, userId }),
    refetchInterval: 5000,
  });

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const toggleExpand = (id: string) => {
    setExpandedSessions((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const sessionList = (sessions as any[]) ?? [];

  // Active sessions where user has cast a vote
  const activeVotedSessions = sessionList.filter(
    (s: any) => s.status === "OPEN" && s.hasVoted,
  );

  // Closed sessions (or archived)
  const closedSessions = sessionList.filter((s: any) => s.status === "CLOSED");

  // Fallback demo past sessions to match Screen 10 mockup if DB has no historical juntas
  const pastDemoSessions = [
    {
      id: "demo-past-2023",
      title: "Junta ordinaria 2023",
      dateLabel: "Celebrada el 12 ene. 2023",
    },
    {
      id: "demo-past-2022",
      title: "Junta extraordinaria 2022",
      dateLabel: "Celebrada el 05 jul. 2022",
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* Top Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBackBtn}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={22} color={TEAL} />
          <Text style={styles.headerTitle}>Mis votos</Text>
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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Screen Title & Subtitle */}
        <Text style={styles.screenTitle}>Histórico de votos</Text>
        <Text style={styles.screenSubtitle}>
          Consulta tus votos en juntas anteriores y activas.
        </Text>

        {/* ─── SECCIÓN: ACTIVAS ────────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>ACTIVAS</Text>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={TEAL} />
          </View>
        ) : activeVotedSessions.length > 0 ? (
          activeVotedSessions.map((session: any) => {
            const isExpanded = expandedSessions[session.id] ?? true;
            const formattedDate = session.closesAt
              ? format(new Date(session.closesAt), "d MMM. · HH:mm", {
                  locale: es,
                })
              : "18 sept. · 23:59";

            const onlineItems = (session.items || []).filter(
              (i: any) => i.onlineVotingEnabled !== false,
            );

            return (
              <View key={session.id} style={styles.activeCard}>
                <TouchableOpacity
                  style={styles.activeCardHeader}
                  onPress={() => toggleExpand(session.id)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activeCardTitle}>{session.title}</Text>
                    <Text style={styles.activeCardDate}>{formattedDate}</Text>
                    <View style={styles.registeredBadge}>
                      <Text style={styles.registeredBadgeText}>
                        Registrados
                      </Text>
                    </View>
                  </View>
                  <Feather
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={MUTED}
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.activeCardItemsList}>
                    {onlineItems.map((item: any, idx: number) => {
                      const cast = session.userCasts?.find(
                        (c: any) =>
                          c.itemId === item.id || (!c.itemId && idx === 0),
                      );
                      const choice = cast?.choice ?? "APPROVE";

                      return (
                        <View
                          key={item.id}
                          style={[
                            styles.voteItemRow,
                            idx > 0 && styles.voteItemRowBorder,
                          ]}
                        >
                          <View style={styles.voteItemLeft}>
                            <View style={styles.numberCircle}>
                              <Text style={styles.numberCircleText}>
                                {idx + 1}
                              </Text>
                            </View>
                            <View style={styles.voteItemTitleCol}>
                              <Text style={styles.voteItemTitle}>
                                {item.title}
                              </Text>
                              {item.budget ? (
                                <Text style={styles.voteItemBudget}>
                                  {item.budget}
                                </Text>
                              ) : null}
                            </View>
                          </View>

                          {/* Choice Tag */}
                          <View style={styles.choiceTagRow}>
                            {choice === "APPROVE" ? (
                              <>
                                <View
                                  style={[
                                    styles.choiceIconCircle,
                                    { backgroundColor: TEAL },
                                  ]}
                                >
                                  <Feather
                                    name="check"
                                    size={10}
                                    color="#FFFFFF"
                                  />
                                </View>
                                <Text
                                  style={[
                                    styles.choiceTagText,
                                    { color: TEAL },
                                  ]}
                                >
                                  Apruebo
                                </Text>
                              </>
                            ) : choice === "REJECT" ? (
                              <>
                                <View
                                  style={[
                                    styles.choiceIconCircle,
                                    { backgroundColor: RED },
                                  ]}
                                >
                                  <Feather name="x" size={10} color="#FFFFFF" />
                                </View>
                                <Text
                                  style={[styles.choiceTagText, { color: RED }]}
                                >
                                  Rechazo
                                </Text>
                              </>
                            ) : (
                              <>
                                <View
                                  style={[
                                    styles.choiceIconCircle,
                                    { backgroundColor: MUTED },
                                  ]}
                                >
                                  <Feather
                                    name="minus"
                                    size={10}
                                    color="#FFFFFF"
                                  />
                                </View>
                                <Text
                                  style={[
                                    styles.choiceTagText,
                                    { color: MUTED },
                                  ]}
                                >
                                  Me abstengo
                                </Text>
                              </>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        ) : (
          /* Demo Active Card matching Screen 10 when no active cast exists yet */
          <View style={styles.activeCard}>
            <TouchableOpacity
              style={styles.activeCardHeader}
              onPress={() => toggleExpand("default_active")}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.activeCardTitle}>Junta extraordinaria</Text>
                <Text style={styles.activeCardDate}>18 sept. · 23:59</Text>
                <View style={styles.registeredBadge}>
                  <Text style={styles.registeredBadgeText}>Registrados</Text>
                </View>
              </View>
              <Feather
                name={
                  expandedSessions["default_active"] !== false
                    ? "chevron-up"
                    : "chevron-down"
                }
                size={20}
                color={MUTED}
              />
            </TouchableOpacity>

            {expandedSessions["default_active"] !== false && (
              <View style={styles.activeCardItemsList}>
                {/* Punto 1: Reparación del ascensor */}
                <View style={styles.voteItemRow}>
                  <View style={styles.voteItemLeft}>
                    <View style={styles.numberCircle}>
                      <Text style={styles.numberCircleText}>1</Text>
                    </View>
                    <View style={styles.voteItemTitleCol}>
                      <Text style={styles.voteItemTitle}>
                        Reparación del ascensor
                      </Text>
                      <Text style={styles.voteItemBudget}>5.500 €</Text>
                    </View>
                  </View>
                  <View style={styles.choiceTagRow}>
                    <View
                      style={[
                        styles.choiceIconCircle,
                        { backgroundColor: TEAL },
                      ]}
                    >
                      <Feather name="check" size={10} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.choiceTagText, { color: TEAL }]}>
                      Apruebo
                    </Text>
                  </View>
                </View>

                {/* Punto 2: Cambio de empresa de limpieza */}
                <View style={[styles.voteItemRow, styles.voteItemRowBorder]}>
                  <View style={styles.voteItemLeft}>
                    <View style={styles.numberCircle}>
                      <Text style={styles.numberCircleText}>2</Text>
                    </View>
                    <View style={styles.voteItemTitleCol}>
                      <Text style={styles.voteItemTitle}>
                        Cambio de empresa de limpieza
                      </Text>
                    </View>
                  </View>
                  <View style={styles.choiceTagRow}>
                    <View
                      style={[
                        styles.choiceIconCircle,
                        { backgroundColor: RED },
                      ]}
                    >
                      <Feather name="x" size={10} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.choiceTagText, { color: RED }]}>
                      Rechazo
                    </Text>
                  </View>
                </View>

                {/* Punto 3: Aprobación de cuentas 2027 */}
                <View style={[styles.voteItemRow, styles.voteItemRowBorder]}>
                  <View style={styles.voteItemLeft}>
                    <View style={styles.numberCircle}>
                      <Text style={styles.numberCircleText}>3</Text>
                    </View>
                    <View style={styles.voteItemTitleCol}>
                      <Text style={styles.voteItemTitle}>
                        Aprobación de cuentas 2027
                      </Text>
                    </View>
                  </View>
                  <View style={styles.choiceTagRow}>
                    <View
                      style={[
                        styles.choiceIconCircle,
                        { backgroundColor: TEAL },
                      ]}
                    >
                      <Feather name="check" size={10} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.choiceTagText, { color: TEAL }]}>
                      Apruebo
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ─── SECCIÓN: ANTERIORES ─────────────────────────────────────────── */}
        <Text style={[styles.sectionHeader, { marginTop: 22 }]}>
          ANTERIORES
        </Text>

        {closedSessions.length > 0
          ? closedSessions.map((s: any) => {
              const closedDate = s.closedAt
                ? format(new Date(s.closedAt), "d MMM. yyyy", { locale: es })
                : "2023";
              return (
                <TouchableOpacity
                  key={s.id}
                  style={styles.pastCard}
                  onPress={() =>
                    router.push({
                      pathname: "/(vecino)/voting",
                      params: { sessionId: s.id },
                    } as any)
                  }
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pastCardTitle}>{s.title}</Text>
                    <Text style={styles.pastCardSubtitle}>
                      Celebrada el {closedDate}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#94A3B8" />
                </TouchableOpacity>
              );
            })
          : pastDemoSessions.map((demo) => (
              <TouchableOpacity
                key={demo.id}
                style={styles.pastCard}
                onPress={() => {}}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.pastCardTitle}>{demo.title}</Text>
                  <Text style={styles.pastCardSubtitle}>{demo.dateLabel}</Text>
                </View>
                <Feather name="chevron-right" size={20} color="#94A3B8" />
              </TouchableOpacity>
            ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: TEAL,
    marginBottom: 4,
  },
  screenSubtitle: {
    fontSize: 14,
    color: MUTED,
    marginBottom: 20,
    lineHeight: 20,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  loadingBox: {
    padding: 20,
    alignItems: "center",
  },

  // ─── Active Card Styles ──────────────────────────────────────────────────
  activeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  activeCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  activeCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: DARK,
    marginBottom: 3,
  },
  activeCardDate: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 6,
  },
  registeredBadge: {
    backgroundColor: TEAL_LIGHT,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  registeredBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: TEAL,
  },
  activeCardItemsList: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  voteItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  voteItemRowBorder: {
    borderTopWidth: 1,
    borderTopColor: "#F8FAFC",
  },
  voteItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  numberCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  numberCircleText: {
    fontSize: 12,
    fontWeight: "700",
    color: TEAL,
  },
  voteItemTitleCol: {
    flex: 1,
  },
  voteItemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: DARK,
  },
  voteItemBudget: {
    fontSize: 12,
    fontWeight: "600",
    color: DARK,
    marginTop: 1,
  },
  choiceTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  choiceIconCircle: {
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceTagText: {
    fontSize: 13,
    fontWeight: "700",
  },

  // ─── Past Cards Styles ───────────────────────────────────────────────────
  pastCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pastCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: DARK,
    marginBottom: 2,
  },
  pastCardSubtitle: {
    fontSize: 13,
    color: "#64748B",
  },
});
