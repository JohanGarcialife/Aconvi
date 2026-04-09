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
import { useLocalSearchParams, useRouter, Stack } from "expo-router";

const PRIMARY = "#4aa19b";
const DARK = "#0f172a";
const MUTED = "#64748b";

export default function RatingScreen() {
  const { incidentId } = useLocalSearchParams<{ incidentId: string }>();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const displayRating = hovered || rating;

  const LABELS: Record<number, string> = {
    1: "Muy malo 😞",
    2: "Malo 😕",
    3: "Regular 😐",
    4: "Bueno 😊",
    5: "Excelente 🌟",
  };

  const handleSubmit = async () => {
    if (!rating) {
      Alert.alert("Selecciona una valoración");
      return;
    }
    setSubmitting(true);
    // In production: trpc.incident.submitRating.mutate({ incidentId, rating, comment })
    await new Promise((r) => setTimeout(r, 900));
    setSubmitting(false);
    setDone(true);
  };

  if (done) {
    return (
      <SafeAreaView style={s.safe} edges={["bottom"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.doneContainer}>
          <View style={s.doneIcon}>
            <Text style={{ fontSize: 48 }}>🎉</Text>
          </View>
          <Text style={s.doneTitle}>¡Gracias por tu valoración!</Text>
          <Text style={s.doneSub}>
            Tu opinión ayuda a mejorar el servicio de tu comunidad.
          </Text>
          {/* Stars summary */}
          <View style={s.starSummaryRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Text
                key={i}
                style={{ fontSize: 32, color: i <= rating ? "#f59e0b" : "#e2e8f0" }}
              >
                ★
              </Text>
            ))}
          </View>
          <TouchableOpacity
            style={s.doneButton}
            onPress={() => router.replace("/(vecino)")}
          >
            <Text style={s.doneButtonText}>Volver al inicio</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "Valorar servicio",
          headerBackTitle: "Incidencia",
        }}
      />

      <View style={s.container}>
        {/* Icon */}
        <View style={s.iconWrap}>
          <Text style={{ fontSize: 44 }}>⭐</Text>
        </View>

        <Text style={s.title}>¿Cómo fue el servicio?</Text>
        <Text style={s.subtitle}>
          Incidencia {incidentId ?? "#1"} · Fontanería Pérez
        </Text>

        {/* Stars */}
        <View style={s.starsRow}>
          {[1, 2, 3, 4, 5].map((i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setRating(i)}
              onPressIn={() => setHovered(i)}
              onPressOut={() => setHovered(0)}
              activeOpacity={0.8}
              style={{ padding: 4 }}
            >
              <Text
                style={{
                  fontSize: 44,
                  color: i <= displayRating ? "#f59e0b" : "#e2e8f0",
                }}
              >
                ★
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Label */}
        <Text style={s.ratingLabel}>
          {displayRating ? LABELS[displayRating] : "Toca para valorar"}
        </Text>

        {/* Quick comments */}
        <View style={s.tagsRow}>
          {["Puntual", "Trabajo limpio", "Explicó bien", "Precio justo"].map((tag) => (
            <TouchableOpacity
              key={tag}
              style={[s.tag, comment === tag && s.tagActive]}
              onPress={() => setComment((c) => (c === tag ? "" : tag))}
            >
              <Text style={[s.tagText, comment === tag && s.tagTextActive]}>
                {tag}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        {/* Submit */}
        <TouchableOpacity
          style={[s.submitButton, (!rating || submitting) && { opacity: 0.45 }]}
          onPress={handleSubmit}
          disabled={!rating || submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.submitText}>Enviar valoración</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={s.skipButton} onPress={() => router.back()}>
          <Text style={s.skipText}>Ahora no</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 28,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#fef9c3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: DARK,
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  subtitle: { fontSize: 13, color: MUTED, marginBottom: 24 },
  starsRow: { flexDirection: "row", gap: 4, marginBottom: 12 },
  ratingLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: MUTED,
    marginBottom: 24,
    height: 22,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  tagActive: { borderColor: PRIMARY, backgroundColor: `${PRIMARY}12` },
  tagText: { fontSize: 13, fontWeight: "600", color: MUTED },
  tagTextActive: { color: PRIMARY },
  submitButton: {
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
  submitText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  skipButton: { paddingVertical: 10 },
  skipText: { fontSize: 13, color: MUTED },
  // Done state
  doneContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  doneIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#d1fae5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  doneTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: DARK,
    marginBottom: 8,
    textAlign: "center",
  },
  doneSub: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  starSummaryRow: { flexDirection: "row", gap: 4, marginBottom: 32 },
  doneButton: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 36,
    alignSelf: "stretch",
    alignItems: "center",
  },
  doneButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
