import React from "react";
import {
  formatCurrencyBR,
  formatNumberBR,
  formatPercent,
  getStatusMeta,
} from "../domain";
import { StatusBadge } from "./StatusBadge";

const clamp = (value) => Math.max(0, Math.min(100, Number(value || 0)));

export const ProgressKpi = ({
  label,
  data,
  mode = "number",
}) => {
  const meta = getStatusMeta(data?.status);
  const ratio = clamp(data?.percent);
  const formatValue = mode === "currency" ? formatCurrencyBR : formatNumberBR;
  const mainValueClass =
    mode === "currency"
      ? "mt-1 text-lg font-bold leading-tight text-slate-950 tabular-nums [overflow-wrap:anywhere]"
      : "mt-1 text-xl font-bold text-slate-950";
  const detailValueClass =
    mode === "currency"
      ? "mt-1 text-sm font-semibold leading-tight text-slate-900 tabular-nums [overflow-wrap:anywhere]"
      : "mt-1 font-semibold text-slate-900";

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-sm shadow-slate-900/5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {label}
          </p>
          <p className={mainValueClass}>
            {formatValue(data?.actual)}
          </p>
        </div>
        <StatusBadge status={data?.status} />
      </div>

      <div className="mb-3 h-3 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${meta.progressClass}`}
          style={{ width: `${ratio}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm text-slate-600">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
            Meta
          </p>
          <p className={detailValueClass}>{formatValue(data?.goal)}</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
            Atingido
          </p>
          <p className="mt-1 font-semibold leading-tight text-slate-900 tabular-nums">
            {formatPercent(data?.percent)}
          </p>
        </div>
      </div>
    </div>
  );
};
