/**
 * CompleteJobScreen — Proveedor
 *
 * Flujo:
 * 1. Proveedor toma foto final con cámara (obligatorio)
 * 2. Si hay conexión → envía inmediatamente a backend
 * 3. Si NO hay conexión (modo offline) → guarda en AsyncStorage
 * 4. Al recuperar la señal (NetInfo listener) → sube automáticamente los pendientes
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  AppState,
  AppStateStatus,
  TextInput,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { api } from "~/utils/api";
import { useMutation } from "@tanstack/react-query";

const PRIMARY = "#4aa19b";
const DARK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";

const OFFLINE_QUEUE_KEY = "aconvi_offline_complete_queue";
const DEMO_TENANT_ID = "org_aconvi_demo";

// ─── Offline queue types ───────────────────────────────────────────────────────
interface OfflineJob {
  id: string; // UUID local
  incidentId: string;
  providerId: string;
  tenantId: string;
  notes: string;
  photoUri: string; // uri local de la foto
  createdAt: number;
}

// ─── Helpers de la cola offline ───────────────────────────────────────────────
async function loadQueue(): Promise<OfflineJob[]> {
  const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveQueue(queue: OfflineJob[]): Promise<void> {
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

async function addToQueue(job: OfflineJob): Promise<void> {
  const queue = await loadQueue();
  queue.push(job);
  await saveQueue(queue);
}

async function removeFromQueue(id: string): Promise<void> {
  const queue = await loadQueue();
  await saveQueue(queue.filter((j) => j.id !== id));
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CompleteJobScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ incidentId?: string; providerId?: string }>();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const appState = useRef(AppState.currentState);

  // ─── tRPC mutation ────────────────────────────────────────────────────────
  const completeMutation = useMutation({
    ...api.incident.providerComplete.mutationOptions(),
    onSuccess: () => {
      router.push("/(proveedor)/job/done");
    },
    onError: (e: any) => {
      Alert.alert("Error al cerrar", e.message ?? "Inténtalo más tarde.");
    },
  });

  // ─── Sync offline queue ───────────────────────────────────────────────────
  const syncQueue = useCallback(async () => {
    const queue = await loadQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);
    let synced = 0;

    for (const job of queue) {
      try {
        await new Promise<void>((resolve, reject) => {
          completeMutation.mutate(
            {
              id: job.incidentId,
              tenantId: job.tenantId,
              providerId: job.providerId,
              completionNote: job.notes || "Trabajo completado offline",
              finalPhotoUrl: job.photoUri,
            },
            {
              onSuccess: () => resolve(),
              onError: (e: any) => reject(e),
            },
          );
        });
        await removeFromQueue(job.id);
        synced++;
      } catch {
        // si falla, la dejamos para el próximo intento
      }
    }

    const remaining = await loadQueue();
    setPendingCount(remaining.length);
    setIsSyncing(false);

    if (synced > 0) {
      Alert.alert(
        "✅ Sincronización completada",
        `Se enviaron ${synced} trabajo${synced > 1 ? "s" : ""} pendiente${synced > 1 ? "s" : ""}.`,
      );
    }
  }, [completeMutation]);

  // ─── NetInfo: detectar recuperación de conexión ───────────────────────────
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = !!state.isConnected && !!state.isInternetReachable;
      setIsOffline(!connected);
      if (connected) {
        // Intentar sincronizar cola al recuperar conexión
        void syncQueue();
      }
    });

    // Cargar conteo inicial de pendientes
    loadQueue().then((q) => setPendingCount(q.length));

    return () => unsubscribe();
  }, [syncQueue]);

  // ─── AppState: al volver al primer plano, intentar sync ──────────────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === "active") {
        void syncQueue();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [syncQueue]);

  const [photoBase64, setPhotoBase64] = useState<string | null>(null);

  // ─── Cámara ───────────────────────────────────────────────────────────────
  const handlePickPhoto = async (useCamera: boolean) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permiso requerido", "Necesitamos acceso para añadir la foto del trabajo.");
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
    Alert.alert("Foto del trabajo finalizado", "¿Cómo quieres añadir la foto?", [
      { text: "📷 Cámara", onPress: () => handlePickPhoto(true) },
      { text: "🖼️ Galería", onPress: () => handlePickPhoto(false) },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!photoUri || !photoBase64) {
      Alert.alert("Foto requerida", "Debes añadir una foto del trabajo terminado antes de cerrar.");
      return;
    }

    const incidentId = params.incidentId;
    const providerId = params.providerId;

    if (!incidentId || !providerId) {
      router.push("/(proveedor)/job/done");
      return;
    }

    if (isOffline) {
      // ── Modo offline: guardar en cola ──────────────────────────────────
      const job: OfflineJob = {
        id: `offline_${Date.now()}`,
        incidentId,
        providerId,
        tenantId: DEMO_TENANT_ID,
        notes: notes || "Trabajo completado",
        photoUri: photoBase64, // Guardamos la foto serializada en la cola offline
        createdAt: Date.now(),
      };
      await addToQueue(job);
      const newCount = (await loadQueue()).length;
      setPendingCount(newCount);

      Alert.alert(
        "📶 Guardado sin conexión",
        "Tu cierre de trabajo se ha guardado localmente. Se enviará automáticamente cuando recuperes señal.",
        [{ text: "OK", onPress: () => router.push("/(proveedor)/job/done") }],
      );
    } else {
      // ── Online: enviar directamente ──────────────────────────────────
      completeMutation.mutate({
        id: incidentId,
        tenantId: DEMO_TENANT_ID,
        providerId,
        completionNote: notes || "Trabajo completado satisfactoriamente",
        finalPhotoUrl: photoBase64,
      });
    }
  };

  const isLoading = completeMutation.isPending || isSyncing;

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Cerrar trabajo", headerBackTitle: "Regresar" }} />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Offline/sync banner */}
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>
              📵 Sin conexión — el cierre se guardará localmente
            </Text>
          </View>
        )}

        {!isOffline && pendingCount > 0 && (
          <TouchableOpacity style={styles.syncBanner} onPress={syncQueue} disabled={isSyncing}>
            <Text style={styles.syncBannerText}>
              {isSyncing
                ? "⏳ Sincronizando..."
                : `☁️ ${pendingCount} trabajo${pendingCount > 1 ? "s" : ""} pendiente${pendingCount > 1 ? "s" : ""} de subir. Pulsa para sincronizar.`}
            </Text>
          </TouchableOpacity>
        )}

        <Text style={styles.title}>Foto del trabajo finalizado</Text>
        <Text style={styles.subtitle}>
          El administrador validará el trabajo antes de cerrar el expediente.
        </Text>

        {/* Foto */}
        {!photoUri ? (
          <TouchableOpacity style={styles.photoPicker} onPress={showPhotoOptions} activeOpacity={0.7}>
            <Text style={styles.photoPickerEmoji}>📷</Text>
            <Text style={styles.photoPickerLabel}>Añadir foto del trabajo terminado</Text>
            <Text style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
              Obligatorio para cerrar la incidencia
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.photoPreviewContainer}>
            <Image source={{ uri: photoUri }} style={styles.photoPreviewImg} />
            <TouchableOpacity
              style={styles.changePhotoBtn}
              onPress={showPhotoOptions}
              activeOpacity={0.8}
            >
              <Text style={styles.changePhotoText}>📷 Cambiar foto</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Notas opcionales */}
        <TextInput
          style={styles.notesInput}
          placeholder="Añade notas sobre el trabajo realizado (opcional)..."
          placeholderTextColor="#94a3b8"
          multiline
          value={notes}
          onChangeText={setNotes}
          textAlignVertical="top"
          maxLength={500}
        />

        {/* Checklist */}
        <View style={styles.checklist}>
          <Text style={styles.checklistTitle}>Antes de enviar, confirma:</Text>
          {[
            "La avería está reparada correctamente",
            "La zona está limpia y ordenada",
            "La foto muestra claramente el trabajo terminado",
          ].map((item) => (
            <View key={item} style={styles.checkItem}>
              <Text style={{ color: PRIMARY, fontSize: 14, fontWeight: "700" }}>✓</Text>
              <Text style={styles.checkItemText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.submitButton, (!photoUri || isLoading) && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={!photoUri || isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {isOffline ? "💾 Guardar offline" : "✓ Marcar como finalizado"}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.offlineNote}>
          {isOffline
            ? "Sin conexión: se guardará localmente y se enviará automáticamente al recuperar señal."
            : "El vecino recibirá una notificación cuando valides el trabajo."}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  container: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  offlineBanner: {
    backgroundColor: "#fef3c7",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  offlineBannerText: { fontSize: 13, color: "#92400e", fontWeight: "600", textAlign: "center" },
  syncBanner: {
    backgroundColor: "#ecfdf5",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  syncBannerText: { fontSize: 13, color: "#065f46", fontWeight: "600", textAlign: "center" },
  title: { fontSize: 22, fontWeight: "800", color: DARK, marginBottom: 6, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: MUTED, lineHeight: 18, marginBottom: 20 },
  photoPicker: {
    borderWidth: 2,
    borderColor: BORDER,
    borderStyle: "dashed",
    borderRadius: 16,
    paddingVertical: 36,
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
    backgroundColor: "#f8fafc",
  },
  photoPickerEmoji: { fontSize: 44 },
  photoPickerLabel: { fontSize: 15, fontWeight: "700", color: DARK },
  photoPreviewContainer: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: PRIMARY,
  },
  photoPreviewImg: { width: "100%", height: 220 },
  changePhotoBtn: {
    backgroundColor: `${PRIMARY}15`,
    padding: 10,
    alignItems: "center",
  },
  changePhotoText: { fontSize: 13, color: PRIMARY, fontWeight: "600" },
  notesInput: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: DARK,
    minHeight: 80,
    marginBottom: 16,
  },
  checklist: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
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
    marginBottom: 12,
    shadowColor: PRIMARY,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  offlineNote: { fontSize: 11, color: MUTED, textAlign: "center", lineHeight: 16 },
});
