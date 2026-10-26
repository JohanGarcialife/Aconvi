import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
const CARD_BORDER = "#E8EEF3";
const BG = "#F7FAFC";

export default function AfVotacionesScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"OPEN" | "CLOSED">("OPEN");

  const { data: votings, isLoading } = useQuery(
    api.voting.all.queryOptions({ tenantId: TENANT_ID }),
  );

  const closeMutation = useMutation(
    api.voting.close.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries();
        Alert.alert(
          "Votación cerrada",
          "Se ha cerrado la votación, generado el acta y tramitado la orden de trabajo si corresponde.",
        );
      },
      onError: (err: any) => {
        Alert.alert("Error", err?.message || "No se pudo cerrar la votación.");
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

  const allSessions = (votings as any[] | undefined) ?? [];
  const filtered = allSessions.filter((s) =>
    tab === "OPEN" ? s.status !== "CLOSED" : s.status === "CLOSED",
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
        <Text style={styles.screenTitle}>Votaciones</Text>
        <Text style={styles.screenSub}>
          Supervisión de votaciones y juntas · Jardines del Turia
        </Text>

        {/* Filter Tabs */}
        <View style={styles.segmentedBar}>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              tab === "OPEN" && styles.segmentBtnActive,
            ]}
            onPress={() => setTab("OPEN")}
          >
            <Text
              style={[
                styles.segmentText,
                tab === "OPEN" && styles.segmentTextActive,
              ]}
            >
              Activas ({allSessions.filter((s) => s.status !== "CLOSED").length}
              )
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              tab === "CLOSED" && styles.segmentBtnActive,
            ]}
            onPress={() => setTab("CLOSED")}
          >
            <Text
              style={[
                styles.segmentText,
                tab === "CLOSED" && styles.segmentTextActive,
              ]}
            >
              Finalizadas (
              {allSessions.filter((s) => s.status === "CLOSED").length})
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={GREEN} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkbox-outline" size={32} color={SUBTEXT} />
            <Text style={styles.emptyText}>
              No hay votaciones en esta sección.
            </Text>
          </View>
        ) : (
          filtered.map((session: any) => {
            const isJunta = session.type === "JUNTA";
            const castsCount = (session.casts ?? []).length;
            return (
              <View key={session.id} style={styles.card}>
                <View style={styles.cardTopRow}>
                  <View
                    style={[
                      styles.typeBadge,
                      { backgroundColor: isJunta ? "#E0F2FE" : GREEN_BG },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBadgeText,
                        { color: isJunta ? "#0369A1" : GREEN },
                      ]}
                    >
                      {isJunta ? "JUNTA" : "VOTACIÓN"}
                    </Text>
                  </View>
                  <Text style={styles.votesCountText}>
                    {castsCount} votos registrados
                  </Text>
                </View>

                <Text style={styles.voteTitle}>{session.title}</Text>
                {session.description ? (
                  <Text style={styles.voteDesc} numberOfLines={2}>
                    {session.description}
                  </Text>
                ) : null}
                {session.budget ? (
                  <Text style={styles.voteBudget}>
                    Presupuesto: {session.budget}
                  </Text>
                ) : null}
                {session.resultSummary ? (
                  <Text style={styles.resultSummary}>
                    Resultado: {session.resultSummary}
                  </Text>
                ) : null}

                <View style={styles.actionsRow}>
                  {isJunta && (
                    <TouchableOpacity
                      style={styles.attendanceBtn}
                      onPress={() =>
                        router.push({
                          pathname: "/(af)/asistencia" as any,
                          params: { sessionId: session.id },
                        })
                      }
                    >
                      <Ionicons name="people-outline" size={16} color={GREEN} />
                      <Text style={styles.attendanceBtnText}>Asistencia</Text>
                    </TouchableOpacity>
                  )}

                  {session.status === "OPEN" && (
                    <TouchableOpacity
                      style={styles.closeVoteBtn}
                      disabled={closeMutation.isPending}
                      onPress={() =>
                        closeMutation.mutate({
                          tenantId: TENANT_ID,
                          sessionId: session.id,
                        })
                      }
                    >
                      <Ionicons
                        name="checkmark-done-outline"
                        size={16}
                        color="#FFFFFF"
                      />
                      <Text style={styles.closeVoteBtnText}>
                        Cerrar y generar acta
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
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
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
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
  screenTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: NAVY,
  },
  screenSub: {
    fontSize: 14,
    color: SUBTEXT,
    marginTop: 2,
    marginBottom: 14,
  },
  segmentedBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginBottom: 16,
    overflow: "hidden",
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
  },
  segmentBtnActive: {
    backgroundColor: GREEN,
  },
  segmentText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: NAVY,
  },
  segmentTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  loadingBox: {
    paddingVertical: 28,
    alignItems: "center",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: CARD_BORDER,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: SUBTEXT,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  votesCountText: {
    fontSize: 12.5,
    color: SUBTEXT,
    fontWeight: "600",
  },
  voteTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: NAVY,
  },
  voteDesc: {
    fontSize: 13.5,
    color: SUBTEXT,
    marginTop: 4,
  },
  voteBudget: {
    fontSize: 13.5,
    fontWeight: "600",
    color: GREEN,
    marginTop: 6,
  },
  resultSummary: {
    fontSize: 13.5,
    fontWeight: "700",
    color: NAVY,
    marginTop: 6,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  attendanceBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: GREEN_BG,
    paddingVertical: 10,
    borderRadius: 10,
  },
  attendanceBtnText: {
    color: GREEN,
    fontWeight: "700",
    fontSize: 13.5,
  },
  closeVoteBtn: {
    flex: 1.3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: GREEN,
    paddingVertical: 10,
    borderRadius: 10,
  },
  closeVoteBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13.5,
  },
});
