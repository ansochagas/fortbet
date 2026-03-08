// Seeds iniciais para futuros modulos de cadastro/financeiro.
// Base mock, sem conexao com backend ou persistencia.

export const seedUsuarios = [
  { id: "u-admin", nome: "Admin", papel: "admin", status: "ativo" },
  { id: "u-fin", nome: "Financeiro", papel: "financeiro", status: "ativo" },
  { id: "g-norte", nome: "Gerente Norte", papel: "gerente", status: "ativo" },
  { id: "g-sul", nome: "Gerente Sul", papel: "gerente", status: "ativo" },
  { id: "c-a", nome: "Cambista A", papel: "cambista", status: "ativo", gerenteId: "g-norte" },
  { id: "c-b", nome: "Cambista B", papel: "cambista", status: "ativo", gerenteId: "g-norte" },
  { id: "c-c", nome: "Cambista C", papel: "cambista", status: "ativo", gerenteId: "g-sul" },
  { id: "c-d", nome: "Cambista D", papel: "cambista", status: "ativo", gerenteId: "g-sul" },
];

export const seedPeriodos = [
  {
    id: "p-semana-45",
    nome: "Semana 45",
    dataInicio: "2025-11-03",
    dataFim: "2025-11-09",
    status: "fechado",
  },
];

export const seedLancamentos = [
  {
    id: "l1",
    usuarioId: "c-a",
    periodoId: "p-semana-45",
    tipo: "entrada",
    valor: 12000,
    descricao: "Entradas Semana 45",
    centroCusto: "Operacional",
    criadoEm: "2025-11-09T18:00:00Z",
  },
  {
    id: "l2",
    usuarioId: "c-a",
    periodoId: "p-semana-45",
    tipo: "saida",
    valor: 4000,
    descricao: "Saidas Semana 45",
    centroCusto: "Operacional",
    criadoEm: "2025-11-09T18:01:00Z",
  },
  {
    id: "l3",
    usuarioId: "c-a",
    periodoId: "p-semana-45",
    tipo: "lancamento",
    valor: 500,
    descricao: "Lancamentos",
    centroCusto: "Marketing",
    criadoEm: "2025-11-09T18:02:00Z",
  },
  {
    id: "l4",
    usuarioId: "c-a",
    periodoId: "p-semana-45",
    tipo: "cartao",
    valor: 800,
    descricao: "Cartoes",
    centroCusto: "Financeiro",
    criadoEm: "2025-11-09T18:03:00Z",
  },
];

export const seedDespesas = [
  {
    id: "d1",
    categoria: "Operacional",
    centroCusto: "Infra",
    valor: 1200,
    competencia: "2025-11",
    recorrente: true,
  },
];
