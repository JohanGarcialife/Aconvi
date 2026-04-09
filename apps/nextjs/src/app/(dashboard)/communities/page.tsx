"use client";

import { useState } from "react";
import { useTRPC } from "~/trpc/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";
import { Label } from "@acme/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@acme/ui/table";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@acme/ui/sheet";
import { Badge } from "@acme/ui/badge";
import {
  Building2,
  Users,
  Plus,
  UserPlus,
  Trash2,
  MapPin,
  Phone,
  Mail,
  Home,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Community = {
  id: string;
  name: string;
  slug: string;
  createdAt: string | Date;
  metadata?: string | null;
};

// ─── Add Community Dialog ─────────────────────────────────────────────────────
function AddCommunityDialog({ onSuccess }: { onSuccess: () => void }) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  const createMutation = useMutation(
    trpc.community.create.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        setName("");
        setAddress("");
        onSuccess();
      },
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Comunidad
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Añadir Comunidad</DialogTitle>
          <DialogDescription>
            Crea una nueva finca o comunidad de propietarios.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="community-name">Nombre de la comunidad *</Label>
            <Input
              id="community-name"
              placeholder="Ej: Residencial Los Olivos"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="community-address">Dirección</Label>
            <Input
              id="community-address"
              placeholder="Ej: Calle Mayor, 12"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => createMutation.mutate({ name, address })}
            disabled={!name.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? "Creando..." : "Crear comunidad"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Neighbor Dialog ──────────────────────────────────────────────────────
function AddNeighborDialog({
  tenantId,
  onSuccess,
}: {
  tenantId: string;
  onSuccess: () => void;
}) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    unit: "",
  });

  const addMutation = useMutation(
    trpc.community.addNeighbor.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        setForm({ name: "", email: "", phone: "", unit: "" });
        onSuccess();
      },
    }),
  );

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-2 h-4 w-4" />
          Añadir Vecino
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Añadir Vecino</DialogTitle>
          <DialogDescription>
            Añade un vecino a esta comunidad. Si el usuario ya existe en el sistema,
            se le añadirá directamente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="n-name">Nombre completo *</Label>
            <Input id="n-name" placeholder="Ana García López" value={form.name} onChange={set("name")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="n-email">Email *</Label>
            <Input id="n-email" type="email" placeholder="ana@ejemplo.com" value={form.email} onChange={set("email")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="n-phone">Teléfono</Label>
              <Input id="n-phone" placeholder="+34 600 000 000" value={form.phone} onChange={set("phone")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="n-unit">Piso / Puerta</Label>
              <Input id="n-unit" placeholder="2B" value={form.unit} onChange={set("unit")} />
            </div>
          </div>
        </div>
        {addMutation.error && (
          <p className="text-destructive text-sm -mt-2">
            {addMutation.error.message}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={() =>
              addMutation.mutate({
                tenantId,
                name: form.name,
                email: form.email,
                phone: form.phone || undefined,
                unit: form.unit || undefined,
              })
            }
            disabled={!form.name || !form.email || addMutation.isPending}
          >
            {addMutation.isPending ? "Añadiendo..." : "Añadir vecino"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Neighbors side panel ─────────────────────────────────────────────────────
function NeighborsPanel({
  community,
  open,
  onClose,
}: {
  community: Community | null;
  open: boolean;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: neighbors, isLoading } = useQuery(
    trpc.community.neighbors.queryOptions(
      { tenantId: community?.id ?? "" },
      { enabled: !!community?.id },
    ),
  );

  const removeMutation = useMutation(
    trpc.community.removeNeighbor.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(
          trpc.community.neighbors.queryFilter({ tenantId: community?.id ?? "" }),
        ),
    }),
  );

  const refreshNeighbors = () =>
    queryClient.invalidateQueries(
      trpc.community.neighbors.queryFilter({ tenantId: community?.id ?? "" }),
    );

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Vecinos · {community?.name}
          </SheetTitle>
          <SheetDescription>
            {neighbors?.length ?? 0} vecinos registrados en esta comunidad.
          </SheetDescription>
        </SheetHeader>

        <div className="flex justify-end mb-4">
          {community && (
            <AddNeighborDialog tenantId={community.id} onSuccess={refreshNeighbors} />
          )}
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Cargando vecinos...</p>
        ) : neighbors?.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No hay vecinos en esta comunidad todavía.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {neighbors?.map((n: any) => (
              <div
                key={n.id}
                className="flex items-start justify-between rounded-xl border bg-card p-4 shadow-xs"
              >
                <div className="flex flex-col gap-1.5">
                  <span className="font-semibold text-sm">{n.name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" /> {n.email}
                  </span>
                  {n.phoneNumber && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" /> {n.phoneNumber}
                    </span>
                  )}
                  {n.memberRole?.startsWith("vecino:") && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Home className="h-3 w-3" />{" "}
                      {n.memberRole.replace("vecino:", "Piso ")}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8 shrink-0"
                  onClick={() =>
                    removeMutation.mutate({
                      tenantId: community?.id ?? "",
                      memberId: n.memberId,
                    })
                  }
                  disabled={removeMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CommunitiesPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const { data: communities, isLoading } = useQuery(
    trpc.community.all.queryOptions(),
  );

  const refresh = () =>
    queryClient.invalidateQueries(trpc.community.all.queryFilter());

  const handleViewNeighbors = (community: Community) => {
    setSelectedCommunity(community);
    setPanelOpen(true);
  };

  const getAddress = (community: Community) => {
    try {
      const meta = community.metadata ? JSON.parse(community.metadata) : null;
      return meta?.address ?? null;
    } catch {
      return null;
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Comunidades</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Gestiona las fincas y sus vecinos.
            </p>
          </div>
          <AddCommunityDialog onSuccess={refresh} />
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Building2,
              label: "Comunidades",
              value: communities?.length ?? 0,
              color: "text-primary",
            },
            {
              icon: Users,
              label: "Vecinos totales",
              value: "—",
              color: "text-primary",
            },
            {
              icon: Home,
              label: "Unidades",
              value: "—",
              color: "text-primary",
            },
          ].map(({ icon: Icon, label, value, color }) => (
            <div
              key={label}
              className="flex items-center gap-4 rounded-xl border bg-card p-5 shadow-xs"
            >
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Nombre</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Fecha de Alta</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Cargando comunidades...
                  </TableCell>
                </TableRow>
              ) : communities?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center">
                    <Building2 className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground text-sm">
                      No hay comunidades. Crea la primera con el botón de arriba.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                communities?.map((community: any) => (
                  <TableRow key={community.id} className="group">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary shrink-0" />
                        {community.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getAddress(community) ? (
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {getAddress(community)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(community.createdAt).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="mr-2"
                        onClick={() => handleViewNeighbors(community)}
                      >
                        <Users className="mr-1.5 h-3.5 w-3.5" />
                        Ver Vecinos
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Neighbors side panel */}
      <NeighborsPanel
        community={selectedCommunity}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
      />
    </>
  );
}
