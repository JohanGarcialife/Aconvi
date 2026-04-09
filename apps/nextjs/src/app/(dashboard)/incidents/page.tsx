"use client";

import { useState } from "react";
import {
  Search,
  MapPin,
  ChevronLeft,
  ChevronDown,
  Check,
  Circle,
  Star,
  Clock,
  Wrench,
  Droplets,
  Layers,
  Send,
} from "lucide-react";

// ─── Mock data (will be replaced by real API data) ──────────────────────────
const MOCK_INCIDENTS = [
  {
    id: "1",
    title: "Gotera en tejado",
    community: "Residencial Los Olivos",
    address: "Av. de Andalucía, 105",
    status: "SIN_ASIGNAR" as const,
    checked: true,
    icon: <Droplets className="h-4 w-4 text-slate-300" />,
  },
  {
    id: "2",
    title: "Piscina turbia",
    community: "Jardines de la Costa",
    address: "Calle del Tura, 26",
    status: "SIN_ASIGNAR" as const,
    checked: true,
    icon: <Layers className="h-4 w-4 text-slate-300" />,
  },
  {
    id: "3",
    title: "Ascensor bloqueado",
    community: "Residencial Colón",
    address: "Av. del Oeste, 33",
    status: "SIN_ASIGNAR" as const,
    checked: false,
    icon: <Wrench className="h-4 w-4 text-slate-300" />,
  },
  {
    id: "4",
    title: "Bajante atascado",
    community: "Edificio Girasol",
    address: "Av. de Francia, 48",
    status: "SIN_ASIGNAR" as const,
    checked: true,
    icon: <Layers className="h-4 w-4 text-slate-300" />,
  },
  {
    id: "5",
    title: "Baja presión de agua",
    community: "Residencial Ajameida",
    address: "Av. de Francia, 46",
    status: "ACEPTADA" as const,
    checked: false,
    icon: <Droplets className="h-4 w-4 text-slate-300" />,
  },
  {
    id: "6",
    title: "Edificio Girasol",
    community: "Jardines de la Costa",
    address: "Calle del Tura, 26",
    status: "RESUELTA" as const,
    checked: false,
    icon: <Wrench className="h-4 w-4 text-slate-300" />,
  },
  {
    id: "7",
    title: "Luces del garaje fundidas",
    community: "Edificio Girasol",
    address: "Av. de Francia, 48",
    status: "RESUELTA" as const,
    checked: false,
    icon: <Wrench className="h-4 w-4 text-slate-300" />,
  },
];

const MOCK_PROVIDERS = [
  {
    id: "p1",
    name: "Fontanería Pérez",
    note: "Historial positivo en incidencias similares",
    recommended: true,
  },
  { id: "p2", name: "Fontanería Gómez", note: "8 incidencias resueltas" },
  { id: "p3", name: "Fontanería García", note: "5 incidencias resueltas" },
];

