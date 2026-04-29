import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { authClient } from "~/utils/auth";
import { getBaseUrl } from "~/utils/base-url";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleMagicLink = async () => {
    if (!email) return;
    setLoading(true);
    setError("");

    try {
      const { error: authError } = await authClient.signIn.magicLink({
        email,
        callbackURL: "expo://", // Deep link config inside Expo
      });

      if (authError) {
        setError(authError.message || "Error al enviar correo.");
      } else {
        setSent(true);
      }
    } catch (err: any) {
      setError(err.message || "Error de red.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 64, marginBottom: 16 }}>📩</Text>
        <Text style={{ fontSize: 24, fontWeight: "700", color: "#0F1B2B", marginBottom: 12 }}>Revisa tu correo</Text>
        <Text style={{ fontSize: 16, color: "#6b7280", textAlign: "center", marginBottom: 32 }}>
          Hemos enviado un enlace mágico a {email}. Toca el enlace desde tu móvil para entrar.
        </Text>
        <TouchableOpacity onPress={() => setSent(false)}>
          <Text style={{ color: "#00BDA5", fontWeight: "600", fontSize: 16 }}>Usar otro correo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff", justifyContent: "center", padding: 24 }}>
      <Text style={{ fontSize: 32, fontWeight: "800", color: "#0F1B2B", textAlign: "center", marginBottom: 8 }}>
        Aconvi
      </Text>
      <Text style={{ fontSize: 16, color: "#6b7280", textAlign: "center", marginBottom: 40 }}>
        Acceso rápido sin contraseñas
      </Text>

      {error ? (
        <View style={{ backgroundColor: "#fef2f2", padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <Text style={{ color: "#dc2626", textAlign: "center" }}>{error}</Text>
        </View>
      ) : null}

      <Text style={{ fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 }}>
        Correo electrónico
      </Text>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: "#d1d5db",
          borderRadius: 8,
          padding: 16,
          fontSize: 16,
          marginBottom: 24,
          color: "#0F1B2B",
        }}
        placeholder="vecino@finca.com"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        editable={!loading}
      />

      <TouchableOpacity
        onPress={handleMagicLink}
        disabled={loading}
        style={{
          backgroundColor: "#00BDA5",
          padding: 16,
          borderRadius: 8,
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Enviar enlace mágico</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
