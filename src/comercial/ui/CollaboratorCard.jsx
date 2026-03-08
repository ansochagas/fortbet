import React from "react";
import {
  formatNumberBR,
  formatPercent,
  getStatusMeta,
  initialsFromName,
  VIEW_MODES,
} from "../domain";
import { ProgressKpi } from "./ProgressKpi";
import { StatusBadge } from "./StatusBadge";

export const CollaboratorCard = ({ card, viewMode }) => {
  const statusMeta = getStatusMeta(card?.overallStatus);
  const kpis = viewMode === VIEW_MODES.ANNUAL ? card?.annual : card?.monthly;
  const secondary = viewMode === VIEW_MODES.ANNUAL ? card?.monthly : card?.annual;

  return (
    <article
      className={`rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-xl shadow-slate-900/5 ring-1 transition hover:-translate-y-0.5 hover:shadow-2xl ${statusMeta.ringClass}`}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {card?.photo ? (
            <img
              src={card.photo}
              alt={card.name}
              className="h-16 w-16 rounded-3xl object-cover shadow-lg shadow-slate-900/10"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-200 text-lg font-black text-slate-700">
              {initialsFromName(card?.name)}
            </div>
          )}

          <div className="min-w-0">
            <p className="truncate text-xl font-black text-slate-950">{card?.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {(card?.groupNames || []).slice(0, 2).map((group) => (
                <span
                  key={`${card?.id}-${group}`}
                  className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
                >
                  {group}
                </span>
              ))}
              {card?.groupNames?.length > 2 && (
                <span className="text-xs font-semibold text-slate-400">
                  +{card.groupNames.length - 2} blocos
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {card?.cambistasCount > 0
                ? `${formatNumberBR(card.cambistasCount)} cambistas ativos no monitoramento`
                : "Sem cambistas monitorados nesta competencia"}
            </p>
          </div>
        </div>

        <StatusBadge status={card?.overallStatus} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ProgressKpi label="Novos Cambistas" data={kpis?.novosCambistas} mode="number" />
        <ProgressKpi label="Faturamento" data={kpis?.faturamento} mode="currency" />
      </div>

      <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50/90 px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {viewMode === VIEW_MODES.ANNUAL ? "Leitura Mensal" : "Leitura Anual"}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Novos Cambistas
            </p>
            <p className="mt-1 font-semibold text-slate-900">
              {formatPercent(secondary?.novosCambistas?.percent)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Faturamento
            </p>
            <p className="mt-1 font-semibold text-slate-900">
              {formatPercent(secondary?.faturamento?.percent)}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
};
