"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "~/auth/client";

export default function AuthSuccessPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending) {
      if (session?.user?.role === "SuperAdmin") {
        router.push("/superadmin");
      } else if (session?.user) {
        router.push("/communities");
      } else {
        router.push("/login");
      }
    }
  }, [session, isPending, router]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "#f5f5f5",
        color: "#6b7280",
        fontFamily: "sans-serif"
      }}
    >
      Verificando permisos y cargando el panel de control...
    </div>
  );
}
