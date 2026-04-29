"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { authClient } from "~/auth/client";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { data: session } = authClient.useSession();

  useEffect(() => {
    // Only connect if the user is authenticated
    if (!session?.user) return;

    // Connect to the local WebSocket server (or production URL)
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";
    
    const socketInstance = io(WS_URL, {
      auth: {
        token: session.session?.token || "anonymous",
      },
    });

    socketInstance.on("connect", () => {
      console.log("[WS] Connected to Aconvi WebSocket Server", socketInstance.id);
      setIsConnected(true);

      // We should join the specific tenant room if the user belongs to one.
      // We will listen for "tenant-joined" from other areas of the app,
      // or join their personal channel
      socketInstance.emit("join-user", session.user.id);
    });

    socketInstance.on("disconnect", () => {
      console.log("[WS] Disconnected from Server");
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [session]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
