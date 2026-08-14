import { useState, useEffect, useRef } from "react";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import Constants from "expo-constants";
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
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<Notifications.PermissionStatus | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    let isMounted = true;

    acquirePushToken()
      .then(async (result) => {
        if (!result || !isMounted) {
          console.warn("[Push] No token returned.");
          return;
        }
        console.log(`[Push] Token acquired (${result.platform}):`, result.token.slice(0, 30) + "...");
        setPushToken(result.token);

        // Register token with backend
        await registerTokenWithBackend(result.token, result.platform);
      })
      .catch((err) => {
        console.warn("[Push] Error acquiring push token:", err);
      });

    // Listener: receives notification while app is open
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("[Push] Notification received in foreground:", notification);
      });

    // Listener: user tapped on a notification
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        console.log("[Push] Notification tapped, data:", data);
      });

    return () => {
      isMounted = false;
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return { expoPushToken: pushToken, permissionStatus };
}

// ─── Register token with backend via REST ─────────────────────────────────────
async function registerTokenWithBackend(token: string, platform: string): Promise<void> {
  try {
    const sessionToken = await SecureStore.getItemAsync("expo_session_token");
    if (!sessionToken) {
      console.warn("[Push] No session token in SecureStore, skipping registration.");
      return;
    }

    const res = await fetch(`${getBaseUrl()}/api/register-push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ token, platform }),
    });

    const data = (await res.json()) as { ok: boolean; error?: string };
    if (data.ok) {
      console.log(`[Push] Token registered in backend (${platform}).`);
    } else {
      console.warn("[Push] Backend registration error:", data.error);
    }
  } catch (err) {
    console.warn("[Push] Error registering token:", err);
  }
}

// ─── Token acquisition ────────────────────────────────────────────────────────
async function acquirePushToken(): Promise<{ token: string; platform: string } | null> {
  // Setup notification channel on Android
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Aconvi",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#4aa19b",
    });
  }

  // Request notification permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("[Push] Notification permission not granted. Status:", finalStatus);
    return null;
  }

  // ─── Android Standalone: use native FCM token directly ─────────────────
  // ExponentPushToken relay fails on standalone APKs. Use native FCM token directly.
  if (Platform.OS === "android") {
    // 1. Try Expo's native device push token (calls Google Play Services FCM directly)
    try {
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      console.log("[Push] Notifications.getDevicePushTokenAsync acquired:", deviceToken);
      if (deviceToken && typeof deviceToken.data === "string" && deviceToken.data.length > 20) {
        console.log("[Push] Native FCM Device Token acquired via expo-notifications:", deviceToken.data.slice(0, 30));
        return { token: deviceToken.data, platform: "fcm" };
      }
    } catch (err) {
      console.warn("[Push] Notifications.getDevicePushTokenAsync failed:", err);
    }

    // 2. Try @react-native-firebase/messaging fallback
    try {
      const messagingModule = await import("@react-native-firebase/messaging");
      const messaging = messagingModule.default;
      await messaging().requestPermission().catch(() => {});
      const fcmToken = await messaging().getToken();
      console.log("[Push] Native FCM token acquired via @react-native-firebase/messaging:", fcmToken?.slice(0, 30));
      if (fcmToken && typeof fcmToken === "string") {
        return { token: fcmToken, platform: "fcm" };
      }
    } catch (err) {
      console.warn("[Push] @react-native-firebase/messaging failed:", err);
    }
  }

  // ─── iOS / Expo Go fallback: use Expo push token relay ─────────────────
  try {
    const projectId =
      process.env.EXPO_PUBLIC_PROJECT_ID ??
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      "1713543a-27cf-4db0-9da2-64ddf821d5d7";

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log("[Push] Expo Push Token acquired:", tokenData.data);
    return { token: tokenData.data, platform: "expo" };
  } catch (error) {
    console.warn("[Push] getExpoPushTokenAsync failed, trying device token:", error);

    try {
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      console.log("[Push] Device Push Token fallback:", deviceToken?.data);
      if (typeof deviceToken?.data === "string") {
        return { token: deviceToken.data, platform: "fcm" };
      }
    } catch (fallbackErr) {
      console.error("[Push] All token acquisition methods failed:", fallbackErr);
    }
  }

  return null;
}
