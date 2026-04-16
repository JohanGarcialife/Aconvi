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

const PRIMARY = "#0E9495"; // Teal color from mockup
const DARK = "#111827"; // Dark text
const MUTED = "#6B7280"; // Gray text
const BORDER = "#E5E7EB"; // Light border
const BG = "#F9FAFB"; // Very light background
const CARD_BG = "#FFFFFF";

// ─── Inline SVGs / Icons (Using Text emojis for simplicity and consistency)
const Icons = {
  Bell: "🔔",
  User: "👤",
  Search: "🔍",
  Euro: "€",
  Megaphone: "📢",
  Drop: "💧",
  Pool: "🏊",
  ChevronRight: "›",
};

// ─── Aconvi Logo Component ───────────────────────────────────────────────────
function AconviLogo() {
  return (
    <View style={styles.logoContainer}>
      <Text style={styles.logoA}>A</Text>
      <View style={styles.logoLine} />
      <Text style={styles.logoConvi}>Aconvi</Text>
    </View>
  );
}

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

export default function VecinoHome() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* ── Top Bar ── */}
      <View style={styles.topBar}>
        <AconviLogo />
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconButton}>
            <Text style={{ fontSize: 20 }}>{Icons.Bell}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>2</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Text style={{ fontSize: 22 }}>{Icons.User}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Search Bar ── */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>{Icons.Search}</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar actualizaciones, documentos, pagos..."
            placeholderTextColor={MUTED}
            editable={false}
          />
        </View>

        {/* ── Votación Activa Card ── */}
        <View style={styles.card}>
          <SectionTitle title="Votación Activa" />
          <Text style={styles.cardTitleMedium}>Rehabilitación del ascensor</Text>
          <Text style={styles.votingAmount}>5.500 €</Text>
          <Text style={styles.mutedText}>
            Fecha límite: 18 sept. · 23:59 h
          </Text>
          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Votar ahora</Text>
            <Text style={[styles.primaryButtonText, { fontSize: 18, marginLeft: 6 }]}>→</Text>
          </TouchableOpacity>
        </View>

        {/* ── Mis Cuotas Card ── */}
        <View style={styles.card}>
          <SectionTitle title="Mis Cuotas" />
          <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
            <View style={styles.euroCircle}>
              <Text style={styles.euroCircleText}>{Icons.Euro}</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.cardTitleSmall}>
                <Text style={{ fontWeight: "700", color: DARK }}>150 €</Text> pendientes
              </Text>
              <Text style={styles.mutedText}>Actualizado hoy, 10:45</Text>
            </View>
            <Text style={styles.chevron}>{Icons.ChevronRight}</Text>
          </TouchableOpacity>
          
          <View style={styles.divider} />
          <TouchableOpacity style={styles.textLinkButton}>
            <Text style={styles.textLink}>Ver IBAN →</Text>
          </TouchableOpacity>
        </View>

        {/* ── Comunicados Card ── */}
        <View style={styles.card}>
          <SectionTitle title="Comunicados" />
          <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
            <View style={styles.iconBox}>
              <Text style={styles.iconLarge}>{Icons.Megaphone}</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.cardTitleSmall}>Mantenimiento del ascensor</Text>
              <Text style={styles.mutedText}>14 sept. · 09:00 - 09:45</Text>
            </View>
            <Text style={styles.chevron}>{Icons.ChevronRight}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Incidencias Card ── */}
        <View style={styles.card}>
          <SectionTitle 
            title="Incidencias" 
            action="+ Añadir" 
            onAction={() => router.push("/(vecino)/incidents/new")} 
          />
          <TouchableOpacity 
            style={styles.rowItem} 
            activeOpacity={0.7}
            onPress={() => router.push("/(vecino)/incidents/1")}
          >
            <View style={styles.iconBox}>
              <Text style={[styles.iconLarge, { color: PRIMARY }]}>{Icons.Drop}</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.cardTitleSmall}>Filtración en Garaje P.2</Text>
              <Text style={styles.mutedText}>Reparación finalizada · Hoy, 10:45</Text>
            </View>
            <Text style={styles.chevron}>{Icons.ChevronRight}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Reservas de Zonas Comunes Card ── */}
        <View style={[styles.card, { marginBottom: 32 }]}>
          <SectionTitle title="Reservas de Zonas Comunes" />
          <View style={styles.rowItem}>
            <View style={styles.iconBox}>
              <Text style={styles.iconLarge}>{Icons.Pool}</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.cardTitleSmall}>Piscina</Text>
              <Text style={styles.mutedText}>Disponible hoy · Hasta las 20:00 h</Text>
            </View>
            <TouchableOpacity style={styles.outlineButton}>
              <Text style={styles.outlineButtonText}>Reservar</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollView: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  
  // Header
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: BG,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoA: {
    fontSize: 28,
    fontWeight: "800",
    color: "#2C3E50",
    letterSpacing: -1,
  },
  logoLine: {
    width: 14,
    height: 4,
    backgroundColor: PRIMARY,
    marginHorizontal: 3,
    transform: [{ rotate: "-20deg" }],
  },
  logoConvi: {
    fontSize: 24,
    fontWeight: "600",
    color: DARK,
    marginLeft: 2,
  },
  headerIcons: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  iconButton: {
    position: "relative",
    padding: 4,
  },
  badge: {
    position: "absolute",
    top: 0,
    right: -2,
    backgroundColor: PRIMARY,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BG,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
  },

  // Search Bar
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  searchIcon: {
    fontSize: 16,
    color: MUTED,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: DARK,
  },

  // Cards
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
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: MUTED,
    letterSpacing: 0.5,
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: "600",
    color: PRIMARY,
  },

  // Typography Inside Cards
  cardTitleMedium: {
    fontSize: 18,
    fontWeight: "500",
    color: DARK,
    marginBottom: 6,
  },
  votingAmount: {
    fontSize: 28,
    fontWeight: "700",
    color: DARK,
    marginBottom: 6,
  },
  mutedText: {
    fontSize: 13,
    color: MUTED,
  },

  // Buttons
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
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  outlineButtonText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: "500",
  },
  textLinkButton: {
    marginTop: 8,
    alignSelf: "flex-start",
  },
  textLink: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: "600",
  },

  // List Rows
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBox: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  iconLarge: {
    fontSize: 22,
    color: DARK, // Or generic icon color
  },
  euroCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  euroCircleText: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "700",
  },
  rowContent: {
    flex: 1,
    justifyContent: "center",
  },
  cardTitleSmall: {
    fontSize: 15,
    fontWeight: "500",
    color: DARK,
    marginBottom: 2,
  },
  chevron: {
    fontSize: 20,
    color: MUTED,
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 16,
  },
});
