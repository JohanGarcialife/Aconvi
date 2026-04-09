"use client";

import { useState, useEffect, useCallback } from "react";
import { useTRPC } from "~/trpc/react";
import { useMutation } from "@tanstack/react-query";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export function useWebPush() {
  const trpc = useTRPC();
  const [permission, setPermission] = useState<PushPermission>("default");
  const [isRegistering, setIsRegistering] = useState(false);

  const registerMutation = useMutation(
    trpc.notification.registerToken.mutationOptions(),
  );

  // Check current permission state on mount
  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PushPermission);
  }, []);

  const requestPermissionAndSubscribe = useCallback(async () => {
    if (!("Notification" in window) || !VAPID_PUBLIC_KEY) {
      console.warn("[WebPush] Unsupported or VAPID key missing.");
      return;
    }

    setIsRegistering(true);
    try {
      // 1. Register Service Worker
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // 2. Request notification permission
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== "granted") return;

      // 3. Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // 4. Send to backend
      // @ts-ignore - TS types may lag
      await registerMutation.mutateAsync({
        token: JSON.stringify(subscription),
        platform: "web",
      });

      console.log("[WebPush] Subscribed successfully.");
    } catch (err) {
      console.error("[WebPush] Error subscribing:", err);
    } finally {
      setIsRegistering(false);
    }
  }, [registerMutation]);

  const unsubscribe = useCallback(async () => {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!registration) return;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      // @ts-ignore - TS types may lag
      await registerMutation.mutateAsync({
        token: JSON.stringify(subscription),
        platform: "web",
      }).catch(() => null);
      await subscription.unsubscribe();
    }
  }, [registerMutation]);

  return {
    permission,
    isRegistering,
    requestPermissionAndSubscribe,
    unsubscribe,
  };
}
