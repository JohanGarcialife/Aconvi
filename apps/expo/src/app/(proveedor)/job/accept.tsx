import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack, useLocalSearchParams, useFocusEffect } from "expo-router";
import { api, queryClient } from "~/utils/api";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { getBaseUrl } from "~/utils/base-url";

const PRIMARY = "#009689";
const DARK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";
const RED = "#ef4444";

const DEFAULT_PHOTO = "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=1000";

function resolvePhotoUrl(url?: string | null) {
  if (!url || url.trim() === "") return DEFAULT_PHOTO;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${getBaseUrl()}${path}`;
}

export default function AcceptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ incidentId?: string; providerId?: string; tenantId?: string }>();
  const incidentId = params.incidentId;
  const providerId = params.providerId ?? "";
  const tenantId = params.tenantId ?? "org_aconvi_demo";

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [imageError, setImageError] = useState(false);

  const { data: incident, isLoading, refetch } = useQuery(
    api.incident.byId.queryOptions(
      { id: incidentId ?? "", tenantId },
      { enabled: !!incidentId }
    )
  );

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const rejectMutation = useMutation({
    ...((api.incident as any).providerReject?.mutationOptions?.() ?? {}),
    mutationFn: async (data: { id: string; tenantId: string; providerId: string; reason?: string }) => {
      const opts = (api.incident as any).providerReject.mutationOptions();
      return opts.mutationFn(data);
    },
    onSuccess: () => {
      setShowRejectModal(false);
      queryClient.invalidateQueries({ queryKey: [["incident"]] });
      Alert.alert(
        "Asignación rechazada",
        "La orden de trabajo ha sido devuelta a la administración para su reasignación.",
        [{ text: "OK", onPress: () => router.replace("/(proveedor)/job") }]
      );
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "No se pudo rechazar la orden de trabajo.");
    },
  });

  // Calculate live countdown (2 hours limit from assignedAt/createdAt)
  const assignedTime = incident?.assignedAt
    ? new Date(incident.assignedAt).getTime()
    : incident?.createdAt
    ? new Date(incident.createdAt).getTime()
    : Date.now();

  const EXPIRATION_MS = 2 * 60 * 60 * 1000;
  const [remainingMs, setRemainingMs] = useState<number>(() => {
    return Math.max(0, assignedTime + EXPIRATION_MS - Date.now());
  });

  useEffect(() => {
    const initialMs = Math.max(0, assignedTime + EXPIRATION_MS - Date.now());
    setRemainingMs(initialMs);
    const timer = setInterval(() => {
      const ms = Math.max(0, assignedTime + EXPIRATION_MS - Date.now());
      setRemainingMs(ms);
    }, 1000);
    return () => clearInterval(timer);
  }, [assignedTime]);

  const isExpired = remainingMs <= 0 || (incident?.status === "RECIBIDA" && !incident?.assignedAt);

  const formatCountdown = (ms: number) => {
    if (ms <= 0) return "00:00:00";
    const totalSecs = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleAccept = () => {
    if (isExpired) {
      Alert.alert(
        "OT Caducada",
        "Esta orden de trabajo ha superado el límite de 2 horas y ha caducado. No se puede aceptar."
      );
      return;
    }
    router.push({
      pathname: "/(proveedor)/job/estimate",
      params: { incidentId, providerId, tenantId },
    });
  };

  const handleConfirmReject = () => {
    if (!incidentId || rejectMutation.isPending) return;
    rejectMutation.mutate({
      id: incidentId,
      tenantId,
      providerId,
      reason: rejectReason.trim() || undefined,
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <ActivityIndicator color={PRIMARY} size="large" />
          <Text style={styles.loadingText}>Cargando detalle de asignación...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const orgName = (incident as any)?.organization?.name || "Residencial El Lago";
  const address = (incident as any)?.address || "Calle Los Sauces, 345";
  const priority = incident?.priority ?? "Alta";
  const title = incident?.title ?? "Gotera en tejado";
  const description = incident?.description ?? "Gotea mucho el techo del pasillo";
  const photoUrl = incident?.photoUrl;

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={DARK} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.communityTitle} numberOfLines={1}>{orgName}</Text>
          <Text style={styles.addressSub}>{address}</Text>
          <Text style={styles.prioritySub}>
            {priority.charAt(0).toUpperCase() + priority.slice(1)} · 2 h
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Countdown Box */}
        <View style={styles.timerCard}>
          <Text style={styles.timerLabel}>Tiempo para aceptar</Text>
          <Text style={[styles.timerValue, isExpired && { color: RED }]}>
            {formatCountdown(remainingMs)}
          </Text>
          {isExpired && (
            <View style={styles.expiredBanner}>
              <Ionicons name="alert-circle" size={16} color={RED} />
              <Text style={styles.expiredText}>OT Caducada — Límite de 2h superado</Text>
            </View>
          )}
        </View>

        {/* Incident Photo Card */}
        {(() => {
          let displayPhotoUri = resolvePhotoUrl(incident?.photoUrl);
          if (imageError && incident?.photoUrl?.startsWith("/")) {
            displayPhotoUri = `https://aconvi.com${incident.photoUrl}`;
          } else if (imageError) {
            displayPhotoUri = DEFAULT_PHOTO;
          }
          return (
            <View style={styles.photoContainer}>
              <Image
                source={{ uri: displayPhotoUri }}
                style={styles.photoImage}
                resizeMode="cover"
                onError={() => setImageError(true)}
              />
            </View>
          );
        })()}

        {/* Problem Description */}
        <View style={styles.descCard}>
          <Text style={styles.descTitle}>{title}</Text>
          <Text style={styles.descText}>{description}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.acceptBtn, isExpired && styles.disabledBtn]}
            onPress={handleAccept}
            disabled={isExpired}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.acceptBtnText}>
              {isExpired ? "OT CADUCADA" : "ACEPTAR Y AVISAR"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.rejectBtn, isExpired && styles.disabledBtn]}
            onPress={() => setShowRejectModal(true)}
            disabled={isExpired}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle-outline" size={20} color={isExpired ? MUTED : RED} style={{ marginRight: 6 }} />
            <Text style={[styles.rejectBtnText, isExpired && { color: MUTED }]}>
              {isExpired ? "OT CADUCADA" : "RECHAZAR ASIGNACIÓN"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Reject Modal */}
      <Modal visible={showRejectModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning-outline" size={28} color={RED} />
              <Text style={styles.modalTitle}>Rechazar asignación</Text>
            </View>

            <Text style={styles.modalMessage}>
              ¿Estás seguro de que deseas rechazar esta orden de trabajo? Volverá a la administración para su reasignación.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Motivo del rechazo (opcional)"
              placeholderTextColor={MUTED}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowRejectModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmReject}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirmar rechazo</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 14, color: MUTED },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: { padding: 8 },
  headerCenter: { alignItems: "center" },
  communityTitle: { fontSize: 20, fontWeight: "700", color: DARK },
  addressSub: { fontSize: 13, color: MUTED, marginTop: 2 },
  prioritySub: { fontSize: 13, color: RED, fontWeight: "600", marginTop: 2 },

  content: { padding: 20, alignItems: "center" },

  timerCard: { alignItems: "center", marginVertical: 12 },
  timerLabel: { fontSize: 14, color: MUTED, fontWeight: "500" },
  timerValue: { fontSize: 36, fontWeight: "800", color: RED, marginTop: 4, letterSpacing: 1 },
  expiredBanner: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  expiredText: { fontSize: 13, color: RED, fontWeight: "600" },

  photoContainer: {
    width: "100%",
    height: 240,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#f1f5f9",
    marginVertical: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  photoImage: { width: "100%", height: "100%" },
  photoPlaceholder: { flex: 1, justifyContent: "center", alignItems: "center" },
  placeholderText: { fontSize: 13, color: MUTED, marginTop: 8 },

  descCard: { width: "100%", marginBottom: 24, alignItems: "center" },
  descTitle: { fontSize: 16, fontWeight: "700", color: DARK, marginBottom: 4 },
  descText: { fontSize: 15, color: MUTED, textAlign: "center" },

  actionContainer: { width: "100%", gap: 12 },
  acceptBtn: {
    backgroundColor: PRIMARY,
    height: 52,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: PRIMARY,
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  disabledBtn: { backgroundColor: "#94a3b8" },
  acceptBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  rejectBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: RED,
    backgroundColor: "#fef2f2",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  rejectBtnText: { color: RED, fontSize: 14, fontWeight: "700" },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    elevation: 8,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: DARK },
  modalMessage: { fontSize: 14, color: MUTED, marginBottom: 16, lineHeight: 20 },
  modalInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: DARK,
    minHeight: 70,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  modalCancelText: { color: MUTED, fontSize: 14, fontWeight: "600" },
  modalConfirmBtn: { backgroundColor: RED, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  modalConfirmText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
