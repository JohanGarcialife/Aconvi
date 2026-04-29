"use client";

import { Building2 } from "lucide-react";
import { trpc } from "~/utils/trpc";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function SuperAdminCommunitiesPage() {
  const { data: communities, isLoading } = trpc.superadmin.getCommunities.useQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-500" />
            Fincas Registradas
          </h1>
          <p className="text-slate-500 mt-1">
            Gestión global de todas las comunidades operando en la plataforma.
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              <tr>
                <th className="px-6 py-4">Nombre de la Finca</th>
                <th className="px-6 py-4">Slug / ID</th>
                <th className="px-6 py-4">Administradores (Owners)</th>
                <th className="px-6 py-4">Fecha de Alta</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    Cargando comunidades...
                  </td>
                </tr>
              ) : communities?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No hay comunidades registradas aún.
                  </td>
                </tr>
              ) : (
                communities?.map((comm) => (
                  <tr key={comm.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {comm.name}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      <span className="bg-slate-100 px-2 py-1 rounded font-mono text-xs">
                        {comm.slug}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {comm.owners.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {comm.owners.map((owner, i) => (
                            <span key={i} className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium border border-indigo-100">
                              {owner}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Sin asignar</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {format(new Date(comm.createdAt), "d MMM yyyy", { locale: es })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors">
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
