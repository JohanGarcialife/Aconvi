"use client";

import { useState } from "react";
import { format, isPast, isToday, differenceInDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
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
  CalendarCheck,
  Plus,
  CheckCircle2,
  Trash2,
  Wrench,
  Scale,
  FileText,
  DollarSign,
  FolderOpen,
  AlertCircle,
  Circle,
  RotateCcw,
  Calendar as CalendarIcon,
  List as ListIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const TENANT_ID = "org_aconvi_demo";

const CATEGORIES = [
  { value: "MANTENIMIENTO", label: "Mantenimiento", icon: Wrench, color: "text-orange-600 bg-orange-50 border-orange-100" },
  { value: "LEGAL", label: "Legal", icon: Scale, color: "text-purple-600 bg-purple-50 border-purple-100" },
  { value: "ADMINISTRATIVO", label: "Administrativo", icon: FileText, color: "text-blue-600 bg-blue-50 border-blue-100" },
  { value: "FINANCIERO", label: "Financiero", icon: DollarSign, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
  { value: "OTRO", label: "Otro", icon: FolderOpen, color: "text-muted-foreground bg-muted/30 border-border" },
] as const;

const RECURRENCES = [
  { value: "NONE", label: "Sin recurrencia" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "MONTHLY", label: "Mensual" },
  { value: "ANNUAL", label: "Anual" },
] as const;

type AgendaCategory = (typeof CATEGORIES)[number]["value"];

function categoryMeta(cat: string) {
  return CATEGORIES.find((c) => c.value === cat) ?? CATEGORIES[CATEGORIES.length - 1]!;
}

// ─── Create Task Dialog ───────────────────────────────────────────────────────
function CreateTaskDialog({ onSuccess }: { onSuccess: () => void }) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<AgendaCategory>("ADMINISTRATIVO");
  const [dueDate, setDueDate] = useState("");
  const [recurrence, setRecurrence] = useState<"NONE" | "WEEKLY" | "MONTHLY" | "ANNUAL">("NONE");

  const createMutation = useMutation(
    trpc.agenda.create.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        setTitle("");
        setDescription("");
        setCategory("ADMINISTRATIVO");
        setDueDate("");
        setRecurrence("NONE");
        onSuccess();
      },
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Tarea
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear tarea</DialogTitle>
          <DialogDescription>
            Añade una tarea a la agenda inteligente de la comunidad.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Category */}
          <div className="grid gap-2">
            <Label>Categoría</Label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => {
                const isActive = category === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value as AgendaCategory)}
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
            <Label htmlFor="task-title">Título *</Label>
            <Input
              id="task-title"
              placeholder="Ej: Revisión ITE del edificio"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="task-desc">Descripción</Label>
            <Textarea
              id="task-desc"
              placeholder="Detalles adicionales..."
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="task-due">Fecha límite *</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="task-recurrence">Recurrencia</Label>
              <select
                id="task-recurrence"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as typeof recurrence)}
              >
                {RECURRENCES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={() =>
              createMutation.mutate({
                tenantId: TENANT_ID,
                title,
                description: description || undefined,
                category,
                dueDate,
                recurrence,
              })
            }
            disabled={!title.trim() || !dueDate || createMutation.isPending}
          >
            {createMutation.isPending ? "Creando..." : "📅 Crear tarea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────
function TaskRow({
  task,
  onDone,
  onReopen,
  onDelete,
}: {
  task: any;
  onDone: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const meta = categoryMeta(task.category ?? "OTRO");
  const Icon = meta.icon;
  const due = new Date(task.dueDate + "T00:00:00");
  const overdue = isPast(due) && !isToday(due) && !task.isDone;
  const daysLeft = differenceInDays(due, new Date());
  const recurrenceLabel = RECURRENCES.find((r) => r.value === task.recurrence)?.label ?? "";

  return (
    <div
      className={`flex items-center gap-4 rounded-xl border bg-card px-4 py-3 transition-all ${
        task.isDone ? "opacity-60" : overdue ? "border-destructive/40 bg-destructive/5" : ""
      }`}
    >
      {/* Done button */}
      <button
        onClick={() => task.isDone ? onReopen(task.id) : onDone(task.id)}
        className={`shrink-0 transition-colors ${
          task.isDone
            ? "text-emerald-500"
            : "text-muted-foreground hover:text-emerald-500"
        }`}
      >
        {task.isDone ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <Circle className="h-5 w-5" />
        )}
      </button>

      {/* Category icon */}
      <div className={`rounded-lg border p-1.5 shrink-0 ${meta.color}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.isDone ? "line-through text-muted-foreground" : ""}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
        )}
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 shrink-0">
        {task.recurrence !== "NONE" && (
          <Badge variant="outline" className="text-xs">
            <RotateCcw className="h-2.5 w-2.5 mr-1" />
            {recurrenceLabel}
          </Badge>
        )}

        {task.isDone ? (
          <span className="text-xs text-emerald-600 font-medium">Completada</span>
        ) : overdue ? (
          <span className="flex items-center gap-1 text-xs text-destructive font-medium">
            <AlertCircle className="h-3.5 w-3.5" />
            Vencida
          </span>
        ) : (
          <span className={`text-xs font-medium ${daysLeft <= 7 ? "text-amber-600" : "text-muted-foreground"}`}>
            {isToday(due)
              ? "Hoy"
              : daysLeft === 1
              ? "Mañana"
              : `${format(due, "d MMM yyyy", { locale: es })}`}
          </span>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={() => onDelete(task.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
// ─── Calendar View ────────────────────────────────────────────────────────────
function CalendarView({
  year,
  month,
  onMonthChange,
  events,
}: {
  year: number;
  month: number;
  onMonthChange: (y: number, m: number) => void;
  events: any[];
}) {
  const currentMonth = new Date(year, month - 1, 1);
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const dateFormat = "d";
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => {
    const next = addMonths(currentMonth, 1);
    onMonthChange(next.getFullYear(), next.getMonth() + 1);
  };
  const prevMonth = () => {
    const prev = subMonths(currentMonth, 1);
    onMonthChange(prev.getFullYear(), prev.getMonth() + 1);
  };

  return (
    <div className="flex flex-col rounded-xl border bg-card overflow-hidden">
      {/* Calendar Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <h2 className="text-lg font-bold capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: es })}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Days Header */}
      <div className="grid grid-cols-7 border-b bg-muted/20">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
          <div key={day} className="py-2 text-center text-xs font-semibold text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isTodayDate = isSameDay(day, new Date());
          const dateStr = format(day, "yyyy-MM-dd");

          const dayEvents = events.filter((e) => e.date === dateStr);

          return (
            <div
              key={day.toString()}
              className={`min-h-[100px] border-b border-r p-2 transition-colors hover:bg-muted/10 ${
                !isCurrentMonth ? "bg-muted/10 opacity-50" : ""
              } ${i % 7 === 6 ? "border-r-0" : ""}`}
            >
              <div
                className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  isTodayDate ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {format(day, dateFormat)}
              </div>
              <div className="flex flex-col gap-1">
                {dayEvents.map((evt) => {
                  let bg = "bg-slate-100 text-slate-700 border-slate-200";
                  if (evt.type === "vote") bg = "bg-blue-50 text-blue-700 border-blue-200";
                  if (evt.type === "incident") bg = "bg-orange-50 text-orange-700 border-orange-200";
                  if (evt.type === "task" && evt.isDone) bg = "bg-emerald-50 text-emerald-700 border-emerald-200 opacity-60";

                  return (
                    <div
                      key={evt.id}
                      className={`truncate rounded border px-1.5 py-0.5 text-[10px] font-medium leading-tight ${bg}`}
                      title={evt.label}
                    >
                      {evt.label}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AgendaPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showDone, setShowDone] = useState(false);
  const [catFilter, setCatFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"LIST" | "CALENDAR">("LIST");
  const [calendarDate, setCalendarDate] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });

  const { data: tasks, isLoading } = useQuery(
    trpc.agenda.all.queryOptions({
      tenantId: TENANT_ID,
      showDone,
      category: catFilter === "ALL" ? undefined : catFilter,
    }),
  );

  const { data: calendarEvents } = useQuery(
    trpc.agenda.getCalendarEvents.queryOptions({
      tenantId: TENANT_ID,
      year: calendarDate.year,
      month: calendarDate.month,
    }),
  );

  const doneMutation = useMutation(
    trpc.agenda.done.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(trpc.agenda.all.queryFilter({ tenantId: TENANT_ID })),
    }),
  );

  const reopenMutation = useMutation(
    trpc.agenda.reopen.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(trpc.agenda.all.queryFilter({ tenantId: TENANT_ID })),
    }),
  );

  const deleteMutation = useMutation(
    trpc.agenda.delete.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(trpc.agenda.all.queryFilter({ tenantId: TENANT_ID })),
    }),
  );

  const refresh = () =>
    queryClient.invalidateQueries(trpc.agenda.all.queryFilter({ tenantId: TENANT_ID }));

  const overdueCount = tasks?.filter((t: any) => {
    const due = new Date(t.dueDate + "T00:00:00");
    return !t.isDone && isPast(due) && !isToday(due);
  }).length ?? 0;

  const pendingCount = tasks?.filter((t: any) => !t.isDone).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agenda Inteligente</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Tareas, vencimientos y recordatorios de la comunidad.
          </p>
        </div>
        <CreateTaskDialog onSuccess={refresh} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Pendientes", value: pendingCount, color: "text-foreground bg-muted/20 border-border" },
          { label: "Vencidas", value: overdueCount, color: overdueCount > 0 ? "text-destructive bg-destructive/10 border-destructive/20" : "text-muted-foreground bg-muted/10 border-border" },
          {
            label: "Esta semana",
            value: tasks?.filter((t: any) => {
              if (t.isDone) return false;
              const due = new Date(t.dueDate + "T00:00:00");
              const days = differenceInDays(due, new Date());
              return days >= 0 && days <= 7;
            }).length ?? 0,
            color: "text-amber-600 bg-amber-50 border-amber-100"
          },
          { label: "Completadas", value: tasks?.filter((t: any) => t.isDone).length ?? 0, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl border p-4 ${color}`}>
            <p className="text-xs font-medium mb-1">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg self-start">
        <button
          onClick={() => setViewMode("LIST")}
          className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
            viewMode === "LIST" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ListIcon className="h-4 w-4" />
          Lista de tareas
        </button>
        <button
          onClick={() => setViewMode("CALENDAR")}
          className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
            viewMode === "CALENDAR" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CalendarIcon className="h-4 w-4" />
          Calendario Inteligente
        </button>
      </div>

      {viewMode === "CALENDAR" ? (
        <CalendarView
          year={calendarDate.year}
          month={calendarDate.month}
          onMonthChange={(year, month) => setCalendarDate({ year, month })}
          events={calendarEvents ?? []}
        />
      ) : (
        <>
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {[{ key: "ALL", label: "Todas" }, ...CATEGORIES.map(c => ({ key: c.value, label: c.label }))].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setCatFilter(key)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                    catFilter === key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowDone(!showDone)}
              className={`ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                showDone
                  ? "bg-muted border-border"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              <CheckCircle2 className="h-3 w-3" />
              {showDone ? "Ocultar completadas" : "Mostrar completadas"}
            </button>
          </div>

          {/* Task List */}
          {isLoading ? (
            <div className="text-muted-foreground text-sm">Cargando agenda...</div>
          ) : !tasks?.length ? (
            <div className="py-16 text-center border rounded-xl bg-muted/20">
              <CalendarCheck className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-40" />
              <p className="text-muted-foreground text-sm">
                No hay tareas pendientes. Crea la primera tarea.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {tasks.map((task: any) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onDone={(id) => doneMutation.mutate({ id })}
                  onReopen={(id) => reopenMutation.mutate({ id })}
                  onDelete={(id) => {
                    if (confirm("¿Eliminar esta tarea?")) deleteMutation.mutate({ id });
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
