import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

const PRIMARY = "#4aa19b";
const DARK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";
const BG = "#f8fafc";

// ─── Logo component ───────────────────────────────────────────────────────────
function AconviLogo() {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 0 }}>
      <Text style={styles.logoA}>A</Text>
      <View style={styles.logoDot} />
      <Text style={styles.logoConvi}>convi</Text>
    </View>
  );
}

// ─── Section header ──────────────────────────────────────────────────────────
function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function VecinoHome() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <AconviLogo />
        <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
          {/* Bell with badge */}
          <View style={{ position: "relative" }}>
            <Text style={{ fontSize: 22, color: DARK }}>🔔</Text>
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>2</Text>
            </View>
          </View>
          <Text style={{ fontSize: 22, color: DARK }}>👤</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: "#fff" }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Search bar */}
        <View style={styles.searchBar}>
          <Text style={{ fontSize: 14, color: "#94a3b8", marginRight: 8 }}>
            🔍
          </Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar actualizaciones, documentos, pagos..."
            placeholderTextColor="#94a3b8"
            editable={false}
          />
        </View>

        {/* ── Voting card ──────────────────────────────────────────── */}
        <View style={styles.votingCard}>
          <Text style={styles.votingAmount}>5.500 €</Text>
          <Text style={styles.votingTitle}>Rehabilitación Ascensor</Text>
          <Text style={styles.votingDeadline}>
            Fecha límite:{" "}
            <Text style={{ fontWeight: "700" }}>18 Sept. | 23:59 h</Text>
          </Text>
          <TouchableOpacity style={styles.votingButton}>
            <Text style={styles.votingButtonText}>Votar ahora →</Text>
          </TouchableOpacity>
        </View>

        {/* ── Fees card ──────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.feesRow}>
            <View style={styles.feesBadge}>
              <Text style={{ color: PRIMARY, fontSize: 16 }}>€</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.feesAmount}>
                <Text style={{ color: PRIMARY, fontWeight: "700" }}>150 €</Text>{" "}
                pendientes
              </Text>
              <Text style={styles.feesDate}>Actualizado · Hoy, 10:45</Text>
            </View>
            <Text style={{ color: MUTED, fontSize: 18 }}>›</Text>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.ibanButton}>
            <Text style={styles.ibanButtonText}>Ver IBAN →</Text>
          </TouchableOpacity>
        </View>

        {/* ── Comunicados ────────────────────────────────────────────── */}
        <View style={styles.card}>
          <SectionHeader title="Comunicados" />
          <TouchableOpacity style={styles.listRow}>
            <Text style={{ fontSize: 20, marginRight: 12 }}>📢</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.listRowTitle}>
                Mantenimiento del ascensor
              </Text>
              <Text style={styles.listRowSub}>14 Sept. | 09:00 - 09:45</Text>
            </View>
            <Text style={{ color: MUTED, fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Incidencias ────────────────────────────────────────────── */}
        <View style={styles.card}>
          <SectionHeader
            title="Incidencias"
            action="+ Añadir"
            onAction={() => router.push("/(vecino)/incidents/new")}
          />
          <TouchableOpacity
            style={styles.listRow}
            onPress={() => router.push("/(vecino)/incidents/1")}
          >
            <Text style={{ fontSize: 20, marginRight: 12, color: PRIMARY }}>
              💧
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.listRowTitle}>Filtración en Garaje P.2</Text>
              <Text style={[styles.listRowSub, { color: PRIMARY }]}>
                Reparación finalizada · Hoy, 10:45
              </Text>
            </View>
            <Text style={{ color: MUTED, fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Reservas de zonas comunes ─────────────────────────────── */}
        <View style={[styles.card, { marginBottom: 24 }]}>
          <SectionHeader title="Reservas de zonas comunes" />
          <View style={styles.reservaRow}>
            <Text style={{ fontSize: 20, marginRight: 12 }}>🏊</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.listRowTitle}>
                Piscina :{" "}
                <Text style={{ color: PRIMARY }}>Disponible hoy</Text>
              </Text>
              <Text style={styles.listRowSub}>Hasta las 20:00 h</Text>
            </View>
            <TouchableOpacity style={styles.reservarButton}>
              <Text style={styles.reservarButtonText}>Reservar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  logoA: {
    fontSize: 28,
    fontWeight: "800",
    color: DARK,
    letterSpacing: -1,
    lineHeight: 30,
  },
  logoDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: PRIMARY,
    marginBottom: 14,
    marginHorizontal: 1,
  },
  logoConvi: {
    fontSize: 28,
    fontWeight: "800",
    color: DARK,
    letterSpacing: -1,
    lineHeight: 30,
  },
  bellBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    backgroundColor: PRIMARY,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BG,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  searchInput: { flex: 1, fontSize: 13, color: DARK },
  // Voting
  votingCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  votingAmount: { fontSize: 36, fontWeight: "800", color: DARK },
  votingTitle: { fontSize: 15, color: MUTED, marginTop: 2 },
  votingDeadline: { fontSize: 13, color: MUTED, marginTop: 4 },
  votingButton: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 14,
  },
  votingButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  // Cards
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  // Fees
  feesRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  feesBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${PRIMARY}18`,
    alignItems: "center",
    justifyContent: "center",
  },
  feesAmount: { fontSize: 15, color: DARK, fontWeight: "600" },
  feesDate: { fontSize: 12, color: MUTED, marginTop: 2 },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 12 },
  ibanButton: {
    backgroundColor: BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 10,
    alignItems: "center",
  },
  ibanButtonText: { fontSize: 14, fontWeight: "600", color: DARK },
  // Lists
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: DARK },
  sectionAction: { fontSize: 13, fontWeight: "600", color: PRIMARY },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  listRowTitle: { fontSize: 14, fontWeight: "600", color: DARK },
  listRowSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  // Reserva
  reservaRow: { flexDirection: "row", alignItems: "center" },
  reservarButton: {
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  reservarButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
