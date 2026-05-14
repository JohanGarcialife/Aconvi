import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "~/utils/api";

const PRIMARY = "#4aa19b";
const DARK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";

const STATUS_LABELS = {
  NUEVA: { label: "Nueva", color: "#3b82f6", bg: "#eff6ff" },
  EN_REVISION: { label: "En revisión", color: "#eab308", bg: "#fefce8" },
  AGENDADA: { label: "Agendada", color: "#a855f7", bg: "#faf5ff" },
  EN_PROCESO: { label: "En proceso", color: "#f97316", bg: "#fff7ed" },
  RESUELTA: { label: "Resuelta", color: "#22c55e", bg: "#f0fdf4" },
  CERRADA: { label: "Cerrada", color: "#64748b", bg: "#f8fafc" },
};

export default function IncidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const TENANT_ID = "org_aconvi_demo";

  const { data: incident, isLoading } = useQuery({
    ...api.incident.byId.queryOptions({ id: id as string, tenantId: TENANT_ID }),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe}>
        <Stack.Screen options={{ title: "Incidencia" }} />
        <View style={s.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </SafeAreaView>
    );
  }

  if (!incident) {
    return (
      <SafeAreaView style={s.safe}>
        <Stack.Screen options={{ title: "Incidencia" }} />
        <View style={s.center}>
          <Text style={{ fontSize: 48 }}>🔍</Text>
          <Text style={s.emptyTitle}>Incidencia no encontrada</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.back}>← Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const st = STATUS_LABELS[incident.status as keyof typeof STATUS_LABELS] || { label: incident.status, color: "#92400e", bg: "#fef3c7" };

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "Detalle incidencia",
          headerBackTitle: "Mis incidencias",
        }}
      />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Status badge */}
        <View style={[s.badge, { backgroundColor: st.bg }]}>
          <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
        </View>

        {/* Title & location */}
        <Text style={s.title}>{incident.title}</Text>
        <Text style={s.location}>
          📍 {incident.community} · {incident.address}
        </Text>

        {/* Meta info */}
        <View style={s.card}>
          <Row label="Prioridad" value={incident.priority ?? "NORMAL"} />
          <View style={s.divider} />
          <Row label="Comunidad" value={incident.organizationId ?? ""} />
          <View style={s.divider} />
          <Row label="Descripción" value={incident.description ?? ""} />
        </View>

        {/* Timeline */}
        <Text style={s.sectionTitle}>Estado de la reparación</Text>
        <View style={s.card}>
          <View style={s.timelineRow}>
            <View style={s.timelineLeft}>
              <View style={[s.timelineDot, s.timelineDotDone]}>
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>✓</Text>
              </View>
              <View style={[s.timelineLine, incident.assignedAt && s.timelineLineDone]} />
            </View>
            <View style={s.timelineContent}>
              <Text style={[s.timelineLabel, s.timelineLabelDone]}>
                Reporte enviado
              </Text>
              <Text style={s.timelineDate}>{incident.createdAt ? new Date(incident.createdAt).toLocaleDateString() : ""}</Text>
            </View>
          </View>
          
          <View style={s.timelineRow}>
            <View style={s.timelineLeft}>
              <View style={[s.timelineDot, incident.assignedAt && s.timelineDotDone]}>
                {incident.assignedAt && <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>✓</Text>}
              </View>
              <View style={[s.timelineLine, incident.resolvedAt && s.timelineLineDone]} />
            </View>
            <View style={s.timelineContent}>
              <Text style={[s.timelineLabel, incident.assignedAt && s.timelineLabelDone]}>
                Asignada
              </Text>
              {incident.assignedAt && <Text style={s.timelineDate}>{new Date(incident.assignedAt).toLocaleDateString()}</Text>}
            </View>
          </View>

          <View style={s.timelineRow}>
            <View style={s.timelineLeft}>
              <View style={[s.timelineDot, incident.resolvedAt && s.timelineDotDone]}>
                {incident.resolvedAt && <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>✓</Text>}
              </View>
            </View>
            <View style={s.timelineContent}>
              <Text style={[s.timelineLabel, incident.resolvedAt && s.timelineLabelDone]}>
                Resuelta
              </Text>
              {incident.resolvedAt && <Text style={s.timelineDate}>{new Date(incident.resolvedAt).toLocaleDateString()}</Text>}
            </View>
          </View>
        </View>

        {/* Rating CTA (only if resolved) */}
        {incident.status === "RESUELTA" && (
          <TouchableOpacity
            style={s.rateButton}
            onPress={() => router.push(`/(vecino)/rating?incidentId=${id}`)}
            activeOpacity={0.85}
          >
            <Text style={s.rateButtonText}>⭐ Valorar el servicio</Text>
          </TouchableOpacity>
        )}

        {/* Report problem 
        <TouchableOpacity
          style={s.problemButton}
          onPress={() =>
            Alert.alert(
              "Reportar problema",
              "¿La incidencia no ha sido resuelta correctamente?",
              [
                { text: "Cancelar", style: "cancel" },
                { text: "Reportar", style: "destructive" },
              ]
            )
          }
        >
          <Text style={s.problemButtonText}>Informar de un problema</Text>
        </TouchableOpacity>
        */}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ paddingVertical: 6 }}>
      <Text style={{ fontSize: 11, color: MUTED, fontWeight: "600", marginBottom: 2 }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ fontSize: 14, color: DARK, lineHeight: 20 }}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: DARK },
  back: { fontSize: 14, color: PRIMARY },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
  },
  badgeText: { fontSize: 12, fontWeight: "700" },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: DARK,
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  location: { fontSize: 13, color: MUTED, marginBottom: 16 },
  card: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 20,
  },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 8 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: DARK,
    marginBottom: 12,
  },
  // Timeline
  timelineRow: { flexDirection: "row", gap: 12, minHeight: 48 },
  timelineLeft: { alignItems: "center", width: 24 },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BORDER,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotDone: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  timelineLine: { width: 2, flex: 1, backgroundColor: BORDER, marginVertical: 2 },
  timelineLineDone: { backgroundColor: `${PRIMARY}50` },
  timelineContent: { flex: 1, paddingBottom: 16 },
  timelineLabel: { fontSize: 14, color: MUTED, fontWeight: "500" },
  timelineLabelDone: { color: DARK, fontWeight: "600" },
  timelineDate: { fontSize: 12, color: MUTED, marginTop: 2 },
  // Buttons
  rateButton: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: PRIMARY,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  rateButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  problemButton: { alignItems: "center", paddingVertical: 10 },
  problemButtonText: { fontSize: 13, color: MUTED, textDecorationLine: "underline" },
});
