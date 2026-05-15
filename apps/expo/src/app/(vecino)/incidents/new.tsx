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
import { api } from "~/utils/api";
import { useMutation } from "@tanstack/react-query";

const PRIMARY = "#4aa19b";
const DARK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";
const BG = "#f8fafc";

// Tenant demo — en producción vendría de la sesión del usuario
const TENANT_ID = "org_aconvi_demo";

const CATEGORIES = [
  { id: "electricidad", label: "Electricidad", emoji: "⚡" },
  { id: "agua", label: "Agua / Fontanería", emoji: "💧" },
  { id: "acceso", label: "Acceso / Cerrajería", emoji: "🔑" },
  { id: "limpieza", label: "Limpieza", emoji: "🧴" },
  { id: "ruidos", label: "Ruidos / Molestias", emoji: "🔊" },
  { id: "otro", label: "Otro", emoji: "❓" },
];

export default function NewIncidentScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);

  // ─── tRPC mutation ────────────────────────────────────────────────────────
  const createIncident = useMutation({
    ...api.incident.create.mutationOptions(),
    onSuccess: () => {
      Alert.alert(
        "✅ Reporte enviado",
        "Tu incidencia ha sido enviada al administrador. Recibirás notificaciones sobre su estado.",
        [{ text: "OK", onPress: () => router.back() }],
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
          quality: 0.3,
          base64: true,
          allowsEditing: true,
          aspect: [4, 3],
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: "images",
          quality: 0.3,
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
    Alert.alert("Añadir foto", "¿Cómo quieres añadir la foto?", [
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

    createIncident.mutate({
      tenantId: TENANT_ID,
      title: `${CATEGORIES.find((c) => c.id === selectedCategory)?.label ?? "Incidencia"}: ${description.slice(0, 60)}`,
      description: description.trim(),
      category: selectedCategory,
      ...(photoBase64 ? { photoUrl: photoBase64 } : {}),
    });
  };

  const isLoading = createIncident.isPending;

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "Nueva incidencia",
          headerShown: true,
          headerBackTitle: "Inicio",
        }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.pageTitle}>¿Qué ocurre?</Text>
        <Text style={styles.pageSubtitle}>
          El administrador recibirá tu reporte y te actualizará del estado.
        </Text>

        {/* Categorías */}
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
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Foto */}
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
              <Text style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                Cámara o galería
              </Text>
            </>
          )}
        </TouchableOpacity>

        {photoUri && (
          <TouchableOpacity onPress={() => setPhotoUri(null)} style={{ marginBottom: 12, alignSelf: "flex-start" }}>
            <Text style={{ fontSize: 12, color: MUTED, textDecorationLine: "underline" }}>
              Eliminar foto
            </Text>
          </TouchableOpacity>
        )}

        {/* Descripción */}
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

        {/* Enviar */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!selectedCategory || !description.trim() || isLoading) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!selectedCategory || !description.trim() || isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>📤 Enviar reporte</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: DARK,
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 18,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  categoryCard: {
    width: "47%",
    aspectRatio: 1.5,
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
  categoryCardSelected: {
    borderColor: PRIMARY,
    borderWidth: 2,
    backgroundColor: `${PRIMARY}08`,
  },
  categoryEmoji: { fontSize: 28 },
  categoryLabel: { fontSize: 12, fontWeight: "600", color: MUTED, textAlign: "center" },
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
    marginBottom: 8,
    minHeight: 120,
    overflow: "hidden",
  },
  photoBoxFilled: {
    borderColor: PRIMARY,
    backgroundColor: `${PRIMARY}08`,
    borderStyle: "solid",
    paddingVertical: 0,
    height: 180,
  },
  photoPreview: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  photoLabel: { fontSize: 14, fontWeight: "600", color: MUTED },
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
  },
  submitButtonDisabled: { opacity: 0.45 },
  submitButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
