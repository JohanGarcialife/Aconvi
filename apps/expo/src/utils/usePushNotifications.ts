import { useState, useEffect, useRef } from "react";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform, Alert } from "react-native";
import Constants from "expo-constants";
import { trpc, queryClient } from "../utils/api";
import { useMutation } from "@tanstack/react-query";
import { authClient } from "./auth";

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
    if (!expoPushToken || !userId) {
      console.log("[Push] Skipping register: token or userId missing", { token: !!expoPushToken, userId: !!userId });
      return;
    }
    console.log("[Push] Registering token for user", userId);
    registerToken.mutate({ token: expoPushToken, platform: "expo" } as any);
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
