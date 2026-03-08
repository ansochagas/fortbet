// Dados de fallback para o ERP enquanto o backend/ingestão real não está ligado.
// Mantém o formato esperado pelo dashboard atual: [ { nome, periodo, comissao, cambistas: [...] } ]
export const ERP_FALLBACK = [
  {
    nome: "Gerente Norte",
    periodo: "Semana 45",
    comissao: "5,00",
    cambistas: [
      {
        nome: "Cambista A",
        nApostas: "120",
        entradas: "12.000,00",
        saidas: "4.000,00",
        lancamentos: "500,00",
        cartoes: "800,00",
        comissao: "600,00",
        parcial: "7.400,00",
        liquido: "6.800,00",
      },
      {
        nome: "Cambista B",
        nApostas: "95",
        entradas: "9.300,00",
        saidas: "3.100,00",
        lancamentos: "300,00",
        cartoes: "700,00",
        comissao: "465,00",
        parcial: "5.735,00",
        liquido: "5.335,00",
      },
    ],
  },
  {
    nome: "Gerente Sul",
    periodo: "Semana 45",
    comissao: "6,00",
    cambistas: [
      {
        nome: "Cambista C",
        nApostas: "80",
        entradas: "7.800,00",
        saidas: "2.900,00",
        lancamentos: "200,00",
        cartoes: "500,00",
        comissao: "390,00",
        parcial: "4.510,00",
        liquido: "4.210,00",
      },
      {
        nome: "Cambista D",
        nApostas: "40",
        entradas: "3.400,00",
        saidas: "1.100,00",
        lancamentos: "120,00",
        cartoes: "200,00",
        comissao: "170,00",
        parcial: "1.930,00",
        liquido: "1.850,00",
      },
    ],
  },
];
