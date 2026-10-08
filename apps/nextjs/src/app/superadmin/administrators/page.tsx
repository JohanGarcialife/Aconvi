"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ShieldAlert, UsersRound } from "lucide-react";

import { useTRPC } from "~/trpc/react";

export default function SuperAdminAdministratorsPage() {
  const trpc = useTRPC();
  const { data: admins, isLoading } = useQuery(
    trpc.superadmin.getAdministrators.queryOptions(),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <UsersRound className="h-6 w-6 text-indigo-500" />
            Directorio de Administradores
          </h1>
          <p className="mt-1 text-slate-500">
            Usuarios con nivel de Administrador de Fincas, Agentes o
            SuperAdmins.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 font-medium text-slate-600">
              <tr>
                <th className="px-6 py-4">Usuario</th>
                <th className="px-6 py-4">Contacto</th>
                <th className="px-6 py-4">Rol en Sistema</th>
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
                    Cargando directorio...
                  </td>
                </tr>
              ) : admins?.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-slate-400"
                  >
                    No hay administradores registrados aún.
                  </td>
                </tr>
              ) : (
                admins?.map((admin) => (
                  <tr
                    key={admin.id}
                    className="transition-colors hover:bg-slate-50"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-600">
                          {admin.name?.charAt(0).toUpperCase() ?? "A"}
                        </div>
                        <div className="font-medium text-slate-900">
                          {admin.name ?? "Sin nombre"}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      <div>{admin.email}</div>
                      {admin.phoneNumber && (
                        <div className="mt-0.5 text-xs text-slate-400">
                          {admin.phoneNumber}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          admin.role === "SuperAdmin"
                            ? "border-purple-200 bg-purple-50 text-purple-700"
                            : admin.role === "AgenteAconvi"
                              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        } `}
                      >
                        {admin.role === "SuperAdmin" && (
                          <ShieldAlert className="h-3 w-3" />
                        )}
                        {admin.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {format(new Date(admin.createdAt), "d MMM yyyy", {
                        locale: es,
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-800">
                        Editar
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
