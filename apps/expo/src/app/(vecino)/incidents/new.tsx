import { useState, useRef, useEffect } from "react";
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
import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import { api, queryClient } from "~/utils/api";
import { authClient } from "~/utils/auth";
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
  { id: "electricidad", label: "Instalaciones", icon: "⚡" },
  { id: "agua",         label: "Agua",         icon: "💧" },
  { id: "acceso",       label: "Acceso",        icon: "🔑" },
  { id: "limpieza",     label: "Limpieza",      icon: "🧹" },
  { id: "ruidos",       label: "Molestias",     icon: "🔊" },
  { id: "otro",         label: "Otro",          icon: "➕" },
];

export default function NewIncidentScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync("expo_user_id").then((id) => {
      if (id) {
        setUserId(id);
        console.log("[NewIncidentScreen] Loaded user ID:", id);
      }
    }).catch(err => {
      console.warn("[NewIncidentScreen] Failed to load user ID from SecureStore:", err);
    });
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState(false); // Bug 2: track missing-category error
  const [description, setDescription] = useState("");
  // Store only the local file URI in state — never the base64 string.
  // The base64 is read from disk only right before the API call.
  // This prevents react-query-persist-client from serializing a 10MB+
  // base64 string into AsyncStorage and OOM-crashing the bridge.
  const [photoUri, setPhotoUri] = useState<string | null>(null);
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
  };

  const createIncident = useMutation({
    ...api.incident.create.mutationOptions(),
    onSuccess: (created) => {
      // Inject the new incident at the top of the cache immediately —
      // the user sees it the instant they land on the list, no waiting for refetch.
      const queryKey = api.incident.all.queryOptions({ tenantId: TENANT_ID }).queryKey;
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!Array.isArray(old)) return old;
        const optimistic = { ...created, reporter: null, provider: null, notes: [], history: [] };
        return [optimistic, ...old];
      });
      resetForm();
      // Navigate directly to the new incident's detail so photo and data
      // load immediately from the byId query — no waiting for list refresh.
      router.replace(`/(vecino)/incidents/${created.id}` as any);
      // Background sync to fill relations (reporter, provider, history…)
      void queryClient.invalidateQueries(api.incident.all.queryFilter());
    },
    onError: (e: any) => {
      // Bug 3: "JSON Parse error: Unexpected character: o" means the server returned
      // a non-JSON response (e.g. plain text "ok" or HTML error page).
      // Treat parse errors as a transient network/server issue with a user-friendly message.
      const msg: string = e?.message ?? "";
      const isParseError = msg.toLowerCase().includes("json") || msg.toLowerCase().includes("parse") || msg.toLowerCase().includes("unexpected");
      if (isParseError) {
        Alert.alert(
          "Error de conexión",
          "Ocurrió un problema al comunicarse con el servidor. Por favor, verifica tu conexión e inténtalo de nuevo.",
        );
      } else {
        Alert.alert("Error al enviar", msg || "Inténtalo de nuevo.");
      }
    },
  });

  // ─── Camera / Gallery ─────────────────────────────────────────────────────────
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

    // Pick photo without requesting base64 — avoids OOM in native bridge
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: "images", allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", allowsEditing: false });

    if (!result.canceled && result.assets[0]) {
      // Bug 1: Show preview INSTANTLY with the original URI so the user sees
      // the photo immediately. Then compress in the background — the URI in
      // state is updated silently once compression finishes, so the final
      // upload always uses the small file but the user perceives zero wait.
      const originalUri = result.assets[0].uri;
      setPhotoUri(originalUri); // ← instant preview

      // Compress in background (no await blocks the UI)
      ImageManipulator.manipulateAsync(
        originalUri,
        [{ resize: { width: 500 } }],
        { compress: 0.3, format: ImageManipulator.SaveFormat.JPEG },
      )
        .then((manipResult) => {
          // Silently swap to the compressed file URI; thumbnail stays the same size
          setPhotoUri(manipResult.uri);
        })
        .catch((err) => {
          // Compression failed — keep original URI, size will be larger but not blocking
          console.warn("Background compression failed, using original:", err);
        });
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
  const handleSubmit = async () => {
    // Bug 2: show explicit error when category is missing instead of silent no-op
    if (!selectedCategory) {
      setCategoryError(true);
      Alert.alert(
        "Categoría requerida",
        "Por favor selecciona una categoría antes de enviar el reporte.",
      );
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setCategoryError(false);

    const catLabel = CATEGORIES.find((c) => c.id === selectedCategory)?.label ?? "Incidencia";
    const cleanDesc = sanitizeText(description.trim());
    const finalTitle = cleanDesc
      ? `${catLabel}: ${cleanDesc.slice(0, 60)}`
      : `${catLabel} reportada`;
    const finalDescription = cleanDesc || catLabel;

    // Read base64 from disk ONLY at submit time — never stored in React state
    // or React Query cache to avoid OOM when persist-client serializes to AsyncStorage.
    let photoUrl: string | undefined;
    if (photoUri) {
      try {
        const b64 = await FileSystem.readAsStringAsync(photoUri, {
          encoding: "base64" as const,
        });
        photoUrl = `data:image/jpeg;base64,${b64}`;
      } catch (err) {
        console.warn("Could not read photo file:", err);
      }
    }

    createIncident.mutate({
      tenantId: TENANT_ID,
      title: finalTitle,
      description: finalDescription,
      category: selectedCategory,
      priority: "MEDIA",
      ...(photoUrl ? { photoUrl } : {}),
      ...(userId ? { reporterId: userId } : {}),
    });
  };

  const isLoading = createIncident.isPending;
  const canSubmit = !!selectedCategory && description.trim().length > 0 && !isLoading;

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

        {/* ── Category grid (2×3) ─────────────────────────────────────────────── */}
        {/* Persistent hint — visible whenever no category is selected */}
        {!selectedCategory && (
          <Text style={styles.categoryHintText}>
            📂 Selecciona una categoría para continuar.
          </Text>
        )}
        {/* Error hint shown only after failed submit attempt */}
        {categoryError && !selectedCategory && (
          <Text style={styles.categoryErrorText}>⚠️ Selecciona una categoría</Text>
        )}
        <View style={[styles.grid, categoryError && !selectedCategory && styles.gridError]}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <Animated.View
                key={cat.id}
                style={[styles.categoryCardWrap, { transform: [{ scale: scaleAnims[cat.id]! }] }]}
              >
                <TouchableOpacity
                  style={[
                    styles.categoryCard,
                    isSelected && styles.categoryCardSelected,
                    categoryError && !selectedCategory && !isSelected && styles.categoryCardError,
                  ]}
                  onPress={() => {
                    setSelectedCategory(cat.id);
                    setCategoryError(false); // clear error on selection
                  }}
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
                onPress={() => { setPhotoUri(null); }}
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
          placeholder="Describe el problema (obligatorio)..."
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

        {/* ── Submit ────────────────────────────────────────────────── */}
        {!canSubmit && !isLoading && (
          <Text style={styles.submitHintText}>
            {!selectedCategory ? "Selecciona una categoría para continuar." : "Añade una descripción para continuar."}
          </Text>
        )}
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
  // Bug 2: error state styles for category grid
  gridError: {
    // subtle shake effect handled via Alert; border handled per-card
  },
  categoryCardError: {
    borderColor: "#f87171",
    borderWidth: 1.5,
  },
  categoryErrorText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  categoryHintText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
    opacity: 0.8,
  },
  submitHintText: {
    color: MUTED,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 8,
    fontStyle: "italic",
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
