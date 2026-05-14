import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { api } from "~/utils/api";
import { useQuery, useMutation } from "@tanstack/react-query";

const PRIMARY = "#4aa19b";
const DARK = "#0f172a";
const MUTED = "#64748b";
const URGENT_RED = "#ef4444";

// Demo provider ID — in prod, comes from the authenticated session
const DEMO_PROVIDER_ID = ""; // will be populated from query
const DEMO_TENANT_ID = "org_aconvi_demo";

// ─── Countdown timer ──────────────────────────────────────────────────────────
function useCountdown(initialSeconds: number) {
  const [seconds, setSeconds] = useState(initialSeconds);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [seconds]);
  const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// ─── Priority label ────────────────────────────────────────────────────────────
function priorityLabel(p: string) {
  if (p === "URGENTE") return "🚨 Urgente";
  if (p === "ALTA") return "🔴 Alta prioridad";
  if (p === "MEDIA") return "🟡 Prioridad media";
  return "🟢 Baja prioridad";
}

export default function ProveedorJobScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ incidentId?: string; providerId?: string }>();

  // If incidentId and providerId are passed via params, use them; 
  // otherwise fall back to listing all assigned incidents
  const incidentId = params.incidentId;
  const providerId = params.providerId;

  // Fetch assigned incidents for this provider
  const { data: incidents, isLoading } = useQuery(
    api.incident.all.queryOptions({
      tenantId: DEMO_TENANT_ID,
    }),
  );

  // Use the first active (EN_REVISION or RECIBIDA) incident assigned to this provider
  const activeIncident = (incidents as any[] | undefined)?.find(
    (i: any) =>
      (incidentId ? i.id === incidentId : true) &&
      (i.status === "EN_REVISION" || i.status === "RECIBIDA" || i.status === "AGENDADA"),
  ) ?? (incidents as any[] | undefined)?.[0] ?? null;

  const acceptMutation = useMutation({
    ...api.incident.providerAccept.mutationOptions(),
    onSuccess: () => {
      router.push({
        pathname: "/(proveedor)/job/estimate",
        params: {
          incidentId: activeIncident?.id,
          providerId,
        },
      });
    },
    onError: (e: any) => Alert.alert("Error", e.message),
  });

  const countdown = useCountdown(1 * 3600 + 42 * 60 + 5);

  const handleAccept = () => {
    if (!activeIncident) return;
    acceptMutation.mutate({
      id: activeIncident.id,
      tenantId: activeIncident.tenantId,
      providerId,
      notes: "Trabajo aceptado por proveedor",
    } as any);
  };

  const handleDecline = () => {
    Alert.alert(
      "Rechazar trabajo",
      "¿Seguro que quieres rechazar esta incidencia?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Rechazar", style: "destructive", onPress: () => router.back() },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={{ color: MUTED, marginTop: 12 }}>Cargando trabajo asignado...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!activeIncident) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>✅</Text>
          <Text style={{ fontSize: 18, fontWeight: "700", color: DARK, textAlign: "center" }}>
            No hay trabajos pendientes
          </Text>
          <Text style={{ color: MUTED, textAlign: "center", marginTop: 8 }}>
            Recibirás una notificación cuando se te asigne una nueva incidencia.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <Stack.Screen options={{ title: "", headerShown: false }} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Community name */}
        <Text style={styles.communityName}>
          {activeIncident.title}
        </Text>
        <Text style={styles.address}>
          {DEMO_TENANT_ID === "org_aconvi_demo" ? "Residencial Los Olivos · Av. de Andalucía, 105" : ""}
        </Text>

        {/* Priority */}
        <View style={styles.urgencyRow}>
          <Text style={[
            styles.urgencyText,
            { color: activeIncident.priority === "URGENTE" ? URGENT_RED : MUTED }
          ]}>
            {priorityLabel(activeIncident.priority ?? "MEDIA")}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Countdown */}
        <Text style={styles.countdownLabel}>Tiempo para aceptar</Text>
        <Text style={[styles.countdown, countdown === "00:00:00" && { color: URGENT_RED }]}>
          {countdown}
        </Text>

        {/* Incident photo */}
        <View style={styles.photoWrapper}>
          {activeIncident.photoUrl ? (
            <Image
              source={{ uri: activeIncident.photoUrl }}
              style={styles.photo}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Text style={{ fontSize: 48, marginBottom: 8 }}>🏗️</Text>
              <Text style={{ color: "#94a3b8", fontSize: 13 }}>Sin fotografía</Text>
            </View>
          )}
        </View>

        {/* Description */}
        <Text style={styles.description}>{activeIncident.description}</Text>

        {/* Reporter info */}
        {activeIncident.reporter?.name && (
          <View style={{ backgroundColor: "#f8fafc", borderRadius: 12, padding: 12, width: "100%", marginBottom: 20 }}>
            <Text style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>Reportado por</Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: DARK }}>
              {activeIncident.reporter.name}
            </Text>
            {activeIncident.reporter.phoneNumber && (
              <Text style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>
                📞 {activeIncident.reporter.phoneNumber}
              </Text>
            )}
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={[styles.acceptButton, acceptMutation.isPending && { opacity: 0.7 }]}
          onPress={handleAccept}
          disabled={acceptMutation.isPending}
          activeOpacity={0.85}
        >
          {acceptMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.acceptButtonIcon}>✓</Text>
              <Text style={styles.acceptButtonText}>ACEPTAR Y AVISAR</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Decline */}
        <TouchableOpacity style={styles.declineButton} onPress={handleDecline}>
          <Text style={styles.declineButtonText}>No puedo atenderlo</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 32, alignItems: "center" },
  communityName: { fontSize: 24, fontWeight: "800", color: DARK, textAlign: "center", letterSpacing: -0.5 },
  address: { fontSize: 14, color: MUTED, textAlign: "center", marginTop: 4 },
  urgencyRow: { marginTop: 6 },
  urgencyText: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  divider: { width: "60%", height: 1, backgroundColor: "#e2e8f0", marginVertical: 20 },
  countdownLabel: { fontSize: 14, color: MUTED, textAlign: "center", marginBottom: 6 },
  countdown: { fontSize: 44, fontWeight: "800", color: URGENT_RED, letterSpacing: 2, fontVariant: ["tabular-nums"], marginBottom: 20 },
  photoWrapper: { width: "100%", borderRadius: 16, overflow: "hidden", marginBottom: 16 },
  photo: { width: "100%", aspectRatio: 4 / 3, borderRadius: 16 },
  photoPlaceholder: { backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  description: { fontSize: 15, color: MUTED, textAlign: "center", marginBottom: 20, lineHeight: 22 },
  acceptButton: { flexDirection: "row", backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 18, paddingHorizontal: 32, alignItems: "center", justifyContent: "center", gap: 10, width: "100%", marginBottom: 12, shadowColor: PRIMARY, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  acceptButtonIcon: { color: "#fff", fontSize: 18, fontWeight: "800" },
  acceptButtonText: { color: "#fff", fontSize: 17, fontWeight: "800", letterSpacing: 1 },
  declineButton: { paddingVertical: 12 },
  declineButtonText: { color: MUTED, fontSize: 14, textDecorationLine: "underline", textAlign: "center" },
});
