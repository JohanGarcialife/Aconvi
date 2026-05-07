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
} from "react-native";
import { useRouter } from "expo-router";
import { getBaseUrl } from "~/utils/base-url";
import { setToken } from "~/utils/session-store";

const TEAL = "#00BDA5";
const DARK = "#0F1B2B";
const GRAY = "#6b7280";

type Tab = "vecino" | "profesional";
type Step = "idle" | "loading" | "done" | "error";

export default function LoginScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("vecino");

  // ── Vecino state ─────────────────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [vecStep, setVecStep] = useState<Step>("idle");

  // ── Profesional state ────────────────────────────────────────────────────────
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [proStep, setProStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // ── Magic link (Vecino) ──────────────────────────────────────────────────────
  const handleMagicLink = async () => {
    if (!email.trim()) return;
    setVecStep("loading");
    try {
      const res = await fetch(`${getBaseUrl()}/api/auth/sign-in/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error("Error al enviar enlace.");
      setMagicSent(true);
      setVecStep("done");
    } catch (e: any) {
      setVecStep("error");
      setErrorMsg(e.message ?? "Error de red.");
    }
  };

  // ── PIN login (Profesional) ──────────────────────────────────────────────────
  const handlePinLogin = async () => {
    if (!username.trim() || !pin.trim()) return;
    setProStep("loading");
    setErrorMsg("");
    try {
      const res = await fetch(`${getBaseUrl()}/api/auth/mobile-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), pin: pin.trim() }),
      });
      const data = await res.json() as { ok: boolean; sessionToken?: string; error?: string };
      if (!res.ok || !data.ok || !data.sessionToken) {
        setProStep("error");
        setErrorMsg(data.error ?? "Error de autenticación.");
        return;
      }
      // Store session token → authClient reads it from SecureStore
      setToken(data.sessionToken);
      setProStep("done");
      // Navigate to home; the layout will pick up the session
      router.replace("/");
    } catch (e: any) {
      setProStep("error");
      setErrorMsg(e.message ?? "Error de red.");
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logo}>Aconvi</Text>
          <Text style={styles.tagline}>Gestión inteligente de comunidades</Text>
        </View>

        {/* Tab selector */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, tab === "vecino" && styles.tabActive]}
            onPress={() => setTab("vecino")}
          >
            <Text style={[styles.tabText, tab === "vecino" && styles.tabTextActive]}>Vecino</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === "profesional" && styles.tabActive]}
            onPress={() => setTab("profesional")}
          >
            <Text style={[styles.tabText, tab === "profesional" && styles.tabTextActive]}>Profesional</Text>
          </TouchableOpacity>
        </View>

        {/* ── Vecino Tab ─────────────────────────────────────────────────────── */}
        {tab === "vecino" && (
          <View style={styles.form}>
            {magicSent ? (
              <View style={styles.successBox}>
                <Text style={styles.successIcon}>📩</Text>
                <Text style={styles.successTitle}>Revisa tu correo</Text>
                <Text style={styles.successText}>
                  Hemos enviado un enlace de acceso a {email}. Tócalo desde tu móvil para entrar.
                </Text>
                <TouchableOpacity onPress={() => { setMagicSent(false); setVecStep("idle"); }}>
                  <Text style={styles.link}>Usar otro correo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.label}>Correo electrónico</Text>
                <TextInput
                  style={styles.input}
                  placeholder="vecino@micomunidad.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  editable={vecStep !== "loading"}
                />
                {vecStep === "error" && <Text style={styles.error}>{errorMsg}</Text>}
                <TouchableOpacity
                  style={[styles.btn, vecStep === "loading" && styles.btnDisabled]}
                  onPress={handleMagicLink}
                  disabled={vecStep === "loading"}
                >
                  {vecStep === "loading" ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>Enviar enlace de acceso</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ── Profesional Tab ───────────────────────────────────────────────── */}
        {tab === "profesional" && (
          <View style={styles.form}>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                🔐  Acceso corporativo. Introduce tu usuario y el PIN que te proporcionó Aconvi.
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
              editable={proStep !== "loading"}
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
              editable={proStep !== "loading"}
            />
            {proStep === "error" && <Text style={styles.error}>{errorMsg}</Text>}
            <TouchableOpacity
              style={[styles.btn, proStep === "loading" && styles.btnDisabled]}
              onPress={handlePinLogin}
              disabled={proStep === "loading"}
            >
              {proStep === "loading" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Iniciar sesión</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 64 },
  logoWrap: { alignItems: "center", marginBottom: 36 },
  logo: { fontSize: 34, fontWeight: "800", color: DARK, letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: GRAY, marginTop: 4 },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 4,
    marginBottom: 28,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  tabActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: "600", color: GRAY },
  tabTextActive: { color: DARK },
  form: { flex: 1 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: DARK,
    marginBottom: 16,
    backgroundColor: "#fafafa",
  },
  pinInput: { fontSize: 24, letterSpacing: 6, textAlign: "center" },
  btn: {
    backgroundColor: TEAL,
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  error: {
    color: "#dc2626",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 12,
    backgroundColor: "#fef2f2",
    padding: 10,
    borderRadius: 8,
  },
  link: { color: TEAL, fontWeight: "600", fontSize: 15, textAlign: "center", marginTop: 16 },
  infoBox: {
    backgroundColor: "#f0fdf9",
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
  },
  infoText: { fontSize: 13, color: "#374151", lineHeight: 20 },
  successBox: { alignItems: "center", paddingTop: 24 },
  successIcon: { fontSize: 56, marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: "700", color: DARK, marginBottom: 8 },
  successText: { fontSize: 14, color: GRAY, textAlign: "center", lineHeight: 22, marginBottom: 24, maxWidth: 300 },
});
