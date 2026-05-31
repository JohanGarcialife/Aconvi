import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api, queryClient } from "~/utils/api";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const PRIMARY = "#4aa19b";
const GREEN = "#22c55e";
const DARK = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const BG = "#F9FAFB";

const TENANT_ID = "org_aconvi_demo";

const STAR_LABELS: Record<number, string> = {
  1: "Muy malo",
  2: "Malo",
  3: "Regular",
  4: "Muy bien",
  5: "Excelente",
};

export default function RatingScreen() {
  const { incidentId } = useLocalSearchParams<{ incidentId: string }>();
  const router = useRouter();

  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const displayRating = hoveredStar || rating;

  // ─── Fetch incident for context ──────────────────────────────────────────
  const { data: incident } = useQuery({
    ...api.incident.byId.queryOptions({ id: incidentId as string, tenantId: TENANT_ID }),
    enabled: !!incidentId,
  });

  // ─── Submit mutation ─────────────────────────────────────────────────────
  const submitRating = useMutation({
    ...api.incident.submitRating.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries(api.incident.all.queryFilter());
      setSubmitted(true);
    },
    onError: (e: any) => {
      Alert.alert("Error al enviar", e.message ?? "Inténtalo de nuevo.");
    },
  });

  const handleSubmit = () => {
    if (!rating) {
      Alert.alert("Selecciona una valoración", "Toca las estrellas para puntuar el servicio.");
      return;
    }
    if (!incidentId) return;
    submitRating.mutate({ tenantId: TENANT_ID, id: incidentId, rating, comment });
  };

  const displayId = incidentId ? `#INC-${incidentId.slice(0, 8).toUpperCase()}` : "";
  const resolvedDate = incident
    ? format(new Date(incident.updatedAt ?? incident.createdAt), "d 'de' MMMM, HH:mm", { locale: es })
    : "";

  // ─── Submitted state ──────────────────────────────────────────────────────
  if (submitted) {
    return (
      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.submittedWrap}>
          <View style={s.submittedIcon}>
            <Text style={{ fontSize: 44 }}>✅</Text>
          </View>
          <Text style={s.submittedTitle}>¡Gracias por tu valoración!</Text>
          <Text style={s.submittedSub}>
            Tu opinión ayuda a mejorar el servicio de tu comunidad.
          </Text>
          <View style={s.submittedStars}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Text key={i} style={[s.starChar, { color: i <= rating ? "#F59E0B" : "#E5E7EB" }]}>
                ★
              </Text>
            ))}
          </View>
          <TouchableOpacity
            style={s.submitBtn}
            onPress={() => router.replace("/(vecino)/incidents")}
            activeOpacity={0.88}
          >
            <Text style={s.submitBtnText}>Ir a mis incidencias</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={s.headerSection}>
          <Text style={s.pageTitle}>Tu opinión cuenta 🛡️</Text>
          <Text style={s.pageSubtitle}>
            El técnico ha terminado el trabajo. Revísalo y cuéntanos qué te parece.
          </Text>
        </View>

        {/* ── Info banner ─────────────────────────────────────────────────── */}
        <View style={s.infoBanner}>
          <Text style={s.infoBannerIcon}>👥</Text>
          <Text style={s.infoBannerText}>
            Tu valoración quedará registrada para el Administrador de Finca como parte de la trazabilidad.
          </Text>
        </View>

        {/* ── Incident card ───────────────────────────────────────────────── */}
        <View style={s.incidentCard}>
          <View style={s.incidentCardTop}>
            <Text style={s.incidentId}>Incidencia {displayId}</Text>
            <View style={s.workedBadge}>
              <Text style={s.workedBadgeText}>Trabajado</Text>
            </View>
          </View>
          {resolvedDate ? (
            <Text style={s.incidentDate}>Hoy, {format(new Date(), "HH:mm", { locale: es })}</Text>
          ) : null}

          {/* Photos: before → after */}
          {incident && (incident as any).photoUrl && (
            <View style={s.photosRow}>
              <View style={s.photoWrap}>
                <Text style={s.photoCaption}>Así estaba el problema</Text>
                <Image
                  source={{ uri: (incident as any).photoUrl }}
                  style={s.photoImg}
                  resizeMode="cover"
                />
              </View>
              <View style={s.photoArrowWrap}>
                <Text style={s.photoArrow}>→</Text>
              </View>
              <View style={s.photoWrap}>
                <Text style={s.photoCaption}>Así lo ha dejado el técnico</Text>
                {(incident as any).finalPhotoUrl ? (
                  <>
                    <Image
                      source={{ uri: (incident as any).finalPhotoUrl }}
                      style={s.photoImg}
                      resizeMode="cover"
                    />
                    <View style={s.resolvedBadgeOverlay}>
                      <Text style={s.resolvedBadgeText}>RESUELTA</Text>
                    </View>
                  </>
                ) : (
                  <View style={[s.photoImg, s.photoPlaceholder]}>
                    <Text style={{ fontSize: 13, color: MUTED, textAlign: "center" }}>
                      Sin foto del técnico
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        {/* ── Stars ───────────────────────────────────────────────────────── */}
        <View style={s.ratingSection}>
          <Text style={s.ratingQuestion}>¿Qué te ha parecido el trabajo?</Text>
          <Text style={s.ratingSubtitle}>Tu valoración ayuda a mantener un servicio de calidad.</Text>

          <View style={s.starsRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setRating(i)}
                onPressIn={() => setHoveredStar(i)}
                onPressOut={() => setHoveredStar(0)}
                activeOpacity={0.9}
                style={{ padding: 4 }}
              >
                <Text style={[s.starChar, { fontSize: 44, color: i <= displayRating ? "#F59E0B" : "#E5E7EB" }]}>
                  ★
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {displayRating > 0 && (
            <Text style={s.starLabel}>{STAR_LABELS[displayRating]}</Text>
          )}
        </View>

        {/* ── Comment ─────────────────────────────────────────────────────── */}
        <View style={s.commentSection}>
          <Text style={s.commentLabel}>Cuéntanos más (opcional)</Text>
          <TextInput
            style={s.commentInput}
            placeholder="Escribe aquí tu comentario..."
            placeholderTextColor="#9CA3AF"
            multiline
            value={comment}
            onChangeText={setComment}
            textAlignVertical="top"
            maxLength={250}
          />
          <Text style={s.commentCounter}>{comment.length}/250</Text>
        </View>

        {/* ── Thank you note ──────────────────────────────────────────────── */}
        <View style={s.thanksBanner}>
          <Text style={s.thanksBannerIcon}>🛡️</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.thanksBannerTitle}>¡Gracias!</Text>
            <Text style={s.thanksBannerText}>
              Tu valoración se envía al Administrador de Finca y queda registrada para futuras consultas.
            </Text>
          </View>
        </View>

        {/* ── Submit ──────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[s.submitBtn, (!rating || submitRating.isPending) && s.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!rating || submitRating.isPending}
          activeOpacity={0.88}
        >
          {submitRating.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.submitBtnText}>✅ Enviar valoración</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={s.skipBtn}
          onPress={() => router.replace("/(vecino)/incidents")}
          activeOpacity={0.7}
        >
          <Text style={s.skipBtnText}>Ir a mis incidencias</Text>
        </TouchableOpacity>

        <Text style={s.privacyNote}>🔒 Tu evaluación es anónima y segura</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 36 },

  // Header
  headerSection: { alignItems: "center", marginBottom: 20 },
  pageTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: DARK,
    textAlign: "center",
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    lineHeight: 20,
  },

  // Info banner
  infoBanner: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#DCFCE7",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    alignItems: "flex-start",
  },
  infoBannerIcon: { fontSize: 18, marginTop: 1 },
  infoBannerText: { flex: 1, fontSize: 13, color: "#166534", lineHeight: 18 },

  // Incident card
  incidentCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  incidentCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  incidentId: { fontSize: 14, fontWeight: "700", color: DARK },
  workedBadge: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  workedBadgeText: { fontSize: 12, fontWeight: "700", color: "#065F46" },
  incidentDate: { fontSize: 12, color: MUTED, marginBottom: 12 },

  // Photos
  photosRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  photoWrap: { flex: 1, position: "relative" },
  photoCaption: { fontSize: 11, color: MUTED, fontWeight: "600", textAlign: "center", marginBottom: 4 },
  photoImg: { width: "100%", aspectRatio: 1, borderRadius: 10 },
  photoPlaceholder: {
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  photoArrowWrap: { width: 30, alignItems: "center", paddingTop: 18 },
  photoArrow: { fontSize: 18, color: MUTED },
  resolvedBadgeOverlay: {
    position: "absolute",
    top: 8,
    right: 4,
    backgroundColor: GREEN,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  resolvedBadgeText: { fontSize: 9, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },

  // Rating section
  ratingSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  ratingQuestion: {
    fontSize: 18,
    fontWeight: "700",
    color: DARK,
    textAlign: "center",
    marginBottom: 4,
  },
  ratingSubtitle: { fontSize: 13, color: MUTED, textAlign: "center", marginBottom: 16 },
  starsRow: { flexDirection: "row", gap: 2, marginBottom: 8 },
  starChar: { fontWeight: "400" },
  starLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: PRIMARY,
    height: 22,
  },

  // Comment
  commentSection: { marginBottom: 16 },
  commentLabel: { fontSize: 14, fontWeight: "600", color: DARK, marginBottom: 8 },
  commentInput: {
    backgroundColor: BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: DARK,
    minHeight: 88,
    lineHeight: 20,
  },
  commentCounter: { fontSize: 11, color: MUTED, textAlign: "right", marginTop: 4 },

  // Thanks banner
  thanksBanner: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#DCFCE7",
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    alignItems: "flex-start",
  },
  thanksBannerIcon: { fontSize: 18 },
  thanksBannerTitle: { fontSize: 14, fontWeight: "700", color: "#166534", marginBottom: 2 },
  thanksBannerText: { fontSize: 13, color: "#166534", lineHeight: 18 },

  // Buttons
  submitBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: PRIMARY,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  skipBtn: {
    backgroundColor: BG,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  skipBtnText: { color: DARK, fontSize: 15, fontWeight: "600" },
  privacyNote: { textAlign: "center", fontSize: 12, color: MUTED },

  // Submitted
  submittedWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  submittedIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  submittedTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: DARK,
    textAlign: "center",
    marginBottom: 8,
  },
  submittedSub: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  submittedStars: { flexDirection: "row", gap: 4, marginBottom: 32 },
});
