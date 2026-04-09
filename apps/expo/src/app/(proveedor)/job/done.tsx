import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";

const PRIMARY = "#4aa19b";
const DARK = "#0f172a";
const MUTED = "#64748b";

export default function JobDoneScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>✅</Text>
        </View>
        <Text style={styles.title}>¡Trabajo enviado!</Text>
        <Text style={styles.subtitle}>
          El administrador de fincas revisará tu trabajo y lo validará.
          Recibirás una notificación cuando el expediente esté cerrado.
        </Text>

        {/* Summary */}
        <View style={styles.summaryCard}>
          {[
            ["Incidencia", "INC-2025-0412"],
            ["Comunidad", "Residencial El Lago"],
            ["Total estimado", "155 €"],
            ["Estado", "Pendiente de validación"],
          ].map(([label, value]) => (
            <View key={label} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{label}</Text>
              <Text style={styles.summaryValue}>{value}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.dismissAll()}
        >
          <Text style={styles.backButtonText}>← Volver al inicio</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  container: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 48,
    paddingBottom: 32,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: `${PRIMARY}15`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  icon: { fontSize: 44 },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: DARK,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  summaryCard: {
    alignSelf: "stretch",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    marginBottom: 32,
    gap: 10,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontSize: 13, color: MUTED, fontWeight: "500" },
  summaryValue: { fontSize: 13, color: DARK, fontWeight: "700" },
  backButton: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 36,
    alignSelf: "stretch",
    alignItems: "center",
  },
  backButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
