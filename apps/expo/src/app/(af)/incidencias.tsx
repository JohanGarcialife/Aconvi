import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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

export default function AfIncidenciasScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: incidents, isLoading } = useQuery(
    api.incident.all.queryOptions({ tenantId: TENANT_ID }),
  );

  const updateStatusMutation = useMutation(
    api.incident.updateStatus.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries();
        Alert.alert(
          "Estado actualizado",
          "Se ha actualizado el estado de la incidencia.",
        );
      },
      onError: (err) => {
        Alert.alert("Error", err.message || "No se pudo actualizar el estado.");
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

  const allIncidents = (incidents as any[] | undefined) ?? [];

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
        <Text style={styles.screenTitle}>Incidencias</Text>
        <Text style={styles.screenSub}>
          Seguimiento de actuaciones y órdenes de trabajo · Jardines del Turia
        </Text>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={GREEN} />
          </View>
        ) : allIncidents.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="warning-outline" size={32} color={SUBTEXT} />
            <Text style={styles.emptyText}>No hay incidencias registradas.</Text>
          </View>
        ) : (
          allIncidents.map((inc: any) => {
            const isClosed =
              inc.status === "CERRADA" || inc.status === "RESUELTA";
            return (
              <View key={inc.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: isClosed ? GREEN_BG : RED_BG,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: isClosed ? GREEN : RED },
                      ]}
                    >
                      {inc.status}
                    </Text>
                  </View>
                  {inc.assignedTo ? (
                    <Text style={styles.providerText} numberOfLines={1}>
                      {inc.assignedTo}
                    </Text>
                  ) : null}
                </View>

                <Text style={styles.incTitle}>{inc.title}</Text>
                {inc.description ? (
                  <Text style={styles.incDesc} numberOfLines={3}>
                    {inc.description}
                  </Text>
                ) : null}

                {!isClosed && (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      disabled={updateStatusMutation.isPending}
                      onPress={() =>
                        updateStatusMutation.mutate({
                          tenantId: TENANT_ID,
                          id: inc.id,
                          status: "RESUELTA",
                        })
                      }
                    >
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={17}
                        color="#FFFFFF"
                      />
                      <Text style={styles.actionBtnText}>
                        Validar y marcar resuelta
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
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
  screenTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: NAVY,
  },
  screenSub: {
    fontSize: 14,
    color: SUBTEXT,
    marginTop: 2,
    marginBottom: 16,
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
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  providerText: {
    fontSize: 12.5,
    color: SUBTEXT,
    fontWeight: "600",
    maxWidth: "55%",
  },
  incTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: NAVY,
  },
  incDesc: {
    fontSize: 13.5,
    color: SUBTEXT,
    marginTop: 4,
  },
  actionsRow: {
    marginTop: 12,
  },
  actionBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
  },
});
