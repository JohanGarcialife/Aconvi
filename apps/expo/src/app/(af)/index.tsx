import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { api, queryClient } from "~/utils/api";
import { authClient } from "~/utils/auth";

const TENANT_ID = "org_aconvi_demo";

const NAVY = "#0F2942";
const SUBTEXT = "#5A7690";
const GREEN = "#00875A";
const GREEN_BG = "#E6F4EF";
const RED = "#EF4444";
const RED_BG = "#FEF2F2";
const GRAY_ICON = "#64748B";
const GRAY_BG = "#F1F5F9";
const CARD_BORDER = "#E8EEF3";
const BG = "#F7FAFC";

export default function AfHomeScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState("Laura");
  const [userEmail, setUserEmail] = useState("admin@aconvi.es");
  const [searchQuery, setSearchQuery] = useState("");
  const [profileVisible, setProfileVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const storedName = await SecureStore.getItemAsync("expo_user_name");
        const storedEmail = await SecureStore.getItemAsync("expo_user_email");
        if (storedName) {
          const first = storedName.trim().split(/\s+/)[0];
          if (first) setUserName(first);
        }
        if (storedEmail) setUserEmail(storedEmail);
      } catch {
        // ignore
      }
    })();
  }, []);

  const { data: portfolio, isLoading } = useQuery(
    api.meeting.portfolio.queryOptions({ tenantId: TENANT_ID }),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleLogout = async () => {
    setProfileVisible(false);
    try {
      await authClient.signOut();
    } catch {
      // ignore
    }
    await SecureStore.deleteItemAsync("expo_session_token");
    await SecureStore.deleteItemAsync("expo_user_id");
    await SecureStore.deleteItemAsync("expo_user_name");
    await SecureStore.deleteItemAsync("expo_user_email");
    await SecureStore.deleteItemAsync("expo_user_role");
    router.replace("/login" as any);
  };

  const todayFormatted = (() => {
    try {
      const raw = format(new Date(), "EEEE, d 'de' MMMM", { locale: es });
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    } catch {
      return "Miércoles, 23 de septiembre";
    }
  })();

  const activeJunta = portfolio?.featuredJunta;
  const recentVotes = portfolio?.recentVotes ?? [];
  const firstVote = recentVotes[0];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Image
          source={require("../../../assets/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => router.push("/(af)/comunicados" as any)}
          >
            <Ionicons name="notifications-outline" size={24} color={NAVY} />
            <View style={styles.bellDot} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => setProfileVisible(true)}
          >
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>
                {userName.slice(0, 2).toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={GREEN}
          />
        }
      >
        {/* Greeting Header */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingTitle}>Hola, {userName}</Text>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={16} color={NAVY} />
            <Text style={styles.dateText}>{todayFormatted}</Text>
            <Ionicons name="chevron-down" size={16} color={NAVY} />
          </View>
          <Text style={styles.portfolioSubtext}>
            327 comunidades gestionadas · 12 con actividad
          </Text>
        </View>

        {/* Search Input */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={19} color={SUBTEXT} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar comunidad, propietario o dirección..."
            placeholderTextColor="#7A94AC"
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => router.push("/(af)/comunidades" as any)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color={SUBTEXT} />
            </TouchableOpacity>
          )}
        </View>

        {isLoading && !portfolio ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={GREEN} />
          </View>
        ) : null}

        {/* Card 1: Hoy */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.iconCircle, { backgroundColor: GREEN_BG }]}>
                <Ionicons name="calendar-outline" size={22} color={GREEN} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Hoy</Text>
                <Text style={styles.cardSubtitle}>2 incidencias · 1 junta</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.seeAllBtn}
              onPress={() => router.push("/(af)/juntas" as any)}
            >
              <Text style={styles.seeAllText}>Ver todas</Text>
              <Ionicons name="chevron-forward" size={15} color={GREEN} />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Row 1: Urgent incident */}
          <View style={styles.todayRow}>
            <Text style={styles.todayTime}>18:29</Text>
            <View style={[styles.rowIconCircle, { backgroundColor: RED_BG }]}>
              <Ionicons name="warning-outline" size={20} color={RED} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                Ascensor averiado
              </Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                Edificio Jardines, Portal 2 · Hace 12 min
              </Text>
            </View>
            <TouchableOpacity
              style={styles.pillBtn}
              onPress={() => router.push("/(af)/incidencias" as any)}
            >
              <Text style={styles.pillBtnText}>Gestionar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerLight} />

          {/* Row 2: Junta ordinaria -> Asistencia */}
          <View style={styles.todayRow}>
            <Text style={styles.todayTime}>20:00</Text>
            <View style={[styles.rowIconCircle, { backgroundColor: GREEN_BG }]}>
              <Ionicons name="people-outline" size={20} color={GREEN} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {activeJunta?.title ?? "Junta ordinaria"}
              </Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                Residencial Jardines del Turia · 42 propietarios
              </Text>
            </View>
            <TouchableOpacity
              style={styles.pillBtn}
              onPress={() =>
                router.push({
                  pathname: "/(af)/asistencia" as any,
                  params: activeJunta?.id ? { sessionId: activeJunta.id } : {},
                })
              }
            >
              <Text style={styles.pillBtnText}>Asistencia</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerLight} />

          {/* Row 3: Minor incident */}
          <View style={styles.todayRow}>
            <Text style={styles.todayTime}>17:41</Text>
            <View style={[styles.rowIconCircle, { backgroundColor: GRAY_BG }]}>
              <Ionicons name="warning-outline" size={20} color={GRAY_ICON} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                Fuga de agua
              </Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                C/ Poeta Querol, 8 · Hace 1h
              </Text>
            </View>
            <TouchableOpacity
              style={styles.pillBtn}
              onPress={() => router.push("/(af)/incidencias" as any)}
            >
              <Text style={styles.pillBtnText}>Gestionar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Card 2: Incidencias */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.iconCircle, { backgroundColor: RED_BG }]}>
                <Ionicons name="warning-outline" size={22} color={RED} />
              </View>
              <View>
                <View style={styles.titleWithDot}>
                  <Text style={styles.cardTitle}>Incidencias</Text>
                  <View style={styles.inlineRedDot} />
                </View>
                <Text style={styles.cardSubtitle}>
                  3 incidencias · 1 urgente · 2 menores
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.seeAllBtn}
              onPress={() => router.push("/(af)/incidencias" as any)}
            >
              <Text style={styles.seeAllText}>Ver todas</Text>
              <Ionicons name="chevron-forward" size={15} color={GREEN} />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.listRow}
            onPress={() => router.push("/(af)/incidencias" as any)}
          >
            <View style={[styles.rowIconCircle, { backgroundColor: RED_BG }]}>
              <Ionicons name="warning-outline" size={20} color={RED} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Ascensor averiado</Text>
              <Text style={styles.rowSub}>
                Edificio Jardines, Portal 2 · Hace 12 min
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SUBTEXT} />
          </TouchableOpacity>

          <View style={styles.dividerLight} />

          <TouchableOpacity
            style={styles.listRow}
            onPress={() => router.push("/(af)/incidencias" as any)}
          >
            <View style={[styles.rowIconCircle, { backgroundColor: GRAY_BG }]}>
              <Ionicons name="warning-outline" size={20} color={GRAY_ICON} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Fuga de agua</Text>
              <Text style={styles.rowSub}>C/ Poeta Querol, 8 · Hace 1h</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SUBTEXT} />
          </TouchableOpacity>

          <View style={styles.dividerLight} />

          <TouchableOpacity
            style={styles.listRow}
            onPress={() => router.push("/(af)/incidencias" as any)}
          >
            <View style={[styles.rowIconCircle, { backgroundColor: GRAY_BG }]}>
              <Ionicons name="warning-outline" size={20} color={GRAY_ICON} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Limpieza de portales</Text>
              <Text style={styles.rowSub}>C/ Mayor, 15 · Hace 3h</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SUBTEXT} />
          </TouchableOpacity>
        </View>

        {/* Card 3: Juntas */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.iconCircle, { backgroundColor: GREEN_BG }]}>
                <Ionicons name="people-outline" size={22} color={GREEN} />
              </View>
              <View>
                <View style={styles.titleWithDot}>
                  <Text style={styles.cardTitle}>Juntas</Text>
                  <View style={styles.inlineRedDot} />
                </View>
                <Text style={styles.cardSubtitle}>1 hoy · 1 próxima</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.seeAllBtn}
              onPress={() => router.push("/(af)/juntas" as any)}
            >
              <Text style={styles.seeAllText}>Ver todas</Text>
              <Ionicons name="chevron-forward" size={15} color={GREEN} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.juntaHighlightBox}
            activeOpacity={0.85}
            onPress={() => router.push("/(af)/juntas" as any)}
          >
            <Ionicons name="people-outline" size={24} color={GREEN} />
            <View style={styles.juntaHighlightText}>
              <Text style={styles.juntaTag}>JUNTA HOY · 20:00</Text>
              <Text style={styles.juntaCommunity}>
                Residencial Jardines del Turia
              </Text>
              <Text style={styles.juntaOwners}>42 propietarios</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={GREEN} />
          </TouchableOpacity>
        </View>

        {/* Card 4: Votaciones */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.iconCircle, { backgroundColor: GREEN_BG }]}>
                <Ionicons name="checkbox-outline" size={22} color={GREEN} />
              </View>
              <View>
                <View style={styles.titleWithDot}>
                  <Text style={styles.cardTitle}>Votaciones</Text>
                  <View style={styles.inlineRedDot} />
                </View>
                <Text style={styles.cardSubtitle}>
                  {portfolio?.stats.openVotesCount ?? 2} activas ·{" "}
                  {portfolio?.stats.draftVotesCount ?? 1} pendiente ·{" "}
                  {portfolio?.stats.closedVotesCount ?? 1} finalizada
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.seeAllBtn}
              onPress={() => router.push("/(af)/votaciones" as any)}
            >
              <Text style={styles.seeAllText}>Ver todas</Text>
              <Ionicons name="chevron-forward" size={15} color={GREEN} />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.listRow}
            onPress={() => router.push("/(af)/votaciones" as any)}
          >
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>
                {firstVote?.title ?? "Instalación de placas solares"}
              </Text>
              <Text style={styles.rowSub}>Comunidad Jardines del Turia</Text>
              <Text style={styles.rowSub}>Finaliza el 25 sep · 20:00</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SUBTEXT} />
          </TouchableOpacity>
        </View>

        {/* Card 5: Resto de tu cartera */}
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={() => router.push("/(af)/comunidades" as any)}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.iconCircle, { backgroundColor: GREEN_BG }]}>
                <Ionicons name="business-outline" size={22} color={GREEN} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Resto de tu cartera</Text>
                <Text style={styles.cardSubtitle}>
                  327 comunidades · 12 con actividad · 6 incidencias
                </Text>
              </View>
              <View style={styles.seeAllBtn}>
                <Text style={styles.seeAllText}>Ver</Text>
                <Ionicons name="chevron-forward" size={15} color={GREEN} />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Profile / Logout Modal */}
      <Modal
        visible={profileVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setProfileVisible(false)}
        >
          <View style={styles.profileCard}>
            <View style={styles.profileAvatarLarge}>
              <Text style={styles.profileAvatarText}>
                {userName.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.profileName}>{userName}</Text>
            <Text style={styles.profileRole}>Administrador de Fincas</Text>
            <Text style={styles.profileEmail}>{userEmail}</Text>

            <TouchableOpacity
              style={styles.communitiesModalBtn}
              onPress={() => {
                setProfileVisible(false);
                router.push("/(af)/comunidades" as any);
              }}
            >
              <Ionicons name="business-outline" size={18} color={GREEN} />
              <Text style={styles.communitiesModalBtnText}>
                Ver todas las comunidades
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
              <Text style={styles.logoutBtnText}>Cerrar sesión</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: BG,
  },
  logo: {
    width: 132,
    height: 36,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  bellBtn: {
    position: "relative",
    padding: 4,
  },
  bellDot: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: RED,
    borderWidth: 1.5,
    borderColor: BG,
  },
  avatarBtn: {
    borderRadius: 22,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0F2942",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#D1E3F0",
  },
  avatarInitials: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 32,
  },
  greetingSection: {
    marginBottom: 14,
  },
  greetingTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: NAVY,
    letterSpacing: -0.4,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  dateText: {
    fontSize: 15,
    fontWeight: "600",
    color: NAVY,
  },
  portfolioSubtext: {
    fontSize: 13.5,
    color: SUBTEXT,
    marginTop: 4,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF3F8",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: NAVY,
    padding: 0,
  },
  loadingBox: {
    paddingVertical: 20,
    alignItems: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    shadowColor: "#0F2942",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWithDot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inlineRedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: RED,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: NAVY,
  },
  cardSubtitle: {
    fontSize: 13,
    color: SUBTEXT,
    marginTop: 1,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  seeAllText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: GREEN,
  },
  divider: {
    height: 1,
    backgroundColor: "#EDF2F7",
    marginVertical: 12,
  },
  dividerLight: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 10,
  },
  todayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  todayTime: {
    fontSize: 13,
    fontWeight: "600",
    color: SUBTEXT,
    width: 38,
  },
  rowIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTextCol: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: NAVY,
  },
  rowSub: {
    fontSize: 12.5,
    color: SUBTEXT,
    marginTop: 2,
  },
  pillBtn: {
    backgroundColor: GREEN_BG,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  pillBtnText: {
    color: GREEN,
    fontSize: 13,
    fontWeight: "600",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  juntaHighlightBox: {
    marginTop: 12,
    backgroundColor: "#EAF6F1",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  juntaHighlightText: {
    flex: 1,
  },
  juntaTag: {
    fontSize: 12,
    fontWeight: "700",
    color: GREEN,
    letterSpacing: 0.3,
  },
  juntaCommunity: {
    fontSize: 15,
    fontWeight: "700",
    color: NAVY,
    marginTop: 2,
  },
  juntaOwners: {
    fontSize: 13,
    color: SUBTEXT,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 41, 66, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  profileCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  profileAvatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  profileAvatarText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
  },
  profileName: {
    fontSize: 19,
    fontWeight: "700",
    color: NAVY,
  },
  profileRole: {
    fontSize: 13.5,
    fontWeight: "600",
    color: GREEN,
    marginTop: 2,
  },
  profileEmail: {
    fontSize: 13,
    color: SUBTEXT,
    marginTop: 4,
    marginBottom: 18,
  },
  communitiesModalBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: GREEN_BG,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  communitiesModalBtnText: {
    color: GREEN,
    fontWeight: "600",
    fontSize: 14,
  },
  logoutBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: RED,
    paddingVertical: 12,
    borderRadius: 12,
  },
  logoutBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
