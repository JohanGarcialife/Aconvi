import { AppState } from "react-native";
import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { api, queryClient } from "~/utils/api";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getBaseUrl } from "~/utils/base-url";

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
const DARK = "#0f172a";
const MUTED = "#64748b";
const URGENT_RED = "#ef4444";

// Demo provider ID — in prod, comes from the authenticated session
const DEMO_PROVIDER_ID = ""; // will be populated from query
const DEMO_TENANT_ID = "org_aconvi_demo";

// ─── Dynamic Countdown Timer based on Server Timestamp ──────────────────────
function useDynamicCountdown(targetTimestamp?: string | Date | null, durationMinutes = 120) {
  const getRemainingSeconds = () => {
    if (!targetTimestamp) return 7200; // default 2h fallback
    const startMs = new Date(targetTimestamp).getTime();
    const targetMs = startMs + durationMinutes * 60 * 1000;
    const nowMs = Date.now();
    const diffSec = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
    return diffSec;
  };

  const [seconds, setSeconds] = useState(getRemainingSeconds);

  useEffect(() => {
    setSeconds(getRemainingSeconds());
    const timer = setInterval(() => {
      const remaining = getRemainingSeconds();
      setSeconds(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [targetTimestamp]);

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

// ─── Status pill helper ───────────────────────────────────────────────────────
function statusLabelAndColor(status: string) {
  switch (status) {
    case "RECIBIDA":
      return { label: "Sin asignar", color: "#3b82f6", bgColor: "#eff6ff" };
    case "EN_REVISION":
      return { label: "Asignada", color: "#d97706", bgColor: "#fef3c7" };
    case "AGENDADA":
      return { label: "Agendada", color: "#a855f7", bgColor: "#faf5ff" };
    case "EN_CURSO":
      return { label: "En Curso", color: "#22c55e", bgColor: "#f0fdf4" };
    default:
      return { label: status, color: "#64748b", bgColor: "#f1f5f9" };
  }
}

// ─── Hook: resolve logged-in user's email from our custom session endpoint ────
function useSessionEmail() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEmail() {
      try {
        const token = await SecureStore.getItemAsync("expo_session_token");
        if (!token) { setLoading(false); return; }
        const res = await fetch(`${getBaseUrl()}/api/auth/get-session`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json() as { user?: { email?: string } };
          setEmail(data?.user?.email ?? null);
        }
      } catch {
        // ignore network errors
      } finally {
        setLoading(false);
      }
    }
    void fetchEmail();
  }, []);

  return { email, loading };
}

export default function ProveedorJobScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ incidentId?: string; providerId?: string }>();

  const incidentId = params.incidentId;

  // Step 1: Get the logged-in user's email from our reliable get-session endpoint
  const { email: sessionEmail, loading: loadingEmail } = useSessionEmail();

  // Step 2: Fetch the provider record by email (publicProcedure — no Better Auth dependency)
  const { data: currentProv, isLoading: loadingProv } = useQuery(
    api.provider.byEmail.queryOptions(
      { email: sessionEmail ?? "" },
      { enabled: !!sessionEmail }
    )
  );

  const providerId = params.providerId ?? currentProv?.id;
  const tenantId = currentProv?.organizationId ?? DEMO_TENANT_ID;

  // Step 3: Fetch assigned incidents for this provider
  const { data: incidents, isLoading: loadingIncidents, refetch: refetchIncidents, isRefetching } = useQuery(
    api.incident.assignedToProvider.queryOptions(
      {
        providerId: providerId ?? "",
        tenantId: tenantId,
      },
      {
        enabled: !!providerId,
        // Re-fetch every 5m in background to catch new assignments
        refetchInterval: 300_000,
      }
    )
  );

  const handleRefresh = async () => {
    await refetchIncidents();
  };

  const isLoading = loadingEmail || loadingProv || (!!providerId && loadingIncidents);

  // All active incidents (EN_REVISION, RECIBIDA, AGENDADA, EN_CURSO) assigned to this provider
  const activeIncidents = (incidents as any[] | undefined)?.filter(
    (i: any) =>
      i.status === "EN_REVISION" || i.status === "RECIBIDA" || i.status === "AGENDADA" || i.status === "EN_CURSO",
  ) ?? [];

  // State to track selected incident
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  // Helper to handle incident selection based on its current status
  const handleSelectIncident = useCallback((i: any) => {
    if (i.status === "AGENDADA") {
      router.push({
        pathname: "/(proveedor)/job/inprogress",
        params: { incidentId: i.id, providerId: providerId ?? DEMO_PROVIDER_ID },
      });
    } else if (i.status === "EN_CURSO") {
      router.push({
        pathname: "/(proveedor)/job/complete",
        params: { incidentId: i.id, providerId: providerId ?? DEMO_PROVIDER_ID },
      });
    } else {
      setSelectedIncidentId(i.id);
    }
  }, [router, providerId]);

  // Sync selectedIncidentId with router parameter if present
  useEffect(() => {
    if (incidentId && activeIncidents.length > 0) {
      const found = activeIncidents.find((i: any) => i.id === incidentId);
      if (found) {
        handleSelectIncident(found);
      }
    }
  }, [incidentId, activeIncidents, handleSelectIncident]);

  // Use the selected active incident, or null if none is selected
  const activeIncident = selectedIncidentId
    ? activeIncidents.find((i: any) => i.id === selectedIncidentId) ?? null
    : null;

  const acceptMutation = useMutation(
    api.incident.providerAccept.mutationOptions({
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
    })
  );

  // Auto refresh when coming back to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void refetchIncidents();
      }
    });
    return () => subscription.remove();
  }, [refetchIncidents]);

  const countdown = useDynamicCountdown(activeIncident?.assignedAt ?? activeIncident?.createdAt);

  const handleAccept = () => {
    if (!activeIncident || !providerId) return;

    acceptMutation.mutate({
      id: activeIncident.id,
      tenantId: activeIncident.organizationId ?? tenantId,
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
        { text: "Rechazar", style: "destructive", onPress: () => setSelectedIncidentId(null) },
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

  if (activeIncidents.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />
        
        {/* Header */}
        <View style={{ 
          flexDirection: "row", 
          justifyContent: "space-between", 
          alignItems: "center", 
          paddingHorizontal: 24, 
          paddingVertical: 16, 
          borderBottomWidth: 1, 
          borderBottomColor: "#e2e8f0",
          backgroundColor: "#fff"
        }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: DARK }}>Aconvi Proveedor</Text>
          <TouchableOpacity 
            onPress={() => Alert.alert("Cerrar sesión", "¿Seguro?", [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Salir",
                style: "destructive",
                onPress: async () => {
                  await SecureStore.deleteItemAsync("expo_session_token").catch(() => {});
                  queryClient.clear();
                  router.replace("/login");
                },
              },
            ])}
            style={{ 
              paddingVertical: 6, 
              paddingHorizontal: 12, 
              borderRadius: 8, 
              backgroundColor: "#FEF2F2" 
            }}
          >
            <Text style={{ color: "#DC2626", fontWeight: "600", fontSize: 13 }}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>✅</Text>
          <Text style={{ fontSize: 18, fontWeight: "700", color: DARK, textAlign: "center" }}>
            No hay trabajos pendientes
          </Text>
          <Text style={{ color: MUTED, textAlign: "center", marginTop: 8 }}>
            Recibirás una notificación cuando se te asigne una nueva incidencia.
          </Text>
          <TouchableOpacity
            onPress={handleRefresh}
            style={{ marginTop: 20, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: PRIMARY, borderRadius: 10 }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>↻ Verificar ahora</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // If no specific active incident is selected, show list
  if (!activeIncident) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <Stack.Screen options={{ title: "", headerShown: false }} />

        {/* Header */}
        <View style={{ 
          flexDirection: "row", 
          justifyContent: "space-between", 
          alignItems: "center", 
          paddingHorizontal: 24, 
          paddingVertical: 16, 
          borderBottomWidth: 1, 
          borderBottomColor: "#e2e8f0",
          backgroundColor: "#fff"
        }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: DARK }}>Aconvi Proveedor</Text>
          <TouchableOpacity 
            onPress={() => Alert.alert("Cerrar sesión", "¿Seguro?", [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Salir",
                style: "destructive",
                onPress: async () => {
                  await SecureStore.deleteItemAsync("expo_session_token").catch(() => {});
                  queryClient.clear();
                  router.replace("/login");
                },
              },
            ])}
            style={{ 
              paddingVertical: 6, 
              paddingHorizontal: 12, 
              borderRadius: 8, 
              backgroundColor: "#FEF2F2" 
            }}
          >
            <Text style={{ color: "#DC2626", fontWeight: "600", fontSize: 13 }}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.listScroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={PRIMARY}
            />
          }
        >
          <Text style={styles.listTitle}>Trabajos Asignados</Text>
          <Text style={styles.listSubtitle}>
            Tienes {activeIncidents.length} {activeIncidents.length === 1 ? "incidencia activa" : "incidencias activas"}
          </Text>

          {activeIncidents.map((i: any) => {
            const status = statusLabelAndColor(i.status);
            return (
              <TouchableOpacity
                key={i.id}
                style={styles.card}
                onPress={() => handleSelectIncident(i)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                  <Text style={styles.cardDate}>
                    {new Date(i.createdAt).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </Text>
                </View>

                <Text style={styles.cardTitle} numberOfLines={1}>
                  {i.title}
                </Text>

                <Text style={styles.cardDesc} numberOfLines={2}>
                  {i.description}
                </Text>

                <View style={styles.cardFooter}>
                  <Text style={styles.cardPriority}>
                    {priorityLabel(i.priority ?? "MEDIA")}
                  </Text>
                  <Text style={styles.viewDetailText}>Ver detalle →</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Show detailed view of the selected incident
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <Stack.Screen options={{ title: "", headerShown: false }} />

      {/* Header with Back button */}
      <View style={{ 
        flexDirection: "row", 
        justifyContent: "space-between", 
        alignItems: "center", 
        paddingHorizontal: 24, 
        paddingVertical: 16, 
        borderBottomWidth: 1, 
        borderBottomColor: "#e2e8f0",
        backgroundColor: "#fff"
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity 
            onPress={() => setSelectedIncidentId(null)}
            style={{ 
              paddingVertical: 6, 
              paddingHorizontal: 10, 
              borderRadius: 8, 
              backgroundColor: "#f1f5f9",
              marginRight: 4
            }}
          >
            <Text style={{ color: DARK, fontWeight: "700", fontSize: 14 }}>← Volver</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "800", color: DARK }}>Incidencia</Text>
        </View>
        
        <TouchableOpacity 
          onPress={() => Alert.alert("Cerrar sesión", "¿Seguro?", [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Salir",
              style: "destructive",
              onPress: async () => {
                await SecureStore.deleteItemAsync("expo_session_token").catch(() => {});
                queryClient.clear();
                router.replace("/login");
              },
            },
          ])}
          style={{ 
            paddingVertical: 6, 
            paddingHorizontal: 12, 
            borderRadius: 8, 
            backgroundColor: "#FEF2F2" 
          }}
        >
          <Text style={{ color: "#DC2626", fontWeight: "600", fontSize: 13 }}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={PRIMARY}
          />
        }
      >
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
        <Text style={styles.countdownLabel}>Tiempo para responder</Text>
        <Text style={[styles.countdown, countdown === "00:00:00" && { color: URGENT_RED }]}>
          {countdown}
        </Text>

        {/* Incident photo */}
        <View style={styles.photoWrapper}>
          {resolvePhotoUrl(activeIncident.photoUrl) ? (
            <Image
              source={{ uri: resolvePhotoUrl(activeIncident.photoUrl)! }}
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
              <Text style={styles.acceptButtonText}>ACEPTAR</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Decline */}
        <TouchableOpacity style={styles.declineButton} onPress={handleDecline}>
          <Text style={styles.declineButtonText}>No puedo atenderla</Text>
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
  photo: { width: "100%", height: 220, borderRadius: 16 },
  photoPlaceholder: { backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  description: { fontSize: 15, color: MUTED, textAlign: "center", marginBottom: 20, lineHeight: 22 },
  acceptButton: { flexDirection: "row", backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 18, paddingHorizontal: 32, alignItems: "center", justifyContent: "center", gap: 10, width: "100%", marginBottom: 12, shadowColor: PRIMARY, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  acceptButtonIcon: { color: "#fff", fontSize: 18, fontWeight: "800" },
  acceptButtonText: { color: "#fff", fontSize: 17, fontWeight: "800", letterSpacing: 1 },
  declineButton: { paddingVertical: 12 },
  declineButtonText: { color: MUTED, fontSize: 14, textDecorationLine: "underline", textAlign: "center" },

  // List View Styles
  listScroll: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32 },
  listTitle: { fontSize: 24, fontWeight: "800", color: DARK, letterSpacing: -0.5 },
  listSubtitle: { fontSize: 14, color: MUTED, marginTop: 4, marginBottom: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  cardDate: {
    fontSize: 12,
    color: MUTED,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: DARK,
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 14,
    color: MUTED,
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 12,
  },
  cardPriority: {
    fontSize: 13,
    fontWeight: "600",
  },
  viewDetailText: {
    fontSize: 13,
    fontWeight: "700",
    color: PRIMARY,
  },
});
