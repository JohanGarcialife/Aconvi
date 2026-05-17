"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { Check, Star, Briefcase, Clock, Search, Plus, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import Link from "next/link";

const TENANT_ID = "org_aconvi_demo";

type Status = "RECIBIDA" | "EN_REVISION" | "AGENDADA" | "EN_CURSO" | "RESUELTA" | "RECHAZADA";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  RECIBIDA:    { label: "Sin asignar",  cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  EN_REVISION: { label: "En revisión",  cls: "bg-blue-50 text-blue-700 border border-blue-200" },
  AGENDADA:    { label: "Agendada",     cls: "bg-violet-50 text-violet-700 border border-violet-200" },
  EN_CURSO:    { label: "En curso",     cls: "bg-cyan-50 text-cyan-700 border border-cyan-200" },
  RESUELTA:    { label: "Resuelta",     cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  RECHAZADA:   { label: "No procede",   cls: "bg-red-50 text-red-700 border border-red-200" },
};

const PRIORITY_COLOR: Record<string, string> = {
  URGENTE: "bg-red-500",
  ALTA: "bg-orange-400",
  MEDIA: "bg-blue-400",
  BAJA: "bg-slate-300",
};

const STEPS = ["RECIBIDA", "EN_REVISION", "AGENDADA", "EN_CURSO", "RESUELTA"];

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, cls: "bg-slate-100 text-slate-600" };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

