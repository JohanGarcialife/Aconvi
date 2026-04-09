"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Building2,
  Bell,
  BellRing,
  MessageSquare,
  Trees,
  FileText,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@acme/ui/sidebar";
import { useWebPush } from "~/hooks/useWebPush";

const items = [
  { title: "Inicio", url: "/incidents", icon: Home },
  { title: "Comunidades", url: "/communities", icon: Building2 },
  { title: "Incidencias", url: "/incidents", icon: Bell, badge: "50" },
  { title: "Comunicación", url: "/communication", icon: MessageSquare },
  { title: "Zonas comunes", url: "/common-areas", icon: Trees },
  { title: "Documentos", url: "/documents", icon: FileText },
  { title: "Importador", url: "/importer", icon: UploadCloud },
];

export function AppSidebar() {
  const pathname = usePathname();

  const { permission, isRegistering, requestPermissionAndSubscribe } = useWebPush();

  return (
    <Sidebar className="border-r border-slate-200 bg-white">
      <SidebarHeader className="px-6 py-5 border-b border-slate-100">
        <Link href="/incidents" className="flex items-baseline no-underline select-none">
          <span
            style={{
              fontFamily: "'Inter', 'Geist', sans-serif",
              fontWeight: 800,
              fontSize: "1.6rem",
              color: "#1a2332",
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            {"A"}
          </span>
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "#4aa19b",
              display: "inline-block",
              marginBottom: "0.55rem",
              marginLeft: "1px",
              marginRight: "1px",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "'Inter', 'Geist', sans-serif",
              fontWeight: 800,
              fontSize: "1.6rem",
              color: "#1a2332",
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            convi
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
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
                      className={`h-10 rounded-xl px-3 text-sm font-medium transition-all ${
                        isActive
                          ? "bg-primary! text-white! hover:bg-primary/90! hover:text-white!"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      <Link
                        href={item.url}
                        className="flex justify-between items-center w-full"
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.title}</span>
                        </div>
                        {item.badge && (
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              isActive
                                ? "bg-white/25 text-white"
                                : "bg-primary/15 text-primary"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 flex flex-col gap-3">
        {/* Notification Permission Button */}
        {permission !== "unsupported" && permission !== "granted" && (
          <button
            type="button"
            disabled={isRegistering || permission === "denied"}
            onClick={() => void requestPermissionAndSubscribe()}
            className={`flex items-center gap-2 w-full rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all ${
              permission === "denied"
                ? "border-red-200 bg-red-50 text-red-500 cursor-not-allowed"
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
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 font-medium">
            <Bell className="h-3.5 w-3.5 shrink-0" />
            Notificaciones activas
          </div>
        )}

        {/* Branding Footer */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
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
