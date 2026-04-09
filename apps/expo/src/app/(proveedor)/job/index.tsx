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
import { useRouter, Stack } from "expo-router";

const PRIMARY = "#4aa19b";
const DARK = "#0f172a";
const MUTED = "#64748b";
const URGENT_RED = "#ef4444";

// ─── Countdown timer ──────────────────────────────────────────────────────────
function useCountdown(initialSeconds: number) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [seconds]);

  const h = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");

  return `${h}:${m}:${s}`;
}

// ─── Mock job data ────────────────────────────────────────────────────────────
const MOCK_JOB = {
  id: "INC-2025-0412",
  community: "Residencial El Lago",
  address: "Calle Los Sauces, 345",
  urgency: "Urgente · 2 h",
  description: "Gotea mucho el techo del pasillo",
  photoUrl: null, // In prod: real URL
};

export default function ProveedorJobScreen() {
  const router = useRouter();
  const countdown = useCountdown(1 * 3600 + 42 * 60 + 5); // 1h 42m 5s
  const [isAccepting, setIsAccepting] = useState(false);

  const handleAccept = async () => {
    setIsAccepting(true);
    // In prod: trpc.incident.assignProvider mutation
    await new Promise((r) => setTimeout(r, 900));
    setIsAccepting(false);
    router.push("/(proveedor)/job/estimate");
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <Stack.Screen options={{ title: "", headerShown: false }} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Community name */}
        <Text style={styles.communityName}>{MOCK_JOB.community}</Text>
        <Text style={styles.address}>{MOCK_JOB.address}</Text>

        {/* Urgency */}
        <View style={styles.urgencyRow}>
          <Text style={styles.urgencyText}>{MOCK_JOB.urgency}</Text>
        </View>

        <View style={styles.divider} />

        {/* Countdown */}
        <Text style={styles.countdownLabel}>Tiempo para aceptar</Text>
        <Text style={[styles.countdown, countdown === "00:00:00" && { color: URGENT_RED }]}>
          {countdown}
        </Text>

        {/* Incident photo */}
        <View style={styles.photoWrapper}>
          {MOCK_JOB.photoUrl ? (
            <Image
              source={{ uri: MOCK_JOB.photoUrl }}
              style={styles.photo}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Text style={{ fontSize: 48, marginBottom: 8 }}>🏗️</Text>
              <Text style={{ color: "#94a3b8", fontSize: 13 }}>
                Foto del problema
              </Text>
            </View>
          )}
        </View>

        {/* Description */}
        <Text style={styles.description}>{MOCK_JOB.description}</Text>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.acceptButton, isAccepting && { opacity: 0.7 }]}
          onPress={handleAccept}
          disabled={isAccepting}
          activeOpacity={0.85}
        >
          {isAccepting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.acceptButtonIcon}>✓</Text>
              <Text style={styles.acceptButtonText}>ACEPTAR Y AVISAR</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Decline */}
        <TouchableOpacity
          style={styles.declineButton}
          onPress={() =>
            Alert.alert(
              "Rechazar trabajo",
              "¿Seguro que quieres rechazar esta incidencia?",
              [
                { text: "Cancelar", style: "cancel" },
                { text: "Rechazar", style: "destructive", onPress: () => router.back() },
              ]
            )
          }
        >
          <Text style={styles.declineButtonText}>No puedo atenderlo</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
    alignItems: "center",
  },
  communityName: {
    fontSize: 28,
    fontWeight: "800",
    color: DARK,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  address: {
    fontSize: 15,
    color: MUTED,
    textAlign: "center",
    marginTop: 4,
  },
  urgencyRow: {
    marginTop: 6,
  },
  urgencyText: {
    fontSize: 14,
    color: URGENT_RED,
    fontWeight: "600",
    textAlign: "center",
  },
  divider: {
    width: "60%",
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 20,
  },
  countdownLabel: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    marginBottom: 6,
  },
  countdown: {
    fontSize: 44,
    fontWeight: "800",
    color: URGENT_RED,
    letterSpacing: 2,
    fontVariant: ["tabular-nums"],
    marginBottom: 20,
  },
  photoWrapper: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  photo: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 16,
  },
  photoPlaceholder: {
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  description: {
    fontSize: 16,
    color: MUTED,
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 22,
  },
  acceptButton: {
    flexDirection: "row",
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    marginBottom: 12,
    shadowColor: PRIMARY,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  acceptButtonIcon: { color: "#fff", fontSize: 18, fontWeight: "800" },
  acceptButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 1,
  },
  declineButton: {
    paddingVertical: 12,
  },
  declineButtonText: {
    color: MUTED,
    fontSize: 14,
    textDecorationLine: "underline",
    textAlign: "center",
  },
});
