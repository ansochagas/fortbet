// Perfis fixos em código: substituíveis por import/export na UI
// Chaves aceitas:
// - "tipo|arquivo|LxA" (exato)
// - "tipo|arquivo" (fallback por nome)

export const BUILTIN_PROFILES = {
  // Cambista — fallback por nome (ajuste conforme sua arte)
  "cambista|arte_fortbet.png": {
    colaborador: [0.70, 0.12],
    data: [0.42, 0.23],
    entradas: [0.18, 0.33],
    comissoes: [0.73, 0.33],
    em_aberto: [0.18, 0.46],
    qtd_apostas: [0.73, 0.46],
    saidas: [0.18, 0.59],
    saldo_final: [0.73, 0.59],
    lancamentos: [0.18, 0.72],
    saldo_enviar: [0.73, 0.80],
  },

  // Gerente — fallback por nome (ajuste conforme sua arte)
  "gerente|arte_gerente.png": {
    gerente_nome: [0.60, 0.15],
    data: [0.40, 0.26],
    total_cambistas: [0.25, 0.55],
    comissao: [0.75, 0.55],
    total_liquido: [0.50, 0.78],
  },
};

