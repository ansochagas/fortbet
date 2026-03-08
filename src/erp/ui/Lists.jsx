import React from "react";
import { Users, AlertTriangle } from "lucide-react";
import { SectionTitle } from "./Typography";
import { Pill } from "./Cards";

export const HierarchyList = ({ data }) => (
  <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 shadow-xl">
    <SectionTitle
      title="Hierarquia (seed)"
      subtitle="Gerentes e seus cambistas cadastrados"
      icon={Users}
    />
    <div className="space-y-3">
      {(!data || data.length === 0) && (
        <p className="text-sm text-gray-400">Nenhuma hierarquia definida.</p>
      )}
      {data?.map((g) => (
        <div
          key={g.id}
          className="flex flex-col gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/5"
        >
          <div className="flex items-center justify-between">
            <p className="text-white font-semibold">{g.nome}</p>
            <span className="text-xs text-gray-400">{g.cambistas?.length || 0} cambistas</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-gray-300">
            {(g.cambistas || []).map((c) => (
              <Pill key={c.id || c.nome}>{c.nome}</Pill>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const InativosList = ({ items, formatCurrency }) => (
  <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 shadow-xl">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-bold text-white">Inatividade e atenção</h3>
      <AlertTriangle className="w-5 h-5 text-yellow-400" />
    </div>
    <div className="space-y-3">
      {items?.length === 0 && <p className="text-gray-400 text-sm">Nenhum alerta de inatividade.</p>}
      {items?.map((c, idx) => (
        <div
          key={`slow-${c.nome}-${idx}`}
          className="flex items-center justify-between px-3 py-3 rounded-xl bg-red-500/10 border border-red-500/20"
        >
          <div>
            <p className="text-white font-semibold">{c.nome}</p>
            <p className="text-xs text-gray-400">
              {c.apostasN} apostas • Líquido {formatCurrency(c.liquidoN)}
            </p>
          </div>
          <span className="text-xs text-red-200 bg-red-500/20 px-2 py-1 rounded-full">Revisar</span>
        </div>
      ))}
    </div>
  </div>
);
