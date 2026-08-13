import { useState, useEffect, useRef } from "react";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform, Alert } from "react-native";
import Constants from "expo-constants";
import { trpc, queryClient } from "../utils/api";
import { useMutation } from "@tanstack/react-query";
import { authClient } from "./auth";
import { getBaseUrl } from "./base-url";

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  } as any),
});

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<Notifications.PermissionStatus | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  // tRPC mutation to register token in backend
  const registerToken = useMutation({
    ...((trpc.notification as any).registerToken?.mutationOptions?.() ?? {}),
    mutationFn: async (data: { token: string; platform: "web" | "expo" }) => {
      const opts = (trpc.notification as any).registerToken.mutationOptions();
      return opts.mutationFn(data);
    },
    onSuccess: () => {
      console.log("[Push] Token saved in DB successfully");
    },
    onError: (err: any) => {
      console.error("[Push] Error saving token to DB:", err);
      const isUnauth = err?.message?.toUpperCase().includes("UNAUTHORIZED");
      if (isUnauth) {
        // Expected at startup when user is not logged in yet.
        return;
      }
    }
  });

  useEffect(() => {
    // Register for push notifications
    registerForPushNotificationsAsync()
      .then(async (token) => {
        if (!token) {
          console.warn("[Push] No token returned from registration helper.");
          return;
        }
        setExpoPushToken(token);
      })
      .catch((err) => {
        console.warn("[Push] Error in registerForPushNotificationsAsync:", err);
      });

    // Listener: receives notification while app is open
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("[Push] Notification received:", notification);
      });

    // Listener: user tapped on a notification
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        console.log("[Push] Notification tapped, data:", data);
        // Navigation is handled in the root layout via deep link
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  // Reactively register token when user logs in or swaps accounts
  useEffect(() => {
    if (!expoPushToken) return;

    // 1. Better Auth session (Web / Vecino)
    if (userId) {
      console.log("[Push] Registering token for Better Auth user", userId);
      registerToken.mutate({ token: expoPushToken, platform: "expo" } as any);
    }

    // 2. SecureStore session token (Proveedor mobile app)
    void (async () => {
      try {
        const sessionToken = await SecureStore.getItemAsync("expo_session_token");
        if (sessionToken) {
          console.log("[Push] Registering token via SecureStore session token...");
          const res = await fetch(`${getBaseUrl()}/api/register-push-token`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({ token: expoPushToken, platform: "expo" }),
          });
          const data = (await res.json()) as { ok: boolean; error?: string };
          if (data.ok) {
            console.log("[Push] Successfully registered push token via SecureStore session!");
          } else {
            console.warn("[Push] REST registration returned error:", data.error);
          }
        }
      } catch (err) {
        console.warn("[Push] Error auto-registering token via SecureStore:", err);
      }
    })();
  }, [expoPushToken, userId]);

  return { expoPushToken, permissionStatus };
}

// ─── Helper ───────────────────────────────────────────────────────────────────
async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Aconvi",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#4aa19b",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("[Push] Permission not granted.");
    return null;
  }

  try {
    const projectId =
      process.env.EXPO_PUBLIC_PROJECT_ID ??
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      "1713543a-27cf-4db0-9da2-64ddf821d5d7";

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    console.log("[Push] Expo Push Token successfully acquired:", tokenData.data);
    return tokenData.data;
  } catch (error) {
    console.warn("[Push] Failed to get Expo push token:", error);
    return null;
  }
}
