import { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  PanResponder,
  Animated,
  useWindowDimensions,
  Modal,
  Dimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "~/utils/safe-netinfo";
import { api, queryClient } from "~/utils/api";
import { useMutation } from "@tanstack/react-query";

const OFFLINE_ESTIMATE_QUEUE_KEY = "aconvi_offline_estimate_queue";

interface OfflineEstimate {
  id: string;
  incidentId: string;
  providerId: string;
  tenantId: string;
  estimatedCost: number;
  estimatedDays: number;
  notes: string;
  scheduledAt?: string;
  estimatedDuration?: string;
  createdAt: number;
}

async function loadEstimateQueue(): Promise<OfflineEstimate[]> {
  const raw = await AsyncStorage.getItem(OFFLINE_ESTIMATE_QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}
async function addEstimateToQueue(job: OfflineEstimate) {
  const queue = await loadEstimateQueue();
  queue.push(job);
  await AsyncStorage.setItem(OFFLINE_ESTIMATE_QUEUE_KEY, JSON.stringify(queue));
}
async function removeEstimateFromQueue(id: string) {
  const queue = await loadEstimateQueue();
  await AsyncStorage.setItem(
    OFFLINE_ESTIMATE_QUEUE_KEY,
    JSON.stringify(queue.filter((j) => j.id !== id)),
  );
}

const PRIMARY = "#4aa19b";
const DARK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";
const SCREEN_HEIGHT = Dimensions.get("window").height;

// ─── Custom Slider ────────────────────────────────────────────────────────────
interface NativeSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}

function NativeSlider({ value, min, max, step = 5, onChange }: NativeSliderProps) {
  const TRACK_WIDTH = useWindowDimensions().width - 80;
  const THUMB = 24;
  const pct = (value - min) / (max - min);
  const thumbX = useRef(new Animated.Value(pct * (TRACK_WIDTH - THUMB))).current;
  const startX = useRef(0);
  const startVal = useRef(value);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, g) => {
        startX.current = g.x0;
        startVal.current = value;
      },
      onPanResponderMove: (_, g) => {
        const ratio = g.dx / (TRACK_WIDTH - THUMB);
        const raw = startVal.current + ratio * (max - min);
        const clamped = Math.max(min, Math.min(max, raw));
        const stepped = Math.round(clamped / step) * step;
        const newPct = (stepped - min) / (max - min);
        thumbX.setValue(newPct * (TRACK_WIDTH - THUMB));
        onChange(stepped);
      },
    })
  ).current;

  return (
    <View style={{ height: 44, justifyContent: "center" }}>
      <View style={[slStyles.track, { width: TRACK_WIDTH }]}>
        <Animated.View
          style={[
            slStyles.fill,
            { width: Animated.add(thumbX, THUMB / 2) },
          ]}
        />
        <Animated.View
          style={[slStyles.thumb, { transform: [{ translateX: thumbX }] }]}
          {...panResponder.panHandlers}
        />
      </View>
    </View>
  );
}

const slStyles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: BORDER,
  },
  fill: {
    position: "absolute",
    height: 6,
    backgroundColor: PRIMARY,
    borderRadius: 3,
  },
  thumb: {
    position: "absolute",
    top: -9,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});

// ─── Cost row ─────────────────────────────────────────────────────────────────
interface CostRowProps {
  label: string;
  emoji: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  scaleMarks: string[];
  onChange: (v: number) => void;
}

