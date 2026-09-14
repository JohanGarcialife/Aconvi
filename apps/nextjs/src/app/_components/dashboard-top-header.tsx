"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  Search,
  Vote,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";

import { Input } from "@acme/ui/input";
import { useTRPC } from "~/trpc/react";

const TENANT_ID = "org_aconvi_demo";
const STORAGE_KEY = "af_notifications_last_seen_ts";

interface NotificationItem {
  id: string;
  type: "INCIDENT" | "VOTING" | "NOTICE";
  title: string;
  subtitle: string;
  timestamp: Date;
  href: string;
  urgent?: boolean;
}

export function DashboardTopHeader() {
  const router = useRouter();
  const trpc = useTRPC();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [lastSeenTs, setLastSeenTs] = useState<number>(0);

  // Load last seen timestamp from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setLastSeenTs(parseInt(stored, 10));
      }
    } catch {}
  }, []);

  // Close dropdown on click outside or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Live queries
  const { data: incidents } = useQuery({
    ...trpc.incident.all.queryOptions({ tenantId: TENANT_ID }),
    refetchInterval: 10000,
  });

  const { data: votings } = useQuery({
    ...trpc.voting.all.queryOptions({ tenantId: TENANT_ID }),
    refetchInterval: 10000,
  });

  const { data: notices } = useQuery({
    ...trpc.notice.all.queryOptions({ tenantId: TENANT_ID }),
    refetchInterval: 15000,
  });

  // Compile notifications list
  const notifications = useMemo<NotificationItem[]>(() => {
    const list: NotificationItem[] = [];

    // Incidents
    if (Array.isArray(incidents)) {
      for (const inc of incidents) {
        const isUrgent =
          inc.priority === "ALTA" || inc.priority === "URGENTE";
        const isClosed = ["RESUELTA", "RECHAZADA"].includes(inc.status);
        if (!isClosed) {
          list.push({
            id: `inc-${inc.id}`,
            type: "INCIDENT",
            title: inc.title || "Nueva incidencia reportada",
            subtitle: isUrgent
              ? `Prioridad ${inc.priority} · Requiere atención`
              : `Estado: ${inc.status || "Pendiente"}`,
            timestamp: inc.createdAt ? new Date(inc.createdAt) : new Date(),
            href: "/incidents",
            urgent: isUrgent,
          });
        }
      }
    }

    // Votings
    if (Array.isArray(votings)) {
      for (const v of votings) {
        const isClosed =
          v.status === "CLOSED" ||
          (v.closesAt && new Date(v.closesAt).getTime() < Date.now());
        if (isClosed) {
          list.push({
            id: `vote-${v.id}`,
            type: "VOTING",
            title: v.title || "Votación finalizada",
            subtitle: v.resultSummary
              ? `Resultado: ${v.resultSummary}`
              : "Votación cerrada · Consultar escrutinio",
            timestamp: v.closedAt
              ? new Date(v.closedAt)
              : v.closesAt
                ? new Date(v.closesAt)
                : new Date(),
            href: "/votes",
            urgent: false,
          });
        } else if (v.status === "OPEN") {
          list.push({
            id: `vote-${v.id}`,
            type: "VOTING",
            title: v.title || "Votación activa",
            subtitle: v.type === "JUNTA"
              ? "Junta de propietarios con votación telemática activa"
              : "Decisión abierta a votos de vecinos",
            timestamp: v.createdAt ? new Date(v.createdAt) : new Date(),
            href: "/votes",
            urgent: false,
          });
        }
      }
    }

    // Notices
    if (Array.isArray(notices)) {
      for (const n of notices.slice(0, 5)) {
        list.push({
          id: `not-${n.id}`,
          type: "NOTICE",
          title: n.title || "Nuevo comunicado",
          subtitle: n.pinned ? "Comunicado fijado en el tablón" : "Publicado para vecinos",
          timestamp: n.createdAt ? new Date(n.createdAt) : new Date(),
          href: "/communication",
          urgent: false,
        });
      }
    }

    // Sort newest first
    return list.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
  }, [incidents, votings, notices]);

  // Count items newer than lastSeenTs
  const unreadCount = useMemo(() => {
    if (lastSeenTs === 0) return Math.min(notifications.length, 9);
    return notifications.filter((n) => n.timestamp.getTime() > lastSeenTs)
      .length;
  }, [notifications, lastSeenTs]);

  const hasUnread = unreadCount > 0;

  const handleMarkAllAsRead = () => {
    const now = Date.now();
    setLastSeenTs(now);
    try {
      localStorage.setItem(STORAGE_KEY, now.toString());
    } catch {}
  };

  const handleItemClick = (href: string) => {
    setIsOpen(false);
    handleMarkAllAsRead();
    router.push(href);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-6 backdrop-blur-xs">
      {/* Community Info */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-slate-900">
              Residencial Jardines del Turia
            </span>
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            Calle Los Sauces, 345 · Valencia · 50 propietarios
          </p>
        </div>
      </div>

      {/* Right controls: Search, Red-dot Bell, Avatar */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            type="text"
            placeholder="Buscar votación, incidencia..."
            className="h-8.5 w-full rounded-md border-slate-200 bg-slate-50 pl-8.5 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white"
          />
        </div>

        {/* Notifications Bell with RED dot + Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            aria-label="Notificaciones"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((prev) => !prev)}
            className={`relative flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
              isOpen
                ? "bg-slate-100 text-slate-900"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Bell className="h-5 w-5" />
            {hasUnread && (
              <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-[#EF4444] ring-2 ring-white" />
            )}
          </button>

          {/* Dropdown Panel */}
          {isOpen && (
            <div className="absolute right-0 top-11 z-50 w-80 sm:w-96 rounded-lg border border-slate-200/90 bg-white shadow-xl animate-in fade-in-0 zoom-in-95">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">
                    Notificaciones
                  </span>
                  {hasUnread && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                      {unreadCount} nuevas
                    </span>
                  )}
                </div>
                {hasUnread && (
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    className="flex items-center gap-1 text-[11px] font-medium text-[#008075] hover:underline"
                  >
                    <Check className="h-3 w-3" />
                    Marcar como leídas
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-xs font-semibold text-slate-700">
                      Todo al día
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      No hay notificaciones pendientes.
                    </p>
                  </div>
                ) : (
                  notifications.slice(0, 8).map((item) => {
                    const isNew = item.timestamp.getTime() > lastSeenTs;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleItemClick(item.href)}
                        className={`flex w-full items-start gap-3 p-3.5 text-left transition-colors hover:bg-slate-50 ${
                          isNew ? "bg-slate-50/60" : ""
                        }`}
                      >
                        {/* Icon */}
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                            item.type === "INCIDENT"
                              ? item.urgent
                                ? "bg-red-50 text-red-600"
                                : "bg-amber-50 text-amber-600"
                              : item.type === "VOTING"
                                ? "bg-teal-50 text-[#008075]"
                                : "bg-indigo-50 text-indigo-600"
                          }`}
                        >
                          {item.type === "INCIDENT" && (
                            <AlertTriangle className="h-4 w-4" />
                          )}
                          {item.type === "VOTING" && (
                            <Vote className="h-4 w-4" />
                          )}
                          {item.type === "NOTICE" && (
                            <MessageSquare className="h-4 w-4" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {item.title}
                            </span>
                            {isNew && (
                              <span className="h-1.5 w-1.5 rounded-full bg-[#EF4444] shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-2">
                            {item.subtitle}
                          </p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {formatDistanceToNow(item.timestamp, {
                              addSuffix: true,
                              locale: es,
                            })}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-2.5">
                <Link
                  href="/incidents"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900"
                >
                  Incidencias
                  <ChevronRight className="h-3 w-3 text-slate-400" />
                </Link>
                <Link
                  href="/votes"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-[#008075] hover:underline"
                >
                  Votaciones
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User avatar circle */}
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-black text-slate-700 select-none">
          MJ
        </div>
      </div>
    </header>
  );
}
