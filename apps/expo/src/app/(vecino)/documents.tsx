import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Linking } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "~/utils/api";

const CATEGORY_META = {
  ACTA: { label: "Actas de Junta", icon: "📝", color: "#f8fafc" },
  NORMATIVA: { label: "Normativas", icon: "⚖️", color: "#f8fafc" },
  SEGURO: { label: "Pólizas", icon: "🛡️", color: "#f8fafc" },
  CONTRATO: { label: "Contratos", icon: "🤝", color: "#f8fafc" },
  PRESUPUESTO: { label: "Presupuestos", icon: "💰", color: "#f8fafc" },
  OTRO: { label: "Otros", icon: "📁", color: "#f8fafc" },
} as const;

export default function DocumentsScreen() {
  const { data: documents, isLoading } = useQuery(
    api.document.all.queryOptions({ tenantId: "org_aconvi_demo" })
  );

  const renderItem = ({ item }: { item: any }) => {
    const meta = CATEGORY_META[item.category as keyof typeof CATEGORY_META] ?? CATEGORY_META.OTRO;
    
    return (
      <TouchableOpacity 
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => {
          Alert.alert("Descargando...");
          Linking.openURL(item.fileUrl).catch(() => Alert.alert("Error", "No se pudo abrir el enlace"));
        }}
      >
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>{meta.icon}</Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.categoryBadge}>{meta.label}</Text>
            {item.description ? (
              <Text style={styles.description} numberOfLines={1}>{item.description}</Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00bda5" />
          <Text style={styles.loadingText}>Cargando documentos...</Text>
        </View>
      ) : !(documents as any[] | undefined)?.length ? (
        <View style={styles.center}>
          <Text style={styles.emoji}>📂</Text>
          <Text style={styles.emptyTitle}>Sin documentos</Text>
          <Text style={styles.emptySubtitle}>
            La administración aún no ha subido documentación para la comunidad.
          </Text>
        </View>
      ) : (
        <FlatList
          data={(documents as any[] | undefined) || []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  listContainer: { padding: 16, gap: 12 },
  
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  iconText: { fontSize: 24 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#0f172a", marginBottom: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  categoryBadge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  description: { fontSize: 13, color: "#64748b", flex: 1 },
  
  emoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#64748b", textAlign: "center", lineHeight: 22 },
  loadingText: { marginTop: 12, fontSize: 14, color: "#64748b", fontWeight: "500" },
});
