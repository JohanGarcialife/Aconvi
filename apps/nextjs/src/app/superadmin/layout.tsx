import { SidebarProvider, SidebarInset } from "@acme/ui/sidebar";
import { AppSidebarSuperAdmin } from "../_components/app-sidebar-superadmin";
import { SuperAdminHeader } from "../_components/superadmin-header";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebarSuperAdmin />
      <SidebarInset className="bg-slate-50">
        <div className="flex flex-1 flex-col transition-all duration-300 ease-in-out">
          <SuperAdminHeader />
          <main className="flex-1 overflow-auto">
            <div className="h-full p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
