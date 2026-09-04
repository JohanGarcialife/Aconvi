"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Calendar, CheckCircle2, FileText, Plus, Trash2 } from "lucide-react";

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

interface ProposalItem {
  companyName: string;
  amount: string;
  description: string;
  fileUrl: string;
}

interface AgendaItem {
  title: string;
  budget: string;
  description: string;
  onlineVotingEnabled: boolean;
  proposals: ProposalItem[];
}

export function CreateMeetingDialog({ onSuccess }: { onSuccess: () => void }) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [secondCallDate, setSecondCallDate] = useState("");
  const [closesAt, setClosesAt] = useState("");

  const [items, setItems] = useState<AgendaItem[]>([
    {
      title: "",
      budget: "",
      description: "",
      onlineVotingEnabled: true,
      proposals: [],
    },
  ]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setMeetingDate("");
    setMeetingLocation("");
    setSecondCallDate("");
    setClosesAt("");
    setItems([
      {
        title: "",
        budget: "",
        description: "",
        onlineVotingEnabled: true,
        proposals: [],
      },
    ]);
  };

  const createMeetingMutation = useMutation(
    trpc.voting.createMeeting.mutationOptions({
      onSuccess: (data) => {
        resetForm();
        setOpen(false);
        if (data.warning) {
          alert(data.warning);
        } else {
          alert("¡Junta convocada y votaciones sincronizadas con éxito!");
        }
        onSuccess();
      },
      onError: (err: any) => {
        alert(err?.message || "Error al convocar la junta.");
      },
    }),
  );

  const addItem = () => {
    setItems([
      ...items,
      {
        title: "",
        budget: "",
        description: "",
        onlineVotingEnabled: true,
        proposals: [],
      },
    ]);
  };

  const updateItem = (index: number, field: keyof AgendaItem, value: any) => {
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

  const addProposal = (itemIndex: number) => {
    const next = [...items];
    if (next[itemIndex]) {
      next[itemIndex]!.proposals.push({
        companyName: "",
        amount: "",
        description: "",
        fileUrl: "",
      });
      setItems(next);
    }
  };

  const updateProposal = (
    itemIndex: number,
    proposalIndex: number,
    field: keyof ProposalItem,
    value: string,
  ) => {
    const next = [...items];
    if (next[itemIndex]?.proposals[proposalIndex]) {
      next[itemIndex]!.proposals[proposalIndex]![field] = value;
      setItems(next);
    }
  };

  const removeProposal = (itemIndex: number, proposalIndex: number) => {
    const next = [...items];
    if (next[itemIndex]) {
      next[itemIndex]!.proposals = next[itemIndex]!.proposals.filter(
        (_, i) => i !== proposalIndex,
      );
      setItems(next);
    }
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      alert("Introduce el título de la junta.");
      return;
    }
    if (!meetingDate) {
      alert("Selecciona la fecha y hora de la reunión presencial.");
      return;
    }
    if (!meetingLocation.trim()) {
      alert("Indica el lugar de celebración de la junta.");
      return;
    }

    const validItems = items.filter((i) => i.title.trim());
    if (validItems.length === 0) {
      alert("Añade al menos un punto al orden del día.");
      return;
    }

    createMeetingMutation.mutate({
      tenantId: TENANT_ID,
      title: title.trim(),
      description: description.trim() || undefined,
      meetingDate: new Date(meetingDate).toISOString(),
      meetingLocation: meetingLocation.trim(),
      secondCallDate: secondCallDate
        ? new Date(secondCallDate).toISOString()
        : undefined,
      closesAt: closesAt ? new Date(closesAt).toISOString() : undefined,
      items: validItems.map((it) => ({
        title: it.title.trim(),
        budget: it.budget.trim() || undefined,
        description: it.description.trim() || undefined,
        onlineVotingEnabled: it.onlineVotingEnabled,
        proposals: it.proposals
          .filter((p) => p.companyName.trim())
          .map((p) => ({
            companyName: p.companyName.trim(),
            amount: p.amount.trim(),
            description: p.description.trim() || undefined,
            fileUrl: p.fileUrl.trim() || undefined,
            fileName: p.fileUrl ? "Presupuesto.pdf" : undefined,
          })),
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#027580] font-bold text-white shadow-sm hover:bg-[#015A63]">
          <Calendar className="mr-2 h-4 w-4" />
          Crear Junta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-[#027580]">
              ⚖️
            </span>
            Convocatoria Oficial y Votación de Junta
          </DialogTitle>
          <DialogDescription>
            Configura la convocatoria oficial y el orden del día. El sistema
            generará simultáneamente el comunicado formal para los propietarios
            y las tarjetas de votación telemática.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          {/* Datos generales de la Junta */}
          <div className="space-y-3 rounded-xl border bg-slate-50/50 p-4">
            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <FileText className="h-4 w-4 text-[#027580]" />
              1. Datos de la Convocatoria Oficial (Art. 16 LPH)
            </h4>

            <div className="grid gap-2">
              <Label htmlFor="m-title">Título de la Junta *</Label>
              <Input
                id="m-title"
                placeholder="Ej: Junta General Extraordinaria - Septiembre 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="m-date">Fecha y Hora (1ª Convocatoria) *</Label>
                <Input
                  id="m-date"
                  type="datetime-local"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  onClick={(e) => {
                    try {
                      (e.currentTarget as HTMLInputElement).showPicker?.();
                    } catch {}
                  }}
                  className="cursor-pointer"
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="m-date2">Segunda Convocatoria (Opcional)</Label>
                <Input
                  id="m-date2"
                  type="datetime-local"
                  value={secondCallDate}
                  onChange={(e) => setSecondCallDate(e.target.value)}
                  onClick={(e) => {
                    try {
                      (e.currentTarget as HTMLInputElement).showPicker?.();
                    } catch {}
                  }}
                  className="cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="m-loc">Lugar de celebración *</Label>
                <Input
                  id="m-loc"
                  placeholder="Ej: Sala Comunitaria / Portal principal"
                  value={meetingLocation}
                  onChange={(e) => setMeetingLocation(e.target.value)}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="m-close">Cierre de votación telemática</Label>
                <Input
                  id="m-close"
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
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="m-desc">
                Observaciones de la convocatoria (opcional)
              </Label>
              <Textarea
                id="m-desc"
                placeholder="Aclaraciones sobre delegación de voto, quórum, etc."
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="resize-none text-xs"
              />
            </div>
          </div>

          {/* Orden del Día y Selección Telemática */}
          <div className="space-y-4 rounded-xl border bg-slate-50/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <span>📋</span>
                  2. Orden del Día y Modalidad de Votación
                </h4>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Elige qué puntos permiten votación telemática anticipada antes
                  de la junta.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Añadir Punto
              </Button>
            </div>

            <div className="space-y-4">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="space-y-3 rounded-xl border bg-white p-4 shadow-xs transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-extrabold text-[#027580]">
                      {idx + 1}
                    </span>
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="ej. Reparación del ascensor principal"
                        value={item.title}
                        onChange={(e) =>
                          updateItem(idx, "title", e.target.value)
                        }
                        className="text-sm font-semibold"
                      />
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <Input
                          placeholder="ej. 5.500 €"
                          value={item.budget}
                          onChange={(e) =>
                            updateItem(idx, "budget", e.target.value)
                          }
                          className="text-xs"
                        />
                        <Input
                          placeholder="ej. Sustitución de motor y revisión técnica reglamentaria"
                          value={item.description}
                          onChange={(e) =>
                            updateItem(idx, "description", e.target.value)
                          }
                          className="text-xs"
                        />
                      </div>
                    </div>

                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(idx)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Toggle Votación Telemática */}
                  <div className="flex items-center justify-between rounded-lg border bg-slate-50 p-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`online-${idx}`}
                        checked={item.onlineVotingEnabled}
                        onChange={(e) =>
                          updateItem(
                            idx,
                            "onlineVotingEnabled",
                            e.target.checked,
                          )
                        }
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 text-[#027580] focus:ring-[#027580]"
                      />
                      <Label
                        htmlFor={`online-${idx}`}
                        className="cursor-pointer text-xs font-bold text-slate-700"
                      >
                        Votar este punto antes de la junta (Votación online en
                        App)
                      </Label>
                    </div>

                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        item.onlineVotingEnabled
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {item.onlineVotingEnabled
                        ? "Votación Online"
                        : "Solo Presencial"}
                    </span>
                  </div>

                  {/* Presupuestos / Alternativas de empresas */}
                  <div className="space-y-2 border-t border-dashed pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">
                        Presupuestos / Alternativas de empresas (
                        {item.proposals.length}):
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => addProposal(idx)}
                        className="h-6 text-[11px] text-teal-700 hover:bg-teal-50"
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Añadir presupuesto
                      </Button>
                    </div>

                    {item.proposals.map((prop, pIdx) => (
                      <div
                        key={pIdx}
                        className="flex items-center gap-2 rounded-lg border bg-slate-50 p-2 text-xs"
                      >
                        <Input
                          placeholder="Empresa (ej: Ascensores S.L.)"
                          value={prop.companyName}
                          onChange={(e) =>
                            updateProposal(
                              idx,
                              pIdx,
                              "companyName",
                              e.target.value,
                            )
                          }
                          className="h-7 flex-1 text-xs"
                        />
                        <Input
                          placeholder="Importe (ej: 5.500 €)"
                          value={prop.amount}
                          onChange={(e) =>
                            updateProposal(idx, pIdx, "amount", e.target.value)
                          }
                          className="h-7 w-32 text-xs"
                        />
                        <Input
                          placeholder="URL PDF presupuesto"
                          value={prop.fileUrl}
                          onChange={(e) =>
                            updateProposal(idx, pIdx, "fileUrl", e.target.value)
                          }
                          className="h-7 flex-1 text-xs"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeProposal(idx, pIdx)}
                          className="h-7 w-7 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={createMeetingMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !title.trim() || !meetingDate || createMeetingMutation.isPending
            }
            className="bg-[#027580] font-bold text-white hover:bg-[#015A63]"
          >
            {createMeetingMutation.isPending
              ? "Convocando Junta..."
              : "⚖️ Publicar Convocatoria y Votación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
