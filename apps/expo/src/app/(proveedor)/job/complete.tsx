import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { api } from "~/utils/api";
import { useMutation } from "@tanstack/react-query";

const PRIMARY = "#4aa19b";
const DARK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";

// ─── Simple in-memory offline queue (replace with SQLite in production) ───────
// In production: use expo-sqlite to persist pending uploads
// CREATE TABLE pending_uploads (id TEXT PRIMARY KEY, incident_id TEXT, photo_uri TEXT, notes TEXT, status TEXT, created_at INTEGER)
interface PendingUpload {
  id: string;
  incidentId: string;
  photoUri: string;
  notes: string;
  status: "pending" | "uploading" | "done" | "failed";
  createdAt: number;
}

let offlineQueue: PendingUpload[] = [];

async function tryUploadQueue(onSuccess: () => void) {
  const pending = offlineQueue.filter((u) => u.status === "pending");
  for (const upload of pending) {
    upload.status = "uploading";
    try {
      // In production: POST to /api/trpc/incident.submitResult
      await new Promise((r) => setTimeout(r, 600));
      upload.status = "done";
      onSuccess();
    } catch {
      upload.status = "failed";
    }
  }
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function CompleteJobScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ incidentId?: string; providerId?: string }>();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isOffline, setIsOffline] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const appState = useRef(AppState.currentState);

  const DEMO_TENANT_ID = "org_aconvi_demo";

  const completeMutation = useMutation({
    ...api.incident.providerComplete.mutationOptions(),
    onSuccess: () => {
      router.push("/(proveedor)/job/done");
    },
    onError: (e: any) => Alert.alert("Error al cerrar", e.message),
  });

  // Listen for app coming back to foreground → drain offline queue
  useEffect(() => {
    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, []);

  const handleAppStateChange = (nextState: AppStateStatus) => {
    if (
      appState.current.match(/inactive|background/) &&
      nextState === "active"
    ) {
      // App came to foreground — attempt to sync queue
      void tryUploadQueue(() => {
        setQueueCount((c) => Math.max(0, c - 1));
        Alert.alert("Sincronización ✓", "Fotos enviadas al servidor correctamente.");
      });
    }
    appState.current = nextState;
  };

  const handleTakePhoto = async () => {
    // In production: use expo-image-picker or expo-camera
    // const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    setPhotoUri("mock://photo-taken");
    Alert.alert("Foto tomada", "Foto del trabajo terminado capturada.");
  };

  const handlePickPhoto = async () => {
    setPhotoUri("mock://photo-gallery");
    Alert.alert("Foto seleccionada", "Foto del trabajo terminado seleccionada.");
  };

  const handleSubmit = async () => {
    if (!photoUri) {
      Alert.alert("Foto requerida", "Debes añadir una foto del trabajo terminado.");
      return;
    }

    const incidentId = params.incidentId;
    const providerId = params.providerId;

    if (!incidentId || !providerId) {
      // No IDs – still navigate (demo fallback)
      router.push("/(proveedor)/job/done");
      return;
    }

    completeMutation.mutate({
      id: incidentId,
      tenantId: DEMO_TENANT_ID,
      providerId,
      completionNote: notes || "Trabajo completado satisfactoriamente",
    } as any);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <Stack.Screen
        options={{ title: "Trabajo finalizado", headerBackTitle: "Regresar" }}
      />

      <View style={styles.container}>
        {/* Offline badge */}
        {(isOffline || queueCount > 0) && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>
              📶 {queueCount} foto{queueCount !== 1 ? "s" : ""} pendiente
              {queueCount !== 1 ? "s" : ""} de sync
            </Text>
          </View>
        )}

        <Text style={styles.title}>Subir foto del trabajo</Text>
        <Text style={styles.subtitle}>
          El administrador validará el trabajo antes de cerrar el expediente.
        </Text>

        {/* Photo state */}
        {!photoUri ? (
          <View style={styles.photoPicker}>
            <Text style={styles.photoPickerEmoji}>📷</Text>
            <Text style={styles.photoPickerLabel}>Añadir foto del trabajo</Text>
            <View style={styles.photoButtonRow}>
              <TouchableOpacity
                style={styles.photoButton}
                onPress={handleTakePhoto}
              >
                <Text style={styles.photoButtonText}>📸 Cámara</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoButton, styles.photoButtonSecondary]}
                onPress={handlePickPhoto}
              >
                <Text style={[styles.photoButtonText, { color: PRIMARY }]}>
                  🖼️ Galería
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.photoPreview}>
            <Text style={{ fontSize: 48 }}>✅</Text>
            <Text style={styles.photoPreviewLabel}>Foto lista para enviar</Text>
            <TouchableOpacity onPress={() => setPhotoUri(null)}>
              <Text style={styles.changePhotoText}>Cambiar foto</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Checklist */}
        <View style={styles.checklist}>
          <Text style={styles.checklistTitle}>Antes de enviar, confirma:</Text>
          {[
            "La avería está reparada correctamente",
            "La zona está limpia y ordenada",
            "El vecino no tiene más incidencias",
          ].map((item) => (
            <View key={item} style={styles.checkItem}>
              <Text style={{ color: PRIMARY, fontSize: 14 }}>✓</Text>
              <Text style={styles.checkItemText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        {/* CTA */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!photoUri || completeMutation.isPending) && { opacity: 0.5 },
          ]}
          onPress={handleSubmit}
          disabled={!photoUri || completeMutation.isPending}
          activeOpacity={0.85}
        >
          {completeMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>
              ✓ Marcar como finalizado
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.offlineNote}>
          Si no hay conexión, la foto se guardará y se enviará
          automáticamente cuando recuperes señal.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  offlineBanner: {
    backgroundColor: "#fef3c7",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  offlineBannerText: {
    fontSize: 13,
    color: "#92400e",
    fontWeight: "600",
    textAlign: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: DARK,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: MUTED,
    lineHeight: 20,
    marginBottom: 20,
  },
  photoPicker: {
    borderWidth: 2,
    borderColor: BORDER,
    borderStyle: "dashed",
    borderRadius: 16,
    paddingVertical: 32,
    alignItems: "center",
    marginBottom: 20,
    gap: 8,
    backgroundColor: "#f8fafc",
  },
  photoPickerEmoji: { fontSize: 40 },
  photoPickerLabel: { fontSize: 15, fontWeight: "600", color: MUTED },
  photoButtonRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  photoButton: {
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  photoButtonSecondary: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: PRIMARY,
  },
  photoButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  photoPreview: {
    borderWidth: 2,
    borderColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 28,
    alignItems: "center",
    backgroundColor: `${PRIMARY}08`,
    marginBottom: 20,
    gap: 6,
  },
  photoPreviewLabel: { fontSize: 15, fontWeight: "700", color: DARK },
  changePhotoText: { fontSize: 13, color: MUTED, textDecorationLine: "underline", marginTop: 4 },
  checklist: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  checklistTitle: { fontSize: 13, fontWeight: "700", color: DARK, marginBottom: 10 },
  checkItem: { flexDirection: "row", gap: 10, marginBottom: 8, alignItems: "flex-start" },
  checkItemText: { fontSize: 13, color: MUTED, flex: 1, lineHeight: 18 },
  submitButton: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 10,
    shadowColor: PRIMARY,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  offlineNote: {
    fontSize: 11,
    color: MUTED,
    textAlign: "center",
    lineHeight: 16,
  },
});
