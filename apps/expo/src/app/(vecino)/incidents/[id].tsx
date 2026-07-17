import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "~/utils/api";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getBaseUrl } from "~/utils/base-url";

/** Converts a relative /uploads/... path to an absolute URL. Already-absolute URLs are returned unchanged. */
const resolvePhotoUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (
    url.startsWith("http") ||
    url.startsWith("file:") ||
    url.startsWith("ph:") ||
    url.startsWith("data:")
  ) {
    return url;
  }
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${getBaseUrl()}${path}`;
};

const PRIMARY = "#4aa19b";
const DARK = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const BG = "#F9FAFB";

const TENANT_ID = "org_aconvi_demo";

// ─── Human-readable status ────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  RECIBIDA:    { label: "Enviada",              icon: "✉️",  color: "#92400e", bg: "#fef3c7" },
  EN_REVISION: { label: "Revisando",            icon: "🔍",  color: "#1e40af", bg: "#dbeafe" },
  AGENDADA:    { label: "Agendada",             icon: "📅",  color: "#5b21b6", bg: "#ede9fe" },
  EN_CURSO:    { label: "En reparación",        icon: "🔧",  color: "#065f46", bg: "#d1fae5" },
  RESUELTA:    { label: "Pendiente de cierre",  icon: "🕒",  color: "#b45309", bg: "#fef3c7" },
  RECHAZADA:   { label: "Rechazada",            icon: "✕",   color: "#991b1b", bg: "#fee2e2" },
  CERRADA:     { label: "Cerrada",              icon: "✅",  color: "#065f46", bg: "#d1fae5" },
};

// ─── Timeline steps ───────────────────────────────────────────────────────────
type TimelineEntry = {
  key: string;
  label: string;
  detail: string;
  icon: string;
  date?: string;
  isCurrent?: boolean;
};

function buildTimeline(history: any[], currentStatus: string): TimelineEntry[] {
  const entries: TimelineEntry[] = history.map((h) => {
    const dateStr = format(new Date(h.createdAt), "d 'de' MMMM, HH:mm", { locale: es });
    if (h.action === "CREATED") {
      return { key: h.id, label: "Enviada", detail: "Hemos recibido tu solicitud y la estamos revisando.", icon: "✉️", date: dateStr };
    }
    if (h.action === "ASSIGNED") {
      return { key: h.id, label: "Técnico asignado", detail: `El especialista ha sido asignado a la tarea.`, icon: "👤", date: dateStr };
    }
    if (h.action === "COMPLETED" || h.newStatus === "RESUELTA") {
      return { key: h.id, label: "Resuelta", detail: "El técnico ha completado el trabajo. Pendiente de revisión por el administrador.", icon: "✅", date: dateStr };
    }
    if (h.newStatus === "CERRADA") {
      return { key: h.id, label: "Cerrada", detail: "El administrador ha revisado y cerrado la incidencia oficialmente.", icon: "🔒", date: dateStr };
    }
    if (h.action === "ARRIVED") {
      return { key: h.id, label: "Técnico en el lugar", detail: "El especialista ha llegado y está evaluando la incidencia.", icon: "📍", date: dateStr };
    }
    if (h.newStatus === "EN_CURSO") {
      return { key: h.id, label: "En reparación", detail: "El técnico está trabajando en la incidencia.", icon: "🔧", date: dateStr };
    }
    if (h.newStatus === "AGENDADA") {
      return { key: h.id, label: "Cita agendada", detail: "Se ha programado la visita del técnico.", icon: "📅", date: dateStr };
    }
    if (h.newStatus === "EN_REVISION") {
      return { key: h.id, label: "En revisión", detail: "El administrador está revisando la incidencia.", icon: "🔍", date: dateStr };
    }
    return { key: h.id, label: h.action, detail: h.comment ?? "", icon: "•", date: dateStr };
  });

  // Mark the last entry as current
  if (entries.length > 0) {
    entries[entries.length - 1] = { ...entries[entries.length - 1]!, isCurrent: true };
  }

  return entries;
}

// ─── "Próximo paso" config ────────────────────────────────────────────────────
const NEXT_STEP: Record<string, { title: string; detail: string }> = {
  RECIBIDA:    { title: "Revisión del administrador",        detail: "Estamos revisando tu solicitud y te avisaremos pronto." },
  EN_REVISION: { title: "Asignación de técnico",           detail: "Un especialista será asignado a tu incidencia." },
  AGENDADA:    { title: "Inicio de la reparación",         detail: "El técnico comenzará en la fecha acordada." },
  EN_CURSO:    { title: "Finalización de la reparación",   detail: "Te avisaremos cuando esté completado." },
  RESUELTA:    { title: "Revisión del administrador",        detail: "El administrador de finca está revisando el trabajo realizado antes de cerrar el expediente." },
};

export default function IncidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"seguimiento" | "detalles">("seguimiento");
  const [notifEnabled, setNotifEnabled] = useState(true);

  const isUuid = !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const { data: incident, isLoading } = useQuery({
    ...api.incident.byId.queryOptions({ id: id as string, tenantId: TENANT_ID }),
    enabled: isUuid,
    refetchInterval: 300_000,
  });

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={s.safe}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </SafeAreaView>
    );
  }

  if (!incident) {
    return (
      <SafeAreaView style={s.safe}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.center}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🔍</Text>
          <Text style={s.emptyTitle}>Incidencia no encontrada</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ fontSize: 14, color: PRIMARY, marginTop: 8 }}>← Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const st = STATUS_MAP[incident.status] ?? { label: incident.status, icon: "", color: MUTED, bg: BG };
  const timeline = buildTimeline(incident.history ?? [], incident.status);
  const nextStep = NEXT_STEP[incident.status];
  const displayId = `#INC-${id.slice(0, 8).toUpperCase()}`;
  const createdDate = format(new Date(incident.createdAt), "d 'de' MMMM, HH:mm", { locale: es });
  const isResolved = incident.status === "RESUELTA" || incident.status === "CERRADA";
  const isRejected = incident.status === "RECHAZADA";

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <Text style={s.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerLogo}>Aconvi</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Incident card ────────────────────────────────────────────────── */}
        <View style={s.incidentCard}>
          {/* Thumbnail */}
          <View style={s.incidentThumb}>
            {resolvePhotoUrl((incident as any).photoUrl) ? (
              <Image
                source={{ uri: resolvePhotoUrl((incident as any).photoUrl)! }}
                style={s.incidentThumbImg}
                resizeMode="cover"
              />
            ) : (
              <View style={[s.incidentThumbImg, s.thumbPlaceholder]}>
                <Text style={{ fontSize: 24 }}>⚠️</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={s.incidentCardTop}>
              <Text style={s.incidentTitle} numberOfLines={2}>{incident.title}</Text>
              <View style={[s.badge, { backgroundColor: st.bg }]}>
                <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
              </View>
            </View>
            <Text style={s.incidentMeta}>📍 {createdDate}</Text>
            <Text style={s.incidentId}>{displayId}</Text>
          </View>
        </View>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <View style={s.tabsWrap}>
          {(["seguimiento", "detalles"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[s.tabBtn, activeTab === t && s.tabBtnActive]}
              onPress={() => setActiveTab(t)}
              activeOpacity={0.75}
            >
              <Text style={[s.tabText, activeTab === t && s.tabTextActive]}>
                {t === "seguimiento" ? "Seguimiento" : "Detalles"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── SEGUIMIENTO tab ───────────────────────────────────────────────── */}
        {activeTab === "seguimiento" && (
          <View style={s.section}>
            {timeline.length > 0 ? (
              [...timeline].reverse().map((entry, idx, arr) => {
                const isLast = idx === arr.length - 1;
                return (
                  <View key={entry.key} style={s.timelineRow}>
                    {/* Icon column */}
                    <View style={s.timelineIconCol}>
                      <View style={[s.timelineCircle, entry.isCurrent && s.timelineCircleActive]}>
                        <Text style={[s.timelineCircleText, !entry.isCurrent && { color: MUTED }]}>
                          {entry.icon}
                        </Text>
                      </View>
                      {!isLast && <View style={[s.timelineLine, entry.isCurrent && s.timelineLineActive]} />}
                    </View>
                    {/* Content */}
                    <View style={s.timelineContent}>
                      <View style={s.timelineTitleRow}>
                        <Text style={[s.timelineLabel, entry.isCurrent && s.timelineLabelActive]}>
                          {entry.label}
                        </Text>
                        {entry.isCurrent && (
                          <View style={s.actualBadge}>
                            <Text style={s.actualBadgeText}>ACTUAL</Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.timelineDetail}>{entry.detail}</Text>
                      {entry.date && <Text style={s.timelineDate}>{entry.date}</Text>}
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={{ color: MUTED, fontSize: 14 }}>Sin historial aún.</Text>
            )}

            {/* ── Próximo paso ──────────────────────────────────────────────── */}
            {nextStep && !isResolved && !isRejected && (
              <View style={s.nextStepSection}>
                <Text style={s.nextStepLabel}>Próximo paso</Text>
                <View style={s.nextStepCard}>
                  <Text style={s.nextStepTitle}>{nextStep.title}</Text>
                  <Text style={s.nextStepDetail}>{nextStep.detail}</Text>
                </View>
              </View>
            )}

            {/* ── Rating CTA ────────────────────────────────────────────────── */}
            {isResolved && (
              <TouchableOpacity
                style={s.rateBtn}
                onPress={() => router.push(`/(vecino)/rating?incidentId=${id}`)}
                activeOpacity={0.85}
              >
                <Text style={s.rateBtnText}>✅ Valorar el servicio</Text>
              </TouchableOpacity>
            )}

            {/* ── Notifications toggle ──────────────────────────────────────── */}
            <View style={s.notifRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={s.notifText}>
                  Te notificaremos cada vez que haya una actualización en tu incidencia.
                </Text>
              </View>
              <Switch
                value={notifEnabled}
                onValueChange={setNotifEnabled}
                trackColor={{ false: "#D1D5DB", true: PRIMARY }}
                thumbColor="#fff"
              />
            </View>

            {/* ── Contact admin ─────────────────────────────────────────────── */}
            <TouchableOpacity
              style={s.contactBtn}
              onPress={() =>
                Alert.alert(
                  "Contactar al administrador",
                  "Puedes enviar un mensaje al administrador de tu comunidad desde la sección Comunicados.",
                  [{ text: "Entendido" }],
                )
              }
              activeOpacity={0.75}
            >
              <Text style={s.contactBtnText}>💬  Contactar con el administrador</Text>
              <Text style={s.contactChevron}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── DETALLES tab ──────────────────────────────────────────────────── */}
        {activeTab === "detalles" && (
          <View style={s.section}>
            {/* Description */}
            <View style={s.detailCard}>
              <Text style={s.detailLabel}>DESCRIPCIÓN</Text>
              <Text style={s.detailValue}>{incident.description}</Text>
            </View>

            {(incident as any).category && (
              <View style={s.detailCard}>
                <Text style={s.detailLabel}>CATEGORÍA</Text>
                <Text style={s.detailValue}>{(incident as any).category}</Text>
              </View>
            )}

            {incident.provider && (
              <View style={s.detailCard}>
                <Text style={s.detailLabel}>TÉCNICO ASIGNADO</Text>
                <Text style={s.detailValue}>{incident.provider.name}</Text>
              </View>
            )}

            {/* Photos */}
            {resolvePhotoUrl((incident as any).photoUrl) && (
              <View style={{ marginBottom: 16 }}>
                {resolvePhotoUrl((incident as any).finalPhotoUrl) ? (
                  <>
                    <Text style={[s.detailLabel, { marginBottom: 8 }]}>FOTOS</Text>
                    <View style={s.photosRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.photoCaption}>Así estaba</Text>
                        <Image
                          source={{ uri: resolvePhotoUrl((incident as any).photoUrl)! }}
                          style={s.photoImg}
                          resizeMode="cover"
                        />
                      </View>
                      <Text style={s.photoArrow}>→</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.photoCaption}>Después</Text>
                        <Image
                          source={{ uri: resolvePhotoUrl((incident as any).finalPhotoUrl)! }}
                          style={s.photoImg}
                          resizeMode="cover"
                        />
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={[s.detailLabel, { marginBottom: 8 }]}>FOTO</Text>
                    <Image
                      source={{ uri: resolvePhotoUrl((incident as any).photoUrl)! }}
                      style={{ width: "100%", height: 200, borderRadius: 14 }}
                      resizeMode="cover"
                    />
                  </>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: DARK },
  scroll: { paddingBottom: 40 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: "#fff",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: { fontSize: 26, color: DARK, fontWeight: "300", lineHeight: 30 },
  headerLogo: { fontSize: 20, fontWeight: "800", color: DARK, letterSpacing: -0.4 },

  // Incident summary card
  incidentCard: {
    flexDirection: "row",
    gap: 14,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: "#fff",
  },
  incidentThumb: { width: 64, height: 64, borderRadius: 12, overflow: "hidden", flexShrink: 0 },
  incidentThumbImg: { width: 64, height: 64, borderRadius: 12 },
  thumbPlaceholder: { backgroundColor: `${PRIMARY}12`, alignItems: "center", justifyContent: "center" },
  incidentCardTop: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 2 },
  incidentTitle: { fontSize: 15, fontWeight: "700", color: DARK, flex: 1, lineHeight: 20 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start", flexShrink: 0 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  incidentMeta: { fontSize: 12, color: MUTED },
  incidentId: { fontSize: 11, color: "#9CA3AF" },

  // Tabs
  tabsWrap: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: "#fff",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: BG,
  },
  tabBtnActive: {
    borderColor: PRIMARY,
    backgroundColor: `${PRIMARY}0D`,
  },
  tabText: { fontSize: 14, fontWeight: "600", color: MUTED },
  tabTextActive: { color: PRIMARY },

  // Section
  section: { paddingHorizontal: 20, paddingTop: 20 },

  // Timeline
  timelineRow: { flexDirection: "row", gap: 14, marginBottom: 4 },
  timelineIconCol: { alignItems: "center", width: 44 },
  timelineCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3F4F6",
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineCircleActive: {
    backgroundColor: `${PRIMARY}15`,
    borderColor: PRIMARY,
  },
  timelineCircleText: { fontSize: 18, color: "#fff" },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: BORDER,
    marginVertical: 4,
    minHeight: 20,
  },
  timelineLineActive: { backgroundColor: `${PRIMARY}50` },
  timelineContent: { flex: 1, paddingBottom: 24 },
  timelineTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  timelineLabel: { fontSize: 15, fontWeight: "600", color: MUTED },
  timelineLabelActive: { color: DARK },
  actualBadge: {
    backgroundColor: `${PRIMARY}18`,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  actualBadgeText: { fontSize: 10, fontWeight: "800", color: PRIMARY, letterSpacing: 0.5 },
  timelineDetail: { fontSize: 13, color: MUTED, lineHeight: 18, marginBottom: 4 },
  timelineDate: { fontSize: 12, color: "#9CA3AF" },

  // Próximo paso
  nextStepSection: { marginTop: 4, marginBottom: 20 },
  nextStepLabel: { fontSize: 13, fontWeight: "700", color: MUTED, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  nextStepCard: {
    backgroundColor: BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  nextStepTitle: { fontSize: 15, fontWeight: "700", color: DARK, marginBottom: 4 },
  nextStepDetail: { fontSize: 13, color: MUTED, lineHeight: 18 },

  // Rate
  rateBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: PRIMARY,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  rateBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Notification row
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${PRIMARY}0A`,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: `${PRIMARY}20`,
  },
  notifText: { fontSize: 13, color: DARK, lineHeight: 18 },

  // Contact admin
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  contactBtnText: { flex: 1, fontSize: 14, fontWeight: "600", color: DARK },
  contactChevron: { fontSize: 22, color: "#D1D5DB", fontWeight: "300" },

  // Detail cards
  detailCard: {
    backgroundColor: BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 12,
  },
  detailLabel: { fontSize: 10, fontWeight: "800", color: "#9CA3AF", letterSpacing: 1, marginBottom: 4 },
  detailValue: { fontSize: 14, color: DARK, lineHeight: 20 },

  // Photos
  photosRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  photoCaption: { fontSize: 12, color: MUTED, fontWeight: "600", marginBottom: 4, textAlign: "center" },
  photoImg: { width: "100%", aspectRatio: 1, borderRadius: 12 },
  photoArrow: { fontSize: 20, color: MUTED, fontWeight: "300" },
});
