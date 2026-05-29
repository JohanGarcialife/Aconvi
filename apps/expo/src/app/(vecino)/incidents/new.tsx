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
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { api, queryClient } from "~/utils/api";
import { useMutation } from "@tanstack/react-query";

const PRIMARY = "#4aa19b";
const DARK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";
const BG = "#f8fafc";

const TENANT_ID = "org_aconvi_demo";

const CATEGORIES = [
  { id: "electricidad",  label: "Electricidad",       emoji: "⚡" },
  { id: "agua",          label: "Agua / Fontanería",   emoji: "💧" },
  { id: "acceso",        label: "Acceso / Cerrajería", emoji: "🔑" },
  { id: "limpieza",      label: "Limpieza",            emoji: "🧴" },
  { id: "ascensor",      label: "Ascensor",            emoji: "🛗" },
  { id: "jardineria",    label: "Jardinería",          emoji: "🌳" },
  { id: "ruidos",        label: "Ruidos / Molestias",  emoji: "🔊" },
  { id: "otro",          label: "Otro",                emoji: "❓" },
];

const PRIORITIES = [
  { id: "BAJA",    label: "Baja",    color: "#64748b", desc: "No es urgente" },
  { id: "MEDIA",   label: "Media",   color: "#3b82f6", desc: "Puede esperar unos días" },
  { id: "ALTA",    label: "Alta",    color: "#f97316", desc: "Requiere atención pronto" },
  { id: "URGENTE", label: "Urgente", color: "#ef4444", desc: "Peligro o sin servicio básico" },
];

