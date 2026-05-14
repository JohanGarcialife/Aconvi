import { useColorScheme } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

import { queryClient } from "~/utils/api";
import { usePushNotifications } from "~/utils/usePushNotifications";

import "../styles.css";

import { SocketProvider } from "~/components/SocketProvider";

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

// ─── Inner component wraps hooks that need QueryClient ────────────────────────
function AppInitializer({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // Initialize push notifications (requests permission, registers token)
  usePushNotifications();

  // Handle notification tap → deep link to correct screen
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<string, string>;

        // ── Push-first auth confirmation (AF) ─────────────────────────────────
        if (data?.type === "auth_confirm" && data?.token) {
          router.push(`/confirm-access?token=${data.token}`);
          return;
        }

        // ── Incidencia concreta ────────────────────────────────────────────────
        if (data?.type === "new_incident" && data?.incidentId) {
          router.push(`/(vecino)/incidents/${data.incidentId}`);
          return;
        }
        // Legacy: incidentId without type field
        if (!data?.type && data?.incidentId) {
          router.push(`/(vecino)/incidents/${data.incidentId}`);
          return;
        }

        // ── Votación concreta ─────────────────────────────────────────────────
        if (data?.type === "new_vote") {
          router.push("/(vecino)/voting");
          return;
        }

        // ── Documento nuevo ───────────────────────────────────────────────────
        if (data?.type === "new_document") {
          router.push("/(vecino)/documents");
          return;
        }

        // ── Comunicado / aviso ────────────────────────────────────────────────
        if (data?.type === "new_notice" || data?.type === "urgent_notice") {
          router.push("/(vecino)/communication");
          return;
        }

        // ── Reserva / zona común ──────────────────────────────────────────────
        if (data?.type === "booking_confirmed" || data?.type === "booking_cancelled") {
          router.push("/(vecino)/common-areas");
          return;
        }

        // ── Rating request (vecino after incident close) ───────────────────────
        if (data?.type === "rating") {
          router.push("/(vecino)/rating");
          return;
        }

        // ── Proveedor: nueva asignación ───────────────────────────────────────
        if (data?.type === "job_assigned") {
          router.push("/(proveedor)/job");
          return;
        }
      },
    );
    return () => subscription.remove();
  }, [router]);

  return <>{children}</>;
}

// ─── Root Layout ──────────────────────────────────────────────────────────────
export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: asyncStoragePersister }}
      >
        <SocketProvider>
          <AppInitializer>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: "#FFFFFF" },
                headerTintColor: "#4aa19b",
                headerTitleStyle: { fontWeight: "700", color: "#0f172a" },
                contentStyle: {
                  backgroundColor: "#FFFFFF",
                },
                headerShadowVisible: false,
              }}
            />
          </AppInitializer>
        </SocketProvider>
        <StatusBar style="dark" />
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
