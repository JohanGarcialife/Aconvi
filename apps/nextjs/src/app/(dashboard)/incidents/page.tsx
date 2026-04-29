"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import {
  Search,
  Filter,
  Check,
  Star,
  Clock,
  Briefcase,
  ChevronRight,
  Plus,
  UserRound,
  XCircle,
  CheckCircle2,
} from "lucide-react";

// ─── Tenant (stub — replace with session org) ─────────────────────────────────
const TENANT_ID = "org_aconvi_demo";

// ─── Types ────────────────────────────────────────────────────────────────────
type IncidentStatus =
  | "RECIBIDA"
  | "EN_REVISION"
  | "AGENDADA"
  | "EN_CURSO"
  | "RESUELTA"
  | "RECHAZADA";

const TIMELINE_STEPS: { key: IncidentStatus; label: string }[] = [
  { key: "RECIBIDA", label: "Recibida" },
  { key: "EN_REVISION", label: "En revisión" },
  { key: "AGENDADA", label: "Agendada" },
  { key: "EN_CURSO", label: "En curso" },
  { key: "RESUELTA", label: "Resuelta" },
];

const STATUS_STEP_INDEX: Record<string, number> = {
  RECIBIDA: 0,
  EN_REVISION: 1,
  AGENDADA: 2,
  EN_CURSO: 3,
  RESUELTA: 4,
  RECHAZADA: -1,
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    RECIBIDA:    { label: "Pendiente",   color: "#92400e", bg: "#fef3c7" },
    EN_REVISION: { label: "En revisión", color: "#1e40af", bg: "#dbeafe" },
    AGENDADA:    { label: "Agendada",    color: "#5b21b6", bg: "#ede9fe" },
    EN_CURSO:    { label: "En curso",    color: "#065f46", bg: "#d1fae5" },
    RESUELTA:    { label: "Resuelta",    color: "#065f46", bg: "#d1fae5" },
    RECHAZADA:   { label: "Rechazada",   color: "#991b1b", bg: "#fee2e2" },
    URGENTE:     { label: "Urgente",     color: "#991b1b", bg: "#fee2e2" },
  };
  const s = map[status] ?? { label: status, color: "#374151", bg: "#f3f4f6" };
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        borderRadius: "999px",
        padding: "2px 10px",
        fontSize: "12px",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

// ─── Priority Dot ─────────────────────────────────────────────────────────────
function PriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    URGENTE: "#ef4444",
    ALTA: "#f97316",
    MEDIA: "#3b82f6",
    BAJA: "#9ca3af",
  };
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: colors[priority] ?? "#9ca3af",
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}

