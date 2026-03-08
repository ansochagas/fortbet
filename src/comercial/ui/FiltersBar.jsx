import React from "react";
import {
  Download,
  FileJson2,
  FileUp,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { VIEW_MODES } from "../domain";

export const FiltersBar = ({
  monthKey,
  onMonthChange,
  viewMode,
  onViewModeChange,
  search,
  onSearchChange,
  groupFilter,
  onGroupFilterChange,
  groupOptions = [],
  sortKey,
  onSortKeyChange,
  canManage,
  onImportClick,
  onImportOnlineJsonClick,
  onSyncOnlineClick,
  onOpenSettings,
  onlineSyncBusy,
  currentRole,
  onRoleChange,
  roleOptions = [],
}) => {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white/85 p-5 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        <SlidersHorizontal className="h-4 w-4" />
        Controles do Painel
      </div>

      <div className="grid gap-4 xl:grid-cols-[repeat(6,minmax(0,1fr))]">
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Competencia
          <input
            type="month"
            value={monthKey}
            onChange={(event) => onMonthChange(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium normal-case text-slate-950 outline-none transition focus:border-slate-400"
          />
        </label>

        <div className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Horizonte
          <div className="grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => onViewModeChange(VIEW_MODES.MONTHLY)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold normal-case transition ${
                viewMode === VIEW_MODES.MONTHLY
                  ? "bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                  : "text-slate-600"
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange(VIEW_MODES.ANNUAL)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold normal-case transition ${
                viewMode === VIEW_MODES.ANNUAL
                  ? "bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                  : "text-slate-600"
              }`}
            >
              Anual
            </button>
          </div>
        </div>

        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 xl:col-span-2">
          Buscar
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Nome do colaborador"
              className="w-full bg-transparent text-sm font-medium normal-case text-slate-950 outline-none"
            />
          </div>
        </label>

        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Gerencia
          <select
            value={groupFilter}
            onChange={(event) => onGroupFilterChange(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium normal-case text-slate-950 outline-none transition focus:border-slate-400"
          >
            <option value="all">Todas</option>
            {groupOptions.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Ordenacao
          <select
            value={sortKey}
            onChange={(event) => onSortKeyChange(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium normal-case text-slate-950 outline-none transition focus:border-slate-400"
          >
            <option value="priority">Mais criticos</option>
            <option value="performance">Melhor performance</option>
            <option value="faturamento">Maior faturamento</option>
            <option value="novos">Mais novos cambistas</option>
            <option value="alpha">Alfabetica</option>
          </select>
        </label>
      </div>

      <div className="mt-5 flex flex-col gap-4 border-t border-slate-200 pt-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onImportClick}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:bg-slate-800"
          >
            <FileUp className="h-4 w-4" />
            Importar PDF
          </button>

          <button
            type="button"
            onClick={onImportOnlineJsonClick}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
          >
            <FileJson2 className="h-4 w-4" />
            Importar JSON online
          </button>

          <button
            type="button"
            onClick={onSyncOnlineClick}
            disabled={onlineSyncBusy}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              onlineSyncBusy
                ? "cursor-not-allowed bg-slate-200 text-slate-500"
                : "bg-sky-100 text-sky-900 hover:bg-sky-200"
            }`}
          >
            <Download className="h-4 w-4" />
            Sincronizar agora
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            disabled={!canManage}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              canManage
                ? "bg-amber-300 text-slate-950 shadow-lg shadow-amber-300/30 hover:bg-amber-200"
                : "cursor-not-allowed bg-slate-200 text-slate-500"
            }`}
          >
            <Settings2 className="h-4 w-4" />
            Configurar Metas
          </button>

          {!canManage && (
            <span className="text-xs text-slate-500">
              Apenas gerente pode editar metas manuais.
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Perfil Local
          </div>
          <select
            value={currentRole}
            onChange={(event) => onRoleChange(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-slate-400"
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
};
