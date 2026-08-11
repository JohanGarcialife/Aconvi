import { AppState } from "react-native";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  RefreshControl,
  TextInput,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack, useLocalSearchParams, useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { api } from "~/utils/api";
import { useQuery } from "@tanstack/react-query";
import { getBaseUrl } from "~/utils/base-url";

const TEAL = "#009689";
const DARK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";
const BG_OFF = "#f8fafc";

const DEMO_PROVIDER_ID = "";
const DEMO_TENANT_ID = "org_aconvi_demo";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isToday(dateStr?: string | Date | null) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

function isTomorrow(dateStr?: string | Date | null) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear()
  );
}

function getInitials(name?: string | null) {
  if (!name) return "PM";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    const first = parts[0]?.[0] ?? "";
    const second = parts[1]?.[0] ?? "";
    return `${first}${second}`.toUpperCase() || "PM";
  }
  return name.substring(0, 2).toUpperCase();
}

// ─── Dynamic Countdown Timer ──────────────────────────────────────────────────
function useDynamicCountdown(targetTimestamp?: string | Date | null, durationMinutes = 120) {
  const getRemainingSeconds = () => {
    if (!targetTimestamp) return 1080;
    const startMs = new Date(targetTimestamp).getTime();
    const targetMs = startMs + durationMinutes * 60 * 1000;
    const nowMs = Date.now();
    return Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  };

  const [seconds, setSeconds] = useState(getRemainingSeconds);

  useEffect(() => {
    setSeconds(getRemainingSeconds());
    const timer = setInterval(() => {
      const remaining = getRemainingSeconds();
      setSeconds(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [targetTimestamp]);

  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  const remM = m % 60;

  let text = `${seconds}s`;
  if (h > 0) {
    text = `${h} h ${remM} min restantes`;
  } else if (m > 0) {
    text = `${m} min restantes`;
  }

  return { formatted: text, isExpired: seconds <= 0 };
}

function ItemCountdown({ targetTimestamp }: { targetTimestamp?: string | Date | null }) {
  const { formatted, isExpired } = useDynamicCountdown(targetTimestamp);
  return (
    <View style={styles.porResponderTimeRight}>
      <Ionicons name="time-outline" size={16} color="#ea580c" style={{ marginRight: 4 }} />
      <Text style={[styles.timeLeftText, isExpired && { color: "#ef4444" }]}>
        {isExpired ? "Expirada" : formatted}
      </Text>
      <Ionicons name="chevron-forward-outline" size={18} color="#94a3b8" style={{ marginLeft: 6 }} />
    </View>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  let color = "#10b981";
  let label = "Baja";
  if (priority === "URGENTE" || priority === "ALTA") {
    color = "#ef4444";
    label = "Alta";
  } else if (priority === "MEDIA") {
    color = "#f59e0b";
    label = "Media";
  }
  return (
    <View style={styles.priorityContainer}>
      <View style={[styles.priorityDot, { backgroundColor: color }]} />
      <Text style={[styles.priorityText, { color: color }]}>{label}</Text>
    </View>
  );
}

function getCategoryIcon(title: string) {
  const t = (title || "").toLowerCase();
  if (t.includes("agua") || t.includes("fuga") || t.includes("piscina") || t.includes("fontaner")) {
    return { name: "water-outline" as const, color: "#3b82f6", bgColor: "#eff6ff", dotColor: "#10b981" };
  }
  if (t.includes("eléctric") || t.includes("cuadro") || t.includes("luz") || t.includes("luminaria")) {
    return { name: "flash-outline" as const, color: "#10b981", bgColor: "#f0fdf4", dotColor: "#3b82f6" };
  }
  if (t.includes("puerta") || t.includes("cierra") || t.includes("cierrapuertas") || t.includes("ajuste")) {
    return { name: "build-outline" as const, color: "#ea580c", bgColor: "#fff7ed", dotColor: "#10b981" };
  }
  if (t.includes("manten") || t.includes("preventiv") || t.includes("molestias")) {
    return { name: "business-outline" as const, color: "#a855f7", bgColor: "#faf5ff", dotColor: "#f59e0b" };
  }
  return { name: "bulb-outline" as const, color: "#f59e0b", bgColor: "#fffbeb", dotColor: "#10b981" };
}

function useSessionEmail() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEmail() {
      try {
        const token = await SecureStore.getItemAsync("expo_session_token");
        if (!token) {
          setLoading(false);
          return;
        }
        const res = await fetch(`${getBaseUrl()}/api/auth/get-session`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = (await res.json()) as { user?: { email?: string } };
          setEmail(data?.user?.email ?? null);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    void fetchEmail();
  }, []);

  return { email, loading };
}

export default function ProveedorJobScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ incidentId?: string; providerId?: string }>();

  const { email: sessionEmail } = useSessionEmail();

  const { data: currentProv } = useQuery(
    api.provider.byEmail.queryOptions(
      { email: sessionEmail ?? "" },
      { enabled: !!sessionEmail }
    )
  );

  const providerId = params.providerId ?? currentProv?.id ?? DEMO_PROVIDER_ID;
  const tenantId = currentProv?.organizationId ?? DEMO_TENANT_ID;

  const providerName = currentProv?.name ? currentProv.name.split(" ")[0] : "Pedro";
  const initials = getInitials(currentProv?.name);

  const {
    data: incidents,
    refetch: refetchIncidents,
    isRefetching,
  } = useQuery(
    api.incident.assignedToProvider.queryOptions(
      {
        providerId: providerId ?? "",
        tenantId: tenantId,
      },
      {
        enabled: !!providerId,
        refetchInterval: 10_000,
      }
    )
  );

  useFocusEffect(
    useCallback(() => {
      void refetchIncidents();
    }, [refetchIncidents])
  );

  const [activeTab, setActiveTab] = useState<"inicio" | "expiradas" | "perfil" | "intervenciones">("inicio");
  const [homeFilter, setHomeFilter] = useState<"todas" | "porResponder" | "enCurso" | "programadas" | "finalizadas">("todas");
  const [intervencionesFilter, setIntervencionesFilter] = useState<string>("todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllPorResponder, setShowAllPorResponder] = useState(false);
  const [showAllHoy, setShowAllHoy] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [notificationsSeen, setNotificationsSeen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchIncidents();
    setRefreshing(false);
  };

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void refetchIncidents();
      }
    });
    return () => subscription.remove();
  }, [refetchIncidents]);

  // Handle Logout action
  const handlePerformLogout = useCallback(async () => {
    setShowProfileDropdown(false);
    await SecureStore.deleteItemAsync("expo_session_token").catch(() => {});
    await SecureStore.deleteItemAsync("expo_user_id").catch(() => {});
    router.replace("/login");
  }, [router]);

  // Dynamic DB Data Arrays
  const rawIncidents = (incidents as any[] | undefined) ?? [];

  const isOTExpired = useCallback((item: any) => {
    const ts = item.assignedAt ?? item.createdAt;
    if (!ts) return false;
    const startMs = new Date(ts).getTime();
    const EXPIRATION_MS = 120 * 60 * 1000;
    return Date.now() - startMs >= EXPIRATION_MS;
  }, []);

  const getStatusBadge = useCallback(
    (item: any) => {
      if (item.status === "RESUELTA" || item.status === "CERRADA") {
        return { label: "Finalizada", color: "#475569", bg: "#f1f5f9" };
      }
      if (item.status === "EN_CURSO") {
        return { label: "En curso", color: "#10b981", bg: "#d1fae5" };
      }
      if (item.status === "AGENDADA") {
        return { label: "Programada", color: "#3b82f6", bg: "#dbeafe" };
      }
      const isExpired = (item.status === "EN_REVISION" || item.status === "RECIBIDA") && isOTExpired(item);
      if (isExpired) {
        return { label: "Expirada", color: "#ef4444", bg: "#fee2e2" };
      }
      if (item.status === "EN_REVISION" || item.status === "RECIBIDA") {
        return { label: "Por responder", color: "#ea580c", bg: "#ffedd5" };
      }
      return { label: item.status || "Sin estado", color: "#64748b", bg: "#f1f5f9" };
    },
    [isOTExpired]
  );

  const porResponderDB = useMemo(() => {
    return rawIncidents.filter(
      (i: any) => (i.status === "EN_REVISION" || i.status === "RECIBIDA") && !isOTExpired(i)
    );
  }, [rawIncidents, isOTExpired]);

  const expiradasHoyDB = useMemo(() => {
    return rawIncidents.filter((i: any) => {
      return (i.status === "EN_REVISION" || i.status === "RECIBIDA") && isOTExpired(i);
    });
  }, [rawIncidents, isOTExpired]);

  const enCursoDB = useMemo(() => {
    return rawIncidents.filter((i: any) => i.status === "EN_CURSO");
  }, [rawIncidents]);

  const programadasDB = useMemo(() => {
    return rawIncidents.filter((i: any) => i.status === "AGENDADA");
  }, [rawIncidents]);

  const finalizadasDB = useMemo(() => {
    return rawIncidents.filter((i: any) => i.status === "RESUELTA" || i.status === "CERRADA");
  }, [rawIncidents]);

  const porResponderCount = porResponderDB.length;
  const expiradasCount = expiradasHoyDB.length;
  const enCursoCount = enCursoDB.length;
  const programadasCount = programadasDB.length;
  const finalizadasCount = finalizadasDB.length;

  // Unread count is 0 if user has already opened/seen notifications
  const unreadCount = notificationsSeen ? 0 : porResponderCount;

  // Open notifications panel and mark notifications as seen/read
  const handleToggleNotifications = useCallback(() => {
    setShowProfileDropdown(false);
    setShowNotificationsDropdown((prev) => {
      const next = !prev;
      if (next) {
        setNotificationsSeen(true);
      }
      return next;
    });
  }, []);

  const handleToggleProfile = useCallback(() => {
    setShowNotificationsDropdown(false);
    setShowProfileDropdown((prev) => !prev);
  }, []);

  // Select incident handler
  const handleSelectIncident = useCallback(
    (i: any) => {
      setShowNotificationsDropdown(false);
      setShowProfileDropdown(false);

      const isExpired = (i.status === "EN_REVISION" || i.status === "RECIBIDA") && isOTExpired(i);

      if (isExpired) {
        router.push({
          pathname: "/(proveedor)/job/accept" as any,
          params: { incidentId: i.id, providerId: providerId ?? DEMO_PROVIDER_ID, tenantId },
        });
      } else if (i.status === "AGENDADA") {
        router.push({
          pathname: "/(proveedor)/job/inprogress",
          params: { incidentId: i.id, providerId: providerId ?? DEMO_PROVIDER_ID },
        });
      } else if (i.status === "EN_CURSO") {
        router.push({
          pathname: "/(proveedor)/job/complete",
          params: { incidentId: i.id, providerId: providerId ?? DEMO_PROVIDER_ID },
        });
      } else if (i.status === "RESUELTA" || i.status === "CERRADA") {
        router.push({
          pathname: "/(proveedor)/job/done",
          params: {
            id: i.code || `OT-${i.id ? i.id.substring(0, 8).toUpperCase() : "2458"}`,
            community: i.organization?.name || i.communityName || "Sin comunidad",
            cost: i.estimatedCost ? `${i.estimatedCost} €` : "En revisión",
          },
        });
      } else {
        router.push({
          pathname: "/(proveedor)/job/accept" as any,
          params: { incidentId: i.id, providerId: providerId ?? DEMO_PROVIDER_ID, tenantId },
        });
      }
    },
    [router, providerId, tenantId, isOTExpired]
  );

  // Format Por Responder items from DB
  const porResponderItems = useMemo(() => {
    return porResponderDB.map((i: any, idx: number) => ({
      id: i.id,
      code: i.code || `OT-${i.id ? i.id.substring(0, 4).toUpperCase() : 2458 + idx}`,
      title: i.title,
      community: i.organization?.name || i.communityName || (i.organizationId ? `Org: ${i.organizationId}` : "Sin comunidad"),
      assignedAt: i.assignedAt ?? i.createdAt,
      raw: i,
    }));
  }, [porResponderDB]);

  // Format Hoy items directly from DB (sorted chronologically)
  const hoyItems = useMemo(() => {
    const todayMatches = rawIncidents.filter((i: any) => {
      if (i.status !== "AGENDADA" && i.status !== "EN_CURSO") return false;
      if (!i.scheduledAt) return true;
      return isToday(i.scheduledAt);
    });

    const source = [...(todayMatches.length > 0 ? todayMatches : programadasDB)];

    // Sort chronologically (earliest to latest)
    source.sort((a: any, b: any) => {
      const timeA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const timeB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return timeA - timeB;
    });

    return source.map((i: any, idx: number) => {
      const schedDate = i.scheduledAt ? new Date(i.scheduledAt) : null;
      const timeStr = schedDate
        ? schedDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
        : ["09:00", "10:30", "13:00", "16:00", "17:30"][idx % 5];
      return {
        id: i.id,
        time: timeStr,
        title: i.title,
        community: i.organization?.name || i.communityName || (i.organizationId ? `Org: ${i.organizationId}` : "Sin comunidad"),
        priority: i.priority ?? (idx % 2 === 0 ? "ALTA" : "MEDIA"),
        status: i.status,
        ...getCategoryIcon(i.title),
        raw: i,
      };
    });
  }, [rawIncidents, programadasDB]);

  // Format Mañana items directly from DB (sorted chronologically)
  const mananaItems = useMemo(() => {
    const tomorrowMatches = rawIncidents.filter((i: any) => {
      if (i.status !== "AGENDADA") return false;
      return isTomorrow(i.scheduledAt);
    });

    // Sort chronologically (earliest to latest)
    tomorrowMatches.sort((a: any, b: any) => {
      const timeA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const timeB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return timeA - timeB;
    });

    return tomorrowMatches.map((i: any) => {
      const schedDate = new Date(i.scheduledAt);
      return {
        id: i.id,
        time: schedDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
        title: i.title,
        priority: i.priority ?? "MEDIA",
        status: i.status,
        raw: i,
      };
    });
  }, [rawIncidents]);

  // Search Filter
  const filterList = useCallback(
    (list: any[]) => {
      if (!searchQuery.trim()) return list;
      const q = searchQuery.toLowerCase().trim();
      return list.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.code?.toLowerCase().includes(q) ||
          item.community?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q)
      );
    },
    [searchQuery]
  );

  const filteredPorResponder = useMemo(() => {
    if (homeFilter !== "todas" && homeFilter !== "porResponder") return [];
    return filterList(porResponderItems);
  }, [porResponderItems, filterList, homeFilter]);

  const filteredHoy = useMemo(() => {
    let list = hoyItems;
    if (homeFilter === "porResponder") {
      list = [];
    } else if (homeFilter === "enCurso") {
      list = hoyItems.filter((i) => i.status === "EN_CURSO");
    } else if (homeFilter === "programadas") {
      list = hoyItems.filter((i) => i.status === "AGENDADA");
    } else if (homeFilter === "finalizadas") {
      list = hoyItems.filter((i) => i.status === "RESUELTA" || i.status === "CERRADA");
    }
    return filterList(list);
  }, [hoyItems, filterList, homeFilter]);

  const filteredManana = useMemo(() => {
    let list = mananaItems;
    if (homeFilter === "porResponder") {
      list = [];
    } else if (homeFilter === "enCurso") {
      list = mananaItems.filter((i) => i.status === "EN_CURSO");
    } else if (homeFilter === "programadas") {
      list = mananaItems.filter((i) => i.status === "AGENDADA");
    } else if (homeFilter === "finalizadas") {
      list = mananaItems.filter((i) => i.status === "RESUELTA" || i.status === "CERRADA");
    }
    return filterList(list);
  }, [mananaItems, filterList, homeFilter]);

  // Default collapsed view: 2 items for por responder, 5 items for hoy
  const displayedPorResponder = showAllPorResponder ? filteredPorResponder : filteredPorResponder.slice(0, 2);
  const displayedHoy = showAllHoy ? filteredHoy : filteredHoy.slice(0, 5);

  // Full Intervenciones List Filter for Tab 2
  const intervencionesListFiltered = useMemo(() => {
    let source = rawIncidents;
    if (intervencionesFilter === "porResponder") {
      source = porResponderDB;
    } else if (intervencionesFilter === "enCurso") {
      source = enCursoDB;
    } else if (intervencionesFilter === "programadas") {
      source = programadasDB;
    } else if (intervencionesFilter === "finalizadas") {
      source = finalizadasDB;
    } else if (intervencionesFilter === "expiradas") {
      source = expiradasHoyDB;
    }

    if (!searchQuery.trim()) return source;
    const q = searchQuery.toLowerCase().trim();
    return source.filter(
      (i: any) =>
        i.title?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.organization?.name?.toLowerCase().includes(q)
    );
  }, [rawIncidents, porResponderDB, enCursoDB, programadasDB, finalizadasDB, expiradasHoyDB, intervencionesFilter, searchQuery]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* ── Shared Top Header Bar ──────────────────────────────────────────── */}
      <View style={[styles.headerRow, { paddingHorizontal: 20, paddingTop: 12, zIndex: 100 }]}>
        <Image
          source={require("../../../../assets/logo.png")}
          style={styles.logoImage}
        />

        <View style={styles.headerRightRow}>
          {/* Bell Icon & Unread Notification Badge */}
          <TouchableOpacity
            style={styles.bellButton}
            onPress={handleToggleNotifications}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={24} color={DARK} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Interactive Profile Avatar -> Profile Dropdown Panel */}
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handleToggleProfile}
            activeOpacity={0.8}
          >
            <Text style={styles.avatarInitialsText}>{initials}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Notification Floating Dropdown Panel ───────────────────────────── */}
      {showNotificationsDropdown && (
        <View style={styles.dropdownOverlayWrapper}>
          <TouchableOpacity
            style={styles.dropdownBackdrop}
            activeOpacity={1}
            onPress={() => setShowNotificationsDropdown(false)}
          />

          <View style={styles.dropdownContainer}>
            <View style={styles.dropdownHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="notifications" size={18} color={TEAL} style={{ marginRight: 6 }} />
                <Text style={styles.dropdownTitle}>Notificaciones Pendientes</Text>
              </View>
              <TouchableOpacity onPress={() => setShowNotificationsDropdown(false)}>
                <Ionicons name="close" size={20} color={MUTED} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {porResponderItems.length === 0 ? (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <Ionicons name="checkmark-circle-outline" size={32} color="#10b981" style={{ marginBottom: 6 }} />
                  <Text style={{ fontSize: 13, color: MUTED, textAlign: "center" }}>
                    No tienes notificaciones pendientes.
                  </Text>
                </View>
              ) : (
                porResponderItems.map((item: any, idx: number) => (
                  <TouchableOpacity
                    key={item.id ?? idx}
                    style={[
                      styles.dropdownItem,
                      idx > 0 && { borderTopWidth: 1, borderTopColor: "#f1f5f9" },
                    ]}
                    onPress={() => handleSelectIncident(item.raw ?? item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dropdownItemIconBox}>
                      <Ionicons name="alert-circle-outline" size={20} color="#ea580c" />
                    </View>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.dropdownItemTitle} numberOfLines={1}>
                        Nueva OT: {item.title}
                      </Text>
                      <Text style={styles.dropdownItemSubtitle} numberOfLines={1}>
                        {item.community} • Asignada recientemente
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward-outline" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* ── Profile Floating Dropdown Panel ────────────────────────────────── */}
      {showProfileDropdown && (
        <View style={styles.dropdownOverlayWrapper}>
          <TouchableOpacity
            style={styles.dropdownBackdrop}
            activeOpacity={1}
            onPress={() => setShowProfileDropdown(false)}
          />

          <View style={styles.profileDropdownContainer}>
            {/* Header info */}
            <View style={styles.profileDropdownHeader}>
              <View style={styles.profileBigAvatar}>
                <Text style={styles.profileBigAvatarText}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileNameText} numberOfLines={1}>
                  {currentProv?.name || "Pedro Martínez"}
                </Text>
                <Text style={styles.profileEmailText} numberOfLines={1}>
                  {sessionEmail || "proveedor@aconvi.com"}
                </Text>
                <View style={styles.roleTag}>
                  <Text style={styles.roleTagText}>
                    {currentProv?.speciality || "Proveedor Oficial"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.dropdownDivider} />

            {/* Actions */}
            <TouchableOpacity
              style={styles.profileActionRow}
              onPress={() => {
                setShowProfileDropdown(false);
                setActiveTab("intervenciones");
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="clipboard-outline" size={18} color={DARK} style={{ marginRight: 10 }} />
              <Text style={styles.profileActionText}>Mis Intervenciones ({rawIncidents.length})</Text>
            </TouchableOpacity>

            <View style={styles.dropdownDivider} />

            {/* Logout button */}
            <TouchableOpacity
              style={[styles.profileActionRow, { paddingVertical: 14 }]}
              onPress={handlePerformLogout}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={18} color="#ef4444" style={{ marginRight: 10 }} />
              <Text style={[styles.profileActionText, { color: "#ef4444", fontWeight: "700" }]}>
                Cerrar sesión
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── TAB 1: INICIO (DASHBOARD) ──────────────────────────────────────── */}
      {activeTab === "inicio" && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={TEAL} />
          }
        >
          {/* Greeting */}
          <View style={styles.greetingContainer}>
            <Text style={styles.greetingTitle}>Buenos días, {providerName}</Text>
            <Text style={styles.greetingSubtitle}>
              Tienes {programadasCount} intervenciones para hoy.
            </Text>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBarContainer}>
            <Ionicons name="search-outline" size={20} color="#94a3b8" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar orden de trabajo, comunidad o dirección..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color={MUTED} />
              </TouchableOpacity>
            )}
          </View>

          {/* Stats Summary Grid */}
          <View style={styles.statsCard}>
            <TouchableOpacity
              style={[styles.statCol, homeFilter === "porResponder" && styles.statColActive]}
              onPress={() => setHomeFilter((prev) => (prev === "porResponder" ? "todas" : "porResponder"))}
            >
              <Ionicons name="time-outline" size={22} color="#ea580c" />
              <Text style={styles.statNumber}>{porResponderCount}</Text>
              <Text style={styles.statLabel}>Por responder</Text>
            </TouchableOpacity>

            <View style={styles.statDivider} />

            <TouchableOpacity
              style={[styles.statCol, homeFilter === "enCurso" && styles.statColActive]}
              onPress={() => setHomeFilter((prev) => (prev === "enCurso" ? "todas" : "enCurso"))}
            >
              <Ionicons name="play-circle-outline" size={22} color="#10b981" />
              <Text style={styles.statNumber}>{enCursoCount}</Text>
              <Text style={styles.statLabel}>En curso</Text>
            </TouchableOpacity>

            <View style={styles.statDivider} />

            <TouchableOpacity
              style={[styles.statCol, homeFilter === "programadas" && styles.statColActive]}
              onPress={() => setHomeFilter((prev) => (prev === "programadas" ? "todas" : "programadas"))}
            >
              <Ionicons name="calendar-outline" size={22} color="#3b82f6" />
              <Text style={styles.statNumber}>{programadasCount}</Text>
              <Text style={styles.statLabel}>Programadas</Text>
            </TouchableOpacity>

            <View style={styles.statDivider} />

            <TouchableOpacity
              style={[styles.statCol, homeFilter === "finalizadas" && styles.statColActive]}
              onPress={() => setHomeFilter((prev) => (prev === "finalizadas" ? "todas" : "finalizadas"))}
            >
              <Ionicons name="checkmark-circle-outline" size={22} color="#475569" />
              <Text style={styles.statNumber}>{finalizadasCount}</Text>
              <Text style={styles.statLabel}>Finalizadas hoy</Text>
            </TouchableOpacity>
          </View>

          {/* Active Filter Indicator Banner */}
          {homeFilter !== "todas" && (
            <View style={styles.filterActiveBanner}>
              <Text style={styles.filterActiveText}>
                Filtro activo:{" "}
                {homeFilter === "porResponder"
                  ? "Por responder"
                  : homeFilter === "enCurso"
                  ? "En curso"
                  : homeFilter === "programadas"
                  ? "Programadas"
                  : "Finalizadas hoy"}
              </Text>
              <TouchableOpacity onPress={() => setHomeFilter("todas")}>
                <Text style={styles.filterClearText}>Mostrar todas</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Section: Por responder */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="document-text-outline" size={24} color="#ea580c" style={{ marginRight: 8 }} />
              <View>
                <Text style={styles.sectionTitle}>Por responder</Text>
                <Text style={styles.sectionSubtitle}>Responde antes de que expiren.</Text>
              </View>
            </View>

            <View style={styles.cardContainer}>
              {displayedPorResponder.length === 0 ? (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <Text style={{ fontSize: 13, color: MUTED }}>
                    {searchQuery ? "No se encontraron coincidencias." : "No tienes incidencias pendientes de responder."}
                  </Text>
                </View>
              ) : (
                displayedPorResponder.map((item: any, idx: number) => (
                  <View key={item.id ?? idx}>
                    {idx > 0 && <View style={styles.cardDivider} />}
                    <TouchableOpacity
                      style={styles.porResponderRow}
                      onPress={() => handleSelectIncident(item.raw ?? item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.redLeftAccent} />
                      <View style={styles.porResponderMainInfo}>
                        <View style={styles.otHeaderRow}>
                          <Text style={styles.otCodeText}>{item.code}</Text>
                          <Text style={styles.otTitleText} numberOfLines={1}>
                            {item.title}
                          </Text>
                        </View>
                        <View style={styles.locationRow}>
                          <Ionicons name="business-outline" size={14} color={MUTED} style={{ marginRight: 4 }} />
                          <Text style={styles.locationText}>{item.community}</Text>
                        </View>
                      </View>

                      <ItemCountdown targetTimestamp={item.assignedAt} />
                    </TouchableOpacity>
                  </View>
                ))
              )}

              {filteredPorResponder.length > 2 && (
                <TouchableOpacity
                  style={styles.viewAllFooter}
                  onPress={() => setShowAllPorResponder(!showAllPorResponder)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.viewAllText}>
                    {showAllPorResponder ? "Mostrar menos" : `Ver todas · ${porResponderCount}`}
                  </Text>
                  <Ionicons
                    name={showAllPorResponder ? "chevron-up-outline" : "chevron-forward-outline"}
                    size={16}
                    color={TEAL}
                    style={{ marginLeft: 4 }}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Section: Hoy */}
          <View style={styles.sectionContainer}>
            <View style={styles.titleWithCountRow}>
              <Text style={styles.sectionMainTitle}>Hoy</Text>
              <Text style={styles.countText}>{filteredHoy.length} intervenciones</Text>
            </View>

            <View style={styles.cardContainer}>
              {filteredHoy.length === 0 ? (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <Text style={{ fontSize: 13, color: MUTED }}>No hay intervenciones programadas para hoy.</Text>
                </View>
              ) : (
                <>
                  {displayedHoy.map((item: any, idx: number) => (
                    <TouchableOpacity
                      key={item.id ?? idx}
                      style={styles.hoyTimelineRow}
                      onPress={() => handleSelectIncident(item.raw ?? item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.timeText}>{item.time}</Text>

                      <View style={styles.timelineCol}>
                        <View style={[styles.timelineDot, { backgroundColor: item.dotColor ?? "#10b981" }]} />
                        {idx < displayedHoy.length - 1 && <View style={styles.timelineLine} />}
                      </View>

                      <View style={[styles.categoryIconCircle, { backgroundColor: item.bgColor ?? "#eff6ff" }]}>
                        <Ionicons name={item.name ?? "water-outline"} size={20} color={item.color ?? "#3b82f6"} />
                      </View>

                      <View style={styles.hoyMainDetails}>
                        <Text style={styles.hoyTitle} numberOfLines={1}>{item.title}</Text>
                        <View style={styles.locationRow}>
                          <Ionicons name="business-outline" size={13} color={MUTED} style={{ marginRight: 4 }} />
                          <Text style={styles.locationText}>{item.community}</Text>
                        </View>
                      </View>

                      <PriorityDot priority={item.priority} />

                      <Ionicons name="chevron-forward-outline" size={18} color="#94a3b8" style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                  ))}

                  {filteredHoy.length > 5 && (
                    <TouchableOpacity
                      style={styles.viewAllFooter}
                      onPress={() => setShowAllHoy((prev) => !prev)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.viewAllText}>
                        {showAllHoy ? "Mostrar menos" : `Ver todas (${filteredHoy.length - 5} más)`}
                      </Text>
                      <Ionicons
                        name={showAllHoy ? "chevron-up-outline" : "chevron-down-outline"}
                        size={16}
                        color={TEAL}
                        style={{ marginLeft: 4 }}
                      />
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>

          {/* Section: Mañana */}
          <View style={styles.sectionContainer}>
            <View style={styles.titleWithCountRow}>
              <Text style={styles.sectionMainTitle}>Mañana</Text>
              <Text style={styles.countText}>{filteredManana.length} intervenciones</Text>
            </View>

            <View style={styles.cardContainer}>
              {filteredManana.length === 0 ? (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <Text style={{ fontSize: 13, color: MUTED }}>No hay intervenciones programadas para mañana.</Text>
                </View>
              ) : (
                <View style={styles.mananaGridRow}>
                  {filteredManana.map((m: any, idx: number) => (
                    <View key={m.id} style={styles.mananaCol}>
                      <Text style={styles.mananaTime}>{m.time}</Text>
                      <Text style={styles.mananaTitle} numberOfLines={2}>
                        {m.title}
                      </Text>
                      <PriorityDot priority={m.priority} />
                      {idx < filteredManana.length - 1 && <View style={styles.mananaDivider} />}
                    </View>
                  ))}
                  <Ionicons name="chevron-forward-outline" size={18} color="#94a3b8" style={{ alignSelf: "center", marginLeft: 4 }} />
                </View>
              )}

              <TouchableOpacity
                style={styles.viewAllFooter}
                onPress={() => {
                  setActiveTab("intervenciones");
                  setIntervencionesFilter("programadas");
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.viewAllText}>Ver agenda completa</Text>
                <Ionicons name="chevron-forward-outline" size={16} color={TEAL} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ── TAB: EXPIRADAS HOY ───────────────────────────────────────────── */}
      {activeTab === "expiradas" && (
        <View style={{ flex: 1, backgroundColor: BG_OFF }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: "800", color: DARK }}>
              Expiradas hoy
            </Text>
            <Text style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
              Órdenes de trabajo que superaron el límite de 2 horas sin respuesta.
            </Text>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={TEAL} />
            }
          >
            <View style={styles.cardContainer}>
              {expiradasHoyDB.length === 0 ? (
                <View style={{ padding: 32, alignItems: "center" }}>
                  <Ionicons name="checkmark-circle-outline" size={40} color="#10b981" style={{ marginBottom: 8 }} />
                  <Text style={{ fontSize: 14, color: MUTED, textAlign: "center" }}>
                    ¡Excelente! No tienes órdenes de trabajo expiradas hoy.
                  </Text>
                </View>
              ) : (
                expiradasHoyDB.map((i: any, idx: number) => (
                  <TouchableOpacity
                    key={i.id ?? idx}
                    style={[
                      styles.porResponderRow,
                      { paddingLeft: 16 },
                      idx > 0 && { borderTopWidth: 1, borderTopColor: "#f1f5f9" },
                    ]}
                    onPress={() => handleSelectIncident(i)}
                    activeOpacity={0.7}
                  >
                    <View style={{ width: 4, height: "80%", backgroundColor: "#ef4444", borderRadius: 2, marginRight: 10 }} />
                    <View style={styles.porResponderMainInfo}>
                      <View style={styles.otHeaderRow}>
                        <Text style={styles.otCodeText}>OT-{2458 + idx}</Text>
                        <Text style={styles.otTitleText} numberOfLines={1}>
                          {i.title}
                        </Text>
                      </View>
                      <View style={styles.locationRow}>
                        <Ionicons name="business-outline" size={14} color={MUTED} style={{ marginRight: 4 }} />
                        <Text style={styles.locationText}>
                          {i.organization?.name || i.communityName || "Sin comunidad"}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: "#ef4444", marginRight: 4 }}>
                        Expirada
                      </Text>
                      <Ionicons name="chevron-forward-outline" size={18} color="#94a3b8" />
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      )}

      {/* ── TAB: MI PERFIL ─────────────────────────────────────────────────── */}
      {activeTab === "perfil" && (
        <View style={{ flex: 1, backgroundColor: BG_OFF, padding: 20 }}>
          <Text style={{ fontSize: 24, fontWeight: "800", color: DARK, marginBottom: 16 }}>
            Mi Perfil
          </Text>

          {/* Profile Card */}
          <View style={[styles.profileDropdownHeader, { backgroundColor: "#fff", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: BORDER }]}>
            <View style={styles.profileBigAvatar}>
              <Text style={styles.profileBigAvatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileNameText} numberOfLines={1}>
                {currentProv?.name || "Pedro Martínez"}
              </Text>
              <Text style={styles.profileEmailText} numberOfLines={1}>
                {sessionEmail || "proveedor@aconvi.com"}
              </Text>
              <View style={styles.roleTag}>
                <Text style={styles.roleTagText}>
                  {currentProv?.speciality || "Proveedor Oficial"}
                </Text>
              </View>
            </View>
          </View>

          <View style={{ marginTop: 20, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: BORDER, overflow: "hidden" }}>
            <TouchableOpacity
              style={[styles.profileActionRow, { padding: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }]}
              onPress={() => {
                setIntervencionesFilter("todas");
                setActiveTab("intervenciones");
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="clipboard-outline" size={20} color={TEAL} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: DARK }}>Mis Intervenciones (Histórico)</Text>
                <Text style={{ fontSize: 13, color: MUTED }}>Consulta todas tus OTs por estado</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color="#94a3b8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.profileActionRow, { padding: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }]}
              onPress={() => {
                setIntervencionesFilter("expiradas");
                setActiveTab("intervenciones");
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="alert-circle-outline" size={20} color="#ef4444" style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: DARK }}>OT Expiradas (Histórico)</Text>
                <Text style={{ fontSize: 13, color: MUTED }}>Historial de órdenes caducadas ({expiradasCount})</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color="#94a3b8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.profileActionRow, { padding: 16 }]}
              onPress={handlePerformLogout}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={20} color="#ef4444" style={{ marginRight: 12 }} />
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#ef4444" }}>Cerrar sesión</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── TAB: INTERVENCIONES (FULL HISTORICAL LIST VIEW FROM PROFILE) ──── */}
      {activeTab === "intervenciones" && (
        <View style={{ flex: 1, backgroundColor: BG_OFF }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <TouchableOpacity
                onPress={() => setActiveTab("perfil")}
                style={{ paddingRight: 10 }}
              >
                <Ionicons name="arrow-back" size={24} color={DARK} />
              </TouchableOpacity>
              <Text style={{ fontSize: 24, fontWeight: "800", color: DARK }}>
                Mis Intervenciones
              </Text>
            </View>

            {/* Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <TouchableOpacity
                style={[styles.filterPill, intervencionesFilter === "todas" && styles.filterPillActive]}
                onPress={() => setIntervencionesFilter("todas")}
              >
                <Text style={[styles.filterPillText, intervencionesFilter === "todas" && styles.filterPillTextActive]}>
                  Todas ({rawIncidents.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, intervencionesFilter === "porResponder" && styles.filterPillActive]}
                onPress={() => setIntervencionesFilter("porResponder")}
              >
                <Text style={[styles.filterPillText, intervencionesFilter === "porResponder" && styles.filterPillTextActive]}>
                  Por responder ({porResponderCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, intervencionesFilter === "enCurso" && styles.filterPillActive]}
                onPress={() => setIntervencionesFilter("enCurso")}
              >
                <Text style={[styles.filterPillText, intervencionesFilter === "enCurso" && styles.filterPillTextActive]}>
                  En curso ({enCursoCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, intervencionesFilter === "programadas" && styles.filterPillActive]}
                onPress={() => setIntervencionesFilter("programadas")}
              >
                <Text style={[styles.filterPillText, intervencionesFilter === "programadas" && styles.filterPillTextActive]}>
                  Programadas ({programadasCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, intervencionesFilter === "finalizadas" && styles.filterPillActive]}
                onPress={() => setIntervencionesFilter("finalizadas")}
              >
                <Text style={[styles.filterPillText, intervencionesFilter === "finalizadas" && styles.filterPillTextActive]}>
                  Finalizadas ({finalizadasCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, intervencionesFilter === "expiradas" && styles.filterPillActive]}
                onPress={() => setIntervencionesFilter("expiradas")}
              >
                <Text style={[styles.filterPillText, intervencionesFilter === "expiradas" && styles.filterPillTextActive]}>
                  Expiradas ({expiradasCount})
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Search input in interventions tab */}
            <View style={styles.searchBarContainer}>
              <Ionicons name="search-outline" size={20} color="#94a3b8" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Filtrar intervenciones..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={TEAL} />
            }
          >
            <View style={styles.cardContainer}>
              {intervencionesListFiltered.length === 0 ? (
                <View style={{ padding: 24, alignItems: "center" }}>
                  <Text style={{ fontSize: 14, color: MUTED }}>No hay intervenciones en esta categoría.</Text>
                </View>
              ) : (
                intervencionesListFiltered.map((i: any, idx: number) => {
                  const badge = getStatusBadge(i);
                  return (
                    <TouchableOpacity
                      key={i.id ?? idx}
                      style={[
                        styles.porResponderRow,
                        { paddingLeft: 16 },
                        idx > 0 && { borderTopWidth: 1, borderTopColor: "#f1f5f9" },
                      ]}
                      onPress={() => handleSelectIncident(i)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.porResponderMainInfo}>
                        <View style={styles.otHeaderRow}>
                          <Text style={styles.otCodeText}>OT-{2458 + idx}</Text>
                          <Text style={styles.otTitleText} numberOfLines={1}>
                            {i.title}
                          </Text>
                        </View>
                        <View style={styles.locationRow}>
                          <Ionicons name="business-outline" size={14} color={MUTED} style={{ marginRight: 4 }} />
                          <Text style={styles.locationText}>
                            {i.organization?.name || i.communityName || "Sin comunidad"}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View style={{ backgroundColor: badge.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginRight: 6 }}>
                          <Text style={{ color: badge.color, fontSize: 11, fontWeight: "700" }}>
                            {badge.label}
                          </Text>
                        </View>
                        <PriorityDot priority={i.priority ?? "MEDIA"} />
                        <Ionicons name="chevron-forward-outline" size={18} color="#94a3b8" style={{ marginLeft: 6 }} />
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>
      )}

      {/* ── Bottom Navigation Tabs ────────────────────────────────────────── */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity
          style={activeTab === "inicio" ? styles.tabItemActive : styles.tabItem}
          onPress={() => {
            setShowNotificationsDropdown(false);
            setShowProfileDropdown(false);
            setActiveTab("inicio");
          }}
          activeOpacity={0.8}
        >
          {activeTab === "inicio" && <View style={styles.activeTabTopBar} />}
          <Ionicons name="home" size={22} color={activeTab === "inicio" ? TEAL : MUTED} />
          <Text style={activeTab === "inicio" ? styles.tabTextActive : styles.tabText}>Inicio</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={activeTab === "expiradas" ? styles.tabItemActive : styles.tabItem}
          onPress={() => {
            setShowNotificationsDropdown(false);
            setShowProfileDropdown(false);
            setActiveTab("expiradas");
          }}
          activeOpacity={0.8}
        >
          {activeTab === "expiradas" && <View style={styles.activeTabTopBar} />}
          <View style={{ position: "relative" }}>
            <Ionicons
              name="alert-circle-outline"
              size={22}
              color={activeTab === "expiradas" ? TEAL : MUTED}
            />
            {expiradasCount > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{expiradasCount}</Text>
              </View>
            )}
          </View>
          <Text style={activeTab === "expiradas" ? styles.tabTextActive : styles.tabText}>
            Expiradas hoy
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={activeTab === "perfil" || activeTab === "intervenciones" ? styles.tabItemActive : styles.tabItem}
          onPress={() => {
            setShowNotificationsDropdown(false);
            setShowProfileDropdown(false);
            setActiveTab("perfil");
          }}
          activeOpacity={0.8}
        >
          {(activeTab === "perfil" || activeTab === "intervenciones") && <View style={styles.activeTabTopBar} />}
          <Ionicons
            name="person-outline"
            size={22}
            color={activeTab === "perfil" || activeTab === "intervenciones" ? TEAL : MUTED}
          />
          <Text style={activeTab === "perfil" || activeTab === "intervenciones" ? styles.tabTextActive : styles.tabText}>
            Mi perfil
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scrollView: {
    flex: 1,
    backgroundColor: BG_OFF,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },

  /* Header */
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  logoImage: {
    width: 120,
    height: 34,
    resizeMode: "contain",
  },
  headerRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  bellButton: {
    position: "relative",
    padding: 4,
  },
  bellBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#10b981",
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  avatarContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  avatarInitialsText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },

  /* Dropdown Overlay */
  dropdownOverlayWrapper: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  dropdownBackdrop: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15, 23, 42, 0.2)",
  },
  dropdownContainer: {
    position: "absolute",
    top: 60,
    right: 16,
    width: 320,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    overflow: "hidden",
  },
  dropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#f8fafc",
  },
  dropdownTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: DARK,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownItemIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#fff7ed",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  dropdownItemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: DARK,
  },
  dropdownItemSubtitle: {
    fontSize: 11,
    color: MUTED,
    marginTop: 2,
  },

  /* Profile Dropdown Panel */
  profileDropdownContainer: {
    position: "absolute",
    top: 60,
    right: 16,
    width: 270,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    overflow: "hidden",
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  profileDropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  profileBigAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  profileBigAvatarText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  profileNameText: {
    fontSize: 15,
    fontWeight: "800",
    color: DARK,
  },
  profileEmailText: {
    fontSize: 12,
    color: MUTED,
    marginTop: 1,
  },
  roleTag: {
    alignSelf: "flex-start",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#166534",
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 10,
  },
  profileActionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  profileActionText: {
    fontSize: 13,
    fontWeight: "600",
    color: DARK,
  },

  /* Greeting */
  greetingContainer: {
    marginBottom: 16,
  },
  greetingTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: DARK,
    letterSpacing: -0.5,
  },
  greetingSubtitle: {
    fontSize: 15,
    color: MUTED,
    marginTop: 4,
  },

  /* Search Bar */
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: DARK,
  },

  /* Stats Card */
  statsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  statCol: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: DARK,
    marginTop: 4,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: MUTED,
    fontWeight: "500",
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: "#f1f5f9",
  },

  /* Section Containers */
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: DARK,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: MUTED,
    marginTop: 2,
  },
  titleWithCountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 12,
  },
  sectionMainTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: DARK,
    marginRight: 10,
  },
  countText: {
    fontSize: 13,
    color: MUTED,
  },

  /* Card Container */
  cardContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginLeft: 16,
  },

  /* Por responder list */
  porResponderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingRight: 16,
    position: "relative",
  },
  redLeftAccent: {
    width: 4,
    height: "100%",
    backgroundColor: "#ea580c",
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    marginRight: 12,
  },
  porResponderMainInfo: {
    flex: 1,
  },
  otHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    flexWrap: "wrap",
  },
  otCodeText: {
    fontSize: 14,
    fontWeight: "800",
    color: DARK,
    marginRight: 8,
  },
  otTitleText: {
    fontSize: 14,
    fontWeight: "700",
    color: DARK,
    flex: 1,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationText: {
    fontSize: 13,
    color: MUTED,
  },
  porResponderTimeRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeLeftText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ea580c",
  },

  /* Footer Link */
  viewAllFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "700",
    color: TEAL,
  },

  /* Hoy timeline */
  hoyTimelineRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  timeText: {
    width: 48,
    fontSize: 13,
    fontWeight: "800",
    color: DARK,
  },
  timelineCol: {
    alignItems: "center",
    marginRight: 12,
    position: "relative",
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timelineLine: {
    position: "absolute",
    top: 8,
    width: 2,
    height: 48,
    backgroundColor: "#e2e8f0",
  },
  categoryIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  hoyMainDetails: {
    flex: 1,
    marginRight: 8,
  },
  hoyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: DARK,
    marginBottom: 2,
  },

  /* Priority Dot */
  priorityContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: "700",
  },

  /* Mañana section */
  mananaGridRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  mananaCol: {
    flex: 1,
    paddingRight: 12,
    position: "relative",
  },
  mananaTime: {
    fontSize: 13,
    fontWeight: "800",
    color: DARK,
    marginBottom: 4,
  },
  mananaTitle: {
    fontSize: 13,
    color: MUTED,
    marginBottom: 8,
    lineHeight: 18,
  },
  mananaDivider: {
    position: "absolute",
    right: 6,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "#f1f5f9",
  },

  /* Filter Pills */
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: BORDER,
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: MUTED,
  },
  filterPillTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },

  /* Bottom Tab Bar */
  bottomTabBar: {
    flexDirection: "row",
    height: 64,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  tabItemActive: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  activeTabTopBar: {
    position: "absolute",
    top: 0,
    width: 40,
    height: 3,
    backgroundColor: TEAL,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  tabTextActive: {
    fontSize: 11,
    fontWeight: "700",
    color: TEAL,
    marginTop: 2,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    fontSize: 11,
    color: MUTED,
    fontWeight: "500",
    marginTop: 2,
  },
  statColActive: {
    backgroundColor: "#f0fdfa",
    borderRadius: 12,
  },
  filterActiveBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  filterActiveText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1d4ed8",
  },
  filterClearText: {
    fontSize: 13,
    fontWeight: "700",
    color: TEAL,
    textDecorationLine: "underline",
  },
  tabBadge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: "#ef4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
});
