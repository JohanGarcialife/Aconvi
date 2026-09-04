"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  FileText,
  Layers,
  Play,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  Vote,
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
  DialogTrigger,
} from "@acme/ui/dialog";
import { Input } from "@acme/ui/input";
import { Label } from "@acme/ui/label";
import { Textarea } from "@acme/ui/textarea";

import { useSocket } from "~/app/_components/socket-provider";
import { useTRPC } from "~/trpc/react";
import { CreateMeetingDialog } from "./create-meeting-dialog";
import { VotingRightsDialog } from "./voting-rights-dialog";

const TENANT_ID = "org_aconvi_demo";

const STATUS_META = {
  DRAFT: {
    label: "Borrador",
    color: "text-muted-foreground bg-muted border-border",
    icon: FileText,
  },
  OPEN: {
    label: "Abierta",
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    icon: Play,
  },
  CLOSED: {
    label: "Cerrada",
    color: "text-blue-600 bg-blue-50 border-blue-200",
    icon: CheckCircle2,
  },
} as const;

// ─── Create Session Dialog ────────────────────────────────────────────────────
function CreateSessionDialog({ onSuccess }: { onSuccess: () => void }) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"SINGLE" | "JUNTA">("SINGLE");
  const [title, setTitle] = useState("");
  const [budget, setBudget] = useState("");
  const [description, setDescription] = useState("");
  const [closesAt, setClosesAt] = useState("");

  // Presupuestos / alternativas de empresas
  const [proposals, setProposals] = useState<
    Array<{
      companyName: string;
      amount: string;
      description: string;
      fileUrl: string;
    }>
  >([]);

  // Multi-point items for Junta (starts empty)
  const [items, setItems] = useState<
    Array<{ title: string; budget: string; onlineVotingEnabled: boolean }>
  >([{ title: "", budget: "", onlineVotingEnabled: true }]);

  const createMutation = useMutation(
    trpc.voting.create.mutationOptions({
      onSuccess: (data) => {
        setOpen(false);
        setTitle("");
        setBudget("");
        setDescription("");
        setClosesAt("");
        setType("SINGLE");
        setItems([{ title: "", budget: "", onlineVotingEnabled: true }]);
        setProposals([]);
        if (data.warning) {
          alert(data.warning);
        }
        onSuccess();
      },
      onError: (err: any) => {
        alert(
          err?.message || "Error al publicar la votación. Inténtalo de nuevo.",
        );
      },
    }),
  );

  const addItem = () => {
    setItems([...items, { title: "", budget: "", onlineVotingEnabled: true }]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const next = [...items];
    if (next[index]) {
      next[index] = { ...next[index]!, [field]: value };
      setItems(next);
    }
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      alert("Por favor introduce el asunto o título de la votación.");
      return;
    }

    let parsedClosesAt: string | undefined = undefined;
    if (closesAt && closesAt.trim()) {
      const d = new Date(closesAt);
      if (!isNaN(d.getTime())) {
        parsedClosesAt = d.toISOString();
      }
    }

    const validItems = items
      .filter((i) => i.title.trim())
      .map((i) => ({
        title: i.title.trim(),
        budget: i.budget.trim() || undefined,
        onlineVotingEnabled: i.onlineVotingEnabled,
      }));

    if (type === "JUNTA" && validItems.length === 0) {
      alert("Debes añadir al menos un punto del orden del día para la junta.");
      return;
    }

    const validProposals = proposals
      .filter((p) => p.companyName.trim())
      .map((p) => ({
        companyName: p.companyName.trim(),
        amount: p.amount.trim(),
        description: p.description.trim() || undefined,
        fileUrl: p.fileUrl.trim() || undefined,
        fileName: p.fileUrl ? "Presupuesto.pdf" : undefined,
      }));

    createMutation.mutate({
      tenantId: TENANT_ID,
      type,
      title: cleanTitle,
      budget: type === "SINGLE" ? budget.trim() || undefined : undefined,
      description: description.trim() || undefined,
      closesAt: parsedClosesAt,
      items: type === "JUNTA" ? validItems : undefined,
      budgetProposals:
        type === "SINGLE" && validProposals.length > 0
          ? validProposals
          : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#027580] font-bold text-white shadow-sm hover:bg-[#015A63]">
          <Plus className="mr-2 h-4 w-4" />
          Decisión Rápida
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nueva Sesión de Votación</DialogTitle>
          <DialogDescription>
            Crea una votación o junta extraordinaria para tu comunidad. Los
            vecinos recibirán una notificación push.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Tipo de Votación */}
          <div className="grid gap-2">
            <Label>Tipo de Votación</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType("SINGLE")}
                className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-all ${
                  type === "SINGLE"
                    ? "border-[#027580] bg-[#027580]/5 text-[#027580]"
                    : "border-border text-muted-foreground hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-1.5 text-sm font-bold">
                  <Vote className="h-4 w-4" />
                  Decisión sin Junta
                </div>
                <p className="text-muted-foreground text-xs">
                  Un único asunto puntual para resolver rápidamente.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setType("JUNTA")}
                className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-all ${
                  type === "JUNTA"
                    ? "border-[#027580] bg-[#027580]/5 text-[#027580]"
                    : "border-border text-muted-foreground hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-1.5 text-sm font-bold">
                  <Layers className="h-4 w-4" />
                  Junta Extraordinaria
                </div>
                <p className="text-muted-foreground text-xs">
                  Varios puntos del orden del día en una sola sesión.
                </p>
              </button>
            </div>
          </div>

          {/* Título de la Junta o Asunto */}
          <div className="grid gap-2">
            <Label htmlFor="vote-title">
              {type === "JUNTA" ? "Título de la Junta *" : "Asunto a Votar *"}
            </Label>
            <Input
              id="vote-title"
              placeholder={
                type === "JUNTA"
                  ? "Ej: Junta General Extraordinaria 2026"
                  : "Ej: Reparación del ascensor principal"
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Presupuesto (solo en Single) */}
          {type === "SINGLE" && (
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="vote-budget">
                  Presupuesto estimado (opcional)
                </Label>
                <Input
                  id="vote-budget"
                  placeholder="Ej: 5.500 €"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </div>

              {/* Presupuestos y Alternativas de distintas empresas */}
              <div className="grid gap-3 rounded-xl border bg-slate-50/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-bold text-slate-800">
                      Presupuestos / Alternativas de Empresas
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      Añade diferentes empresas con su presupuesto y enlace al
                      PDF.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setProposals([
                        ...proposals,
                        {
                          companyName: "",
                          amount: "",
                          description: "",
                          fileUrl: "",
                        },
                      ])
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Añadir empresa
                  </Button>
                </div>

                {proposals.length > 0 && (
                  <div className="space-y-2">
                    {proposals.map((prop, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-lg border bg-white p-2.5 text-xs shadow-xs"
                      >
                        <Input
                          placeholder="Empresa (ej: Ascensores S.L.)"
                          value={prop.companyName}
                          onChange={(e) => {
                            const next = [...proposals];
                            next[idx]!.companyName = e.target.value;
                            setProposals(next);
                          }}
                          className="flex-1 text-xs"
                        />
                        <Input
                          placeholder="Importe (ej: 5.500 €)"
                          value={prop.amount}
                          onChange={(e) => {
                            const next = [...proposals];
                            next[idx]!.amount = e.target.value;
                            setProposals(next);
                          }}
                          className="w-28 text-xs"
                        />
                        <Input
                          placeholder="URL PDF presupuesto"
                          value={prop.fileUrl}
                          onChange={(e) => {
                            const next = [...proposals];
                            next[idx]!.fileUrl = e.target.value;
                            setProposals(next);
                          }}
                          className="flex-1 text-xs"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setProposals(proposals.filter((_, i) => i !== idx))
                          }
                          className="h-8 w-8 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Puntos del orden del día (solo en Junta) */}
          {type === "JUNTA" && (
            <div className="grid gap-3 rounded-xl border bg-slate-50/50 p-4">
              <div className="flex items-center justify-between">
                <Label className="font-bold text-slate-800">
                  Puntos del Orden del Día
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Añadir punto
                </Button>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-lg border bg-white p-2.5 shadow-xs"
                  >
                    <span className="w-5 text-center text-xs font-bold text-slate-400">
                      {idx + 1}.
                    </span>
                    <Input
                      placeholder="Título del punto a votar..."
                      value={item.title}
                      onChange={(e) => updateItem(idx, "title", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Importe (ej: 1.200 €)"
                      value={item.budget}
                      onChange={(e) =>
                        updateItem(idx, "budget", e.target.value)
                      }
                      className="w-36"
                    />
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(idx)}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Descripción */}
          <div className="grid gap-2">
            <Label htmlFor="vote-desc">
              Descripción o Explicación (opcional)
            </Label>
            <Textarea
              id="vote-desc"
              placeholder="Detalles sobre los acuerdos a adoptar..."
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
            />
          </div>

          {/* Fecha Límite */}
          <div className="grid gap-2">
            <Label htmlFor="closes-at">
              Fecha límite de votación (opcional)
            </Label>
            <Input
              id="closes-at"
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              onClick={(e) => {
                try {
                  (e.currentTarget as HTMLInputElement).showPicker?.();
                } catch {}
              }}
              className="cursor-pointer"
            />
          </div>

          {/* Opciones Estandarizadas Info */}
          <div className="flex items-center gap-2 rounded-xl border bg-emerald-50/60 p-3 text-xs text-emerald-800">
            <span>⚖️</span>
            <span>
              <strong>Opciones legales fijas:</strong> Los vecinos votarán con{" "}
              <strong>Apruebo • Rechazo • Me abstengo</strong>, con ponderación
              por coeficiente de propiedad.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={createMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || createMutation.isPending}
            className="bg-[#027580] font-bold text-white hover:bg-[#015A63]"
          >
            {createMutation.isPending ? "Creando..." : "🗳️ Publicar Votación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
  const pct = totalWeighted > 0 ? (weighted / totalWeighted) * 100 : 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="text-slate-500">
          {count} votos · {pct.toFixed(1)}% coef.
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────
function SessionCard({
  session,
  onClose,
}: {
  session: any;
  onClose: (id: string) => void;
}) {
  const meta =
    STATUS_META[session.status as keyof typeof STATUS_META] ?? STATUS_META.OPEN;
  const isJunta = session.type === "JUNTA";
  const totalVotes = session.casts?.length ?? 0;

  const [isDownloading, setIsDownloading] = useState(false);
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

  // Compute breakdown
  const approveCount =
    session.casts?.filter((c: any) => c.choice === "APPROVE").length ?? 0;
  const rejectCount =
    session.casts?.filter((c: any) => c.choice === "REJECT").length ?? 0;
  const abstainCount =
    session.casts?.filter((c: any) => c.choice === "ABSTAIN").length ?? 0;

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
    <div className="flex flex-col rounded-2xl border bg-white p-5 shadow-xs transition-all hover:shadow-md">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-[11px] font-bold ${
                isJunta
                  ? "border-teal-200 bg-teal-50 text-teal-800"
                  : "border-slate-200 bg-slate-100 text-slate-700"
              }`}
            >
              {isJunta ? "Junta Extraordinaria" : "Decisión sin Junta"}
            </Badge>
            {session.budget && (
              <Badge
                variant="outline"
                className="border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-700"
              >
                {session.budget}
              </Badge>
            )}
          </div>
          <h3 className="text-base leading-tight font-bold text-slate-900">
            {session.title}
          </h3>
          {session.description && (
            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
              {session.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant="outline" className={`border text-xs ${meta.color}`}>
            {meta.label}
          </Badge>
          {session.isArchived && (
            <Badge
              variant="outline"
              className="border-slate-200 bg-slate-100 text-[10px] text-slate-600"
            >
              Histórico
            </Badge>
          )}
        </div>
      </div>

      {/* Official Result Banner for Closed Sessions */}
      {session.status === "CLOSED" && session.resultSummary && (
        <div className="my-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
          <span className="mb-0.5 block text-[10px] font-extrabold tracking-wider text-emerald-800 uppercase">
            Resultado Final de la Votación
          </span>
          <span className="text-sm font-extrabold text-emerald-900">
            {session.resultSummary}
          </span>
        </div>
      )}

      {/* Points (if Junta) */}
      {isJunta && session.items && session.items.length > 0 && (
        <div className="my-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
          <p className="mb-2 text-xs font-bold text-slate-600">
            Orden del día ({session.items.length} puntos):
          </p>
          <div className="space-y-1.5">
            {session.items.map((item: any, idx: number) => (
              <div
                key={item.id}
                className="flex items-center justify-between border-b border-slate-100 py-1 text-xs last:border-b-0"
              >
                <div className="flex min-w-0 flex-1 items-center gap-1.5 pr-2">
                  <span className="truncate font-medium text-slate-700">
                    {idx + 1}. {item.title}
                  </span>
                  <span
                    className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[9px] font-bold ${
                      item.onlineVotingEnabled
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {item.onlineVotingEnabled ? "Voto Online" : "Presencial"}
                  </span>
                </div>
                {item.budget && (
                  <span className="shrink-0 font-bold text-teal-600">
                    {item.budget}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget Proposals / Alternativas de empresas */}
      {session.budgetProposals && session.budgetProposals.length > 0 && (
        <div className="my-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs">
          <p className="mb-1 font-bold text-slate-700">
            Presupuestos / Alternativas de empresas (
            {session.budgetProposals.length}):
          </p>
          <div className="space-y-1">
            {session.budgetProposals.map((bp: any) => (
              <div
                key={bp.id}
                className="flex items-center justify-between rounded-md border border-slate-100 bg-white p-1.5"
              >
                <div>
                  <span className="font-semibold text-slate-900">
                    {bp.companyName}
                  </span>
                  {bp.description && (
                    <span className="text-muted-foreground block text-[11px]">
                      {bp.description}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-teal-700">{bp.amount}</span>
                  {bp.fileUrl && (
                    <a
                      href={bp.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-medium text-blue-600 hover:underline"
                    >
                      PDF ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global Results Bar */}
      {totalVotes > 0 && (
        <div className="my-2 flex flex-col gap-2 border-t border-b py-3">
          <ResultBar
            label="Apruebo"
            count={approveCount}
            weighted={approveWeight}
            totalWeighted={totalWeight}
            color="bg-emerald-500"
          />
          <ResultBar
            label="Rechazo"
            count={rejectCount}
            weighted={rejectWeight}
            totalWeighted={totalWeight}
            color="bg-rose-500"
          />
          <ResultBar
            label="Me abstengo"
            count={abstainCount}
            weighted={abstainWeight}
            totalWeighted={totalWeight}
            color="bg-slate-400"
          />
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between pt-2">
        <div className="text-muted-foreground flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 font-medium">
            <Users className="h-3.5 w-3.5" />
            {totalVotes} {totalVotes === 1 ? "voto" : "votos"}
          </span>
          {session.closesAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {format(new Date(session.closesAt), "d MMM HH:mm", {
                locale: es,
              })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {session.status === "CLOSED" && session.minute && (
            <Button
              variant="outline"
              size="sm"
              onClick={downloadPdf}
              disabled={isDownloading}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {isDownloading ? "Generando..." : "Acta PDF"}
            </Button>
          )}
          {session.status === "OPEN" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onClose(session.id)}
            >
              <FileCheck className="mr-1.5 h-3.5 w-3.5" />
              Cerrar y generar acta
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function VotesPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const [statusFilter, setStatusFilter] = useState("ALL");

  const {
    data: sessions,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    ...trpc.voting.all.queryOptions({ tenantId: TENANT_ID }),
    refetchInterval: 2500,
  });

  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      void queryClient.invalidateQueries(trpc.voting.pathFilter());
      void refetch();
    };

    socket.on("voting-created", handleUpdate);
    socket.on("voting-cast", handleUpdate);
    socket.on("voting-closed", handleUpdate);
    socket.on("voting-updated", handleUpdate);

    return () => {
      socket.off("voting-created", handleUpdate);
      socket.off("voting-cast", handleUpdate);
      socket.off("voting-closed", handleUpdate);
      socket.off("voting-updated", handleUpdate);
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

  const refresh = () => {
    void queryClient.invalidateQueries(trpc.voting.pathFilter());
    void refetch();
  };

  const counts = {
    ALL: sessions?.length ?? 0,
    OPEN: sessions?.filter((s: any) => s.status === "OPEN").length ?? 0,
    RECENT:
      sessions?.filter((s: any) => s.status === "CLOSED" && !s.isArchived)
        .length ?? 0,
    ARCHIVED: sessions?.filter((s: any) => s.isArchived).length ?? 0,
  };

  const filtered =
    statusFilter === "ALL"
      ? sessions
      : statusFilter === "OPEN"
        ? sessions?.filter((s: any) => s.status === "OPEN")
        : statusFilter === "RECENT"
          ? sessions?.filter((s: any) => s.status === "CLOSED" && !s.isArchived)
          : sessions?.filter((s: any) => s.isArchived);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Votaciones Online
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Decisiones sencillas y juntas extraordinarias conforme a la LPH con
            ponderación por coeficientes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <VotingRightsDialog />
          <CreateMeetingDialog onSuccess={refresh} />
          <CreateSessionDialog onSuccess={refresh} />
        </div>
      </div>

      {/* Warning banner when >= 2 active open sessions */}
      {counts.OPEN >= 2 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-xs">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <span className="font-bold">
              Aviso del sistema — Límite de 2 votaciones en primer plano:
            </span>{" "}
            Actualmente hay {counts.OPEN} votaciones abiertas. En la App del
            vecino se mostrarán un máximo de 2 en primer plano ordenadas por
            fecha de cierre y prioridad; el resto se trasladará automáticamente
            a &apos;Otras votaciones pendientes&apos;.
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          {
            label: "Total Votaciones",
            value: counts.ALL,
            icon: Vote,
            color: "text-foreground bg-muted/30 border-border",
          },
          {
            label: "Votaciones Abiertas",
            value: counts.OPEN,
            icon: Play,
            color: "text-emerald-600 bg-emerald-50 border-emerald-100",
          },
          {
            label: "Cerradas Recientes",
            value: counts.RECENT,
            icon: CheckCircle2,
            color: "text-blue-600 bg-blue-50 border-blue-100",
          },
          {
            label: "Histórico (>48h)",
            value: counts.ARCHIVED,
            icon: Clock,
            color: "text-slate-600 bg-slate-100 border-slate-200",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`rounded-xl border p-3.5 ${color}`}>
            <div className="mb-1 flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <span className="text-xs font-medium">{label}</span>
            </div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "ALL", label: "Todas" },
          { key: "OPEN", label: "Abiertas" },
          { key: "RECENT", label: "Cerradas Recientes (<48h)" },
          { key: "ARCHIVED", label: "Histórico (>48h)" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === key
                ? "border-[#027580] bg-[#027580] text-white shadow-xs"
                : "border-border text-muted-foreground hover:text-foreground hover:border-[#027580]/40"
            }`}
          >
            {label}
            <span
              className={`py-0.2 rounded-full px-1.5 text-[10px] font-bold ${
                statusFilter === key ? "bg-white/20 text-white" : "bg-muted"
              }`}
            >
              {counts[key as keyof typeof counts]}
            </span>
          </button>
        ))}
      </div>

      {/* Sessions Grid */}
      {isLoading ? (
        <div className="text-muted-foreground py-8 text-center text-sm">
          Cargando votaciones...
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 py-12 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-rose-500" />
          <p className="text-sm font-bold text-rose-800">
            Error al sincronizar las votaciones
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-rose-600">
            {error?.message || "No se ha podido conectar con el servidor."}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            className="mt-4"
          >
            Reintentar
          </Button>
        </div>
      ) : !filtered?.length ? (
        <div className="rounded-2xl border bg-slate-50/50 py-16 text-center">
          <Vote className="text-muted-foreground mx-auto mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm font-medium text-slate-600">
            No hay votaciones en esta sección.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered?.map((session: any) => (
            <SessionCard
              key={session.id}
              session={session}
              onClose={(id) => {
                if (
                  confirm(
                    "¿Cerrar esta votación y generar el acta oficial con el escrutinio final?",
                  )
                ) {
                  closeMutation.mutate({ tenantId: TENANT_ID, sessionId: id });
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
