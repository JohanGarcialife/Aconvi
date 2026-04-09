import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";

const PRIMARY = "#4aa19b";
const DARK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";

export default function JobInProgressScreen() {
  const router = useRouter();
  const [arrivedLoading, setArrivedLoading] = useState(false);

  const handleArrived = async () => {
    setArrivedLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setArrivedLoading(false);
    router.push("/(proveedor)/job/complete");
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <Stack.Screen options={{ title: "En camino", headerBackTitle: "Regresar" }} />

      <View style={styles.container}>
        {/* Status illustration */}
        <View style={styles.illustration}>
          <Text style={styles.illustrationEmoji}>🚗</Text>
          <View style={styles.illustrationDots}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < 3 && { backgroundColor: PRIMARY },
                  { opacity: 1 - i * 0.15 },
                ]}
              />
            ))}
          </View>
          <Text style={styles.illustrationEmoji}>🏢</Text>
        </View>

        <Text style={styles.title}>OT en curso</Text>
        <Text style={styles.subtitle}>
          Residencial El Lago{"\n"}Calle Los Sauces, 345
        </Text>

        {/* Info pills */}
        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>INC-2025-0412</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Gotea techo pasillo</Text>
          </View>
        </View>

        {/* Steps */}
        {[
          { done: true, label: "OT aceptada" },
          { done: true, label: "Estimación enviada (155 €)" },
          { done: false, label: "Llegada confirmada" },
          { done: false, label: "Trabajo finalizado" },
        ].map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={[styles.stepDot, step.done && styles.stepDotDone]}>
              {step.done && <Text style={styles.stepCheck}>✓</Text>}
            </View>
            <Text style={[styles.stepLabel, step.done && styles.stepLabelDone]}>
              {step.label}
            </Text>
          </View>
        ))}

        <View style={{ flex: 1 }} />

        {/* CTA */}
        <TouchableOpacity
          style={[styles.arrivedButton, arrivedLoading && { opacity: 0.7 }]}
          onPress={handleArrived}
          disabled={arrivedLoading}
          activeOpacity={0.85}
        >
          {arrivedLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.arrivedButtonText}>📍 Ya estoy aquí</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navigateButton}
          onPress={() => Alert.alert("Navegación", "Abriendo maps...")}
        >
          <Text style={styles.navigateButtonText}>🗺️ Navegar hacia allá</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    alignItems: "center",
  },
  illustration: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 28,
  },
  illustrationEmoji: { fontSize: 36 },
  illustrationDots: { flexDirection: "row", gap: 5, alignItems: "center" },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#cbd5e1",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: DARK,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: MUTED,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
  },
  pillRow: { flexDirection: "row", gap: 8, marginBottom: 24, flexWrap: "wrap", justifyContent: "center" },
  pill: {
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pillText: { fontSize: 12, fontWeight: "600", color: MUTED },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    alignSelf: "stretch",
    marginBottom: 14,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BORDER,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotDone: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  stepCheck: { color: "#fff", fontSize: 12, fontWeight: "800" },
  stepLabel: { fontSize: 15, color: MUTED },
  stepLabelDone: { color: DARK, fontWeight: "600" },
  arrivedButton: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    alignSelf: "stretch",
    alignItems: "center",
    marginBottom: 10,
    shadowColor: PRIMARY,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  arrivedButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  navigateButton: {
    paddingVertical: 10,
  },
  navigateButtonText: { color: PRIMARY, fontSize: 14, fontWeight: "600" },
});
