import { useCallback, useMemo, useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";

import { api, queryClient } from "~/utils/api";

const TENANT_ID = "org_aconvi_demo";

const NAVY = "#133A63";
const BLUE_MUTED = "#3B6E9C";
const GREEN = "#00875A";
const GREEN_LIGHT = "#D7F1E7";
const RED = "#EF4444";
const BORDER = "#DCE6F2";
const BG = "#F7FAFC";

function formatPct(num: number): string {
  return num.toFixed(2).replace(".", ",");
}

function buildQrMatrix(seed: string): boolean[][] {
  const size = 21;
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );

  const placeFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        if (grid[r0 + r]) {
          grid[r0 + r]![c0 + c] = isBorder || isCenter;
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= size - 8;
      const inBottomLeft = r >= size - 8 && c < 8;
      if (inTopLeft || inTopRight || inBottomLeft) continue;
      if (r === 6 || c === 6) {
        grid[r]![c] = (r + c) % 2 === 0;
        continue;
      }
      hash ^= (r * 31 + c * 17) & 0xff;
      hash = Math.imul(hash, 16777619);
      grid[r]![c] = (Math.abs(hash) % 10) < 5;
    }
  }
  return grid;
}

export default function AfAsistenciaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionIdParam =
    typeof params.sessionId === "string" && params.sessionId.length > 0
      ? params.sessionId
      : undefined;

  const [filterTab, setFilterTab] = useState<"ALL" | "PRESENT" | "ABSENT">(
    "ALL",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(
    "mem_owner_juan_rodriguez",
  );
  const [repName, setRepName] = useState("");
  const [repDocId, setRepDocId] = useState("");
  const [repPhone, setRepPhone] = useState("");
  const [repEmail, setRepEmail] = useState("");
  const [repDocVerified, setRepDocVerified] = useState(false);
  const [repError, setRepError] = useState<string | null>(null);
  const [qrVisible, setQrVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: attendance, isLoading } = useQuery(
    api.meeting.attendance.queryOptions({
      tenantId: TENANT_ID,
      sessionId: sessionIdParam,
    }),
  );

  const setPresenceMutation = useMutation(
    api.meeting.setPresence.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(api.meeting.attendance.pathFilter());
      },
    }),
  );

  const saveRepMutation = useMutation(
    api.meeting.saveRepresentative.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(api.meeting.attendance.pathFilter());
        setExpandedMemberId(null);
        setRepError(null);
      },
      onError: (err) => {
        setRepError(err.message || "No se pudo guardar el representante.");
      },
    }),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries(api.meeting.attendance.pathFilter());
    } finally {
      setRefreshing(false);
    }
  }, []);

  const owners = attendance?.owners ?? [];

  const handleExpandOwner = (owner: (typeof owners)[number]) => {
    if (expandedMemberId === owner.memberId) {
      setExpandedMemberId(null);
      setRepError(null);
      return;
    }
    setExpandedMemberId(owner.memberId);
    setRepName(owner.repName ?? "");
    setRepDocId(owner.repDocId ?? "");
    setRepPhone(owner.repPhone ?? "");
    setRepEmail(owner.repEmail ?? "");
    setRepDocVerified(owner.repDocVerified ?? false);
    setRepError(null);
  };

  const handleTogglePresent = (owner: (typeof owners)[number]) => {
    if (!attendance?.session.id) return;
    setPresenceMutation.mutate({
      tenantId: TENANT_ID,
      sessionId: attendance.session.id,
      memberId: owner.memberId,
      present: !owner.present,
      checkInMethod: "MANUAL",
    });
  };

  const handleSaveRepresentative = (owner: (typeof owners)[number]) => {
    if (!attendance?.session.id) return;
    if (!repName.trim() || !repDocId.trim()) {
      setRepError("Completa nombre, apellidos y DNI o CIF del representante.");
      return;
    }
    if (!repDocVerified) {
      setRepError(
        "Debes confirmar que has visto el documento de representación firmado.",
      );
      return;
    }
    setRepError(null);
    saveRepMutation.mutate({
      tenantId: TENANT_ID,
      sessionId: attendance.session.id,
      memberId: owner.memberId,
      repName: repName.trim(),
      repDocId: repDocId.trim(),
      repPhone: repPhone.trim() || undefined,
      repEmail: repEmail.trim() || undefined,
      repDocVerified,
    });
  };

  const filteredOwners = useMemo(() => {
    return owners.filter((o) => {
      if (filterTab === "PRESENT" && !o.present) return false;
      if (filterTab === "ABSENT" && o.present) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = o.name.toLowerCase().includes(q);
        const matchDoor = o.door.toLowerCase().includes(q);
        const matchRep = (o.repName ?? "").toLowerCase().includes(q);
        const matchDoc = (o.repDocId ?? "").toLowerCase().includes(q);
        return matchName || matchDoor || matchRep || matchDoc;
      }
      return true;
    });
  }, [owners, filterTab, searchQuery]);

  const participationPct = attendance?.participationPct ?? 42.35;
  const missingPct = attendance?.missingForQuorumPct ?? 7.65;
  const presentCount = attendance?.presentCount ?? 6;
  const absentCount = attendance?.absentCount ?? 6;
  const totalOwners = attendance?.totalOwners ?? 12;

  const qrMatrix = useMemo(
    () => buildQrMatrix(attendance?.session.id ?? "asistencia-jardines-turia"),
    [attendance?.session.id],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.push("/(af)/juntas" as any)}
          >
            <Ionicons name="arrow-back" size={22} color="#1E63B5" />
          </TouchableOpacity>
          <Image
            source={require("../../../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => router.push("/(af)/comunicados" as any)}
          >
            <Ionicons name="notifications-outline" size={24} color={NAVY} />
            <View style={styles.bellDot} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.avatarCircle}
            onPress={() => router.push("/(af)/comunidades" as any)}
          >
            <Text style={styles.avatarInitials}>JL</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={GREEN}
          />
        }
      >
        {/* Header Block */}
        <View style={styles.headerBlock}>
          <View style={styles.headerIconBox}>
            <Ionicons name="people-outline" size={30} color={GREEN} />
          </View>
          <View style={styles.headerTextCol}>
            <Text style={styles.headerTitle}>Asistencia</Text>
            <Text style={styles.headerCommunity}>
              {attendance?.communityName ?? "Jardines del Turia"}
            </Text>
            <Text style={styles.headerMeta}>Hoy, 08:45 · 1ª convocatoria</Text>
            <Text style={styles.headerMeta}>42 propietarios</Text>
          </View>
        </View>

        {/* Quorum Progress Card */}
        <View style={styles.quorumCard}>
          <View style={styles.quorumMetricsRow}>
            <View style={styles.quorumCol}>
              <Text style={styles.quorumValueBig}>
                {formatPct(participationPct)} %
              </Text>
              <Text style={styles.quorumLabel}>Participación</Text>
            </View>

            <View style={styles.quorumVerticalLine} />

            <View style={styles.quorumCol}>
              <Text style={styles.quorumValueMid}>
                {missingPct > 0
                  ? `Faltan ${formatPct(missingPct)} %`
                  : "Quórum alcanzado"}
              </Text>
              <Text style={styles.quorumLabel}>Para el mínimo</Text>
            </View>

            <View style={styles.quorumVerticalLine} />

            <View style={styles.quorumColRight}>
              <Text style={styles.quorumValueSmall}>Mínimo 50 %</Text>
              <Text style={styles.quorumLabel}>Quórum</Text>
            </View>
          </View>

          {/* Progress Bar with 50% Marker */}
          <View style={styles.progressSection}>
            <View style={styles.markerTopTickWrap}>
              <View style={styles.markerTopTick} />
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(100, Math.max(4, participationPct))}%`,
                  },
                ]}
              />
              <View style={styles.markerDot} />
            </View>
            <Text style={styles.markerLabel}>50 %</Text>
          </View>
        </View>

        {/* Filter Segmented Control */}
        <View style={styles.segmentedBar}>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              filterTab === "ALL" && styles.segmentBtnActive,
            ]}
            onPress={() => setFilterTab("ALL")}
          >
            <Text
              style={[
                styles.segmentText,
                filterTab === "ALL" && styles.segmentTextActive,
              ]}
            >
              Todos ({totalOwners})
            </Text>
          </TouchableOpacity>

          <View style={styles.segmentDivider} />

          <TouchableOpacity
            style={[
              styles.segmentBtn,
              filterTab === "PRESENT" && styles.segmentBtnActive,
            ]}
            onPress={() => setFilterTab("PRESENT")}
          >
            <Text
              style={[
                styles.segmentText,
                filterTab === "PRESENT" && styles.segmentTextActive,
              ]}
            >
              Presentes ({presentCount})
            </Text>
          </TouchableOpacity>

          <View style={styles.segmentDivider} />

          <TouchableOpacity
            style={[
              styles.segmentBtn,
              filterTab === "ABSENT" && styles.segmentBtnActive,
            ]}
            onPress={() => setFilterTab("ABSENT")}
          >
            <Text
              style={[
                styles.segmentText,
                filterTab === "ABSENT" && styles.segmentTextActive,
              ]}
            >
              Ausentes ({absentCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Ver código QR Button */}
        <View style={styles.qrBtnRow}>
          <TouchableOpacity
            style={styles.qrOutlineBtn}
            activeOpacity={0.8}
            onPress={() => setQrVisible(true)}
          >
            <Ionicons name="qr-code-outline" size={18} color={GREEN} />
            <Text style={styles.qrOutlineBtnText}>Ver código QR</Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#5B87B5" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Nombre, apellidos, DNI, CIF o puerta..."
            placeholderTextColor="#759BC2"
            style={styles.searchInput}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#5B87B5" />
            </TouchableOpacity>
          )}
        </View>

        {isLoading && owners.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={GREEN} />
          </View>
        ) : null}

        {/* Owners List */}
        <View style={styles.ownersList}>
          {filteredOwners.map((owner) => {
            const isExpanded = expandedMemberId === owner.memberId;
            return (
              <View key={owner.memberId} style={styles.ownerBlock}>
                <View style={styles.ownerRow}>
                  <TouchableOpacity
                    style={styles.ownerLeftTouch}
                    activeOpacity={0.75}
                    onPress={() => handleExpandOwner(owner)}
                  >
                    <View style={styles.ownerInitialsCircle}>
                      <Text style={styles.ownerInitialsText}>
                        {owner.initials}
                      </Text>
                    </View>
                    <View style={styles.ownerInfoCol}>
                      <Text style={styles.ownerName}>{owner.name}</Text>
                      <Text style={styles.ownerDoorCoeff}>
                        {owner.door} · {formatPct(owner.coefficient)} %
                      </Text>
                      {owner.repName ? (
                        <Text style={styles.ownerRepBadge}>
                          Representante: {owner.repName}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>

                  <View style={styles.ownerActionsRight}>
                    <TouchableOpacity
                      style={[
                        styles.checkbox,
                        owner.present && styles.checkboxChecked,
                      ]}
                      activeOpacity={0.75}
                      onPress={() => handleTogglePresent(owner)}
                    >
                      {owner.present && (
                        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.expandChevronBtn}
                      onPress={() => handleExpandOwner(owner)}
                    >
                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={20}
                        color="#1E5288"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Inline Representative Form */}
                {isExpanded && (
                  <View style={styles.repCard}>
                    <TouchableOpacity
                      style={styles.repCardHeader}
                      activeOpacity={0.8}
                      onPress={() => setExpandedMemberId(null)}
                    >
                      <Text style={styles.repCardTitle}>
                        Representante de {owner.name}{" "}
                        <Text style={styles.repCardDoor}>· {owner.door}</Text>
                      </Text>
                      <Ionicons name="chevron-up" size={18} color={NAVY} />
                    </TouchableOpacity>

                    <TextInput
                      value={repName}
                      onChangeText={(v) => {
                        setRepName(v);
                        if (repError) setRepError(null);
                      }}
                      placeholder="Nombre y apellidos"
                      placeholderTextColor="#8AA8C7"
                      style={styles.repInput}
                    />

                    <View style={styles.repTwoCols}>
                      <View style={styles.repCol}>
                        <Text style={styles.repLabel}>DNI o CIF</Text>
                        <TextInput
                          value={repDocId}
                          onChangeText={(v) => {
                            setRepDocId(v);
                            if (repError) setRepError(null);
                          }}
                          placeholder="DNI o CIF"
                          placeholderTextColor="#8AA8C7"
                          autoCapitalize="characters"
                          style={styles.repInput}
                        />
                      </View>
                      <View style={styles.repCol}>
                        <Text style={styles.repLabel}>Teléfono</Text>
                        <TextInput
                          value={repPhone}
                          onChangeText={setRepPhone}
                          placeholder="600 123 456"
                          placeholderTextColor="#8AA8C7"
                          keyboardType="phone-pad"
                          style={styles.repInput}
                        />
                      </View>
                    </View>

                    <Text style={styles.repLabel}>Email</Text>
                    <TextInput
                      value={repEmail}
                      onChangeText={setRepEmail}
                      placeholder="nombre@ejemplo.com"
                      placeholderTextColor="#8AA8C7"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={styles.repInput}
                    />

                    <TouchableOpacity
                      style={styles.repVerifiedRow}
                      activeOpacity={0.8}
                      onPress={() => {
                        setRepDocVerified(!repDocVerified);
                        if (repError) setRepError(null);
                      }}
                    >
                      <View
                        style={[
                          styles.repSmallCheckbox,
                          repDocVerified && styles.checkboxChecked,
                        ]}
                      >
                        {repDocVerified && (
                          <Ionicons
                            name="checkmark"
                            size={15}
                            color="#FFFFFF"
                          />
                        )}
                      </View>
                      <Text style={styles.repVerifiedText}>
                        He visto el documento de representación firmado
                      </Text>
                    </TouchableOpacity>

                    {repError ? (
                      <View style={styles.repErrorBox}>
                        <Ionicons
                          name="alert-circle-outline"
                          size={16}
                          color={RED}
                        />
                        <Text style={styles.repErrorText}>{repError}</Text>
                      </View>
                    ) : null}

                    <View style={styles.repButtonsRow}>
                      <TouchableOpacity
                        style={styles.repCancelBtn}
                        onPress={() => {
                          setExpandedMemberId(null);
                          setRepError(null);
                        }}
                      >
                        <Text style={styles.repCancelBtnText}>Cancelar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.repSaveBtn}
                        disabled={saveRepMutation.isPending}
                        onPress={() => handleSaveRepresentative(owner)}
                      >
                        <Text style={styles.repSaveBtnText}>
                          {saveRepMutation.isPending
                            ? "Guardando..."
                            : "Guardar representante"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <View style={styles.ownerDivider} />
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* QR Modal */}
      <Modal
        visible={qrVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQrVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setQrVisible(false)}
        >
          <View
            style={styles.qrModalCard}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>Código QR de asistencia</Text>
              <TouchableOpacity onPress={() => setQrVisible(false)}>
                <Ionicons name="close" size={24} color={NAVY} />
              </TouchableOpacity>
            </View>
            <Text style={styles.qrModalSub}>
              Jardines del Turia · Hoy, 08:45 · 1ª convocatoria
            </Text>

            <View style={styles.qrBox}>
              {qrMatrix.map((row, rIdx) => (
                <View key={rIdx} style={styles.qrRow}>
                  {row.map((cell, cIdx) => (
                    <View
                      key={cIdx}
                      style={[
                        styles.qrCell,
                        { backgroundColor: cell ? NAVY : "#FFFFFF" },
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>

            <Text style={styles.qrHelpText}>
              Los propietarios pueden escanear este código desde su aplicación
              para confirmar su asistencia en sala.
            </Text>

            <TouchableOpacity
              style={styles.qrCloseBtn}
              onPress={() => setQrVisible(false)}
            >
              <Text style={styles.qrCloseBtnText}>Cerrar</Text>
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
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: BG,
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backBtn: {
    padding: 4,
  },
  logo: {
    width: 128,
    height: 35,
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
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: NAVY,
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
    paddingBottom: 36,
  },
  headerBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 4,
    marginBottom: 16,
  },
  headerIconBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: GREEN_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: NAVY,
  },
  headerCommunity: {
    fontSize: 14.5,
    color: BLUE_MUTED,
    marginTop: 1,
  },
  headerMeta: {
    fontSize: 13.5,
    color: BLUE_MUTED,
    marginTop: 1,
  },
  quorumCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 14,
  },
  quorumMetricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quorumCol: {
    flex: 1,
  },
  quorumColRight: {
    alignItems: "flex-end",
  },
  quorumVerticalLine: {
    width: 1,
    height: 34,
    backgroundColor: "#E4ECF5",
    marginHorizontal: 12,
  },
  quorumValueBig: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
  },
  quorumValueMid: {
    fontSize: 15.5,
    fontWeight: "700",
    color: NAVY,
  },
  quorumValueSmall: {
    fontSize: 14,
    fontWeight: "700",
    color: NAVY,
  },
  quorumLabel: {
    fontSize: 12.5,
    color: BLUE_MUTED,
    marginTop: 2,
  },
  progressSection: {
    marginTop: 12,
    alignItems: "center",
  },
  markerTopTickWrap: {
    width: "100%",
    alignItems: "center",
    marginBottom: 3,
  },
  markerTopTick: {
    width: 2,
    height: 6,
    backgroundColor: "#1E5288",
  },
  progressTrack: {
    width: "100%",
    height: 10,
    backgroundColor: "#EAEFF5",
    borderRadius: 6,
    justifyContent: "center",
    position: "relative",
  },
  progressFill: {
    height: 10,
    backgroundColor: GREEN,
    borderRadius: 6,
  },
  markerDot: {
    position: "absolute",
    left: "50%",
    marginLeft: -5,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#133A63",
  },
  markerLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: NAVY,
    marginTop: 4,
  },
  segmentedBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    marginBottom: 12,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentBtnActive: {
    backgroundColor: GREEN,
    borderRadius: 10,
  },
  segmentDivider: {
    width: 1,
    height: 22,
    backgroundColor: "#E4ECF5",
  },
  segmentText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: NAVY,
  },
  segmentTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  qrBtnRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  qrOutlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GREEN,
    backgroundColor: "#FFFFFF",
  },
  qrOutlineBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: GREEN,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
    marginBottom: 14,
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
  ownersList: {
    marginTop: 2,
  },
  ownerBlock: {
    backgroundColor: "transparent",
  },
  ownerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  ownerLeftTouch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  ownerInitialsCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GREEN_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerInitialsText: {
    fontSize: 15,
    fontWeight: "700",
    color: GREEN,
  },
  ownerInfoCol: {
    flex: 1,
  },
  ownerName: {
    fontSize: 15,
    fontWeight: "700",
    color: NAVY,
  },
  ownerDoorCoeff: {
    fontSize: 13.5,
    color: BLUE_MUTED,
    marginTop: 2,
  },
  ownerRepBadge: {
    fontSize: 12,
    fontWeight: "600",
    color: GREEN,
    marginTop: 2,
  },
  ownerActionsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#B8CBE0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  expandChevronBtn: {
    padding: 4,
  },
  ownerDivider: {
    height: 1,
    backgroundColor: "#E8EFF6",
  },
  repCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 12,
    shadowColor: NAVY,
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  repCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  repCardTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: NAVY,
    flex: 1,
  },
  repCardDoor: {
    fontWeight: "500",
    color: BLUE_MUTED,
  },
  repLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
    marginTop: 8,
    marginBottom: 4,
  },
  repInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: NAVY,
  },
  repTwoCols: {
    flexDirection: "row",
    gap: 10,
  },
  repCol: {
    flex: 1,
  },
  repVerifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    marginBottom: 12,
  },
  repSmallCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#B8CBE0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  repVerifiedText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E5288",
    flex: 1,
  },
  repErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  repErrorText: {
    fontSize: 12.5,
    color: RED,
    flex: 1,
  },
  repButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  repCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  repCancelBtnText: {
    color: GREEN,
    fontSize: 14,
    fontWeight: "700",
  },
  repSaveBtn: {
    flex: 1.3,
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  repSaveBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 41, 66, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 22,
  },
  qrModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
  },
  qrModalHeader: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  qrModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
  },
  qrModalSub: {
    width: "100%",
    fontSize: 13.5,
    color: BLUE_MUTED,
    marginTop: 4,
    marginBottom: 18,
  },
  qrBox: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  qrRow: {
    flexDirection: "row",
  },
  qrCell: {
    width: 9,
    height: 9,
  },
  qrHelpText: {
    fontSize: 13,
    color: BLUE_MUTED,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 18,
  },
  qrCloseBtn: {
    width: "100%",
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  qrCloseBtnText: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontWeight: "700",
  },
});
