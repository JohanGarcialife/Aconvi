import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter, useRootNavigationState } from "expo-router";
import { authClient } from "~/utils/auth";

/**
 * Root entry point.
 * Redirects to the correct role group based on session metadata.
 * - role === "provider" → /(proveedor)/job
 * - default (neighbor)  → /(vecino)
 * 
 * Guards navigation until the Root Layout is fully mounted.
 */
export default function RootIndex() {
  const router = useRouter();
  const rootNavState = useRootNavigationState();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    // Wait until Root Layout is fully mounted before navigating
    if (!rootNavState?.key) return;
    if (isPending) return;

    const navigate = () => {
      if (!session) {
        router.replace("/login");
        return;
      }
      const role = (session.user as { role?: string }).role ?? "neighbor";
      if (role === "provider") {
        router.replace("/(proveedor)/job");
      } else {
        router.replace("/(vecino)");
      }
    };

    // Small delay to ensure the navigator is ready
    const t = setTimeout(navigate, 50);
    return () => clearTimeout(t);
  }, [session, isPending, router, rootNavState?.key]);


  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
      <ActivityIndicator color="#4aa19b" size="large" />
    </View>
  );
}
