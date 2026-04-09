"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { io, Socket } from "socket.io-client";
import { useToast } from "@acme/ui/use-toast";

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
});

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Determine WS URL based on environment. Placeholder:
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";
    
    // In a real flow, fetch auth token from session
    const socketInstance = io(wsUrl, {
      auth: { token: "user_fake_token" },
    });

    setSocket(socketInstance);

    socketInstance.on("connect", () => {
      setIsConnected(true);
      // Automatically join the current user's tenant rooms
      socketInstance.emit("join-tenant", "org_123");
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
    });

    // Global listeners for generic push notifications
    socketInstance.on("notify-incident-updated", (payload) => {
      toast({
        title: "Incidencia Actualizada",
        description: `La incidencia #${payload.id.slice(0, 5)} cambió a ${payload.status}`,
      });
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [toast]);

  return (
    <WebSocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export const useWebSocket = () => useContext(WebSocketContext);
