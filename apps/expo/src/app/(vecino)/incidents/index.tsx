import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "~/utils/api";

const PRIMARY = "#4aa19b";
const DARK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";

// Tenant demo — en producción vendría de la sesión del usuario
const TENANT_ID = "org_aconvi_demo";

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  RECIBIDA:    { label: "Pendiente",   color: "#92400e", bg: "#fef3c7" },
  EN_REVISION: { label: "En revisión", color: "#1e40af", bg: "#dbeafe" },
  AGENDADA:    { label: "Agendada",    color: "#5b21b6", bg: "#ede9fe" },
  EN_CURSO:    { label: "En curso",    color: "#065f46", bg: "#d1fae5" },
  RESUELTA:    { label: "Resuelta ✅", color: "#065f46", bg: "#d1fae5" },
  RECHAZADA:   { label: "Rechazada",   color: "#991b1b", bg: "#fee2e2" },
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENTE: "#ef4444",
  ALTA:    "#f97316",
  MEDIA:   "#3b82f6",
  BAJA:    "#9ca3af",
};

export default function VecinoIncidentsScreen() {
  const router = useRouter();

  const { data: incidents = [], isLoading, refetch, isRefetching } = useQuery(
    api.incident.all.queryOptions({ tenantId: TENANT_ID }),
  );

  const renderItem = ({ item }: { item: (typeof incidents)[0] }) => {
    const st = STATUS_MAP[item.status] ?? { label: item.status, color: "#374151", bg: "#f3f4f6" };
    const priorityColor = PRIORITY_COLORS[item.priority] ?? "#9ca3af";

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(vecino)/incidents/${item.id}`)}
        activeOpacity={0.75}
      >
        {/* Priority stripe */}
        <View style={[styles.priorityStripe, { backgroundColor: priorityColor }]} />

        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
              <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
            </View>
          </View>

          {/* Categoría */}
          {(item as any).category && (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryChipText}>
                {(item as any).category}
              </Text>
            </View>
          )}

          <Text style={styles.cardDesc} numberOfLines={2}>
            {item.description}
          </Text>

          <View style={styles.cardFooter}>
            <Text style={styles.cardDate}>
              {new Date(item.createdAt).toLocaleDateString("es-ES", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </Text>
            {item.assignedAt && (
              <Text style={styles.cardAssigned}>
                Asignada · {item.provider ? item.provider.name : "—"}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Mis incidencias</Text>
          <Text style={styles.headerSub}>
            {incidents.length} reporte{incidents.length !== 1 ? "s" : ""} enviado
            {incidents.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.newButton}
          onPress={() => router.push("/(vecino)/incidents/new")}
          activeOpacity={0.8}
        >
          <Text style={styles.newButtonText}>+ Nueva</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={[styles.cardDesc, { marginTop: 12 }]}>Cargando incidencias…</Text>
        </View>
      ) : incidents.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 52, marginBottom: 12 }}>🎉</Text>
          <Text style={styles.emptyTitle}>¡Sin incidencias!</Text>
          <Text style={styles.emptySubtitle}>
            Cuando reportes un problema aparecerá aquí con su seguimiento en tiempo real.
          </Text>
          <TouchableOpacity
            style={[styles.newButton, { marginTop: 24 }]}
            onPress={() => router.push("/(vecino)/incidents/new")}
          >
            <Text style={styles.newButtonText}>+ Reportar incidencia</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={incidents}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={PRIMARY}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: DARK, letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  newButton: {
    backgroundColor: PRIMARY,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  newButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: "row",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  priorityStripe: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: DARK,
    flex: 1,
    lineHeight: 20,
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    flexShrink: 0,
  },
  statusText: { fontSize: 10, fontWeight: "700" },
  categoryChip: {
    alignSelf: "flex-start",
    backgroundColor: "#eef2ff",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginBottom: 6,
  },
  categoryChipText: { fontSize: 10, fontWeight: "600", color: "#6366f1", textTransform: "capitalize" },
  cardDesc: { fontSize: 12, color: MUTED, lineHeight: 17, marginBottom: 10 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between" },
  cardDate: { fontSize: 11, color: "#94a3b8" },
  cardAssigned: { fontSize: 11, color: PRIMARY, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: DARK, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 18 },
});
