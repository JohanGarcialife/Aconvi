"use client";

import { Bell, Building2, Search } from "lucide-react";
import { Input } from "@acme/ui/input";

export function DashboardTopHeader() {
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
            placeholder="Buscar votación..."
            className="h-8.5 w-full rounded-md border-slate-200 bg-slate-50 pl-8.5 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white"
          />
        </div>

        {/* Notifications Bell with RED dot (Client requirement #1) */}
        <button
          type="button"
          aria-label="Notificaciones"
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-[#EF4444] ring-2 ring-white" />
        </button>

        {/* User avatar circle */}
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-black text-slate-700 select-none">
          MJ
        </div>
      </div>
    </header>
  );
}
