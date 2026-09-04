import * as SecureStore from "expo-secure-store";
import { onlineManager, QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import superjson from "superjson";

import type { AppRouter } from "@acme/api";

import { getBaseUrl } from "./base-url";
import NetInfo from "./safe-netinfo";

// ─── Wire React Query's onlineManager to NetInfo ─────────────────────────────
// IMPORTANT: isInternetReachable starts as null on Android while NetInfo probes
// the network. Using !!null = false would mark the app as "offline" at startup
// and pause ALL queries until the probe finishes (can take 30s+).
// Fix: assume online at startup and only flip offline when isConnected is
// explicitly false (i.e. no Wi-Fi/cellular at all).
onlineManager.setOnline(true);

onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state: any) => {
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
      staleTime: 2000, // 2 seconds for snappy real-time reactivity
      retry: 1, // 1 retry
      refetchOnWindowFocus: true, // re-fetch on app foreground if data changed
    },
  },
});

/**
 * A set of typesafe hooks for consuming your API.
 */
// Raw tRPC client — use this outside of React hooks (e.g., after login)
export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    loggerLink({
      enabled: (opts) => {
        if (process.env.NODE_ENV !== "development") return false;
        // Suppress aborted queries from popping LogBox in development
        if (opts.direction === "down" && opts.result instanceof Error) {
          const msg = opts.result.message?.toLowerCase() ?? "";
          if (
            msg.includes("abort") ||
            opts.result.name === "AbortError" ||
            (opts.result as any)?.cause?.name === "AbortError"
          ) {
            return false;
          }
        }
        return true;
      },
      colorMode: "none",
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
          if (token) headers.Authorization = `Bearer ${token}`;
        } catch (e) {}
        return headers;
      },
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});

// Alias for backward compatibility
export const api = trpc;

export type { RouterInputs, RouterOutputs } from "@acme/api";
