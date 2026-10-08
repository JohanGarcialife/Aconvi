"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Building2 } from "lucide-react";

import { useTRPC } from "~/trpc/react";

export default function SuperAdminCommunitiesPage() {
  const trpc = useTRPC();
  const { data: communities, isLoading } = useQuery(
    trpc.superadmin.getCommunities.queryOptions(),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <Building2 className="h-6 w-6 text-indigo-500" />
            Fincas Registradas
          </h1>
          <p className="mt-1 text-slate-500">
            Gestión global de todas las comunidades operando en la plataforma.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 font-medium text-slate-600">
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
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-slate-400"
                  >
                    Cargando comunidades...
                  </td>
                </tr>
              ) : communities?.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-slate-400"
                  >
                    No hay comunidades registradas aún.
                  </td>
                </tr>
              ) : (
                communities?.map((comm) => (
                  <tr
                    key={comm.id}
                    className="transition-colors hover:bg-slate-50"
                  >
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {comm.name}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      <span className="rounded bg-slate-100 px-2 py-1 font-mono text-xs">
                        {comm.slug}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {comm.owners.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {comm.owners.map((owner, i) => (
                            <span
                              key={i}
                              className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                            >
                              {owner}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          Sin asignar
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {format(new Date(comm.createdAt), "d MMM yyyy", {
                        locale: es,
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-800">
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
