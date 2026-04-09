import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";

const PRIMARY = "#4aa19b";
const DARK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";
const BG = "#f8fafc";

// ─── Category data ────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "no_funciona", label: "No funciona", emoji: "⚡" },
  { id: "agua", label: "Agua", emoji: "💧" },
  { id: "acceso", label: "Acceso", emoji: "🔑" },
  { id: "limpieza", label: "Limpieza", emoji: "🧴" },
  { id: "molestias", label: "Molestias", emoji: "🔊" },
  { id: "otro", label: "Otro", emoji: "+" },
];

export default function NewIncidentScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [hasPhoto, setHasPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddPhoto = () => {
    // In production: use expo-image-picker
    setHasPhoto(true);
    Alert.alert("Foto añadida", "Foto de prueba seleccionada correctamente.");
  };

  const handleSubmit = async () => {
    if (!selectedCategory) {
      Alert.alert("Selecciona una categoría", "Por favor indica qué tipo de incidencia es.");
      return;
    }
    setIsSubmitting(true);
    // In production: call trpc.incident.create.mutate(...)
    await new Promise((r) => setTimeout(r, 1200));
    setIsSubmitting(false);
    Alert.alert(
      "Reporte enviado ✓",
      "Tu incidencia ha sido enviada al administrador de la finca.",
      [{ text: "OK", onPress: () => router.back() }]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "",
          headerShown: true,
          headerBackTitle: "Inicio",
        }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.pageTitle}>¿Qué ocurre?</Text>

        {/* Category grid */}
        <View style={styles.grid}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                onPress={() => setSelectedCategory(cat.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.categoryEmoji, isSelected && { color: PRIMARY }]}>
                  {cat.emoji}
                </Text>
                <Text style={[styles.categoryLabel, isSelected && styles.categoryLabelSelected]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Photo picker */}
        <TouchableOpacity
          style={[styles.photoBox, hasPhoto && styles.photoBoxFilled]}
          onPress={handleAddPhoto}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 32, marginBottom: 6 }}>
            {hasPhoto ? "✅" : "📷"}
          </Text>
          <Text style={[styles.photoLabel, hasPhoto && { color: PRIMARY }]}>
            {hasPhoto ? "Foto añadida" : "Añadir foto"}
          </Text>
        </TouchableOpacity>

        {/* Description */}
        <TextInput
          style={styles.textArea}
          placeholder="Añade detalles o indica ubicación exacta..."
          placeholderTextColor="#94a3b8"
          multiline
          value={description}
          onChangeText={setDescription}
          textAlignVertical="top"
        />

        {/* Submit */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!selectedCategory || isSubmitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!selectedCategory || isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Enviar reporte</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: DARK,
    textAlign: "center",
    marginBottom: 28,
    letterSpacing: -0.5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  categoryCard: {
    width: "47%",
    aspectRatio: 1.4,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  categoryCardSelected: {
    borderColor: PRIMARY,
    borderWidth: 2,
    backgroundColor: `${PRIMARY}08`,
  },
  categoryEmoji: { fontSize: 32, color: MUTED },
  categoryLabel: { fontSize: 14, fontWeight: "600", color: MUTED },
  categoryLabelSelected: { color: PRIMARY },
  photoBox: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderStyle: "dashed",
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    marginBottom: 16,
  },
  photoBoxFilled: {
    borderColor: PRIMARY,
    backgroundColor: `${PRIMARY}08`,
    borderStyle: "solid",
  },
  photoLabel: { fontSize: 15, fontWeight: "600", color: MUTED },
  textArea: {
    backgroundColor: BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: DARK,
    minHeight: 80,
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
