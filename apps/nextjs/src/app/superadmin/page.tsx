"use client";

import { Users, Building2, UserCog, Wrench } from "lucide-react";
import { useTRPC } from "~/trpc/react";
import { useQuery } from "@tanstack/react-query";

export default function SuperAdminDashboard() {
  const trpc = useTRPC();
  const { data: stats, isLoading, error } = useQuery(
    trpc.superadmin.getStats.queryOptions()
  );

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-slate-200 rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-xl"></div>
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          SaaS Dashboard
        </h1>
        <p className="text-slate-500 mt-1">
          Visión global del uso de la plataforma Aconvi.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Building2 className="w-24 h-24" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="font-medium text-slate-600">Comunidades</h3>
          </div>
          <p className="text-4xl font-bold text-slate-900">
            {stats?.totalCommunities ?? 0}
          </p>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <UserCog className="w-24 h-24" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <UserCog className="w-5 h-5" />
            </div>
            <h3 className="font-medium text-slate-600">Admin de Fincas</h3>
          </div>
          <p className="text-4xl font-bold text-slate-900">
            {stats?.totalAdministrators ?? 0}
          </p>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Users className="w-24 h-24" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-medium text-slate-600">Vecinos Totales</h3>
          </div>
          <p className="text-4xl font-bold text-slate-900">
            {stats?.totalNeighbors ?? 0}
          </p>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Wrench className="w-24 h-24" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
              <Wrench className="w-5 h-5" />
            </div>
            <h3 className="font-medium text-slate-600">Proveedores</h3>
          </div>
          <p className="text-4xl font-bold text-slate-900">
            {stats?.totalProviders ?? 0}
          </p>
        </div>
      </div>

      {/* Aquí podrías agregar un gráfico de altas en el tiempo u otros reportes */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-800 mb-4">Actividad Reciente</h3>
        <p className="text-sm text-slate-500">
          No hay actividad destacada de creación de organizaciones nuevas en las últimas 24h.
        </p>
      </div>
    </div>
  );
}
