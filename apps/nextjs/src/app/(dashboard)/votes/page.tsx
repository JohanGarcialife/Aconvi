"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Download,
  Edit3,
  FileCheck,
  FileText,
  Info,
  Layers,
  Paperclip,
  Play,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  Vote,
  X,
  Zap,
} from "lucide-react";

import { Badge } from "@acme/ui/badge";
import { Button } from "@acme/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@acme/ui/dialog";
import { Input } from "@acme/ui/input";
import { Label } from "@acme/ui/label";
import { Textarea } from "@acme/ui/textarea";

import { useSocket } from "~/app/_components/socket-provider";
import { useTRPC } from "~/trpc/react";

const TENANT_ID = "org_aconvi_demo";

type ActiveView = "list" | "rights" | "single" | "meeting";

// ─── Results Bar ──────────────────────────────────────────────────────────────
function ResultBar({
  label,
  count,
  weighted,
  totalWeighted,
  color,
}: {
  label: string;
  count: number;
  weighted: number;
  totalWeighted: number;
  color: string;
}) {
  const pct = totalWeighted > 0 ? Math.round((weighted / totalWeighted) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-semibold text-slate-700">
        <span>
          {label} ({count} votos)
        </span>
        <span>
          {weighted.toFixed(1)}% coef. ({pct}%)
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-slate-100">
        <div
          className={`h-full rounded transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Session Detail Modal ─────────────────────────────────────────────────────
function SessionDetailModal({
  session,
  open,
  onClose,
  onFinalizeActa,
}: {
  session: any;
  open: boolean;
  onClose: () => void;
  onFinalizeActa?: (id: string) => void;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  if (!session) return null;

  const isJunta = session.type === "JUNTA";

  const downloadPdf = async () => {
    if (!session.minute) return;
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/votes/${session.id}/pdf`);
      if (!res.ok) throw new Error("Error al generar el PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `acta-${session.title.toLowerCase().replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("No se pudo generar el acta en PDF. Inténtalo de nuevo.");
    } finally {
      setIsDownloading(false);
    }
  };

  const approveWeight =
    session.casts
      ?.filter((c: any) => c.choice === "APPROVE")
      .reduce((s: number, c: any) => s + (c.coefficient || 1), 0) ?? 0;
  const rejectWeight =
    session.casts
      ?.filter((c: any) => c.choice === "REJECT")
      .reduce((s: number, c: any) => s + (c.coefficient || 1), 0) ?? 0;
  const abstainWeight =
    session.casts
      ?.filter((c: any) => c.choice === "ABSTAIN")
      .reduce((s: number, c: any) => s + (c.coefficient || 1), 0) ?? 0;
  const totalWeight = approveWeight + rejectWeight + abstainWeight;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl rounded-lg">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-medium text-slate-700">
              {isJunta ? "Junta Extraordinaria" : "Votación sin junta"}
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
              {session.status === "CLOSED" ? "Cerrada" : "En curso"}
            </span>
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900">
            {session.title}
          </DialogTitle>
          {session.description && (
            <DialogDescription className="text-slate-600 mt-1 text-xs">
              {session.description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {session.resultSummary && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50/80 p-3 text-center">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-0.5">
                Resultado Oficial
              </span>
              <span className="text-base font-extrabold text-emerald-900">
                {session.resultSummary}
              </span>
            </div>
          )}

          {/* Breakdown if single */}
          {!isJunta && (
            <div className="rounded-md border border-slate-200 bg-slate-50/50 p-4 space-y-3">
              <span className="text-xs font-bold text-slate-700 block">
                Escrutinio por coeficiente de propiedad:
              </span>
              <div className="space-y-2">
                <ResultBar
                  label="Apruebo"
                  count={session.casts?.filter((c: any) => c.choice === "APPROVE").length ?? 0}
                  weighted={approveWeight}
                  totalWeighted={totalWeight}
                  color="bg-emerald-500"
                />
                <ResultBar
                  label="Rechazo"
                  count={session.casts?.filter((c: any) => c.choice === "REJECT").length ?? 0}
                  weighted={rejectWeight}
                  totalWeighted={totalWeight}
                  color="bg-rose-500"
                />
                <ResultBar
                  label="Me abstengo"
                  count={session.casts?.filter((c: any) => c.choice === "ABSTAIN").length ?? 0}
                  weighted={abstainWeight}
                  totalWeighted={totalWeight}
                  color="bg-slate-400"
                />
              </div>
            </div>
          )}

          {/* Presupuestos presentados */}
          {session.budgetProposals && session.budgetProposals.length > 0 && (
            <div className="rounded-md border border-slate-200 bg-slate-50/50 p-4">
              <span className="text-xs font-bold text-slate-700 block mb-2">
                Presupuestos presentados ({session.budgetProposals.length}):
              </span>
              <div className="space-y-2">
                {session.budgetProposals.map((bp: any) => (
                  <div
                    key={bp.id}
                    className="flex items-center justify-between p-2.5 rounded border bg-white text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 block">{bp.companyName}</span>
                      {bp.description && (
                        <span className="text-slate-500 text-[11px]">{bp.description}</span>
                      )}
                    </div>
                    <span className="font-extrabold text-slate-900">{bp.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agenda items if Junta */}
          {isJunta && session.items && session.items.length > 0 && (
            <div className="rounded-md border border-slate-200 bg-slate-50/50 p-4">
              <span className="text-xs font-bold text-slate-700 block mb-2">
                Puntos del orden del día ({session.items.length}):
              </span>
              <div className="space-y-2">
                {session.items.map((item: any, idx: number) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded border bg-white text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {idx + 1}. {item.title}
                      </span>
                      {item.budget && (
                        <span className="font-semibold text-slate-700">{item.budget}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
          <div>
            {session.minute && (
              <button
                type="button"
                onClick={downloadPdf}
                disabled={isDownloading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              >
                <Download className="h-3.5 w-3.5" />
                {isDownloading ? "Generando..." : "Descargar Acta Oficial"}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {session.status === "OPEN" && onFinalizeActa && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onFinalizeActa(session.id);
                }}
                className="px-3 py-1.5 rounded-md bg-[#008075] hover:bg-[#006e64] text-white text-xs font-bold"
              >
                Finalizar acta
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50"
            >
              Cerrar
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 1. VIEW: LISTADO GENERAL ─────────────────────────────────────────────────
function VotesListView({
  sessions,
  isLoading,
  onOpenDetail,
  onFinalizeActa,
}: {
  sessions: any[];
  isLoading: boolean;
  onOpenDetail: (session: any) => void;
  onFinalizeActa: (id: string) => void;
}) {
  const now = Date.now();

  const openSessions = sessions.filter(
    (s: any) =>
      s.status === "OPEN" &&
      (!s.closesAt || new Date(s.closesAt).getTime() >= now),
  );

  const pendingClosureSessions = sessions.filter(
    (s: any) =>
      s.status === "OPEN" &&
      s.closesAt &&
      new Date(s.closesAt).getTime() < now,
  );

  const scheduledSessions = sessions.filter(
    (s: any) =>
      s.status === "DRAFT" ||
      (s.scheduledAt && new Date(s.scheduledAt).getTime() > now),
  );

  const recentClosedSessions = sessions.filter(
    (s: any) => s.status === "CLOSED",
  );

  return (
    <div className="space-y-6">
      {/* ── 3 KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Votaciones Activas */}
        <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-md bg-[#EAF5F2] flex items-center justify-center text-[#008075]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-black text-slate-900 leading-none mb-1">
                {openSessions.length}
              </div>
              <div className="text-xs font-medium text-slate-500">
                votaciones activas
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>

        {/* Card 2: Pendiente de cierre */}
        <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-md bg-[#E8F1F5] flex items-center justify-center text-[#1E6075]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-black text-slate-900 leading-none mb-1">
                {pendingClosureSessions.length}
              </div>
              <div className="text-xs font-medium text-slate-500">
                pendiente de cierre
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>

        {/* Card 3: Cerradas este mes */}
        <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-md bg-slate-100 flex items-center justify-center text-slate-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-black text-slate-900 leading-none mb-1">
                {recentClosedSessions.length}
              </div>
              <div className="text-xs font-medium text-slate-500">
                cerradas este mes
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-lg border">
          Cargando votaciones...
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Section 1: En curso ── */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#008075]" />
                <h2 className="text-sm font-bold text-slate-900">En curso</h2>
              </div>
              <span className="text-xs font-medium text-slate-400">
                {openSessions.length} {openSessions.length === 1 ? "votación activa" : "votaciones activas"}
              </span>
            </div>

            {openSessions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-white rounded-lg border border-dashed border-slate-200">
                No hay votaciones activas en este momento.
              </div>
            ) : (
              <div className="space-y-2.5">
                {openSessions.map((session: any) => {
                  const isJunta = session.type === "JUNTA";
                  const totalVoters = 50;
                  const votesCount = session.casts?.length ?? 0;
                  const pct = Math.min(100, Math.round((votesCount / totalVoters) * 100));
                  const pendingVoters = Math.max(0, totalVoters - votesCount);

                  return (
                    <div
                      key={session.id}
                      className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      {/* Left: icon & title */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-md bg-[#EAF5F2] flex items-center justify-center text-[#008075] shrink-0 mt-0.5">
                          {isJunta ? (
                            <Users className="w-4 h-4" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 truncate">
                            {session.title}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-medium text-slate-600">
                              {isJunta ? "Extraordinaria" : "Ordinaria"}
                            </span>
                            <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-medium text-slate-600">
                              Mayoría simple
                            </span>
                          </div>
                          {session.closesAt && (
                            <div className="flex items-center gap-1 mt-1.5 text-[11px] text-slate-500">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>
                                Cierra el{" "}
                                {format(new Date(session.closesAt), "d 'de' MMMM · HH:mm", {
                                  locale: es,
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Middle: Progress */}
                      <div className="w-full md:w-64 shrink-0 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Participación</span>
                          <span className="font-bold text-slate-800">
                            {votesCount} de {totalVoters} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-[#008075] rounded transition-all"
                            style={{ width: `${Math.max(5, pct)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-slate-400" />
                            <span>{pendingVoters} sin votar</span>
                          </div>
                          <div className="flex items-center gap-1 text-[#008075] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#008075]" />
                            <span>Mayoría alcanzable</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Action */}
                      <div className="shrink-0 flex items-center">
                        <button
                          type="button"
                          onClick={() => onOpenDetail(session)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#EAF5F2] text-[#008075] text-xs font-bold hover:bg-[#DDF0EC] transition-colors"
                        >
                          Ver votación
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Section 2: Pendientes de cierre ── */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <h2 className="text-sm font-bold text-slate-900">Pendientes de cierre</h2>
              </div>
              <span className="text-xs font-medium text-slate-400">
                {pendingClosureSessions.length}{" "}
                {pendingClosureSessions.length === 1 ? "votación" : "votaciones"}
              </span>
            </div>

            {pendingClosureSessions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 bg-white rounded-lg border border-dashed border-slate-200">
                No hay votaciones pendientes de cierre.
              </div>
            ) : (
              <div className="space-y-2.5">
                {pendingClosureSessions.map((session: any) => (
                  <div
                    key={session.id}
                    className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-md bg-[#E8F1F5] flex items-center justify-center text-[#1E6075] shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{session.title}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-medium text-slate-600">
                            Ordinaria
                          </span>
                          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-medium text-slate-600">
                            Mayoría simple
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 text-[11px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Acta pendiente de cierre
                      </span>
                      <button
                        type="button"
                        onClick={() => onFinalizeActa(session.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-slate-100 text-slate-800 text-xs font-bold hover:bg-slate-200 transition-colors"
                      >
                        Finalizar acta
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Section 3: Programadas ── */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <h2 className="text-sm font-bold text-slate-900">Programadas</h2>
              </div>
              <span className="text-xs font-medium text-slate-400">
                {scheduledSessions.length}{" "}
                {scheduledSessions.length === 1 ? "votación" : "votaciones"}
              </span>
            </div>

            {scheduledSessions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 bg-white rounded-lg border border-dashed border-slate-200">
                No hay votaciones programadas para próximas fechas.
              </div>
            ) : (
              <div className="space-y-2.5">
                {scheduledSessions.map((session: any) => (
                  <div
                    key={session.id}
                    className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{session.title}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-medium text-slate-600">
                            Ordinaria
                          </span>
                          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-medium text-slate-600">
                            Mayoría simple
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-[11px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        Programada
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenDetail(session)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-slate-100 text-slate-800 text-xs font-bold hover:bg-slate-200 transition-colors"
                      >
                        Ver detalles
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Section 4: Cerradas recientemente ── */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <h2 className="text-sm font-bold text-slate-900">Cerradas recientemente</h2>
              </div>
              <span className="text-xs font-medium text-slate-400">
                {recentClosedSessions.length} este mes
              </span>
            </div>

            {recentClosedSessions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 bg-white rounded-lg border border-dashed border-slate-200">
                No hay votaciones cerradas este mes.
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentClosedSessions.map((session: any) => {
                  const summary = session.resultSummary || "Aprobada · 78% participación";
                  const isApproved = !summary.toLowerCase().includes("rechazad");
                  return (
                    <div
                      key={session.id}
                      className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{session.title}</h3>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-medium text-slate-600">
                              Ordinaria
                            </span>
                            <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-medium text-slate-600">
                              Mayoría simple
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold ${
                            isApproved
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isApproved ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                          {summary}
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenDetail(session)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-slate-100 text-slate-800 text-xs font-bold hover:bg-slate-200 transition-colors"
                        >
                          Ver acta
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 2. VIEW: HABILITAR VOTO (media_1789170007150.png) ─────────────────────────
function VotingRightsView({ onBack }: { onBack: () => void }) {
  const trpc = useTRPC();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [internalNote, setInternalNote] = useState("");

  const { data: neighbors, refetch } = useQuery(
    trpc.community.neighbors.queryOptions({ tenantId: TENANT_ID }),
  );

  const overrideMutation = useMutation(
    trpc.voting.overrideVotingRight.mutationOptions({
      onSuccess: () => {
        setExpandedId(null);
        setReason("");
        setInternalNote("");
        void refetch();
      },
      onError: (err: any) => {
        alert(err?.message || "No se pudo actualizar el derecho de voto.");
      },
    }),
  );

  const neighborList = (neighbors as any[] | undefined) ?? [];

  const handleConfirmException = (debtorId: string) => {
    if (!reason.trim()) {
      alert("Por favor indica el motivo legal de la excepción.");
      return;
    }
    overrideMutation.mutate({
      tenantId: TENANT_ID,
      userId: debtorId,
      enable: true,
      reason: reason.trim(),
    });
  };

  const handleRemoveException = (debtorId: string) => {
    if (confirm("¿Deseas retirar la excepción de voto para este propietario?")) {
      overrideMutation.mutate({
        tenantId: TENANT_ID,
        userId: debtorId,
        enable: false,
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner Card */}
      <div className="flex items-start gap-3.5 p-4 bg-white rounded-lg border border-slate-200/80 shadow-2xs">
        <div className="w-10 h-10 rounded-md bg-[#EAF5F2] flex items-center justify-center text-[#008075] shrink-0">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900">Habilitar voto</h2>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Propietarios con recibos pendientes. Puedes habilitar su voto de forma
            permanente cuando la ley lo permita, indicando el motivo.
          </p>
        </div>
      </div>

      {/* Debtors List Card */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Propietarios con recibos pendientes
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            {neighborList.length} propietarios
          </span>
        </div>

        {neighborList.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 bg-white rounded-lg border border-dashed">
            No hay propietarios con recibos pendientes registrados.
          </div>
        ) : (
          <div className="space-y-2.5">
            {neighborList.map((item: any) => {
              const isExpanded = expandedId === item.id;
              const initials = (item.name || "PR")
                .split(" ")
                .map((w: string) => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-2xs transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left: Avatar + Name */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-md bg-[#EAF5F2] flex items-center justify-center text-[#008075] font-black text-xs shrink-0">
                        {initials}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          {item.name}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Cuota / Deuda: <span className="font-semibold text-slate-700">{item.coefficient ? `${item.coefficient}%` : "Pendiente"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Badge + Button */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      {item.votingOverride ? (
                        <>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs font-semibold">
                            Voto habilitado · {item.votingOverrideReason || "Resolución judicial"}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (isExpanded) {
                                setExpandedId(null);
                              } else {
                                setReason(item.votingOverrideReason || "");
                                setExpandedId(item.id);
                              }
                            }}
                            className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            Editar
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-semibold">
                            Sin derecho a voto
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (isExpanded) {
                                setExpandedId(null);
                              } else {
                                setReason("");
                                setInternalNote("");
                                setExpandedId(item.id);
                              }
                            }}
                            className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                              isExpanded
                                ? "bg-[#008075] text-white"
                                : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                            }`}
                          >
                            Habilitar voto
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Inline Exception Creator Form */}
                  {isExpanded && (
                    <div className="mt-3.5 pt-3.5 border-t border-slate-100 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                        <Users className="w-3.5 h-3.5 text-[#008075]" />
                        <span>Crear excepción de voto</span>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor={`reason-${item.id}`} className="text-[11px] font-semibold text-slate-700">
                          Motivo de la excepción *
                        </Label>
                        <Input
                          id={`reason-${item.id}`}
                          placeholder="Ej. Impugnación o proceso judicial en curso."
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          className="text-xs h-8.5 bg-slate-50/50 rounded-md"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor={`note-${item.id}`} className="text-[11px] font-semibold text-slate-700">
                          Nota interna (opcional)
                        </Label>
                        <Textarea
                          id={`note-${item.id}`}
                          placeholder="Añade una nota interna si lo necesitas..."
                          value={internalNote}
                          onChange={(e) => setInternalNote(e.target.value)}
                          rows={2}
                          className="text-xs bg-slate-50/50 resize-none rounded-md"
                        />
                      </div>

                      {/* Info Alert */}
                      <div className="flex items-center gap-2 p-2.5 rounded-md bg-sky-50 text-sky-800 text-xs font-medium border border-sky-100">
                        <Info className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span>La excepción se mantiene en futuras votaciones hasta que se elimine.</span>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        {item.votingOverride && (
                          <button
                            type="button"
                            onClick={() => handleRemoveException(item.id)}
                            className="px-3 py-1.5 rounded-md text-xs font-bold text-red-600 hover:bg-red-50 transition-colors mr-auto"
                          >
                            Eliminar excepción
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedId(null)}
                          className="px-3 py-1.5 rounded-md border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmException(item.id)}
                          disabled={overrideMutation.isPending}
                          className="px-3.5 py-1.5 rounded-md bg-[#008075] text-xs font-bold text-white hover:bg-[#006e64] transition-colors"
                        >
                          {overrideMutation.isPending ? "Guardando..." : "Confirmar excepción"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 3. VIEW: VOTACIÓN SIN JUNTA (media_1789170007084.png) ─────────────────────
function CreateSingleVoteView({
  onCancel,
  onSuccess,
  onManageRights,
}: {
  onCancel: () => void;
  onSuccess: () => void;
  onManageRights: () => void;
}) {
  const trpc = useTRPC();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [closesAt, setClosesAt] = useState("");

  // Clean empty proposals list - user adds their own
  const [proposals, setProposals] = useState<
    Array<{
      companyName: string;
      amount: string;
      description?: string;
      fileUrl?: string;
      fileName?: string;
    }>
  >([]);

  // Subform for new proposal
  const [isAddingProposal, setIsAddingProposal] = useState(false);
  const [propCompany, setPropCompany] = useState("");
  const [propAmount, setPropAmount] = useState("");
  const [propFile, setPropFile] = useState<string | null>(null);

  const createMutation = useMutation(
    trpc.voting.create.mutationOptions({
      onSuccess: () => {
        alert("¡Votación creada con éxito!");
        onSuccess();
      },
      onError: (err: any) => {
        alert(err?.message || "Error al crear la votación.");
      },
    }),
  );

  const handleSaveProposal = () => {
    if (!propCompany.trim() || !propAmount.trim()) {
      alert("Introduce la empresa/opción y el importe.");
      return;
    }
    setProposals([
      ...proposals,
      {
        companyName: propCompany.trim(),
        amount: propAmount.trim(),
        fileName: propFile || undefined,
        fileUrl: propFile ? "https://example.com/" + encodeURIComponent(propFile) : undefined,
      },
    ]);
    setPropCompany("");
    setPropAmount("");
    setPropFile(null);
    setIsAddingProposal(false);
  };

  const handleRemoveProposal = (index: number) => {
    setProposals(proposals.filter((_, i) => i !== index));
  };

  const handlePublish = () => {
    if (!title.trim()) {
      alert("Por favor introduce el título del tema a votar.");
      return;
    }

    const finalProposals = [...proposals];
    if (isAddingProposal && propCompany.trim() && propAmount.trim()) {
      finalProposals.push({
        companyName: propCompany.trim(),
        amount: propAmount.trim(),
        fileName: propFile || undefined,
        fileUrl: propFile ? "https://example.com/" + encodeURIComponent(propFile) : undefined,
      });
    }

    createMutation.mutate({
      tenantId: TENANT_ID,
      title: title.trim(),
      description: description.trim() || undefined,
      closesAt: closesAt ? new Date(closesAt).toISOString() : undefined,
      type: "SINGLE",
      budgetProposals: finalProposals.map((p) => ({
        companyName: p.companyName.trim(),
        amount: p.amount.trim(),
        description: p.description?.trim() || undefined,
        fileUrl: p.fileUrl?.trim() || undefined,
        fileName: p.fileName?.trim() || undefined,
      })),
    });
  };

  return (
    <div className="space-y-5">
      {/* Subtitle & Manage Rights link */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Users className="w-3.5 h-3.5 text-slate-400" />
        <span>3 propietarios sin derecho a voto · </span>
        <button
          type="button"
          onClick={onManageRights}
          className="font-bold text-[#008075] hover:underline"
        >
          Gestionar
        </button>
      </div>

      {/* Step 1: ¿Qué quieres que voten los propietarios? */}
      <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs space-y-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-[#008075] text-white flex items-center justify-center text-xs font-black">
            1
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            ¿Qué quieres que voten los propietarios?
          </h3>
        </div>

        <div className="space-y-3 pl-8.5">
          <div className="space-y-1">
            <Label htmlFor="single-title" className="text-xs font-semibold text-slate-700">
              Título del tema *
            </Label>
            <Input
              id="single-title"
              placeholder="Ej: Reparación del ascensor"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xs h-9 rounded-md"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="single-desc" className="text-xs font-semibold text-slate-700">
              Descripción (opcional)
            </Label>
            <Textarea
              id="single-desc"
              placeholder="Añade una breve descripción del tema..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="text-xs resize-none rounded-md"
            />
          </div>
        </div>
      </div>

      {/* Step 2: ¿Qué opciones tienen? */}
      <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-[#008075] text-white flex items-center justify-center text-xs font-black">
              2
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">¿Qué opciones tienen?</h3>
              <p className="text-xs text-slate-500">
                Añade las opciones que quieras que los propietarios puedan comparar.
              </p>
            </div>
          </div>

          {!isAddingProposal && (
            <button
              type="button"
              onClick={() => setIsAddingProposal(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-[#008075] text-[#008075] text-xs font-bold hover:bg-[#EAF5F2] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Añadir propuesta
            </button>
          )}
        </div>

        <div className="space-y-3 pl-8.5">
          {/* Active Proposal Subform */}
          {isAddingProposal && (
            <div className="rounded-md border border-emerald-200 bg-[#EAF5F2]/40 p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-[#008075] text-white flex items-center justify-center text-[10px] font-bold">
                  {proposals.length + 1}
                </span>
                <span className="text-xs font-bold text-slate-900">
                  Nueva Propuesta / Opción {proposals.length + 1}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">
                    Empresa / Opción *
                  </Label>
                  <Input
                    placeholder="Ej. Ascensores Madrid S.L."
                    value={propCompany}
                    onChange={(e) => setPropCompany(e.target.value)}
                    className="text-xs h-8.5 bg-white rounded-md"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">
                    Importe *
                  </Label>
                  <Input
                    placeholder="Ej. 2.500,00 €"
                    value={propAmount}
                    onChange={(e) => setPropAmount(e.target.value)}
                    className="text-xs h-8.5 bg-white rounded-md"
                  />
                </div>
              </div>

              {/* Upload Drop Area */}
              <div className="rounded-md border-2 border-dashed border-slate-200 bg-white p-2.5 text-center cursor-pointer hover:border-[#008075] transition-colors">
                {propFile ? (
                  <div className="flex items-center justify-between px-2 text-xs">
                    <div className="flex items-center gap-2 text-slate-800 font-medium">
                      <span className="p-0.5 rounded bg-rose-50 text-rose-600 font-bold text-[10px]">
                        PDF
                      </span>
                      <span>{propFile}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPropFile(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPropFile("Presupuesto_adjunto.pdf")}
                    className="flex flex-col items-center justify-center w-full py-1 text-xs text-slate-500"
                  >
                    <Upload className="w-4 h-4 text-slate-400 mb-1" />
                    <span>Arrastrar archivo aquí o hacer clic para seleccionar</span>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingProposal(false)}
                  className="px-3 py-1 rounded-md border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveProposal}
                  className="px-3 py-1 rounded-md bg-[#008075] text-xs font-bold text-white hover:bg-[#006e64]"
                >
                  Guardar propuesta
                </button>
              </div>
            </div>
          )}

          {/* Proposals list or empty state */}
          {proposals.length === 0 && !isAddingProposal ? (
            <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-md border border-dashed border-slate-200">
              No hay opciones o propuestas añadidas todavía. Pulsa en &quot;Añadir propuesta&quot; para definir las alternativas de voto.
            </div>
          ) : (
            <div className="space-y-2">
              {proposals.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-md border border-slate-200 bg-white text-xs shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-900">{p.companyName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-slate-800">{p.amount}</span>
                    {p.fileName && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <Paperclip className="w-3 h-3" />
                        {p.fileName}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveProposal(idx)}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Step 3: ¿Hasta cuándo pueden votar? */}
      <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs space-y-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-[#008075] text-white flex items-center justify-center text-xs font-black">
            3
          </div>
          <h3 className="text-sm font-bold text-slate-900">¿Hasta cuándo pueden votar?</h3>
        </div>

        <div className="space-y-1 pl-8.5 max-w-sm">
          <Label htmlFor="single-closes" className="text-xs font-semibold text-slate-700">
            Cierre de la votación
          </Label>
          <div className="relative">
            <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              id="single-closes"
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              className="text-xs h-9 pl-8.5 rounded-md cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Step 4: Documentación (opcional) */}
      <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs space-y-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-[#008075] text-white flex items-center justify-center text-xs font-black">
            4
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Documentación (opcional)</h3>
            <p className="text-xs text-slate-500">
              Añade documentos que los propietarios puedan consultar.
            </p>
          </div>
        </div>

        <div className="pl-8.5">
          <div className="rounded-md border-2 border-dashed border-slate-200 bg-slate-50/50 p-3.5 text-center cursor-pointer hover:border-[#008075] transition-colors">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <Upload className="w-4 h-4 text-slate-400" />
              <span>Arrastrar archivo aquí o hacer clic para seleccionar</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="flex items-center justify-end gap-2.5 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-md border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handlePublish}
          disabled={createMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#008075] text-xs font-bold text-white hover:bg-[#006e64] transition-colors shadow-2xs"
        >
          <Check className="w-3.5 h-3.5" />
          {createMutation.isPending ? "Creando..." : "Crear votación"}
        </button>
      </div>
    </div>
  );
}

// ─── 4. VIEW: CREAR JUNTA (media_1789170007119.png) ───────────────────────────
function CreateMeetingView({
  onCancel,
  onSuccess,
  onManageRights,
}: {
  onCancel: () => void;
  onSuccess: () => void;
  onManageRights: () => void;
}) {
  const trpc = useTRPC();
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [secondCallDate, setSecondCallDate] = useState("");
  const [secondCallTime, setSecondCallTime] = useState("");
  const [activationType, setActivationType] = useState<"now" | "schedule">("now");

  // Clean empty items list - user adds their own points
  const [items, setItems] = useState<
    Array<{
      title: string;
      onlineVotingEnabled: boolean;
      proposals: Array<{ companyName: string; amount: string; fileUrl?: string }>;
    }>
  >([]);

  const [activeItemIndex, setActiveItemIndex] = useState<number>(-1);
  const [newPropCompany, setNewPropCompany] = useState("");
  const [newPropAmount, setNewPropAmount] = useState("");
  const [isAddingProposal, setIsAddingProposal] = useState(false);

  const createMeetingMutation = useMutation(
    trpc.voting.createMeeting.mutationOptions({
      onSuccess: () => {
        alert("¡Junta convocada con éxito!");
        onSuccess();
      },
      onError: (err: any) => {
        alert(err?.message || "Error al convocar la junta.");
      },
    }),
  );

  const handleAddNewItem = () => {
    const nextIndex = items.length;
    setItems([
      ...items,
      {
        title: "",
        onlineVotingEnabled: true,
        proposals: [],
      },
    ]);
    setActiveItemIndex(nextIndex);
  };

  const handleUpdateItemTitle = (index: number, newTitle: string) => {
    const next = [...items];
    if (next[index]) {
      next[index]!.title = newTitle;
      setItems(next);
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    if (activeItemIndex === index) {
      setActiveItemIndex(-1);
    }
  };

  const handleSaveProposal = () => {
    if (!newPropCompany.trim() || !newPropAmount.trim()) {
      alert("Introduce empresa e importe de la propuesta.");
      return;
    }
    const next = [...items];
    if (next[activeItemIndex]) {
      next[activeItemIndex]!.proposals.push({
        companyName: newPropCompany.trim(),
        amount: newPropAmount.trim(),
      });
      setItems(next);
      setNewPropCompany("");
      setNewPropAmount("");
      setIsAddingProposal(false);
    }
  };

  const handlePublishMeeting = () => {
    if (!title.trim() || !meetingDate) {
      alert("Por favor completa el título y la fecha de la junta.");
      return;
    }

    const fullMeetingDate = new Date(`${meetingDate}T${meetingTime || "18:00"}:00`).toISOString();
    const fullSecondCall = secondCallDate
      ? new Date(`${secondCallDate}T${secondCallTime || "18:30"}:00`).toISOString()
      : undefined;

    createMeetingMutation.mutate({
      tenantId: TENANT_ID,
      title: title.trim(),
      meetingDate: fullMeetingDate,
      meetingLocation: meetingLocation.trim() || "Salón Comunitario",
      secondCallDate: fullSecondCall,
      items: items
        .filter((it) => it.title.trim().length > 0)
        .map((it) => ({
          title: it.title.trim(),
          onlineVotingEnabled: it.onlineVotingEnabled,
          proposals: it.proposals.map((p) => ({
            companyName: p.companyName,
            amount: p.amount,
          })),
        })),
    });
  };

  return (
    <div className="space-y-5">
      {/* Step 1: Datos de la junta */}
      <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs space-y-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-[#008075] text-white flex items-center justify-center text-xs font-black">
            1
          </div>
          <h3 className="text-sm font-bold text-slate-900">Datos de la junta</h3>
        </div>

        <div className="space-y-3 pl-8.5">
          <div className="space-y-1">
            <Label htmlFor="meet-title" className="text-xs font-semibold text-slate-700">
              Título de la junta *
            </Label>
            <Input
              id="meet-title"
              placeholder="Ej: Junta General Ordinaria - Septiembre 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xs h-9 rounded-md"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label htmlFor="meet-date" className="text-xs font-semibold text-slate-700">
                Fecha *
              </Label>
              <Input
                id="meet-date"
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="text-xs h-9 rounded-md"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="meet-time" className="text-xs font-semibold text-slate-700">
                Hora *
              </Label>
              <Input
                id="meet-time"
                type="time"
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
                className="text-xs h-9 rounded-md"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="meet-loc" className="text-xs font-semibold text-slate-700">
              Lugar de celebración *
            </Label>
            <Input
              id="meet-loc"
              placeholder="Ej: Salón Comunitario / Portal principal"
              value={meetingLocation}
              onChange={(e) => setMeetingLocation(e.target.value)}
              className="text-xs h-9 rounded-md"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label htmlFor="meet-date2" className="text-xs font-semibold text-slate-700">
                Segunda convocatoria (opcional)
              </Label>
              <Input
                id="meet-date2"
                type="date"
                value={secondCallDate}
                onChange={(e) => setSecondCallDate(e.target.value)}
                className="text-xs h-9 rounded-md"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="meet-time2" className="text-xs font-semibold text-slate-700">
                Hora (opcional)
              </Label>
              <Input
                id="meet-time2"
                type="time"
                value={secondCallTime}
                onChange={(e) => setSecondCallTime(e.target.value)}
                className="text-xs h-9 rounded-md"
              />
            </div>
          </div>

          {/* Banner: 3 propietarios sin derecho a voto */}
          <div className="flex items-center justify-between p-2.5 rounded-md bg-slate-50 border border-slate-200/80 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>3 propietarios sin derecho a voto</span>
            </div>
            <button
              type="button"
              onClick={onManageRights}
              className="font-bold text-[#008075] hover:underline"
            >
              Gestionar &gt;
            </button>
          </div>
        </div>
      </div>

      {/* Agenda Points Section */}
      <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-[#008075] text-white flex items-center justify-center text-xs font-black">
              2
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Puntos del orden del día</h3>
              <p className="text-xs text-slate-500">
                Añade los acuerdos a deliberar y presupuestos comparativos.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddNewItem}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-[#008075] text-[#008075] text-xs font-bold hover:bg-[#EAF5F2] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Añadir punto
          </button>
        </div>

        <div className="space-y-2.5 pl-8.5">
          {items.length === 0 ? (
            <div className="p-5 text-center text-xs text-slate-400 bg-slate-50 rounded-md border border-dashed border-slate-200">
              Aún no has añadido puntos al orden del día. Pulsa en &quot;Añadir punto&quot; para comenzar a redactar los temas de la junta.
            </div>
          ) : (
            items.map((it, idx) => {
              const isSelected = activeItemIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-md border border-slate-200 bg-white p-3.5 space-y-2.5 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <span className="w-5 h-5 rounded bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <Input
                        placeholder="Título del punto (ej. Reparación del ascensor)..."
                        value={it.title}
                        onChange={(e) => handleUpdateItemTitle(idx, e.target.value)}
                        className="text-xs h-8 rounded-md flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#008075]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#008075]" />
                        {it.onlineVotingEnabled ? "Voto previo" : "Informativo"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveItemIndex(isSelected ? -1 : idx)}
                        className="p-1 text-slate-400 hover:text-slate-600"
                      >
                        {isSelected ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="pt-2.5 border-t border-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">
                          ¿Se vota este punto antes de la junta? *
                        </span>
                        <div className="flex items-center gap-3 text-xs">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name={`vote-point-${idx}`}
                              checked={it.onlineVotingEnabled}
                              onChange={() => {
                                const next = [...items];
                                next[idx]!.onlineVotingEnabled = true;
                                setItems(next);
                              }}
                              className="accent-[#008075]"
                            />
                            <span>Sí</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name={`vote-point-${idx}`}
                              checked={!it.onlineVotingEnabled}
                              onChange={() => {
                                const next = [...items];
                                next[idx]!.onlineVotingEnabled = false;
                                setItems(next);
                              }}
                              className="accent-[#008075]"
                            />
                            <span>No</span>
                          </label>
                        </div>
                      </div>

                      {/* Presupuestos */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700">
                            Propuestas / Presupuestos ({it.proposals.length})
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsAddingProposal(true)}
                            className="text-xs font-bold text-[#008075] hover:underline"
                          >
                            + Añadir presupuesto
                          </button>
                        </div>

                        {/* Add proposal mini form */}
                        {isAddingProposal && (
                          <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 space-y-2.5">
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                placeholder="Empresa (ej. Ascensores Madrid S.L.)"
                                value={newPropCompany}
                                onChange={(e) => setNewPropCompany(e.target.value)}
                                className="text-xs h-7.5 bg-white rounded-md"
                              />
                              <Input
                                placeholder="Importe (ej. 2.500 €)"
                                value={newPropAmount}
                                onChange={(e) => setNewPropAmount(e.target.value)}
                                className="text-xs h-7.5 bg-white rounded-md"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setIsAddingProposal(false)}
                                className="px-2 py-1 text-xs text-slate-500"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveProposal}
                                className="px-2.5 py-1 bg-[#008075] text-white text-xs font-bold rounded-md"
                              >
                                Guardar
                              </button>
                            </div>
                          </div>
                        )}

                        {it.proposals.map((p, pIdx) => (
                          <div
                            key={pIdx}
                            className="flex items-center justify-between p-2 rounded bg-slate-50 text-xs"
                          >
                            <span className="font-medium text-slate-800">{p.companyName}</span>
                            <span className="font-bold text-slate-900">{p.amount}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* "¿Cuándo quieres que se active?" */}
      <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900">¿Cuándo quieres que se active?</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Card 1: Ahora */}
          <div
            onClick={() => setActivationType("now")}
            className={`flex items-start gap-2.5 p-3.5 rounded-md border-2 cursor-pointer transition-all ${
              activationType === "now"
                ? "border-[#008075] bg-[#EAF5F2]/30"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="w-7 h-7 rounded-md bg-[#EAF5F2] flex items-center justify-center text-[#008075] shrink-0">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Ahora</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Se activará y se abrirá la votación en cuanto confirmes.
              </div>
            </div>
          </div>

          {/* Card 2: Programar */}
          <div
            onClick={() => setActivationType("schedule")}
            className={`flex items-start gap-2.5 p-3.5 rounded-md border-2 cursor-pointer transition-all ${
              activationType === "schedule"
                ? "border-[#008075] bg-[#EAF5F2]/30"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Programar para más tarde</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Se activará en la fecha y hora que elijas.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="flex items-center justify-end gap-2.5 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-md border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handlePublishMeeting}
          disabled={createMeetingMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#008075] text-xs font-bold text-white hover:bg-[#006e64] transition-colors shadow-2xs"
        >
          {createMeetingMutation.isPending ? "Convocando..." : "Crear junta"}
        </button>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function VotesPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const [activeView, setActiveView] = useState<ActiveView>("list");
  const [selectedDetailSession, setSelectedDetailSession] = useState<any>(null);

  const {
    data: sessions,
    isLoading,
    refetch,
  } = useQuery({
    ...trpc.voting.all.queryOptions({ tenantId: TENANT_ID }),
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (!socket || typeof socket.on !== "function") return;
    const handleUpdate = () => {
      void queryClient.invalidateQueries(trpc.voting.pathFilter());
      void refetch();
    };
    socket.on("voting-created", handleUpdate);
    socket.on("voting-cast", handleUpdate);
    socket.on("voting-closed", handleUpdate);
    socket.on("voting-updated", handleUpdate);
    return () => {
      socket.off?.("voting-created", handleUpdate);
      socket.off?.("voting-cast", handleUpdate);
      socket.off?.("voting-closed", handleUpdate);
      socket.off?.("voting-updated", handleUpdate);
    };
  }, [socket, queryClient, trpc, refetch]);

  const closeMutation = useMutation(
    trpc.voting.close.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.voting.pathFilter());
        void refetch();
      },
    }),
  );

  const handleFinalizeActa = (sessionId: string) => {
    if (confirm("¿Cerrar esta votación y formalizar el acta oficial de escrutinio?")) {
      closeMutation.mutate({ tenantId: TENANT_ID, sessionId });
    }
  };

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto pb-10">
      {/* ── Top Header matching Client Mockups ── */}
      <div className="flex flex-col justify-between gap-3.5 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {activeView === "meeting"
              ? "Crear junta"
              : activeView === "rights"
              ? "Habilitar voto"
              : "Votaciones"}
          </h1>
          <p className="text-slate-500 mt-0.5 text-xs">
            {activeView === "meeting"
              ? "Crea una junta, añade su orden del día y decide qué puntos requieren votación."
              : activeView === "rights"
              ? "Propietarios con recibos pendientes. Puedes habilitar su voto de forma permanente cuando la ley lo permita, indicando el motivo."
              : activeView === "single"
              ? "Crea una votación sobre un tema concreto de la comunidad. Los propietarios podrán elegir entre las opciones que definas."
              : "Gestiona las votaciones de tu comunidad de forma sencilla y eficiente."}
          </p>
        </div>

        {/* Action Switcher Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Button 1: Habilitar voto */}
          <button
            type="button"
            onClick={() => setActiveView(activeView === "rights" ? "list" : "rights")}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold shadow-2xs transition-all ${
              activeView === "rights" || activeView === "list"
                ? "bg-[#008075] text-white hover:bg-[#006e64]"
                : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Habilitar voto
          </button>

          {/* Button 2: Votación sin junta */}
          <button
            type="button"
            onClick={() => setActiveView(activeView === "single" ? "list" : "single")}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold shadow-2xs transition-all ${
              activeView === "single"
                ? "bg-[#008075] text-white hover:bg-[#006e64]"
                : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
            }`}
          >
            <Vote className="h-3.5 w-3.5" />
            Votación sin junta
          </button>

          {/* Button 3: + Nueva junta */}
          <button
            type="button"
            onClick={() => setActiveView(activeView === "meeting" ? "list" : "meeting")}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold shadow-2xs transition-all ${
              activeView === "meeting"
                ? "bg-[#008075] text-white hover:bg-[#006e64]"
                : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva junta
          </button>
        </div>
      </div>

      {/* ── Body based on active view ── */}
      {activeView === "list" && (
        <VotesListView
          sessions={sessions ?? []}
          isLoading={isLoading}
          onOpenDetail={(s) => setSelectedDetailSession(s)}
          onFinalizeActa={handleFinalizeActa}
        />
      )}

      {activeView === "rights" && (
        <VotingRightsView onBack={() => setActiveView("list")} />
      )}

      {activeView === "single" && (
        <CreateSingleVoteView
          onCancel={() => setActiveView("list")}
          onSuccess={() => {
            setActiveView("list");
            void refetch();
          }}
          onManageRights={() => setActiveView("rights")}
        />
      )}

      {activeView === "meeting" && (
        <CreateMeetingView
          onCancel={() => setActiveView("list")}
          onSuccess={() => {
            setActiveView("list");
            void refetch();
          }}
          onManageRights={() => setActiveView("rights")}
        />
      )}

      {/* ── Detail Scrutiny / Minute Modal ── */}
      <SessionDetailModal
        session={selectedDetailSession}
        open={Boolean(selectedDetailSession)}
        onClose={() => setSelectedDetailSession(null)}
        onFinalizeActa={handleFinalizeActa}
      />
    </div>
  );
}