// ─── Status Timeline ──────────────────────────────────────────────────────────
function StatusTimeline({
  currentStatus,
}: {
  currentStatus: string;
}) {
  const activeIdx = STATUS_STEP_INDEX[currentStatus] ?? 0;
  const rejected = currentStatus === "RECHAZADA";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, margin: "20px 0" }}>
      {TIMELINE_STEPS.map((step, idx) => {
        const done = activeIdx > idx;
        const active = activeIdx === idx && !rejected;
        const future = activeIdx < idx;

        return (
          <div
            key={step.key}
            style={{ display: "flex", alignItems: "center", flex: idx < 4 ? 1 : 0 }}
          >
            {/* Step circle */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  border: active ? "2.5px solid #00BDA5" : done ? "none" : "2px solid #d1d5db",
                  background: done ? "#00BDA5" : active ? "#fff" : "#f9fafb",
                  color: done ? "#fff" : active ? "#00BDA5" : "#9ca3af",
                  flexShrink: 0,
                  transition: "all 0.2s",
                }}
              >
                {done ? (
                  <Check size={14} strokeWidth={3} />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <span
                style={{
                  fontSize: 10,
                  color: done || active ? "#0F1B2B" : "#9ca3af",
                  fontWeight: active ? 700 : 400,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {idx < TIMELINE_STEPS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: done ? "#00BDA5" : "#e5e7eb",
                  marginBottom: 18,
                  transition: "background 0.2s",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Provider Panel ───────────────────────────────────────────────────────────
function ProviderPanel({
  providers,
  selectedProviderId,
  onSelect,
  onAssign,
  isAssigning,
  currentProviderId,
}: {
  providers: any[];
  selectedProviderId: string | null;
  onSelect: (id: string) => void;
  onAssign: () => void;
  isAssigning: boolean;
  currentProviderId?: string | null;
}) {
  const recommended = providers[0];
  const others = providers.slice(1);
  const selected =
    providers.find((p) => p.id === selectedProviderId) ?? recommended;

  return (
    <div
      style={{
        width: 300,
        flexShrink: 0,
        borderLeft: "1px solid #f0f0f0",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}
    >
      {/* Recommended */}
      {recommended && (
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #f0f0f0" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Proveedor recomendado
          </p>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "#0F1B2B",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              {recommended.avatarInitials}
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: "#0F1B2B", margin: 0 }}>
                {recommended.name}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                <Star size={12} fill="#f59e0b" color="#f59e0b" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0F1B2B" }}>
                  {recommended.rating.toFixed(1)}
                </span>
              </div>
              {recommended.isTrusted && (
                <p style={{ fontSize: 11, color: "#00BDA5", margin: "2px 0 0" }}>
                  Proveedor de confianza
                </p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Briefcase size={13} color="#9ca3af" />
              <span style={{ fontSize: 13, color: "#374151" }}>
                <strong>{recommended.completedJobs}</strong>{" "}
                <span style={{ color: "#9ca3af" }}>Intervenciones realizadas</span>
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={13} color="#9ca3af" />
              <span style={{ fontSize: 13, color: "#374151" }}>
                <strong>{recommended.avgDaysToResolve} días</strong>{" "}
                <span style={{ color: "#9ca3af" }}>Tiempo medio</span>
              </span>
            </div>
            {recommended.priceRangeMin != null && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#9ca3af" }}>€</span>
                <span style={{ fontSize: 13, color: "#374151" }}>
                  <strong>
                    {recommended.priceRangeMin}€ – {recommended.priceRangeMax}€
                  </strong>{" "}
                  <span style={{ color: "#9ca3af" }}>Coste estimado</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Others */}
      {others.length > 0 && (
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0", flex: 1 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Elegir otro proveedor
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {others.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 0",
                  width: "100%",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: `2px solid ${selectedProviderId === p.id ? "#00BDA5" : "#d1d5db"}`,
                      background: selectedProviderId === p.id ? "#00BDA5" : "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {selectedProviderId === p.id && <Check size={10} color="#fff" strokeWidth={3} />}
                  </div>
                  <span style={{ fontSize: 13, color: "#0F1B2B", fontWeight: 500 }}>
                    {p.name}
                  </span>
                </div>
                {p.priceRangeMin != null && (
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>
                    {p.priceRangeMin}€ – {p.priceRangeMax}€
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Assign button */}
      <div style={{ padding: "16px 20px" }}>
        <button
          onClick={onAssign}
          disabled={isAssigning || !selectedProviderId}
          style={{
            width: "100%",
            background: isAssigning || !selectedProviderId ? "#9ca3af" : "#00BDA5",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "13px 0",
            fontWeight: 700,
            fontSize: 14,
            cursor: isAssigning || !selectedProviderId ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <UserRound size={15} />
          {isAssigning ? "Asignando..." : "Asignar proveedor"}
        </button>
      </div>
    </div>
  );
}

// ─── Add Note Form ────────────────────────────────────────────────────────────
function AddNoteForm({
  incidentId,
  onAdded,
}: {
  incidentId: string;
  onAdded: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const addNote = useMutation(trpc.incident.addNote.mutationOptions());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await addNote.mutateAsync({
      tenantId: TENANT_ID,
      incidentId,
      content: text.trim(),
    });
    setText("");
    onAdded();
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 12, display: "flex", gap: 8 }}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Añadir nota interna..."
        style={{
          flex: 1,
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: "8px 12px",
          fontSize: 13,
          color: "#0F1B2B",
          outline: "none",
        }}
      />
      <button
        type="submit"
        disabled={!text.trim() || addNote.isPending}
        style={{
          background: "#00BDA5",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "8px 14px",
          cursor: text.trim() ? "pointer" : "not-allowed",
          opacity: text.trim() ? 1 : 0.5,
        }}
      >
        <Plus size={16} />
      </button>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function IncidentsPage() {
  const trpc = useTRPC();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Queries
  const { data: incidents = [], refetch } = useQuery(
    trpc.incident.all.queryOptions({ tenantId: TENANT_ID }),
  );
  const { data: providers = [] } = useQuery(
    trpc.provider.listByOrg.queryOptions({ tenantId: TENANT_ID }),
  );

  // Auto-select first incident on load
  useEffect(() => {
    if (!selectedId && incidents.length > 0 && incidents[0]) {
      setSelectedId(incidents[0].id);
    }
  }, [incidents, selectedId]);

  // Auto-select recommended provider on load
  useEffect(() => {
    if (!selectedProviderId && providers.length > 0 && providers[0]) {
      setSelectedProviderId(providers[0].id);
    }
  }, [providers, selectedProviderId]);

  const selected = incidents.find((i) => i.id === selectedId) ?? null;

  // Mutations
  const assignProvider = useMutation(trpc.incident.assignProvider.mutationOptions());
  const updateStatus = useMutation(trpc.incident.updateStatus.mutationOptions());
  const rejectIncident = useMutation(trpc.incident.reject.mutationOptions());

  const filtered = incidents.filter((i) =>
    filterStatus === "ALL" ? true : i.status === filterStatus,
  );

  const handleAssign = async () => {
    if (!selected || !selectedProviderId) return;
    try {
      await assignProvider.mutateAsync({
        tenantId: TENANT_ID,
        id: selected.id,
        providerId: selectedProviderId,
      });
      await refetch();
      showToast("✅ Proveedor asignado correctamente");
    } catch (e) {
      showToast("❌ Error al asignar proveedor", "err");
    }
  };

  const handleResolve = async () => {
    if (!selected) return;
    try {
      await updateStatus.mutateAsync({
        tenantId: TENANT_ID,
        id: selected.id,
        status: "RESUELTA",
      });
      await refetch();
      showToast("✅ Incidencia marcada como resuelta");
    } catch (e) {
      showToast("❌ Error al actualizar estado", "err");
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    try {
      await rejectIncident.mutateAsync({ tenantId: TENANT_ID, id: selected.id });
      await refetch();
      showToast("✅ Incidencia marcada como no procede");
    } catch (e) {
      showToast("❌ Error al rechazar", "err");
    }
  };

  const FILTER_TABS = [
    { key: "ALL", label: "Todas" },
    { key: "RECIBIDA", label: "Pendientes" },
    { key: "EN_REVISION", label: "En revisión" },
    { key: "EN_CURSO", label: "En curso" },
    { key: "RESUELTA", label: "Resueltas" },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", flexDirection: "column", background: "#f9fafb", position: "relative" }}>

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: toast.type === "ok" ? "#0F1B2B" : "#dc2626",
          color: "#fff", padding: "10px 20px", borderRadius: 10,
          fontSize: 13, fontWeight: 600, zIndex: 9999,
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
          transition: "opacity 0.3s",
        }}>
          {toast.msg}
        </div>
      )}
      {/* ── Top bar ───────────────────────────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #e5e7eb",
          background: "#fff",
          padding: "12px 24px",
          flexShrink: 0,
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0F1B2B", margin: 0 }}>
          Incidencias
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid #e5e7eb",
              borderRadius: 999,
              background: "#f9fafb",
              padding: "8px 16px",
              width: 280,
            }}
          >
            <Search size={15} color="#9ca3af" />
            <input
              placeholder="Buscar comunidad, avería, vecino..."
              style={{ border: "none", background: "none", outline: "none", fontSize: 13, color: "#6b7280", width: "100%" }}
            />
          </div>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#0F1B2B",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            JL
          </div>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Column 1: Incident list ────────────────────────────────────────── */}
        <div
          style={{
            width: 280,
            flexShrink: 0,
            borderRight: "1px solid #e5e7eb",
            background: "#fff",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Filter row */}
          <div
            style={{
              padding: "12px 16px 0",
              borderBottom: "1px solid #f3f4f6",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <Filter size={14} color="#9ca3af" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af" }}>FILTROS</span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingBottom: 10 }}>
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilterStatus(tab.key)}
                  style={{
                    border: "none",
                    borderRadius: 999,
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    background: filterStatus === tab.key ? "#00BDA5" : "#f3f4f6",
                    color: filterStatus === tab.key ? "#fff" : "#6b7280",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <ul
            style={{
              flex: 1,
              overflowY: "auto",
              listStyle: "none",
              padding: 0,
              margin: 0,
            }}
          >
            {filtered.length === 0 && (
              <li style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                Sin incidencias
              </li>
            )}
            {filtered.map((incident) => (
              <li
                key={incident.id}
                onClick={() => setSelectedId(incident.id)}
                style={{
                  padding: "14px 16px",
                  borderBottom: "1px solid #f3f4f6",
                  cursor: "pointer",
                  background: selectedId === incident.id ? "#f0fdfa" : "#fff",
                  borderLeft: selectedId === incident.id ? "3px solid #00BDA5" : "3px solid transparent",
                  transition: "background 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <PriorityDot priority={incident.priority} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F1B2B", lineHeight: 1.3 }}>
                      {incident.title}
                    </span>
                  </div>
                  <StatusBadge status={incident.priority === "URGENTE" ? "URGENTE" : incident.status} />
                </div>
                <p style={{ fontSize: 11, color: "#9ca3af", margin: "4px 0 0 14px" }}>
                  Residencial Los Olivos
                  <br />
                  Av. de Andalucía, 105
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Column 2: Incident detail ──────────────────────────────────────── */}
        {selected ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0F1B2B", margin: 0 }}>
                  {selected.title}
                </h2>
                <StatusBadge status={selected.status} />
              </div>
              <p style={{ fontSize: 13, color: "#9ca3af", margin: "4px 0 0" }}>
                Residencial Los Olivos · Av. de Andalucía, 105
              </p>

              {/* Timeline */}
              <StatusTimeline currentStatus={selected.status} />

              {/* Photo */}
              <div
                style={{
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "#f3f4f6",
                  aspectRatio: "16/7",
                  maxWidth: 520,
                  marginBottom: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {selected.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected.photoUrl} alt="Incidencia" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ color: "#d1d5db", fontSize: 13 }}>Sin fotografía</span>
                )}
              </div>

              {/* Description */}
              <section style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0F1B2B", marginBottom: 8 }}>
                  Descripción
                </h3>
                <p style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.6, margin: 0 }}>
                  {selected.description}
                </p>
              </section>

              {/* Internal Notes */}
              <section>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0F1B2B", marginBottom: 10 }}>
                  Notas internas
                </h3>

                {(selected.notes ?? []).length === 0 && (
                  <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8 }}>Sin notas aún.</p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(selected.notes ?? []).map((note: any) => (
                    <div
                      key={note.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        background: "#f9fafb",
                        border: "1px solid #f0f0f0",
                        borderRadius: 8,
                        padding: "10px 14px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <span style={{ fontSize: 14, color: "#00BDA5", marginTop: 1 }}>✎</span>
                        <div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#0F1B2B" }}>
                            {note.content}
                          </p>
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af" }}>
                            – {note.author?.name ?? "AF"},{" "}
                            {new Date(note.createdAt).toLocaleDateString("es-ES", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={14} color="#d1d5db" />
                    </div>
                  ))}
                </div>

                <AddNoteForm incidentId={selected.id} onAdded={() => refetch()} />
              </section>
            </div>

            {/* ── Bottom action bar ─────────────────────────────────────────── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                padding: "14px 32px",
                borderTop: "1px solid #e5e7eb",
                background: "#fff",
                flexShrink: 0,
              }}
            >
              <button
                onClick={handleAssign}
                disabled={assignProvider.isPending || !selectedProviderId}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  border: "1px solid #e5e7eb", borderRadius: 8,
                  padding: "10px 20px", background: "#fff",
                  color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  opacity: assignProvider.isPending ? 0.6 : 1,
                }}
              >
                <UserRound size={14} />
                {assignProvider.isPending ? "Asignando..." : "Asignar"}
              </button>

              <button
                onClick={handleReject}
                disabled={rejectIncident.isPending || selected.status === "RECHAZADA"}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  border: "1px solid #e5e7eb", borderRadius: 8,
                  padding: "10px 20px", background: "#fff",
                  color: "#374151", fontSize: 13, fontWeight: 600,
                  cursor: selected.status === "RECHAZADA" ? "not-allowed" : "pointer",
                  opacity: selected.status === "RECHAZADA" ? 0.4 : 1,
                }}
              >
                <XCircle size={14} />
                No procede
              </button>

              <button
                onClick={handleResolve}
                disabled={updateStatus.isPending || selected.status === "RESUELTA"}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  border: "none", borderRadius: 8,
                  padding: "10px 24px",
                  background: selected.status === "RESUELTA" ? "#9ca3af" : "#00BDA5",
                  color: "#fff", fontSize: 13, fontWeight: 700,
                  cursor: selected.status === "RESUELTA" ? "not-allowed" : "pointer",
                }}
              >
                <CheckCircle2 size={14} />
                Marcar como resuelta
              </button>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
            Selecciona una incidencia
          </div>
        )}

        {/* ── Column 3: Provider panel ───────────────────────────────────────── */}
        {selected && (
          <ProviderPanel
            providers={providers}
            selectedProviderId={selectedProviderId}
            onSelect={setSelectedProviderId}
            onAssign={handleAssign}
            isAssigning={assignProvider.isPending}
            currentProviderId={selected.providerId}
          />
        )}
      </div>
    </div>
  );
}
