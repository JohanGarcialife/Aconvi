"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  Trees,
  TrendingUp,
  UploadCloud,
  Vote,
} from "lucide-react";

import { useTRPC } from "~/trpc/react";

const TENANT_ID = "org_aconvi_demo";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "teal",
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: "teal" | "violet" | "amber" | "red" | "green" | "slate";
  href?: string;
}) {
  const colors: Record<string, string> = {
    teal: "bg-teal-50 text-teal-600 border-teal-100",
    violet: "bg-violet-50 text-violet-600 border-violet-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    red: "bg-red-50 text-red-600 border-red-100",
    green: "bg-green-50 text-green-600 border-green-100",
    slate: "bg-slate-50 text-slate-600 border-slate-100",
  };

  const card = (
    <div className="flex items-center gap-4 rounded-2xl border bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
      <div className={`rounded-xl border p-3 ${colors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </p>
        <p className="mt-0.5 text-3xl leading-none font-bold tracking-tight">
          {value}
        </p>
        {sub && <p className="text-muted-foreground mt-1 text-xs">{sub}</p>}
      </div>
    </div>
  );

  if (href)
    return (
      <Link href={href} className="no-underline">
        {card}
      </Link>
    );
  return card;
}

function QuickActionCard({
  icon: Icon,
  title,
  desc,
  href,
  color,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  href: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="group hover:border-primary/30 flex items-start gap-4 rounded-2xl border bg-white p-5 no-underline shadow-xs transition-all hover:shadow-md"
    >
      <div className={`rounded-xl p-2.5 ${color} shrink-0`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-foreground group-hover:text-primary text-sm font-semibold transition-colors">
          {title}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
          {desc}
        </p>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const trpc = useTRPC();

  // Only use publicProcedure endpoints
  const { data: incidents } = useQuery({
    ...trpc.incident.all.queryOptions({ tenantId: TENANT_ID }),
    refetchInterval: 5000,
  });
  const { data: notices } = useQuery({
    ...trpc.notice.all.queryOptions({ tenantId: TENANT_ID }),
    refetchInterval: 5000,
  });
  const { data: communities } = useQuery(trpc.community.all.queryOptions());

  const openIncidents =
    incidents?.filter((i: any) => !["RESUELTA", "RECHAZADA"].includes(i.status))
      .length ?? 0;

  const urgentIncidents =
    incidents?.filter(
      (i: any) => i.priority === "ALTA" || i.priority === "URGENTE",
    ).length ?? 0;

  const resolvedIncidents =
    incidents?.filter((i: any) => i.status === "RESUELTA").length ?? 0;

  const pinnedNotices = notices?.filter((n: any) => n.pinned).length ?? 0;

  const now = new Date();

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Panel de Control</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {now.toLocaleDateString("es-ES", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Building2}
          label="Comunidades"
          value={communities?.length ?? 0}
          sub="bajo gestión"
          color="teal"
          href="/communities"
        />
        <StatCard
          icon={Bell}
          label="Incidencias activas"
          value={openIncidents}
          sub={
            urgentIncidents > 0 ? `${urgentIncidents} urgentes` : "todo al día"
          }
          color={urgentIncidents > 0 ? "red" : "green"}
          href="/incidents"
        />
        <StatCard
          icon={MessageSquare}
          label="Comunicados"
          value={notices?.length ?? 0}
          sub={pinnedNotices > 0 ? `${pinnedNotices} fijados` : "publicados"}
          color="violet"
          href="/communication"
        />
        <StatCard
          icon={CheckCircle2}
          label="Resueltas"
          value={resolvedIncidents}
          sub="incidencias cerradas"
          color="green"
          href="/incidents"
        />
      </div>

      {/* Main split */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent incidents */}
        <div className="rounded-2xl border bg-white p-6 shadow-xs">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="text-primary h-4 w-4" />
              <h2 className="text-base font-semibold">Últimas incidencias</h2>
            </div>
            <Link
              href="/incidents"
              className="text-primary text-xs font-medium hover:underline"
            >
              Ver todas →
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {incidents && incidents.length > 0 ? (
              incidents.slice(0, 5).map((inc: any) => {
                const statusColors: Record<string, string> = {
                  RECIBIDA: "bg-blue-100 text-blue-700",
                  EN_PROGRESO: "bg-amber-100 text-amber-700",
                  RESUELTA: "bg-green-100 text-green-700",
                  RECHAZADA: "bg-slate-100 text-slate-500",
                };
                const priorityMap: Record<
                  string,
                  { icon: React.ElementType; cls: string }
                > = {
                  BAJA: { icon: CheckCircle2, cls: "text-slate-400" },
                  MEDIA: { icon: Clock, cls: "text-amber-500" },
                  ALTA: { icon: AlertTriangle, cls: "text-orange-500" },
                  URGENTE: { icon: AlertTriangle, cls: "text-red-500" },
                };
                const p = priorityMap[inc.priority] ?? priorityMap.MEDIA!;
                const PIcon = p.icon;

                return (
                  <Link
                    key={inc.id}
                    href={`/incidents/${inc.id}`}
                    className="flex items-start gap-3 rounded-xl border p-3 no-underline transition-colors hover:bg-slate-50"
                  >
                    <PIcon className={`mt-0.5 h-4 w-4 shrink-0 ${p.cls}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate text-sm font-medium">
                        {inc.title}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {new Date(inc.createdAt).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[inc.status] ?? "bg-slate-100 text-slate-500"}`}
                    >
                      {inc.status.replace("_", " ")}
                    </span>
                  </Link>
                );
              })
            ) : (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Sin incidencias registradas
              </p>
            )}
          </div>
        </div>

        {/* Recent notices */}
        <div className="rounded-2xl border bg-white p-6 shadow-xs">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="text-primary h-4 w-4" />
              <h2 className="text-base font-semibold">Tablón de comunicados</h2>
            </div>
            <Link
              href="/communication"
              className="text-primary text-xs font-medium hover:underline"
            >
              Ver todos →
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {notices && notices.length > 0 ? (
              notices.slice(0, 5).map((n: any) => {
                const typeColors: Record<string, string> = {
                  COMUNICADO: "bg-primary/10 text-primary",
                  AVISO: "bg-amber-100 text-amber-700",
                  URGENTE: "bg-red-100 text-red-700",
                };
                return (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 rounded-xl border p-3"
                  >
                    {n.pinned && (
                      <span className="mt-0.5 shrink-0 text-xs text-amber-500">
                        📌
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      <p className="text-muted-foreground line-clamp-1 text-xs">
                        {n.content}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${typeColors[n.type] ?? "bg-slate-100 text-slate-500"}`}
                    >
                      {n.type}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Sin comunicados publicados
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-4 text-base font-semibold">Accesos rápidos</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickActionCard
            icon={Building2}
            title="Gestionar Comunidades"
            desc="Añade vecinos, edita datos y administra las fincas."
            href="/communities"
            color="bg-teal-50 text-teal-600"
          />
          <QuickActionCard
            icon={MessageSquare}
            title="Publicar Comunicado"
            desc="Informa a todos los vecinos con un solo clic."
            href="/communication"
            color="bg-violet-50 text-violet-600"
          />
          <QuickActionCard
            icon={Trees}
            title="Zonas Comunes"
            desc="Consulta y gestiona las reservas activas."
            href="/common-areas"
            color="bg-amber-50 text-amber-600"
          />
          <QuickActionCard
            icon={FileText}
            title="Documentos"
            desc="Sube y gestiona actas, estatutos y contratos."
            href="/documents"
            color="bg-slate-100 text-slate-600"
          />
          <QuickActionCard
            icon={Bell}
            title="Incidencias"
            desc="Revisa y gestiona las incidencias abiertas."
            href="/incidents"
            color="bg-red-50 text-red-600"
          />
          <QuickActionCard
            icon={Vote}
            title="Votaciones Online"
            desc="Crea decisiones individuales y juntas extraordinarias."
            href="/votes"
            color="bg-emerald-50 text-emerald-600"
          />
          <QuickActionCard
            icon={UploadCloud}
            title="Importador"
            desc="Importa vecinos y comunidades desde Excel."
            href="/importer"
            color="bg-blue-50 text-blue-600"
          />
        </div>
      </div>
    </div>
  );
}
