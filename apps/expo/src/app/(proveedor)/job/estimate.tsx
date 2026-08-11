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
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "~/utils/safe-netinfo";
import { api, queryClient } from "~/utils/api";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

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

const PRIMARY = "#009689";
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
  disabled?: boolean;
}

function NativeSlider({ value, min, max, step = 5, onChange, disabled = false }: NativeSliderProps) {
  const TRACK_WIDTH = useWindowDimensions().width - 80;
  const THUMB = 24;
  const pct = (value - min) / (max - min);
  const thumbX = useRef(new Animated.Value(pct * (TRACK_WIDTH - THUMB))).current;
  const startX = useRef(0);
  const startVal = useRef(value);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (_, g) => {
        if (disabled) return;
        startX.current = g.x0;
        startVal.current = value;
      },
      onPanResponderMove: (_, g) => {
        if (disabled) return;
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
      <View style={[slStyles.track, { width: TRACK_WIDTH }, disabled && { backgroundColor: "#f1f5f9" }]}>
        <Animated.View
          style={[
            slStyles.fill,
            disabled && { backgroundColor: "#cbd5e1" },
            {
              width: thumbX.interpolate({
                inputRange: [0, TRACK_WIDTH - THUMB],
                outputRange: [0, TRACK_WIDTH],
                extrapolate: "clamp",
              }),
            },
          ]}
        />
        <Animated.View
          style={[
            slStyles.thumb,
            disabled && { backgroundColor: "#94a3b8", borderColor: "#e2e8f0" },
            { transform: [{ translateX: thumbX }] },
          ]}
          {...panResponder.panHandlers}
        />
      </View>
    </View>
  );
}

const slStyles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, backgroundColor: "#e2e8f0", overflow: "visible" },
  fill: { height: 8, borderRadius: 4, backgroundColor: PRIMARY },
  thumb: {
    position: "absolute", top: -8, width: 24, height: 24, borderRadius: 12,
    backgroundColor: PRIMARY, borderWidth: 3, borderColor: "#fff",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
});

// ─── Scheduling Helpers ───────────────────────────────────────────────────────
const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAY_NAMES_FULL = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTH_NAMES_FULL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const ALL_HOUR_CHIPS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "16:00", "17:00", "18:00", "19:00"];
const DURATION_OPTIONS = ["30 min", "1 hora", "1.5 horas", "2 horas", "3 horas", "4+ horas"];

interface DateChip {
  date: Date;
  dayName: string;
  dayNum: number;
  monthName: string;
  isToday: boolean;
}

function generateDateChips(count = 14): DateChip[] {
  const chips: DateChip[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    chips.push({
      date: d,
      dayName: DAY_NAMES[d.getDay()]!,
      dayNum: d.getDate(),
      monthName: MONTH_NAMES[d.getMonth()]!,
      isToday: i === 0,
    });
  }
  return chips;
}

