"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useTRPC } from "~/trpc/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";
import { Label } from "@acme/ui/label";
import { Textarea } from "@acme/ui/textarea";
import { Badge } from "@acme/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@acme/ui/dialog";
import {
  Vote,
  Plus,
  Play,
  Square,
  FileText,
  Download,
  Users,
  CheckCircle2,
  Clock,
  Trash2,
  Layers,
} from "lucide-react";

const TENANT_ID = "org_aconvi_demo";

const STATUS_META = {
  DRAFT: { label: "Borrador", color: "text-muted-foreground bg-muted border-border", icon: FileText },
  OPEN: { label: "Abierta", color: "text-emerald-600 bg-emerald-50 border-emerald-200", icon: Play },
  CLOSED: { label: "Cerrada", color: "text-blue-600 bg-blue-50 border-blue-200", icon: CheckCircle2 },
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

  // Multi-point items for Junta
  const [items, setItems] = useState<Array<{ title: string; budget: string }>>([
    { title: "Reparación del ascensor", budget: "5.500 €" },
    { title: "Cambio de empresa de limpieza", budget: "1.200 €" },
    { title: "Aprobación de cuentas del ejercicio", budget: "" },
  ]);

  const createMutation = useMutation(
    trpc.voting.create.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        setTitle("");
        setBudget("");
        setDescription("");
        setClosesAt("");
        setType("SINGLE");
        setItems([
          { title: "Reparación del ascensor", budget: "5.500 €" },
          { title: "Cambio de empresa de limpieza", budget: "1.200 €" },
        ]);
        onSuccess();
      },
    }),
  );

  const addItem = () => {
    setItems([...items, { title: "", budget: "" }]);
  };

  const updateItem = (index: number, field: "title" | "budget", value: string) => {
    const next = [...items];
    if (next[index]) {
      next[index] = { ...next[index], [field]: value };
      setItems(next);
    }
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#009689] hover:bg-[#007f74] text-white">
          <Plus className="mr-2 h-4 w-4" />
          Nueva Votación
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Sesión de Votación</DialogTitle>
          <DialogDescription>
            Crea una votación o junta extraordinaria para tu comunidad. Los vecinos recibirán una notificación push.
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
                    ? "border-[#009689] bg-[#009689]/5 text-[#009689]"
                    : "border-border text-muted-foreground hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-sm">
                  <Vote className="h-4 w-4" />
                  Decisión sin Junta
                </div>
                <p className="text-xs text-muted-foreground">
                  Un único asunto puntual para resolver rápidamente.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setType("JUNTA")}
                className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-all ${
                  type === "JUNTA"
                    ? "border-[#5B21B6] bg-[#5B21B6]/5 text-[#5B21B6]"
                    : "border-border text-muted-foreground hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-sm">
                  <Layers className="h-4 w-4" />
                  Junta Extraordinaria
                </div>
                <p className="text-xs text-muted-foreground">
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
              placeholder={type === "JUNTA" ? "Ej: Junta General Extraordinaria 2026" : "Ej: Reparación del ascensor"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Presupuesto (solo en Single) */}
          {type === "SINGLE" && (
            <div className="grid gap-2">
              <Label htmlFor="vote-budget">Presupuesto estimado (opcional)</Label>
              <Input
                id="vote-budget"
                placeholder="Ej: 5.500 €"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
          )}

          {/* Puntos del orden del día (solo en Junta) */}
          {type === "JUNTA" && (
            <div className="grid gap-3 rounded-xl border bg-slate-50/50 p-4">
              <div className="flex items-center justify-between">
                <Label className="font-bold text-slate-800">Puntos del Orden del Día</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Añadir punto
                </Button>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-lg border bg-white p-2.5 shadow-xs">
                    <span className="font-bold text-xs text-slate-400 w-5 text-center">{idx + 1}.</span>
                    <Input
                      placeholder="Título del punto a votar..."
                      value={item.title}
                      onChange={(e) => updateItem(idx, "title", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Importe (ej: 1.200 €)"
                      value={item.budget}
                      onChange={(e) => updateItem(idx, "budget", e.target.value)}
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
            <Label htmlFor="vote-desc">Descripción o Explicación (opcional)</Label>
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
            <Label htmlFor="closes-at">Fecha límite de votación (opcional)</Label>
            <Input
              id="closes-at"
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </div>

          {/* Opciones Estandarizadas Info */}
          <div className="rounded-xl border bg-emerald-50/60 p-3 text-xs text-emerald-800 flex items-center gap-2">
            <span>⚖️</span>
            <span>
              <strong>Opciones legales fijas:</strong> Los vecinos votarán con <strong>Apruebo • Rechazo • Me abstengo</strong>, con ponderación por coeficiente de propiedad.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              createMutation.mutate({
                tenantId: TENANT_ID,
                type,
                title,
                budget: type === "SINGLE" ? budget : undefined,
                description: description || undefined,
                closesAt: closesAt ? new Date(closesAt).toISOString() : undefined,
                items: type === "JUNTA" ? items.filter((i) => i.title.trim()) : undefined,
              })
            }
            disabled={!title.trim() || (type === "JUNTA" && items.filter((i) => i.title.trim()).length === 0) || createMutation.isPending}
            className="bg-[#009689] hover:bg-[#007f74] text-white font-bold"
          >
            {createMutation.isPending ? "Creando..." : "🗳️ Publicar Votación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Results Bar ──────────────────────────────────────────────────────────────
function ResultBar({ label, count, weighted, totalWeighted, color }: {
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
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
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
  const meta = STATUS_META[session.status as keyof typeof STATUS_META] ?? STATUS_META.OPEN;
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
  const approveCount = session.casts?.filter((c: any) => c.choice === "APPROVE").length ?? 0;
  const rejectCount = session.casts?.filter((c: any) => c.choice === "REJECT").length ?? 0;
  const abstainCount = session.casts?.filter((c: any) => c.choice === "ABSTAIN").length ?? 0;

  const approveWeight = session.casts?.filter((c: any) => c.choice === "APPROVE").reduce((s: number, c: any) => s + (c.coefficient || 1), 0) ?? 0;
  const rejectWeight = session.casts?.filter((c: any) => c.choice === "REJECT").reduce((s: number, c: any) => s + (c.coefficient || 1), 0) ?? 0;
  const abstainWeight = session.casts?.filter((c: any) => c.choice === "ABSTAIN").reduce((s: number, c: any) => s + (c.coefficient || 1), 0) ?? 0;
  const totalWeight = approveWeight + rejectWeight + abstainWeight;

  return (
    <div className="flex flex-col rounded-2xl border bg-white p-5 shadow-xs hover:shadow-md transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className={`text-[11px] font-bold ${
                isJunta ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-teal-50 text-teal-700 border-teal-200"
              }`}
            >
              {isJunta ? "Junta Extraordinaria" : "Decisión sin Junta"}
            </Badge>
            {session.budget && (
              <Badge variant="outline" className="text-[11px] font-bold bg-slate-50 text-slate-700 border-slate-200">
                {session.budget}
              </Badge>
            )}
          </div>
          <h3 className="font-bold text-base text-slate-900 leading-tight">{session.title}</h3>
          {session.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{session.description}</p>
          )}
        </div>
        <Badge variant="outline" className={`shrink-0 text-xs border ${meta.color}`}>
          {meta.label}
        </Badge>
      </div>

      {/* Points (if Junta) */}
      {isJunta && session.items && session.items.length > 0 && (
        <div className="my-2 rounded-xl bg-slate-50/80 p-3 border border-slate-100">
          <p className="text-xs font-bold text-slate-600 mb-2">Orden del día ({session.items.length} puntos):</p>
          <div className="space-y-1.5">
            {session.items.map((item: any, idx: number) => (
              <div key={item.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-700 font-medium">
                  {idx + 1}. {item.title}
                </span>
                {item.budget && <span className="font-bold text-teal-600">{item.budget}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global Results Bar */}
      {totalVotes > 0 && (
        <div className="flex flex-col gap-2 py-3 border-t border-b my-2">
          <ResultBar label="Apruebo" count={approveCount} weighted={approveWeight} totalWeighted={totalWeight} color="bg-emerald-500" />
          <ResultBar label="Rechazo" count={rejectCount} weighted={rejectWeight} totalWeighted={totalWeight} color="bg-rose-500" />
          <ResultBar label="Me abstengo" count={abstainCount} weighted={abstainWeight} totalWeighted={totalWeight} color="bg-slate-400" />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 font-medium">
            <Users className="h-3.5 w-3.5" />
            {totalVotes} {totalVotes === 1 ? "voto" : "votos"}
          </span>
          {session.closesAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {format(new Date(session.closesAt), "d MMM HH:mm", { locale: es })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {session.status === "CLOSED" && session.minute && (
            <Button variant="outline" size="sm" onClick={downloadPdf} disabled={isDownloading}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {isDownloading ? "Generando..." : "Acta PDF"}
            </Button>
          )}
          {session.status === "OPEN" && (
            <Button size="sm" variant="destructive" onClick={() => onClose(session.id)}>
              <Square className="h-3.5 w-3.5 mr-1.5" />
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
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { data: sessions, isLoading } = useQuery(
    trpc.voting.all.queryOptions({ tenantId: TENANT_ID }),
  );

  const closeMutation = useMutation(
    trpc.voting.close.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(
          trpc.voting.all.queryFilter({ tenantId: TENANT_ID }),
        ),
    }),
  );

  const refresh = () =>
    queryClient.invalidateQueries(
      trpc.voting.all.queryFilter({ tenantId: TENANT_ID }),
    );

  const filtered =
    statusFilter === "ALL"
      ? sessions
      : sessions?.filter((s: any) => s.status === statusFilter);

  const counts = {
    ALL: sessions?.length ?? 0,
    OPEN: sessions?.filter((s: any) => s.status === "OPEN").length ?? 0,
    CLOSED: sessions?.filter((s: any) => s.status === "CLOSED").length ?? 0,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Votaciones Online</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Decisiones sencillas y juntas extraordinarias conforme a la ley con ponderación por coeficientes.
          </p>
        </div>
        <CreateSessionDialog onSuccess={refresh} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Votaciones", value: counts.ALL, icon: Vote, color: "text-foreground bg-muted/30 border-border" },
          { label: "Votaciones Abiertas", value: counts.OPEN, icon: Play, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
          { label: "Votaciones Cerradas", value: counts.CLOSED, icon: CheckCircle2, color: "text-blue-600 bg-blue-50 border-blue-100" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`rounded-xl border p-4 ${color}`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-4 w-4" />
              <span className="text-xs font-medium">{label}</span>
            </div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[
          { key: "ALL", label: "Todas" },
          { key: "OPEN", label: "Abiertas" },
          { key: "CLOSED", label: "Cerradas" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
              statusFilter === key
                ? "bg-[#009689] text-white border-[#009689]"
                : "border-border text-muted-foreground hover:border-[#009689]/40 hover:text-foreground"
            }`}
          >
            {label}
            <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
              statusFilter === key ? "bg-white/20 text-white" : "bg-muted"
            }`}>
              {counts[key as keyof typeof counts]}
            </span>
          </button>
        ))}
      </div>

      {/* Sessions Grid */}
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Cargando votaciones...</div>
      ) : !filtered?.length ? (
        <div className="py-16 text-center border rounded-2xl bg-slate-50/50">
          <Vote className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-40" />
          <p className="text-slate-600 font-medium text-sm">
            No hay votaciones en esta vista. Crea la primera sesión.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered?.map((session: any) => (
            <SessionCard
              key={session.id}
              session={session}
              onClose={(id) => {
                if (confirm("¿Cerrar esta votación y generar el acta oficial con el escrutinio final?")) {
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
