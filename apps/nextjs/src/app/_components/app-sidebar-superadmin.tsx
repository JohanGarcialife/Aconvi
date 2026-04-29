"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  UsersRound,
  Settings,
  ShieldAlert,
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
import Image from "next/image";

const items = [
  { title: "SaaS Dashboard", url: "/superadmin", icon: LayoutDashboard },
  { title: "Fincas Globales", url: "/superadmin/communities", icon: Building2 },
  { title: "Directorio AFs", url: "/superadmin/administrators", icon: UsersRound },
  { title: "Ajustes de Plataforma", url: "/superadmin/settings", icon: Settings },
];

export function AppSidebarSuperAdmin() {
  const pathname = usePathname();

  return (
    <Sidebar className="border-r border-slate-200 bg-white text-slate-900">
      <SidebarHeader className="px-2 py-4 border-b border-slate-200">
        <Link href="/superadmin" className="flex items-center justify-center no-underline select-none">
          <div className="flex flex-col items-center">
            {/* Si tienes una variante de logo claro o simplemente texto */}
            <span className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-indigo-600" />
              Aconvi <span className="text-indigo-600 font-black">SaaS</span>
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {items.map((item) => {
                // Exact match for the root dashboard, startsWith for others
                const isActive =
                  item.url === "/superadmin"
                    ? pathname === "/superadmin"
                    : pathname.startsWith(item.url);

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`h-10 rounded-xl px-3 text-sm font-medium transition-all ${
                        isActive
                          ? "bg-indigo-600! text-white! hover:bg-indigo-700! hover:text-white!"
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
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 flex flex-col gap-3 border-t border-slate-200">
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-700">
          <p className="leading-snug font-semibold text-center">
            Módulo Maestro SuperAdmin
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
