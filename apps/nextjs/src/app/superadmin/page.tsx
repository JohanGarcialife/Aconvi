"use client";

import {
  Users,
  Building2,
  UserCog,
  Wrench,
  AlertTriangle,
  Vote,
  FileText,
  MonitorSmartphone,
  Activity,
  RefreshCw,
} from "lucide-react";
import { useTRPC } from "~/trpc/react";
import { useQuery } from "@tanstack/react-query";

// ─── Type icons for activity feed ─────────────────────────────────────────────
const TYPE_META = {
  incident: { icon: "🔧", color: "bg-orange-100 text-orange-700", label: "Incidencia" },
  document: { icon: "📄", color: "bg-blue-100 text-blue-700", label: "Documento" },
  vote: { icon: "🗳️", color: "bg-violet-100 text-violet-700", label: "Votación" },
  booking: { icon: "🏊", color: "bg-teal-100 text-teal-700", label: "Reserva" },
} as const;

function formatRelative(date: Date | string | null) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

// ─── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  icon,
  title,
  value,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-[0.04] pointer-events-none">
        <div className="w-24 h-24">{icon}</div>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg ${accent}`}>{icon}</div>
        <h3 className="font-medium text-slate-600 text-sm">{title}</h3>
      </div>
      <p className="text-4xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

// ─── Health pill ───────────────────────────────────────────────────────────────
function HealthPill({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg p-4 ${color}`}>
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-sm font-semibold">{value}</p>
        <p className="text-xs opacity-80">{label}</p>
      </div>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  const trpc = useTRPC();

  const { data: stats, isLoading, error, refetch } = useQuery(
    trpc.superadmin.getStats.queryOptions()
  );
  const { data: health } = useQuery(
    trpc.superadmin.getSystemHealth.queryOptions()
  );
  const { data: feed, isLoading: feedLoading } = useQuery(
    trpc.superadmin.getActivityFeed.queryOptions()
  );

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-slate-200 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-xl border border-red-200">
        <h3 className="font-bold mb-2">Error de carga</h3>
        <p>{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            SaaS Dashboard
          </h1>
          <p className="text-slate-500 mt-1">
            Visión global y auditoría completa de la plataforma Aconvi.
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors border border-slate-200 rounded-lg px-3 py-2"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<Building2 className="w-5 h-5" />}
          title="Comunidades"
          value={stats?.totalCommunities ?? 0}
          accent="bg-indigo-100 text-indigo-600"
        />
        <StatCard
          icon={<UserCog className="w-5 h-5" />}
          title="Admin de Fincas"
          value={stats?.totalAdministrators ?? 0}
          accent="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          icon={<Users className="w-5 h-5" />}
          title="Vecinos Totales"
          value={stats?.totalNeighbors ?? 0}
          accent="bg-blue-100 text-blue-600"
        />
        <StatCard
          icon={<Wrench className="w-5 h-5" />}
          title="Proveedores"
          value={stats?.totalProviders ?? 0}
          accent="bg-amber-100 text-amber-600"
        />
      </div>

      {/* System Health Strip */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Activity className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-800">Salud del Sistema</h3>
          <span className="ml-auto text-xs text-slate-400">Últimas 24h / Hoy</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <HealthPill
            icon="🚨"
            label="Incidencias abiertas"
            value={health?.openIncidents ?? 0}
            color="bg-red-50 text-red-700"
          />
          <HealthPill
            icon="🗳️"
            label="Votaciones activas"
            value={health?.activeVoteSessions ?? 0}
            color="bg-violet-50 text-violet-700"
          />
          <HealthPill
            icon="📄"
            label="Docs subidos hoy"
            value={health?.documentsUploadedToday ?? 0}
            color="bg-blue-50 text-blue-700"
          />
          <HealthPill
            icon="👥"
            label="Sesiones últimas 24h"
            value={health?.activeSessionsLast24h ?? 0}
            color="bg-emerald-50 text-emerald-700"
          />
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-6 text-sm text-slate-500">
          <span>
            <span className="font-semibold text-slate-700">{stats?.activeSessions7d ?? 0}</span> sesiones últimos 7 días
          </span>
          <span>
            <span className="font-semibold text-slate-700">{stats?.openIncidents ?? 0}</span> incidencias sin asignar
          </span>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <MonitorSmartphone className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-800">Feed de Actividad Global</h3>
          <span className="ml-auto text-xs text-slate-400">Últimas 60 acciones cross-tenant</span>
        </div>

        {feedLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !feed?.length ? (
          <p className="text-sm text-slate-500 text-center py-8">No hay actividad reciente.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {feed.map((event) => {
              const meta = TYPE_META[event.type] ?? TYPE_META.incident;
              return (
                <div
                  key={`${event.type}-${event.id}`}
                  className="flex items-center gap-3 rounded-lg px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${meta.color} min-w-[76px] text-center`}
                  >
                    {meta.icon} {meta.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{event.label}</p>
                    <p className="text-xs text-slate-400 truncate">{event.sublabel}</p>
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {formatRelative(event.at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