export default function NewIncidentScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<string>("MEDIA");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [step, setStep] = useState<"category" | "details">("category");

  // ─── tRPC mutation ────────────────────────────────────────────────────────
  const createIncident = useMutation({
    ...api.incident.create.mutationOptions(),
    onSuccess: () => {
      // Invalidate so the incidents list and home dashboard refresh immediately
      void queryClient.invalidateQueries(api.incident.all.queryFilter());
      Alert.alert(
        "✅ Reporte enviado",
        "Tu incidencia ha sido enviada al administrador. Recibirás notificaciones sobre su estado.",
        [{ text: "Ver mis incidencias", onPress: () => router.replace("/(vecino)/incidents") }],
      );
    },
    onError: (e: any) => {
      Alert.alert("Error al enviar", e.message ?? "Inténtalo de nuevo.");
    },
  });

  // ─── Camera / Gallery ─────────────────────────────────────────────────────
  const handlePickPhoto = async (useCamera: boolean) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permiso denegado",
        `Necesitamos acceso a tu ${useCamera ? "cámara" : "galería"} para adjuntar la foto.`,
      );
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: "images",
          quality: 0.35,
          base64: true,
          allowsEditing: true,
          aspect: [4, 3],
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: "images",
          quality: 0.35,
          base64: true,
          allowsEditing: true,
          aspect: [4, 3],
        });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      if (result.assets[0].base64) {
        setPhotoBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    }
  };

  const showPhotoOptions = () => {
    Alert.alert("Añadir foto de la avería", "¿Cómo quieres añadir la foto?", [
      { text: "📷 Cámara", onPress: () => handlePickPhoto(true) },
      { text: "🖼️ Galería", onPress: () => handlePickPhoto(false) },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!selectedCategory) {
      Alert.alert("Categoría requerida", "Por favor indica qué tipo de incidencia es.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Descripción requerida", "Describe brevemente el problema.");
      return;
    }

    const catLabel = CATEGORIES.find((c) => c.id === selectedCategory)?.label ?? "Incidencia";
    const finalTitle = title.trim() || `${catLabel}: ${description.slice(0, 50)}`;

    createIncident.mutate({
      tenantId: TENANT_ID,
      title: finalTitle,
      description: description.trim(),
      category: selectedCategory,
      priority: selectedPriority as any,
      ...(photoBase64 ? { photoUrl: photoBase64 } : {}),
    });
  };

  const isLoading = createIncident.isPending;
  const selectedPriorityObj = PRIORITIES.find((p) => p.id === selectedPriority)!;

  // ─── STEP 1: Category selector ────────────────────────────────────────────
  if (step === "category") {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <Stack.Screen options={{ title: "Nueva incidencia", headerBackTitle: "Inicio" }} />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.pageTitle}>¿Qué tipo de problema es?</Text>
          <Text style={styles.pageSubtitle}>Selecciona la categoría que mejor lo describe</Text>

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
                  <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                  <Text style={[styles.categoryLabel, isSelected && styles.categoryLabelSelected]}>
                    {cat.label}
                  </Text>
                  {isSelected && (
                    <View style={styles.categoryCheck}>
                      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, !selectedCategory && styles.submitButtonDisabled]}
            onPress={() => selectedCategory && setStep("details")}
            disabled={!selectedCategory}
            activeOpacity={0.85}
          >
            <Text style={styles.submitButtonText}>Continuar →</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── STEP 2: Details ──────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <Stack.Screen options={{ title: "Detalles de la avería", headerBackTitle: "Categoría" }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Categoría seleccionada (chip) */}
        <TouchableOpacity onPress={() => setStep("category")} style={styles.catChip}>
          <Text style={styles.catChipText}>
            {CATEGORIES.find((c) => c.id === selectedCategory)?.emoji}{" "}
            {CATEGORIES.find((c) => c.id === selectedCategory)?.label}
          </Text>
          <Text style={{ fontSize: 11, color: PRIMARY }}> · Cambiar</Text>
        </TouchableOpacity>

        {/* Título opcional */}
        <Text style={styles.label}>Título (opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Gotera en el techo del ascensor"
          placeholderTextColor="#94a3b8"
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />

        {/* Descripción */}
        <Text style={styles.label}>Descripción <Text style={{ color: "#ef4444" }}>*</Text></Text>
        <TextInput
          style={styles.textArea}
          placeholder="Describe el problema con detalle: qué ocurre, dónde exactamente, desde cuándo..."
          placeholderTextColor="#94a3b8"
          multiline
          value={description}
          onChangeText={setDescription}
          textAlignVertical="top"
          maxLength={500}
        />
        <Text style={{ fontSize: 11, color: MUTED, marginBottom: 16, alignSelf: "flex-end" }}>
          {description.length}/500
        </Text>

        {/* Prioridad */}
        <Text style={styles.label}>Urgencia</Text>
        <View style={styles.priorityRow}>
          {PRIORITIES.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.priorityBtn,
                selectedPriority === p.id && { borderColor: p.color, backgroundColor: `${p.color}12` },
              ]}
              onPress={() => setSelectedPriority(p.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.priorityLabel, selectedPriority === p.id && { color: p.color }]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.priorityDesc, { color: selectedPriorityObj.color }]}>
          {selectedPriorityObj.desc}
        </Text>

        {/* Foto */}
        <Text style={styles.label}>Foto de la avería</Text>
        <TouchableOpacity
          style={[styles.photoBox, photoUri && styles.photoBoxFilled]}
          onPress={showPhotoOptions}
          activeOpacity={0.7}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photoPreview} />
          ) : (
            <>
              <Text style={{ fontSize: 32, marginBottom: 6 }}>📷</Text>
              <Text style={styles.photoLabel}>Añadir foto (opcional)</Text>
              <Text style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Cámara o galería</Text>
            </>
          )}
        </TouchableOpacity>

        {photoUri && (
          <TouchableOpacity
            onPress={() => { setPhotoUri(null); setPhotoBase64(null); }}
            style={{ marginBottom: 16, alignSelf: "flex-start" }}
          >
            <Text style={{ fontSize: 12, color: MUTED, textDecorationLine: "underline" }}>
              Eliminar foto
            </Text>
          </TouchableOpacity>
        )}

        {/* Enviar */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!description.trim() || isLoading) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!description.trim() || isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>📤 Enviar reporte</Text>
          )}
        </TouchableOpacity>

        <Text style={{ fontSize: 11, color: MUTED, textAlign: "center", marginTop: 8 }}>
          El administrador recibirá tu reporte y te notificará del avance.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  pageTitle: { fontSize: 24, fontWeight: "800", color: DARK, textAlign: "center", marginBottom: 6, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 13, color: MUTED, textAlign: "center", marginBottom: 24, lineHeight: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  categoryCard: {
    width: "47%",
    aspectRatio: 1.4,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  categoryCardSelected: { borderColor: PRIMARY, borderWidth: 2.5, backgroundColor: `${PRIMARY}08` },
  categoryEmoji: { fontSize: 28 },
  categoryLabel: { fontSize: 12, fontWeight: "600", color: MUTED, textAlign: "center" },
  categoryLabelSelected: { color: PRIMARY },
  categoryCheck: {
    position: "absolute", top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: PRIMARY,
    alignItems: "center", justifyContent: "center",
  },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${PRIMARY}10`,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  catChipText: { fontSize: 13, fontWeight: "700", color: PRIMARY },
  label: { fontSize: 13, fontWeight: "700", color: DARK, marginBottom: 6 },
  input: {
    backgroundColor: BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: DARK,
    marginBottom: 16,
  },
  textArea: {
    backgroundColor: BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: DARK,
    minHeight: 100,
    marginBottom: 4,
  },
  priorityRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  priorityBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: "center",
  },
  priorityLabel: { fontSize: 12, fontWeight: "700", color: MUTED },
  priorityDesc: { fontSize: 11, fontWeight: "600", marginBottom: 16 },
  photoBox: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderStyle: "dashed",
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    marginBottom: 8,
    minHeight: 120,
    overflow: "hidden",
  },
  photoBoxFilled: { borderColor: PRIMARY, backgroundColor: `${PRIMARY}08`, borderStyle: "solid", paddingVertical: 0, height: 180 },
  photoPreview: { width: "100%", height: "100%", borderRadius: 14 },
  photoLabel: { fontSize: 14, fontWeight: "600", color: MUTED },
  submitButton: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: PRIMARY,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginTop: 4,
  },
  submitButtonDisabled: { opacity: 0.45 },
  submitButtonText: { color: "#fff", fontSize: 17, fontWeight: "700", letterSpacing: 0.3 },
});
