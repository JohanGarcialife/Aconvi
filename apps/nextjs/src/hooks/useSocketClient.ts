"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001";

type NotificationHandler = (data: any) => void;

interface UseSocketClientOptions {
  tenantId?: string;
  userId?: string;
  token?: string;
  onIncidentUpdated?: NotificationHandler;
  onNewNotice?: NotificationHandler;
  onRatingRequest?: NotificationHandler;
  onRatingReceived?: NotificationHandler;
}

export function useSocketClient({
  tenantId,
  userId,
  token,
  onIncidentUpdated,
  onNewNotice,
  onRatingRequest,
  onRatingReceived,
}: UseSocketClientOptions = {}) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(WS_URL, {
      auth: { token: token ?? "guest" },
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[WS] Connected:", socket.id);
      if (tenantId) socket.emit("join-tenant", tenantId);
      if (userId) socket.emit("join-user", userId);
    });

    socket.on("notify-incident-updated", (data) => onIncidentUpdated?.(data));
    socket.on("notify-new-notice", (data) => onNewNotice?.(data));
    socket.on("rating-request", (data) => onRatingRequest?.(data));
    socket.on("notify-rating-received", (data) => onRatingReceived?.(data));

    socket.on("disconnect", (reason) => {
      console.log("[WS] Disconnected:", reason);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [tenantId, userId, token]);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { emit };
}
