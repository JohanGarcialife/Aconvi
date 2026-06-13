import { useState, useRef } from "react";
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
  Keyboard,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { api, queryClient } from "~/utils/api";
import { useMutation } from "@tanstack/react-query";

const sanitizeText = (str: string): string => {
  const map: Record<string, string> = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
    'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
    'ñ': 'n', 'Ñ': 'N',
    'ü': 'u', 'Ü': 'U'
  };
  return str.split('').map(c => map[c] || c).join('');
};

const PRIMARY = "#4aa19b";
const DARK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";
const BG = "#f8fafc";

const TENANT_ID = "org_aconvi_demo";

// ─── Categories — matching the client mockup (6 tiles) ────────────────────────
const CATEGORIES = [
  { id: "electricidad", label: "No funciona", icon: "⚡" },
  { id: "agua",         label: "Agua",         icon: "💧" },
  { id: "acceso",       label: "Acceso",        icon: "🔑" },
  { id: "limpieza",     label: "Limpieza",      icon: "🧹" },
  { id: "ruidos",       label: "Molestias",     icon: "🔊" },
  { id: "otro",         label: "Otro",          icon: "➕" },
];

export default function NewIncidentScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const descInputRef = useRef<TextInput>(null);

  // Subtle scale animation on category card press
  const scaleAnims = useRef(
    CATEGORIES.reduce(
      (acc, c) => ({ ...acc, [c.id]: new Animated.Value(1) }),
      {} as Record<string, Animated.Value>,
    ),
  ).current;

  const animatePressIn = (id: string) => {
    Animated.spring(scaleAnims[id]!, { toValue: 0.93, useNativeDriver: true, speed: 40 }).start();
  };
  const animatePressOut = (id: string) => {
    Animated.spring(scaleAnims[id]!, { toValue: 1, useNativeDriver: true, speed: 20 }).start();
  };

  // ─── tRPC mutation ──────────────────────────────────────────────────────────
  const resetForm = () => {
    setSelectedCategory(null);
    setDescription("");
    setPhotoUri(null);
    setPhotoBase64(null);
  };

  const createIncident = useMutation({
    ...api.incident.create.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries(api.incident.all.queryFilter());
      resetForm();
      router.replace("/(vecino)/incidents");
    },
    onError: (e: any) => {
      Alert.alert("Error al enviar", e.message ?? "Inténtalo de nuevo.");
    },
  });

  // ─── Camera / Gallery (no forced crop) ─────────────────────────────────────
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

    // Do NOT request base64 from image picker directly (prevents OOM crashes with high-res cameras)
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: "images",
          allowsEditing: false, // ← no crop
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: "images",
          allowsEditing: false, // ← no crop
        });

    if (!result.canceled && result.assets[0]) {
      try {
        // Manipulate image: resize to max width of 1000px and compress to 0.7
        const manipResult = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 1000 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        setPhotoUri(manipResult.uri);
        if (manipResult.base64) {
          setPhotoBase64(`data:image/jpeg;base64,${manipResult.base64}`);
        }
      } catch (error) {
        console.error("Error manipulating image:", error);
        // Fallback
        setPhotoUri(result.assets[0].uri);
        if (result.assets[0].base64) {
          setPhotoBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
        }
      }
    }
  };

  const showPhotoOptions = () => {
    Keyboard.dismiss();
    Alert.alert("Añadir foto", "¿Cómo quieres adjuntar la foto?", [
      { text: "📷 Cámara", onPress: () => handlePickPhoto(true) },
      { text: "🖼️ Galería", onPress: () => handlePickPhoto(false) },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  // ─── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!selectedCategory) return;

    const catLabel = CATEGORIES.find((c) => c.id === selectedCategory)?.label ?? "Incidencia";
    const cleanDesc = sanitizeText(description.trim());
    const finalTitle = cleanDesc
      ? `${catLabel}: ${cleanDesc.slice(0, 60)}`
      : `${catLabel} reportada`;
    const finalDescription = cleanDesc || catLabel;

    createIncident.mutate({
      tenantId: TENANT_ID,
      title: finalTitle,
      description: finalDescription,
      category: selectedCategory,
      priority: "MEDIA",
      ...(photoBase64 ? { photoUrl: photoBase64 } : {}),
    });
  };

  const isLoading = createIncident.isPending;
  const canSubmit = !!selectedCategory && !isLoading;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
      </View>

      {/* KeyboardAvoidingView ensures the scroll content rises above the keyboard */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Title ──────────────────────────────────────────────────────── */}
        <Text style={styles.pageTitle}>¿Qué ocurre?</Text>

        {/* ── Category grid (2×3) ────────────────────────────────────────── */}
        <View style={styles.grid}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <Animated.View
                key={cat.id}
                style={[styles.categoryCardWrap, { transform: [{ scale: scaleAnims[cat.id]! }] }]}
              >
                <TouchableOpacity
                  style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                  onPress={() => setSelectedCategory(cat.id)}
                  onPressIn={() => animatePressIn(cat.id)}
                  onPressOut={() => animatePressOut(cat.id)}
                  activeOpacity={1}
                >
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text style={[styles.categoryLabel, isSelected && styles.categoryLabelSelected]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {/* ── Photo button ───────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.photoRow} onPress={showPhotoOptions} activeOpacity={0.7}>
          {photoUri ? (
            <View style={styles.photoThumbWrap}>
              <Image source={{ uri: photoUri }} style={styles.photoThumb} />
              <TouchableOpacity
                style={styles.photoRemoveBtn}
                onPress={() => { setPhotoUri(null); setPhotoBase64(null); }}
                hitSlop={8}
              >
                <Text style={styles.photoRemoveText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.photoCameraIcon}>📷</Text>
              <Text style={styles.photoRowLabel}>Añadir foto</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── Description ────────────────────────────────────────────────── */}
        <TextInput
          ref={descInputRef}
          style={styles.descInput}
          placeholder="Añade detalles o indica ubicación exacta..."
          placeholderTextColor="#94a3b8"
          multiline
          value={description}
          onChangeText={setDescription}
          textAlignVertical="top"
          maxLength={300}
          returnKeyType="done"
          blurOnSubmit
          onFocus={() => {
            // Scroll down so the input is fully visible above the keyboard
            setTimeout(() => {
              scrollRef.current?.scrollToEnd({ animated: true });
            }, 150);
          }}
        />

        {/* ── Submit ─────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.88}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Enviar reporte</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },

  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: { fontSize: 18, color: DARK, fontWeight: "700", lineHeight: 22 },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },

  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: DARK,
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 24,
  },

  // ── Grid ──────────────────────────────────────────────────────────────────
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  categoryCardWrap: {
    width: "47%",
  },
  categoryCard: {
    aspectRatio: 1.3,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  categoryCardSelected: {
    borderColor: PRIMARY,
    borderWidth: 2.5,
    backgroundColor: `${PRIMARY}08`,
  },
  categoryIcon: { fontSize: 30 },
  categoryLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: MUTED,
    textAlign: "center",
  },
  categoryLabelSelected: { color: PRIMARY },

  // ── Photo ──────────────────────────────────────────────────────────────────
  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG,
    marginBottom: 14,
  },
  photoCameraIcon: { fontSize: 26 },
  photoRowLabel: { fontSize: 15, fontWeight: "600", color: MUTED },

  photoThumbWrap: {
    position: "relative",
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: "visible",
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  photoRemoveBtn: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  photoRemoveText: { color: "#fff", fontSize: 11, fontWeight: "800" },

  // ── Description ────────────────────────────────────────────────────────────
  descInput: {
    backgroundColor: BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: DARK,
    minHeight: 56,
    marginBottom: 20,
    lineHeight: 22,
  },

  // ── Submit ─────────────────────────────────────────────────────────────────
  submitBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: PRIMARY,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
