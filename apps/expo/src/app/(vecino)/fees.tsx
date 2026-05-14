import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "~/utils/api";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const PRIMARY = "#4aa19b";
const DARK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";

const TENANT_ID = "org_aconvi_demo";
const DEMO_AUTHOR_ID = "user_admin";

export default function FeesScreen() {
  const queryClient = useQueryClient();
  const { data: fees, isLoading } = useQuery(
    api.fee.myFees.queryOptions({ tenantId: TENANT_ID, userId: DEMO_AUTHOR_ID })
  );

  const { mutate: payFee, isPending: isPaying } = useMutation({
    ...api.fee.pay.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries(api.fee.myFees.queryFilter());
      Alert.alert("Pago exitoso", "Se ha simulado el pago de esta cuota correctamente.");
    },
    onError: () => {
      Alert.alert("Error", "No se pudo completar el pago.");
    }
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </SafeAreaView>
    );
  }

  const pendingFees = fees?.filter((f: any) => f.status === "PENDING") || [];
  const paidFees = fees?.filter((f: any) => f.status === "PAID") || [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Mis Cuotas</Text>
        
        {/* PENDIENTES */}
        <Text style={styles.sectionTitle}>Pendientes de pago</Text>
        {pendingFees.length === 0 ? (
          <Text style={styles.emptyText}>No tienes cuotas pendientes. ¡Al día!</Text>
        ) : (
          pendingFees.map((fee: any) => (
            <View key={fee.id} style={[styles.card, { borderColor: "#fca5a5" }]}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.feeDesc}>{fee.description}</Text>
                  {fee.dueDate && (
                    <Text style={[styles.feeDate, { color: "#dc2626" }]}>
                      Vence: {format(new Date(fee.dueDate), "dd MMM yyyy", { locale: es })}
                    </Text>
                  )}
                </View>
                <Text style={styles.feeAmount}>{fee.amount.toFixed(2)} €</Text>
              </View>
              <TouchableOpacity
                style={styles.payButton}
                disabled={isPaying}
                onPress={() => payFee({ id: fee.id, tenantId: TENANT_ID })}
              >
                <Text style={styles.payButtonText}>Pagar ahora</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* PAGADAS */}
        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Historial de pagos</Text>
        {paidFees.length === 0 ? (
          <Text style={styles.emptyText}>Aún no hay pagos registrados.</Text>
        ) : (
          paidFees.map((fee: any) => (
            <View key={fee.id} style={styles.card}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.feeDesc}>{fee.description}</Text>
                  {fee.paidAt && (
                    <Text style={styles.feeDate}>
                      Pagado: {format(new Date(fee.paidAt), "dd MMM yyyy", { locale: es })}
                    </Text>
                  )}
                </View>
                <Text style={[styles.feeAmount, { color: "#16a34a" }]}>{fee.amount.toFixed(2)} €</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  scroll: { padding: 24, paddingBottom: 60 },
  title: { fontSize: 28, fontWeight: "800", color: DARK, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: MUTED, marginBottom: 12, textTransform: "uppercase" },
  emptyText: { fontSize: 15, color: MUTED, fontStyle: "italic", marginBottom: 16 },
  card: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  feeDesc: { fontSize: 16, fontWeight: "600", color: DARK, marginBottom: 4 },
  feeDate: { fontSize: 13, color: MUTED },
  feeAmount: { fontSize: 20, fontWeight: "800", color: DARK },
  payButton: {
    backgroundColor: PRIMARY,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  payButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
