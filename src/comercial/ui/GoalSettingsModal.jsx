import React from "react";
import { X } from "lucide-react";
import { initialsFromName } from "../domain";

const readDraftValue = (draft, collaboratorId, key) =>
  draft?.[collaboratorId]?.[key] ?? "";

export const GoalSettingsModal = ({
  open,
  onClose,
  rows = [],
  draft = {},
  onDraftChange,
  onSave,
  saving,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/55 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-7xl rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-[2rem] border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur-xl">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Configuração Manual
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Metas do mês e metas anuais
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Apenas gerente pode editar. Os campos abaixo definem as metas da V1.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 p-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-x-auto px-6 py-5">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <th className="py-3 pr-4">Colaborador</th>
                <th className="py-3 pr-4">Meta mensal novos</th>
                <th className="py-3 pr-4">Realizado mensal novos</th>
                <th className="py-3 pr-4">Base faturamento mês anterior</th>
                <th className="py-3 pr-4">Meta anual novos</th>
                <th className="py-3">Meta anual faturamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-4 pr-4">
                    <div className="flex min-w-[16rem] items-center gap-3">
                      {row.photo ? (
                        <img
                          src={row.photo}
                          alt={row.name}
                          className="h-12 w-12 rounded-2xl object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-200 font-black text-slate-700">
                          {initialsFromName(row.name)}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-slate-950">{row.name}</p>
                        <p className="text-xs text-slate-500">
                          {(row.groupNames || []).slice(0, 2).join(" · ") || "Sem grupo"}
                        </p>
                      </div>
                    </div>
                  </td>
                  {[
                    "metaMensalNovosCambistas",
                    "realizadoMensalNovosCambistas",
                    "baseFaturamentoMesAnterior",
                    "metaAnualNovosCambistas",
                    "metaAnualFaturamento",
                  ].map((key) => (
                    <td key={`${row.id}-${key}`} className="py-4 pr-4">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={readDraftValue(draft, row.id, key)}
                        onChange={(event) =>
                          onDraftChange(row.id, key, event.target.value)
                        }
                        className="w-full min-w-[10rem] rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-950 outline-none transition focus:border-slate-400"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 rounded-b-[2rem] border-t border-slate-200 bg-slate-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            O faturamento mensal é calculado automaticamente como base do mês anterior + 10%.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar Configurações"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
