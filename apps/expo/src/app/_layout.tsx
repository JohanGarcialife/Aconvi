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
  // Limit key size to avoid writing huge payloads that exceed Android SQLite CursorWindow (2MB)
  serialize: (data) => {
    try {
      const str = JSON.stringify(data);
      if (str.length > 1_000_000) {
        return JSON.stringify({ clientState: { queries: [], mutations: [] }, timestamp: Date.now(), buster: "" });
      }
      return str;
    } catch {
      return JSON.stringify({ clientState: { queries: [], mutations: [] }, timestamp: Date.now(), buster: "" });
    }
  },
  deserialize: (str) => {
    try {
      if (!str || str.length > 1_500_000) {
        return { clientState: { queries: [], mutations: [] }, timestamp: Date.now(), buster: "" };
      }
      return JSON.parse(str);
    } catch {
      return { clientState: { queries: [], mutations: [] }, timestamp: Date.now(), buster: "" };
    }
  },
});

// ─── Inner component wraps hooks that need QueryClient ────────────────────────
function AppInitializer({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // Self-healing: clear oversized REACT_QUERY_OFFLINE_CACHE on boot to fix CursorWindow errors
  useEffect(() => {
    AsyncStorage.getItem("REACT_QUERY_OFFLINE_CACHE")
      .then((val) => {
        if (val && val.length > 1_000_000) {
          void AsyncStorage.removeItem("REACT_QUERY_OFFLINE_CACHE");
        }
      })
      .catch(() => {
        void AsyncStorage.removeItem("REACT_QUERY_OFFLINE_CACHE");
      });
  }, []);

  // Initialize push notifications (requests permission, registers token)
  usePushNotifications();

  // Handle notification tap & real-time foreground updates
  useEffect(() => {
    const handleNotificationData = (data: Record<string, string> | undefined) => {
      if (!data) return;

      // Always invalidate cache when interacting with a notification
      void queryClient.invalidateQueries();

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
    };

    // Cold start notification check
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data as Record<string, string>;
        handleNotificationData(data);
      }
    });

    // Foreground listener -> auto refresh queries
    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries();
    });

    // Tap listener
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string>;
      handleNotificationData(data);
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
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
        persistOptions={{
          persister: asyncStoragePersister,
          // CRITICAL: Never persist mutations — they can contain large base64 photo
          // strings that OOM the React Native bridge when written to AsyncStorage
          dehydrateOptions: {
            shouldDehydrateMutation: () => false,
            shouldDehydrateQuery: (query) => {
              if (query.state.status !== "success") return false;
              // Safely extract primary domain key string from tRPC query key array structure
              const rawKey = query.queryKey;
              const firstPart = Array.isArray(rawKey?.[0]) ? rawKey[0][0] : rawKey?.[0];
              // Never dehydrate heavy query domains that contain photos, lists, or large payloads
              if (typeof firstPart === "string" && ["incident", "document", "notice", "booking", "provider"].includes(firstPart)) {
                return false;
              }
              return true;
            },
          },
        }}
      >
        <SocketProvider>
          <AppInitializer>
            <Stack
              screenOptions={{
                headerShown: false,
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
