import { SidebarProvider, SidebarInset } from "@acme/ui/sidebar";
import { AppSidebar } from "../_components/app-sidebar";
import { DashboardTopHeader } from "../_components/dashboard-top-header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-slate-50/40">
        <DashboardTopHeader />
        <div className="p-4 md:p-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
