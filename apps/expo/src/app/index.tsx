import { useEffect, useRef, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter, useRootNavigationState } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { getBaseUrl } from "~/utils/base-url";

/**
 * Root entry point.
 *
 * Valida el token de SecureStore directamente via Bearer,
 * sin depender de useSession() del expoClient (que usa cookies y
 * no es compatible con los tokens de mobile-login).
 */
export default function RootIndex() {
  const router = useRouter();
  const rootNavState = useRootNavigationState();
  const [ready, setReady] = useState(false);
  const doneRef = useRef(false);

  // Esperar a que el navigator esté montado
  useEffect(() => {
    if (rootNavState?.key) setReady(true);
  }, [rootNavState?.key]);

  useEffect(() => {
    if (!ready) return;
    if (doneRef.current) return;

    const run = async () => {
      if (doneRef.current) return;
      doneRef.current = true;

      try {
        // 1. Leer token de SecureStore
        const token = await SecureStore.getItemAsync("expo_session_token");
        console.log("[RootIndex] token found:", !!token);

        if (!token) {
          console.log("[RootIndex] No token → login");
          router.replace("/login");
          return;
        }

        // 2. Validar token con Bearer directamente
        const res = await fetch(`${getBaseUrl()}/api/auth/get-session`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          console.log("[RootIndex] get-session HTTP error:", res.status, "→ login");
          await SecureStore.deleteItemAsync("expo_session_token").catch(() => {});
          router.replace("/login");
          return;
        }

        const sessionData = await res.json() as {
          session?: { userId: string };
          user?: { id: string; role?: string };
        } | null;

        console.log("[RootIndex] sessionData:", sessionData?.user?.id, "role:", sessionData?.user?.role);

        if (!sessionData?.user) {
          console.log("[RootIndex] Token invalid/expired → clearing and going to login");
          await SecureStore.deleteItemAsync("expo_session_token").catch(() => {});
          router.replace("/login");
          return;
        }

        // 3. Navegar por rol
        const role = sessionData.user.role ?? "Vecino";
        const isProvider = role.toLowerCase().includes("proveedor") || role.toLowerCase() === "provider";
        console.log("[RootIndex] Valid session, role:", role, "isProvider:", isProvider);

        if (isProvider) {
          router.replace("/(proveedor)/job");
        } else {
          router.replace("/(vecino)");
        }
      } catch (e: any) {
        console.log("[RootIndex] Error:", e.message, "→ login");
        await SecureStore.deleteItemAsync("expo_session_token").catch(() => {});
        router.replace("/login");
      }
    };

    // Pequeño delay para asegurar que el navigator esté listo
    const t = setTimeout(run, 100);
    return () => clearTimeout(t);
  }, [ready]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
      <ActivityIndicator color="#4aa19b" size="large" />
    </View>
  );
}
