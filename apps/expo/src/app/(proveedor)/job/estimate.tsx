import { useState, useRef } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";

const PRIMARY = "#4aa19b";
const DARK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";

// ─── Custom Slider (no external package needed) ───────────────────────────────
interface NativeSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}

function NativeSlider({ value, min, max, step = 5, onChange }: NativeSliderProps) {
  const TRACK_WIDTH = useWindowDimensions().width - 80; // paddings
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
      {/* Track */}
      <View style={[slStyles.track, { width: TRACK_WIDTH }]}>
        {/* Fill */}
        <Animated.View
          style={[
            slStyles.fill,
            {
              width: Animated.add(thumbX, THUMB / 2),
            },
          ]}
        />
        {/* Thumb */}
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            slStyles.thumb,
            { transform: [{ translateX: thumbX }] },
          ]}
        />
      </View>
    </View>
  );
}

const slStyles = StyleSheet.create({
  track: {
    height: 6,
    backgroundColor: "#cbd5e1",
    borderRadius: 3,
    position: "relative",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
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

// ─── Cost row with slider ─────────────────────────────────────────────────────
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

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function EstimateScreen() {
  const router = useRouter();
  const [departure, setDeparture] = useState(40);
  const [labor, setLabor] = useState(80);
  const [materials, setMaterials] = useState(35);
  const [goNow, setGoNow] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const total = departure + labor + materials;

  const handleSend = async () => {
    setIsSending(true);
    await new Promise((r) => setTimeout(r, 1000));
    setIsSending(false);
    Alert.alert(
      "Estimación enviada ✓",
      `El administrador recibirá tu presupuesto de ${total} €.`,
      [{ text: "OK", onPress: () => router.push("/(proveedor)/job/inprogress") }]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <Stack.Screen
        options={{ title: "Intervención", headerBackTitle: "Regresar" }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* OT header */}
        <Text style={styles.otTitle}>OT aceptada</Text>
        <Text style={styles.communityName}>Residencial El Lago</Text>
        <Text style={styles.address}>Calle Los Sauces, 345</Text>

        {/* Go now / Schedule */}
        <Text style={styles.questionLabel}>¿Salir ahora?</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, goNow && styles.toggleBtnActive]}
            onPress={() => setGoNow(true)}
          >
            <Text style={[styles.toggleText, goNow && styles.toggleTextActive]}>
              Salir ahora
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, !goNow && styles.toggleBtnActive]}
            onPress={() => setGoNow(false)}
          >
            <Text style={[styles.toggleText, !goNow && styles.toggleTextActive]}>
              Programar
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.deadlineHint}>Antes de las 17:00</Text>

        <Text style={styles.etaLabel}>🕐 Llegada estimada</Text>

        {/* Sliders */}
        <CostRow
          label="Desplazamiento"
          emoji="🚗"
          value={departure}
          min={0}
          max={150}
          step={5}
          scaleMarks={["0", "30 €", "50 €", "100 €", "150 €"]}
          onChange={setDeparture}
        />
        <CostRow
          label="Mano de obra"
          emoji="🔧"
          value={labor}
          min={0}
          max={200}
          step={5}
          scaleMarks={["0 €", "40 €", "80 €", "160 €", "200 €"]}
          onChange={setLabor}
        />
        <CostRow
          label="Materiales"
          emoji="🧰"
          value={materials}
          min={0}
          max={100}
          step={5}
          scaleMarks={["0 €", "20 €", "40 €", "80 €", "100 €"]}
          onChange={setMaterials}
        />

        {/* Total */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total estimado:</Text>
          <View style={styles.totalBadge}>
            <Text style={styles.totalAmount}>{total} €</Text>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.sendButton, isSending && { opacity: 0.7 }]}
          onPress={handleSend}
          disabled={isSending}
          activeOpacity={0.85}
        >
          {isSending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Enviar estimación</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.navLink}>
          <Text style={styles.navLinkText}>📍 Navegar</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  otTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: DARK,
    textAlign: "center",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  communityName: { fontSize: 16, color: MUTED, textAlign: "center" },
  address: { fontSize: 14, color: MUTED, textAlign: "center", marginBottom: 20 },
  questionLabel: { fontSize: 17, fontWeight: "700", color: DARK, marginBottom: 10 },
  toggleRow: { flexDirection: "row", gap: 10, marginBottom: 6 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  toggleBtnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  toggleText: { fontSize: 15, fontWeight: "600", color: MUTED },
  toggleTextActive: { color: "#fff" },
  deadlineHint: { fontSize: 13, color: PRIMARY, fontWeight: "600", marginBottom: 16 },
  etaLabel: { fontSize: 14, color: MUTED, marginBottom: 12 },
  sliderBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 12,
  },
  sliderHeader: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  sliderEmoji: { fontSize: 18, marginRight: 8 },
  sliderLabel: { fontSize: 15, fontWeight: "600", color: DARK, flex: 1 },
  sliderBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sliderBadgeText: { fontSize: 14, fontWeight: "700", color: DARK },
  scaleRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  scaleMark: { fontSize: 10, color: MUTED },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 16,
  },
  totalLabel: { fontSize: 17, fontWeight: "700", color: DARK },
  totalBadge: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  totalAmount: { color: "#fff", fontSize: 20, fontWeight: "800" },
  sendButton: {
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
  sendButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  navLink: { alignItems: "center", paddingVertical: 8 },
  navLinkText: { fontSize: 14, color: PRIMARY, fontWeight: "600" },
});
