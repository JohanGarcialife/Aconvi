import { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { authClient } from "~/utils/auth";
import { getBaseUrl } from "~/utils/base-url";

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
    if (!session?.user) return;

    // Use WS_URL in production, fallback to local URL (adjust for Android Simulator 10.0.2.2 vs localhost)
    // Here getBaseUrl() is HTTP, we can replace it or rely on a specific env WS_URL
    const baseUrl = process.env.EXPO_PUBLIC_WS_URL || "http://localhost:3001";
    
    const socketInstance = io(baseUrl, {
      auth: {
        token: session.session?.token || "anonymous",
      },
    });

    socketInstance.on("connect", () => {
      console.log("[WS Expo] Connected", socketInstance.id);
      setIsConnected(true);
      
      // We join our personal channel
      socketInstance.emit("join-user", session.user.id);
    });

    socketInstance.on("disconnect", () => {
      console.log("[WS Expo] Disconnected");
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