function CostRow({ label, emoji, value, min, max, step, scaleMarks, onChange }: CostRowProps) {
  return (
    <View style={styles.sliderBox}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderEmoji}>{emoji}</Text>
        <Text style={styles.sliderLabel}>{label}</Text>
        <View style={styles.sliderBadge}>
          <Text style={styles.sliderBadgeText}>{value} €</Text>
          <Text style={{ color: MUTED, fontSize: 12 }}> ›</Text>
        </View>
      </View>
      <NativeSlider value={value} min={min} max={max} step={step} onChange={onChange} />
      <View style={styles.scaleRow}>
        {scaleMarks.map((m) => (
          <Text key={m} style={styles.scaleMark}>{m}</Text>
        ))}
      </View>
    </View>
  );
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAY_NAMES_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTH_NAMES_FULL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function generateDateChips(count = 14): { label: string; sublabel: string; date: Date }[] {
  const chips: { label: string; sublabel: string; date: Date }[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    d.setHours(0, 0, 0, 0);
    const dayLabel = i === 0 ? "Hoy" : i === 1 ? "Mañana" : DAY_NAMES[d.getDay()]!;
    chips.push({
      label: dayLabel,
      sublabel: `${d.getDate()}\n${MONTH_NAMES[d.getMonth()]}`,
      date: d,
    });
  }
  return chips;
}

