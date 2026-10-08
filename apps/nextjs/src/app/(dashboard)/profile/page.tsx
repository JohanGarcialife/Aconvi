"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Award,
  Bell,
  Building2,
  Check,
  FileText,
  Lock,
  LogOut,
  Mail,
  Phone,
  Save,
  Shield,
  User,
} from "lucide-react";

import { authClient } from "~/auth/client";

export default function ProfilePage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const [name, setName] = useState(
    session?.user?.name || "María Jiménez López",
  );
  const [email, setEmail] = useState(session?.user?.email || "af@aconvi.es");
  const [phone, setPhone] = useState("+34 612 345 678");
  const [despacho, setDespacho] = useState(
    "Jiménez & Asociados Administración de Fincas",
  );
  const [colegiado, setColegiado] = useState(
    "CAF-48291 (Colegio Territorial de Valencia)",
  );
  const [cif, setCif] = useState("B-98765432");
  const [address, setAddress] = useState(
    "Gran Vía Marqués del Turia, 48, 4º B, 46005 Valencia",
  );

  const [toast, setToast] = useState<string | null>(null);

  const userInitials = useMemo(() => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || "MJ";
  }, [name]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setToast("Perfil actualizado correctamente");
    setTimeout(() => setToast(null), 3500);
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Toast feedback */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-[#008075] shadow-lg">
          <Check className="h-4 w-4" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/incidents"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
              title="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Mi Perfil
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Gestiona tus datos personales, despacho profesional y preferencias
            de la plataforma Aconvi.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-2 self-start rounded-lg border border-red-200 bg-red-50/60 px-3.5 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 sm:self-auto"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Cerrar sesión</span>
        </button>
      </div>

      {/* Main card with profile summary */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-6 text-white sm:px-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-white/20 bg-[#008075] text-2xl font-bold text-white shadow-inner">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h2 className="text-xl font-bold">{name}</h2>
                <span className="rounded-full border border-teal-400/30 bg-teal-500/20 px-2.5 py-0.5 text-xs font-semibold text-teal-200">
                  AF Colegiado
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-300">{email}</p>
              <p className="mt-0.5 text-xs text-slate-400">{despacho}</p>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 divide-y divide-slate-100 border-b border-slate-100 bg-slate-50/50 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="p-4 text-center">
            <span className="block text-xl font-bold text-slate-900">3</span>
            <span className="text-xs font-medium text-slate-500">
              Comunidades activas
            </span>
          </div>
          <div className="p-4 text-center">
            <span className="block text-xl font-bold text-slate-900">50</span>
            <span className="text-xs font-medium text-slate-500">
              Incidencias gestionadas
            </span>
          </div>
          <div className="p-4 text-center">
            <span className="block text-xl font-bold text-slate-900">100%</span>
            <span className="text-xs font-medium text-slate-500">
              Trazabilidad legal
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="space-y-6 p-6 sm:p-8">
          {/* Section 1: Datos Personales */}
          <div>
            <div className="flex items-center gap-2 pb-3">
              <User className="h-4 w-4 text-[#008075]" />
              <h3 className="text-sm font-bold text-slate-900">
                Información Personal
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 transition-colors outline-none focus:border-[#008075] focus:bg-white focus:ring-1 focus:ring-[#008075]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute top-2.5 left-3 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3.5 pl-9 text-xs text-slate-900 transition-colors outline-none focus:border-[#008075] focus:bg-white focus:ring-1 focus:ring-[#008075]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Teléfono de contacto
                </label>
                <div className="relative">
                  <Phone className="absolute top-2.5 left-3 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3.5 pl-9 text-xs text-slate-900 transition-colors outline-none focus:border-[#008075] focus:bg-white focus:ring-1 focus:ring-[#008075]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Rol en Aconvi
                </label>
                <input
                  type="text"
                  disabled
                  value="Administrador de Fincas (AF)"
                  className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3.5 py-2 text-xs text-slate-500"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Section 2: Despacho Profesional y Colegiación */}
          <div>
            <div className="flex items-center gap-2 pb-3">
              <Award className="h-4 w-4 text-[#008075]" />
              <h3 className="text-sm font-bold text-slate-900">
                Despacho y Colegiación Oficial
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Razón social / Despacho
                </label>
                <input
                  type="text"
                  value={despacho}
                  onChange={(e) => setDespacho(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 transition-colors outline-none focus:border-[#008075] focus:bg-white focus:ring-1 focus:ring-[#008075]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Nº Colegiado y Colegio Oficial
                </label>
                <input
                  type="text"
                  value={colegiado}
                  onChange={(e) => setColegiado(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 transition-colors outline-none focus:border-[#008075] focus:bg-white focus:ring-1 focus:ring-[#008075]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  NIF / CIF del despacho
                </label>
                <input
                  type="text"
                  value={cif}
                  onChange={(e) => setCif(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 transition-colors outline-none focus:border-[#008075] focus:bg-white focus:ring-1 focus:ring-[#008075]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Dirección profesional
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 transition-colors outline-none focus:border-[#008075] focus:bg-white focus:ring-1 focus:ring-[#008075]"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Section 3: Comunidades Asignadas */}
          <div>
            <div className="flex items-center gap-2 pb-3">
              <Building2 className="h-4 w-4 text-[#008075]" />
              <h3 className="text-sm font-bold text-slate-900">
                Comunidades Gestionadas
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Residencial Jardines del Turia
                  </p>
                  <p className="text-[11px] text-slate-500">
                    50 propietarios · Calle Los Sauces, 345
                  </p>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  Activa
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Residencial Los Olivos
                  </p>
                  <p className="text-[11px] text-slate-500">
                    32 propietarios · Av. Mayor, 12
                  </p>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  Activa
                </span>
              </div>
            </div>
          </div>

          {/* Submit button */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <Link
              href="/incidents"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg bg-[#008075] px-5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#006e64]"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Guardar cambios</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
