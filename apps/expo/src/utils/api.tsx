import { QueryClient, onlineManager } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import superjson from "superjson";
import NetInfo from "@react-native-community/netinfo";

import type { AppRouter } from "@acme/api";

import * as SecureStore from "expo-secure-store";
import { getBaseUrl } from "./base-url";

// ─── Wire React Query's onlineManager to NetInfo ─────────────────────────────
// IMPORTANT: isInternetReachable starts as null on Android while NetInfo probes
// the network. Using !!null = false would mark the app as "offline" at startup
// and pause ALL queries until the probe finishes (can take 30s+).
// Fix: assume online at startup and only flip offline when isConnected is
// explicitly false (i.e. no Wi-Fi/cellular at all).
onlineManager.setOnline(true);

onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    // isConnected !== false covers: true (connected) and null (unknown/checking)
    // We only go offline when isConnected is explicitly false.
    const isOnline = state.isConnected !== false;
    setOnline(isOnline);
  });
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5,    // 5 minutes (was 2m — more cache hits on revisit)
      retry: 1,                     // 1 retry (was 2 — halves backoff wait on failure)
      refetchOnWindowFocus: false,  // don't re-fetch on app foreground if data is fresh
    },
  },
});

/**
 * A set of typesafe hooks for consuming your API.
 */
export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: createTRPCClient({
    links: [
      loggerLink({
        enabled: (opts) =>
          process.env.NODE_ENV === "development" ||
          (opts.direction === "down" && opts.result instanceof Error),
        colorMode: "ansi",
      }),
      httpBatchLink({
        transformer: superjson,
        url: `${getBaseUrl()}/api/trpc`,
        async headers() {
          const headers: Record<string, string> = {
            "x-trpc-source": "expo-react",
          };

          try {
            const token = await SecureStore.getItemAsync("expo_session_token");
            if (token) {
              headers.Authorization = `Bearer ${token}`;
            }
          } catch (e) {}

          return headers;
        },
      }),
    ],
  }),
  queryClient,
});

// Alias for backward compatibility
export const api = trpc;

export type { RouterInputs, RouterOutputs } from "@acme/api";