const ALL_HOUR_CHIPS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];
const DURATION_CHIPS = ["30 min", "1 hora", "2 horas", "Más de 2 horas"];

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function EstimateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ incidentId?: string; providerId?: string; tenantId?: string }>();
  const [departure, setDeparture] = useState(40);
  const [labor, setLabor] = useState(80);
  const [materials, setMaterials] = useState(35);
  const [days, setDays] = useState(1);
  const [goNow, setGoNow] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Bottom sheet state
  const [showSchedule, setShowSchedule] = useState(false);
  const [selectedDateIdx, setSelectedDateIdx] = useState(1); // default: Mañana
  const [selectedHour, setSelectedHour] = useState("10:00");
  const [selectedDuration, setSelectedDuration] = useState("1 hora");
  const [showAllDates, setShowAllDates] = useState(false);
  const [showAllHours, setShowAllHours] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const dateChips = generateDateChips(14);

  const DEMO_TENANT_ID = "org_aconvi_demo";
  const total = departure + labor + materials;

  const acceptMutation = useMutation(
    api.incident.providerAccept.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(api.incident.assignedToProvider.queryFilter());
        void queryClient.invalidateQueries(api.incident.all.queryFilter());
      },
      onError: (e: any) => {
        const msg = e?.message ?? "Error al enviar la estimación.";
        Alert.alert("Error", msg);
      },
    })
  );

  // ─── Offline queue sync ───────────────────────────────────────────────────
  const syncEstimateQueue = useCallback(async () => {
    const queue = await loadEstimateQueue();
    if (queue.length === 0) return;
    setIsSyncing(true);
    for (const job of queue) {
      try {
        await new Promise<void>((resolve, reject) => {
          acceptMutation.mutate(
            {
              id: job.incidentId,
              tenantId: job.tenantId,
              providerId: job.providerId,
              estimatedCost: job.estimatedCost,
              estimatedDays: job.estimatedDays,
              notes: job.notes,
              scheduledAt: job.scheduledAt,
              estimatedDuration: job.estimatedDuration,
            } as any,
            { onSuccess: () => resolve(), onError: (e: any) => reject(e) },
          );
        });
        await removeEstimateFromQueue(job.id);
      } catch { /* leave for next retry */ }
    }
    const remaining = await loadEstimateQueue();
    setPendingCount(remaining.length);
    setIsSyncing(false);
  }, [acceptMutation]);

  useEffect(() => {
    loadEstimateQueue().then((q) => setPendingCount(q.length));
    const unsub = NetInfo.addEventListener((state: any) => {
      const connected = !!state.isConnected && !!state.isInternetReachable;
      setIsOffline(!connected);
      if (connected) void syncEstimateQueue();
    });
    return () => unsub();
  }, [syncEstimateQueue]);

  // ─── Bottom sheet animation ───────────────────────────────────────────────
  const openSheet = () => {
    setShowSchedule(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const closeSheet = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setShowSchedule(false));
  };

  // ─── Handle "Salir ahora" send ────────────────────────────────────────────
  const handleSendNow = async () => {
    const incidentId = params.incidentId;
    const providerId = params.providerId ?? "11111111-2222-3333-4444-555555555555";
    const tenantId = params.tenantId ?? DEMO_TENANT_ID;

    if (!incidentId) {
      Alert.alert("Estimación enviada ✓", `Presupuesto de ${total}€ enviado.`,
        [{ text: "OK", onPress: () => router.push("/(proveedor)/job/inprogress") }]
      );
      return;
    }

    if (isOffline) {
      const job: OfflineEstimate = {
        id: `offline_est_${Date.now()}`,
        incidentId,
        providerId,
        tenantId,
        estimatedCost: total,
        estimatedDays: 0,
        notes: "Salida inmediata",
        createdAt: Date.now(),
      };
      await addEstimateToQueue(job);
      setPendingCount((c) => c + 1);
      Alert.alert(
        "📶 Guardado sin conexión",
        "Tu estimación se ha guardado localmente.",
        [{ text: "OK", onPress: () => router.push({
          pathname: "/(proveedor)/job/inprogress",
          params: { incidentId, providerId },
        }) }]
      );
    } else {
      acceptMutation.mutate(
        {
          id: incidentId,
          tenantId,
          providerId,
          estimatedCost: total,
          estimatedDays: 0,
          notes: "Salida inmediata",
        } as any,
        {
          onSuccess: () => {
            Alert.alert("Estimación enviada ✓", `Presupuesto de ${total}€ guardado.`,
              [{ text: "OK", onPress: () => router.push({
                pathname: "/(proveedor)/job/inprogress",
                params: { incidentId, providerId },
              }) }]
            );
          },
        }
      );
    }
  };

  // ─── Handle schedule confirm ──────────────────────────────────────────────
  const handleConfirmSchedule = () => {
    const incidentId = params.incidentId;
    const providerId = params.providerId ?? "11111111-2222-3333-4444-555555555555";
    const tenantId = params.tenantId ?? DEMO_TENANT_ID;

    if (!incidentId) {
      Alert.alert("Error", "No se encontró el ID de la incidencia.");
      return;
    }

    const selectedDate = new Date(dateChips[selectedDateIdx]!.date);
    const [hours, minutes] = selectedHour.split(":").map(Number);
    selectedDate.setHours(hours!, minutes!, 0, 0);
    const scheduledAtISO = selectedDate.toISOString();

    closeSheet();

    if (isOffline) {
      const job: OfflineEstimate = {
        id: `offline_est_${Date.now()}`,
        incidentId,
        providerId,
        tenantId,
        estimatedCost: total,
        estimatedDays: days,
        notes: "Salida programada",
        scheduledAt: scheduledAtISO,
        estimatedDuration: selectedDuration,
        createdAt: Date.now(),
      };
      addEstimateToQueue(job).then(() => {
        setPendingCount((c) => c + 1);
        Alert.alert("📶 Guardado sin conexión", "La programación se enviará cuando recuperes señal.",
          [{ text: "OK", onPress: () => router.push({
            pathname: "/(proveedor)/job/inprogress",
            params: { incidentId, providerId },
          }) }]
        );
      });
      return;
    }

    acceptMutation.mutate(
      {
        id: incidentId,
        tenantId,
        providerId,
        estimatedCost: total,
        estimatedDays: days,
        notes: "Salida programada",
        scheduledAt: scheduledAtISO,
        estimatedDuration: selectedDuration,
      } as any,
      {
        onSuccess: () => {
          const d = selectedDate;
          const dayName = DAY_NAMES_FULL[d.getDay()];
          const monthName = MONTH_NAMES_FULL[d.getMonth()];
          Alert.alert(
            "Intervención agendada ✓",
            `Cita programada para el ${dayName}, ${d.getDate()} de ${monthName} a las ${selectedHour}\nDuración: ${selectedDuration}\nPresupuesto: ${total}€`,
            [{ text: "OK", onPress: () => router.replace({
              pathname: "/(proveedor)/job",
              params: { providerId },
            }) }]
          );
        },
      }
    );
  };

  // ─── Summary text for bottom sheet ────────────────────────────────────────
  const selectedDate = dateChips[selectedDateIdx]?.date ?? new Date();
  const summaryDayName = DAY_NAMES_FULL[selectedDate.getDay()];
  const summaryMonth = MONTH_NAMES_FULL[selectedDate.getMonth()];
  const summaryText = `${summaryDayName}, ${selectedDate.getDate()} de ${summaryMonth} a las ${selectedHour}`;

  const isLoading = acceptMutation.isPending || isSyncing;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <Stack.Screen options={{ title: "Intervención", headerBackTitle: "Regresar" }} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Offline banner */}
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>📵 Sin conexión — la estimación se guardará localmente</Text>
          </View>
        )}
        {!isOffline && pendingCount > 0 && (
          <TouchableOpacity style={styles.syncBanner} onPress={syncEstimateQueue} disabled={isSyncing}>
            <Text style={styles.syncBannerText}>
              {isSyncing ? "⏳ Sincronizando..." : `☁️ ${pendingCount} estimación${pendingCount > 1 ? "es" : ""} pendiente${pendingCount > 1 ? "s" : ""} de subir. Pulsa para sincronizar.`}
            </Text>
          </TouchableOpacity>
        )}

        {/* OT header */}
        <View style={styles.otHeader}>
          <View style={styles.otIconCircle}>
            <Text style={{ fontSize: 28 }}>✅</Text>
          </View>
          <Text style={styles.otTitle}>OT aceptada</Text>
          <Text style={styles.communityName}>Residencial El Lago</Text>
          <Text style={styles.address}>Calle Los Sauces, 345</Text>
        </View>

        {/* Go now / Schedule toggle */}
        <Text style={styles.questionLabel}>¿Salir ahora?</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, goNow && styles.toggleBtnActive]}
            onPress={() => setGoNow(true)}
          >
            <Text style={[styles.toggleIcon, goNow && styles.toggleIconActive]}>🚗</Text>
            <Text style={[styles.toggleText, goNow && styles.toggleTextActive]}>Salir ahora</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, !goNow && styles.toggleBtnActive]}
            onPress={() => { setGoNow(false); openSheet(); }}
          >
            <Text style={[styles.toggleIcon, !goNow && styles.toggleIconActive]}>📅</Text>
            <Text style={[styles.toggleText, !goNow && styles.toggleTextActive]}>Programar</Text>
          </TouchableOpacity>
        </View>

        {/* Show schedule summary if programmed */}
        {!goNow && (
          <TouchableOpacity style={styles.scheduleSummaryCard} onPress={openSheet} activeOpacity={0.7}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 18 }}>📅</Text>
              <View>
                <Text style={styles.scheduleSummaryLabel}>Programado:</Text>
                <Text style={styles.scheduleSummaryText}>{summaryText}</Text>
                <Text style={styles.scheduleSummaryDuration}>Duración estimada: {selectedDuration}</Text>
              </View>
            </View>
            <Text style={{ color: PRIMARY, fontWeight: "600", fontSize: 13 }}>Cambiar ›</Text>
          </TouchableOpacity>
        )}

        {/* Sliders */}
        <CostRow label="Desplazamiento" emoji="🚗" value={departure} min={0} max={150} step={5}
          scaleMarks={["0", "30 €", "50 €", "100 €", "150 €"]} onChange={setDeparture} />
        <CostRow label="Mano de obra" emoji="🔧" value={labor} min={0} max={200} step={5}
          scaleMarks={["0 €", "40 €", "80 €", "160 €", "200 €"]} onChange={setLabor} />
        <CostRow label="Materiales" emoji="🧰" value={materials} min={0} max={100} step={5}
          scaleMarks={["0 €", "20 €", "40 €", "80 €", "100 €"]} onChange={setMaterials} />
        {!goNow && (
          <CostRow label="Plazo estimado" emoji="⏳" value={days} min={1} max={15} step={1}
            scaleMarks={["1d", "3d", "5d", "10d", "15d"]} onChange={setDays} />
        )}

        {/* Total */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total estimado:</Text>
          <View style={styles.totalBadge}>
            <Text style={styles.totalAmount}>{total} €</Text>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.sendButton, isLoading && { opacity: 0.7 }]}
          onPress={goNow ? handleSendNow : openSheet}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>
              {isOffline ? "💾 Guardar sin conexión" : goNow ? "Enviar estimación" : "📅 Confirmar programación"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.navLink}>
          <Text style={styles.navLinkText}>📍 Navegar</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ─── Schedule Bottom Sheet ─────────────────────────────────────────── */}
      <Modal visible={showSchedule} transparent animationType="none" onRequestClose={closeSheet}>
        <View style={bsStyles.overlay}>
          <TouchableOpacity style={bsStyles.backdrop} activeOpacity={1} onPress={closeSheet} />
          <Animated.View style={[bsStyles.sheet, { transform: [{ translateY: slideAnim }] }]}>
            {/* Header */}
            <View style={bsStyles.header}>
              <Text style={bsStyles.headerTitle}>Programar intervención</Text>
              <TouchableOpacity onPress={closeSheet} hitSlop={12}>
                <Text style={bsStyles.closeX}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
              {/* 1. Date */}
              <Text style={bsStyles.sectionLabel}>1. Selecciona la fecha</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={bsStyles.chipScroll}>
                {(showAllDates ? dateChips : dateChips.slice(0, 5)).map((chip, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[bsStyles.dateChip, selectedDateIdx === idx && bsStyles.dateChipActive]}
                    onPress={() => setSelectedDateIdx(idx)}
                  >
                    <Text style={[bsStyles.dateChipLabel, selectedDateIdx === idx && bsStyles.dateChipLabelActive]}>
                      {chip.label}
                    </Text>
                    <Text style={[bsStyles.dateChipDay, selectedDateIdx === idx && bsStyles.dateChipDayActive]}>
                      {chip.date.getDate()}
                    </Text>
                    <Text style={[bsStyles.dateChipMonth, selectedDateIdx === idx && bsStyles.dateChipMonthActive]}>
                      {MONTH_NAMES[chip.date.getMonth()]}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={bsStyles.dateChipCalendar} onPress={() => setShowAllDates(!showAllDates)}>
                  <Text style={{ fontSize: 20 }}>{showAllDates ? '⬅️' : '📅'}</Text>
                  <Text style={bsStyles.dateChipCalendarText}>{showAllDates ? 'Menos\nfechas' : 'Más\nfechas'}</Text>
                </TouchableOpacity>
              </ScrollView>

              {/* 2. Hour */}
              <Text style={bsStyles.sectionLabel}>2. Selecciona la hora</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={bsStyles.chipScroll}>
                {(showAllHours ? ALL_HOUR_CHIPS : ALL_HOUR_CHIPS.slice(0, 5)).map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[bsStyles.hourChip, selectedHour === h && bsStyles.hourChipActive]}
                    onPress={() => setSelectedHour(h)}
                  >
                    <Text style={[bsStyles.hourChipText, selectedHour === h && bsStyles.hourChipTextActive]}>
                      {h}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={bsStyles.hourChipMore} onPress={() => setShowAllHours(!showAllHours)}>
                  <Text style={{ fontSize: 16 }}>{showAllHours ? '⬅️' : '🕐'}</Text>
                  <Text style={bsStyles.hourChipMoreText}>{showAllHours ? 'Menos\nhoras' : 'Más\nhoras'}</Text>
                </TouchableOpacity>
              </ScrollView>

              {/* 3. Duration */}
              <Text style={bsStyles.sectionLabel}>3. Duración estimada</Text>
              <View style={bsStyles.durationRow}>
                {DURATION_CHIPS.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[bsStyles.durationChip, selectedDuration === d && bsStyles.durationChipActive]}
                    onPress={() => setSelectedDuration(d)}
                  >
                    <Text style={[bsStyles.durationChipText, selectedDuration === d && bsStyles.durationChipTextActive]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Summary */}
              <View style={bsStyles.summaryCard}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <Text style={{ fontSize: 18 }}>📅</Text>
                  <View>
                    <Text style={bsStyles.summaryLabel}>Resumen:</Text>
                    <Text style={bsStyles.summaryDate}>{summaryText}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ fontSize: 18 }}>🕐</Text>
                  <Text style={bsStyles.summaryDuration}>Duración estimada: {selectedDuration}</Text>
                </View>
              </View>
            </ScrollView>

            {/* Footer buttons */}
            <View style={[bsStyles.footer, { paddingBottom: Math.max(28, insets.bottom + 12) }]}>
              <TouchableOpacity style={bsStyles.cancelBtn} onPress={closeSheet}>
                <Text style={bsStyles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[bsStyles.confirmBtn, isLoading && { opacity: 0.7 }]}
                onPress={handleConfirmSchedule}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={bsStyles.confirmBtnText}>Confirmar programación</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Main styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  offlineBanner: {
    backgroundColor: "#fef3c7", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 12, borderWidth: 1, borderColor: "#fde68a",
  },
  offlineBannerText: { fontSize: 13, color: "#92400e", fontWeight: "600", textAlign: "center" },
  syncBanner: {
    backgroundColor: "#ecfdf5", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 12, borderWidth: 1, borderColor: "#bbf7d0",
  },
  syncBannerText: { fontSize: 13, color: "#065f46", fontWeight: "600", textAlign: "center" },
  otHeader: { alignItems: "center", marginBottom: 24 },
  otIconCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: "#ecfdf5",
    justifyContent: "center", alignItems: "center", marginBottom: 12,
  },
  otTitle: { fontSize: 28, fontWeight: "800", color: DARK, letterSpacing: -0.5, marginBottom: 4 },
  communityName: { fontSize: 16, color: MUTED },
  address: { fontSize: 14, color: MUTED, marginBottom: 4 },
  questionLabel: { fontSize: 17, fontWeight: "700", color: DARK, marginBottom: 10 },
  toggleRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  toggleBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: BORDER,
    alignItems: "center", backgroundColor: "#fff", flexDirection: "row", justifyContent: "center", gap: 6,
  },
  toggleBtnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  toggleIcon: { fontSize: 16 },
  toggleIconActive: {},
  toggleText: { fontSize: 15, fontWeight: "600", color: MUTED },
  toggleTextActive: { color: "#fff" },
  scheduleSummaryCard: {
    backgroundColor: "#f0fdfa", borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: "#ccfbf1", flexDirection: "row",
    justifyContent: "space-between", alignItems: "center",
  },
  scheduleSummaryLabel: { fontSize: 12, color: MUTED, fontWeight: "600" },
  scheduleSummaryText: { fontSize: 15, color: PRIMARY, fontWeight: "700" },
  scheduleSummaryDuration: { fontSize: 12, color: MUTED, marginTop: 2 },
  sliderBox: {
    backgroundColor: "#f8fafc", borderRadius: 16, borderWidth: 1, borderColor: BORDER,
    padding: 14, marginBottom: 12,
  },
  sliderHeader: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  sliderEmoji: { fontSize: 18, marginRight: 8 },
  sliderLabel: { fontSize: 15, fontWeight: "600", color: DARK, flex: 1 },
  sliderBadge: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderWidth: 1, borderColor: BORDER, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  sliderBadgeText: { fontSize: 14, fontWeight: "700", color: DARK },
  scaleRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  scaleMark: { fontSize: 10, color: MUTED },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 16 },
  totalLabel: { fontSize: 17, fontWeight: "700", color: DARK },
  totalBadge: { backgroundColor: PRIMARY, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 8 },
  totalAmount: { color: "#fff", fontSize: 20, fontWeight: "800" },
  sendButton: {
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16, alignItems: "center",
    marginBottom: 12, shadowColor: PRIMARY, shadowOpacity: 0.25, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  sendButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  navLink: { alignItems: "center", paddingVertical: 8 },
  navLinkText: { fontSize: 14, color: PRIMARY, fontWeight: "600" },
});

