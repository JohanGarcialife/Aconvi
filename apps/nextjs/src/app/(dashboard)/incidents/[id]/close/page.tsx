"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { CheckCircle2, Copy, Check, ArrowLeft, ClipboardCheck } from "lucide-react";

const TENANT_ID = "org_aconvi_demo";

export default function CloseIncidentPage() {
  const trpc = useTRPC();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [confirmed, setConfirmed] = useState(false);
  const [ibanCopied, setIbanCopied] = useState(false);

  const { data: incident, isLoading } = useQuery(
    trpc.incident.byId.queryOptions({ id, tenantId: TENANT_ID })
  );

  const closeIncident = useMutation(
    trpc.incident.closeIncident.mutationOptions({
      onSuccess: () => {
        router.push("/incidents");
      },
    })
  );

  const handleCopyIban = () => {
    const iban = (incident as any)?.provider?.iban;
    if (!iban) return;
    void navigator.clipboard.writeText(iban);
    setIbanCopied(true);
    setTimeout(() => setIbanCopied(false), 2000);
  };

  const handleClose = async () => {
    if (!confirmed || !incident) return;
    // @ts-ignore
    await closeIncident.mutateAsync({ tenantId: TENANT_ID, id });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400">
        Incidencia no encontrada
      </div>
    );
  }

  const provider = (incident as any).provider;
  const estimatedCost = (incident as any).estimatedCost ?? 0;
  const finalPhotoUrl = (incident as any).finalPhotoUrl;
  const createdAt = new Date(incident.createdAt);
  const elapsed = (() => {
    const diff = Date.now() - createdAt.getTime();
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    return days > 0 ? `${days} días, ${hours}h` : `${hours} horas`;
  })();

  // Approximate cost breakdown from total
  const desp = Math.round(estimatedCost * 0.17);
  const mano = Math.round(estimatedCost * 0.53);
  const mats = estimatedCost - desp - mano;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
        <button
          onClick={() => router.push("/incidents")}
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={16} />
          Gestión de Incidencias
        </button>
        <div className="flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1">
          <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Pendiente de validación</span>
        </div>
        <div className="w-40" />
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Title */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Incidencia: {incident.title}</h1>
            <p className="text-sm text-slate-500">Incidencia finalizada por el proveedor.</p>
          </div>
          <button
            onClick={() => router.push("/incidents")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            + Nueva incidencia
          </button>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* ── Left column ── */}
          <div className="col-span-2 space-y-5">
            {/* Provider info bar */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Proveedor</p>
                  <p className="font-semibold text-slate-800">{provider?.name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Técnico</p>
                  <p className="font-semibold text-slate-800">
                    {provider?.name ?? "—"} · {createdAt.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Nº Incidencia</p>
                  <p className="font-semibold text-slate-800">INC-{id.slice(0, 8).toUpperCase()}</p>
                </div>
              </div>
            </div>

            {/* Objeto de la intervención */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                <ClipboardCheck size={15} className="text-teal-500" />
                Objeto de la intervención
              </h2>
              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex gap-2">
                  <span className="font-medium text-slate-800 shrink-0">Incidencia reportada:</span>
                  <span>{incident.description}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium text-slate-800 shrink-0">Categoría:</span>
                  <span className="capitalize">{(incident as any).category ?? "—"}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium text-slate-800 shrink-0">Reportado por:</span>
                  <span>
                    {(incident as any).reporter?.name ?? "Vecino"} · {createdAt.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium text-slate-800 shrink-0">Tiempo total:</span>
                  <span>{elapsed}</span>
                </div>
              </div>
            </div>

            {/* Certificación económica */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-bold text-slate-800">Certificación económica del servicio</h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-600">Desplazamiento</span>
                  <span className="font-semibold text-slate-800">{desp},00 €</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-600">Mano de obra</span>
                  <span className="font-semibold text-slate-800">{mano},00 €</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-600">Materiales</span>
                  <span className="font-semibold text-slate-800">{mats},00 €</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="font-bold text-slate-900">Total</span>
                  <span className="text-lg font-extrabold text-slate-900">{estimatedCost},00 €</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                Este registro sirve como justificante del trabajo realizado. El pago se gestiona externamente por la administración.
              </p>
            </div>

            {/* IBAN */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                🏦 Copiar IBAN del proveedor
              </h2>
              {provider?.iban ? (
                <div>
                  <p className="font-mono text-lg font-bold tracking-widest text-slate-900">{provider.iban}</p>
                  <p className="mt-1 text-xs text-slate-400">Titular: {provider.name}</p>
                </div>
              ) : (
                <p className="text-sm italic text-slate-400">El proveedor no tiene IBAN registrado.</p>
              )}
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="space-y-5">
            {/* Final photo */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                Solución
              </p>
              <div className="relative">
                {finalPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={finalPhotoUrl} alt="Foto cierre" className="h-52 w-full object-cover" />
                ) : (
                  <div className="flex h-52 items-center justify-center bg-slate-100 text-xs text-slate-400">
                    Sin foto de cierre
                  </div>
                )}
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 shadow">
                  <div className="h-2 w-2 rounded-full bg-white" />
                  <span className="text-xs font-bold text-white">Reparado</span>
                </div>
              </div>
              <p className="px-4 py-2 text-xs text-slate-400">
                ✅ Trabajo marcado como completado por el proveedor
              </p>
            </div>

            {/* Action buttons */}
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <button
                onClick={handleClose}
                disabled={!confirmed || closeIncident.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-teal-600 disabled:opacity-40 transition-colors"
              >
                {closeIncident.isPending ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Cerrando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    Validar trabajo y cerrar expediente
                  </>
                )}
              </button>

              {provider?.iban && (
                <button
                  onClick={handleCopyIban}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {ibanCopied ? (
                    <><Check size={14} className="text-emerald-500" /> ¡IBAN copiado!</>
                  ) : (
                    <><Copy size={14} /> Copiar IBAN del proveedor</>
                  )}
                </button>
              )}

              {provider?.iban && (
                <p className="text-center text-xs text-slate-400">
                  Utiliza este IBAN para realizar la transferencia por el importe certificado.
                </p>
              )}
            </div>

            {/* Certificación del Administrador */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-1 text-sm font-bold text-slate-800">Certificación del Administrador</h3>
              <p className="mb-3 text-xs text-slate-500">Al validar, certificas que:</p>
              <div className="space-y-2.5">
                {[
                  "El trabajo ha sido revisado",
                  "La solución es conforme",
                  "El coste es correcto según lo acordado",
                  "El expediente quedará cerrado y archivado",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                      <Check size={11} strokeWidth={3} className="text-emerald-600" />
                    </div>
                    <span className="text-sm text-slate-700">{item}</span>
                  </div>
                ))}
              </div>

              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 p-3">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={e => setConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-teal-500"
                />
                <span className="text-xs leading-relaxed text-slate-700">
                  Confirmo que he revisado la incidencia y apruebo su cierre.{" "}
                  <span className="font-semibold text-teal-700">
                    El vecino recibirá una notificación para valorar el servicio.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
