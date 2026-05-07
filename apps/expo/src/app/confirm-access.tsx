/**
 * Confirm Access Screen
 *
 * Shown when the user receives an "auth_confirm" push notification.
 * The push data contains a `token` (pushAuthSession token).
 * Tapping "Confirmar" marks the session as CONFIRMED → web polling picks it up.
 */
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { trpc } from "../utils/api";
import { getBaseUrl } from "~/utils/base-url";

export default function ConfirmAccessScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "confirming" | "rejecting" | "done" | "rejected">("idle");

  const confirmAccess = trpc.auth.confirmPushAccess.useMutation({
    onSuccess: () => {
      setState("done");
      setTimeout(() => router.replace("/"), 1800);
    },
    onError: (err) => {
      Alert.alert("Error", err.message || "No se pudo confirmar el acceso.");
      setState("idle");
    },
  });

  const cancelAccess = trpc.auth.cancelPushAccess.useMutation({
    onSuccess: () => {
      setState("rejected");
      setTimeout(() => router.replace("/"), 1800);
    },
    onError: () => {
      router.back();
    },
  });

  const handleConfirm = () => {
    if (!token) return;
    setState("confirming");
    confirmAccess.mutate({ token });
  };

  const handleReject = () => {
    Alert.alert(
      "Rechazar acceso",
      "¿Estás seguro de que quieres rechazar este intento de inicio de sesión?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sí, rechazar",
          style: "destructive",
          onPress: () => {
            setState("rejecting");
            if (token) cancelAccess.mutate({ token });
            else router.back();
          },
        },
      ],
    );
  };

  // ── Success state ─────────────────────────────────────────────────────────
  if (state === "done") {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={[styles.iconCircle, { backgroundColor: "rgba(0,189,165,0.12)" }]}>
          <Text style={styles.icon}>✓</Text>
        </View>
        <Text style={styles.title}>Acceso confirmado</Text>
        <Text style={styles.subtitle}>Puedes continuar en el portal web.</Text>
      </View>
    );
  }

  // ── Rejected state ────────────────────────────────────────────────────────
  if (state === "rejected") {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={[styles.iconCircle, { backgroundColor: "#fef2f2" }]}>
          <Text style={styles.icon}>✗</Text>
        </View>
        <Text style={styles.title}>Acceso rechazado</Text>
        <Text style={styles.subtitle}>Si no fuiste tú, cambia tu PIN lo antes posible.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logoText}>Aconvi</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.lockIcon}>🔐</Text>
        </View>

        <Text style={styles.title}>Solicitud de acceso</Text>
        <Text style={styles.subtitle}>
          Alguien está intentando iniciar sesión con tu usuario corporativo en el portal web.
        </Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>¿Eras tú?</Text>
          <Text style={styles.infoText}>
            Si tú has introducido tu usuario en el portal web, confirma el acceso.{"\n"}
            Si no reconoces este intento, recházalo inmediatamente.
          </Text>
        </View>

        {/* Confirm */}
        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={handleConfirm}
          disabled={state !== "idle"}
        >
          {state === "confirming" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.confirmBtnText}>✓  Confirmar acceso</Text>
          )}
        </TouchableOpacity>

        {/* Reject */}
        <TouchableOpacity
          style={styles.rejectBtn}
          onPress={handleReject}
          disabled={state !== "idle"}
        >
          {state === "rejecting" ? (
            <ActivityIndicator color="#dc2626" />
          ) : (
            <Text style={styles.rejectBtnText}>No era yo — Rechazar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const TEAL = "#00BDA5";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { justifyContent: "center", alignItems: "center", gap: 16 },
  header: { paddingTop: 60, paddingHorizontal: 32, paddingBottom: 16 },
  logoText: { fontSize: 22, fontWeight: "800", color: "#0F1B2B" },
  content: { flex: 1, paddingHorizontal: 32, paddingTop: 32, alignItems: "center" },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(0,189,165,0.10)",
    alignItems: "center", justifyContent: "center", marginBottom: 24,
  },
  lockIcon: { fontSize: 36 },
  icon: { fontSize: 36, color: TEAL, fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "700", color: "#0F1B2B", textAlign: "center", marginBottom: 10 },
  subtitle: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 21, marginBottom: 28, maxWidth: 300 },
  infoBox: { backgroundColor: "#f9fafb", borderRadius: 12, padding: 16, width: "100%", marginBottom: 28 },
  infoLabel: { fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  infoText: { fontSize: 13, color: "#6b7280", lineHeight: 20 },
  confirmBtn: { backgroundColor: TEAL, borderRadius: 10, padding: 16, width: "100%", alignItems: "center", marginBottom: 14 },
  confirmBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  rejectBtn: { padding: 12, width: "100%", alignItems: "center" },
  rejectBtnText: { color: "#dc2626", fontSize: 14, fontWeight: "600" },
});
