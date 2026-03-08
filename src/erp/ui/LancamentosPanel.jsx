import React from "react";
import { XCircle } from "lucide-react";

export const LancamentosPanel = ({
  fluxoDiario = [],
  fluxoCentroCusto = { rows: [], resumo: {} },
  filteredLancamentos = [],
  auditLog = [],
  novoLanc,
  setNovoLanc,
  handleNovoLancChange,
  handleAddLancamento,
  handleResetLancCustom,
  handleRemoveLancCustom,
  lancCustom = [],
  handleExportLancamentos,
  exportFinance,
  canManageFinance,
  centrosLanc = [],
  lancPorGerente = [],
  formatCurrencyBR,
  formatNumberBR,
  erpStore,
  userIndex,
}) => {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-white/10">
              <th className="py-2 pr-4">Dia</th>
              <th className="py-2 pr-4">Entradas</th>
              <th className="py-2 pr-4">Custos</th>
              <th className="py-2 pr-4">Despesas</th>
              <th className="py-2 pr-4">Líquido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {fluxoDiario.map((f) => (
              <tr key={f.dia}>
                <td className="py-2 pr-4 text-white">{f.dia}</td>
                <td className="py-2 pr-4 text-gray-200">{formatCurrencyBR(f.entrada)}</td>
                <td className="py-2 pr-4 text-gray-200">{formatCurrencyBR(f.custos)}</td>
                <td className="py-2 pr-4 text-gray-200">{formatCurrencyBR(f.despesas)}</td>
                <td className={`py-2 pr-4 font-semibold ${f.liquido >= 0 ? "text-green-300" : "text-red-300"}`}>
                  {formatCurrencyBR(f.liquido)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-xs text-gray-400">
        Mock seguro: usa apenas PDF/seed e distribui em 7 dias para dar leitura rápida do fluxo.
      </div>

      <div className="mt-6 bg-gray-900/80 border border-gray-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Lançamentos por dia (seed)</h3>
            <p className="text-xs text-gray-400">Filtra por data/competência e mostra entradas/saídas/cartão</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>{filteredLancamentos.length} lançamentos</span>
            <button
              type="button"
              onClick={handleExportLancamentos}
              className="px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white hover:bg-white/20 transition disabled:opacity-50"
              disabled={!exportFinance}
            >
              Exportar CSV
            </button>
          </div>
        </div>
        <div className="mb-4 rounded-xl border border-white/5 bg-white/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-white">Auditoria local (últimas ações)</p>
            <span className="text-xs text-gray-400">{auditLog.length} eventos</span>
          </div>
          <div className="divide-y divide-white/5 max-h-48 overflow-y-auto">
            {auditLog.length === 0 && <p className="text-sm text-gray-400 py-2">Sem eventos registrados</p>}
            {auditLog.map((log) => (
              <div key={log.id} className="py-2 text-xs text-gray-200">
                <span className="text-[11px] text-gray-400">{log.at?.slice(0, 19)?.replace("T", " ")}</span>{" "}
                <span className="font-semibold text-white">{log.action}</span>
              </div>
            ))}
          </div>
        </div>
        {!canManageFinance && (
          <div className="text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 rounded-lg">
            Apenas admin/financeiro podem adicionar ou remover lançamentos.
          </div>
        )}
        <div className="mb-4 rounded-xl border border-white/5 bg-white/5 p-4">
          <div className="flex flex-col md:flex-row md:items-end md:gap-4 gap-3">
            <label className="flex flex-col text-xs text-gray-300 gap-1 w-full md:w-32">
              Tipo
              <select
                className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={novoLanc.tipo}
                onChange={(e) => handleNovoLancChange("tipo", e.target.value)}
                disabled={!canManageFinance}
              >
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
                <option value="cartao">Cartão</option>
                <option value="lancamento">Lançamento</option>
              </select>
            </label>
            <label className="flex flex-col text-xs text-gray-300 gap-1 w-full md:w-28">
              Valor
              <input
                type="number"
                step="0.01"
                className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={novoLanc.valor}
                onChange={(e) => handleNovoLancChange("valor", e.target.value)}
                disabled={!canManageFinance}
              />
            </label>
            <label className="flex flex-col text-xs text-gray-300 gap-1 w-full md:w-40">
              Centro de custo
              <input
                type="text"
                className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={novoLanc.centroCusto}
                onChange={(e) => handleNovoLancChange("centroCusto", e.target.value)}
                disabled={!canManageFinance}
              />
            </label>
            <label className="flex flex-col text-xs text-gray-300 gap-1 w-full md:w-44">
              Usuário
              <select
                className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={novoLanc.usuarioId}
                onChange={(e) => handleNovoLancChange("usuarioId", e.target.value)}
                disabled={!canManageFinance}
              >
                {(erpStore?.usuarios || []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome} ({u.papel})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs text-gray-300 gap-1 w-full md:w-36">
              Período
              <select
                className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={novoLanc.periodoId}
                onChange={(e) => handleNovoLancChange("periodoId", e.target.value)}
                disabled={!canManageFinance}
              >
                {(erpStore?.periodos || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs text-gray-300 gap-1 w-full md:w-36">
              Data
              <input
                type="date"
                className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={novoLanc.data}
                onChange={(e) => handleNovoLancChange("data", e.target.value)}
                disabled={!canManageFinance}
              />
            </label>
          </div>
          <label className="flex flex-col text-xs text-gray-300 gap-1 mt-3">
            Descrição
            <input
              type="text"
              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              value={novoLanc.descricao}
              onChange={(e) => handleNovoLancChange("descricao", e.target.value)}
              disabled={!canManageFinance}
              placeholder="Lançamento manual"
            />
          </label>
          <div className="flex flex-wrap gap-3 mt-3">
            <button
              onClick={handleAddLancamento}
              className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50"
              type="button"
              disabled={!canManageFinance}
            >
              Adicionar (mock)
            </button>
            <button
              onClick={handleResetLancCustom}
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm font-semibold hover:bg-white/20 transition disabled:opacity-50"
              type="button"
              disabled={!canManageFinance}
            >
              Limpar adições
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="rounded-xl border border-white/5 bg-white/5 p-3">
            <p className="text-[11px] text-gray-400">Entradas</p>
            <p className="text-lg font-semibold text-white">{formatCurrencyBR(fluxoCentroCusto.resumo.entrada)}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/5 p-3">
            <p className="text-[11px] text-gray-400">Saídas</p>
            <p className="text-lg font-semibold text-white">{formatCurrencyBR(fluxoCentroCusto.resumo.saida)}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/5 p-3">
            <p className="text-[11px] text-gray-400">Cartões</p>
            <p className="text-lg font-semibold text-white">{formatCurrencyBR(fluxoCentroCusto.resumo.cartao)}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/5 p-3">
            <p className="text-[11px] text-gray-400">Líquido</p>
            <p className={`text-lg font-semibold ${fluxoCentroCusto.resumo.liquido >= 0 ? "text-green-300" : "text-red-300"}`}>
              {formatCurrencyBR(fluxoCentroCusto.resumo.liquido)}
            </p>
          </div>
        </div>
        {lancCustom.length > 0 && (
          <div className="mt-4 rounded-xl border border-white/5 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-white">Lançamentos adicionados (mock local)</p>
              <button
                type="button"
                onClick={handleResetLancCustom}
                className="text-xs px-3 py-1 rounded-lg bg-white/10 border border-white/10 text-white hover:bg-white/20 transition"
              >
                Limpar todos
              </button>
            </div>
            <div className="divide-y divide-white/5">
              {lancCustom.map((l) => (
                <div key={l.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-white font-semibold">
                      {l.tipo.toUpperCase()} - {formatCurrencyBR(l.valor)}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {l.descricao || "Lançamento manual"} | {l.centroCusto} | {l.data?.slice(0, 10) || l.criadoEm?.slice(0, 10)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveLancCustom(l.id)}
                    className="text-red-300 hover:text-red-200 flex items-center gap-1 text-xs"
                  >
                    <XCircle className="w-4 h-4" /> Remover
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-white/10">
                <th className="py-2 pr-4">Data</th>
                <th className="py-2 pr-4">Entradas</th>
                <th className="py-2 pr-4">Saídas</th>
                <th className="py-2 pr-4">Cartões</th>
                <th className="py-2 pr-4">Lançamentos</th>
                <th className="py-2 pr-4">Líquido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {fluxoCentroCusto.rows.map((r) => (
                <tr key={r.data}>
                  <td className="py-2 pr-4 text-white">{r.data}</td>
                  <td className="py-2 pr-4 text-gray-200">{formatCurrencyBR(r.entrada)}</td>
                  <td className="py-2 pr-4 text-gray-200">{formatCurrencyBR(r.saida)}</td>
                  <td className="py-2 pr-4 text-gray-200">{formatCurrencyBR(r.cartao)}</td>
                  <td className="py-2 pr-4 text-gray-200">{formatCurrencyBR(r.lancamento)}</td>
                  <td className={`py-2 pr-4 font-semibold ${r.liquido >= 0 ? "text-green-300" : "text-red-300"}`}>
                    {formatCurrencyBR(r.liquido)}
                  </td>
                </tr>
              ))}
              {fluxoCentroCusto.rows.length === 0 && (
                <tr>
                  <td className="py-3 pr-4 text-gray-400" colSpan={6}>
                    Nenhum lançamento no período filtrado (seed)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/5 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-white">Resumo por centro de custo (lançamentos)</p>
              <span className="text-xs text-gray-400">{centrosLanc.length} centros</span>
            </div>
            <div className="divide-y divide-white/5">
              {centrosLanc.map((c) => (
                <div key={c.centro} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-white font-semibold">{c.centro}</p>
                    <p className="text-[11px] text-gray-400">
                      Líquido {formatCurrencyBR(c.liquido)} ({c.perc.toFixed(1)}%)
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-300">
                    <p>Ent {formatCurrencyBR(c.entrada)}</p>
                    <p>Saída {formatCurrencyBR(c.saida)}</p>
                    <p>Cartão {formatCurrencyBR(c.cartao)}</p>
                  </div>
                </div>
              ))}
              {centrosLanc.length === 0 && (
                <p className="text-sm text-gray-400 py-2">Nenhum centro de custo encontrado</p>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/5 p-4">
            <p className="text-sm font-semibold text-white mb-1">Próximo passo</p>
            <p className="text-xs text-gray-400">
              Este bloco usa seed + filtros para validar o modelo. Na próxima fase, ligamos lançamentos reais
              por usuário/gerente e salvamos em backend para histórico.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/5 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-white">Distribuição por gerente (lançamentos)</p>
              <span className="text-xs text-gray-400">{lancPorGerente.length} gerentes</span>
            </div>
            <div className="divide-y divide-white/5">
              {lancPorGerente.map((g) => (
                <div key={g.gerente} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-white font-semibold">{g.gerente}</p>
                    <p className="text-[11px] text-gray-400">
                      Líquido {formatCurrencyBR(g.liquido)} ({g.perc.toFixed(1)}%)
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-300">
                    <p>Ent {formatCurrencyBR(g.entrada)}</p>
                    <p>Saída {formatCurrencyBR(g.saida)}</p>
                    <p>Cartão {formatCurrencyBR(g.cartao)}</p>
                  </div>
                </div>
              ))}
              {lancPorGerente.length === 0 && (
                <p className="text-sm text-gray-400 py-2">Nenhum lançamento para gerentes</p>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/5 p-4">
            <p className="text-sm font-semibold text-white mb-1">Nota</p>
            <p className="text-xs text-gray-400">
              Mapeamento considera usuário para gerente pelo seed atual. Quando conectarmos backend, vamos usar
              os vínculos reais de usuários e histórico de períodos.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
