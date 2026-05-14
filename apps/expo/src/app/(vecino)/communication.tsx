import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "~/utils/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const TENANT_ID = "org_aconvi_demo";

// ─── Paleta ───────────────────────────────────────────────────────────────────
const TEAL = "#00BDA5";
const DARK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";
const BG = "#f8fafc";

// ─── Tipo de aviso ────────────────────────────────────────────────────────────
type NoticeType = "COMUNICADO" | "AVISO" | "URGENTE" | "ALL";

const TYPE_CONFIG = {
  COMUNICADO: {
    emoji: "📋",
    label: "Comunicado",
    bg: "#eff6ff",
    border: "#bfdbfe",
    text: "#1d4ed8",
    badgeBg: "#dbeafe",
  },
  AVISO: {
    emoji: "📢",
    label: "Aviso",
    bg: "#fffbeb",
    border: "#fde68a",
    text: "#92400e",
    badgeBg: "#fef3c7",
  },
  URGENTE: {
    emoji: "🚨",
    label: "Urgente",
    bg: "#fff1f2",
    border: "#fecdd3",
    text: "#9f1239",
    badgeBg: "#ffe4e6",
  },
} as const;

function getConfig(type: string) {
  return TYPE_CONFIG[type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.COMUNICADO;
}

function formatRelative(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora mismo";
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  return format(d, "d MMM yyyy", { locale: es });
}

// ─── Detail Modal ──────────────────────────────────────────────────────────────
function NoticeDetailModal({
  notice,
  visible,
  onClose,
}: {
  notice: any;
  visible: boolean;
  onClose: () => void;
}) {
  if (!notice) return null;
  const cfg = getConfig(notice.type ?? "COMUNICADO");

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[modalStyles.safe, { backgroundColor: cfg.bg }]}>
        {/* Header */}
        <View style={modalStyles.header}>
          <View style={[modalStyles.typeTag, { backgroundColor: cfg.badgeBg, borderColor: cfg.border }]}>
            <Text style={{ fontSize: 14 }}>{cfg.emoji}</Text>
            <Text style={[modalStyles.typeTagText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
          <TouchableOpacity style={modalStyles.closeBtn} onPress={onClose}>
            <Text style={modalStyles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={modalStyles.scroll} contentContainerStyle={modalStyles.scrollContent}>
          {/* Title */}
          <Text style={modalStyles.title}>{notice.title}</Text>

          {/* Meta */}
          <View style={modalStyles.metaRow}>
            <Text style={modalStyles.metaText}>
              👤 {notice.author?.name ?? "Administrador"}
            </Text>
            <Text style={modalStyles.metaText}>
              🕒 {formatRelative(notice.createdAt)}
            </Text>
          </View>

          {/* Separator */}
          <View style={modalStyles.divider} />

          {/* Content */}
          <Text style={modalStyles.content}>{notice.content}</Text>

          {/* Push sent indicator */}
          <View style={modalStyles.pushBadge}>
            <Text style={modalStyles.pushBadgeText}>
              🔔 Notificación push enviada a todos los vecinos
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Notice Card ──────────────────────────────────────────────────────────────
function NoticeCard({ notice, onPress }: { notice: any; onPress: () => void }) {
  const cfg = getConfig(notice.type ?? "COMUNICADO");
  const isPinned = notice.pinned;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderLeftColor: cfg.border, borderLeftWidth: 4 },
        isPinned && styles.cardPinned,
      ]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      {/* Top row */}
      <View style={styles.cardTop}>
        <View style={[styles.typeBadge, { backgroundColor: cfg.badgeBg }]}>
          <Text style={styles.typeBadgeEmoji}>{cfg.emoji}</Text>
          <Text style={[styles.typeBadgeLabel, { color: cfg.text }]}>{cfg.label}</Text>
        </View>
        {isPinned && (
          <View style={styles.pinnedBadge}>
            <Text style={styles.pinnedBadgeText}>📌 Fijado</Text>
          </View>
        )}
        <Text style={styles.dateText}>{formatRelative(notice.createdAt)}</Text>
      </View>

      {/* Title */}
      <Text style={styles.cardTitle} numberOfLines={2}>{notice.title}</Text>

      {/* Content preview */}
      <Text style={styles.cardPreview} numberOfLines={3}>
        {notice.content}
      </Text>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <Text style={styles.authorText}>
          {notice.author?.name ?? "Administrador"}
        </Text>
        <Text style={styles.readMoreText}>Leer más ›</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyState({ filter }: { filter: NoticeType }) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>📭</Text>
      <Text style={styles.emptyTitle}>
        {filter === "ALL" ? "Sin comunicados" : `Sin ${getConfig(filter).label.toLowerCase()}s`}
      </Text>
      <Text style={styles.emptySubtitle}>
        {filter === "ALL"
          ? "El administrador publicará comunicados aquí cuando haya novedades en tu comunidad."
          : `No hay ${getConfig(filter).label.toLowerCase()}s publicados.`}
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CommunicationScreen() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<NoticeType>("ALL");
  const [selectedNotice, setSelectedNotice] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: notices, isLoading } = useQuery(
    api.notice.all.queryOptions({ tenantId: TENANT_ID })
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries(
      api.notice.all.queryFilter({ tenantId: TENANT_ID })
    );
    setRefreshing(false);
  }, [queryClient]);

  const noticesArray = (notices as any[] | undefined) || [];

  // Sort: pinned first, then by date
  const sorted = [...noticesArray].sort((a: any, b: any) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

  const filtered =
    filter === "ALL"
      ? sorted
      : sorted.filter((n: any) => (n.type ?? "COMUNICADO") === filter);

  const counts = {
    ALL: noticesArray.length ?? 0,
    URGENTE: noticesArray.filter((n: any) => n.type === "URGENTE").length ?? 0,
    AVISO: noticesArray.filter((n: any) => n.type === "AVISO").length ?? 0,
    COMUNICADO: noticesArray.filter((n: any) => (n.type ?? "COMUNICADO") === "COMUNICADO").length ?? 0,
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Tablón Digital</Text>
          <Text style={styles.headerSubtitle}>Comunicados y avisos de tu comunidad</Text>
        </View>
        {counts.URGENTE > 0 && (
          <View style={styles.urgentBadge}>
            <Text style={styles.urgentBadgeText}>🚨 {counts.URGENTE}</Text>
          </View>
        )}
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {(["ALL", "URGENTE", "AVISO", "COMUNICADO"] as NoticeType[]).map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.filterTab, filter === key && styles.filterTabActive]}
            onPress={() => setFilter(key)}
          >
            <Text style={[styles.filterTabText, filter === key && styles.filterTabTextActive]}>
              {key === "ALL" ? "Todos" : getConfig(key).label}
            </Text>
            {counts[key] > 0 && (
              <View style={[styles.filterCount, filter === key && styles.filterCountActive]}>
                <Text style={[styles.filterCountText, filter === key && styles.filterCountTextActive]}>
                  {counts[key]}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.loadingText}>Cargando tablón...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item: any) => item.id}
          renderItem={({ item }) => (
            <NoticeCard notice={item} onPress={() => setSelectedNotice(item)} />
          )}
          contentContainerStyle={[
            styles.listContent,
            filtered.length === 0 && styles.listContentEmpty,
          ]}
          ListEmptyComponent={<EmptyState filter={filter} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={TEAL}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Detail modal */}
      <NoticeDetailModal
        notice={selectedNotice}
        visible={!!selectedNotice}
        onClose={() => setSelectedNotice(null)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: DARK,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: MUTED,
    marginTop: 2,
  },
  urgentBadge: {
    backgroundColor: "#ffe4e6",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  urgentBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9f1239",
  },

  filterScroll: { backgroundColor: "#fff", maxHeight: 52 },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: "#fff",
  },
  filterTabActive: {
    backgroundColor: DARK,
    borderColor: DARK,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: MUTED,
  },
  filterTabTextActive: {
    color: "#fff",
  },
  filterCount: {
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
  },
  filterCountActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: MUTED,
  },
  filterCountTextActive: {
    color: "#fff",
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, fontSize: 14, color: MUTED },

  listContent: { padding: 16, gap: 12 },
  listContentEmpty: { flex: 1 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardPinned: {
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffef7",
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typeBadgeEmoji: { fontSize: 12 },
  typeBadgeLabel: { fontSize: 11, fontWeight: "700" },

  pinnedBadge: {
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pinnedBadgeText: { fontSize: 11, fontWeight: "600", color: "#92400e" },

  dateText: {
    fontSize: 11,
    color: MUTED,
    marginLeft: "auto" as any,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: DARK,
    marginBottom: 6,
    lineHeight: 22,
  },
  cardPreview: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 20,
    marginBottom: 12,
  },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  authorText: { fontSize: 12, color: MUTED, fontWeight: "500" },
  readMoreText: { fontSize: 12, color: TEAL, fontWeight: "700" },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    minHeight: 300,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: DARK,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    lineHeight: 22,
  },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────
const modalStyles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  typeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  typeTagText: { fontSize: 13, fontWeight: "700" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { fontSize: 16, color: MUTED, fontWeight: "600" },

  scroll: { flex: 1 },
  scrollContent: { padding: 24 },

  title: {
    fontSize: 22,
    fontWeight: "800",
    color: DARK,
    lineHeight: 30,
    marginBottom: 14,
    letterSpacing: -0.5,
  },
  metaRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  metaText: { fontSize: 13, color: MUTED },

  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginBottom: 20,
  },

  content: {
    fontSize: 16,
    color: "#334155",
    lineHeight: 26,
  },

  pushBadge: {
    marginTop: 28,
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  pushBadgeText: {
    fontSize: 13,
    color: "#166534",
    fontWeight: "600",
    textAlign: "center",
  },
});
