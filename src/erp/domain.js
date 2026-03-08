// Definições de domínio para o ERP (usadas como referência e tipagem leve em JS).

export const ROLES = {
  ADMIN: "admin",
  FINANCEIRO: "financeiro",
  GERENTE: "gerente",
  CAMBISTA: "cambista",
};

export const USER_STATUS = {
  ATIVO: "ativo",
  INATIVO: "inativo",
  BLOQUEADO: "bloqueado",
};

export const PERIODO_STATUS = {
  ABERTO: "aberto",
  FECHADO: "fechado",
  REABERTO: "reaberto",
  AGUARDANDO: "aguardando",
};

export const LANCAMENTO_TIPO = {
  ENTRADA: "entrada",
  SAIDA: "saida",
  CARTAO: "cartao",
  LANCAMENTO: "lancamento",
  COMISSAO: "comissao",
  AJUSTE: "ajuste",
};

/**
 * @typedef {Object} Usuario
 * @property {string} id
 * @property {string} nome
 * @property {keyof typeof ROLES} papel
 * @property {keyof typeof USER_STATUS} status
 * @property {string=} gerenteId
 */

/**
 * @typedef {Object} Periodo
 * @property {string} id
 * @property {string} nome
 * @property {string} dataInicio // ISO
 * @property {string} dataFim // ISO
 * @property {keyof typeof PERIODO_STATUS} status
 */

/**
 * @typedef {Object} Lancamento
 * @property {string} id
 * @property {string} usuarioId
 * @property {string} periodoId
 * @property {keyof typeof LANCAMENTO_TIPO} tipo
 * @property {number} valor
 * @property {string} descricao
 * @property {string} criadoEm // ISO
 * @property {string=} aprovadoPor // Usuario.id
 * @property {string=} referencia // ex: comprovante, anexo
 */

/**
 * @typedef {Object} Despesa
 * @property {string} id
 * @property {string} categoria
 * @property {string} centroCusto
 * @property {number} valor
 * @property {string} competencia // yyyy-MM
 * @property {boolean} recorrente
 */