export default function JobEstimateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ incidentId?: string; providerId?: string; tenantId?: string }>();

  const incidentId = params.incidentId;
  const DEMO_TENANT_ID = "org_aconvi_demo";
  const tenantId = params.tenantId ?? DEMO_TENANT_ID;

  // 100% Real Incident DB Query
  const { data: incident } = useQuery(
    api.incident.byId.queryOptions(
      { id: incidentId ?? "", tenantId },
      { enabled: !!incidentId }
    )
  );

  const [departure, setDeparture] = useState(40);
  const [labor, setLabor] = useState(80);
  const [materials, setMaterials] = useState(35);
  const [days, setDays] = useState(1);
  const [goNow, setGoNow] = useState(true);

  // Bottom Sheet
  const [showSchedule, setShowSchedule] = useState(false);
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const [selectedHour, setSelectedHour] = useState("10:00");
  const [selectedDuration, setSelectedDuration] = useState("1 hora");
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAllDates, setShowAllDates] = useState(false);
  const [showAllHours, setShowAllHours] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const dateScrollRef = useRef<ScrollView>(null);
  const hourScrollRef = useRef<ScrollView>(null);

  const handleToggleDates = () => {
    dateScrollRef.current?.scrollTo({ x: 0, animated: false });
    if (showAllDates && selectedDateIdx >= 5) {
      setSelectedDateIdx(0);
    }
    setShowAllDates((prev) => !prev);
  };

  const handleToggleHours = () => {
    hourScrollRef.current?.scrollTo({ x: 0, animated: false });
    setShowAllHours((prev) => !prev);
  };

  const dateChips = generateDateChips(14);
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

  // Offline queue sync
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

  // Check if assigned > 2 hours ago or already expired
  const assignedTime = incident?.assignedAt
    ? new Date(incident.assignedAt).getTime()
    : incident?.createdAt
    ? new Date(incident.createdAt).getTime()
    : Date.now();
  const isIncidentExpired =
    incident?.status === "RECIBIDA" ||
    (incident?.status !== "AGENDADA" && incident?.status !== "EN_CURSO" && Date.now() - assignedTime > 2 * 60 * 60 * 1000);

  // Bottom sheet animation
  const openSheet = () => {
    if (isIncidentExpired) return;
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

  // Handle "Salir ahora" send
  const handleSendNow = async () => {
    if (isIncidentExpired) {
      Alert.alert(
        "OT Caducada",
        "El tiempo límite de 2 horas para responder esta orden ha finalizado. La incidencia ha sido devuelta al estado RECIBIDA y no se puede aceptar."
      );
      return;
    }

    const providerId = params.providerId ?? "11111111-2222-3333-4444-555555555555";

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
            Alert.alert("Intervención Aceptada ✓", `Presupuesto de ${total}€ registrado. Te diriges a la intervención.`,
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

  // Handle schedule confirm
  const handleConfirmSchedule = () => {
    if (isIncidentExpired) {
      Alert.alert(
        "OT Caducada",
        "El tiempo límite de 2 horas para responder esta orden ha finalizado. No es posible programar una cita."
      );
      return;
    }

    const providerId = params.providerId ?? "11111111-2222-3333-4444-555555555555";

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

  const selectedDate = dateChips[selectedDateIdx]?.date ?? new Date();
  const isTodayDate = selectedDate.toDateString() === new Date().toDateString();
  const currentHour = new Date().getHours();

  const rawAvailableHours = isTodayDate
    ? ALL_HOUR_CHIPS.filter((h) => parseInt(h.split(":")[0]!, 10) > currentHour)
    : ALL_HOUR_CHIPS;
  const availableHours = rawAvailableHours.length > 0 ? rawAvailableHours : ALL_HOUR_CHIPS;

  const summaryDayName = DAY_NAMES_FULL[selectedDate.getDay()];
  const summaryMonth = MONTH_NAMES_FULL[selectedDate.getMonth()];
  const summaryText = `${summaryDayName}, ${selectedDate.getDate()} de ${summaryMonth} a las ${selectedHour}`;

  const isLoading = acceptMutation.isPending || isSyncing;

  const communityName = incident?.organization?.name || (incident as any)?.communityName || "Aconvi Demo Community";
  const incidentTitle = incident?.title || "Intervención solicitada";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <Stack.Screen options={{ title: "Detalle de OT", headerBackTitle: "Regresar" }} />

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
              {isSyncing ? "⏳ Sincronizando..." : `☁️ ${pendingCount} estimación${pendingCount > 1 ? "es" : ""} pendiente${pendingCount > 1 ? "s" : ""} de subir.`}
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Dynamic OT Header ────────────────────────────────────────────── */}
        <View style={styles.otHeader}>
          <View style={[
            styles.otIconCircle,
            {
              backgroundColor: isIncidentExpired
                ? "#fef2f2"
                : incident?.status === "AGENDADA"
                ? "#ecfdf5"
                : "#fff7ed"
            }
          ]}>
            <Ionicons
              name={
                isIncidentExpired
                  ? "close-circle-outline"
                  : incident?.status === "AGENDADA"
                  ? "checkmark-circle-outline"
                  : "document-text-outline"
              }
              size={32}
              color={
                isIncidentExpired
                  ? "#ef4444"
                  : incident?.status === "AGENDADA"
                  ? "#10b981"
                  : "#ea580c"
              }
            />
          </View>

          <Text style={styles.otTitle}>
            {isIncidentExpired
              ? "OT Caducada"
              : incident?.status === "AGENDADA"
              ? "OT Aceptada"
              : incident?.status === "EN_CURSO"
              ? "OT en Curso"
              : "Respuesta de OT"}
          </Text>

          <Text style={styles.incidentTitleText}>{incidentTitle}</Text>

          <View style={styles.communityRow}>
            <Ionicons name="business-outline" size={14} color={MUTED} style={{ marginRight: 4 }} />
            <Text style={styles.communityName}>{communityName}</Text>
          </View>

          {/* Strict Expiration Banner - No acceptance allowed */}
          {isIncidentExpired && (
            <View style={styles.expiredNoticeCard}>
              <Ionicons name="alert-circle" size={18} color="#ef4444" style={{ marginRight: 8 }} />
              <Text style={styles.expiredNoticeText}>
                Esta orden de trabajo ha superado el límite de 2 horas y ha caducado. Ha vuelto a la administración para su reasignación y no se puede aceptar.
              </Text>
            </View>
          )}
        </View>

        {/* Go now / Schedule toggle (Disabled if expired) */}
        <Text style={[styles.questionLabel, isIncidentExpired && { color: MUTED }]}>
          ¿Cuándo realizarás la intervención?
        </Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              goNow && styles.toggleBtnActive,
              isIncidentExpired && { opacity: 0.5, borderColor: "#e2e8f0" }
            ]}
            onPress={() => !isIncidentExpired && setGoNow(true)}
            disabled={isIncidentExpired}
          >
            <Ionicons name="car-outline" size={18} color={goNow && !isIncidentExpired ? "#fff" : MUTED} />
            <Text style={[styles.toggleText, goNow && !isIncidentExpired && styles.toggleTextActive]}>Salir ahora</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleBtn,
              !goNow && styles.toggleBtnActive,
              isIncidentExpired && { opacity: 0.5, borderColor: "#e2e8f0" }
            ]}
            onPress={() => {
              if (!isIncidentExpired) {
                setGoNow(false);
                openSheet();
              }
            }}
            disabled={isIncidentExpired}
          >
            <Ionicons name="calendar-outline" size={18} color={!goNow && !isIncidentExpired ? "#fff" : MUTED} />
            <Text style={[styles.toggleText, !goNow && !isIncidentExpired && styles.toggleTextActive]}>Programar</Text>
          </TouchableOpacity>
        </View>

        {/* Show schedule summary if programmed */}
        {!goNow && !isIncidentExpired && (
          <TouchableOpacity style={styles.scheduleSummaryCard} onPress={openSheet} activeOpacity={0.7}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="calendar" size={20} color={PRIMARY} />
              <View>
                <Text style={styles.scheduleSummaryLabel}>Cita programada:</Text>
                <Text style={styles.scheduleSummaryText}>{summaryText}</Text>
                <Text style={styles.scheduleSummaryDuration}>Duración estimada: {selectedDuration}</Text>
              </View>
            </View>
            <Ionicons name="create-outline" size={18} color={PRIMARY} />
          </TouchableOpacity>
        )}

        {/* Sliders for cost estimation */}
        <View style={[styles.sliderBox, isIncidentExpired && { opacity: 0.5 }]}>
          <View style={styles.sliderHeader}>
            <Ionicons name="car-outline" size={18} color={DARK} style={{ marginRight: 8 }} />
            <Text style={styles.sliderLabel}>Desplazamiento</Text>
            <View style={styles.sliderBadge}>
              <Text style={styles.sliderBadgeText}>{departure} €</Text>
            </View>
          </View>
          <NativeSlider value={departure} min={0} max={150} step={5} onChange={setDeparture} disabled={isIncidentExpired} />
          <View style={styles.scaleRow}>
            <Text style={styles.scaleMark}>0 €</Text>
            <Text style={styles.scaleMark}>50 €</Text>
            <Text style={styles.scaleMark}>100 €</Text>
            <Text style={styles.scaleMark}>150 €</Text>
          </View>
        </View>

        <View style={[styles.sliderBox, isIncidentExpired && { opacity: 0.5 }]}>
          <View style={styles.sliderHeader}>
            <Ionicons name="build-outline" size={18} color={DARK} style={{ marginRight: 8 }} />
            <Text style={styles.sliderLabel}>Mano de obra</Text>
            <View style={styles.sliderBadge}>
              <Text style={styles.sliderBadgeText}>{labor} €</Text>
            </View>
          </View>
          <NativeSlider value={labor} min={0} max={200} step={10} onChange={setLabor} disabled={isIncidentExpired} />
          <View style={styles.scaleRow}>
            <Text style={styles.scaleMark}>0 €</Text>
            <Text style={styles.scaleMark}>80 €</Text>
            <Text style={styles.scaleMark}>160 €</Text>
            <Text style={styles.scaleMark}>200 €</Text>
          </View>
        </View>

        <View style={[styles.sliderBox, isIncidentExpired && { opacity: 0.5 }]}>
          <View style={styles.sliderHeader}>
            <Ionicons name="briefcase-outline" size={18} color={DARK} style={{ marginRight: 8 }} />
            <Text style={styles.sliderLabel}>Materiales</Text>
            <View style={styles.sliderBadge}>
              <Text style={styles.sliderBadgeText}>{materials} €</Text>
            </View>
          </View>
          <NativeSlider value={materials} min={0} max={100} step={5} onChange={setMaterials} disabled={isIncidentExpired} />
          <View style={styles.scaleRow}>
            <Text style={styles.scaleMark}>0 €</Text>
            <Text style={styles.scaleMark}>40 €</Text>
            <Text style={styles.scaleMark}>80 €</Text>
            <Text style={styles.scaleMark}>100 €</Text>
          </View>
        </View>

        {/* Total sum row */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Presupuesto total estimativo:</Text>
          <View style={[styles.totalBadge, isIncidentExpired && { backgroundColor: "#94a3b8" }]}>
            <Text style={styles.totalAmount}>{total} €</Text>
          </View>
        </View>

        {/* Submit button / Disabled button if expired */}
        <TouchableOpacity
          style={[
            styles.sendButton,
            isIncidentExpired && { backgroundColor: "#94a3b8", shadowColor: "transparent" }
          ]}
          onPress={goNow ? handleSendNow : handleConfirmSchedule}
          disabled={isLoading || isIncidentExpired}
          activeOpacity={isIncidentExpired ? 1 : 0.7}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>
              {isIncidentExpired
                ? "OT Caducada — No se puede aceptar"
                : goNow
                ? "Aceptar e Intervenir Ahora"
                : "Confirmar Cita y Aceptar"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* ─── Bottom sheet for scheduling ─────────────────────────────────── */}
      <Modal visible={showSchedule} transparent animationType="none" onRequestClose={closeSheet}>
        <View style={bsStyles.overlay}>
          <TouchableOpacity style={bsStyles.backdrop} activeOpacity={1} onPress={closeSheet} />

          <Animated.View style={[bsStyles.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <View style={bsStyles.header}>
              <Text style={bsStyles.headerTitle}>Programar intervención</Text>
              <TouchableOpacity onPress={closeSheet}>
                <Ionicons name="close" size={24} color={MUTED} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
              <Text style={bsStyles.sectionLabel}>Día de la visita</Text>
              <ScrollView
                ref={dateScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={bsStyles.chipScroll}
              >
                {(showAllDates ? dateChips : dateChips.slice(0, 5)).map((chip, idx) => {
                  const isActive = selectedDateIdx === idx;
                  return (
                    <TouchableOpacity
                      key={chip.date.toISOString()}
                      style={[bsStyles.dateChip, isActive && bsStyles.dateChipActive]}
                      onPress={() => setSelectedDateIdx(idx)}
                    >
                      <Text style={[bsStyles.dateChipLabel, isActive && bsStyles.dateChipLabelActive]}>
                        {chip.isToday ? "Hoy" : chip.dayName}
                      </Text>
                      <Text style={[bsStyles.dateChipDay, isActive && bsStyles.dateChipDayActive]}>
                        {chip.dayNum}
                      </Text>
                      <Text style={[bsStyles.dateChipMonth, isActive && bsStyles.dateChipMonthActive]}>
                        {chip.monthName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity style={bsStyles.dateChipCalendar} onPress={handleToggleDates}>
                  <Ionicons name="calendar-outline" size={20} color={PRIMARY} />
                  <Text style={bsStyles.dateChipCalendarText}>
                    {showAllDates ? "Menos" : "Ver más"}
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              <Text style={bsStyles.sectionLabel}>Hora de llegada estimada</Text>
              <ScrollView
                ref={hourScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={bsStyles.chipScroll}
              >
                {(showAllHours ? availableHours : availableHours.slice(0, 5)).map((h) => {
                  const isActive = selectedHour === h;
                  return (
                    <TouchableOpacity
                      key={h}
                      style={[bsStyles.hourChip, isActive && bsStyles.hourChipActive]}
                      onPress={() => setSelectedHour(h)}
                    >
                      <Text style={[bsStyles.hourChipText, isActive && bsStyles.hourChipTextActive]}>
                        {h}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity style={bsStyles.hourChipMore} onPress={handleToggleHours}>
                  <Ionicons name="time-outline" size={18} color={PRIMARY} />
                  <Text style={bsStyles.hourChipMoreText}>{showAllHours ? "Menos" : "Ver más"}</Text>
                </TouchableOpacity>
              </ScrollView>

              <Text style={bsStyles.sectionLabel}>Duración estimada</Text>
              <View style={bsStyles.durationRow}>
                {DURATION_OPTIONS.map((dur) => {
                  const isActive = selectedDuration === dur;
                  return (
                    <TouchableOpacity
                      key={dur}
                      style={[bsStyles.durationChip, isActive && bsStyles.durationChipActive]}
                      onPress={() => setSelectedDuration(dur)}
                    >
                      <Text style={[bsStyles.durationChipText, isActive && bsStyles.durationChipTextActive]}>
                        {dur}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={bsStyles.summaryCard}>
                <Text style={bsStyles.summaryLabel}>Resumen de la cita:</Text>
                <Text style={bsStyles.summaryDate}>{summaryText}</Text>
                <Text style={bsStyles.summaryDuration}>Duración: {selectedDuration}</Text>
              </View>
            </ScrollView>

            <View style={bsStyles.footer}>
              <TouchableOpacity style={bsStyles.cancelBtn} onPress={closeSheet}>
                <Text style={bsStyles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={bsStyles.confirmBtn}
                onPress={handleConfirmSchedule}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={bsStyles.confirmBtnText}>Confirmar Cita</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

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
    width: 64, height: 64, borderRadius: 32,
    justifyContent: "center", alignItems: "center", marginBottom: 12,
  },
  otTitle: { fontSize: 24, fontWeight: "800", color: DARK, letterSpacing: -0.5, marginBottom: 4 },
  incidentTitleText: { fontSize: 16, fontWeight: "700", color: DARK, textAlign: "center", marginBottom: 4 },
  communityRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  communityName: { fontSize: 14, color: MUTED, fontWeight: "600" },

  expiredNoticeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
  },
  expiredNoticeText: {
    fontSize: 13,
    color: "#991b1b",
    fontWeight: "700",
    lineHeight: 18,
    flex: 1,
  },

  questionLabel: { fontSize: 16, fontWeight: "700", color: DARK, marginBottom: 10 },
  toggleRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  toggleBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: BORDER,
    alignItems: "center", backgroundColor: "#fff", flexDirection: "row", justifyContent: "center", gap: 6,
  },
  toggleBtnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
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
  sliderLabel: { fontSize: 15, fontWeight: "600", color: DARK, flex: 1 },
  sliderBadge: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderWidth: 1, borderColor: BORDER, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  sliderBadgeText: { fontSize: 14, fontWeight: "700", color: DARK },
  scaleRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  scaleMark: { fontSize: 10, color: MUTED },

  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 16 },
  totalLabel: { fontSize: 16, fontWeight: "700", color: DARK },
  totalBadge: { backgroundColor: PRIMARY, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 8 },
  totalAmount: { color: "#fff", fontSize: 20, fontWeight: "800" },

  sendButton: {
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16, alignItems: "center",
    marginBottom: 12, shadowColor: PRIMARY, shadowOpacity: 0.25, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  sendButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

// Bottom sheet styles
const bsStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.90, paddingHorizontal: 20, paddingTop: 16,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 10,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: DARK },
  sectionLabel: { fontSize: 15, fontWeight: "600", color: DARK, marginBottom: 10, marginTop: 8 },
  chipScroll: { marginBottom: 8 },
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
  durationRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  durationChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5,
    borderColor: BORDER, backgroundColor: "#fff",
  },
  durationChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  durationChipText: { fontSize: 14, fontWeight: "600", color: DARK },
  durationChipTextActive: { color: "#fff" },
  summaryCard: {
    backgroundColor: "#f0fdfa", borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: "#ccfbf1",
  },
  summaryLabel: { fontSize: 12, color: MUTED, fontWeight: "600" },
  summaryDate: { fontSize: 16, fontWeight: "700", color: PRIMARY },
  summaryDuration: { fontSize: 14, color: MUTED },
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
