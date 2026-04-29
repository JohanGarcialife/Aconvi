import { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { api } from "~/utils/api";

const TENANT_ID = "org_aconvi_demo";
// Dummy user id for demonstration purposes (in a real app, this comes from auth context)
const USER_ID = "00000000-0000-0000-0000-000000000000";

const STATUS_UI = {
  DRAFT: { label: "Próximamente", color: "#64748b", bg: "#f1f5f9" },
  OPEN: { label: "Votación Abierta", color: "#059669", bg: "#d1fae5" },
  CLOSED: { label: "Cerrada", color: "#2563eb", bg: "#dbeafe" },
};

export default function VotingScreen() {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  
  const trpc = api.useContext();
  const { data: sessions, isLoading } = api.voting.all.useQuery({ tenantId: TENANT_ID });
  
  const castVoteMutation = api.voting.castVote.useMutation({
    onSuccess: () => {
      Alert.alert("Voto registrado", "Tu voto ha sido registrado correctamente.");
      trpc.voting.all.invalidate();
    },
    onError: (err) => {
      Alert.alert("Error", err.message || "No se pudo registrar el voto.");
    }
  });

  const handleVote = (sessionId: string, optionId: string) => {
    Alert.alert(
      "Confirmar Voto",
      "¿Estás seguro de tu elección? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Votar", 
          style: "default",
          onPress: () => {
            castVoteMutation.mutate({
              sessionId,
              optionId,
              userId: USER_ID,
            });
          }
        }
      ]
    );
  };

  const renderSession = ({ item }: { item: any }) => {
    const status = STATUS_UI[item.status as keyof typeof STATUS_UI];
    // Check if the current user has already voted
    const hasVoted = item.status !== "DRAFT" && item.casts?.some((c: any) => c.userId === USER_ID);
    
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>{item.title}</Text>
          <View style={[styles.badge, { backgroundColor: status.bg }]}>
            <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        
        {item.description ? (
          <Text style={styles.description}>{item.description}</Text>
        ) : null}

        {item.status === "OPEN" && !hasVoted ? (
          <View style={styles.optionsContainer}>
            <Text style={styles.instruction}>Selecciona una opción para votar:</Text>
            {item.options?.map((opt: any) => (
              <TouchableOpacity
                key={opt.id}
                style={styles.optionButton}
                activeOpacity={0.7}
                onPress={() => handleVote(item.id, opt.id)}
                disabled={castVoteMutation.isLoading}
              >
                <Text style={styles.optionText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : item.status !== "DRAFT" ? (
          <View style={styles.resultsContainer}>
            <Text style={styles.instruction}>
              {hasVoted && item.status === "OPEN" ? "Ya has participado en esta votación. Resultados parciales:" : "Resultados finales:"}
            </Text>
            {item.options?.map((opt: any) => (
              <View key={opt.id} style={styles.resultRow}>
                <Text style={styles.resultLabel}>{opt.label}</Text>
                <Text style={styles.resultCount}>
                  {item.coefficientWeighted ? opt.weightedTotal.toFixed(2) + " %" : opt.voteCount + " votos"}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.draftText}>La votación se abrirá pronto.</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00bda5" />
          <Text style={styles.loadingText}>Cargando votaciones...</Text>
        </View>
      ) : !sessions?.length ? (
        <View style={styles.center}>
          <Text style={styles.emoji}>🗳️</Text>
          <Text style={styles.emptyTitle}>Sin votaciones</Text>
          <Text style={styles.emptySubtitle}>No hay votaciones activas ni finalizadas.</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={renderSession}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  listContainer: { padding: 16, gap: 16 },
  
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  title: { fontSize: 18, fontWeight: "700", color: "#0f172a", flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: "flex-start" },
  badgeText: { fontSize: 12, fontWeight: "700" },
  description: { fontSize: 14, color: "#64748b", marginBottom: 16, lineHeight: 20 },
  
  instruction: { fontSize: 14, fontWeight: "600", color: "#334155", marginBottom: 12 },
  
  optionsContainer: { marginTop: 8 },
  optionButton: {
    backgroundColor: "#f1f5f9",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  optionText: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  
  resultsContainer: { marginTop: 8, backgroundColor: "#f8fafc", padding: 12, borderRadius: 10 },
  resultRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  resultLabel: { fontSize: 14, color: "#334155", fontWeight: "500" },
  resultCount: { fontSize: 14, color: "#0f172a", fontWeight: "700" },
  
  draftText: { fontSize: 14, color: "#64748b", fontStyle: "italic", marginTop: 8 },

  emoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#64748b", textAlign: "center", lineHeight: 22 },
  loadingText: { marginTop: 12, fontSize: 14, color: "#64748b", fontWeight: "500" },
});
