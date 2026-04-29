import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { authClient } from "~/utils/auth";

/**
 * Root entry point.
 * Redirects to the correct role group based on session metadata.
 * - role === "provider" → /(proveedor)/job
 * - role === "admin"    → web only (shows info screen)
 * - default (neighbor)  → /(vecino)
 */
export default function RootIndex() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending) return;

    if (!session) {
      // Not logged in → send to login screen
      router.replace("/login");
      return;
    }

    const role = (session.user as { role?: string }).role ?? "neighbor";

    if (role === "provider") {
      router.replace("/(proveedor)/job");
    } else {
      router.replace("/(vecino)");
    }
  }, [session, isPending, router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
      <ActivityIndicator color="#4aa19b" size="large" />
    </View>
  );
}
