"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  UsersRound,
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

const items = [
  { title: "SaaS Dashboard", url: "/superadmin", icon: LayoutDashboard },
  { title: "Fincas Globales", url: "/superadmin/communities", icon: Building2 },
  {
    title: "Directorio AFs",
    url: "/superadmin/administrators",
    icon: UsersRound,
  },
  {
    title: "Ajustes de Plataforma",
    url: "/superadmin/settings",
    icon: Settings,
  },
];

export function AppSidebarSuperAdmin() {
  const pathname = usePathname();

  return (
    <Sidebar className="border-r border-slate-200 bg-white text-slate-900">
      <SidebarHeader className="border-b border-slate-200 px-2 py-4">
        <Link
          href="/superadmin"
          className="flex items-center justify-center no-underline select-none"
        >
          <div className="flex flex-col items-center">
            {/* Si tienes una variante de logo claro o simplemente texto */}
            <span className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900">
              <ShieldAlert className="h-5 w-5 text-indigo-600" />
              Aconvi <span className="font-black text-indigo-600">SaaS</span>
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
                        className="flex w-full items-center justify-between"
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

      <SidebarFooter className="flex flex-col gap-3 border-t border-slate-200 p-4">
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-700">
          <p className="text-center leading-snug font-semibold">
            Módulo Maestro SuperAdmin
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
