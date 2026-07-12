import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "~/utils/api";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getBaseUrl } from "~/utils/base-url";

/** Converts a relative /uploads/... path to an absolute URL. Already-absolute URLs are returned unchanged. */
const resolvePhotoUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (
    url.startsWith("http") ||
    url.startsWith("file:") ||
    url.startsWith("ph:") ||
    url.startsWith("data:")
  ) {
    return url;
  }
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${getBaseUrl()}${path}`;
};

const PRIMARY = "#4aa19b";
const DARK = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const BG = "#F9FAFB";

const TENANT_ID = "org_aconvi_demo";

// ─── Status config with human labels ─────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  RECIBIDA:         { label: "Enviada",           icon: "✉️",  color: "#92400e", bg: "#fef3c7" },
  EN_REVISION:      { label: "Revisando",         icon: "🔍",  color: "#1e40af", bg: "#dbeafe" },
  AGENDADA:         { label: "Agendada",          icon: "📅",  color: "#5b21b6", bg: "#ede9fe" },
  EN_CURSO:         { label: "En reparación",     icon: "🔧",  color: "#065f46", bg: "#d1fae5" },
  RESUELTA:         { label: "Resuelta",          icon: "✅",  color: "#065f46", bg: "#d1fae5" },
  RECHAZADA:        { label: "Rechazada",         icon: "✕",   color: "#991b1b", bg: "#fee2e2" },
  CERRADA:          { label: "Cerrada",           icon: "🔒",  color: "#374151", bg: "#f3f4f6" },
};

const ACTIVE_STATUSES = ["RECIBIDA", "EN_REVISION", "AGENDADA", "EN_CURSO"];
const DONE_STATUSES   = ["RESUELTA", "CERRADA", "RECHAZADA"];

function formatDate(date: Date | string) {
  return format(new Date(date), "d 'de' MMMM", { locale: es });
}

export default function VecinoIncidentsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<"activas" | "finalizadas">("activas");

  const { data: incidents = [], isLoading, refetch, isRefetching } = useQuery({
    ...api.incident.all.queryOptions({ tenantId: TENANT_ID }),
    refetchInterval: 300_000,
  });

  const activas = incidents.filter((i) => ACTIVE_STATUSES.includes(i.status));
  const finalizadas = incidents.filter((i) => DONE_STATUSES.includes(i.status));
  const displayList = tab === "activas" ? activas : finalizadas;

  // ─── Card ────────────────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: (typeof incidents)[0] }) => {
    const st = STATUS_MAP[item.status] ?? { label: item.status, icon: "", color: MUTED, bg: BG };
    const isActive = ACTIVE_STATUSES.includes(item.status);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(vecino)/incidents/${item.id}`)}
        activeOpacity={0.75}
      >
        {/* Thumbnail */}
        <View style={styles.thumb}>
          {resolvePhotoUrl((item as any).photoUrl) ? (
            <Image
              source={{ uri: resolvePhotoUrl((item as any).photoUrl)! }}
              style={styles.thumbImg}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.thumbImg, styles.thumbPlaceholder]}>
              <Text style={{ fontSize: 26 }}>
                {
                  (item as any).category === "agua" ? "💧" :
                  (item as any).category === "electricidad" ? "⚡" :
                  (item as any).category === "acceso" ? "🔑" :
                  (item as any).category === "limpieza" ? "🧹" :
                  (item as any).category === "ruidos" ? "🔊" :
                  (item as any).category === "instalaciones" ? "🔧" : "⚠️"
                }
              </Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardDate}>
            Reportado el {formatDate(item.createdAt)}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusText, { color: st.color }]}>
              {st.icon} {st.label}
            </Text>
          </View>
        </View>

        {/* Right side */}
        <View style={styles.cardRight}>
          <View style={[styles.dot, { backgroundColor: isActive ? "#22c55e" : "#D1D5DB" }]} />
          <Text style={styles.chevron}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Empty state ─────────────────────────────────────────────────────────────
  const EmptyState = () => (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyCard}>
        <View style={styles.emptyLogoWrap}>
          <Text style={{ fontSize: 36, color: PRIMARY }}>A</Text>
          <View style={styles.emptyDot} />
        </View>
        <Text style={styles.emptyTitle}>Todo está en orden</Text>
        <Text style={styles.emptySub}>
          {tab === "activas"
            ? "No tienes incidencias registradas."
            : "No tienes incidencias finalizadas."}
        </Text>
        {tab === "activas" && (
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push("/(vecino)/incidents/new")}
            activeOpacity={0.85}
          >
            <Text style={styles.emptyButtonText}>Informar de un problema  +</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis incidencias</Text>
        <Text style={styles.headerSub}>
          Sigue el estado de tus solicitudes en tiempo real.
        </Text>
      </View>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <View style={styles.tabsWrap}>
        <View style={styles.tabsTrack}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === "activas" && styles.tabBtnActive]}
            onPress={() => setTab("activas")}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, tab === "activas" && styles.tabTextActive]}>
              Activas ({activas.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === "finalizadas" && styles.tabBtnActive]}
            onPress={() => setTab("finalizadas")}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, tab === "finalizadas" && styles.tabTextActive]}>
              Finalizadas ({finalizadas.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── List ────────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : displayList.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={displayList}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={PRIMARY} />
          }
        />
      )}

      {/* ── FAB ──────────────────────────────────────────────────────────────── */}
      {displayList.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push("/(vecino)/incidents/new")}
          activeOpacity={0.85}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: DARK,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  headerSub: { fontSize: 13, color: MUTED, lineHeight: 18 },

  // ── Tabs ──────────────────────────────────────────────────────────────────
  tabsWrap: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tabsTrack: {
    flexDirection: "row",
    backgroundColor: BG,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tabText: { fontSize: 13, fontWeight: "600", color: MUTED },
  tabTextActive: { color: PRIMARY },

  // ── List ──────────────────────────────────────────────────────────────────
  list: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  thumb: { width: 72, height: 72, borderRadius: 12, overflow: "hidden", flexShrink: 0 },
  thumbImg: { width: 72, height: 72, borderRadius: 12 },
  thumbPlaceholder: {
    backgroundColor: `${PRIMARY}12`,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: DARK, lineHeight: 20 },
  cardDate: { fontSize: 12, color: MUTED },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusText: { fontSize: 12, fontWeight: "600" },
  cardRight: {
    alignItems: "center",
    justifyContent: "space-between",
    height: 48,
    flexShrink: 0,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chevron: { fontSize: 22, color: "#D1D5DB", fontWeight: "300", lineHeight: 26 },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyWrap: { flex: 1, padding: 20, justifyContent: "flex-start", paddingTop: 24 },
  emptyCard: {
    backgroundColor: `${PRIMARY}0D`,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: `${PRIMARY}25`,
  },
  emptyLogoWrap: { position: "relative", marginBottom: 16 },
  emptyDot: {
    position: "absolute",
    top: -2,
    right: -8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PRIMARY,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: DARK,
    marginBottom: 6,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    shadowColor: PRIMARY,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  emptyButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // ── FAB ────────────────────────────────────────────────────────────────────
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: { color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 32, marginTop: -2 },
});
