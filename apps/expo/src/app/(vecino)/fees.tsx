import { View, Text, StyleSheet } from "react-native";

export default function FeesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>💶</Text>
      <Text style={styles.title}>Mis Cuotas</Text>
      <Text style={styles.subtitle}>
        Próximamente: histórico de cuotas, estados de pago y recibos de tu comunidad.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, backgroundColor: "#f8fafc" },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "800", color: "#0f172a", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#64748b", textAlign: "center", lineHeight: 22 },
});
