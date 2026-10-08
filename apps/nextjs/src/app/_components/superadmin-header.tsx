"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { SidebarTrigger } from "@acme/ui/sidebar";

import { authClient } from "~/auth/client";

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
        <div className="flex hidden flex-col items-end sm:flex">
          <span className="mb-1 text-sm leading-none font-semibold text-slate-800">
            {session?.user.name ?? "SuperAdmin"}
          </span>
          <span className="text-xs leading-none font-medium text-indigo-600">
            SaaS Manager
          </span>
        </div>
        <button
          onClick={async () => {
            await authClient.signOut();
            router.push("/");
          }}
          className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