function Timeline({ status }: { status: string }) {
  const idx = STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-0 my-5">
      {STEPS.map((step, i) => {
        const done = idx > i;
        const active = idx === i;
        const label = STATUS_LABEL[step]?.label ?? step;
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                ${done ? "bg-teal-500 border-teal-500 text-white" : active ? "border-teal-500 text-teal-600 bg-white" : "border-slate-200 text-slate-400 bg-slate-50"}`}>
                {done ? <Check size={13} strokeWidth={3} /> : i + 1}
              </div>
              <span className={`text-[10px] whitespace-nowrap ${done || active ? "text-slate-800 font-semibold" : "text-slate-400"}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mb-4 mx-1 ${done ? "bg-teal-500" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function IncidentsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [providerOpen, setProviderOpen] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [noteText, setNoteText] = useState("");

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const { data: incidentsRaw, refetch } = useQuery(trpc.incident.all.queryOptions({ tenantId: TENANT_ID }));
  const { data: providersRaw } = useQuery(trpc.provider.listByOrg.queryOptions({ tenantId: TENANT_ID }));
  const incidents = (incidentsRaw ?? []) as any[];
  const providers = (providersRaw ?? []) as any[];

  const assignProvider = useMutation(
    trpc.incident.assignProvider.mutationOptions({ onSuccess: () => { refetch().catch(() => null); } })
  );
  const updateStatus = useMutation(
    trpc.incident.updateStatus.mutationOptions({ onSuccess: () => { refetch().catch(() => null); } })
  );
  const rejectMut = useMutation(
    trpc.incident.reject.mutationOptions({ onSuccess: () => { refetch().catch(() => null); } })
  );
  const addNote = useMutation(
    trpc.incident.addNote.mutationOptions({ onSuccess: () => { refetch().catch(() => null); } })
  );

  const filtered = incidents.filter((i: any) => filterStatus === "ALL" || i.status === filterStatus);
  const selected = incidents.find((i: any) => i.id === selectedId) ?? null;
  const selectedProvider = providers.find((p: any) => p.id === selectedProviderId) ?? providers[0] ?? null;

  const toggleCheck = (id: string) => {
    setChecked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleAssign = async () => {
    if (!selected || !selectedProvider) return;
    try {
      // @ts-ignore – tRPC mutateAsync types lag
      await assignProvider.mutateAsync({ tenantId: TENANT_ID, id: selected.id, providerId: selectedProvider.id });
      showToast("✅ Proveedor asignado y vecino notificado");
    } catch { showToast("❌ Error al asignar", false); }
  };

  const handleBulkAssign = async () => {
    if (!selectedProvider || checked.size === 0) return;
    const count = checked.size;
    try {
      // @ts-ignore – tRPC mutateAsync types lag
      await Promise.all([...checked].map((id: string) => assignProvider.mutateAsync({ tenantId: TENANT_ID, id, providerId: selectedProvider.id })));
      setChecked(new Set());
      showToast(`✅ ${count} incidencias asignadas`);
    } catch { showToast("❌ Error en asignación múltiple", false); }
  };

  const handleReject = async () => {
    if (!selected) return;
    try {
      // @ts-ignore – tRPC mutateAsync types lag
      await rejectMut.mutateAsync({ tenantId: TENANT_ID, id: selected.id });
      showToast("Incidencia marcada como no procede");
    } catch { showToast("❌ Error", false); }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !noteText.trim()) return;
    // @ts-ignore – tRPC mutateAsync types lag
    await addNote.mutateAsync({ tenantId: TENANT_ID, incidentId: selected.id, content: noteText.trim() });
    setNoteText("");
  };

  const FILTERS = [
    { key: "ALL", label: "Todas" },
    { key: "RECIBIDA", label: "Pendientes" },
    { key: "EN_REVISION", label: "En revisión" },
    { key: "EN_CURSO", label: "En curso" },
    { key: "RESUELTA", label: "Resueltas" },
  ];

  return (
    <div className="flex h-screen flex-col bg-slate-50 -m-4 md:-m-8 overflow-hidden">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all
          ${toast.ok ? "bg-slate-900" : "bg-red-600"}`}>
          {toast.msg}
        </div>
      )}

      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <h1 className="text-xl font-bold text-slate-900">Incidencias</h1>
        <div className="flex items-center gap-3">
          <div className="flex w-72 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-400">
            <Search size={15} />
            <span>Buscar comunidad, avería, vecino...</span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">JL</div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Column 1: List */}
        <div className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
          {/* Bulk action bar */}
          {checked.size > 0 ? (
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <button onClick={() => setChecked(new Set())} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
                <span className="text-slate-400">‹</span> {checked.size} seleccionadas
              </button>
              <div className="flex items-center gap-2">
                <button onClick={handleBulkAssign} className="rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-600">Asignar</button>
                <button className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50">—</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-4 py-3">
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => setFilterStatus(f.key)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors
                    ${filterStatus === f.key ? "bg-teal-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {/* Incident list */}
          <ul className="flex-1 overflow-y-auto">
            {filtered.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-slate-400">Sin incidencias</li>
            )}
            {filtered.map((inc: any) => (
              <li key={inc.id}
                onClick={() => { setSelectedId(inc.id); setProviderOpen(false); }}
                className={`flex cursor-pointer items-start gap-3 border-b border-slate-100 px-4 py-3.5 transition-colors hover:bg-slate-50
                  ${selectedId === inc.id ? "border-l-2 border-l-teal-500 bg-teal-50/40" : "border-l-2 border-l-transparent"}`}>
                {/* Checkbox */}
                <div onClick={e => { e.stopPropagation(); toggleCheck(inc.id); }}
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-all
                    ${checked.has(inc.id) ? "border-teal-500 bg-teal-500" : "border-slate-300 bg-white"}`}>
                  {checked.has(inc.id) && <Check size={10} strokeWidth={3} className="text-white" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${PRIORITY_COLOR[inc.priority] ?? "bg-slate-300"}`} />
                      <p className="truncate text-sm font-semibold text-slate-900">{inc.title}</p>
                    </div>
                    <StatusBadge status={inc.status} />
                  </div>
                  {(inc as any).category && (
                    <span className="ml-3.5 mt-1 inline-block rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold capitalize text-indigo-600">
                      {(inc as any).category}
                    </span>
                  )}
                  <p className="ml-3.5 mt-0.5 text-xs text-slate-400">{inc.reporter?.name ?? "Vecino"}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Column 2: Detail */}
        {selected ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-8 py-6">

              {/* Header */}
              <div className="mb-1 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{selected.title}</h2>
                  <p className="mt-0.5 text-sm text-slate-400">Residencial Los Olivos · Av. de Andalucía, 105</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={selected.status} />
                  {selected.status === "RESUELTA" && (
                    <Link href={`/incidents/validate?id=${selected.id}`}
                      className="flex items-center gap-1 rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-600">
                      Validar <ArrowRight size={12} />
                    </Link>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <Timeline status={selected.status} />

              {/* Category */}
              {(selected as any).category && (
                <span className="mb-4 inline-block rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold capitalize text-indigo-600">
                  📂 {(selected as any).category}
                </span>
              )}

              {/* Photo */}
              <div className="mb-6 aspect-video max-w-lg overflow-hidden rounded-2xl bg-slate-100">
                {selected.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected.photoUrl} alt="Incidencia" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">Sin fotografía</div>
                )}
              </div>

              {/* Final photo (resolved) */}
              {selected.status === "RESUELTA" && (selected as any).finalPhotoUrl && (
                <div className="mb-6 max-w-lg">
                  <h3 className="mb-2 text-sm font-bold text-slate-800">✅ Foto de cierre (proveedor)</h3>
                  <div className="overflow-hidden rounded-2xl border-2 border-emerald-200 bg-emerald-50 aspect-video">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={(selected as any).finalPhotoUrl} alt="Foto final" className="h-full w-full object-cover" />
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="mb-6">
                <h3 className="mb-2 text-sm font-bold text-slate-800">Descripción</h3>
                <p className="text-sm leading-relaxed text-slate-600">{selected.description}</p>
              </div>

              {/* Notes */}
              <div className="mb-6">
                <h3 className="mb-3 text-sm font-bold text-slate-800">Notas internas</h3>
                <div className="space-y-2">
                  {(selected.notes ?? []).map((n: any) => (
                    <div key={n.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-medium text-slate-800">{n.content}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {n.author?.name ?? "AF"} · {new Date(n.createdAt).toLocaleDateString("es-ES")}
                      </p>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddNote} className="mt-3 flex gap-2">
                  <input value={noteText} onChange={e => setNoteText(e.target.value)}
                    placeholder="Añadir nota interna..."
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400" />
                  <button type="submit" disabled={!noteText.trim() || addNote.isPending}
                    className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-40">
                    <Plus size={15} />
                  </button>
                </form>
              </div>

              {/* Activity history */}
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Historial de actividad</h3>
                <div className="relative space-y-4 pl-5">
                  {(selected.history ?? []).length > 1 && (
                    <div className="absolute left-2 top-2 bottom-4 w-0.5 bg-slate-200" />
                  )}
                  {(selected.history ?? []).map((h: any) => (
                    <div key={h.id} className="relative flex gap-3">
                      <div className={`absolute -left-3 top-1 h-3 w-3 rounded-full border-2 border-white z-10
                        ${h.action === "CREATED" ? "bg-blue-500" : h.action === "ASSIGNED" ? "bg-violet-500" : h.action === "COMPLETED" ? "bg-emerald-500" : "bg-teal-500"}`} />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {h.actorName}{" "}
                          <span className="font-normal text-slate-500">
                            {h.action === "CREATED" ? "reportó la incidencia" : `→ ${h.newStatus}`}
                          </span>
                        </p>
                        {h.comment && (
                          <p className="mt-1 inline-block rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">{h.comment}</p>
                        )}
                        <p className="mt-0.5 text-xs text-slate-400">
                          {new Date(h.createdAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Action bar */}
            <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-8 py-4">
              <div className="flex gap-3">
                <button onClick={handleReject} disabled={selected.status === "RECHAZADA"}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                  <XCircle size={15} /> No procede
                </button>
                <button onClick={() => {
                    // @ts-ignore – tRPC mutateAsync types lag
                    void updateStatus.mutateAsync({ tenantId: TENANT_ID, id: selected.id, status: "EN_REVISION" as const });
                  }}
                  disabled={selected.status !== "RECIBIDA"}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                  <AlertTriangle size={15} /> En revisión
                </button>
              </div>
              <button onClick={handleAssign} disabled={!selectedProvider || assignProvider.isPending}
                className="flex items-center gap-2 rounded-xl bg-teal-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-teal-600 disabled:opacity-40 transition-colors shadow-sm">
                <CheckCircle2 size={15} />
                {assignProvider.isPending ? "Asignando..." : "Asignar y Notificar Vecino"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-slate-400 text-sm">
            Selecciona una incidencia
          </div>
        )}

        {/* Column 3: Provider panel */}
        {selected && (
          <div className="flex w-72 shrink-0 flex-col border-l border-slate-200 bg-white overflow-y-auto">
            <div className="p-5">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Proveedor</h3>

              {/* Dropdown trigger */}
              <button onClick={() => setProviderOpen(v => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800 transition hover:bg-teal-100">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500 text-white">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  {selectedProvider?.name ?? "Seleccionar proveedor"}
                </div>
                {providerOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>

              {/* Dropdown options */}
              {providerOpen && (
                <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  {providers.map((p: any, i: number) => (
                    <button key={p.id} onClick={() => { setSelectedProviderId(p.id); setProviderOpen(false); }}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50
                        ${i < providers.length - 1 ? "border-b border-slate-100" : ""}`}>
                      <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all
                        ${(selectedProvider?.id === p.id) ? "border-teal-500 bg-teal-500" : "border-slate-300"}`}>
                        {(selectedProvider?.id === p.id) && <Check size={10} strokeWidth={3} className="text-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-400">
                          {p.isTrusted ? "✓ Historial positivo" : `${p.completedJobs} incidencias resueltas`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected provider card */}
              {selectedProvider && !providerOpen && (
                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white">
                      {selectedProvider.avatarInitials ?? "??"}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{selectedProvider.name}</p>
                      <div className="flex items-center gap-1">
                        <Star size={12} fill="#f59e0b" color="#f59e0b" />
                        <span className="text-sm font-bold text-slate-700">{selectedProvider.rating?.toFixed(1)}</span>
                      </div>
                      {selectedProvider.isTrusted && (
                        <p className="text-xs text-teal-600 font-medium">Proveedor de confianza</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Briefcase size={13} className="text-slate-400" />
                      <strong>{selectedProvider.completedJobs}</strong>
                      <span className="text-slate-400">Intervenciones</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={13} className="text-slate-400" />
                      <strong>{selectedProvider.avgDaysToResolve} días</strong>
                      <span className="text-slate-400">Tiempo medio</span>
                    </div>
                    {selectedProvider.priceRangeMin != null && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">€</span>
                        <strong>{selectedProvider.priceRangeMin}€ – {selectedProvider.priceRangeMax}€</strong>
                        <span className="text-slate-400">Coste est.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Assign CTA */}
              <button onClick={handleAssign} disabled={!selectedProvider || assignProvider.isPending}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 py-3 text-sm font-bold text-white hover:bg-teal-600 disabled:opacity-40 transition-colors shadow-sm">
                <CheckCircle2 size={15} />
                {assignProvider.isPending ? "Asignando..." : "Asignar y Notificar Vecino"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
