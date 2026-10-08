"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  BellRing,
  Building2,
  FileText,
  Home,
  MessageSquare,
  ShieldCheck,
  Trees,
  UploadCloud,
  Vote,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@acme/ui/sidebar";

import { useWebPush } from "~/hooks/useWebPush";
import { useTRPC } from "~/trpc/react";

const items = [
  { title: "Inicio", url: "/home", icon: Home },
  { title: "Comunidades", url: "/communities", icon: Building2 },
  { title: "Incidencias", url: "/incidents", icon: Bell, badge: "50" },
  { title: "Votaciones", url: "/votes", icon: Vote },
  { title: "Comunicación", url: "/communication", icon: MessageSquare },
  { title: "Zonas comunes", url: "/common-areas", icon: Trees },
  { title: "Documentos", url: "/documents", icon: FileText },
  { title: "Importador", url: "/importer", icon: UploadCloud },
];

export function AppSidebar() {
  const pathname = usePathname();
  const trpc = useTRPC();

  // Fetch pending incidents count for the sidebar badge
  const { data: incidents } = useQuery({
    ...trpc.incident.all.queryOptions({ tenantId: "org_aconvi_demo" }),
    refetchInterval: 5000,
  });

  // Show total incidents count in badge
  const totalCount = incidents?.length ?? 0;

  const { permission, isRegistering, requestPermissionAndSubscribe } =
    useWebPush();

  return (
    <Sidebar className="border-r border-slate-200 bg-white">
      <SidebarHeader className="flex items-center justify-center border-b border-slate-100 px-4 py-3">
        <Link
          href="/incidents"
          className="flex w-full items-center justify-center no-underline select-none"
        >
          <Image
            src="/logo.png"
            alt="Logo"
            width={140}
            height={46}
            className="object-contain"
          />
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {items.map((item) => {
                const isActive =
                  pathname === item.url ||
                  (item.url !== "/incidents" && pathname.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`h-10 rounded-md px-3 text-sm font-medium transition-all ${
                        isActive
                          ? "bg-[#EAF5F2]! font-semibold text-[#008075]! hover:bg-[#E2F0ED]! hover:text-[#008075]!"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Link
                        href={item.url}
                        className="flex w-full items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <item.icon
                            className={`h-4 w-4 shrink-0 ${isActive ? "text-[#008075]" : "text-slate-500"}`}
                          />
                          <span>{item.title}</span>
                        </div>
                        {item.title === "Incidencias" && totalCount > 0 ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              isActive
                                ? "bg-[#008075]/15 text-[#008075]"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {totalCount}
                          </span>
                        ) : item.badge && item.title !== "Incidencias" ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              isActive
                                ? "bg-[#008075]/15 text-[#008075]"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="flex flex-col gap-3 p-4">
        {/* Notification Permission Button */}
        {permission !== "unsupported" && permission !== "granted" && (
          <button
            type="button"
            disabled={isRegistering || permission === "denied"}
            onClick={() => void requestPermissionAndSubscribe()}
            className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all ${
              permission === "denied"
                ? "cursor-not-allowed border-red-200 bg-red-50 text-red-500"
                : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
            }`}
          >
            <BellRing className="h-3.5 w-3.5 shrink-0" />
            {isRegistering
              ? "Activando..."
              : permission === "denied"
                ? "Notificaciones bloqueadas"
                : "Activar notificaciones"}
          </button>
        )}
        {permission === "granted" && (
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
            <Bell className="h-3.5 w-3.5 shrink-0" />
            Notificaciones activas
          </div>
        )}

        {/* Branding Footer */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          <div className="mb-1 flex items-center gap-2">
            <ShieldCheck className="text-primary h-3.5 w-3.5 shrink-0" />
            <span className="font-semibold text-slate-700">
              Transparencia que te protege
            </span>
          </div>
          <p className="leading-snug">
            Todo queda registrado. Tú decides, el proveedor responde.
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
