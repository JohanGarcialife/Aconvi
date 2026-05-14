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
import { Megaphone, AlertTriangle, Info, Pin, PinOff, Trash2, Plus } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
// Use same tenant as incidents for consistent demo experience
const TENANT_ID = "org_aconvi_demo";

const NOTICE_TYPES = [
  {
    value: "COMUNICADO",
    label: "Comunicado",
    icon: Info,
    color: "bg-primary/10 text-primary border-primary/20",
    badgeVariant: "outline" as const,
  },
  {
    value: "AVISO",
    label: "Aviso",
    icon: Megaphone,
    color: "bg-amber-50 text-amber-700 border-amber-200",
    badgeVariant: "outline" as const,
  },
  {
    value: "URGENTE",
    label: "Urgente",
    icon: AlertTriangle,
    color: "bg-red-50 text-red-700 border-red-200",
    badgeVariant: "destructive" as const,
  },
] as const;

type NoticeType = "COMUNICADO" | "AVISO" | "URGENTE";

function typeMeta(type: string) {
  return NOTICE_TYPES.find((t) => t.value === type) ?? NOTICE_TYPES[0]!;
}

// ─── Publish Notice Dialog ────────────────────────────────────────────────────
function PublishNoticeDialog({ onSuccess }: { onSuccess: () => void }) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<NoticeType>("COMUNICADO");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [pushResult, setPushResult] = useState<{ recipientCount?: number } | null>(null);

  const createMutation = useMutation(
    trpc.notice.create.mutationOptions({
      onSuccess: (data: any) => {
        setOpen(false);
        setTitle("");
        setContent("");
        setType("COMUNICADO");
        if (data?.recipientCount !== undefined) setPushResult({ recipientCount: data.recipientCount });
        onSuccess();
        setTimeout(() => setPushResult(null), 5000);
      },
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Publicar Comunicado
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo comunicado</DialogTitle>
          <DialogDescription>
            Publica un comunicado en el tablón de la comunidad. Se notificará a todos los vecinos.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          {/* Type selector */}
          <div className="grid gap-2">
            <Label>Tipo de comunicado</Label>
            <div className="grid grid-cols-3 gap-2">
              {NOTICE_TYPES.map((t) => {
                const isActive = type === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value as NoticeType)}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-sm font-semibold transition-all ${
                      isActive
                        ? `${t.color} border-current`
                        : "border-border text-muted-foreground hover:border-muted-foreground/40"
                    }`}
                  >
                    <t.icon className="h-5 w-5" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div className="grid gap-2">
            <Label htmlFor="notice-title">Título *</Label>
            <Input
              id="notice-title"
              placeholder="Ej: Corte de agua el lunes 14"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Content */}
          <div className="grid gap-2">
            <Label htmlFor="notice-content">Contenido *</Label>
            <Textarea
              id="notice-content"
              placeholder="Escribe el contenido del comunicado aquí..."
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {content.length} caracteres
            </p>
          </div>
        </div>

      <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={() =>
              createMutation.mutate({ tenantId: TENANT_ID, title, content, type })
            }
            disabled={!title.trim() || !content.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? "Publicando..." : "📢 Publicar y notificar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Notice Card ──────────────────────────────────────────────────────────────
function NoticeCard({
  notice,
  onDelete,
  onTogglePin,
}: {
  notice: any;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
}) {
  const meta = typeMeta(notice.type ?? "COMUNICADO");
  const Icon = meta.icon;
  const isPinned = notice.pinned;

  return (
    <div className={`flex flex-col rounded-xl border bg-card p-5 shadow-xs hover:shadow-sm transition-shadow ${isPinned ? "border-amber-200 bg-amber-50/30" : ""}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`rounded-lg p-1.5 border ${meta.color} shrink-0`}>
            <Icon className="h-4 w-4" />
          </div>
          <h3 className="font-semibold text-base leading-tight truncate">
            {notice.title}
          </h3>
          {isPinned && (
            <span className="text-amber-600" title="Fijado">📌</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge
            variant="outline"
            className={`text-xs border ${meta.color} font-semibold`}
          >
            {meta.label}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 ${isPinned ? "text-amber-500 hover:text-amber-700" : "text-muted-foreground hover:text-amber-500"} hover:bg-amber-50`}
            title={isPinned ? "Desfijar" : "Fijar en el tablón"}
            onClick={() => onTogglePin(notice.id, !isPinned)}
          >
            {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(notice.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <p className="text-sm text-card-foreground flex-1 mb-4 whitespace-pre-wrap leading-relaxed line-clamp-4">
        {notice.content}
      </p>

      {/* Footer */}
      <div className="mt-auto pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">{notice.author?.name ?? "Administrador"}</span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-emerald-600 font-medium">
            <span>🔔</span> Push enviado
          </span>
          <span>
            {format(new Date(notice.createdAt), "d MMM yyyy · HH:mm", { locale: es })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function NoticeBoardPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("ALL");

  const { data: notices, isLoading } = useQuery(
    trpc.notice.all.queryOptions({ tenantId: TENANT_ID }),
  );

  const deleteMutation = useMutation(
    trpc.notice.delete.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(
          trpc.notice.all.queryFilter({ tenantId: TENANT_ID }),
        ),
    }),
  );

  const pinMutation = useMutation(
    trpc.notice.togglePin.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(
          trpc.notice.all.queryFilter({ tenantId: TENANT_ID }),
        ),
    }),
  );

  const refresh = () =>
    queryClient.invalidateQueries(
      trpc.notice.all.queryFilter({ tenantId: TENANT_ID }),
    );

  const handleDelete = (id: string) => {
    if (confirm("¿Eliminar este comunicado?")) {
      deleteMutation.mutate({ tenantId: TENANT_ID, id });
    }
  };

  const handleTogglePin = (id: string, pinned: boolean) => {
    pinMutation.mutate({ tenantId: TENANT_ID, id, pinned });
  };

  const filtered =
    filter === "ALL"
      ? notices
      : notices?.filter((n: any) => (n.type ?? "COMUNICADO") === filter);

  const counts = {
    ALL: notices?.length ?? 0,
    COMUNICADO: notices?.filter((n: any) => (n.type ?? "COMUNICADO") === "COMUNICADO").length ?? 0,
    AVISO: notices?.filter((n: any) => n.type === "AVISO").length ?? 0,
    URGENTE: notices?.filter((n: any) => n.type === "URGENTE").length ?? 0,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tablón y Comunicados</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Publica avisos y comunicados para todos los vecinos.
          </p>
        </div>
        <PublishNoticeDialog onSuccess={refresh} />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "ALL", label: "Todos" },
          { key: "COMUNICADO", label: "Comunicados" },
          { key: "AVISO", label: "Avisos" },
          { key: "URGENTE", label: "Urgentes" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
              filter === key
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                filter === key ? "bg-white/20" : "bg-muted"
              }`}
            >
              {counts[key as keyof typeof counts]}
            </span>
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Cargando tablón...</div>
      ) : filtered?.length === 0 ? (
        <div className="col-span-full py-16 text-center border rounded-xl bg-muted/20">
          <Megaphone className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-40" />
          <p className="text-muted-foreground text-sm">
            {filter === "ALL"
              ? "No hay comunicados publicados."
              : `No hay comunicados de tipo "${filter}".`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered?.map((notice: any) => (
            <NoticeCard key={notice.id} notice={notice} onDelete={handleDelete} onTogglePin={handleTogglePin} />
          ))}
        </div>
      )}
    </div>
  );
}
