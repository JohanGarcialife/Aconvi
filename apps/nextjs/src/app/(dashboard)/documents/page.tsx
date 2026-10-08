"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  BookOpen,
  Calculator,
  ExternalLink,
  FileArchive,
  FileSignature,
  FileText,
  FolderOpen,
  Plus,
  Scale,
  Trash2,
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

import { useTRPC } from "~/trpc/react";

const TENANT_ID = "org_aconvi_demo";

const CATEGORIES = [
  {
    value: "ACTA",
    label: "Actas",
    icon: FileSignature,
    color: "text-blue-600 bg-blue-50 border-blue-100",
  },
  {
    value: "ESTATUTO",
    label: "Estatutos",
    icon: Scale,
    color: "text-purple-600 bg-purple-50 border-purple-100",
  },
  {
    value: "REGLAMENTO",
    label: "Reglamentos",
    icon: BookOpen,
    color: "text-amber-600 bg-amber-50 border-amber-100",
  },
  {
    value: "CONTRATO",
    label: "Contratos",
    icon: FileArchive,
    color: "text-emerald-600 bg-emerald-50 border-emerald-100",
  },
  {
    value: "PRESUPUESTO",
    label: "Presupuestos",
    icon: Calculator,
    color: "text-rose-600 bg-rose-50 border-rose-100",
  },
  {
    value: "OTRO",
    label: "Otros",
    icon: FolderOpen,
    color: "text-muted-foreground bg-muted/30 border-border",
  },
] as const;

type DocumentCategory = (typeof CATEGORIES)[number]["value"];

function categoryMeta(cat: string) {
  return (
    CATEGORIES.find((c) => c.value === cat) ??
    CATEGORIES[CATEGORIES.length - 1]!
  );
}

// ─── Upload Document Dialog ───────────────────────────────────────────────────
function UploadDocumentDialog({ onSuccess }: { onSuccess: () => void }) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("ACTA");
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");

  const createMutation = useMutation(
    trpc.document.create.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        setTitle("");
        setDescription("");
        setCategory("ACTA");
        setFileUrl("");
        setFileName("");
        onSuccess();
      },
    }),
  );

  const isValid = title.trim() && fileUrl.trim() && fileName.trim();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Subir Documento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Añadir documento</DialogTitle>
          <DialogDescription>
            Añade un enlace a un documento de la comunidad. Pega la URL de
            Google Drive, Dropbox u otro servicio.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Category selector */}
          <div className="grid gap-2">
            <Label>Categoría</Label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => {
                const isActive = category === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value as DocumentCategory)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-2.5 text-xs font-semibold transition-all ${
                      isActive
                        ? `${cat.color} border-current`
                        : "border-border text-muted-foreground hover:border-muted-foreground/40"
                    }`}
                  >
                    <cat.icon className="h-4 w-4" />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="doc-title">Título *</Label>
            <Input
              id="doc-title"
              placeholder="Ej: Acta Junta Ordinaria Enero 2025"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="doc-desc">Descripción</Label>
            <Textarea
              id="doc-desc"
              placeholder="Descripción opcional del documento..."
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="doc-url">URL del documento *</Label>
            <Input
              id="doc-url"
              placeholder="https://drive.google.com/..."
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              type="url"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="doc-filename">Nombre del archivo *</Label>
            <Input
              id="doc-filename"
              placeholder="Ej: acta-enero-2025.pdf"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
            />
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
                category,
                fileUrl,
                fileName,
              })
            }
            disabled={!isValid || createMutation.isPending}
          >
            {createMutation.isPending ? "Guardando..." : "📎 Guardar documento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Document Card ────────────────────────────────────────────────────────────
function DocumentCard({
  doc,
  onDelete,
}: {
  doc: any;
  onDelete: (id: string) => void;
}) {
  const meta = categoryMeta(doc.category ?? "OTRO");
  const Icon = meta.icon;

  return (
    <div className="bg-card flex items-start gap-4 rounded-xl border p-4 shadow-xs transition-shadow hover:shadow-sm">
      <div className={`shrink-0 rounded-xl border p-2.5 ${meta.color}`}>
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm leading-tight font-semibold">
              {doc.title}
            </h3>
            {doc.description && (
              <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                {doc.description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={doc.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors"
              title="Abrir documento"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 w-7"
              onClick={() => onDelete(doc.id)}
              title="Eliminar documento"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-3">
          <Badge
            variant="outline"
            className={`border text-xs ${meta.color} font-medium`}
          >
            {meta.label}
          </Badge>
          <span className="text-muted-foreground truncate text-xs">
            {doc.fileName}
          </span>
          <span className="text-muted-foreground shrink-0 text-xs">
            {format(new Date(doc.createdAt), "d MMM yyyy", { locale: es })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DocumentsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<string>("ALL");

  const { data: docs, isLoading } = useQuery(
    trpc.document.all.queryOptions({
      tenantId: TENANT_ID,
      category: activeCategory === "ALL" ? undefined : activeCategory,
    }),
  );

  const deleteMutation = useMutation(
    trpc.document.delete.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(
          trpc.document.all.queryFilter({ tenantId: TENANT_ID }),
        ),
    }),
  );

  const refresh = () =>
    queryClient.invalidateQueries(
      trpc.document.all.queryFilter({ tenantId: TENANT_ID }),
    );

  const handleDelete = (id: string) => {
    if (confirm("¿Eliminar este documento?")) {
      deleteMutation.mutate({ tenantId: TENANT_ID, id });
    }
  };

  const totalDocs = docs?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Gestión Documental
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Actas, estatutos, reglamentos y documentación de la comunidad.
          </p>
        </div>
        <UploadDocumentDialog onSuccess={refresh} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {CATEGORIES.map((cat) => {
          const count =
            docs?.filter((d: any) => d.category === cat.value).length ?? 0;
          return (
            <div
              key={cat.value}
              className={`rounded-xl border p-3 ${cat.color}`}
            >
              <div className="mb-1 flex items-center gap-1.5">
                <cat.icon className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">{cat.label}</span>
              </div>
              <p className="text-xl font-bold">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "ALL", label: "Todos", count: totalDocs },
          ...CATEGORIES.map((c) => ({
            key: c.value,
            label: c.label,
            count: docs?.filter((d: any) => d.category === c.value).length ?? 0,
          })),
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
              activeCategory === key
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                activeCategory === key ? "bg-white/20" : "bg-muted"
              }`}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Document List */}
      {isLoading ? (
        <div className="text-muted-foreground text-sm">
          Cargando documentos...
        </div>
      ) : docs?.length === 0 ? (
        <div className="bg-muted/20 rounded-xl border py-16 text-center">
          <FileText className="text-muted-foreground mx-auto mb-3 h-10 w-10 opacity-40" />
          <p className="text-muted-foreground text-sm">
            No hay documentos en esta categoría. Sube el primer documento.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {docs?.map((doc: any) => (
            <DocumentCard key={doc.id} doc={doc} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
