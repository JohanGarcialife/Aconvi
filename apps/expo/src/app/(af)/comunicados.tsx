import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";

import { api, queryClient } from "~/utils/api";

const TENANT_ID = "org_aconvi_demo";

const NAVY = "#0F2942";
const SUBTEXT = "#5A7690";
const GREEN = "#00875A";
const GREEN_BG = "#E6F4EF";
const RED = "#EF4444";
const RED_BG = "#FEF2F2";
const CARD_BORDER = "#E8EEF3";
const BG = "#F7FAFC";

export default function AfComunicadosScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);

  const { data: notices, isLoading } = useQuery(
    api.notice.all.queryOptions({ tenantId: TENANT_ID }),
  );

  const createMutation = useMutation(
    api.notice.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries();
        setTitle("");
        setContent("");
        setIsUrgent(false);
        setCreateVisible(false);
        Alert.alert(
          "Comunicado publicado",
          "El comunicado se ha publicado en el tablón de la comunidad.",
        );
      },
      onError: (err) => {
        Alert.alert(
          "Error",
          err.message || "No se pudo publicar el comunicado.",
        );
      },
    }),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handlePublish = () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert("Datos incompletos", "Introduce el título y el contenido.");
      return;
    }
    createMutation.mutate({
      tenantId: TENANT_ID,
      title: title.trim(),
      content: content.trim(),
      type: isUrgent ? "URGENTE" : "AVISO",
    });
  };

  const allNotices = (notices as any[] | undefined) ?? [];

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={GREEN}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>Comunicados</Text>
            <Text style={styles.screenSub}>
              Avisos y actas · Jardines del Turia
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setCreateVisible(true)}
          >
            <Ionicons name="add" size={18} color={GREEN} />
            <Text style={styles.addBtnText}>Nuevo aviso</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={GREEN} />
          </View>
        ) : allNotices.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="chatbox-ellipses-outline"
              size={32}
              color={SUBTEXT}
            />
            <Text style={styles.emptyText}>No hay comunicados publicados.</Text>
          </View>
        ) : (
          allNotices.map((item: any) => {
            const urgent = item.type === "URGENT";
            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardTopRow}>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: urgent ? RED_BG : GREEN_BG },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: urgent ? RED : GREEN },
                      ]}
                    >
                      {urgent ? "URGENTE" : "AVISO"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.noticeTitle}>{item.title}</Text>
                <Text style={styles.noticeContent} numberOfLines={4}>
                  {item.content}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Create Notice Modal */}
      <Modal
        visible={createVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Publicar comunicado</Text>
              <TouchableOpacity onPress={() => setCreateVisible(false)}>
                <Ionicons name="close" size={24} color={NAVY} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Título</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Ej: Corte de suministro de agua programado"
              placeholderTextColor="#8AA8C7"
              style={styles.modalInput}
            />

            <Text style={styles.inputLabel}>Contenido</Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Escribe el mensaje para los propietarios..."
              placeholderTextColor="#8AA8C7"
              multiline
              style={[
                styles.modalInput,
                { minHeight: 90, textAlignVertical: "top" },
              ]}
            />

            <TouchableOpacity
              style={styles.urgentRow}
              onPress={() => setIsUrgent(!isUrgent)}
            >
              <View
                style={[
                  styles.checkbox,
                  isUrgent && { backgroundColor: GREEN, borderColor: GREEN },
                ]}
              >
                {isUrgent && (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
              </View>
              <Text style={styles.urgentLabel}>Marcar como aviso urgente</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setCreateVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                disabled={createMutation.isPending}
                onPress={handlePublish}
              >
                <Text style={styles.saveBtnText}>
                  {createMutation.isPending ? "Publicando..." : "Publicar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: NAVY,
  },
  screenSub: {
    fontSize: 14,
    color: SUBTEXT,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DDF3EA",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addBtnText: {
    color: GREEN,
    fontSize: 13.5,
    fontWeight: "700",
  },
  loadingBox: {
    paddingVertical: 28,
    alignItems: "center",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: CARD_BORDER,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: SUBTEXT,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  cardTopRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: NAVY,
  },
  noticeContent: {
    fontSize: 13.5,
    color: SUBTEXT,
    marginTop: 4,
    lineHeight: 19,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 41, 66, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 22,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 22,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
    marginTop: 10,
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#DCE6F2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: NAVY,
  },
  urgentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#B8CBE0",
    alignItems: "center",
    justifyContent: "center",
  },
  urgentLabel: {
    fontSize: 13.5,
    fontWeight: "600",
    color: NAVY,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  cancelBtnText: {
    color: GREEN,
    fontSize: 14,
    fontWeight: "700",
  },
  saveBtn: {
    flex: 1,
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
