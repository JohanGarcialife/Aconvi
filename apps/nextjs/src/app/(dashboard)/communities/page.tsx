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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@acme/ui/alert-dialog";
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
  Pencil,
  Percent,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Community = {
  id: string;
  name: string;
  slug: string;
  createdAt: string | Date;
  metadata?: string | null;
};

function getAddress(community: Community) {
  try {
    const meta = community.metadata ? JSON.parse(community.metadata) : null;
    return meta?.address ?? null;
  } catch {
    return null;
  }
}

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
          <DialogDescription>Crea una nueva finca o comunidad de propietarios.</DialogDescription>
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
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
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

// ─── Edit Community Dialog ────────────────────────────────────────────────────
function EditCommunityDialog({
  community,
  onSuccess,
}: {
  community: Community;
  onSuccess: () => void;
}) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(community.name);
  const [address, setAddress] = useState(getAddress(community) ?? "");

  const updateMutation = useMutation(
    trpc.community.update.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        onSuccess();
      },
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Comunidad</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Nombre *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Dirección</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle Mayor, 12" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => updateMutation.mutate({ id: community.id, name, address })}
            disabled={!name.trim() || updateMutation.isPending}
          >
            {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Neighbor Dialog ──────────────────────────────────────────────────────
function AddNeighborDialog({ tenantId, onSuccess }: { tenantId: string; onSuccess: () => void }) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", unit: "", coefficient: "100" });

  const addMutation = useMutation(
    trpc.community.addNeighbor.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        setForm({ name: "", email: "", phone: "", unit: "", coefficient: "100" });
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
          <DialogDescription>El vecino recibirá acceso a la app con sus datos.</DialogDescription>
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
          <div className="grid gap-2">
            <Label htmlFor="n-coef">Coeficiente de participación (%)</Label>
            <Input
              id="n-coef"
              type="number"
              min={0}
              max={100}
              step={0.01}
              placeholder="100"
              value={form.coefficient}
              onChange={set("coefficient")}
            />
            <p className="text-xs text-muted-foreground">Usado para votaciones ponderadas. Suma total de la comunidad debe ser 100.</p>
          </div>
        </div>
        {addMutation.error && (
          <p className="text-destructive text-sm -mt-2">{addMutation.error.message}</p>
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
                coefficient: parseFloat(form.coefficient) || 100,
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

// ─── Edit Neighbor Dialog ─────────────────────────────────────────────────────
function EditNeighborDialog({
  neighbor,
  tenantId,
  onSuccess,
}: {
  neighbor: any;
  tenantId: string;
  onSuccess: () => void;
}) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: neighbor.name ?? "",
    phone: neighbor.phoneNumber ?? "",
    unit: neighbor.memberRole?.replace("vecino:", "") ?? "",
    coefficient: String(neighbor.coefficient ?? 100),
  });

  const updateMutation = useMutation(
    trpc.community.updateNeighbor.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        onSuccess();
      },
    }),
  );

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Pencil className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Vecino</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Nombre completo</Label>
            <Input value={form.name} onChange={set("name")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Teléfono</Label>
              <Input value={form.phone} onChange={set("phone")} placeholder="+34 600 000 000" />
            </div>
            <div className="grid gap-2">
              <Label>Piso / Puerta</Label>
              <Input value={form.unit} onChange={set("unit")} placeholder="2B" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Coeficiente (%)</Label>
            <Input type="number" min={0} max={100} step={0.01} value={form.coefficient} onChange={set("coefficient")} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={() =>
              updateMutation.mutate({
                tenantId,
                memberId: neighbor.memberId,
                userId: neighbor.id,
                name: form.name,
                phone: form.phone,
                unit: form.unit,
                coefficient: parseFloat(form.coefficient) || 100,
              })
            }
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? "Guardando..." : "Guardar"}
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

  const vecinos = (neighbors ?? []).filter((n: any) => n.memberRole?.startsWith("vecino"));

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Vecinos · {community?.name}
          </SheetTitle>
          <SheetDescription>
            {vecinos.length} vecinos registrados · Coeficiente total: {
              vecinos.reduce((s: number, n: any) => s + (n.coefficient ?? 100), 0).toFixed(2)
            }%
          </SheetDescription>
        </SheetHeader>

        <div className="flex justify-end mb-4">
          {community && <AddNeighborDialog tenantId={community.id} onSuccess={refreshNeighbors} />}
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Cargando vecinos...</p>
        ) : vecinos.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No hay vecinos en esta comunidad todavía.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {vecinos.map((n: any) => (
              <div
                key={n.id}
                className="flex items-start justify-between rounded-xl border bg-card p-4 shadow-xs"
              >
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{n.name}</span>
                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                      <Percent className="h-2.5 w-2.5" />
                      {(n.coefficient ?? 100).toFixed(2)}
                    </span>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" /> {n.email}
                  </span>
                  {n.phoneNumber && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" /> {n.phoneNumber}
                    </span>
                  )}
                  {n.memberRole?.includes(":") && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Home className="h-3 w-3" /> Piso {n.memberRole.replace("vecino:", "")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <EditNeighborDialog
                    neighbor={n}
                    tenantId={community?.id ?? ""}
                    onSuccess={refreshNeighbors}
                  />
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

  const deleteMutation = useMutation(
    trpc.community.delete.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(trpc.community.all.queryFilter()),
    }),
  );

  const refresh = () =>
    queryClient.invalidateQueries(trpc.community.all.queryFilter());

  const handleViewNeighbors = (community: Community) => {
    setSelectedCommunity(community);
    setPanelOpen(true);
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
            { icon: Building2, label: "Comunidades", value: communities?.length ?? 0 },
            { icon: Users, label: "Vecinos totales", value: "—" },
            { icon: Home, label: "Dirección media", value: "—" },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex items-center gap-4 rounded-xl border bg-card p-5 shadow-xs"
            >
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Icon className="h-5 w-5 text-primary" />
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
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewNeighbors(community)}
                        >
                          <Users className="mr-1.5 h-3.5 w-3.5" />
                          Ver Vecinos
                        </Button>
                        <EditCommunityDialog community={community} onSuccess={refresh} />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar comunidad?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Se eliminarán permanentemente la comunidad <strong>{community.name}</strong> y todos sus vecinos. Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteMutation.mutate({ id: community.id })}
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
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
