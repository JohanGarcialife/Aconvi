"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search, ShieldAlert, ShieldCheck } from "lucide-react";

import { Badge } from "@acme/ui/badge";
import { Button } from "@acme/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@acme/ui/dialog";
import { Input } from "@acme/ui/input";

import { useTRPC } from "~/trpc/react";

const TENANT_ID = "org_aconvi_demo";

export function VotingRightsDialog() {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const {
    data: neighbors,
    isLoading,
    refetch,
  } = useQuery(trpc.community.neighbors.queryOptions({ tenantId: TENANT_ID }));

  const overrideMutation = useMutation(
    trpc.voting.overrideVotingRight.mutationOptions({
      onSuccess: () => {
        void refetch();
      },
      onError: (err: any) => {
        alert(err?.message || "No se pudo actualizar el derecho de voto.");
      },
    }),
  );

  const handleToggleOverride = (neighbor: any) => {
    const isCurrentlyEnabled = Boolean(neighbor.votingOverride);
    if (isCurrentlyEnabled) {
      if (
        confirm(`¿Retirar habilitación excepcional de voto a ${neighbor.name}?`)
      ) {
        overrideMutation.mutate({
          tenantId: TENANT_ID,
          userId: neighbor.id,
          enable: false,
        });
      }
    } else {
      const reason = prompt(
        `Indica el motivo legal para habilitar el voto a ${neighbor.name} (ej. Consignación judicial, Acuerdo de pago):`,
        "Consignación judicial de deuda acreditada",
      );
      if (reason !== null) {
        overrideMutation.mutate({
          tenantId: TENANT_ID,
          userId: neighbor.id,
          enable: true,
          reason: reason.trim() || undefined,
        });
      }
    }
  };

  const filtered = (neighbors ?? []).filter(
    (n: any) =>
      (n.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (n.email || "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-slate-300 font-bold hover:bg-slate-50"
        >
          <ShieldCheck className="mr-2 h-4 w-4 text-emerald-600" />
          Derechos de Voto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Control de Derechos de Voto (Art. 15.2 LPH)
          </DialogTitle>
          <DialogDescription>
            Conforme a la Ley de Propiedad Horizontal, los propietarios con
            deudas pendientes no tienen derecho a voto. El Administrador puede
            habilitar excepcionalmente el voto cuando exista consignación
            judicial o causa justificada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
            <Input
              placeholder="Buscar vecino por nombre o correo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          <div className="divide-y rounded-xl border bg-slate-50/50">
            {isLoading ? (
              <div className="text-muted-foreground p-6 text-center text-sm">
                Cargando propietarios...
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-muted-foreground p-6 text-center text-sm">
                No se encontraron propietarios.
              </div>
            ) : (
              filtered.map((neighbor: any) => {
                const hasOverride = Boolean(neighbor.votingOverride);
                return (
                  <div
                    key={neighbor.id}
                    className="flex items-center justify-between p-3.5 transition-colors hover:bg-white"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {neighbor.name}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          Cuota: {neighbor.coefficient}%
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {neighbor.email || "Sin email"}
                      </p>
                      {hasOverride && neighbor.votingOverrideReason && (
                        <p className="text-[11px] font-medium text-emerald-700">
                          Motivo: {neighbor.votingOverrideReason}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {hasOverride ? (
                        <Badge className="border-emerald-300 bg-emerald-100 font-bold text-emerald-800 hover:bg-emerald-200">
                          Habilitado por AF
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-600">
                          Régimen General
                        </Badge>
                      )}

                      <Button
                        size="sm"
                        variant={hasOverride ? "destructive" : "outline"}
                        onClick={() => handleToggleOverride(neighbor)}
                        disabled={overrideMutation.isPending}
                        className="text-xs font-bold"
                      >
                        {hasOverride ? "Revocar" : "Habilitar Voto"}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
