import { useState, useEffect, useRef } from "react";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform, Alert } from "react-native";
import Constants from "expo-constants";
import { trpc, queryClient } from "../utils/api";
import { useMutation } from "@tanstack/react-query";

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

  // tRPC mutation to register token in backend
  const registerToken = useMutation({
    ...trpc.notification.registerToken.mutationOptions(),
    onSuccess: () => {
      console.log("[Push] Token saved in DB successfully");
    },
    onError: (err) => {
      console.error("[Push] Error saving token to DB:", err);
      const isUnauth = err?.message?.toUpperCase().includes("UNAUTHORIZED");
      if (isUnauth) {
        // Expected at startup when user is not logged in yet.
        return;
      }
      Alert.alert("Error de Registro", "No se pudo guardar el token en la base de datos: " + (err?.message ?? "Error desconocido"));
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
        // Store in backend
        registerToken.mutate({ token, platform: "expo" } as any);
      })
      .catch((err) => {
        console.error("[Push] Error in registerForPushNotificationsAsync:", err);
        Alert.alert("Error de Permisos/FCM", "No se pudo obtener el token de notificaciones: " + (err?.message ?? "Error desconocido"));
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

  return { expoPushToken, permissionStatus };
}

// ─── Helper ───────────────────────────────────────────────────────────────────
async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("[Push] Must use a physical device for push notifications.");
    return null;
  }

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

  // Get Expo push token — requires projectId for EAS builds
  // During development with Expo Go, this works without EAS
  const projectId =
    process.env.EXPO_PUBLIC_PROJECT_ID ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  console.log("[Push] Expo Push Token:", tokenData.data);
  return tokenData.data;
}
