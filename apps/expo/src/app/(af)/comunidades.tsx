import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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
import { useQuery } from "@tanstack/react-query";

import { api } from "~/utils/api";

const TENANT_ID = "org_aconvi_demo";

const NAVY = "#0F2942";
const SUBTEXT = "#5A7690";
const GREEN = "#00875A";
const GREEN_LIGHT = "#D7F1E7";
const RED = "#EF4444";
const BG = "#FFFFFF";

interface CommunityItem {
  id: string;
  name: string;
  address: string;
  ownersCount: number;
}

const DEFAULT_COMMUNITIES: CommunityItem[] = [
  {
    id: "org_edificio_colon",
    name: "Edificio Colón",
    address: "C/ Colón, 56 · Valencia",
    ownersCount: 53,
  },
  {
    id: "org_edificio_gran_via",
    name: "Edificio Gran Vía",
    address: "Gran Vía Marqués del Turia, 45 · Valencia",
    ownersCount: 18,
  },
  {
    id: "org_aconvi_demo",
    name: "Jardines del Turia",
    address: "C/ Poeta Querol, 8 · Valencia",
    ownersCount: 42,
  },
  {
    id: "org_residencial_alameda",
    name: "Residencial Alameda",
    address: "Av. de Francia, 12 · Valencia",
    ownersCount: 28,
  },
  {
    id: "org_residencial_campanar",
    name: "Residencial Campanar",
    address: "C/ General Avilés, 14 · Valencia",
    ownersCount: 30,
  },
  {
    id: "org_torre_malvarrosa",
    name: "Torre de la Malvarrosa",
    address: "Av. de la Malvarrosa, 120 · Valencia",
    ownersCount: 24,
  },
  {
    id: "org_residencial_el_saler",
    name: "Residencial El Saler",
    address: "C/ Antonio Ferrandis, 22 · Valencia",
    ownersCount: 16,
  },
];

export default function AfComunidadesScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [localAdded, setLocalAdded] = useState<CommunityItem[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newOwners, setNewOwners] = useState("24");

  const { data: apiCommunities, isLoading } = useQuery(
    api.meeting.communities.queryOptions({ tenantId: TENANT_ID }),
  );

  const communitiesList = useMemo(() => {
    const base =
      apiCommunities && apiCommunities.length > 0
        ? [
            // Keep exact order from mockup first
            ...DEFAULT_COMMUNITIES,
            ...apiCommunities.filter(
              (c) =>
                !DEFAULT_COMMUNITIES.some(
                  (d) => d.name.toLowerCase() === c.name.toLowerCase(),
                ),
            ),
          ]
        : DEFAULT_COMMUNITIES;
    return [...localAdded, ...base];
  }, [apiCommunities, localAdded]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return communitiesList;
    const q = searchQuery.trim().toLowerCase();
    return communitiesList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q),
    );
  }, [communitiesList, searchQuery]);

  const handleCreateCommunity = () => {
    if (!newName.trim() || !newAddress.trim()) {
      Alert.alert(
        "Datos incompletos",
        "Completa el nombre y la dirección de la comunidad.",
      );
      return;
    }
    const count = parseInt(newOwners, 10) || 20;
    setLocalAdded((prev) => [
      {
        id: `custom_${Date.now()}`,
        name: newName.trim(),
        address: newAddress.trim(),
        ownersCount: count,
      },
      ...prev,
    ]);
    setNewName("");
    setNewAddress("");
    setNewOwners("24");
    setAddModalVisible(false);
  };

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
            style={styles.avatarCircle}
            onPress={() => router.push("/(af)" as any)}
          >
            <Text style={styles.avatarInitials}>JL</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Row */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.screenTitle}>Comunidades</Text>
            <Text style={styles.screenSubtitle}>327 comunidades</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            activeOpacity={0.8}
            onPress={() => setAddModalVisible(true)}
          >
            <Ionicons name="add" size={18} color={GREEN} />
            <Text style={styles.addBtnText}>Añadir comunidad</Text>
          </TouchableOpacity>
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
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color={SUBTEXT} />
            </TouchableOpacity>
          )}
        </View>

        {isLoading && communitiesList.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={GREEN} />
          </View>
        ) : null}

        {/* Communities List */}
        <View style={styles.listWrap}>
          {filtered.map((item, idx) => (
            <View key={item.id}>
              <TouchableOpacity
                style={styles.communityRow}
                activeOpacity={0.75}
                onPress={() => router.push("/(af)/juntas" as any)}
              >
                <View style={styles.iconBox}>
                  <Ionicons name="business-outline" size={26} color={GREEN} />
                </View>
                <View style={styles.infoCol}>
                  <Text style={styles.communityName}>{item.name}</Text>
                  <Text style={styles.communityAddress}>{item.address}</Text>
                  <Text style={styles.communityOwners}>
                    {item.ownersCount} propietarios
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={SUBTEXT} />
              </TouchableOpacity>
              {idx < filtered.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Add Community Modal */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Añadir comunidad</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={24} color={NAVY} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Nombre de la comunidad</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Ej: Residencial Turia Park"
              placeholderTextColor="#8AA8C7"
              style={styles.modalInput}
            />

            <Text style={styles.inputLabel}>Dirección</Text>
            <TextInput
              value={newAddress}
              onChangeText={setNewAddress}
              placeholder="Ej: C/ Mayor, 24 · Valencia"
              placeholderTextColor="#8AA8C7"
              style={styles.modalInput}
            />

            <Text style={styles.inputLabel}>Número de propietarios</Text>
            <TextInput
              value={newOwners}
              onChangeText={setNewOwners}
              placeholder="24"
              placeholderTextColor="#8AA8C7"
              keyboardType="number-pad"
              style={styles.modalInput}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setAddModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleCreateCommunity}
              >
                <Text style={styles.saveBtnText}>Guardar</Text>
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
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: NAVY,
    letterSpacing: -0.4,
  },
  screenSubtitle: {
    fontSize: 15,
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
    fontSize: 14,
    fontWeight: "600",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F5F8",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
    marginBottom: 18,
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
  listWrap: {
    marginTop: 2,
  },
  communityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: GREEN_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCol: {
    flex: 1,
  },
  communityName: {
    fontSize: 16.5,
    fontWeight: "700",
    color: NAVY,
  },
  communityAddress: {
    fontSize: 14,
    color: SUBTEXT,
    marginTop: 2,
  },
  communityOwners: {
    fontSize: 13.5,
    color: SUBTEXT,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#EEF3F7",
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
    marginBottom: 14,
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
