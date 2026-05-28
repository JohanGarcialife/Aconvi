import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "~/utils/api";

const PRIMARY = "#4aa19b";
const DARK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";

// Aligned with real backend status enum
const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  RECIBIDA:    { label: "Pendiente 📥",   color: "#92400e", bg: "#fef3c7" },
  EN_REVISION: { label: "En revisión 🔍", color: "#1e40af", bg: "#dbeafe" },
  AGENDADA:    { label: "Agendada 📅",    color: "#5b21b6", bg: "#ede9fe" },
  EN_CURSO:    { label: "En curso 🔧",    color: "#065f46", bg: "#d1fae5" },
  RESUELTA:    { label: "Resuelta ✅",     color: "#065f46", bg: "#d1fae5" },
  RECHAZADA:   { label: "Rechazada ❌",   color: "#991b1b", bg: "#fee2e2" },
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
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
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
          <Row label="Descripción" value={incident.description ?? ""} />
          {(incident as any).category && (
            <>
              <View style={s.divider} />
              <Row label="Categoría" value={(incident as any).category} />
            </>
          )}
          {incident.provider && (
            <>
              <View style={s.divider} />
              <Row label="Especialista asignado" value={incident.provider.name ?? ""} />
            </>
          )}
        </View>

        {/* Incident photo */}
        {incident.photoUrl && (
          <>
            <Text style={s.sectionTitle}>Foto de la avería</Text>
            <Image
              source={{ uri: incident.photoUrl }}
              style={{ width: "100%", height: 200, borderRadius: 14, marginBottom: 20 }}
              resizeMode="cover"
            />
          </>
        )}

        {/* Timeline */}
        <Text style={s.sectionTitle}>Historial de la reparación</Text>
        <View style={s.card}>
          {incident.history && incident.history.length > 0 ? (
            incident.history.map((entry: any, index: number) => {
              const isLast = index === incident.history.length - 1;
              let actionColor = PRIMARY;
              if (entry.action === "CREATED") { actionColor = "#3b82f6"; }
              if (entry.action === "ASSIGNED") { actionColor = "#a855f7"; }
              if (entry.action === "COMPLETED") { actionColor = "#22c55e"; }
              if (entry.action === "STATUS_CHANGED" && entry.newStatus === "RECHAZADA") { actionColor = "#ef4444"; }

              return (
                <View key={entry.id} style={s.timelineRow}>
                  <View style={s.timelineLeft}>
                    <View style={[s.timelineDot, { borderColor: actionColor, backgroundColor: actionColor }]}>
                      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>✓</Text>
                    </View>
                    {!isLast && <View style={[s.timelineLine, { backgroundColor: `${actionColor}50` }]} />}
                  </View>
                  <View style={s.timelineContent}>
                    <Text style={s.timelineLabelDone}>
                      {entry.action === "CREATED" ? "Reporte enviado" :
                       entry.action === "ASSIGNED" ? "Asignada a especialista" :
                       entry.action === "COMPLETED" ? "Trabajo finalizado" :
                       entry.action === "STATUS_CHANGED" ? `Estado: ${entry.newStatus}` :
                       entry.action}
                    </Text>
                    {entry.comment && (
                      <Text style={{ fontSize: 13, color: "#475569", marginTop: 4, fontStyle: "italic" }}>
                        "{entry.comment}"
                      </Text>
                    )}
                    <Text style={s.timelineDate}>
                      {new Date(entry.createdAt).toLocaleString("es-ES", {
                        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
                      })}
                    </Text>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={{ fontSize: 13, color: MUTED }}>Sin historial</Text>
          )}
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
