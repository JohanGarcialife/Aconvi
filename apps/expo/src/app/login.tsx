import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { getBaseUrl } from "~/utils/base-url";


const TEAL = "#00BDA5";
const DARK = "#0F1B2B";
const GRAY = "#6b7280";

type Step = "idle" | "loading" | "done" | "error";

export default function LoginScreen() {
  const router = useRouter();

  // ── Unified Login state ──────────────────────────────────────────────────
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // ── PIN login ────────────────────────────────────────────────────────────
  const handlePinLogin = async () => {
    if (!username.trim() || !pin.trim()) return;
    setStep("loading");
    setErrorMsg("");
    try {
      // 1. Obtener el token de sesión del endpoint mobile-login
      const res = await fetch(`${getBaseUrl()}/api/auth/mobile-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), pin: pin.trim() }),
      });
      const data = await res.json() as { ok: boolean; sessionToken?: string; error?: string };

      if (!data.ok || !data.sessionToken) {
        setStep("error");
        setErrorMsg(data.error ?? "Error de autenticación.");
        return;
      }

      const token = data.sessionToken;

      // 2. Guardar el token en SecureStore bajo la clave que usa el interceptor
      await SecureStore.setItemAsync("expo_session_token", token);

      // 3. Verificar sesión con Bearer para obtener el rol del usuario
      const sessionRes = await fetch(`${getBaseUrl()}/api/auth/get-session`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const sessionData = await sessionRes.json() as {
        session?: { userId: string };
        user?: { role?: string };
      } | null;

      const role = sessionData?.user?.role ?? "Vecino";
      const isProvider = role.toLowerCase().includes("proveedor") || role.toLowerCase() === "provider";

      setStep("done");

      // 4. Navegar DIRECTO a la pantalla correcta (sin pasar por index.tsx)
      if (isProvider) {
        router.replace("/(proveedor)/job");
      } else {
        router.replace("/(vecino)");
      }
    } catch (e: any) {
      setStep("error");
      setErrorMsg(e.message ?? "Error de red.");
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Image
            source={require("../../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>Gestión inteligente de comunidades</Text>
        </View>

        {/* ── Unified Form ───────────────────────────────────────────────── */}
        <View style={styles.form}>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              🔐 Acceso mediante tu usuario corporativo y el PIN de 6 dígitos que te proporcionó Aconvi.
            </Text>
          </View>
          <Text style={styles.label}>Usuario corporativo</Text>
          <TextInput
            style={styles.input}
            placeholder="af.garcia"
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
            editable={step !== "loading"}
          />
          <Text style={styles.label}>PIN de acceso</Text>
          <TextInput
            style={[styles.input, styles.pinInput]}
            placeholder="••••••"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            value={pin}
            onChangeText={(v) => setPin(v.replace(/\D/g, ""))}
            editable={step !== "loading"}
          />
          {step === "error" && <Text style={styles.error}>{errorMsg}</Text>}
          <TouchableOpacity
            style={[styles.btn, step === "loading" && styles.btnDisabled]}
            onPress={handlePinLogin}
            disabled={step === "loading"}
          >
            {step === "loading" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Iniciar sesión</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 100 },
  logoWrap: { alignItems: "center", marginBottom: 48 },
  logo: { height: 48, width: 160, marginBottom: 8 },
  tagline: { fontSize: 15, color: GRAY, marginTop: 6 },
  form: { flex: 1 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: DARK,
    marginBottom: 20,
    backgroundColor: "#fafafa",
  },
  pinInput: { fontSize: 24, letterSpacing: 6, textAlign: "center" },
  btn: {
    backgroundColor: TEAL,
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  error: {
    color: "#dc2626",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
    backgroundColor: "#fef2f2",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fca5a5"
  },
  infoBox: {
    backgroundColor: "#f0fdf9",
    borderRadius: 10,
    padding: 16,
    marginBottom: 28,
    borderLeftWidth: 4,
    borderLeftColor: TEAL,
  },
  infoText: { fontSize: 14, color: "#374151", lineHeight: 22 },
});