// ─── Bottom sheet styles ──────────────────────────────────────────────────────
const bsStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.90, paddingHorizontal: 20, paddingTop: 16,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 10,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: DARK },
  closeX: { fontSize: 22, color: MUTED, fontWeight: "600" },
  sectionLabel: { fontSize: 15, fontWeight: "600", color: DARK, marginBottom: 10, marginTop: 8 },
  chipScroll: { marginBottom: 8 },
  // Date chips
  dateChip: {
    width: 72, height: 88, borderRadius: 14, borderWidth: 1.5, borderColor: BORDER,
    alignItems: "center", justifyContent: "center", marginRight: 8, backgroundColor: "#fff",
  },
  dateChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  dateChipLabel: { fontSize: 12, fontWeight: "600", color: MUTED, marginBottom: 2 },
  dateChipLabelActive: { color: "#fff" },
  dateChipDay: { fontSize: 24, fontWeight: "800", color: DARK },
  dateChipDayActive: { color: "#fff" },
  dateChipMonth: { fontSize: 12, color: MUTED, fontWeight: "600" },
  dateChipMonthActive: { color: "rgba(255,255,255,0.8)" },
  dateChipCalendar: {
    width: 72, height: 88, borderRadius: 14, borderWidth: 1.5, borderColor: BORDER,
    alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc",
  },
  dateChipCalendarText: { fontSize: 11, color: MUTED, textAlign: "center", fontWeight: "600", marginTop: 4 },
  // Hour chips
  hourChip: {
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
    borderColor: BORDER, marginRight: 8, backgroundColor: "#fff",
  },
  hourChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  hourChipText: { fontSize: 15, fontWeight: "600", color: DARK },
  hourChipTextActive: { color: "#fff" },
  hourChipMore: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5,
    borderColor: BORDER, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc",
  },
  hourChipMoreText: { fontSize: 11, color: MUTED, textAlign: "center", fontWeight: "600", marginTop: 2 },
  // Duration chips
  durationRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  durationChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5,
    borderColor: BORDER, backgroundColor: "#fff",
  },
  durationChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  durationChipText: { fontSize: 14, fontWeight: "600", color: DARK },
  durationChipTextActive: { color: "#fff" },
  // Summary
  summaryCard: {
    backgroundColor: "#f0fdfa", borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: "#ccfbf1",
  },
  summaryLabel: { fontSize: 12, color: MUTED, fontWeight: "600" },
  summaryDate: { fontSize: 16, fontWeight: "700", color: PRIMARY },
  summaryDuration: { fontSize: 14, color: MUTED },
  // Footer
  footer: {
    flexDirection: "row", gap: 12, paddingTop: 14, paddingBottom: 16,
    borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: "#fff",
  },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5,
    borderColor: PRIMARY, alignItems: "center",
  },
  cancelBtnText: { fontSize: 15, fontWeight: "700", color: PRIMARY },
  confirmBtn: {
    flex: 1.5, paddingVertical: 14, borderRadius: 12, backgroundColor: PRIMARY,
    alignItems: "center", shadowColor: PRIMARY, shadowOpacity: 0.25, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  confirmBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
