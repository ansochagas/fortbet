import { seedUsuarios, seedPeriodos, seedLancamentos, seedDespesas } from "./seed";

// Estado em memória para o ERP. Ainda não persiste nada, apenas expõe getters
// e utilitários para compor a próxima fase (cadastros, filtros, etc.).
const state = {
  usuarios: [...seedUsuarios],
  periodos: [...seedPeriodos],
  lancamentos: [...seedLancamentos],
  despesas: [...seedDespesas],
};

export const getErpState = () => state;

export const getUsuariosPorPapel = (papel) =>
  state.usuarios.filter((u) => u.papel === papel);

export const getPeriodoById = (id) => state.periodos.find((p) => p.id === id);

export const getLancamentosByPeriodo = (periodoId) =>
  state.lancamentos.filter((l) => l.periodoId === periodoId);

export const getDespesasPorCompetencia = (competencia) =>
  state.despesas.filter((d) => d.competencia === competencia);

export const resetToSeed = () => {
  state.usuarios = [...seedUsuarios];
  state.periodos = [...seedPeriodos];
  state.lancamentos = [...seedLancamentos];
  state.despesas = [...seedDespesas];
  return state;
};

// Conveniência para futura hierarquia (gerente -> cambistas)
export const getHierarquia = () => {
  const gerentes = state.usuarios.filter((u) => u.papel === "gerente");
  const cambistas = state.usuarios.filter((u) => u.papel === "cambista");
  return gerentes.map((g) => ({
    ...g,
    cambistas: cambistas.filter((c) => c.gerenteId === g.id),
  }));
};
