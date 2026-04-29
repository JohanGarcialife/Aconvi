"use client";

import { UsersRound, ShieldAlert } from "lucide-react";
import { trpc } from "~/utils/trpc";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function SuperAdminAdministratorsPage() {
  const { data: admins, isLoading } = trpc.superadmin.getAdministrators.useQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <UsersRound className="w-6 h-6 text-indigo-500" />
            Directorio de Administradores
          </h1>
          <p className="text-slate-500 mt-1">
            Usuarios con nivel de Administrador de Fincas, Agentes o SuperAdmins.
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
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
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    Cargando directorio...
                  </td>
                </tr>
              ) : admins?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No hay administradores registrados aún.
                  </td>
                </tr>
              ) : (
                admins?.map((admin) => (
                  <tr key={admin.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
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
                        <div className="text-xs text-slate-400 mt-0.5">{admin.phoneNumber}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 border
                        ${
                          admin.role === "SuperAdmin"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : admin.role === "AgenteAconvi"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }
                      `}>
                        {admin.role === "SuperAdmin" && <ShieldAlert className="w-3 h-3" />}
                        {admin.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {format(new Date(admin.createdAt), "d MMM yyyy", { locale: es })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors">
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
