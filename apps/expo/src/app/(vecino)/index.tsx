import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Image,
  Modal,
  FlatList,
  Alert,
  Platform,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { api } from "~/utils/api";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const TENANT_ID = "org_aconvi_demo";

const PRIMARY = "#0E9495";
const DARK = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const BG = "#F9FAFB";
const CARD_BG = "#FFFFFF";

// ─── Section Header Title Component ──────────────────────────────────────────
function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Search Modal ─────────────────────────────────────────────────────────────
function SearchModal({
  visible,
  onClose,
  incidents,
  notices,
  votings,
}: {
  visible: boolean;
  onClose: () => void;
  incidents: any[];
  notices: any[];
  votings: any[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const items: { type: string; label: string; subtitle: string; route: string; emoji: string }[] = [];

    incidents?.forEach((i: any) => {
      if (i.title?.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q)) {
        items.push({ type: "Incidencia", label: i.title, subtitle: i.status, route: `/(vecino)/incidents/${i.id}`, emoji: "⚠️" });
      }
    });
    notices?.forEach((n: any) => {
      if (n.title?.toLowerCase().includes(q) || n.body?.toLowerCase().includes(q)) {
        items.push({ type: "Comunicado", label: n.title, subtitle: format(new Date(n.createdAt), "dd MMM", { locale: es }), route: "/(vecino)/communication", emoji: "📢" });
      }
    });
    votings?.forEach((v: any) => {
      if (v.title?.toLowerCase().includes(q)) {
        items.push({ type: "Votación", label: v.title, subtitle: v.status === "OPEN" ? "Abierta" : "Cerrada", route: "/(vecino)/voting", emoji: "🗳️" });
      }
    });
    return items;
  }, [query, incidents, notices, votings]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top"]}>
        <View style={searchStyles.header}>
          <TextInput
            style={searchStyles.input}
            placeholder="Buscar actualizaciones, documentos, pagos..."
            placeholderTextColor={MUTED}
            autoFocus
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          <TouchableOpacity onPress={() => { setQuery(""); onClose(); }} style={searchStyles.cancelBtn}>
            <Text style={searchStyles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>

        {query.trim() === "" ? (
          <View style={searchStyles.emptyState}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>🔍</Text>
            <Text style={{ color: MUTED, fontSize: 15 }}>Escribe para buscar en tu comunidad</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={searchStyles.emptyState}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>🤷</Text>
            <Text style={{ color: MUTED, fontSize: 15 }}>Sin resultados para "{query}"</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={searchStyles.result}
                onPress={() => {
                  onClose();
                  setQuery("");
                  router.push(item.route as any);
                }}
              >
                <Text style={{ fontSize: 22, marginRight: 12 }}>{item.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={searchStyles.resultLabel}>{item.label}</Text>
                  <Text style={searchStyles.resultSub}>{item.type} · {item.subtitle}</Text>
                </View>
                <Text style={{ color: MUTED, fontSize: 18 }}>›</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── Profile Modal ────────────────────────────────────────────────────────────
function ProfileModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top"]}>
        <View style={{ padding: 20, alignItems: "center", borderBottomWidth: 1, borderBottomColor: BORDER }}>
          <Text style={{ fontSize: 40, marginBottom: 8 }}>👤</Text>
          <Text style={{ fontSize: 18, fontWeight: "700", color: DARK }}>Mi Perfil</Text>
          <Text style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>Vecino — Aconvi Demo</Text>
        </View>
        {[
          { emoji: "€", label: "Mis Cuotas", route: "/(vecino)/fees" },
          { emoji: "📋", label: "Mis Reservas", route: "/(vecino)/common-areas" },
          { emoji: "📄", label: "Documentos", route: "/(vecino)/documents" },
        ].map((item) => (
          <TouchableOpacity
            key={item.route}
            style={{ flexDirection: "row", alignItems: "center", padding: 18, borderBottomWidth: 1, borderBottomColor: BORDER }}
            onPress={() => { onClose(); router.push(item.route as any); }}
          >
            <Text style={{ fontSize: 22, marginRight: 14 }}>{item.emoji}</Text>
            <Text style={{ fontSize: 16, color: DARK, fontWeight: "500", flex: 1 }}>{item.label}</Text>
            <Text style={{ color: MUTED, fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={{ margin: 24, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 16, alignItems: "center" }}
          onPress={() => Alert.alert("Cerrar sesión", "¿Seguro?", [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Salir",
              style: "destructive",
              onPress: async () => {
                await SecureStore.deleteItemAsync("expo_session_token").catch(() => {});
                onClose();
                router.replace("/login");
              },
            },
          ])}
        >
          <Text style={{ color: "#DC2626", fontWeight: "700", fontSize: 15 }}>Cerrar sesión</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: "center" }} onPress={onClose}>
          <Text style={{ color: PRIMARY, fontSize: 15, fontWeight: "600" }}>Cerrar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function VecinoHome() {
  const router = useRouter();
  const [searchVisible, setSearchVisible] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);

  // ── Data Fetching ──
  const { data: votings, isLoading: loadingVoting } = useQuery(
    api.voting.all.queryOptions({ tenantId: TENANT_ID })
  );
  const { data: notices, isLoading: loadingNotice } = useQuery(
    api.notice.all.queryOptions({ tenantId: TENANT_ID })
  );
  const { data: incidents, isLoading: loadingIncident } = useQuery(
    api.incident.all.queryOptions({ tenantId: TENANT_ID })
  );
  const { data: bookings, isLoading: loadingBooking } = useQuery(
    api.commonArea.myBookings.queryOptions()
  );
  
  const DEMO_AUTHOR_ID = "user_admin";
  const { data: fees, isLoading: loadingFees } = useQuery(
    api.fee.myFees.queryOptions({ tenantId: TENANT_ID, userId: DEMO_AUTHOR_ID })
  );

  // ── Computed Values ──
  const activeVoting = (votings as any[] | undefined)
    ?.filter((v: any) => v.status === "OPEN")
    ?.sort((a: any, b: any) => (a.closesAt && b.closesAt ? new Date(a.closesAt).getTime() - new Date(b.closesAt).getTime() : 0))[0];

  const latestNotice = (notices as any[] | undefined)?.[0];
  const latestIncident = (incidents as any[] | undefined)?.[0];

  const nextBooking = (bookings as any[] | undefined)?.filter((b: any) => {
    const today = format(new Date(), "yyyy-MM-dd");
    return b.date >= today;
  })[0];

  // Notification badge = unread notices
  const notifCount = (notices as any[])?.length ?? 0;

  // Compute pending fees
  const pendingAmount = fees
    ?.filter((f: any) => f.status === "PENDING")
    .reduce((acc: number, f: any) => acc + f.amount, 0) ?? 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* ── Top Bar ── */}
      <View style={styles.topBar}>
        <Image
          source={require("../../../assets/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.headerIcons}>
          {/* Bell — navigates to communication */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push("/(vecino)/communication")}
          >
            <Text style={{ fontSize: 22 }}>🔔</Text>
            {notifCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{notifCount > 9 ? "9+" : notifCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          {/* Profile — opens modal */}
          <TouchableOpacity style={styles.iconButton} onPress={() => setProfileVisible(true)}>
            <Text style={{ fontSize: 22 }}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Search Bar ── (abre modal de búsqueda) */}
        <TouchableOpacity
          style={styles.searchContainer}
          activeOpacity={0.7}
          onPress={() => setSearchVisible(true)}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>
            Buscar actualizaciones, documentos, pagos...
          </Text>
        </TouchableOpacity>

        {/* ── Votación Activa Card ── */}
        <View style={styles.card}>
          <SectionTitle title="Votación Activa" />
          {loadingVoting ? (
            <ActivityIndicator color={PRIMARY} />
          ) : activeVoting ? (
            <>
              <Text style={styles.cardTitleMedium}>{activeVoting.title}</Text>
              <Text style={styles.votingAmount}>En curso</Text>
              <Text style={styles.mutedText}>
                {activeVoting.closesAt
                  ? `Fecha límite: ${format(new Date(activeVoting.closesAt), "dd MMM · HH:mm 'h'", { locale: es })}`
                  : "Sin fecha límite"}
              </Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.push("/(vecino)/voting")}
              >
                <Text style={styles.primaryButtonText}>Votar ahora</Text>
                <Text style={[styles.primaryButtonText, { fontSize: 18, marginLeft: 6 }]}>→</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.mutedText}>No hay votaciones activas en este momento.</Text>
          )}
        </View>

        {/* ── Mis Cuotas Card ── */}
        <View style={styles.card}>
          <SectionTitle title="Mis Cuotas" />
          <TouchableOpacity
            style={styles.rowItem}
            activeOpacity={0.7}
            onPress={() => router.push("/(vecino)/fees")}
          >
            <View style={styles.euroCircle}>
              <Text style={styles.euroCircleText}>€</Text>
            </View>
            <View style={styles.rowContent}>
              {loadingFees ? (
                <ActivityIndicator color={PRIMARY} style={{ alignSelf: "flex-start" }} />
              ) : (
                <>
                  <Text style={styles.cardTitleSmall}>
                    <Text style={{ fontWeight: "700", color: DARK }}>{pendingAmount} €</Text> pendientes
                  </Text>
                  <Text style={styles.mutedText}>
                    {fees?.length === 0 ? "Sin pagos pendientes" : "Actualizado hoy"}
                  </Text>
                </>
              )}
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.textLinkButton}
            onPress={() => router.push("/(vecino)/fees")}
          >
            <Text style={styles.textLink}>Ver IBAN →</Text>
          </TouchableOpacity>
        </View>

        {/* ── Comunicados Card ── */}
        <View style={styles.card}>
          <SectionTitle title="Comunicados" />
          {loadingNotice ? (
            <ActivityIndicator color={PRIMARY} />
          ) : latestNotice ? (
            <TouchableOpacity
              style={styles.rowItem}
              activeOpacity={0.7}
              onPress={() => router.push("/(vecino)/communication")}
            >
              <View style={styles.iconBox}>
                <Text style={styles.iconLarge}>
                  {latestNotice.type === "URGENTE" ? "🚨" : latestNotice.type === "AVISO" ? "📢" : "📋"}
                </Text>
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.cardTitleSmall}>{latestNotice.title}</Text>
                <Text style={styles.mutedText}>
                  {format(new Date(latestNotice.createdAt), "dd MMM · HH:mm", { locale: es })}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.mutedText}>No hay comunicados recientes.</Text>
          )}
        </View>

        {/* ── Incidencias Card ── */}
        <View style={styles.card}>
          <SectionTitle
            title="Incidencias"
            action="+ Añadir"
            onAction={() => router.push("/(vecino)/incidents/new")}
          />
          {loadingIncident ? (
            <ActivityIndicator color={PRIMARY} />
          ) : latestIncident ? (
            <TouchableOpacity
              style={styles.rowItem}
              activeOpacity={0.7}
              onPress={() => router.push(`/(vecino)/incidents/${latestIncident.id}`)}
            >
              <View style={styles.iconBox}>
                <Text style={[styles.iconLarge, { color: PRIMARY }]}>💧</Text>
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.cardTitleSmall}>{latestIncident.title}</Text>
                <Text style={styles.mutedText}>
                  Estado: {latestIncident.status} · {format(new Date(latestIncident.createdAt), "dd MMM", { locale: es })}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.mutedText}>No tienes incidencias reportadas.</Text>
          )}
        </View>

        {/* ── Reservas de Zonas Comunes Card ── */}
        <View style={[styles.card, { marginBottom: 32 }]}>
          <SectionTitle title="Reservas de Zonas Comunes" />
          {loadingBooking ? (
            <ActivityIndicator color={PRIMARY} />
          ) : nextBooking ? (
            <View style={styles.rowItem}>
              <View style={styles.iconBox}>
                <Text style={styles.iconLarge}>🏊</Text>
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.cardTitleSmall}>{nextBooking.commonArea?.name ?? "Zona Común"}</Text>
                <Text style={styles.mutedText}>
                  {format(new Date(nextBooking.date), "dd MMM", { locale: es })} · {nextBooking.startTime} h
                </Text>
              </View>
              <TouchableOpacity
                style={styles.outlineButton}
                onPress={() => router.push("/(vecino)/common-areas")}
              >
                <Text style={styles.outlineButtonText}>Ver reservas</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.rowItem}>
              <View style={styles.rowContent}>
                <Text style={styles.mutedText}>No tienes reservas próximas.</Text>
              </View>
              <TouchableOpacity
                style={styles.outlineButton}
                onPress={() => router.push("/(vecino)/common-areas")}
              >
                <Text style={styles.outlineButtonText}>Reservar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Modals ── */}
      <SearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        incidents={incidents as any[] ?? []}
        notices={notices as any[] ?? []}
        votings={votings as any[] ?? []}
      />
      <ProfileModal visible={profileVisible} onClose={() => setProfileVisible(false)} />
    </SafeAreaView>
  );
}

