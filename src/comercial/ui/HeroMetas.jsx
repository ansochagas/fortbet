import React from "react";
import {
  formatCurrencyBR,
  formatNumberBR,
  formatPercent,
  VIEW_MODES,
} from "../domain";

const MetricCard = ({
  title,
  monthly,
  annual,
  viewMode,
  mode = "number",
}) => {
  const formatter = mode === "currency" ? formatCurrencyBR : formatNumberBR;
  const selected = viewMode === VIEW_MODES.ANNUAL ? annual : monthly;

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-2xl shadow-black/10">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/80">
            KPI Principal
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">{title}</h2>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-right">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">
            Destaque Atual
          </p>
          <p className="text-lg font-bold text-white">{formatPercent(selected?.percent)}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          { label: "Mensal", data: monthly, active: viewMode === VIEW_MODES.MONTHLY },
          { label: "Anual", data: annual, active: viewMode === VIEW_MODES.ANNUAL },
        ].map((bucket) => (
          <div
            key={bucket.label}
            className={`rounded-3xl border px-4 py-4 ${
              bucket.active
                ? "border-amber-300/40 bg-amber-300/10"
                : "border-white/10 bg-black/10"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                {bucket.label}
              </p>
              <p className="text-sm font-semibold text-white">
                {formatPercent(bucket.data?.percent)}
              </p>
            </div>
            <div className="space-y-2 text-sm text-white/70">
              <div className="flex items-center justify-between">
                <span>Meta</span>
                <span className="font-semibold text-white">
                  {formatter(bucket.data?.goal)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Realizado</span>
                <span className="font-semibold text-white">
                  {formatter(bucket.data?.actual)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Gap</span>
                <span
                  className={`font-semibold ${
                    bucket.data?.gap <= 0 ? "text-emerald-300" : "text-rose-300"
                  }`}
                >
                  {formatter(Math.abs(bucket.data?.gap || 0))}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const HeroMetas = ({ monthLabel, totals, viewMode, lastUpdated, actions }) => {
  return (
    <section className="relative overflow-hidden rounded-[2.25rem] bg-slate-950 px-6 py-8 text-white shadow-2xl shadow-slate-950/20 md:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.18),transparent_32%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.16),transparent_30%)]" />
      <div className="relative z-10">
        <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-base font-bold uppercase tracking-[0.18em] text-amber-200/90 md:text-lg">
              Monitoramento Comercial MONACO LOTERIAS
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <div className="rounded-3xl border border-white/10 bg-white/10 px-5 py-4 backdrop-blur-xl">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">
                Competência
              </p>
              <p className="mt-1 text-2xl font-bold capitalize text-white">{monthLabel}</p>
            </div>
            {lastUpdated ? (
              <p className="text-xs text-white/60">
                Última atualização: {lastUpdated.replace("T", " ").slice(0, 19)}
              </p>
            ) : (
              <p className="text-xs text-white/50">
                Nenhum PDF importado nesta competência.
              </p>
            )}
            {actions}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <MetricCard
            title="Novos Cambistas"
            monthly={totals?.monthly?.novosCambistas}
            annual={totals?.annual?.novosCambistas}
            viewMode={viewMode}
            mode="number"
          />
          <MetricCard
            title="Faturamento"
            monthly={totals?.monthly?.faturamento}
            annual={totals?.annual?.faturamento}
            viewMode={viewMode}
            mode="currency"
          />
        </div>
      </div>
    </section>
  );
};
