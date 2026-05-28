"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import {
  Search,
  CheckCircle2,
  Building2,
  Plus,
  Landmark,
  Star,
  Bell,
  ArrowLeft,
  Loader2,
} from "lucide-react";

const TENANT_ID = "org_aconvi_demo";

type PageState = "pending" | "validating" | "closed";

// ─── Copy helper ─────────────────────────────────────────────────────────────
function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text);
}

// ─── "Closed" confirmation screen ────────────────────────────────────────────
function ClosedScreen({ incidentTitle }: { incidentTitle: string }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50">
      <div className="max-w-md w-full text-center px-8 py-12">
        {/* Success icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>

        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Expediente cerrado
        </h2>
        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
          La incidencia ha sido validada y archivada correctamente.{" "}
          <span className="font-semibold text-slate-700">
            El vecino ha recibido una notificación push
          </span>{" "}
          para valorar el servicio.
        </p>

        {/* Notification preview card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm mb-8">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900">
                Aconvi · Enviado ahora
              </p>
              <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                Tu incidencia "{incidentTitle}" ha sido resuelta.
                ¿Cómo valorarías el servicio?
              </p>
              <div className="flex gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`h-4 w-4 ${s <= 4 ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <Link
          href="/incidents"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-primary/90 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a incidencias
        </Link>
      </div>
    </div>
  );
}

// ─── Inner validate screen content ───────────────────────────────────────────
function ValidateContent() {
  const trpc = useTRPC();
  const searchParams = useSearchParams();
  const incidentId = searchParams ? searchParams.get("id") : null;

  const [confirmed, setConfirmed] = useState(false);
  const [pageState, setPageState] = useState<PageState>("pending");
  const [copied, setCopied] = useState(false);

  const { data: incident, isLoading } = useQuery(
    trpc.incident.byId.queryOptions(
      { id: incidentId as string, tenantId: TENANT_ID },
      { enabled: !!incidentId }
    )
  );

  const addNote = useMutation(
    trpc.incident.addNote.mutationOptions()
  );

  const handleCopyIBAN = () => {
    copyToClipboard("ES9121000418450200051339");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleValidate = async () => {
    if (!confirmed || !incident) return;
    setPageState("validating");

    try {
      // 1. Add internal note to close the folder
      await addNote.mutateAsync({
        tenantId: TENANT_ID,
        incidentId: incident.id,
        content: "✅ El administrador ha validado el trabajo y cerrado el expediente.",
      });

      // 2. Dispatch WebSocket push notification to vecino
      const ws = new WebSocket(
        process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001"
      );
      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            event: "rating-request",
            payload: {
              incidentId: incident.id,
              tenantId: TENANT_ID,
              message: `Tu incidencia "${incident.title}" ha sido resuelta. ¿Cómo valorarías el servicio?`,
            },
          })
        );
        ws.close();
      };
    } catch (e) {
      console.error(e);
    }

    setPageState("closed");
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 gap-4">
        <h2 className="text-xl font-bold text-slate-800">Incidencia no encontrada</h2>
        <Link href="/incidents" className="text-primary font-semibold hover:underline">
          Volver a incidencias
        </Link>
      </div>
    );
  }

  if (pageState === "closed") {
    return (
      <div className="flex h-screen flex-col bg-slate-50">
        <TopBar />
        <ClosedScreen incidentTitle={incident.title} />
      </div>
    );
  }

  // Cost breakdown calculation
  const total = incident.estimatedCost ?? 150;
  const desplazamiento = total > 50 ? 25 : 0;
  const materiales = parseFloat(((total - desplazamiento) * 0.3).toFixed(2));
  const manoDeObra = parseFloat((total - desplazamiento - materiales).toFixed(2));

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <TopBar />

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-6">
          {/* Header row */}
          <div className="mb-5 flex items-start justify-between">
            <div>
              <span className="mb-3 inline-block rounded border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                Pendiente de validación
              </span>
              <h2 className="text-2xl font-bold text-slate-900">
                Incidencia: {incident.title}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Incidencia finalizada por el proveedor.
              </p>
            </div>
            <Link
              href="/incidents"
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              Volver a la lista
            </Link>
          </div>

          {/* 2-col grid */}
          <div className="grid grid-cols-2 gap-6">
            {/* ── LEFT ───────────────────────────────────────────── */}
            <div className="space-y-4">
              {/* Metadata */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
                  <dt className="font-semibold text-slate-900">Proveedor:</dt>
                  <dd className="text-slate-700">{incident.provider?.name ?? "Sin asignar"}</dd>

                  <dt className="font-semibold text-slate-900">Contacto:</dt>
                  <dd className="text-slate-700">
                    {incident.provider?.phone ?? "No disponible"} · {incident.provider?.email ?? ""}
                  </dd>

                  <dt className="font-semibold text-slate-900">
                    Nº Incidencia:
                  </dt>
                  <dd className="text-slate-700">
                    {`INC-${incident.id.slice(0, 8).toUpperCase()}`} · Residencial Los Olivos
                  </dd>
                </dl>
              </div>

              {/* Object of intervention */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  Objeto de la intervención
                </h3>
                <div className="space-y-1.5 text-sm text-slate-700">
                  <p>
                    <span className="font-semibold">
                      Incidencia reportada:
                    </span>{" "}
                    {incident.description}
                  </p>
                  <p>
                    <span className="font-semibold">Ubicación:</span> Residencial Los Olivos
                  </p>
                  <p>
                    <span className="font-semibold">Reportado por:</span> {incident.reporter?.name ?? "Vecino"}{" "}
                    · {new Date(incident.createdAt).toLocaleDateString("es-ES")}
                  </p>
                </div>
              </div>

              {/* Cost breakdown */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="mb-4 font-semibold text-slate-900">
                  Certificación económica del servicio
                </h3>
                <div className="space-y-2 text-sm">
                  {[
                    ["Desplazamiento", `${desplazamiento.toFixed(2).replace(".", ",")} €`],
                    ["Mano de obra", `${manoDeObra.toFixed(2).replace(".", ",")} €`],
                    ["Materiales", `${materiales.toFixed(2).replace(".", ",")} €`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between text-slate-700">
                      <span>{label}</span>
                      <span>{value}</span>
                    </div>
                  ))}
                  <div className="my-2 h-px bg-slate-200" />
                  <div className="flex justify-between font-bold text-slate-900">
                    <span>Total</span>
                    <span>{total.toFixed(2).replace(".", ",")} €</span>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-snug text-slate-400">
                  Este registro servirá como justificante del trabajo realizado.
                  El pago se gestiona externamente por la administración.
                </p>
              </div>

              {/* IBAN */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Landmark className="h-4 w-4 text-slate-400" />
                  Copiar IBAN del proveedor
                </div>
                <p className="font-mono text-sm tracking-wide text-slate-900">
                  ES91 2100 0418 <span className="font-bold">4502 0005 1339</span>
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Titular: {incident.provider?.name ?? "Fontanería Pérez SL"}
                </p>
              </div>
            </div>

            {/* ── RIGHT ──────────────────────────────────────────── */}
            <div className="space-y-4">
              {/* Solution photo */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="mb-3 font-semibold text-slate-900">Solución</h3>
                <div className="relative mb-3 aspect-video w-full overflow-hidden rounded-xl bg-slate-100 flex items-center justify-center">
                  {incident.finalPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={incident.finalPhotoUrl} alt="Solución" className="h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-linear-to-br from-slate-700 to-slate-900 flex items-end">
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            "linear-gradient(135deg, #334155 0%, #1e293b 50%, #0f172a 100%)",
                          opacity: 0.85,
                        }}
                      />
                      <div className="relative z-10 m-3 flex items-center gap-1.5 rounded-full bg-primary/90 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Reparado (Sin foto de cierre)
                      </div>
                    </div>
                  )}
                </div>
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  Trabajo marcado como completado por el proveedor
                </p>
              </div>

              {/* Neighbor rating (if rated) */}
              {incident.rating != null && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
                  <h3 className="mb-3 font-semibold text-slate-900">Valoración del Vecino</h3>
                  <div className="flex items-center gap-1.5 mb-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-5 w-5 ${s <= incident.rating! ? "fill-amber-500 text-amber-500" : "text-slate-200"}`}
                      />
                    ))}
                    <span className="ml-2 text-sm font-bold text-slate-800">{incident.rating} / 5</span>
                  </div>
                  {incident.ratingComment && (
                    <p className="text-sm italic text-slate-700">"{incident.ratingComment}"</p>
                  )}
                </div>
              )}

              {/* CTA block */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                {/* Final confirmation checkbox inside CTA block for immediate visibility */}
                <div className="pb-3 border-b border-slate-100">
                  <label
                    onClick={() => setConfirmed((v) => !v)}
                    className="flex cursor-pointer items-start gap-3 select-none"
                  >
                    <div
                      className={`mt-0.5 h-4 w-4 shrink-0 rounded border-2 transition-all flex items-center justify-center ${
                        confirmed
                          ? "border-primary bg-primary"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {confirmed && (
                        <svg
                          viewBox="0 0 12 12"
                          className="h-3 w-3 fill-white"
                        >
                          <path d="M1.5 6l3 3 6-6" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs text-slate-600 leading-snug">
                      Confirmo que he revisado la incidencia y apruebo su cierre.{" "}
                      <span className="text-primary font-medium">
                        El vecino recibirá una notificación para valorar el servicio.
                      </span>
                    </span>
                  </label>
                </div>

                <button
                  onClick={handleValidate}
                  disabled={!confirmed || pageState === "validating"}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold text-white transition-all shadow-sm ${
                    confirmed && pageState === "pending"
                      ? "bg-primary hover:bg-primary/90 cursor-pointer"
                      : "bg-primary/40 cursor-not-allowed"
                  }`}
                >
                  {pageState === "validating" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {pageState === "validating"
                    ? "Cerrando expediente…"
                    : "Validar trabajo y cerrar expediente"}
                </button>

                <button
                  onClick={handleCopyIBAN}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <Landmark className="h-4 w-4 text-slate-400" />
                  )}
                  {copied ? "¡IBAN copiado!" : "Copiar IBAN del proveedor"}
                </button>

                <p className="text-center text-xs text-slate-400">
                  Utiliza este IBAN para realizar la transferencia por el
                  importe certificado.
                </p>
              </div>

              {/* Certification checklist */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="mb-1 font-semibold text-slate-900">
                  Certificación del Administrador
                </h3>
                <p className="mb-4 text-xs text-slate-500">
                  Al validar, certificas que:
                </p>
                <ul className="space-y-2.5 text-sm text-slate-700">
                  {[
                    "El trabajo ha sido revisado",
                    "La solución es conforme",
                    "El coste es correcto según lo acordado",
                    "El expediente quedará cerrado y archivado.",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared top bar ───────────────────────────────────────────────────────────
function TopBar() {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-3">
        <Link
          href="/incidents"
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold text-slate-900">
          Gestión de Incidencias
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex w-72 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500">
          <Search className="h-4 w-4 shrink-0" />
          <span>Buscar comunidad, avería o vecino…</span>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-600 text-xs font-bold text-white">
          AF
        </div>
      </div>
    </header>
  );
}

// ─── Main export with Suspense ───────────────────────────────────────────────
export default function IncidentValidatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ValidateContent />
    </Suspense>
  );
}
