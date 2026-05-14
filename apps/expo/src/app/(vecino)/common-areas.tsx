import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  FlatList,
} from "react-native";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, queryClient } from "~/utils/api";

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIMARY = "#4aa19b";
const TENANT_ID = "org_aconvi_demo"; // TODO: replace with session context

// Helper: generate next 14 days
function getNext14Days(): { label: string; value: string; dayLabel: string }[] {
  const days = [];
  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const monthNames = ["En", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    days.push({
      value: `${yyyy}-${mm}-${dd}`,
      label: `${dd} ${monthNames[d.getMonth()]}`,
      dayLabel: i === 0 ? "Hoy" : dayNames[d.getDay()] ?? "",
    });
  }
  return days;
}

const DAYS = getNext14Days();

// ─── Area Card ────────────────────────────────────────────────────────────────
function AreaCard({
  area,
  onPress,
}: {
  area: any;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.areaCard} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.areaIconContainer}>
        <Text style={styles.areaEmoji}>{area.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.areaName}>{area.name}</Text>
        {area.description ? (
          <Text style={styles.areaDesc} numberOfLines={2}>
            {area.description}
          </Text>
        ) : null}
        <View style={styles.areaMetaRow}>
          <Text style={styles.areaMeta}>
            🕐 {area.openTime} – {area.closeTime}
          </Text>
          <Text style={styles.areaMeta}>👥 {area.capacity} personas</Text>
        </View>
      </View>
      <Text style={styles.areaArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Booking Detail Modal ─────────────────────────────────────────────────────
function BookingModal({
  visible,
  area,
  selectedDate,
  onClose,
}: {
  visible: boolean;
  area: any;
  selectedDate: string;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    ...api.commonArea.availability.queryOptions({
      tenantId: TENANT_ID,
      areaId: area?.id as string,
      date: selectedDate,
    }),
    enabled: !!area && !!selectedDate && visible,
  });

  const bookMutation = useMutation({
    ...api.commonArea.book.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries(api.commonArea.availability.queryFilter());
      void queryClient.invalidateQueries(api.commonArea.myBookings.queryFilter());
      Alert.alert("✅ Reserva confirmada", `Has reservado ${area?.name} a las ${selectedSlot}`);
      setSelectedSlot(null);
      setNotes("");
      onClose();
    },
    onError: (e: any) => Alert.alert("Error", e.message),
  });

  const handleConfirm = () => {
    if (!selectedSlot || !area) return;
    bookMutation.mutate({
      tenantId: TENANT_ID,
      areaId: area.id,
      date: selectedDate,
      startTime: selectedSlot,
      notes: notes.trim() || undefined,
    } as any);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Text style={styles.modalCloseText}>Cerrar</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {area?.icon} {area?.name}
          </Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={styles.modalBody}>
            {/* Date chip */}
            <View style={styles.dateChip}>
              <Text style={styles.dateChipText}>
                📅 {DAYS.find((d) => d.value === selectedDate)?.dayLabel},{" "}
                {DAYS.find((d) => d.value === selectedDate)?.label}
              </Text>
            </View>

            {/* Rules */}
            {area?.rules ? (
              <View style={styles.rulesBox}>
                <Text style={styles.rulesTitle}>📋 Reglamento</Text>
                <Text style={styles.rulesText}>{area.rules}</Text>
              </View>
            ) : null}

            {/* Slots */}
            <Text style={styles.sectionLabel}>Selecciona un horario</Text>
            {isLoading ? (
              <ActivityIndicator color={PRIMARY} style={{ marginTop: 24 }} />
            ) : (
              <View style={styles.slotsGrid}>
                {(data as any)?.slots.map(({ time, available, booking }: any) => (
                  <TouchableOpacity
                    key={time}
                    disabled={!available}
                    onPress={() => setSelectedSlot(time === selectedSlot ? null : time)}
                    style={[
                      styles.slotChip,
                      !available && styles.slotChipBooked,
                      time === selectedSlot && styles.slotChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.slotTime,
                        !available && styles.slotTimeBooked,
                        time === selectedSlot && styles.slotTimeSelected,
                      ]}
                    >
                      {time}
                    </Text>
                    {!available && (
                      <Text style={styles.slotBookedLabel}>
                        {booking?.user?.name ? booking.user.name.split(" ")[0] : "Reservado"}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Notes */}
            {selectedSlot && (
              <View style={{ marginTop: 20 }}>
                <Text style={styles.sectionLabel}>Nota (opcional)</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Ej: Cumpleaños, reunión vecinal..."
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  maxLength={200}
                />
              </View>
            )}
          </View>
        </ScrollView>

        {/* CTA */}
        {selectedSlot && (
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                bookMutation.isPending && { opacity: 0.7 },
              ]}
              onPress={handleConfirm}
              disabled={bookMutation.isPending}
            >
              {bookMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>
                  Confirmar reserva · {selectedSlot}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─── My Bookings Tab ──────────────────────────────────────────────────────────
function MyBookings() {
  const { data: bookings, isLoading } = useQuery(api.commonArea.myBookings.queryOptions());

  const cancelMutation = useMutation({
    ...api.commonArea.cancel.mutationOptions(),
    onSuccess: () => void queryClient.invalidateQueries(api.commonArea.myBookings.queryFilter()),
    onError: (e: any) => Alert.alert("Error", e.message),
  });

  const handleCancel = (bookingId: string, area: string, time: string) => {
    Alert.alert(
      "Cancelar reserva",
      `¿Cancelar ${area} a las ${time}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Sí, cancelar",
          style: "destructive",
          onPress: () => cancelMutation.mutate({ bookingId } as any),
        },
      ],
    );
  };

  if (isLoading) return <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />;

  if (!(bookings as any[])?.length) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>📅</Text>
        <Text style={styles.emptyTitle}>Sin reservas</Text>
        <Text style={styles.emptySubtitle}>Tus próximas reservas aparecerán aquí.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={bookings as any[]}
      keyExtractor={(b) => b.id}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      renderItem={({ item: b }) => (
        <View style={styles.myBookingCard}>
          <Text style={styles.myBookingEmoji}>{b.commonArea?.icon ?? "🏠"}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.myBookingName}>{b.commonArea?.name}</Text>
            <Text style={styles.myBookingTime}>
              📅 {b.date} · {b.startTime} – {b.endTime}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => handleCancel(b.id, b.commonArea?.name ?? "", b.startTime)}
          >
            <Text style={styles.cancelLink}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CommonAreasScreen() {
  const [activeTab, setActiveTab] = useState<"areas" | "mybookings">("areas");
  const [selectedDate, setSelectedDate] = useState(DAYS[0]!.value);
  const [selectedArea, setSelectedArea] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const { data: areas, isLoading } = useQuery(api.commonArea.all.queryOptions({
    tenantId: TENANT_ID,
  }));

  const openArea = (area: any) => {
    setSelectedArea(area);
    setModalVisible(true);
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Zonas Comunes</Text>
        <Text style={styles.headerSubtitle}>Reserva espacios de tu comunidad</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(["areas", "mybookings"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setActiveTab(t)}
            style={[styles.tabItem, activeTab === t && styles.tabItemActive]}
          >
            <Text style={[styles.tabLabel, activeTab === t && styles.tabLabelActive]}>
              {t === "areas" ? "🏢 Zonas" : "📋 Mis Reservas"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "areas" ? (
        <>
          {/* Date selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.datePicker}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            {DAYS.map((d) => (
              <TouchableOpacity
                key={d.value}
                onPress={() => setSelectedDate(d.value)}
                style={[
                  styles.dayChip,
                  selectedDate === d.value && styles.dayChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.dayChipTop,
                    selectedDate === d.value && styles.dayChipTopActive,
                  ]}
                >
                  {d.dayLabel}
                </Text>
                <Text
                  style={[
                    styles.dayChipBottom,
                    selectedDate === d.value && styles.dayChipBottomActive,
                  ]}
                >
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Area list */}
          {isLoading ? (
            <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
          ) : !(areas as any[])?.length ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🏗️</Text>
              <Text style={styles.emptyTitle}>Sin zonas configuradas</Text>
              <Text style={styles.emptySubtitle}>
                El administrador aún no ha añadido zonas comunes.
              </Text>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
              {(areas as any[]).map((area: any) => (
                <AreaCard key={area.id} area={area} onPress={() => openArea(area)} />
              ))}
            </ScrollView>
          )}
        </>
      ) : (
        <MyBookings />
      )}

      {/* Booking Modal */}
      {selectedArea && (
        <BookingModal
          visible={modalVisible}
          area={selectedArea}
          selectedDate={selectedDate}
          onClose={() => setModalVisible(false)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },

  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerTitle: { fontSize: 26, fontWeight: "800", color: "#0f172a" },
  headerSubtitle: { fontSize: 13, color: "#64748b", marginTop: 2 },

  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: PRIMARY },
  tabLabel: { fontSize: 13, fontWeight: "600", color: "#94a3b8" },
  tabLabelActive: { color: PRIMARY },

  datePicker: { maxHeight: 76, backgroundColor: "#fff", paddingVertical: 10 },
  dayChip: {
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#f1f5f9",
    minWidth: 56,
  },
  dayChipActive: { backgroundColor: PRIMARY },
  dayChipTop: { fontSize: 10, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" },
  dayChipTopActive: { color: "rgba(255,255,255,0.8)" },
  dayChipBottom: { fontSize: 13, fontWeight: "700", color: "#334155", marginTop: 2 },
  dayChipBottomActive: { color: "#fff" },

  areaCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  areaIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#f0faf9",
    alignItems: "center",
    justifyContent: "center",
  },
  areaEmoji: { fontSize: 26 },
  areaName: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  areaDesc: { fontSize: 12, color: "#64748b", marginTop: 2 },
  areaMetaRow: { flexDirection: "row", gap: 12, marginTop: 6 },
  areaMeta: { fontSize: 11, color: "#94a3b8", fontWeight: "600" },
  areaArrow: { fontSize: 22, color: "#cbd5e1" },

  // Modal
  modalContainer: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalClose: { paddingHorizontal: 4, paddingVertical: 8 },
  modalCloseText: { fontSize: 15, color: PRIMARY, fontWeight: "600" },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  modalBody: { padding: 20 },

  dateChip: {
    backgroundColor: "#f0faf9",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  dateChipText: { fontSize: 14, fontWeight: "600", color: PRIMARY },

  rulesBox: {
    backgroundColor: "#fffbeb",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#fef3c7",
  },
  rulesTitle: { fontSize: 13, fontWeight: "700", color: "#92400e", marginBottom: 6 },
  rulesText: { fontSize: 12, color: "#78350f", lineHeight: 18 },

  sectionLabel: { fontSize: 14, fontWeight: "700", color: "#0f172a", marginBottom: 12 },

  slotsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slotChip: {
    width: "22%",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    paddingVertical: 10,
  },
  slotChipBooked: { backgroundColor: "#f8fafc", borderColor: "#e2e8f0" },
  slotChipSelected: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  slotTime: { fontSize: 13, fontWeight: "700", color: "#0f172a" },
  slotTimeBooked: { color: "#cbd5e1" },
  slotTimeSelected: { color: "#fff" },
  slotBookedLabel: { fontSize: 9, color: "#94a3b8", marginTop: 2 },

  notesInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: "#0f172a",
    minHeight: 80,
    textAlignVertical: "top",
    backgroundColor: "#f8fafc",
  },

  modalFooter: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    backgroundColor: "#fff",
  },
  confirmButton: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  confirmButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  // My Bookings
  myBookingCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  myBookingEmoji: { fontSize: 28 },
  myBookingName: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  myBookingTime: { fontSize: 12, color: "#64748b", marginTop: 3 },
  cancelLink: { fontSize: 13, color: "#ef4444", fontWeight: "600" },

  // Empty
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#64748b", textAlign: "center", lineHeight: 20 },
});
