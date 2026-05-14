import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import superjson from "superjson";

import type { AppRouter } from "@acme/api";

import * as SecureStore from "expo-secure-store";
import { getBaseUrl } from "./base-url";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 2, // Retry failed requests
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
