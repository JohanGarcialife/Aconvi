"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@acme/ui/sidebar";
import { authClient } from "~/auth/client";
import { LogOut } from "lucide-react";

export function SuperAdminHeader() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending) {
      if (!session?.user) {
        router.push("/login");
      } else {
        // Protect at frontend level: Only super roles allowed
        const role = (session.user as any).role;
        if (role !== "SuperAdmin" && role !== "AgenteAconvi") {
          router.push("/"); // redirect back to their appropriate dashboard or home
        }
      }
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6">
        <SidebarTrigger className="-ml-2 shrink-0 text-slate-500 hover:text-slate-700" />
      </header>
    );
  }

  // Double check before rendering
  const role = (session?.user as any)?.role;
  if (role !== "SuperAdmin" && role !== "AgenteAconvi") return null;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6">
      <SidebarTrigger className="-ml-2 shrink-0 text-slate-500 hover:text-slate-700" />
      <div className="flex-1" />
      
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end hidden sm:flex">
          <span className="text-sm font-semibold text-slate-800 leading-none mb-1">
            {session?.user.name ?? "SuperAdmin"}
          </span>
          <span className="text-xs text-indigo-600 font-medium leading-none">
            SaaS Manager
          </span>
        </div>
        <button 
          onClick={async () => {
            await authClient.signOut();
            router.push("/");
          }}
          className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
          title="Cerrar sesión"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
