import { ERP_FALLBACK } from "./mockData";

// Agrega dados do ERP (real ou mock) para o dashboard.
// Mantém a mesma forma de saída usada no App: { source, cambistas, totals, ranking, inativos, periodo }
export const buildErpSnapshot = ({ processedData, parseNumber }) => {
  const toNum =
    parseNumber ||
    ((value) => {
      if (value === null || value === undefined) return 0;
      const normalized = String(value)
        .replace(/\s+/g, "")
        .replace(/\./g, "")
        .replace(/,/, ".")
        .replace(/-\s+/, "-")
        .replace(/[^\d.-]/g, "");
      const parsed = parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    });

  const source = processedData && processedData.length ? processedData : ERP_FALLBACK;

  const cambistas = source.flatMap((g) =>
    (g?.cambistas || []).map((c) => ({
      ...c,
      gerente: g?.nome || "",
      entradasN: toNum(c?.entradas),
      liquidoN: toNum(c?.liquido),
      apostasN: Number(c?.nApostas || 0),
      saidasN: toNum(c?.saidas),
      cartoesN: toNum(c?.cartoes),
      comissaoN: toNum(c?.comissao),
      lancamentosN: toNum(c?.lancamentos),
    }))
  );

  const totals = cambistas.reduce(
    (acc, c) => {
      acc.apostas += c.apostasN;
      acc.entradas += c.entradasN;
      acc.liquido += c.liquidoN;
      acc.saidas += c.saidasN;
      acc.cartoes += c.cartoesN;
      acc.comissoes += c.comissaoN;
      acc.lancamentos += c.lancamentosN;
      return acc;
    },
    {
      apostas: 0,
      entradas: 0,
      liquido: 0,
      saidas: 0,
      cartoes: 0,
      comissoes: 0,
      lancamentos: 0,
    }
  );

  totals.custos = totals.saidas + totals.cartoes + totals.comissoes;
  totals.margem = totals.entradas ? (totals.liquido / totals.entradas) * 100 : 0;
  totals.ticket = totals.apostas ? totals.entradas / totals.apostas : 0;

  const ranking = [...cambistas]
    .sort((a, b) => b.liquidoN - a.liquidoN)
    .slice(0, 5);

  const inativos = cambistas
    .filter((c) => c.apostasN < 20 || c.liquidoN <= 0)
    .slice(0, 4);

  const periodo =
    source[0]?.periodo ||
    (processedData && processedData.length ? "Período importado" : "Semana atual");

  return { source, cambistas, totals, ranking, inativos, periodo };
};
