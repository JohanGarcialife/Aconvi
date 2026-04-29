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
  X,
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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<string[]>(["A favor", "En contra", "Abstención"]);
  const [newOption, setNewOption] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [coefficientWeighted, setCoefficientWeighted] = useState(false);

  const createMutation = useMutation(
    trpc.voting.create.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        setTitle("");
        setDescription("");
        setOptions(["A favor", "En contra", "Abstención"]);
        setNewOption("");
        setClosesAt("");
        setCoefficientWeighted(false);
        onSuccess();
      },
    }),
  );

  const addOption = () => {
    const trimmed = newOption.trim();
    if (trimmed && !options.includes(trimmed) && options.length < 10) {
      setOptions([...options, trimmed]);
      setNewOption("");
    }
  };

  const removeOption = (idx: number) => {
    if (options.length > 2) setOptions(options.filter((_, i) => i !== idx));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Votación
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva sesión de votación</DialogTitle>
          <DialogDescription>
            Crea una votación para tu comunidad. Los vecinos recibirán una notificación.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="vote-title">Asunto *</Label>
            <Input
              id="vote-title"
              placeholder="Ej: Aprobación obras piscina comunitaria"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="vote-desc">Descripción</Label>
            <Textarea
              id="vote-desc"
              placeholder="Explica el motivo de la votación..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
            />
          </div>

          <div className="grid gap-2">
            <Label>Opciones de voto (mín. 2)</Label>
            <div className="flex flex-col gap-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                    {opt}
                  </div>
                  {options.length > 2 && (
                    <button
                      onClick={() => removeOption(idx)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {options.length < 10 && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Añadir opción..."
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addOption()}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addOption}>
                    Añadir
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="closes-at">Fecha límite (opcional)</Label>
            <Input
              id="closes-at"
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3">
            <button
              type="button"
              onClick={() => setCoefficientWeighted(!coefficientWeighted)}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                coefficientWeighted ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  coefficientWeighted ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
            <div>
              <p className="text-sm font-medium">Ponderación por coeficiente</p>
              <p className="text-xs text-muted-foreground">
                El peso del voto se calcula según el coeficiente de participación del vecino.
              </p>
            </div>
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
                title,
                description: description || undefined,
                options,
                closesAt: closesAt ? new Date(closesAt).toISOString() : undefined,
                coefficientWeighted,
              })
            }
            disabled={!title.trim() || options.length < 2 || createMutation.isPending}
          >
            {createMutation.isPending ? "Creando..." : "🗳️ Crear votación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Results Bar ──────────────────────────────────────────────────────────────
function ResultBar({ label, count, weighted, total, totalWeighted, isWeighted, isWinner }: {
  label: string;
  count: number;
  weighted: number;
  total: number;
  totalWeighted: number;
  isWeighted: boolean;
  isWinner: boolean;
}) {
  const pct = isWeighted
    ? totalWeighted > 0 ? (weighted / totalWeighted) * 100 : 0
    : total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${isWinner ? "text-primary" : ""}`}>
          {isWinner && "🏆 "}{label}
        </span>
        <span className="text-sm text-muted-foreground">
          {count} votos · {pct.toFixed(1)}%
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isWinner ? "bg-primary" : "bg-primary/40"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────
function SessionCard({
  session,
  onOpen,
  onClose,
}: {
  session: any;
  onOpen: (id: string) => void;
  onClose: (id: string) => void;
}) {
  const meta = STATUS_META[session.status as keyof typeof STATUS_META] ?? STATUS_META.DRAFT;
  const Icon = meta.icon;
  const totalVotes = session.casts?.length ?? 0;
  const totalWeighted = session.options?.reduce((acc: number, o: any) => acc + o.weightedTotal, 0) ?? 0;

  const winnerOption = session.status === "CLOSED"
    ? [...(session.options ?? [])].sort((a: any, b: any) =>
        session.coefficientWeighted ? b.weightedTotal - a.weightedTotal : b.voteCount - a.voteCount
      )[0]
    : null;

  const downloadMinute = () => {
    if (!session.minute?.content) return;
    const blob = new Blob([session.minute.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `acta-${session.title.toLowerCase().replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col rounded-xl border bg-card p-5 shadow-xs hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base leading-tight">{session.title}</h3>
          {session.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{session.description}</p>
          )}
        </div>
        <Badge variant="outline" className={`shrink-0 text-xs border ${meta.color}`}>
          <Icon className="h-3 w-3 mr-1" />
          {meta.label}
        </Badge>
      </div>

      {/* Options / Results */}
      {session.status !== "DRAFT" && (session.options?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-2.5 py-3 border-t border-b mb-3">
          {session.options.map((opt: any) => (
            <ResultBar
              key={opt.id}
              label={opt.label}
              count={opt.voteCount}
              weighted={opt.weightedTotal}
              total={totalVotes}
              totalWeighted={totalWeighted}
              isWeighted={session.coefficientWeighted}
              isWinner={winnerOption?.id === opt.id}
            />
          ))}
        </div>
      )}

      {session.status === "DRAFT" && (
        <div className="flex flex-wrap gap-1.5 py-3 border-t border-b mb-3">
          {session.options?.map((opt: any) => (
            <Badge key={opt.id} variant="secondary" className="text-xs">{opt.label}</Badge>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {totalVotes} votos
          </span>
          {session.coefficientWeighted && (
            <Badge variant="outline" className="text-xs">Ponderada</Badge>
          )}
          {session.closesAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Cierre: {format(new Date(session.closesAt), "d MMM HH:mm", { locale: es })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {session.status === "CLOSED" && session.minute && (
            <Button variant="outline" size="sm" onClick={downloadMinute}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Acta
            </Button>
          )}
          {session.status === "DRAFT" && (
            <Button size="sm" onClick={() => onOpen(session.id)}>
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Abrir votación
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

  const openMutation = useMutation(
    trpc.voting.open.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(
          trpc.voting.all.queryFilter({ tenantId: TENANT_ID }),
        ),
    }),
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
    DRAFT: sessions?.filter((s: any) => s.status === "DRAFT").length ?? 0,
    OPEN: sessions?.filter((s: any) => s.status === "OPEN").length ?? 0,
    CLOSED: sessions?.filter((s: any) => s.status === "CLOSED").length ?? 0,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Votaciones Online</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gestiona las votaciones de la comunidad. Crea, abre, cierra y descarga actas.
          </p>
        </div>
        <CreateSessionDialog onSuccess={refresh} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: counts.ALL, icon: Vote, color: "text-foreground bg-muted/30 border-border" },
          { label: "Borradores", value: counts.DRAFT, icon: FileText, color: "text-muted-foreground bg-muted/20 border-border" },
          { label: "Abiertas", value: counts.OPEN, icon: Play, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
          { label: "Cerradas", value: counts.CLOSED, icon: CheckCircle2, color: "text-blue-600 bg-blue-50 border-blue-100" },
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
          { key: "DRAFT", label: "Borradores" },
          { key: "OPEN", label: "Abiertas" },
          { key: "CLOSED", label: "Cerradas" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
              statusFilter === key
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {label}
            <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
              statusFilter === key ? "bg-white/20" : "bg-muted"
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
        <div className="py-16 text-center border rounded-xl bg-muted/20">
          <Vote className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-40" />
          <p className="text-muted-foreground text-sm">
            No hay votaciones. Crea la primera sesión.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered?.map((session: any) => (
            <SessionCard
              key={session.id}
              session={session}
              onOpen={(id) => openMutation.mutate({ tenantId: TENANT_ID, sessionId: id })}
              onClose={(id) => {
                if (confirm("¿Cerrar esta votación y generar el acta?")) {
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
