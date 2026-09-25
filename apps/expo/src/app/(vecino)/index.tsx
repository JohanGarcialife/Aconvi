import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { api, queryClient } from "~/utils/api";
import { useReadStatus } from "~/utils/notifications-tracker";
import { useVotedSessions } from "~/utils/voting-tracker";

const TENANT_ID = "org_aconvi_demo";

const PRIMARY = "#027580";
const DARK = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const BG = "#F9FAFB";
const CARD_BG = "#FFFFFF";
const ALERT_RED = "#EF4444";

function formatEuro(val?: string | number | null): string {
  if (val === undefined || val === null) return "";
  const str = String(val).trim();
  if (!str) return "";

  const clean = str.replace(/[€\s]/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(clean)) {
    return `${clean} €`;
  }
  const match = clean.match(/^(\d+)(?:[.,](\d+))?$/);
  if (match && match[1]) {
    const intPart = match[1].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const decPart = match[2];
    return decPart ? `${intPart},${decPart} €` : `${intPart} €`;
  }
  if (!str.includes("€")) {
    return `${str} €`;
  }
  return str;
}

// ─── Section Header Title Component ──────────────────────────────────────────
function SectionTitle({
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
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Countdown Timer Component ───────────────────────────────────────────────
function CountdownTimer({
  closesAt,
}: {
  closesAt: string | Date | null | undefined;
}) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    if (!closesAt) return;

    const update = () => {
      const diff = new Date(closesAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Plazo finalizado");
        setIsUrgent(true);
        return;
      }
      const totalHours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(totalHours / 24);
      const hours = totalHours % 24;
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setIsUrgent(totalHours < 24);

      if (days > 0) {
        setTimeLeft(`⏳ Quedan ${days}d ${hours}h`);
      } else if (hours > 0) {
        setTimeLeft(`⏳ Quedan ${hours}h ${minutes}m`);
      } else {
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`⏳ Quedan ${minutes}m ${seconds}s`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [closesAt]);

  if (!closesAt) return null;

  return (
    <View
      style={[styles.countdownBadge, isUrgent && styles.countdownBadgeUrgent]}
    >
      <Text
        style={[styles.countdownText, isUrgent && styles.countdownTextUrgent]}
      >
        {timeLeft}
      </Text>
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
    const items: {
      type: string;
      label: string;
      subtitle: string;
      route: string;
      emoji: string;
    }[] = [];

    incidents?.forEach((i: any) => {
      if (
        i.title?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q)
      ) {
        items.push({
          type: "Incidencia",
          label: i.title,
          subtitle: i.status,
          route: `/(vecino)/incidents/${i.id}`,
          emoji: "⚠️",
        });
      }
    });
    notices?.forEach((n: any) => {
      if (
        n.title?.toLowerCase().includes(q) ||
        n.body?.toLowerCase().includes(q)
      ) {
        items.push({
          type: "Comunicado",
          label: n.title,
          subtitle: format(new Date(n.createdAt), "dd MMM", { locale: es }),
          route: "/(vecino)/communication",
          emoji: "📢",
        });
      }
    });
    votings?.forEach((v: any) => {
      if (v.title?.toLowerCase().includes(q)) {
        items.push({
          type: "Votación",
          label: v.title,
          subtitle: v.status === "OPEN" ? "Abierta" : "Cerrada",
          route: "/(vecino)/voting",
          emoji: "🗳️",
        });
      }
    });
    return items;
  }, [query, incidents, notices, votings]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "#fff" }}
        edges={["top"]}
      >
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
          <TouchableOpacity
            onPress={() => {
              setQuery("");
              onClose();
            }}
            style={searchStyles.cancelBtn}
          >
            <Text style={searchStyles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>

        {query.trim() === "" ? (
          <View style={searchStyles.emptyState}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>🔍</Text>
            <Text style={{ color: MUTED, fontSize: 15 }}>
              Escribe para buscar en tu comunidad
            </Text>
          </View>
        ) : results.length === 0 ? (
          <View style={searchStyles.emptyState}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>🤷</Text>
            <Text style={{ color: MUTED, fontSize: 15 }}>
              Sin resultados para "{query}"
            </Text>
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
                <Text style={{ fontSize: 22, marginRight: 12 }}>
                  {item.emoji}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={searchStyles.resultLabel}>{item.label}</Text>
                  <Text style={searchStyles.resultSub}>
                    {item.type} · {item.subtitle}
                  </Text>
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
function ProfileModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "#fff" }}
        edges={["top"]}
      >
        <View
          style={{
            padding: 20,
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: BORDER,
          }}
        >
          <Text style={{ fontSize: 40, marginBottom: 8 }}>👤</Text>
          <Text style={{ fontSize: 18, fontWeight: "700", color: DARK }}>
            Mi Perfil
          </Text>
          <Text style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>
            Vecino — Aconvi Demo
          </Text>
        </View>
        {[
          {
            emoji: "🗳️",
            label: "Histórico de votos",
            route: "/(vecino)/votes-history",
          },
          { emoji: "€", label: "Mis Cuotas", route: "/(vecino)/fees" },
          {
            emoji: "📋",
            label: "Mis Reservas",
            route: "/(vecino)/common-areas",
          },
          { emoji: "📄", label: "Documentos", route: "/(vecino)/documents" },
        ].map((item) => (
          <TouchableOpacity
            key={item.route}
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 18,
              borderBottomWidth: 1,
              borderBottomColor: BORDER,
            }}
            onPress={() => {
              onClose();
              router.push(item.route as any);
            }}
          >
            <Text style={{ fontSize: 22, marginRight: 14 }}>{item.emoji}</Text>
            <Text
              style={{ fontSize: 16, color: DARK, fontWeight: "500", flex: 1 }}
            >
              {item.label}
            </Text>
            <Text style={{ color: MUTED, fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={{
            margin: 24,
            backgroundColor: "#FEF2F2",
            borderRadius: 12,
            padding: 16,
            alignItems: "center",
          }}
          onPress={() =>
            Alert.alert("Cerrar sesión", "¿Seguro?", [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Salir",
                style: "destructive",
                onPress: async () => {
                  await SecureStore.deleteItemAsync("expo_session_token").catch(
                    () => {},
                  );
                  queryClient.clear();
                  onClose();
                  router.replace("/login");
                },
              },
            ])
          }
        >
          <Text style={{ color: "#DC2626", fontWeight: "700", fontSize: 15 }}>
            Cerrar sesión
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: "center" }} onPress={onClose}>
          <Text style={{ color: PRIMARY, fontSize: 15, fontWeight: "600" }}>
            Cerrar
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function VecinoHome() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const [searchVisible, setSearchVisible] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeVotingSlide, setActiveVotingSlide] = useState(0);
  const [USER_ID, setUserId] = useState<string>(
    "00000000-0000-0000-0000-000000000000",
  );

  const { isSessionVoted } = useVotedSessions();

  const cardWidth = screenWidth - 32;
  const cardGap = 12;

  useEffect(() => {
    SecureStore.getItemAsync("expo_user_id")
      .then((id) => {
        if (id) setUserId(id);
      })
      .catch(console.warn);
  }, []);

  // ── Data Fetching with real-time polling ──
  const {
    data: votings,
    isLoading: loadingVoting,
    refetch: refetchVoting,
  } = useQuery({
    ...api.voting.all.queryOptions({ tenantId: TENANT_ID, userId: USER_ID }),
    refetchInterval: 5000,
  });
  const {
    data: notices,
    isLoading: loadingNotice,
    refetch: refetchNotice,
  } = useQuery({
    ...api.notice.all.queryOptions({ tenantId: TENANT_ID }),
    refetchInterval: 8000,
  });
  const {
    data: incidents,
    isLoading: loadingIncident,
    refetch: refetchIncident,
  } = useQuery({
    ...api.incident.all.queryOptions({ tenantId: TENANT_ID }),
    refetchInterval: 8000,
  });
  const {
    data: bookings,
    isLoading: loadingBooking,
    refetch: refetchBooking,
  } = useQuery({
    ...api.commonArea.myBookings.queryOptions(),
    refetchInterval: 15000,
  });

  const {
    data: commonAreas,
    isLoading: loadingCommonAreas,
    refetch: refetchCommonAreas,
  } = useQuery({
    ...api.commonArea.all.queryOptions({ tenantId: TENANT_ID }),
    refetchInterval: 15000,
  });

  const DEMO_AUTHOR_ID = "user_admin";
  const {
    data: fees,
    isLoading: loadingFees,
    refetch: refetchFees,
  } = useQuery({
    ...api.fee.myFees.queryOptions({
      tenantId: TENANT_ID,
      userId: USER_ID || DEMO_AUTHOR_ID,
    }),
    refetchInterval: 15000,
  });

  // Auto refetch every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      void refetchVoting();
      void refetchNotice();
      void refetchIncident();
      void refetchFees();
      void refetchBooking();
      void refetchCommonAreas();
    }, [
      refetchVoting,
      refetchNotice,
      refetchIncident,
      refetchFees,
      refetchBooking,
      refetchCommonAreas,
    ]),
  );

  // Manual pull to refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([
      refetchVoting(),
      refetchNotice(),
      refetchIncident(),
      refetchBooking(),
      refetchCommonAreas(),
      refetchFees(),
    ]);
    setRefreshing(false);
  }, [
    refetchVoting,
    refetchNotice,
    refetchIncident,
    refetchBooking,
    refetchCommonAreas,
    refetchFees,
  ]);

  // ── Computed Values ──
  const allVotings = (votings as any[] | undefined) ?? [];
  const NOW = Date.now();
  const H48 = 48 * 60 * 60 * 1000;

  // Votación con status OPEN pero plazo ya expirado → la tratamos como expirada
  const isExpiredOpen = (v: any) =>
    v.status === "OPEN" &&
    Boolean(
      (v.closesAt && new Date(v.closesAt).getTime() < NOW) ||
        (v.type === "JUNTA" && v.meetingDate && new Date(v.meetingDate).getTime() < NOW),
    );

  const openVotings = allVotings.filter(
    (v: any) => v.status === "OPEN" && !v.isArchived && !isExpiredOpen(v),
  );
  // Cerradas incluye CLOSED + OPEN expiradas
  const closedVotings = allVotings.filter(
    (v: any) => (v.status === "CLOSED" || isExpiredOpen(v)) && !v.isArchived,
  );

  // Filtrar cerradas que llevan >48 horas cerradas — van al histórico, no al Home
  const recentClosedVotings = closedVotings.filter((v: any) => {
    const closedTime = v.closedAt
      ? new Date(v.closedAt).getTime()
      : v.closesAt
        ? new Date(v.closesAt).getTime()
        : NOW;
    return NOW - closedTime <= H48;
  });

  // ── Helper fecha (YYYY-MM-DD) para comparar días de cierre ──
  const toDayString = (d: string | Date | null | undefined) => {
    if (!d) return null;
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return null;
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  };

  // ── Client requirement Punto 3: Orden de votaciones del vecino ──
  // • Si una votación finaliza antes, va primero, aunque ya esté votada.
  // • Si ambas finalizan el mismo día, va primero la que NO está votada.
  // • Si ambas no están votadas, manda la que finaliza antes.
  const sortedOpen = [...openVotings].sort((a: any, b: any) => {
    const timeA = a.closesAt ? new Date(a.closesAt).getTime() : Infinity;
    const timeB = b.closesAt ? new Date(b.closesAt).getTime() : Infinity;

    const dayA = toDayString(a.closesAt);
    const dayB = toDayString(b.closesAt);

    // 1. Si finalizan en fechas (días) distintas: manda la que finaliza antes, aunque ya esté votada
    if (dayA && dayB && dayA !== dayB) {
      return timeA - timeB;
    }

    // Si solo una tiene fecha de cierre definida, esa va primero
    if (dayA && !dayB) return -1;
    if (!dayA && dayB) return 1;

    // 2. Si ambas finalizan el mismo día: va primero la que NO está votada
    const hasVotedA = Boolean(a.hasVoted || isSessionVoted(a.id));
    const hasVotedB = Boolean(b.hasVoted || isSessionVoted(b.id));
    if (!hasVotedA && hasVotedB) return -1;
    if (hasVotedA && !hasVotedB) return 1;

    // 3. Si ambas no están votadas (o ambas ya votadas): manda la que finaliza antes (hora)
    if (timeA !== timeB) {
      return timeA - timeB;
    }

    // Desempate por prioridad y fecha de creación
    const prioDiff = (b.priority || 0) - (a.priority || 0);
    if (prioDiff !== 0) return prioDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Sort closed votings: closedAt desc (most recent first)
  const sortedClosed = [...recentClosedVotings].sort((a: any, b: any) => {
    const timeA = a.closedAt ? new Date(a.closedAt).getTime() : a.closesAt ? new Date(a.closesAt).getTime() : new Date(a.createdAt).getTime();
    const timeB = b.closedAt ? new Date(b.closedAt).getTime() : b.closesAt ? new Date(b.closesAt).getTime() : new Date(b.createdAt).getTime();
    return timeB - timeA;
  });

  // Client requirement: Abiertas (según urgencia) → cerradas recientes (<48h)
  const displayVotings = [...sortedOpen, ...sortedClosed];

  const handleVotingScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const slide = Math.round(offsetX / (cardWidth + cardGap));
      if (
        slide >= 0 &&
        slide < displayVotings.length &&
        slide !== activeVotingSlide
      ) {
        setActiveVotingSlide(slide);
      }
    },
    [activeVotingSlide, displayVotings.length, cardWidth, cardGap],
  );

  const latestNotice = (notices as any[] | undefined)?.[0];
  const latestIncident = (incidents as any[] | undefined)?.find(
    (i: any) =>
      i.status !== "RECHAZADA" &&
      !(i.status === "RESUELTA" && i.rating !== null),
  );

  const nextBooking = (bookings as any[] | undefined)?.filter((b: any) => {
    const today = format(new Date(), "yyyy-MM-dd");
    return b.date >= today;
  })[0];

  const hasActiveCommonAreas = useMemo(() => {
    return (
      (commonAreas as any[] | undefined)?.some((area: any) => area.isActive) ??
      false
    );
  }, [commonAreas]);

  const { readNoticeIds, lastSeenFeesTs } = useReadStatus();

  // Notification badge: punto rojo si hay avisos no leídos o cuotas pendientes
  const hasUnreadNotices = ((notices as any[] | undefined) ?? []).some(
    (n: any) => !readNoticeIds.includes(n.id),
  );
  const hasPendingFeesAlert = ((fees as any[] | undefined) ?? []).some(
    (f: any) =>
      (f.status === "PENDING" || f.status === "OVERDUE") &&
      (!lastSeenFeesTs || new Date(f.createdAt).getTime() > lastSeenFeesTs),
  );
  const hasNotif = hasUnreadNotices || hasPendingFeesAlert;

  // Compute pending fees
  const pendingAmount =
    fees
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
            {hasNotif && (
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  backgroundColor: ALERT_RED,
                  borderRadius: 5,
                  width: 8,
                  height: 8,
                }}
              />
            )}
          </TouchableOpacity>
          {/* Profile — opens modal */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setProfileVisible(true)}
          >
            <Text style={{ fontSize: 22 }}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[PRIMARY]}
            tintColor={PRIMARY}
          />
        }
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

        {/* ── Carrusel de Votaciones Activas ── */}
        {loadingVoting ? (
          <View style={styles.card}>
            <SectionTitle title="Votación Activa" />
            <ActivityIndicator color={PRIMARY} />
          </View>
        ) : displayVotings.length > 0 ? (
          <View style={styles.carouselContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={cardWidth + cardGap}
              snapToAlignment="start"
              decelerationRate="fast"
              contentContainerStyle={styles.carouselContent}
              onScroll={handleVotingScroll}
              scrollEventThrottle={16}
            >
              {displayVotings.map((voting: any) => {
                const isJunta = voting.type === "JUNTA";
                const isVoted = Boolean(
                  voting.hasVoted || isSessionVoted(voting.id),
                );
                // Tratar como cerrada si status CLOSED o plazo expirado
                const isClosed =
                  voting.status === "CLOSED" ||
                  Boolean(voting.closesAt && new Date(voting.closesAt).getTime() < NOW) ||
                  Boolean(voting.type === "JUNTA" && voting.meetingDate && new Date(voting.meetingDate).getTime() < NOW);

                // Calcular resultado para mostrar en tarjeta cerrada
                const resultText: string | null = (() => {
                  if (!isClosed) return null;
                  if (voting.resultSummary && typeof voting.resultSummary === "string") {
                    if (
                      voting.resultSummary.includes("Aprobado con") ||
                      voting.resultSummary.includes("Rechazado (")
                    ) {
                      return voting.resultSummary;
                    }
                  }

                  // Calcular a partir de casts u options
                  let approveW = 0;
                  let rejectW = 0;
                  let totalW = 0;

                  const isApprove = (c: any) => {
                    const ch = (c.choice || "").toUpperCase();
                    if (ch === "APPROVE" || ch === "APRUEBO" || ch === "SI" || ch === "SÍ") return true;
                    if (c.optionId && voting.options) {
                      const opt = voting.options.find((o: any) => o.id === c.optionId);
                      if (opt && opt.label?.toLowerCase().includes("aprueb")) return true;
                    }
                    return false;
                  };

                  const isReject = (c: any) => {
                    const ch = (c.choice || "").toUpperCase();
                    if (ch === "REJECT" || ch === "RECHAZO" || ch === "NO") return true;
                    if (c.optionId && voting.options) {
                      const opt = voting.options.find((o: any) => o.id === c.optionId);
                      if (opt && opt.label?.toLowerCase().includes("rechaz")) return true;
                    }
                    return false;
                  };

                  if (Array.isArray(voting.casts) && voting.casts.length > 0) {
                    approveW = voting.casts
                      .filter(isApprove)
                      .reduce((sum: number, c: any) => sum + (c.coefficient || 1), 0);
                    rejectW = voting.casts
                      .filter(isReject)
                      .reduce((sum: number, c: any) => sum + (c.coefficient || 1), 0);
                    const abstainW = voting.casts
                      .filter((c: any) => (c.choice || "").toUpperCase() === "ABSTAIN")
                      .reduce((sum: number, c: any) => sum + (c.coefficient || 1), 0);
                    totalW = approveW + rejectW + abstainW;
                  } else if (Array.isArray(voting.options) && voting.options.length > 0) {
                    const approveOpt = voting.options.find((o: any) => o.label?.toLowerCase().includes("aprueb"));
                    const rejectOpt = voting.options.find((o: any) => o.label?.toLowerCase().includes("rechaz"));
                    const abstainOpt = voting.options.find((o: any) => o.label?.toLowerCase().includes("absten"));

                    approveW = (approveOpt?.weightedTotal && approveOpt.weightedTotal > 0)
                      ? approveOpt.weightedTotal
                      : (approveOpt?.voteCount ?? 0);
                    rejectW = (rejectOpt?.weightedTotal && rejectOpt.weightedTotal > 0)
                      ? rejectOpt.weightedTotal
                      : (rejectOpt?.voteCount ?? 0);
                    const abstainW = (abstainOpt?.weightedTotal && abstainOpt.weightedTotal > 0)
                      ? abstainOpt.weightedTotal
                      : (abstainOpt?.voteCount ?? 0);
                    totalW = approveW + rejectW + abstainW;
                  }

                  if (totalW > 0) {
                    const pct = Math.round((approveW / totalW) * 100);
                    return approveW >= rejectW && pct >= 50
                      ? `Aprobado con el ${pct} %`
                      : `Rechazado (${pct} % a favor)`;
                  }

                  return "Rechazado (0 % a favor)";
                })();

                const isApprovedResult = Boolean(
                  resultText && resultText.toLowerCase().includes("aprobado"),
                );
                return (
                  <View
                    key={voting.id}
                    style={[styles.card, { width: cardWidth, marginBottom: 0 }]}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <Text
                        style={[
                          styles.sectionTitle,
                          {
                            color: isClosed ? "#64748b" : PRIMARY,
                            fontSize: 12,
                            letterSpacing: 0.8,
                            fontWeight: "700",
                          },
                        ]}
                      >
                        {isClosed
                          ? isJunta
                            ? "JUNTA CERRADA"
                            : "VOTACIÓN CERRADA"
                          : isJunta
                            ? "JUNTA EXTRAORDINARIA"
                            : "VOTACIÓN ACTIVA"}
                      </Text>
                      {isClosed ? (
                        <View
                          style={{
                            backgroundColor: "#f1f5f9",
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 12,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "600",
                              color: "#64748b",
                            }}
                          >
                            🔒 Finalizada
                          </Text>
                        </View>
                      ) : voting.closesAt ? (
                        <CountdownTimer closesAt={voting.closesAt} />
                      ) : null}
                    </View>
                    <Text style={styles.cardTitleMedium}>
                      {isJunta
                        ? `${
                            voting.items?.filter(
                              (i: any) => i.onlineVotingEnabled !== false,
                            )?.length ||
                            voting.items?.length ||
                            3
                          } decisiones para votar`
                        : voting.title}
                    </Text>

                    {isClosed && resultText ? (
                      <View
                        style={{
                          backgroundColor: isApprovedResult ? "#f0fdf4" : "#fef2f2",
                          borderWidth: 1,
                          borderColor: isApprovedResult ? "#bbf7d0" : "#fecaca",
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          marginBottom: 8,
                          alignSelf: "flex-start",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: isApprovedResult ? "#15803d" : "#dc2626",
                          }}
                        >
                          {isApprovedResult ? "✓ " : "✕ "}
                          {resultText}
                        </Text>
                      </View>
                    ) : null}

                    {isJunta && !isClosed ? (
                      <Text
                        style={{
                          color: PRIMARY,
                          fontSize: 13,
                          fontWeight: "700",
                          marginBottom: 4,
                        }}
                      >
                        {voting.userCasts?.length || 0} de{" "}
                        {voting.items?.filter(
                          (i: any) => i.onlineVotingEnabled !== false,
                        )?.length ||
                          voting.items?.length ||
                          3}{" "}
                        respondidas
                      </Text>
                    ) : !isClosed && voting.budget ? (
                      <Text style={styles.votingAmount}>{formatEuro(voting.budget)}</Text>
                    ) : null}

                    <Text
                      style={[
                        styles.mutedText,
                        { fontSize: 13, marginBottom: 14 },
                      ]}
                    >
                      {isClosed
                        ? voting.closedAt
                          ? `Finalizada el ${format(new Date(voting.closedAt), "d MMM. · HH:mm", { locale: es })}`
                          : voting.closesAt
                            ? `Finalizada el ${format(new Date(voting.closesAt), "d MMM. · HH:mm", { locale: es })}`
                            : "Votación finalizada"
                        : voting.closesAt
                          ? `Cierre: ${format(new Date(voting.closesAt), "d MMM. · HH:mm", { locale: es })}`
                          : "Sin fecha límite"}
                    </Text>

                    <TouchableOpacity
                      style={[
                        styles.primaryButton,
                        isClosed && { backgroundColor: "#0f766e" },
                      ]}
                      activeOpacity={0.8}
                      onPress={() =>
                        router.push({
                          pathname: "/(vecino)/voting",
                          params: { sessionId: voting.id },
                        } as any)
                      }
                    >
                      <Text style={styles.primaryButtonText}>
                        {isClosed
                          ? "Ver resultados"
                          : isVoted
                            ? "Ver mi voto / Resultados"
                            : isJunta
                              ? "Entrar a votar"
                              : "Votar ahora"}
                      </Text>
                      <Text style={styles.primaryButtonArrow}>→</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>

            {/* Dots de paginación si hay múltiples votaciones activas */}
            {displayVotings.length > 1 && (
              <View style={styles.carouselPagination}>
                {displayVotings.map((v: any, index: number) => (
                  <View
                    key={v.id ?? index}
                    style={[
                      styles.carouselDot,
                      index === activeVotingSlide && styles.carouselDotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        ) : null}

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
                <ActivityIndicator
                  color={PRIMARY}
                  style={{ alignSelf: "flex-start" }}
                />
              ) : (
                <>
                  <Text style={styles.cardTitleSmall}>
                    <Text style={{ fontWeight: "700", color: DARK }}>
                      {pendingAmount} €
                    </Text>{" "}
                    pendientes
                  </Text>
                  <Text style={styles.mutedText}>
                    {fees?.length === 0
                      ? "Sin pagos pendientes"
                      : "Actualizado hoy"}
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
        {(loadingNotice || latestNotice) && (
          <View style={styles.card}>
            <SectionTitle title="Comunicados" />
            {loadingNotice ? (
              <ActivityIndicator color={PRIMARY} />
            ) : (
              <TouchableOpacity
                style={styles.rowItem}
                activeOpacity={0.7}
                onPress={() => router.push("/(vecino)/communication")}
              >
                <View style={styles.iconBox}>
                  <Text style={styles.iconLarge}>
                    {latestNotice.type === "URGENTE"
                      ? "🚨"
                      : latestNotice.type === "AVISO"
                        ? "📢"
                        : "📋"}
                  </Text>
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.cardTitleSmall}>
                    {latestNotice.title}
                  </Text>
                  <Text style={styles.mutedText}>
                    {format(
                      new Date(latestNotice.createdAt),
                      "dd MMM · HH:mm",
                      { locale: es },
                    )}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

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
              onPress={() =>
                router.push(`/(vecino)/incidents/${latestIncident.id}`)
              }
            >
              <View style={styles.iconBox}>
                <Text style={[styles.iconLarge, { color: PRIMARY }]}>💧</Text>
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.cardTitleSmall}>
                  {latestIncident.title}
                </Text>
                <Text style={styles.mutedText}>
                  Estado:{" "}
                  {latestIncident.status === "EN_REVISION"
                    ? "Profesional asignado"
                    : latestIncident.status === "RECIBIDA"
                      ? "Incidencia recibida"
                      : latestIncident.status === "AGENDADA"
                        ? "Intervención confirmada"
                        : latestIncident.status === "EN_CURSO"
                          ? "En intervención"
                          : latestIncident.status === "RESUELTA"
                            ? "Resuelta"
                            : latestIncident.status === "CERRADA"
                              ? "Incidencia cerrada"
                              : latestIncident.status === "RECHAZADA"
                                ? "No procede"
                                : latestIncident.status}{" "}
                  ·{" "}
                  {format(new Date(latestIncident.createdAt), "dd MMM", {
                    locale: es,
                  })}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.mutedText}>
              {incidents && incidents.length > 0
                ? "No tienes incidencias activas."
                : "No tienes incidencias reportadas."}
            </Text>
          )}
        </View>

        {/* ── Reservas de Zonas Comunes Card ── */}
        {(loadingCommonAreas || hasActiveCommonAreas) && (
          <View style={[styles.card, { marginBottom: 32 }]}>
            <SectionTitle title="Reservas de Zonas Comunes" />
            {loadingBooking || loadingCommonAreas ? (
              <ActivityIndicator color={PRIMARY} />
            ) : nextBooking ? (
              <View style={styles.rowItem}>
                <View style={styles.iconBox}>
                  <Text style={styles.iconLarge}>🏊</Text>
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.cardTitleSmall}>
                    {nextBooking.commonArea?.name ?? "Zona Común"}
                  </Text>
                  <Text style={styles.mutedText}>
                    {format(new Date(nextBooking.date), "dd MMM", {
                      locale: es,
                    })}{" "}
                    · {nextBooking.startTime} h
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
                  <Text style={styles.mutedText}>
                    No tienes reservas próximas.
                  </Text>
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
        )}
      </ScrollView>

      {/* ── Modals ── */}
      <SearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        incidents={(incidents as any[]) ?? []}
        notices={(notices as any[]) ?? []}
        votings={(votings as any[]) ?? []}
      />
      <ProfileModal
        visible={profileVisible}
        onClose={() => setProfileVisible(false)}
      />
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
  resultLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: DARK,
    marginBottom: 2,
  },
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
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: MUTED,
    letterSpacing: 0.5,
  },
  sectionAction: { fontSize: 14, fontWeight: "600", color: PRIMARY },

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
  mutedText: { fontSize: 13, color: MUTED },

  primaryButton: {
    flexDirection: "row",
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    width: "100%",
    alignSelf: "stretch",
  },
  primaryButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  primaryButtonArrow: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "600",
    marginLeft: 8,
  },
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
  iconBox: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  iconLarge: { fontSize: 22, color: DARK },
  euroCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  euroCircleText: { fontSize: 20, color: "#fff", fontWeight: "700" },
  rowContent: { flex: 1, justifyContent: "center" },
  cardTitleSmall: {
    fontSize: 15,
    fontWeight: "500",
    color: DARK,
    marginBottom: 2,
  },
  chevron: { fontSize: 20, color: MUTED, marginLeft: 8 },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 16 },

  // Countdown badge styles
  countdownBadge: {
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  countdownBadgeUrgent: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  countdownText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#16A34A",
  },
  countdownTextUrgent: {
    color: "#DC2626",
  },

  // Carousel styles
  carouselContainer: {
    marginHorizontal: -16,
    marginBottom: 16,
  },
  carouselContent: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 12,
  },
  carouselPagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#CBD5E1",
  },
  carouselDotActive: {
    width: 20,
    backgroundColor: PRIMARY,
  },
});
