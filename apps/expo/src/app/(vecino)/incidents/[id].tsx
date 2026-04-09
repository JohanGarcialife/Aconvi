import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";

const PRIMARY = "#4aa19b";
const DARK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";

// ─── Mock — en producción vendrá de trpc.incident.byId ───────────────────────
const MOCK: Record<string, {
  title: string; community: string; address: string;
  status: "PENDIENTE" | "ASIGNADA" | "EN_CURSO" | "RESUELTA";
  category: string; description: string;
  timeline: { label: string; date: string; done: boolean }[];
}> = {
  "1": {
    title: "Filtración en Garaje P.2",
    community: "Residencial Los Olivos",
    address: "Av. de Andalucía, 105",
    status: "RESUELTA",
    category: "💧 Agua",
    description: "Gotea agua del techo del garaje en la plaza P.2. El suelo está mojado.",
    timeline: [
      { label: "Reporte enviado", date: "Hoy, 10:20", done: true },
      { label: "Asignado a Fontanería Pérez", date: "Hoy, 10:45", done: true },
      { label: "Técnico en camino", date: "Hoy, 11:10", done: true },
      { label: "Reparación finalizada", date: "Hoy, 12:30", done: true },
      { label: "Validado por AF", date: "Hoy, 13:00", done: true },
    ],
  },
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  PENDIENTE: { label: "Pendiente", color: "#92400e", bg: "#fef3c7" },
  ASIGNADA: { label: "Asignada", color: "#1e40af", bg: "#dbeafe" },
  EN_CURSO: { label: "En curso", color: "#7c3aed", bg: "#ede9fe" },
  RESUELTA: { label: "Resuelta ✓", color: "#065f46", bg: "#d1fae5" },
};

export default function IncidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const incident = MOCK[id ?? "1"];

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

  const st = STATUS_LABELS[incident.status]!;

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
          <Row label="Categoría" value={incident.category} />
          <View style={s.divider} />
          <Row label="Comunidad" value={incident.community} />
          <View style={s.divider} />
          <Row label="Descripción" value={incident.description} />
        </View>

        {/* Timeline */}
        <Text style={s.sectionTitle}>Estado de la reparación</Text>
        <View style={s.card}>
          {incident.timeline.map((step, i) => (
            <View key={i} style={s.timelineRow}>
              {/* Connector */}
              <View style={s.timelineLeft}>
                <View style={[s.timelineDot, step.done && s.timelineDotDone]}>
                  {step.done && (
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>✓</Text>
                  )}
                </View>
                {i < incident.timeline.length - 1 && (
                  <View style={[s.timelineLine, step.done && s.timelineLineDone]} />
                )}
              </View>
              <View style={s.timelineContent}>
                <Text style={[s.timelineLabel, step.done && s.timelineLabelDone]}>
                  {step.label}
                </Text>
                {step.done && (
                  <Text style={s.timelineDate}>{step.date}</Text>
                )}
              </View>
            </View>
          ))}
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

        {/* Report problem */}
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
