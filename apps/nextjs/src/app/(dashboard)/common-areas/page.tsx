"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useTRPC } from "~/trpc/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";
import { Label } from "@acme/ui/label";
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
  Trees,
  Plus,
  CalendarDays,
  Clock,
  User,
  X,
  ToggleLeft,
  ToggleRight,
  Settings,
} from "lucide-react";

const TENANT_ID = "org_aconvi_demo";

// ─── Create Area Dialog ───────────────────────────────────────────────────────
function CreateAreaDialog({ onSuccess }: { onSuccess: () => void }) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [openTime, setOpenTime] = useState("08:00");
  const [closeTime, setCloseTime] = useState("22:00");
  const [slotDuration, setSlotDuration] = useState(60);

  const createMutation = useMutation(
    trpc.commonArea.create.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        setName("");
        setDescription("");
        setOpenTime("08:00");
        setCloseTime("22:00");
        setSlotDuration(60);
        onSuccess();
      },
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Zona
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear zona común</DialogTitle>
          <DialogDescription>
            Configura una nueva zona para que los vecinos puedan reservar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="area-name">Nombre *</Label>
            <Input
              id="area-name"
              placeholder="Ej: Piscina, Salón de eventos, Pista de pádel..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="area-desc">Descripción</Label>
            <Input
              id="area-desc"
              placeholder="Ej: Capacidad máxima 20 personas"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="open-time">Apertura</Label>
              <Input
                id="open-time"
                type="time"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="close-time">Cierre</Label>
              <Input
                id="close-time"
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="slot-duration">
              Duración de cada slot (minutos)
            </Label>
            <div className="flex gap-2">
              {[30, 60, 90, 120].map((min) => (
                <button
                  key={min}
                  type="button"
                  onClick={() => setSlotDuration(min)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
                    slotDuration === min
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  {min}min
                </button>
              ))}
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
                name,
                description: description || undefined,
                openTime,
                closeTime,
                slotDurationMinutes: slotDuration,
              })
            }
            disabled={!name.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? "Creando..." : "Crear zona"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Area Card ────────────────────────────────────────────────────────────────
function AreaCard({
  area,
  onToggle,
}: {
  area: any;
  onToggle: (id: string, isActive: boolean) => void;
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border bg-card p-5 shadow-xs transition-shadow hover:shadow-sm ${
        !area.isActive ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2">
            <Trees className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-base leading-tight">
              {area.name}
            </h3>
            {area.description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {area.description}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => onToggle(area.id, !area.isActive)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title={area.isActive ? "Desactivar zona" : "Activar zona"}
        >
          {area.isActive ? (
            <ToggleRight className="h-6 w-6 text-emerald-600" />
          ) : (
            <ToggleLeft className="h-6 w-6" />
          )}
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mt-auto pt-3 border-t">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>
            {area.openTime} – {area.closeTime}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Settings className="h-3.5 w-3.5" />
          <span>Slots de {area.slotDurationMinutes} min</span>
        </div>
        <Badge
          variant="outline"
          className={
            area.isActive
              ? "text-emerald-600 border-emerald-200 bg-emerald-50"
              : "text-muted-foreground"
          }
        >
          {area.isActive ? "Activa" : "Inactiva"}
        </Badge>
      </div>
    </div>
  );
}

// ─── Booking Row ──────────────────────────────────────────────────────────────
function BookingRow({
  booking,
  onCancel,
}: {
  booking: any;
  onCancel: (id: string) => void;
}) {
  const isCancelled = booking.status === "CANCELADA";
  return (
    <div
      className={`flex items-center gap-4 rounded-lg border bg-card px-4 py-3 ${
        isCancelled ? "opacity-50" : ""
      }`}
    >
      <div className="flex flex-col items-center min-w-[56px] text-center">
        <span className="text-xs text-muted-foreground font-medium">
          {format(new Date(booking.date + "T00:00:00"), "EEE", { locale: es }).toUpperCase()}
        </span>
        <span className="text-lg font-bold leading-tight">
          {format(new Date(booking.date + "T00:00:00"), "d", { locale: es })}
        </span>
        <span className="text-xs text-muted-foreground">
          {format(new Date(booking.date + "T00:00:00"), "MMM", { locale: es })}
        </span>
      </div>

      <div className="h-10 w-px bg-border shrink-0" />

      <div className="flex flex-col flex-1 min-w-0">
        <span className="font-medium text-sm truncate">
          {booking.commonArea?.name ?? "Zona desconocida"}
        </span>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {booking.startTime} – {booking.endTime}
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <User className="h-3 w-3" />
            {booking.user?.name ?? "Vecino"}
          </span>
        </div>
      </div>

      <Badge
        variant="outline"
        className={
          isCancelled
            ? "text-muted-foreground"
            : "text-emerald-600 border-emerald-200 bg-emerald-50"
        }
      >
        {isCancelled ? "Cancelada" : "Confirmada"}
      </Badge>

      {!isCancelled && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
          onClick={() => onCancel(booking.id)}
          title="Cancelar reserva"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CommonAreasPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"areas" | "bookings">("areas");
  const [selectedAreaId, setSelectedAreaId] = useState<string | undefined>();

  const areasQuery = useQuery(
    trpc.commonArea.all.queryOptions({ tenantId: TENANT_ID }),
  );

  const bookingsQuery = useQuery(
    trpc.commonArea.allBookings.queryOptions({
      tenantId: TENANT_ID,
      areaId: selectedAreaId,
    }),
  );

  const toggleMutation = useMutation(
    trpc.commonArea.toggleArea.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(
          trpc.commonArea.all.queryFilter({ tenantId: TENANT_ID }),
        ),
    }),
  );

  const cancelMutation = useMutation(
    trpc.commonArea.cancel.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(
          trpc.commonArea.allBookings.queryFilter({ tenantId: TENANT_ID }),
        ),
    }),
  );

  const refreshAreas = () =>
    queryClient.invalidateQueries(
      trpc.commonArea.all.queryFilter({ tenantId: TENANT_ID }),
    );

  const handleCancel = (bookingId: string) => {
    if (confirm("¿Cancelar esta reserva?")) {
      cancelMutation.mutate({ bookingId });
    }
  };

  const areas = areasQuery.data ?? [];
  const bookings = bookingsQuery.data ?? [];

  const confirmedCount = bookings.filter((b: any) => b.status === "CONFIRMADA").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Zonas Comunes</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gestiona los espacios comunitarios y visualiza las reservas activas.
          </p>
        </div>
        {tab === "areas" && <CreateAreaDialog onSuccess={refreshAreas} />}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Zonas activas",
            value: areas.filter((a: any) => a.isActive).length,
            icon: Trees,
            color: "text-emerald-600",
            bg: "bg-emerald-50 border-emerald-100",
          },
          {
            label: "Zonas inactivas",
            value: areas.filter((a: any) => !a.isActive).length,
            icon: ToggleLeft,
            color: "text-muted-foreground",
            bg: "bg-muted/30 border-border",
          },
          {
            label: "Reservas confirmadas",
            value: confirmedCount,
            icon: CalendarDays,
            color: "text-blue-600",
            bg: "bg-blue-50 border-blue-100",
          },
          {
            label: "Reservas canceladas",
            value: bookings.filter((b: any) => b.status === "CANCELADA").length,
            icon: X,
            color: "text-red-500",
            bg: "bg-red-50 border-red-100",
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`rounded-xl border ${bg} p-4`}>
            <div className={`flex items-center gap-2 ${color} mb-1`}>
              <Icon className="h-4 w-4" />
              <span className="text-xs font-medium">{label}</span>
            </div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: "areas", label: "🏢 Zonas", count: areas.length },
          { key: "bookings", label: "📋 Reservas", count: confirmedCount },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
              tab === key
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                tab === key ? "bg-white/20" : "bg-muted"
              }`}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Zones Tab */}
      {tab === "areas" && (
        <>
          {areasQuery.isLoading ? (
            <div className="text-muted-foreground text-sm">Cargando zonas...</div>
          ) : areas.length === 0 ? (
            <div className="py-16 text-center border rounded-xl bg-muted/20">
              <Trees className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-40" />
              <p className="text-muted-foreground text-sm">
                No hay zonas comunes configuradas. Crea la primera zona.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {areas.map((area: any) => (
                <AreaCard
                  key={area.id}
                  area={area}
                  onToggle={(id, isActive) =>
                    toggleMutation.mutate({ tenantId: TENANT_ID, areaId: id, isActive })
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Bookings Tab */}
      {tab === "bookings" && (
        <>
          {/* Filter by area */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedAreaId(undefined)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                !selectedAreaId
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              Todas las zonas
            </button>
            {areas.map((area: any) => (
              <button
                key={area.id}
                onClick={() =>
                  setSelectedAreaId(selectedAreaId === area.id ? undefined : area.id)
                }
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                  selectedAreaId === area.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {area.name}
              </button>
            ))}
          </div>

          {bookingsQuery.isLoading ? (
            <div className="text-muted-foreground text-sm">Cargando reservas...</div>
          ) : bookings.length === 0 ? (
            <div className="py-16 text-center border rounded-xl bg-muted/20">
              <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-40" />
              <p className="text-muted-foreground text-sm">
                No hay reservas en esta comunidad.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {bookings.map((booking: any) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  onCancel={handleCancel}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