// ─── Search Styles ────────────────────────────────────────────────────────────
const searchStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: BG,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: DARK,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cancelBtn: { paddingHorizontal: 4 },
  cancelText: { color: PRIMARY, fontSize: 15, fontWeight: "600" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center" },
  result: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  resultLabel: { fontSize: 15, fontWeight: "600", color: DARK, marginBottom: 2 },
  resultSub: { fontSize: 12, color: MUTED },
});

// ─── Main Styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  scrollView: { flex: 1, backgroundColor: BG },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: BG,
  },
  logo: {
    height: 36,
    width: 120,
  },
  headerIcons: { flexDirection: "row", gap: 16, alignItems: "center" },
  iconButton: { position: "relative", padding: 4 },
  badge: {
    position: "absolute",
    top: 0,
    right: -4,
    backgroundColor: PRIMARY,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: BG,
    paddingHorizontal: 2,
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchIcon: { fontSize: 16, color: MUTED, marginRight: 10 },
  searchPlaceholder: { fontSize: 14, color: MUTED, flex: 1 },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: MUTED, letterSpacing: 0.5 },
  sectionAction: { fontSize: 14, fontWeight: "600", color: PRIMARY },

  cardTitleMedium: { fontSize: 18, fontWeight: "500", color: DARK, marginBottom: 6 },
  votingAmount: { fontSize: 28, fontWeight: "700", color: DARK, marginBottom: 6 },
  mutedText: { fontSize: 13, color: MUTED },

  primaryButton: {
    flexDirection: "row",
    backgroundColor: PRIMARY,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    alignSelf: "flex-start",
  },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  outlineButton: {
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  outlineButtonText: { color: PRIMARY, fontSize: 14, fontWeight: "500" },
  textLinkButton: { marginTop: 8, alignSelf: "flex-start" },
  textLink: { color: PRIMARY, fontSize: 14, fontWeight: "600" },

  rowItem: { flexDirection: "row", alignItems: "center" },
  iconBox: { width: 40, height: 40, justifyContent: "center", alignItems: "center", marginRight: 14 },
  iconLarge: { fontSize: 22, color: DARK },
  euroCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: PRIMARY,
    alignItems: "center", justifyContent: "center", marginRight: 14,
  },
  euroCircleText: { fontSize: 20, color: "#fff", fontWeight: "700" },
  rowContent: { flex: 1, justifyContent: "center" },
  cardTitleSmall: { fontSize: 15, fontWeight: "500", color: DARK, marginBottom: 2 },
  chevron: { fontSize: 20, color: MUTED, marginLeft: 8 },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 16 },
});