// ─── Status badge ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === "SIN_ASIGNAR")
    return (
      <span className="text-xs text-slate-500 border border-slate-200 rounded-full px-2.5 py-0.5 whitespace-nowrap">
        Sin asignar
      </span>
    );
  if (status === "ACEPTADA")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 whitespace-nowrap">
        Aceptada <ChevronDown className="h-3 w-3" />
      </span>
    );
  if (status === "RESUELTA")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5 whitespace-nowrap">
        Resuelta <ChevronDown className="h-3 w-3" />
      </span>
    );
  return null;
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function IncidentsPage() {
  const [incidents, setIncidents] = useState(MOCK_INCIDENTS);
  const [selectedId, setSelectedId] = useState("1");
  const [selectedProvider, setSelectedProvider] = useState("p1");
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);

  const selected = incidents.find((i) => i.id === selectedId) ?? incidents[0];
  const checkedCount = incidents.filter((i) => i.checked).length;

  const toggleCheck = (id: string) =>
    setIncidents((prev) =>
      prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i))
    );

  const currentProvider =
    MOCK_PROVIDERS.find((p) => p.id === selectedProvider) ?? MOCK_PROVIDERS[0]!;

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 shrink-0">
        <h1 className="text-xl font-bold text-slate-900">Incidencias</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500 w-72">
            <Search className="h-4 w-4 shrink-0" />
            <span>Buscar comunidad, avería, vecino…</span>
          </div>
          <div className="h-9 w-9 rounded-full bg-slate-300 overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-white">
            AF
          </div>
        </div>
      </header>

      {/* ── Body: List + Detail ─────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Incident list ─────────────────────────────────────────────── */}
        <div className="flex w-[320px] shrink-0 flex-col border-r border-slate-200 bg-white overflow-hidden">
          {/* Bulk action bar */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50">
            <button className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
              <ChevronLeft className="h-4 w-4" />
              <span className="font-medium">{checkedCount} seleccionadas</span>
            </button>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors">
                Asignar
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button className="flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-sm text-slate-500 hover:bg-slate-100">
                —
              </button>
            </div>
          </div>

          {/* List */}
          <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {incidents.map((incident) => (
              <li
                key={incident.id}
                className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors ${
                  selectedId === incident.id
                    ? "bg-slate-50"
                    : "hover:bg-slate-50"
                }`}
                onClick={() => setSelectedId(incident.id)}
              >
                {/* Checkbox */}
                <button
                  className="mt-0.5 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCheck(incident.id);
                  }}
                >
                  <div
                    className={`h-4.5 w-4.5 rounded flex items-center justify-center border-2 transition-colors ${
                      incident.checked
                        ? "bg-primary border-primary"
                        : "border-slate-300 bg-white"
                    }`}
                    style={{ width: "18px", height: "18px" }}
                  >
                    {incident.checked && (
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    )}
                  </div>
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-sm text-slate-900 leading-tight">
                      {incident.title}
                    </span>
                    <StatusBadge status={incident.status} />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                    {incident.community}
                    <br />
                    {incident.address}
                  </p>
                </div>

                {/* Icon */}
                <div className="mt-0.5 shrink-0">{incident.icon}</div>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Incident detail panel ────────────────────────────────────── */}
        {selected && (
          <div className="flex-1 overflow-y-auto bg-white px-8 py-6">
            {/* Title */}
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-slate-900 mb-1">
                {selected.title}
              </h2>
              <p className="flex items-center gap-1.5 text-sm text-slate-500">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {selected.community} · {selected.address}
              </p>
            </div>

            {/* Photo */}
            <div className="mb-5 rounded-2xl overflow-hidden bg-slate-100 aspect-video w-full max-w-xl">
              <div className="w-full h-full bg-linear-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-400 text-sm">
                Foto de la incidencia
              </div>
            </div>

            {/* Provider selector */}
            <div className="mb-6 max-w-xl">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </div>
                <span className="font-semibold text-slate-900">Proveedor</span>
              </div>

              {/* Dropdown trigger */}
              <button
                onClick={() => setProviderDropdownOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border-2 border-primary px-4 py-3 text-sm font-semibold text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  </div>
                  {currentProvider?.name}
                </div>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${providerDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Dropdown list */}
              {providerDropdownOpen && (
                <div className="mt-1 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  {MOCK_PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedProvider(p.id);
                        setProviderDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div
                        className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          selectedProvider === p.id
                            ? "border-primary bg-primary"
                            : "border-slate-300"
                        }`}
                      >
                        {selectedProvider === p.id && (
                          <Check
                            className="h-3 w-3 text-white"
                            strokeWidth={3}
                          />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-slate-900">
                          {p.name}
                        </p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          {p.recommended && (
                            <Check className="h-3 w-3 text-primary" />
                          )}
                          {p.note}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Description / timestamp */}
              <div className="mt-4 text-sm text-slate-600">
                <p>Se ha producido una gotera grande en el techo del ático.</p>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Mar 11, 10:24 CEST
                </p>
              </div>
            </div>

            {/* CTA */}
            <div className="max-w-xl">
              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white hover:bg-primary/90 transition-colors shadow-sm">
                <Send className="h-4 w-4" />
                Asignar y Notificar Vecino
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
