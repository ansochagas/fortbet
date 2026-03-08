import React from "react";
import { formatCurrencyBR, formatNumberBR } from "../domain";
import { StatusBadge } from "./StatusBadge";

const HighlightCard = ({ title, value, helper, accentClass }) => (
  <div className={`rounded-3xl border p-5 shadow-sm ${accentClass}`}>
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
      {title}
    </p>
    <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
    <p className="mt-2 text-sm text-slate-600">{helper}</p>
  </div>
);

export const TeamSummary = ({ summary, viewMode }) => {
  const topNew = summary?.topNovosCambistas;
  const topRevenue = summary?.topFaturamento;

  return (
    <section className="grid gap-4 xl:grid-cols-[1.5fr,1fr,1fr]">
      <div className="rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Resumo da equipe
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          <HighlightCard
            title="Acima da Meta"
            value={formatNumberBR(summary?.acima)}
            helper="Dois KPIs saudaveis."
            accentClass="border-emerald-200 bg-emerald-50/70"
          />
          <HighlightCard
            title="Em Atencao"
            value={formatNumberBR(summary?.atencao)}
            helper="Precisam de monitoramento."
            accentClass="border-amber-200 bg-amber-50/70"
          />
          <HighlightCard
            title="Criticos"
            value={formatNumberBR(summary?.critico)}
            helper="Prioridade da rotina comercial."
            accentClass="border-rose-200 bg-rose-50/70"
          />
          <HighlightCard
            title="Sem Meta"
            value={formatNumberBR(summary?.semMeta)}
            helper="KPI sem meta configurada."
            accentClass="border-slate-300 bg-slate-100/70"
          />
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Destaque em Novos Cambistas
        </p>
        {topNew ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xl font-bold text-slate-950">{topNew.name}</p>
              <StatusBadge status={topNew.overallStatus} />
            </div>
            <p className="text-sm text-slate-600">
              {viewMode === "annual" ? "Acumulado anual" : "Competencia atual"} com{" "}
              <span className="font-semibold text-slate-950">
                {formatNumberBR(topNew.selected.novosCambistas.actual)}
              </span>{" "}
              novos cambistas.
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Sem dados nesta competencia.</p>
        )}
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Destaque em Faturamento
        </p>
        {topRevenue ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xl font-bold text-slate-950">{topRevenue.name}</p>
              <StatusBadge status={topRevenue.overallStatus} />
            </div>
            <p className="text-sm text-slate-600">
              {viewMode === "annual" ? "Acumulado anual" : "Competencia atual"} com{" "}
              <span className="font-semibold text-slate-950">
                {formatCurrencyBR(topRevenue.selected.faturamento.actual)}
              </span>{" "}
              em entradas.
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Sem dados nesta competencia.</p>
        )}
      </div>
    </section>
  );
};
