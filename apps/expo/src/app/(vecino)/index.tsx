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

const TENANT_ID = "org_aconvi_demo";

const PRIMARY = "#027580";
const DARK = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const BG = "#F9FAFB";
const CARD_BG = "#FFFFFF";

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
  const openVotings = allVotings.filter(
    (v: any) => v.status === "OPEN" && !v.isArchived,
  );

  // Sort open votings: non-voted first, then priority desc, then closesAt asc
  const sortedOpen = [...openVotings].sort((a: any, b: any) => {
    if (!a.hasVoted && b.hasVoted) return -1;
    if (a.hasVoted && !b.hasVoted) return 1;
    const prioDiff = (b.priority || 0) - (a.priority || 0);
    if (prioDiff !== 0) return prioDiff;
    if (a.closesAt && b.closesAt) {
      return new Date(a.closesAt).getTime() - new Date(b.closesAt).getTime();
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const handleVotingScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const slide = Math.round(offsetX / (cardWidth + cardGap));
      if (
        slide >= 0 &&
        slide < sortedOpen.length &&
        slide !== activeVotingSlide
      ) {
        setActiveVotingSlide(slide);
      }
    },
    [activeVotingSlide, sortedOpen.length, cardWidth, cardGap],
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

  // Notification badge = unread notices
  const notifCount = (notices as any[])?.length ?? 0;

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
            {notifCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {notifCount > 9 ? "9+" : notifCount}
                </Text>
              </View>
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
        ) : sortedOpen.length > 0 ? (
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
              {sortedOpen.map((voting: any) => {
                const isJunta = voting.type === "JUNTA";
                const isVoted = voting.hasVoted;
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
                            color: PRIMARY,
                            fontSize: 12,
                            letterSpacing: 0.8,
                            fontWeight: "700",
                          },
                        ]}
                      >
                        {isJunta ? "JUNTA EXTRAORDINARIA" : "VOTACIÓN ACTIVA"}
                      </Text>
                      {voting.closesAt ? (
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
                    {isJunta ? (
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
                    ) : (
                      voting.budget && (
                        <Text style={styles.votingAmount}>{voting.budget}</Text>
                      )
                    )}
                    <Text
                      style={[
                        styles.mutedText,
                        { fontSize: 13, marginBottom: 14 },
                      ]}
                    >
                      {voting.closesAt
                        ? `Cierre: ${format(new Date(voting.closesAt), "d MMM. · HH:mm", { locale: es })}`
                        : "Sin fecha límite"}
                    </Text>

                    <TouchableOpacity
                      style={styles.primaryButton}
                      activeOpacity={0.8}
                      onPress={() =>
                        router.push({
                          pathname: "/(vecino)/voting",
                          params: { sessionId: voting.id },
                        } as any)
                      }
                    >
                      <Text style={styles.primaryButtonText}>
                        {isVoted
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
            {sortedOpen.length > 1 && (
              <View style={styles.carouselPagination}>
                {sortedOpen.map((v: any, index: number) => (
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
