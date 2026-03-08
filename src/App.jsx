import React, { useMemo, useState, useRef } from "react";
import {
  Upload,
  Download,
  FileText,
  CheckCircle,
  Loader,
  BarChart3,
  AlertTriangle,
  Users,
  Activity,
  ArrowRightCircle,
  XCircle,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import JSZip from "jszip";
import { useEffect } from "react";
import arteColaboradorSrc from "./assets/arte_colaborador.png";
import arteGerenteSrc from "./assets/arte_gerente_red.png";
import { buildErpSnapshot } from "./erp/dataSource";
import { getErpState, getHierarquia } from "./erp/store";
import { getCurrentUser, signInAs, signOut } from "./erp/auth";
import { saveSnapshotLocal, loadSnapshotLocal, clearSnapshotLocal, saveSnapshot, loadSnapshot } from "./erp/api";
import { StatCard } from "./erp/ui/Cards";
import { HierarchyList, InativosList } from "./erp/ui/Lists";
import { AuditoriaPanel } from "./erp/ui/AuditoriaPanel";
import { LancamentosPanel } from "./erp/ui/LancamentosPanel";

const PanelShell = ({ id, title, subtitle, actions, children, className = "" }) => (
  <div
    id={id}
    className={`bg-gray-900/80 border border-gray-800 rounded-2xl p-6 shadow-xl ${className}`}
  >
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-lg font-bold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
      {actions}
    </div>
    {children}
  </div>
);

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

const isDebugLoggingEnabled = () => {
  if (import.meta?.env?.VITE_ENABLE_DEBUG === "1") {
    return true;
  }
  if (typeof window !== "undefined") {
    try {
      return localStorage.getItem("fortbet_debug_logs") === "1";
    } catch {
      return false;
    }
  }
  return false;
};

const DEBUG_LOGS = isDebugLoggingEnabled();
console.log("[DEBUG FLAG]", DEBUG_LOGS, {
  arteColaboradorSrc,
  arteGerenteSrc,
});

const App = () => {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [erpUploadProcessing, setErpUploadProcessing] = useState(false);
  const [erpUploadStatus, setErpUploadStatus] = useState("");
  const [activeBandeira, setActiveBandeira] = useState("brasil");
  const [viewScope, setViewScope] = useState(() => {
    if (typeof window === "undefined") return "brasil";
    try {
      const savedScope = localStorage.getItem("fortbet_view_scope");
      if (["brasil", "tradicional", "consolidado"].includes(savedScope)) {
        return savedScope;
      }
    } catch {
      /* ignore */
    }
    return "brasil";
  }); // brasil | tradicional | consolidado
  const [datasets, setDatasets] = useState(() => {
    if (typeof window === "undefined") return { brasil: [], tradicional: [] };
    try {
      const saved = localStorage.getItem("fortbet_datasets_v2");
      if (saved) return JSON.parse(saved);
      const legacy = localStorage.getItem("fortbet_processedData");
      return { brasil: legacy ? JSON.parse(legacy) : [], tradicional: [] };
    } catch (err) {
      console.warn("[FORTBET] Nao foi possivel carregar dados salvos", err);
      return { brasil: [], tradicional: [] };
    }
  });
  const processedData = datasets[activeBandeira] || [];
  const processedDataView = useMemo(() => {
    if (viewScope === "consolidado") {
      return [...(datasets.brasil || []), ...(datasets.tradicional || [])];
    }
    return datasets[viewScope] || [];
  }, [datasets, viewScope]);
  const setProcessedDataActive = (data) =>
    setDatasets((prev) => ({ ...prev, [activeBandeira]: data || [] }));
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const erpFileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const isErpRoute =
    typeof window !== "undefined" && window.location.pathname.startsWith("/erp");
  const activeView = isErpRoute ? "erp" : "extrator";
  const [activeSection, setActiveSection] = useState("overview");

  const handleSectionSelect = (key) => {
    setActiveSection(key);
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        const el = document.getElementById(`${key}-section`);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };
  const navButtonClass = (key) =>
    `text-sm font-semibold w-full rounded-lg px-4 py-3 text-left transition border ${
      activeSection === key
        ? "bg-white/20 border-white/30 text-white ring-1 ring-white/30"
        : "bg-white/10 border-white/10 text-gray-100 hover:bg-white/15"
    }`;

  const parseNumberBR = (value) => {
    if (value === null || value === undefined) return 0;
    const normalized = String(value)
      .replace(/\s+/g, "")
      .replace(/\./g, "")
      .replace(/,/, ".")
      .replace(/-\s+/, "-")
      .replace(/[^\d.-]/g, "");
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const formatCurrencyBR = (value) =>
    Number(value || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    });
  const formatNumberBR = (value) =>
    Number(value || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

  const erpStore = useMemo(() => getErpState(), []);
  const hierarquia = useMemo(() => getHierarquia(), []);
  const snapshotTarget =
    typeof window !== "undefined" && import.meta?.env?.VITE_SNAPSHOT_URL ? "backend" : "local";
  const hasBackend = snapshotTarget === "backend";
  const erpMeta = useMemo(() => {
    const store = getErpState();
    const hier = getHierarquia();
    const totalUsuarios = store.usuarios.length;
    const totalGerentes = hier.length;
    const totalCambistas = hier.reduce((sum, g) => sum + (g.cambistas?.length || 0), 0);
    const periodoAtual = store.periodos[0] || null;
    const despesasMes = store.despesas.reduce((sum, d) => sum + (d?.valor || 0), 0);
    return {
      totalUsuarios,
      totalGerentes,
      totalCambistas,
      periodo: periodoAtual,
      despesasMes,
    };
  }, []);

  const openErpInNewTab = () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/erp`;
    window.open(url, "_blank", "noopener,noreferrer");
  };
  const goToExtrator = () => {
    if (typeof window === "undefined") return;
    window.location.href = `${window.location.origin}/`;
  };

  const [currentUser, setCurrentUser] = useState(
    () => getCurrentUser() || { nome: "Convidado", papel: "visitante" }
  );
  const roleOptions = useMemo(
    () =>
      Array.from(new Set((getErpState()?.usuarios || []).map((u) => u.papel))).filter(Boolean),
    []
  );
  const handleRoleChange = (papel) => {
    const next = signInAs(papel) || currentUser;
    setCurrentUser(next);
  };
  const handleSignOut = () => {
    signOut();
    setCurrentUser({ nome: "Convidado", papel: "visitante" });
  };

  const erpData = useMemo(
    () =>
      buildErpSnapshot({
        processedData: processedDataView,
        parseNumber: parseNumberBR,
      }),
    [processedDataView]
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("fortbet_datasets_v2", JSON.stringify(datasets));
      localStorage.setItem("fortbet_view_scope", viewScope);
      // limpeza de legacy se ainda existir
      localStorage.removeItem("fortbet_processedData");
    } catch (err) {
      console.warn("[FORTBET] Nao foi possivel persistir dados locais", err);
    }
  }, [datasets, viewScope]);
  const baseSource = useMemo(() => erpData?.source || [], [erpData]);
  const [filtroGerente, setFiltroGerente] = useState("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState("todos");
  const [filtroCompetencia, setFiltroCompetencia] = useState("todas");
  const lancamentosSeed = erpStore?.lancamentos || [];
  const despesasSeed = erpStore?.despesas || [];
  const seedDespIds = useMemo(
    () => new Set((despesasSeed || []).map((d) => d.id)),
    [despesasSeed]
  );
  const SNAPSHOT_KEY = "fortbet_snapshot_auto";
  const SNAPSHOT_BACKEND = "fortbet_snapshot_backend_mock";
  const [rangeIni, setRangeIni] = useState("");
  const [rangeFim, setRangeFim] = useState("");
  const [auditLog, setAuditLog] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("fortbet_audit_log");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [syncStatus, setSyncStatus] = useState("");
  const [filterAlerts, setFilterAlerts] = useState(() => {
    if (typeof window === "undefined") {
      return { entradasMin: "", liquidoMin: "", semApostasDias: "" };
    }
    try {
      const saved = localStorage.getItem("fortbet_filter_alerts");
      return saved
        ? JSON.parse(saved)
        : { entradasMin: "", liquidoMin: "", semApostasDias: "" };
    } catch {
      return { entradasMin: "", liquidoMin: "", semApostasDias: "" };
    }
  });
  const [lastAutoSave, setLastAutoSave] = useState(() => {
    if (typeof window === "undefined") return "";
    return loadSnapshotLocal(SNAPSHOT_KEY)?._ts || "";
  });
  const alertThresholds = useMemo(() => ({
    entradasMin: Number(filterAlerts.entradasMin || 0),
    liquidoMin: Number(filterAlerts.liquidoMin || 0),
    apostasMin: Number(filterAlerts.semApostasDias || 0),
  }), [filterAlerts]);
  const [lancCustom, setLancCustom] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("fortbet_lanc_custom");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const defaultNovoLanc = () => ({
    tipo: "entrada",
    valor: "",
    descricao: "",
    centroCusto: "Operacional",
    data: new Date().toISOString().slice(0, 10),
    usuarioId: (erpStore?.usuarios && erpStore.usuarios[0]?.id) || "",
    periodoId: (erpStore?.periodos && erpStore.periodos[0]?.id) || "",
  });
  const [novoLanc, setNovoLanc] = useState(() => defaultNovoLanc());
  const defaultNovaDespesa = () => ({
    categoria: "",
    centroCusto: "",
    valor: "",
    competencia:
      filtroCompetencia !== "todas"
        ? filtroCompetencia
        : (erpMeta?.periodo?.dataInicio || "").slice(0, 7) || "",
    recorrente: false,
  });
  const [customDespesas, setCustomDespesas] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("fortbet_custom_despesas");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [novaDespesa, setNovaDespesa] = useState(() => defaultNovaDespesa());
  const [editDespesa, setEditDespesa] = useState(null);
  const canManageFinance = useMemo(
    () => ["admin", "financeiro"].includes(currentUser?.papel),
    [currentUser]
  );
  const exportFinance = useMemo(
    () => canManageFinance || currentUser?.papel === "gerente",
    [canManageFinance, currentUser]
  );
  const importSnapshotInputRef = useRef(null);
  const userIndex = useMemo(() => {
    const map = {};
    (erpStore?.usuarios || []).forEach((u) => {
      map[u.id] = u;
    });
    return map;
  }, [erpStore]);

  const gerenteOptionsErp = useMemo(
    () => ["todos", ...Array.from(new Set(baseSource.map((g) => g?.nome).filter(Boolean)))],
    [baseSource]
  );
  const periodoOptionsErp = useMemo(
    () =>
      ["todos", ...Array.from(new Set(baseSource.map((g) => (g?.periodo || "").trim()).filter(Boolean)))],
    [baseSource]
  );

  const filteredSource = useMemo(() => {
    let src = baseSource;
    if (filtroGerente !== "todos") {
      src = src.filter((g) => (g?.nome || "").trim() === filtroGerente);
    }
    if (filtroPeriodo !== "todos") {
      src = src.filter((g) => (g?.periodo || "").trim() === filtroPeriodo);
    }
    return src;
  }, [baseSource, filtroGerente, filtroPeriodo]);
  const competenciaOptions = useMemo(() => {
    const opts = Array.from(new Set((erpStore?.despesas || []).map((d) => d.competencia).filter(Boolean)));
    opts.sort();
    return ["todas", ...opts];
  }, [erpStore]);

  const lancamentosBase = useMemo(
    () => [...lancamentosSeed, ...lancCustom],
    [lancamentosSeed, lancCustom]
  );

  useEffect(() => {
    if (rangeIni && rangeFim) return;
    const dates = (lancamentosBase || [])
      .map((l) => {
        const d = new Date(l?.criadoEm);
        return Number.isFinite(d.getTime()) ? d : null;
      })
      .filter(Boolean);
    if (!dates.length) return;
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    const toInput = (d) => d.toISOString().slice(0, 10);
    setRangeIni((prev) => prev || toInput(min));
    setRangeFim((prev) => prev || toInput(max));
  }, [lancamentosBase, rangeIni, rangeFim]);

  const buildViewFromSource = (sourceList) => {
    const source = Array.isArray(sourceList) ? sourceList : [];
    const cambistas = source.flatMap((g) =>
      (g?.cambistas || []).map((c) => ({
        ...c,
        gerente: g?.nome || "",
        entradasN: parseNumberBR(c?.entradas),
        liquidoN: parseNumberBR(c?.liquido),
        apostasN: Number(c?.nApostas || 0),
        saidasN: parseNumberBR(c?.saidas),
        cartoesN: parseNumberBR(c?.cartoes),
        comissaoN: parseNumberBR(c?.comissao),
        lancamentosN: parseNumberBR(c?.lancamentos),
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

    const ranking = [...cambistas].sort((a, b) => b.liquidoN - a.liquidoN).slice(0, 5);
    const inativos = cambistas.filter((c) => c.apostasN < 20 || c.liquidoN <= 0).slice(0, 4);
    const periodo = source[0]?.periodo || "";

    return { source, cambistas, totals, ranking, inativos, periodo };
  };

  const erpView = useMemo(() => {
    const view = buildViewFromSource(filteredSource);
    if (viewScope === "consolidado") {
      view.periodo = "Consolidado (Brasil + Tradicional)";
    } else if (!view.periodo) {
      view.periodo = viewScope === "brasil" ? "Brasil" : "Tradicional";
    }
    return view;
  }, [filteredSource, viewScope]);
  const filteredAlerts = useMemo(() => {
    const today = new Date();
    return (erpView?.cambistas || []).filter((c) => {
      const base = c.entradasN < alertThresholds.entradasMin ||
        c.liquidoN < alertThresholds.liquidoMin ||
        c.apostasN <= alertThresholds.apostasMin;
      // Se a data de periodo existir, calcula dias desde o fim do periodo
      let periodoAlert = false;
      if (c?.periodo) {
        const parts = String(c.periodo).match(/(\d{2})\/(\d{2})\/(\d{4})$/);
        if (parts) {
          const [_, dd, mm, yyyy] = parts;
          const endDate = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
          const diffMs = today - endDate;
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (diffDays > 7) {
            periodoAlert = true;
          }
        }
      }
      return base || periodoAlert;
    });
  }, [erpView, alertThresholds]);

  const despesasBase = useMemo(() => [...despesasSeed, ...customDespesas], [despesasSeed, customDespesas]);
  const despesasAplicadas = useMemo(() => {
    if (filtroCompetencia === "todas") return despesasBase;
    return despesasBase.filter((d) => (d?.competencia || "") === filtroCompetencia);
  }, [despesasBase, filtroCompetencia]);
  const totalDespesasAplicadas = useMemo(
    () => despesasAplicadas.reduce((sum, d) => sum + (d?.valor || 0), 0),
    [despesasAplicadas]
  );
  const resultadoFinanceiro = useMemo(
    () => erpView.totals.liquido - totalDespesasAplicadas,
    [erpView, totalDespesasAplicadas]
  );
  const margemFinal = useMemo(
    () =>
      erpView.totals.entradas
        ? (resultadoFinanceiro / erpView.totals.entradas) * 100
        : 0,
    [erpView, resultadoFinanceiro]
  );
  const fluxoDiario = useMemo(() => {
    const dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
    if (!erpView?.totals || dias.length === 0) return [];
    const baseEntrada = erpView.totals.entradas / dias.length;
    const baseCustos = erpView.totals.custos / dias.length;
    const baseDesp = totalDespesasAplicadas / dias.length;
    return dias.map((dia, idx) => {
      const entrada = Math.max(0, baseEntrada * (0.9 + (idx % 3) * 0.05));
      const custos = Math.max(0, baseCustos * (0.9 + ((idx + 1) % 3) * 0.04));
      const despesas = Math.max(0, baseDesp);
      const liquido = entrada - custos - despesas;
      return { dia, entrada, custos, despesas, liquido };
    });
  }, [erpView, totalDespesasAplicadas]);

  const centroCustoResumo = useMemo(() => {
    const map = {};
    despesasAplicadas.forEach((d) => {
      const key = d.centroCusto || "Outros";
      if (!map[key]) map[key] = 0;
      map[key] += d?.valor || 0;
    });
    return Object.entries(map).map(([centro, valor]) => ({
      centro,
      valor,
      perc: totalDespesasAplicadas ? (valor / totalDespesasAplicadas) * 100 : 0,
    }));
  }, [despesasAplicadas, totalDespesasAplicadas]);

  const buildPanorama = (bandeiraKey) => {
    const dataset = datasets[bandeiraKey] || [];
    const source = Array.isArray(dataset) ? dataset : [];
    const cambistas = source.flatMap((g) => g?.cambistas || []);
    const entradas = cambistas.reduce((sum, c) => sum + parseNumberBR(c?.entradas), 0);
    const saidas = cambistas.reduce((sum, c) => sum + parseNumberBR(c?.saidas), 0);
    const cartoes = cambistas.reduce((sum, c) => sum + parseNumberBR(c?.cartoes), 0);
    const comissoesCambista = cambistas.reduce((sum, c) => sum + parseNumberBR(c?.comissao), 0);
    const lancamentos = cambistas.reduce((sum, c) => sum + parseNumberBR(c?.lancamentos), 0);
    const liquidoSemLanc = entradas - (saidas + cartoes + comissoesCambista);
    const brutoComLanc = liquidoSemLanc + lancamentos;
    const gerentes = source.length;
    const qtdCambistas = cambistas.length;
    const qtdBilhetes = cambistas.reduce((sum, c) => sum + Number(c?.nApostas || 0), 0);

        // Despesas por categoria a partir das despesasAplicadas filtradas
    const categoriasBase = ["Folha", "Alugueis", "Parcelas", "Internet", "Sistemas", "Furos"];
    const normalizeCentro = (val) =>
      (val || "")
        .toString()
        .normalize("NFD")
        .replace(/[^\u0000-\u007E]/g, (ch) => ch)
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    const catLookup = {};
    categoriasBase.forEach((c) => {
      const norm = normalizeCentro(c);
      catLookup[norm] = c;
      if (c === "Alugueis") {
        catLookup["aluguel"] = c;
        catLookup["alugueis"] = c;
      }
    });

    const despPorCategoria = {};
    categoriasBase.forEach((c) => (despPorCategoria[c] = 0));

    let comGerentes = 0;
    let comSupervisao = 0;
    let pagamentosInternos = 0;

    despesasAplicadas.forEach((d) => {
      const valor = Number(d?.valor || 0);
      const normCentro = normalizeCentro(d?.centroCusto);
      const catKey =
        catLookup[normCentro] || (normCentro.includes("alug") ? "Alugueis" : null);
      if (catKey) {
        despPorCategoria[catKey] += valor;
      }
      if (normCentro.includes("comissao") && normCentro.includes("gerent")) {
        comGerentes += valor;
      } else if (normCentro.includes("comissao") && normCentro.includes("supervis")) {
        comSupervisao += valor;
      }
      if (normCentro.includes("pagamento") && normCentro.includes("intern")) {
        pagamentosInternos += valor;
      }
    });

        const bonusCambistas = Math.max(0, liquidoSemLanc * 0.1);
    const totalDespesasExtras =
      Object.values(despPorCategoria).reduce((a, b) => a + b, 0) + bonusCambistas;

    const lucros = {
      liquido: liquidoSemLanc,
      bruto: brutoComLanc,
    };

    const totalReceber = brutoComLanc + pagamentosInternos;
    const totalRecebido = 0;
    const pendente = totalReceber - totalRecebido;
    const lucroRealFinal = lucros.liquido - pendente;

    const margem = (valor) => (entradas ? (valor / entradas) * 100 : 0);

    return {
      key: bandeiraKey,
      entradas,
      saidas,
      cartoes,
      comissoesCambista,
      lancamentos,
      liquidoSemLanc,
      brutoComLanc,
      gerentes,
      qtdCambistas,
      qtdBilhetes,
      comGerentes,
      comSupervisao,
      bonusCambistas,
      despesasCategorias: despPorCategoria,
      despesasTotal: totalDespesasExtras,
      lucros,
      pagamentosInternos,
      totalReceber,
      totalRecebido,
      pendente,
      lucroRealFinal,
      margem,
    };
  };

  const panoramaBrasil = useMemo(() => buildPanorama("brasil"), [datasets, despesasAplicadas]);
  const panoramaTrad = useMemo(() => buildPanorama("tradicional"), [datasets, despesasAplicadas]);
  const panoramaConsolidado = useMemo(() => {
    const soma = (a, b) => a + b;
    const joinMaps = (a, b) => {
      const res = { ...a };
      Object.entries(b || {}).forEach(([k, v]) => {
        res[k] = (res[k] || 0) + v;
      });
      return res;
    };
    const totalEntradas = panoramaBrasil.entradas + panoramaTrad.entradas;
    const margemCons = (valor) => (totalEntradas ? (valor / totalEntradas) * 100 : 0);
    return {
      key: "consolidado",
      entradas: panoramaBrasil.entradas + panoramaTrad.entradas,
      saidas: panoramaBrasil.saidas + panoramaTrad.saidas,
      cartoes: panoramaBrasil.cartoes + panoramaTrad.cartoes,
      comissoesCambista: panoramaBrasil.comissoesCambista + panoramaTrad.comissoesCambista,
      lancamentos: panoramaBrasil.lancamentos + panoramaTrad.lancamentos,
      liquidoSemLanc: panoramaBrasil.liquidoSemLanc + panoramaTrad.liquidoSemLanc,
      brutoComLanc: panoramaBrasil.brutoComLanc + panoramaTrad.brutoComLanc,
      gerentes: panoramaBrasil.gerentes + panoramaTrad.gerentes,
      qtdCambistas: panoramaBrasil.qtdCambistas + panoramaTrad.qtdCambistas,
      qtdBilhetes: panoramaBrasil.qtdBilhetes + panoramaTrad.qtdBilhetes,
      comGerentes: panoramaBrasil.comGerentes + panoramaTrad.comGerentes,
      comSupervisao: panoramaBrasil.comSupervisao + panoramaTrad.comSupervisao,
      bonusCambistas: panoramaBrasil.bonusCambistas + panoramaTrad.bonusCambistas,
      despesasCategorias: joinMaps(panoramaBrasil.despesasCategorias, panoramaTrad.despesasCategorias),
      despesasTotal: panoramaBrasil.despesasTotal + panoramaTrad.despesasTotal,
      lucros: {
        liquido: panoramaBrasil.lucros.liquido + panoramaTrad.lucros.liquido,
        bruto: panoramaBrasil.lucros.bruto + panoramaTrad.lucros.bruto,
      },
      pagamentosInternos: panoramaBrasil.pagamentosInternos + panoramaTrad.pagamentosInternos,
      totalReceber: panoramaBrasil.totalReceber + panoramaTrad.totalReceber,
      totalRecebido: panoramaBrasil.totalRecebido + panoramaTrad.totalRecebido,
      pendente: panoramaBrasil.pendente + panoramaTrad.pendente,
      lucroRealFinal: panoramaBrasil.lucroRealFinal + panoramaTrad.lucroRealFinal,
      margem: margemCons,
    };
  }, [panoramaBrasil, panoramaTrad]);

  const filteredLancamentos = useMemo(() => {
    const normalizeDate = (val) => {
      const d = new Date(val);
      return Number.isFinite(d.getTime()) ? d : null;
    };
    const ini = normalizeDate(rangeIni);
    const fim = normalizeDate(rangeFim);
    return (lancamentosBase || []).filter((l) => {
      const d = normalizeDate(l?.criadoEm);
      if (!d) return false;
      if (ini && d < ini) return false;
      if (fim && d > fim) return false;
      return true;
    });
  }, [lancamentosBase, rangeIni, rangeFim]);

  const fluxoCentroCusto = useMemo(() => {
    const daily = {};
    filteredLancamentos.forEach((l) => {
      const d = new Date(l.criadoEm);
      const key = Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : "sem-data";
      if (!daily[key]) {
        daily[key] = { entrada: 0, saida: 0, cartao: 0, lancamento: 0 };
      }
      const val = Number(l.valor || 0);
      if (l.tipo === "entrada") daily[key].entrada += val;
      if (l.tipo === "saida") daily[key].saida += val;
      if (l.tipo === "cartao") daily[key].cartao += val;
      if (l.tipo === "lancamento") daily[key].lancamento += val;
    });
    const rows = Object.entries(daily)
      .map(([data, v]) => {
        const liquido = v.entrada + v.lancamento - v.saida - v.cartao;
        return { data, ...v, liquido };
      })
      .sort((a, b) => (a.data > b.data ? 1 : -1));
    const resumo = rows.reduce(
      (acc, r) => {
        acc.entrada += r.entrada;
        acc.saida += r.saida;
        acc.cartao += r.cartao;
        acc.lancamento += r.lancamento;
        acc.liquido += r.liquido;
        return acc;
      },
      { entrada: 0, saida: 0, cartao: 0, lancamento: 0, liquido: 0 }
    );
    return { rows, resumo };
  }, [filteredLancamentos]);

  const centrosLanc = useMemo(() => {
    const resumoTotal = fluxoCentroCusto?.resumo || { liquido: 0 };
    const map = {};
    filteredLancamentos.forEach((l) => {
      const c = l?.centroCusto || "Geral";
      if (!map[c]) {
        map[c] = { entrada: 0, saida: 0, cartao: 0, lancamento: 0 };
      }
      const val = Number(l?.valor || 0);
      if (l.tipo === "entrada") map[c].entrada += val;
      else if (l.tipo === "saida") map[c].saida += val;
      else if (l.tipo === "cartao") map[c].cartao += val;
      else if (l.tipo === "lancamento") map[c].lancamento += val;
    });
    return Object.entries(map).map(([centro, v]) => {
      const liquido = v.entrada + v.lancamento - v.saida - v.cartao;
      const perc = resumoTotal.liquido ? (liquido / resumoTotal.liquido) * 100 : 0;
      return { centro, ...v, liquido, perc };
    });
  }, [filteredLancamentos, fluxoCentroCusto]);

  const lancPorGerente = useMemo(() => {
    const resumoTotal = fluxoCentroCusto?.resumo || { liquido: 0 };
    const map = {};
    filteredLancamentos.forEach((l) => {
      const usuario = userIndex[l?.usuarioId];
      const gerente =
        usuario?.papel === "gerente"
          ? usuario?.nome
          : userIndex[usuario?.gerenteId]?.nome || "Sem gerente";
      if (!map[gerente]) {
        map[gerente] = { entrada: 0, saida: 0, cartao: 0, lancamento: 0 };
      }
      const val = Number(l?.valor || 0);
      if (l.tipo === "entrada") map[gerente].entrada += val;
      else if (l.tipo === "saida") map[gerente].saida += val;
      else if (l.tipo === "cartao") map[gerente].cartao += val;
      else if (l.tipo === "lancamento") map[gerente].lancamento += val;
    });
    return Object.entries(map).map(([gerente, v]) => {
      const liquido = v.entrada + v.lancamento - v.saida - v.cartao;
      const perc = resumoTotal.liquido ? (liquido / resumoTotal.liquido) * 100 : 0;
      return { gerente, ...v, liquido, perc };
    });
  }, [filteredLancamentos, userIndex, fluxoCentroCusto]);

  const handleNovoLancChange = (key, value) => {
    setNovoLanc((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleAddLancamento = () => {
    if (!canManageFinance) {
      alert("Apenas admin/financeiro podem adicionar lancamentos");
      return;
    }
    const valorNum = parseFloat(String(novoLanc.valor || "").replace(",", "."));
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      alert("Informe um valor valido para o lancamento");
      return;
    }
    const data = new Date(novoLanc.data || Date.now());
    const payload = {
      id: `custom-${Date.now()}`,
      usuarioId: novoLanc.usuarioId || (erpStore?.usuarios?.[0]?.id || ""),
      periodoId: novoLanc.periodoId || (erpStore?.periodos?.[0]?.id || ""),
      tipo: novoLanc.tipo || "entrada",
      valor: valorNum,
      descricao: novoLanc.descricao || "Lancamento manual",
      centroCusto: novoLanc.centroCusto || "Geral",
      criadoEm: Number.isFinite(data.getTime()) ? data.toISOString() : new Date().toISOString(),
    };
    setLancCustom((prev) => [...prev, payload]);
    setAuditLog((prev) => [
      { id: `log-${Date.now()}`, at: new Date().toISOString(), action: "add_lancamento", payload },
      ...prev.slice(0, 99),
    ]);
    setNovoLanc(defaultNovoLanc());
  };

  const handleResetLancCustom = () => {
    if (!canManageFinance) return;
    setLancCustom([]);
    setNovoLanc(defaultNovoLanc());
    setAuditLog((prev) => [
      { id: `log-${Date.now()}`, at: new Date().toISOString(), action: "reset_lancamentos" },
      ...prev.slice(0, 99),
    ]);
  };

  const handleRemoveLancCustom = (id) => {
    if (!canManageFinance) return;
    setLancCustom((prev) => prev.filter((l) => l.id !== id));
    setAuditLog((prev) => [
      { id: `log-${Date.now()}`, at: new Date().toISOString(), action: "remove_lancamento", ref: id },
      ...prev.slice(0, 99),
    ]);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("fortbet_lanc_custom", JSON.stringify(lancCustom));
    } catch {
      /* ignore */
    }
  }, [lancCustom]);

  const handleNovaDespesaChange = (key, value) => {
    setNovaDespesa((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleAddDespesa = () => {
    if (!canManageFinance) {
      alert("Apenas admin/financeiro podem adicionar despesas");
      return;
    }
    const valorNum = parseFloat(String(novaDespesa.valor || "").replace(",", "."));
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      alert("Informe um valor valido para a despesa");
      return;
    }
    const payload = {
      id: `desp-${Date.now()}`,
      categoria: novaDespesa.categoria || "Outro",
      centroCusto: novaDespesa.centroCusto || "Geral",
      valor: valorNum,
      competencia: novaDespesa.competencia || "2025-01",
      recorrente: Boolean(novaDespesa.recorrente),
    };
    setCustomDespesas((prev) => [...prev, payload]);
    setAuditLog((prev) => [
      { id: `log-${Date.now()}`, at: new Date().toISOString(), action: "add_despesa", payload },
      ...prev.slice(0, 99),
    ]);
    setNovaDespesa(defaultNovaDespesa());
  };

  const handleResetCustomDespesas = () => {
    if (!canManageFinance) return;
    setCustomDespesas([]);
    setNovaDespesa(defaultNovaDespesa());
    setAuditLog((prev) => [
      { id: `log-${Date.now()}`, at: new Date().toISOString(), action: "reset_despesas" },
      ...prev.slice(0, 99),
    ]);
  };

  const handleRemoveDespesa = (id) => {
    if (!canManageFinance) return;
    setCustomDespesas((prev) => prev.filter((d) => d.id !== id));
    if (editDespesa && editDespesa.id === id) {
      setEditDespesa(null);
    }
    setAuditLog((prev) => [
      { id: `log-${Date.now()}`, at: new Date().toISOString(), action: "remove_despesa", ref: id },
      ...prev.slice(0, 99),
    ]);
  };

  const handleStartEditDespesa = (desp) => {
    if (!canManageFinance) return;
    setEditDespesa({
      ...desp,
      valor: String(desp.valor || ""),
    });
  };

  const handleEditDespesaChange = (key, value) => {
    setEditDespesa((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSaveDespesa = () => {
    if (!canManageFinance) return;
    if (!editDespesa?.id) return;
    const valorNum = parseFloat(String(editDespesa.valor || "").replace(",", "."));
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      alert("Informe um valor valido para a despesa");
      return;
    }
    setCustomDespesas((prev) =>
      prev.map((d) =>
        d.id === editDespesa.id
          ? {
              ...d,
              categoria: editDespesa.categoria || d.categoria,
              centroCusto: editDespesa.centroCusto || d.centroCusto,
              valor: valorNum,
              competencia: editDespesa.competencia || d.competencia,
              recorrente: Boolean(editDespesa.recorrente),
            }
          : d
      )
    );
    setAuditLog((prev) => [
      { id: `log-${Date.now()}`, at: new Date().toISOString(), action: "edit_despesa", payload: { id: editDespesa.id, valor: valorNum } },
      ...prev.slice(0, 99),
    ]);
    setEditDespesa(null);
  };

  const handleCancelEditDespesa = () => {
    setEditDespesa(null);
  };

  const buildSnapshot = () => ({
    version: 3,
    datasets,
    activeBandeira,
    viewScope,
    processedData: processedData || [], // compat v1 (Brasil)
    lancCustom,
    customDespesas,
    filtros: {
      gerente: filtroGerente,
      periodo: filtroPeriodo,
      competencia: filtroCompetencia,
      rangeIni,
      rangeFim,
      alerts: filterAlerts,
    },
    auditLog,
    _ts: new Date().toISOString(),
  });

  const handleExportSnapshot = () => {
    if (!canManageFinance) {
      alert("Apenas admin/financeiro podem exportar dados locais");
      return;
    }
    const snapshot = buildSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fortbet_snapshot.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleResetLocalData = () => {
    if (!canManageFinance) return;
    if (typeof window !== "undefined") {
      const proceed = window.confirm("Limpar dados locais (PDF, lancamentos e despesas mock)?");
      if (!proceed) return;
    }
    try {
      localStorage.removeItem("fortbet_processedData");
      localStorage.removeItem("fortbet_lanc_custom");
      localStorage.removeItem("fortbet_custom_despesas");
      localStorage.removeItem("fortbet_audit_log");
      localStorage.removeItem("fortbet_filter_alerts");
      clearSnapshotLocal(SNAPSHOT_KEY);
    } catch {
      /* ignore */
    }
    setProcessedDataActive(null);
    setLancCustom([]);
    setCustomDespesas([]);
    setNovoLanc(defaultNovoLanc());
    setNovaDespesa(defaultNovaDespesa());
    setRangeIni("");
    setRangeFim("");
    setFilterAlerts({ entradasMin: "", liquidoMin: "", semApostasDias: "" });
    setLastAutoSave("");
    setViewScope("brasil");
    setAuditLog((prev) => [
      { id: `log-${Date.now()}`, at: new Date().toISOString(), action: "reset_all" },
      ...prev.slice(0, 99),
    ]);
  };

  const handleRestoreAutoSnapshot = () => {
    if (!canManageFinance) {
      alert("Apenas admin/financeiro podem restaurar snapshot");
      return;
    }
    loadSnapshotLocal(SNAPSHOT_KEY)
      .then((data) => {
        if (!data) {
          alert("Nenhum snapshot automatico encontrado");
          return;
        }
        applySnapshotData(data, "restore_auto_snapshot");
        alert("Snapshot automatico restaurado");
      })
      .catch((err) => {
        console.error("Erro ao restaurar snapshot auto", err);
        alert("Snapshot automatico invalido");
      });
  };

  const handleSyncMock = () => {
    if (!canManageFinance) {
      alert("Apenas admin/financeiro podem sincronizar");
      return;
    }
    const snapshot = buildSnapshot();
    saveSnapshot(snapshot)
      .then((res) => {
        setSyncStatus(`Sync OK ${res?.savedAt || ""}`);
        setAuditLog((prev) => [
          { id: `log-${Date.now()}`, at: new Date().toISOString(), action: "sync_backend_mock" },
          ...prev.slice(0, 99),
        ]);
      })
      .catch(() => {
        setSyncStatus("Sync falhou");
      });
  };

  const handleLoadFromMock = () => {
    if (!canManageFinance) {
      alert("Apenas admin/financeiro podem importar do backend mock");
      return;
    }
    loadSnapshot()
      .then((data) => {
        if (!data) {
          setSyncStatus("Nenhum snapshot no backend mock");
          return;
        }
        applySnapshotData(data, "restore_backend_mock");
        setSyncStatus(`Restaurado do backend mock em ${data?._ts || ""}`);
      })
      .catch((err) => {
        console.error("Erro ao ler backend mock", err);
        setSyncStatus("Falha ao ler backend mock");
      });
  };

  useEffect(() => {
    // Auto-restaura snapshot salvo se o app estiver vazio (sem dados em ambas as bandeiras e sem mocks)
    const hasData =
      (datasets?.brasil && datasets.brasil.length) ||
      (datasets?.tradicional && datasets.tradicional.length);
    if (hasData || (lancCustom && lancCustom.length) || (customDespesas && customDespesas.length)) {
      return;
    }
    loadSnapshotLocal(SNAPSHOT_KEY)
      .then((data) => {
        if (!data) return;
        applySnapshotData(data, "auto_bootstrap");
      })
      .catch((err) => console.warn("Snapshot auto nao carregado", err));
  }, []);

  useEffect(() => {
    // Se existir backend configurado, testa conexão sem alterar estado de dados
    if (snapshotTarget !== "backend") return;
    loadSnapshot()
      .then((data) => {
        if (data) {
          setSyncStatus(`Backend OK (${data?._ts || "sem timestamp"})`);
        }
      })
      .catch(() => {
        setSyncStatus("Backend indisponivel, usando local");
      });
  }, [snapshotTarget]);

  const handleImportSnapshot = () => {
    if (!canManageFinance) {
      alert("Apenas admin/financeiro podem importar snapshot");
      return;
    }
    importSnapshotInputRef.current?.click();
  };

  const applySnapshotData = (data, sourceAction = "import_snapshot") => {
    if (data && typeof data === "object") {
      if (data.version >= 2 && data.datasets) {
        setDatasets({
          brasil: Array.isArray(data.datasets.brasil) ? data.datasets.brasil : [],
          tradicional: Array.isArray(data.datasets.tradicional) ? data.datasets.tradicional : [],
        });
        if (data.activeBandeira) {
          setActiveBandeira(data.activeBandeira);
        }
        if (data.viewScope) {
          setViewScope(data.viewScope);
        } else if (data.activeBandeira) {
          setViewScope(data.activeBandeira);
        }
      } else if (Array.isArray(data.processedData)) {
        // fallback v1: trata como Brasil
        setDatasets({ brasil: data.processedData, tradicional: [] });
        setActiveBandeira("brasil");
        setViewScope("brasil");
      } else {
        // fallback generic: garante escopo valido
        setViewScope((prev) =>
          prev === "consolidado" || prev === "brasil" || prev === "tradicional" ? prev : "brasil"
        );
      }
    }
    if (Array.isArray(data.lancCustom)) {
      setLancCustom(data.lancCustom);
    }
    if (Array.isArray(data.customDespesas)) {
      setCustomDespesas(data.customDespesas);
    }
    const f = data.filtros || {};
    if (typeof f.gerente === "string") setFiltroGerente(f.gerente);
    if (typeof f.periodo === "string") setFiltroPeriodo(f.periodo);
    if (typeof f.competencia === "string") setFiltroCompetencia(f.competencia);
    if (typeof f.rangeIni === "string") setRangeIni(f.rangeIni);
    if (typeof f.rangeFim === "string") setRangeFim(f.rangeFim);
    if (f.alerts && typeof f.alerts === "object") {
      setFilterAlerts({
        entradasMin: f.alerts.entradasMin || "",
        liquidoMin: f.alerts.liquidoMin || "",
        semApostasDias: f.alerts.semApostasDias || "",
      });
    }
    if (Array.isArray(data.auditLog)) {
      setAuditLog(data.auditLog.slice(0, 100));
    }
    if (data?._ts) {
      setLastAutoSave(data._ts);
    }
    setAuditLog((prev) => [
      { id: `log-${Date.now()}`, at: new Date().toISOString(), action: sourceAction },
      ...prev.slice(0, 99),
    ]);
  };

  const handleExportAuditCSV = () => {
    if (!canManageFinance) {
      alert("Apenas admin/financeiro podem exportar auditoria");
      return;
    }
    const header = ["data", "acao"];
    const rows = auditLog.map((log) => [log.at || "", log.action || ""]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fortbet_audit.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  const handleSnapshotFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      applySnapshotData(data, "import_snapshot");
      alert("Snapshot importado com sucesso (dados locais atualizados)");
    } catch (err) {
      console.error("Erro ao importar snapshot", err);
      alert("Snapshot invalido");
    } finally {
      if (importSnapshotInputRef.current) {
        importSnapshotInputRef.current.value = "";
      }
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("fortbet_custom_despesas", JSON.stringify(customDespesas));
    } catch {
      /* ignore */
    }
  }, [customDespesas]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("fortbet_audit_log", JSON.stringify(auditLog.slice(0, 100)));
    } catch {
      /* ignore */
    }
  }, [auditLog]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("fortbet_filter_alerts", JSON.stringify(filterAlerts));
    } catch {
      /* ignore */
    }
  }, [filterAlerts]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const snapshot = buildSnapshot();
    saveSnapshotLocal(SNAPSHOT_KEY, snapshot);
    setLastAutoSave(snapshot._ts);
  }, [
    datasets,
    viewScope,
    lancCustom,
    customDespesas,
    filtroGerente,
    filtroPeriodo,
    filtroCompetencia,
    rangeIni,
    rangeFim,
    filterAlerts,
    auditLog,
  ]);

  const handleExportLancamentos = () => {
    if (!exportFinance) {
      alert("Apenas admin/financeiro/gerente podem exportar lançamentos");
      return;
    }
    const header = [
      "data",
      "tipo",
      "valor",
      "centroCusto",
      "usuario",
      "gerente",
      "descricao",
    ];
    const rows = filteredLancamentos.map((l) => {
      const usuario = userIndex[l?.usuarioId];
      const gerente =
        usuario?.papel === "gerente"
          ? usuario?.nome
          : userIndex[usuario?.gerenteId]?.nome || "Sem gerente";
      const data = l?.criadoEm || "";
      return [
        data?.slice(0, 10) || "",
        l?.tipo || "",
        Number(l?.valor || 0).toFixed(2).replace(".", ","),
        l?.centroCusto || "",
        usuario?.nome || "",
        gerente || "",
        l?.descricao || "",
      ];
    });
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lancamentos_filtrados.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const parsePDFText = (text) => parsePDFTextStable(text);
  const processPdfForBandeira = async (uploadedFile, targetBandeira = activeBandeira, origin = "erp") => {
    if (!uploadedFile || uploadedFile.type !== "application/pdf") {
      setErpUploadStatus("Selecione um arquivo PDF válido");
      return;
    }

    setErpUploadProcessing(true);
    setErpUploadStatus("Processando PDF...");

    try {
      const arrayBuffer = await uploadedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        text += textContent.items.map((item) => item.str).join(" ") + "\n";
      }

      if (DEBUG_LOGS) {
        console.log("[ERP UPLOAD] Texto extraído:", text);
      }

      const parsedData = parsePDFText(text);

      if (!Array.isArray(parsedData) || parsedData.length === 0) {
        throw new Error("Nenhum dado encontrado no PDF");
      }

      setDatasets((prev) => ({ ...prev, [targetBandeira]: parsedData }));
      setActiveBandeira(targetBandeira);
      setViewScope((prev) => (prev === "consolidado" ? prev : targetBandeira));
      setAuditLog((prev) => [
        {
          id: `log-${Date.now()}`,
          at: new Date().toISOString(),
          action: "import_pdf",
          payload: {
            origem: origin,
            bandeira: targetBandeira,
            gerentes: parsedData.length,
          },
        },
        ...prev.slice(0, 99),
      ]);
      setErpUploadStatus(
        `Sucesso: ${parsedData.length} gerentes em ${
          targetBandeira === "tradicional" ? "FortBet Tradicional" : "FortBet Brasil"
        }`
      );
    } catch (err) {
      setErpUploadStatus("Erro ao processar PDF: " + err.message);
      console.error("[ERP UPLOAD]", err);
    } finally {
      setErpUploadProcessing(false);
    }
  };
  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile || uploadedFile.type !== "application/pdf") {
      setError("Por favor, selecione um arquivo PDF v\u00E1lido");
      return;
    }

    setFile(uploadedFile);
    setError(null);
    setProcessing(true);

    try {
      const arrayBuffer = await uploadedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        text += textContent.items.map((item) => item.str).join(" ") + "\n";
      }

      if (DEBUG_LOGS) {
        console.log("Texto extraÃ­do:", text);
        console.log(
          "Texto limpo:",
          text.replace(/\n/g, " ").replace(/\s+/g, " ")
        );
      }

      const parsedData = parsePDFText(text);

      if (DEBUG_LOGS) {
        console.log("Dados parseados:", parsedData);
        console.log("NÃºmero de gerentes encontrados:", parsedData.length);
      }

      if (parsedData.length === 0) {
        if (DEBUG_LOGS) {
          console.error("DEBUG: Nenhum gerente encontrado");
          console.log("Texto completo para anÃ¡lise:", text);
        }
        throw new Error("Nenhum dado encontrado no PDF");
      }

      setProcessedDataActive(parsedData);
    } catch (err) {
      setError("Erro ao processar PDF: " + err.message);
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };


  const loadImage = (src, label) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        if (DEBUG_LOGS) {
          console.log(`[ART LOADER] ${label || "imagem"} carregada`, src);
        }
        resolve(img);
      };
      img.onerror = (err) => {
        console.error(`[ART LOADER] erro ao carregar ${label || src}`, err);
        reject(err);
      };
      if (DEBUG_LOGS) {
        console.log(`[ART LOADER] solicitando ${label || "imagem"}:`, src);
      }
      img.src = src;
    });

  // Gera imagem de cambista com PNG de fundo no tamanho nativo
  const generateCambistaImage = async (data, gerenteName = "") => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const img = await loadImage(arteColaboradorSrc, "cambista");

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const toNum = (s) => {
      if (!s && s !== 0) return 0;
      const clean = String(s).replace(/\s+/g, "").replace(/\./g, "").replace(/,/, ".");
      const signFixed = clean.replace(/-\s+/, "-");
      const n = parseFloat(signFixed.replace(/[^\d.-]/g, ""));
      return isNaN(n) ? 0 : n;
    };
    const fmt = (n) => (n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const entradasN = toNum(data.entradas);
    const saidasN = toNum(data.saidas);
    const comissaoN = toNum(data.comissao);
    const cartoesN = toNum(data.cartoes);
    const lancN = toNum(data.lancamentos);
    const parcialCalc = entradasN - saidasN - comissaoN;
    const liquidoCalc = parcialCalc + lancN - cartoesN;
    const parcialInfo = toNum(data.parcial);
    const liquidoInfo = toNum(data.liquido);
    if (Math.abs(parcialCalc - parcialInfo) > 0.01 || Math.abs(liquidoCalc - liquidoInfo) > 0.01) {
      if (DEBUG_LOGS) {
        console.warn("[FORTBET] DivergÃªncia detectada", {
          cambista: data.nome,
          periodo: data.periodo,
          parcial_informado: data.parcial,
          parcial_calculado: fmt(parcialCalc),
          liquido_informado: data.liquido,
          liquido_calculado: fmt(liquidoCalc),
        });
      }
    }

    const base = Math.max(canvas.width, canvas.height);
    const fontSm = Math.round(base * 0.030);
    const fontMd = Math.round(base * 0.038);
    const fontLg = Math.round(base * 0.065);

    // PosiÃ§Ãµes aproximadas da nova arte (percentuais X,Y)
    const defaultPos = {
      colaborador: [0.3275, 0.165],
      data: [0.5275, 0.2825],
      entradas: [0.3825, 0.44],
      comissoes: [0.75, 0.44],
      saidas: [0.38, 0.57],
      qtd_apostas: [0.7525, 0.57],
      lancamentos: [0.385, 0.70],
      saldo_final: [0.7525, 0.70],
      saldo_enviar: [0.525, 0.8375],
    };
    const POS = defaultPos;
    const pos = (key) => {
      const [px, py] = POS[key] || [0.5, 0.5];
      return { x: Math.round(px * canvas.width), y: Math.round(py * canvas.height) };
    };

    const draw = (text, p, align = "left", size = fontMd, color = "#000") => {
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.font = `900 ${size}px "Montserrat", Arial, sans-serif`;
      ctx.fillText(text, p.x, p.y);
    };

    // Campos (centralizados nas caixas)
    draw(data.nome, pos("colaborador"), "center", fontMd, "#000");
    draw(data.periodo || "", pos("data"), "center", fontSm, "#000");

    draw(fmt(entradasN), pos("entradas"), "center");
    draw(fmt(comissaoN), pos("comissoes"), "center");
    draw(String(data.nApostas || "0"), pos("qtd_apostas"), "center");
    draw(fmt(saidasN), pos("saidas"), "center");
    draw(fmt(parcialCalc), pos("saldo_final"), "center");
    draw(fmt(lancN), pos("lancamentos"), "center");

    const isPos = liquidoCalc >= 0;
    draw(fmt(liquidoCalc), pos("saldo_enviar"), "center", fontLg, isPos ? "#00AA00" : "#CC0000");

    return canvas.toDataURL("image/png");
  };

  // Gera imagem de gerente com PNG de fundo no tamanho nativo
  const generateGerenteImage = async (gerente) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const img = await loadImage(arteGerenteSrc, "gerente");

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const toNum = (s) => {
      if (!s && s !== 0) return 0;
      const clean = String(s).replace(/\s+/g, "").replace(/\./g, "").replace(/,/, ".");
      const signFixed = clean.replace(/-\s+/, "-");
      const n = parseFloat(signFixed.replace(/[^\d.-]/g, ""));
      return isNaN(n) ? 0 : n;
    };
    const fmt = (n) => (n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const totals = (gerente.cambistas || []).reduce(
      (acc, c) => {
        acc.entradas += toNum(c.entradas);
        acc.saidas += toNum(c.saidas);
        acc.comissoes += toNum(c.comissao);
        acc.lancamentos += toNum(c.lancamentos);
        acc.cartoes += toNum(c.cartoes);
        acc.qtd += Number(c.nApostas || 0);
        return acc;
      },
      {
        entradas: 0,
        saidas: 0,
        comissoes: 0,
        lancamentos: 0,
        cartoes: 0,
        qtd: 0,
      }
    );

    const parcialCalc = totals.entradas - totals.saidas - totals.comissoes;
    const liquidoCalc = parcialCalc + totals.lancamentos - totals.cartoes;
    const qtdCambistas = Array.isArray(gerente.cambistas)
      ? gerente.cambistas.length
      : 0;

    const base = Math.max(canvas.width, canvas.height);
    const fontSm = Math.round(base * 0.030);
    const fontMd = Math.round(base * 0.038);
    const fontLg = Math.round(base * 0.065);

    const defaultPosG = {
      supervisor: [0.14, 0.155],
      data: [0.195, 0.285],
      qtd_cambistas: [0.8675, 0.28],
      entradas: [0.3725, 0.44],
      comissoes: [0.795, 0.44],
      saidas: [0.38, 0.57],
      qtd_apostas: [0.8125, 0.57],
      lancamentos: [0.4075, 0.70],
      saldo_final: [0.79, 0.695],
      saldo_enviar: [0.525, 0.84],
    };
    const POSG = defaultPosG;
    const posG = (key) => {
      const [px, py] = POSG[key] || [0.5, 0.5];
      return { x: Math.round(px * canvas.width), y: Math.round(py * canvas.height) };
    };

    const draw = (text, p, align = "left", size = fontMd, color = "#000") => {
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.font = `900 ${size}px "Montserrat", Arial, sans-serif`;
      ctx.fillText(text, p.x, p.y);
    };

    draw(gerente.nome || "Supervisor", posG("supervisor"), "left", Math.round(fontMd * 0.9), "#000");
    draw(gerente.periodo || "", posG("data"), "left", Math.round(fontSm * 0.9), "#000");
    draw(String(qtdCambistas), posG("qtd_cambistas"), "center", Math.round(fontSm * 0.9), "#000");
    draw(fmt(totals.entradas), posG("entradas"), "center");
    draw(fmt(totals.comissoes), posG("comissoes"), "center");
    draw(fmt(totals.saidas), posG("saidas"), "center");
    draw(String(totals.qtd || 0), posG("qtd_apostas"), "center");
    draw(fmt(totals.lancamentos), posG("lancamentos"), "center");
    draw(fmt(parcialCalc), posG("saldo_final"), "center");

    const isPos = liquidoCalc >= 0;
    draw(fmt(liquidoCalc), posG("saldo_enviar"), "center", fontLg, isPos ? "#00AA00" : "#CC0000");

    if (localStorage.getItem("fortbet_debug_overlay") === "1") {
      ctx.strokeStyle = "#00FF00";
      ctx.lineWidth = 2;
      Object.keys(POSG).forEach((k) => {
        const p = posG(k);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.round(base * 0.004), 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = `900 ${fontSm}px "Montserrat", Arial, sans-serif`;
        ctx.fillStyle = "#00FF00";
        ctx.fillText(k, p.x + 6, p.y - 10);
      });
    }

    return canvas.toDataURL("image/png");
  };

  const generateResumoImage = async (gerente) => {
    const rows = Array.isArray(gerente?.cambistas) ? gerente.cambistas : [];
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const width = 1400;
    const margin = 60;
    const blockHeaderHeight = 110;
    const tableHeaderHeight = 56;
    const rowHeight = 54;
    const totalRows = rows.length + 1; // inclui Total
    canvas.width = width;
    canvas.height =
      margin * 2 + blockHeaderHeight + tableHeaderHeight + rowHeight * Math.max(totalRows, 1);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const headerX = margin;
    const headerWidth = width - margin * 2;

    ctx.fillStyle = "#050505";
    ctx.fillRect(headerX, margin, headerWidth, 60);
    ctx.fillStyle = "#ffffff";
    ctx.font = '700 30px "Montserrat", Arial, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const comissaoText = `ComissÃ£o R$ ${gerente?.comissao || "0,00"}`;
    ctx.fillText(
      `${gerente?.nome || "Gerente"} / ${comissaoText}`,
      headerX + headerWidth / 2,
      margin + 30
    );

    ctx.fillStyle = "#111111";
    ctx.fillRect(headerX, margin + 60, headerWidth, 40);
    ctx.fillStyle = "#ffffff";
    ctx.font = '600 24px "Montserrat", Arial, sans-serif';
    ctx.fillText(
      `PerÃ­odo: ${gerente?.periodo || "NÃ£o informado"}`,
      headerX + headerWidth / 2,
      margin + 60 + 20
    );

    const toNum = (value) => {
      if (value === null || value === undefined) return 0;
      const normalized = String(value)
        .replace(/\s+/g, "")
        .replace(/\./g, "")
        .replace(/,/, ".")
        .replace(/-\s+/, "-")
        .replace(/[^\d.-]/g, "");
      const parsed = parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const formatCurrency = (value) =>
      Number(value || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
      });

    const numericFields = [
      "entradas",
      "saidas",
      "lancamentos",
      "cartoes",
      "comissao",
      "parcial",
      "liquido",
    ];

    const totals = {
      nApostas: 0,
      entradas: 0,
      saidas: 0,
      lancamentos: 0,
      cartoes: 0,
      comissao: 0,
      parcial: 0,
      liquido: 0,
    };

    const preparedRows = rows.map((c) => {
      totals.nApostas += Number(c?.nApostas || 0);
      const prepared = {
        nome: c?.nome || "",
        nApostas: String(c?.nApostas || "0"),
      };
      numericFields.forEach((field) => {
        const num = toNum(c?.[field]);
        totals[field] += num;
        prepared[field] = {
          raw: num,
          text: formatCurrency(num),
        };
      });
      return prepared;
    });

    const totalRow = {
      nome: "Total",
      nApostas: String(totals.nApostas || 0),
    };
    numericFields.forEach((field) => {
      totalRow[field] = {
        raw: totals[field],
        text: formatCurrency(totals[field]),
      };
    });

    const tableRows = [...preparedRows, totalRow];

    const columns = [
      { key: "nome", label: "UsuÃ¡rio", ratio: 0.23, align: "left" },
      { key: "nApostas", label: "NÂº apostas", ratio: 0.07, align: "center" },
      { key: "entradas", label: "Entradas", ratio: 0.1, align: "center" },
      { key: "saidas", label: "SaÃ­das", ratio: 0.1, align: "center" },
      { key: "lancamentos", label: "LanÃ§amentos", ratio: 0.09, align: "center" },
      { key: "cartoes", label: "CartÃµes", ratio: 0.09, align: "center" },
      { key: "comissao", label: "ComissÃ£o", ratio: 0.1, align: "center" },
      { key: "parcial", label: "Parcial", ratio: 0.11, align: "center" },
      { key: "liquido", label: "LÃ­quido", ratio: 0.11, align: "center" },
    ];

    const colPositions = [];
    let cursorX = headerX;
    columns.forEach((col) => {
      const widthCol = headerWidth * col.ratio;
      colPositions.push({
        ...col,
        x: cursorX,
        width: widthCol,
      });
      cursorX += widthCol;
    });

    let currentY = margin + blockHeaderHeight;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(headerX, currentY, headerWidth, tableHeaderHeight);
    ctx.fillStyle = "#ffffff";
    ctx.font = '700 20px "Montserrat", Arial, sans-serif';
    ctx.textBaseline = "middle";
    colPositions.forEach((col) => {
      const anchor =
        col.align === "center"
          ? col.x + col.width / 2
          : col.align === "right"
          ? col.x + col.width - 12
          : col.x + 12;
      ctx.textAlign = col.align === "right" ? "right" : col.align === "center" ? "center" : "left";
      ctx.fillText(col.label, anchor, currentY + tableHeaderHeight / 2);
    });

    currentY += tableHeaderHeight;
    ctx.font = '600 20px "Montserrat", Arial, sans-serif';
    ctx.textAlign = "left";

    const resolveColor = (key, rawValue, isTotal) => {
      if (key === "nome" || key === "nApostas") {
        return isTotal ? "#000000" : "#111111";
      }
      const basePositive = "#0f8f2c";
      const baseNegative = "#c00000";
      switch (key) {
        case "entradas":
        case "cartoes":
        case "parcial":
        case "liquido":
          return rawValue >= 0 ? basePositive : baseNegative;
        case "saidas":
        case "comissao":
          return baseNegative;
        case "lancamentos":
          return "#444444";
        default:
          return isTotal ? "#000000" : "#111111";
      }
    };

    tableRows.forEach((row, index) => {
      const isTotal = index === tableRows.length - 1;
      ctx.fillStyle = isTotal
        ? "#d1d5db"
        : index % 2 === 0
        ? "#f8fafc"
        : "#eef2ff";
      ctx.fillRect(headerX, currentY, headerWidth, rowHeight);

      colPositions.forEach((col) => {
        const anchor =
          col.align === "center"
            ? col.x + col.width / 2
            : col.align === "right"
            ? col.x + col.width - 14
            : col.x + 14;
        ctx.textAlign =
          col.align === "right" ? "right" : col.align === "center" ? "center" : "left";
        ctx.fillStyle = resolveColor(
          col.key,
          row[col.key]?.raw ?? 0,
          isTotal
        );
        ctx.font = `${isTotal ? "700" : "600"} 20px "Montserrat", Arial, sans-serif`;
        const value =
          typeof row[col.key] === "object" && row[col.key] !== null
            ? row[col.key].text
            : row[col.key] || "";
        ctx.fillText(value, anchor, currentY + rowHeight / 2);
      });

      currentY += rowHeight;
    });

    ctx.strokeStyle = "#cbd5f5";
    ctx.lineWidth = 1;
    let lineY = margin + blockHeaderHeight;
    ctx.beginPath();
    ctx.moveTo(headerX, lineY);
    ctx.lineTo(headerX + headerWidth, lineY);
    ctx.stroke();
    lineY += tableHeaderHeight + rowHeight * totalRows;
    ctx.beginPath();
    ctx.moveTo(headerX, lineY);
    ctx.lineTo(headerX + headerWidth, lineY);
    ctx.stroke();

    return canvas.toDataURL("image/png");
  };

  const downloadAllImages = async () => {
    if (!processedData) return;

    setProcessing(true);

    try {
      const zip = new JSZip();

      const normalizePart = (value, fallback) => {
        const base = String(value || fallback || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[\/:*?"<>|]+/g, " ")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_");
        return base.length ? base.slice(0, 40) : fallback;
      };

      for (let index = 0; index < processedData.length; index++) {
        const gerente = processedData[index];
        const folderSlug = normalizePart(gerente?.nome, `gerente_${index + 1}`);
        const gerenteFolder =
          zip.folder(folderSlug) || zip.folder(`gerente_${index + 1}`);

        if (!gerenteFolder) {
          continue;
        }

        const gerenteImg = await generateGerenteImage(gerente);
        gerenteFolder.file("gerente.png", gerenteImg.split(",")[1], { base64: true });

        const resumoImg = await generateResumoImage(gerente);
        gerenteFolder.file("resumo.png", resumoImg.split(",")[1], { base64: true });

        await new Promise((resolve) => setTimeout(resolve, 100));

        for (const cambista of gerente.cambistas) {
          const cambistaImg = await generateCambistaImage(
            {
              ...cambista,
              periodo: gerente.periodo,
            },
            gerente.nome
          );

          const cambistaFile = `${normalizePart(cambista?.nome, "cambista")}.png`;
          gerenteFolder.file(cambistaFile, cambistaImg.split(",")[1], { base64: true });

          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "relatorios_fortbet.zip";
      link.click();

      alert("Arquivo ZIP baixado com sucesso!");
    } catch (err) {
      setError("Erro ao gerar imagens: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(220,38,38,0.1),transparent_50%)] pointer-events-none"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(34,197,94,0.1),transparent_50%)] pointer-events-none"></div>

      {/* Header */}
      <div className="relative z-10 bg-gradient-to-r from-red-600/90 via-red-700/90 to-red-800/90 backdrop-blur-sm py-12 px-6 shadow-2xl border-b border-red-500/20">
        <div className="w-full mx-auto text-center px-4 lg:px-10">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="relative">
              <img
                src="/logo.jpg"
                alt="FortBet Brasil Logo"
                className="w-28 h-28 object-contain drop-shadow-lg"
              />
              <div className="absolute -inset-3 bg-gradient-to-r from-red-500/20 to-green-500/20 rounded-full blur-lg -z-10"></div>
            </div>
            <div>
              <h1 className="text-4xl font-black bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                FORTBET
              </h1>
              <p className="text-xl font-bold text-green-400 mt-1">BRASIL</p>
            </div>
          </div>
          <p className="text-xl text-gray-200 max-w-3xl mx-auto leading-relaxed">
            {activeView === "extrator"
              ? "Gerador de Relatorios Personalizados"
              : "ERP FortBet - visao financeira e operacao em tempo real"}
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-300">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            Sistema Online e Seguro
          </div>
          {activeView === "extrator" && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={openErpInNewTab}
                className="px-5 py-3 rounded-full text-sm font-semibold transition-all bg-white text-black shadow-lg hover:shadow-red-500/25"
              >
                Abrir ERP em nova aba
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 w-full mx-auto px-4 lg:px-10 py-8">
        {activeView === "extrator" && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <div className="text-sm text-gray-300">
                Escolha para qual bandeira o PDF ser‡ salvo antes de enviar.
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-300">
                Upload em
                <select
                  className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  value={activeBandeira}
                  onChange={(e) => setActiveBandeira(e.target.value)}
                >
                  <option value="brasil">FortBet Brasil</option>
                  <option value="tradicional">FortBet Tradicional</option>
                </select>
              </label>
            </div>
            {!(Array.isArray(processedData) && processedData.length > 0) && (
              <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl p-12 border border-gray-700/50 shadow-2xl hover:shadow-red-500/10 transition-all duration-500 hover:border-red-500/30">
                <div className="text-center">
                  <div className="relative mb-8">
                    <div className="w-24 h-24 bg-gradient-to-br from-red-500 to-red-700 rounded-full flex items-center justify-center mx-auto shadow-lg">
                      <Upload className="w-12 h-12 text-white" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                      <span className="text-xs font-bold text-white">PDF</span>
                    </div>
                  </div>

                  <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    Envie o PDF de Fechamento
                  </h2>
                  <p className="text-gray-400 mb-8 text-lg max-w-md mx-auto leading-relaxed">
                    Arraste e solte ou clique para selecionar o arquivo PDF semanal
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={processing}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-4 px-10 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 mx-auto shadow-lg hover:shadow-red-500/25 transform hover:scale-105"
                  >
                    {processing ? (
                      <>
                        <Loader className="animate-spin w-6 h-6" />
                        <span className="text-lg">Processando PDF...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-6 h-6" />
                        <span className="text-lg">Selecionar PDF</span>
                      </>
                    )}
                  </button>

                  {file && (
                    <div className="mt-8 p-4 bg-green-500/10 border border-green-500/20 rounded-xl backdrop-blur-sm">
                      <p className="text-green-400 flex items-center justify-center gap-3 text-lg">
                        <CheckCircle className="w-6 h-6" />
                        <span className="font-medium">{file.name}</span>
                      </p>
                    </div>
                  )}

                  {error && (
                    <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl backdrop-blur-sm">
                      <p className="text-red-400 text-lg">{error}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {Array.isArray(processedData) && processedData.length > 0 && (
              <div className="space-y-8">
                <div className="bg-gradient-to-r from-green-600/20 to-green-700/20 backdrop-blur-xl rounded-2xl p-8 border border-green-500/30 shadow-2xl">
                  <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                    <div className="text-center lg:text-left">
                      <h2 className="text-3xl font-bold mb-3 flex items-center gap-3 justify-center lg:justify-start">
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-6 h-6 text-white" />
                        </div>
                        <span className="bg-gradient-to-r from-green-400 to-green-300 bg-clip-text text-transparent">
                          PDF Processado com Sucesso!
                        </span>
                      </h2>
                      <p className="text-gray-300 text-lg">
                        <span className="font-semibold text-green-400">
                          {processedData.length}
                        </span>{" "}
                        gerentes encontrados &bull;{" "}
                        <span className="font-semibold text-green-400">
                          {processedData.reduce(
                            (sum, g) =>
                              sum + (Array.isArray(g.cambistas) ? g.cambistas.length : 0),
                            0
                          )}
                        </span>{" "}
                        cambistas
                      </p>
                    </div>
                    <button
                      onClick={downloadAllImages}
                      disabled={processing}
                      className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 shadow-lg hover:shadow-green-500/25 transform hover:scale-105"
                    >
                      {processing ? (
                        <>
                          <Loader className="animate-spin w-6 h-6" />
                          <span className="text-lg">Gerando Artes...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-6 h-6" />
                          <span className="text-lg">Baixar ZIP</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 shadow-2xl">
                  <h3 className="text-xl font-bold text-white mb-4">Gerentes encontrados</h3>
                  <div className="divide-y divide-gray-700/40">
                    {processedData.map((gerente, idx) => (
                      <div key={`resumo-${idx}`} className="flex items-center justify-between py-3">
                        <span className="text-gray-300 font-medium">
                          {gerente && gerente.nome ? gerente.nome : `Gerente ${idx + 1}`}
                        </span>
                        <span className="text-green-400 font-semibold">
                          {Array.isArray(gerente?.cambistas) ? gerente.cambistas.length : 0} cambistas
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-center">
                  <button
                    onClick={() => {
                      setProcessedDataActive(null);
                      setFile(null);
                      setError(null);
                    }}
                    className="bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white font-bold py-4 px-12 rounded-xl transition-all duration-300 shadow-lg hover:shadow-gray-500/25 transform hover:scale-105"
                  >
                    Processar Novo PDF
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        {activeView === "erp" && (
          <div className="flex flex-col lg:flex-row gap-6">
            <aside className="w-80 min-w-[18rem] flex-none bg-white/5 border border-white/10 rounded-2xl p-5 lg:sticky top-6 space-y-3 max-lg:w-full">
              <p className="text-xs text-gray-300 font-semibold uppercase tracking-wide">Navegação</p>
              <label className="flex flex-col gap-1 text-xs text-gray-300">
                Upload em
                <select
                  className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  value={activeBandeira}
                  onChange={(e) => setActiveBandeira(e.target.value)}
                >
                  <option value="brasil">FortBet Brasil</option>
                  <option value="tradicional">FortBet Tradicional</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-300">
                Visualiza‡Æo ERP
                <select
                  className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  value={viewScope}
                  onChange={(e) => setViewScope(e.target.value)}
                >
                  <option value="brasil">FortBet Brasil</option>
                  <option value="tradicional">FortBet Tradicional</option>
                  <option value="consolidado">Consolidado (Brasil + Tradicional)</option>
                </select>
              </label>
              <div className="flex flex-col gap-2">
                <button className={navButtonClass("overview")} onClick={() => handleSectionSelect("overview")}>
                  Visão geral
                </button>
                <button className={navButtonClass("filters")} onClick={() => handleSectionSelect("filters")}>
                  Filtros e snapshot
                </button>
                <button className={navButtonClass("financeiro")} onClick={() => handleSectionSelect("financeiro")}>
                  Financeiro
                </button>
                <button className={navButtonClass("lancamentos")} onClick={() => handleSectionSelect("lancamentos")}>
                  Lançamentos
                </button>
                <button className={navButtonClass("auditoria")} onClick={() => handleSectionSelect("auditoria")}>
                  Auditoria
                </button>
                <button className={navButtonClass("hierarquia")} onClick={() => handleSectionSelect("hierarquia")}>
                  Hierarquia
                </button>
              </div>
            </aside>
            <div className="flex-1 min-w-0 space-y-8">
                        {activeSection === "overview" && (
              <div id="overview-section" className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/15 border border-green-500/20 text-green-300 text-xs font-semibold">
                      <Activity className="w-4 h-4" />
                      Modo ERP � Vis�o executiva
                    </div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
                      Opera��o consolidada
                    </h2>
                    <p className="text-gray-400 text-sm">
                      Per�odo: {erpView.periodo || erpData.periodo} � {formatNumberBR(erpView.source.length)} gerentes � {formatNumberBR(erpView.cambistas.length)} cambistas � Escopo: {" "}
                      {viewScope === "consolidado"
                        ? "Consolidado (Brasil + Tradicional)"
                        : viewScope === "brasil"
                        ? "FortBet Brasil"
                        : "FortBet Tradicional"}
                    </p>
                    {lastAutoSave && (
                      <p className="text-[11px] text-gray-500">
                        Auto-snapshot em {lastAutoSave.replace("T", " ").slice(0, 19)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-white/5 text-gray-100 border border-white/10 px-3 py-2 rounded-xl text-xs flex items-center gap-2">
                      <span className="font-semibold">Papel:</span>
                      <span className="uppercase">{currentUser?.papel || "visitante"}</span>
                      <span className="text-[10px] px-2 py-1 rounded-lg bg-black/30 border border-white/10">
                        {canManageFinance ? "Edi��o liberada" : exportFinance ? "Export somente" : "Somente leitura"}
                      </span>
                    </div>
                    <div className="bg-red-500/15 text-red-200 border border-red-500/30 px-3 py-2 rounded-xl text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      {filteredAlerts.length} alertas
                    </div>
                    <button
                      onClick={goToExtrator}
                      className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-semibold flex items-center gap-2 transition"
                    >
                      <ArrowRightCircle className="w-5 h-5" />
                      Voltar ao Extrator
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  {[
                    { key: "brasil", title: "FortBet Brasil", data: panoramaBrasil, accent: "from-emerald-500/20 to-emerald-400/10" },
                    { key: "trad", title: "FortBet Tradicional", data: panoramaTrad, accent: "from-blue-500/20 to-blue-400/10" },
                    { key: "cons", title: "Consolidado", data: panoramaConsolidado, accent: "from-purple-500/20 to-purple-400/10" },
                  ].map(({ key, title, data, accent }) => (
                    <div
                      key={key}
                      className={`rounded-2xl border border-white/10 bg-gradient-to-br ${accent} p-4 flex flex-col gap-3 shadow-lg shadow-black/20`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-300 font-semibold">{title}</div>
                        <span className="text-[11px] px-2 py-1 rounded-lg bg-black/30 border border-white/10 text-gray-200">
                          Margem {formatPercent(data.margem(data.brutoComLanc))}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm text-gray-200">
                        <div className="space-y-1">
                          <p className="text-xs text-gray-400">Faturamento</p>
                          <p className="font-semibold">{formatCurrencyBR(data.entradas)}</p>
                          <p className="text-xs text-gray-400">Comiss�es (cambistas)</p>
                          <p className="font-semibold">{formatCurrencyBR(data.comissoesCambista)}</p>
                          <p className="text-xs text-gray-400">Pr�mios / sa�das</p>
                          <p className="font-semibold">{formatCurrencyBR(data.saidas)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-400">L�quido (sem lan�.)</p>
                          <p className="font-semibold">{formatCurrencyBR(data.liquidoSemLanc)}</p>
                          <p className="text-xs text-gray-400">+ Lan�amentos</p>
                          <p className="font-semibold">{formatCurrencyBR(data.lancamentos)}</p>
                          <p className="text-xs text-gray-400">Bruto (com lan�.)</p>
                          <p className="font-semibold">{formatCurrencyBR(data.brutoComLanc)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-gray-300">
                        <div className="bg-black/30 border border-white/10 rounded-lg p-2">
                          <p className="text-gray-400">Gerentes</p>
                          <p className="font-semibold text-white">{formatNumberBR(data.gerentes)}</p>
                        </div>
                        <div className="bg-black/30 border border-white/10 rounded-lg p-2">
                          <p className="text-gray-400">Cambistas</p>
                          <p className="font-semibold text-white">{formatNumberBR(data.qtdCambistas)}</p>
                        </div>
                        <div className="bg-black/30 border border-white/10 rounded-lg p-2">
                          <p className="text-gray-400">Bilhetes</p>
                          <p className="font-semibold text-white">{formatNumberBR(data.qtdBilhetes)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <PanelShell
                  title="Panorama financeiro consolidado"
                  subtitle="Lucros, despesas e pagamentos das duas opera��es somadas"
                  className="p-4 md:p-6"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                      <p className="text-xs text-gray-400">Comiss�es</p>
                      <div className="flex items-center justify-between text-sm text-gray-200">
                        <span>Gerentes</span>
                        <span className="font-semibold">{formatCurrencyBR(panoramaConsolidado.comGerentes)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-200">
                        <span>Supervis�o</span>
                        <span className="font-semibold">{formatCurrencyBR(panoramaConsolidado.comSupervisao)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-400">
                        <span>Margem sobre faturamento</span>
                        <span>{formatPercent(panoramaConsolidado.margem(panoramaConsolidado.comGerentes + panoramaConsolidado.comSupervisao))}</span>
                      </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                      <p className="text-xs text-gray-400">Despesas & b�nus (consolidado)</p>
                      <div className="flex items-center justify-between text-sm text-gray-200">
                        <span>B�nus cambistas (10% lucro)</span>
                        <span className="font-semibold">{formatCurrencyBR(panoramaConsolidado.bonusCambistas)}</span>
                      </div>
                      {["Folha", "Alugueis", "Parcelas", "Internet", "Sistemas", "Furos"].map((cat) => {
                        const val =
                          (panoramaConsolidado.despesasCategorias?.get?.(cat) ??
                            panoramaConsolidado.despesasCategorias?.[cat]) || 0;
                        return (
                          <div key={cat} className="flex items-center justify-between text-sm text-gray-200">
                            <span>{cat}</span>
                            <span className="font-semibold">{formatCurrencyBR(val)}</span>
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-between text-[11px] text-gray-400 border-t border-white/10 pt-2">
                        <span>Total despesas</span>
                        <span>
                          {formatCurrencyBR(panoramaConsolidado.despesasTotal)} � {" "}
                          {formatPercent(panoramaConsolidado.margem(panoramaConsolidado.despesasTotal))}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                      <p className="text-xs text-gray-400">Lucros e recebimentos</p>
                      <div className="flex items-center justify-between text-sm text-gray-200">
                        <span>Lucro l�quido (sem lan�.)</span>
                        <span className="font-semibold">{formatCurrencyBR(panoramaConsolidado.lucros.liquido)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-200">
                        <span>Lucro bruto (com lan�.)</span>
                        <span className="font-semibold">{formatCurrencyBR(panoramaConsolidado.lucros.bruto)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-200">
                        <span>Pagamentos internos</span>
                        <span className="font-semibold">{formatCurrencyBR(panoramaConsolidado.pagamentosInternos)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-200">
                        <span>Total a receber</span>
                        <span className="font-semibold">{formatCurrencyBR(panoramaConsolidado.totalReceber)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-200">
                        <span>Total recebido</span>
                        <span className="font-semibold">{formatCurrencyBR(panoramaConsolidado.totalRecebido)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-200">
                        <span>Valor pendente</span>
                        <span className="font-semibold">{formatCurrencyBR(panoramaConsolidado.pendente)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-200">
                        <span>Lucro real final (recebido)</span>
                        <span className="font-semibold">{formatCurrencyBR(panoramaConsolidado.lucroRealFinal)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-400 border-t border-white/10 pt-2">
                        <span>Margem l�quido / bruto</span>
                        <span>
                          {formatPercent(panoramaConsolidado.margem(panoramaConsolidado.lucros.liquido))} � {" "}
                          {formatPercent(panoramaConsolidado.margem(panoramaConsolidado.lucros.bruto))}
                        </span>
                      </div>
                    </div>
                  </div>
                </PanelShell>
              </div>
            )}

            {activeSection === "filters" && (
            <PanelShell
              id="filters-section"
              title="Filtros rapidos"
              subtitle="Isolando gerente e periodo sem afetar o extrator"
              className="p-4 md:p-6"
            >
              <div className="flex flex-col gap-3 mb-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="text-sm text-gray-200 font-semibold flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Importar PDF direto no ERP
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-300">
                    Bandeira alvo
                    <select
                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                      value={activeBandeira}
                      onChange={(e) => setActiveBandeira(e.target.value)}
                    >
                      <option value="brasil">FortBet Brasil</option>
                      <option value="tradicional">FortBet Tradicional</option>
                    </select>
                  </label>
                </div>
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <input
                    ref={erpFileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        processPdfForBandeira(file, activeBandeira, "erp");
                      }
                      if (erpFileInputRef.current) {
                        erpFileInputRef.current.value = "";
                      }
                    }}
                  />
                  <button
                    onClick={() => erpFileInputRef.current?.click()}
                    disabled={erpUploadProcessing}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold px-4 py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {erpUploadProcessing ? <Loader className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    {erpUploadProcessing ? "Processando..." : "Selecionar PDF"}
                  </button>
                  <p className="text-xs text-gray-400">
                    Substitui os dados da bandeira selecionada. Recomendo exportar snapshot antes, se tiver dados importantes.
                  </p>
                </div>
                {erpUploadStatus && (
                  <div className="text-sm text-gray-200 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>{erpUploadStatus}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                <label className="flex flex-col text-xs text-gray-300 gap-1 w-full md:w-48">
                  Gerente
                  <select
                    className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                    value={filtroGerente}
                    onChange={(e) => setFiltroGerente(e.target.value)}
                  >
                    {gerenteOptionsErp.map((g) => (
                      <option key={g} value={g}>
                        {g === "todos" ? "Todos" : g}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col text-xs text-gray-300 gap-1 w-full md:w-48">
                  Periodo
                  <select
                    className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                    value={filtroPeriodo}
                    onChange={(e) => setFiltroPeriodo(e.target.value)}
                  >
                    {periodoOptionsErp.map((p) => (
                      <option key={p || "todos"} value={p}>
                        {p === "todos" ? "Todos" : p || "Sem periodo"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col text-xs text-gray-300 gap-1 w-full md:w-48">
                  Competencia
                  <select
                    className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                    value={filtroCompetencia}
                    onChange={(e) => setFiltroCompetencia(e.target.value)}
                  >
                    {competenciaOptions.map((c) => (
                      <option key={c} value={c}>
                        {c === "todas" ? "Todas" : c}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-col text-xs text-gray-300 gap-1 w-full md:w-64">
                  Periodo (data)
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                      value={rangeIni}
                      onChange={(e) => setRangeIni(e.target.value)}
                    />
                    <input
                      type="date"
                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                      value={rangeFim}
                      onChange={(e) => setRangeFim(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <label className="flex flex-col text-xs text-gray-300 gap-1">
                    Entradas min
                    <input
                      type="number"
                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                      value={filterAlerts.entradasMin}
                      onChange={(e) => setFilterAlerts((prev) => ({ ...prev, entradasMin: e.target.value }))}
                    />
                  </label>
                  <label className="flex flex-col text-xs text-gray-300 gap-1">
                    Liquido min
                    <input
                      type="number"
                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                      value={filterAlerts.liquidoMin}
                      onChange={(e) => setFilterAlerts((prev) => ({ ...prev, liquidoMin: e.target.value }))}
                    />
                  </label>
                  <label className="flex flex-col text-xs text-gray-300 gap-1">
                    Apostas max (sem movimento)
                    <input
                      type="number"
                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                      value={filterAlerts.semApostasDias}
                      onChange={(e) => setFilterAlerts((prev) => ({ ...prev, semApostasDias: e.target.value }))}
                    />
                  </label>
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => setFilterAlerts({ entradasMin: "", liquidoMin: "", semApostasDias: "" })}
                      className="px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-xs font-semibold hover:bg-white/20 transition"
                    >
                      Reset alertas
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-3 items-start">
                  <input
                    type="file"
                    accept=".json,application/json"
                    ref={importSnapshotInputRef}
                    className="hidden"
                    onChange={handleSnapshotFile}
                  />
                  <button
                    type="button"
                    onClick={handleExportSnapshot}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-xs font-semibold hover:bg-white/20 transition disabled:opacity-50"
                    disabled={!canManageFinance}
                  >
                    Exportar snapshot JSON
                  </button>
                  <button
                    type="button"
                    onClick={handleImportSnapshot}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-xs font-semibold hover:bg-white/20 transition disabled:opacity-50"
                    disabled={!canManageFinance}
                  >
                    Importar snapshot JSON
                  </button>
                  <button
                    type="button"
                    onClick={handleRestoreAutoSnapshot}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-xs font-semibold hover:bg-white/20 transition disabled:opacity-50"
                    disabled={!canManageFinance}
                  >
                    Restaurar auto
                  </button>
                  <button
                    type="button"
                    onClick={handleExportAuditCSV}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-xs font-semibold hover:bg-white/20 transition disabled:opacity-50"
                    disabled={!canManageFinance}
                  >
                    Exportar auditoria
                  </button>
                  {hasBackend ? (
                    <>
                      <button
                        type="button"
                        onClick={handleSyncMock}
                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-xs font-semibold hover:bg-white/20 transition disabled:opacity-50"
                        disabled={!canManageFinance}
                      >
                        Enviar p/ backend
                      </button>
                      <button
                        type="button"
                        onClick={handleLoadFromMock}
                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-xs font-semibold hover:bg-white/20 transition disabled:opacity-50"
                        disabled={!canManageFinance}
                      >
                        Ler do backend
                      </button>
                    </>
                  ) : (
                    <div className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-gray-400 flex items-center">
                      Backend n?o configurado (usando local)
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleResetLocalData}
                    className="w-full px-3 py-2 rounded-lg bg-red-600/80 border border-red-500/30 text-white text-xs font-semibold hover:bg-red-700 transition disabled:opacity-50"
                    disabled={!canManageFinance}
                  >
                    Limpar dados locais
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-3 text-[11px] text-gray-400">
                  {lastAutoSave && <span>Auto-salvo: {lastAutoSave.replace("T", " ").slice(0, 19)}</span>}
                  <span>Destino sync: {snapshotTarget}</span>
                  {syncStatus && <span className="text-green-300">{syncStatus}</span>}
                </div>
              </PanelShell>
            )}

            {activeSection === "financeiro" && (
            <PanelShell
              id="financeiro-section"
              title="Visao financeira (mock segura)"
              subtitle="Usando seed e PDF processado para validar o desenho do ERP"
            >
              {!canManageFinance && (
                <div className="mb-3 text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 rounded-lg">
                  Apenas admin/financeiro podem adicionar ou editar despesas.
                </div>
              )}
              <div className="hidden mb-4 rounded-xl border border-white/5 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white mb-3">Adicionar despesa (mock local)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <label className="flex flex-col text-xs text-gray-300 gap-1">
                    Categoria
                    <input
                      type="text"
                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                      value={novaDespesa.categoria}
                      onChange={(e) => handleNovaDespesaChange("categoria", e.target.value)}
                      disabled={!canManageFinance}
                      placeholder="Operacional, Marketing..."
                    />
                  </label>
                  <label className="flex flex-col text-xs text-gray-300 gap-1">
                    Centro de custo
                    <input
                      type="text"
                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                      value={novaDespesa.centroCusto}
                      onChange={(e) => handleNovaDespesaChange("centroCusto", e.target.value)}
                      disabled={!canManageFinance}
                      placeholder="Infra, Financeiro..."
                    />
                  </label>
                  <label className="flex flex-col text-xs text-gray-300 gap-1">
                    Valor
                    <input
                      type="number"
                      step="0.01"
                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                      value={novaDespesa.valor}
                      onChange={(e) => handleNovaDespesaChange("valor", e.target.value)}
                      disabled={!canManageFinance}
                    />
                  </label>
                  <label className="flex flex-col text-xs text-gray-300 gap-1">
                    Competencia
                    <input
                      type="text"
                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                      value={novaDespesa.competencia}
                      onChange={(e) => handleNovaDespesaChange("competencia", e.target.value)}
                      disabled={!canManageFinance}
                      placeholder="2025-11"
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-300 mt-3">
                  <input
                    type="checkbox"
                    className="bg-black/40 border border-white/10 rounded"
                    checked={Boolean(novaDespesa.recorrente)}
                    onChange={(e) => handleNovaDespesaChange("recorrente", e.target.checked)}
                    disabled={!canManageFinance}
                  />
                  Despesa recorrente
                </label>
                <div className="flex flex-wrap gap-3 mt-3">
                  <button
                    type="button"
                    onClick={handleAddDespesa}
                    className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50"
                    disabled={!canManageFinance}
                  >
                    Adicionar despesa (mock)
                  </button>
                  <button
                    type="button"
                    onClick={handleResetCustomDespesas}
                    className="px-4 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm font-semibold hover:bg-white/20 transition disabled:opacity-50"
                    disabled={!canManageFinance}
                  >
                    Limpar despesas adicionadas
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                  <p className="text-xs text-gray-400">Entradas</p>
                  <p className="text-xl font-bold text-white">{formatCurrencyBR(erpView.totals.entradas)}</p>
                  <p className="text-xs text-gray-400">Base semanal consolidada</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                  <p className="text-xs text-gray-400">Saidas e custos</p>
                  <p className="text-xl font-bold text-white">{formatCurrencyBR(erpView.totals.custos)}</p>
                  <p className="text-xs text-gray-400">Saidas + cartoes + comissoes</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                  <p className="text-xs text-gray-400">Despesas fixas (seed)</p>
                  <p className="text-xl font-bold text-white">{formatCurrencyBR(totalDespesasAplicadas)}</p>
                  <p className="text-xs text-gray-400">Competencias mockadas</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                  <p className="text-xs text-gray-400">Resultado projetado</p>
                  <p className={`text-xl font-bold ${resultadoFinanceiro >= 0 ? "text-green-300" : "text-red-300"}`}>
                    {formatCurrencyBR(resultadoFinanceiro)}
                  </p>
                  <p className="text-xs text-gray-400">Margem {margemFinal.toFixed(1)}%</p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 rounded-xl border border-white/5 bg-white/5 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-white">Despesas recorrentes (seed)</h4>
                    <span className="text-xs text-gray-400">Seed + mock adicionados localmente</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {despesasAplicadas.length === 0 && (
                      <p className="text-sm text-gray-400 py-3">Nenhuma despesa seed cadastrada</p>
                    )}
                    {despesasAplicadas.map((d) => (
                      <div key={d.id} className="flex items-center justify-between py-3">
                        <div className="flex-1 min-w-0">
                          {editDespesa && editDespesa.id === d.id ? (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                              <input
                                type="text"
                                value={editDespesa.categoria}
                                onChange={(e) => handleEditDespesaChange("categoria", e.target.value)}
                                className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-sm text-white"
                              />
                              <input
                                type="text"
                                value={editDespesa.centroCusto}
                                onChange={(e) => handleEditDespesaChange("centroCusto", e.target.value)}
                                className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-sm text-white"
                              />
                              <input
                                type="text"
                                value={editDespesa.competencia}
                                onChange={(e) => handleEditDespesaChange("competencia", e.target.value)}
                                className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-sm text-white"
                              />
                              <input
                                type="number"
                                step="0.01"
                                value={editDespesa.valor}
                                onChange={(e) => handleEditDespesaChange("valor", e.target.value)}
                                className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-sm text-white"
                              />
                              <label className="flex items-center gap-2 text-xs text-gray-300 col-span-1 md:col-span-4">
                                <input
                                  type="checkbox"
                                  checked={Boolean(editDespesa.recorrente)}
                                  onChange={(e) => handleEditDespesaChange("recorrente", e.target.checked)}
                                />
                                Recorrente
                              </label>
                            </div>
                          ) : (
                            <>
                              <p className="text-white font-semibold">{d.categoria} - {d.centroCusto}</p>
                              <p className="text-xs text-gray-400">
                                Competencia {d.competencia} {d.recorrente ? "• recorrente" : ""}
                              </p>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-semibold text-white">{formatCurrencyBR(d.valor)}</p>
                          {!seedDespIds.has(d.id) && (
                            editDespesa && editDespesa.id === d.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={handleSaveDespesa}
                                  className="text-xs text-green-300 hover:text-green-200"
                                >
                                  Salvar
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelEditDespesa}
                                  className="text-xs text-gray-300 hover:text-gray-100"
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleStartEditDespesa(d)}
                                  className="text-xs text-blue-300 hover:text-blue-200"
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDespesa(d.id)}
                                  className="text-xs text-red-300 hover:text-red-200"
                                >
                                  Remover
                                </button>
                              </>
                            )
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white mb-1">Fluxo resumido</p>
                  <p className="text-xs text-gray-400 mb-3">Projecao simples com base no PDF + despesas seed</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-300">Liquido PDF</span>
                      <span className="font-semibold text-white">{formatCurrencyBR(erpView.totals.liquido)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-300">(-) Despesas seed</span>
                      <span className="font-semibold text-red-300">{formatCurrencyBR(totalDespesasAplicadas)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-300">Resultado projetado</span>
                      <span className={`font-semibold ${resultadoFinanceiro >= 0 ? "text-green-300" : "text-red-300"}`}>
                        {formatCurrencyBR(resultadoFinanceiro)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-300">Margem final</span>
                      <span className="font-semibold text-white">{margemFinal.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-white">Resumo por centro de custo</p>
                    <span className="text-xs text-gray-400">{centroCustoResumo.length} centros</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {centroCustoResumo.map((c) => (
                      <div key={c.centro} className="flex items-center justify-between py-2">
                        <div>
                          <p className="text-white font-semibold">{c.centro}</p>
                          <p className="text-[11px] text-gray-400">{c.perc.toFixed(1)}% das despesas filtradas</p>
                        </div>
                        <p className="text-sm font-semibold text-white">{formatCurrencyBR(c.valor)}</p>
                      </div>
                    ))}
                    {centroCustoResumo.length === 0 && (
                      <p className="text-sm text-gray-400 py-2">Sem despesas na competência filtrada</p>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white mb-1">Observação</p>
                  <p className="text-xs text-gray-400">
                    Distribuição mock: usa seed + despesas adicionadas localmente, filtradas por competência.
                    Na próxima etapa, vamos conectar lançamentos reais e centro de custo por usuário/gerente.
                  </p>
                </div>
              </div>
            </PanelShell>
            )}

            {activeSection === "lancamentos" && (
              <PanelShell
                id="lancamentos-section"
                title="Fluxo de caixa (mock diário)"
                subtitle="Distribuição simples para visualizar ritmo da semana"
              >
                <LancamentosPanel
                  fluxoDiario={fluxoDiario}
                  fluxoCentroCusto={fluxoCentroCusto}
                  filteredLancamentos={filteredLancamentos}
                  auditLog={auditLog}
                  novoLanc={novoLanc}
                  setNovoLanc={setNovoLanc}
                  handleNovoLancChange={handleNovoLancChange}
                  handleAddLancamento={handleAddLancamento}
                  handleResetLancCustom={handleResetLancCustom}
                  handleRemoveLancCustom={handleRemoveLancCustom}
                  lancCustom={lancCustom}
                  handleExportLancamentos={handleExportLancamentos}
                  exportFinance={exportFinance}
                  canManageFinance={canManageFinance}
                  centrosLanc={centrosLanc}
                  lancPorGerente={lancPorGerente}
                  formatCurrencyBR={formatCurrencyBR}
                  formatNumberBR={formatNumberBR}
                  erpStore={erpStore}
                  userIndex={userIndex}
                />
              </PanelShell>
            )}

            {activeSection === "auditoria" && (
              <PanelShell
                id="auditoria-section"
                title="Auditoria local"
                subtitle="Últimas ações registradas no mock local"
                className="p-6"
              >
                <AuditoriaPanel auditLog={auditLog} />
              </PanelShell>
            )}

            {activeSection === "hierarquia" && (
              <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-gray-900/80 border border-gray-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Ranking de cambistas (liquido)</h3>
                  <span className="text-xs text-gray-400">Top 5</span>
                </div>
                <div className="space-y-3">
                  {erpView.ranking.map((c, idx) => (
                    <div key={`rank-${c.nome}-${idx}`} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-400 w-6 text-center">{idx + 1}</span>
                        <div>
                          <p className="text-white font-semibold">{c.nome}</p>
                          <p className="text-xs text-gray-400">{c.gerente ? `Gerente ${c.gerente}` : "Sem gerente"} - {formatNumberBR(c.apostasN)} apostas</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-green-300 font-bold">{formatCurrencyBR(c.liquidoN)}</p>
                        <p className="text-xs text-gray-400">Entradas {formatCurrencyBR(c.entradasN)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <InativosList items={filteredAlerts} formatCurrency={formatCurrencyBR} />
            </div>

            <PanelShell
              id="hierarquia-section"
              title="Hierarquia e ranking"
              subtitle="Ranking, inativos e resumo por gerente"
              className="space-y-4"
            >
              <HierarchyList data={hierarquia} />

              <PanelShell
                title="Resumo por gerente"
                subtitle="Entradas, liquido e cambistas ativos"
                className="p-4 bg-white/5 border-white/10"
                actions={<BarChart3 className="w-5 h-5 text-green-300" />}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {erpView.source.map((g, idx) => {
                    const entradas = (g.cambistas || []).reduce((sum, c) => sum + parseNumberBR(c?.entradas), 0);
                    const liquido = (g.cambistas || []).reduce((sum, c) => sum + parseNumberBR(c?.liquido), 0);
                    const totalCambistas = Array.isArray(g.cambistas) ? g.cambistas.length : 0;
                    return (
                      <div key={`card-g-${idx}`} className="rounded-xl border border-white/5 bg-white/5 p-4 shadow">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-white">{g.nome || `Gerente ${idx + 1}`}</p>
                          <span className="text-xs text-gray-400">{g.periodo || "Periodo"}</span>
                        </div>
                        <p className="text-sm text-gray-300">
                          Entradas <span className="font-semibold text-white">{formatCurrencyBR(entradas)}</span>
                        </p>
                        <p className="text-sm text-gray-300">
                          Liquido <span className="font-semibold text-green-300">{formatCurrencyBR(liquido)}</span>
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                          <Users className="w-4 h-4" />
                          {totalCambistas} cambistas
                        </div>
                      </div>
                    );
                  })}
                </div>
              </PanelShell>
            </PanelShell>
              </>
            )}
            </div>
          </div>
        )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
    </div>
  );
};


// Parser principal baseado em texto continuo (normalizado)
const parsePDFTextStable = (text) => {
  const DEBUG = DEBUG_LOGS;

  const normalizeText = (input) =>
    (input || "")
      .normalize("NFKC")
      .replace(/[\u00A0\u2007\u202F]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const sanitizeGerenteName = (value) =>
    (value || "").replace(/^\s*\d+\s*/, "").trim();
  const shouldIgnoreHeader = (value) => {
    const norm = (value || "").toLowerCase();
    if (!norm) return true;
    if (/\bapostas\b/.test(norm) && /\bentradas\b/.test(norm)) return true;
    return false;
  };

  const textNorm = normalizeText(text);
  const LETTER_CLASS = "A-Za-z\\u00C0-\\u017F";
  const NAME_BODY_CHARS = `${LETTER_CLASS}0-9\\s._'\\-`;
  const NAME_START_CHARS = `${LETTER_CLASS}0-9`;

  const headerRe = new RegExp(
    `([${NAME_BODY_CHARS}]+?)\\s*\\/\\s*Comiss(?:\\u00E3o|ao)\\s*R\\$\\s*(-?\\s*\\d{1,3}(?:\\.\\d{3})*,\\d{2})`,
    "giu"
  );

  const headers = [];
  for (const match of textNorm.matchAll(headerRe)) {
    const nomeBruto = (match[1] || "").trim();
    const nome = sanitizeGerenteName(nomeBruto);
    if (shouldIgnoreHeader(nome)) continue;
    headers.push({
      index: match.index ?? 0,
      nome,
      comissao: (match[2] || "0,00").replace(/\s+/g, ""),
    });
  }

  if (DEBUG) console.log("Headers detectados:", headers.map((h) => h.nome));
  if (headers.length === 0) return [];

  const gerentes = [];
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index;
    const end = i + 1 < headers.length ? headers[i + 1].index : textNorm.length;
    const section = textNorm.slice(start, end);

    const periodoMatch = section.match(/Per[i\u00ED]odo:\s*([0-9\/\.\-\s\u00E0a]+\d{4})/iu);
    const periodo = periodoMatch ? (periodoMatch[1] || "").trim() : "";

    const headerMatch = section.match(
      /Usu[\u00E1a]rio\s+N[\u00B0Âºï¿½]?\s*apostas\s*Entradas\s*Sa[i\u00ED]das\s*Lan[c\u00E7]amentos\s*Cart[\u00F5o]es\s*Comiss[a\u00E3]o\s*Parcial\s*L[i\u00ED]quido/i
    );
    if (!headerMatch) {
      if (DEBUG) {
        console.warn(
          `[PARSER] CabeÃ§alho da tabela nÃ£o encontrado para ${headers[i].nome}`
        );
      }
      continue;
    }

    const tableStartIndex = section.indexOf(headerMatch[0]) + headerMatch[0].length;
    let tableContent = section.slice(tableStartIndex);
    const totalMatchIndex = tableContent.search(/\b(?:Subtotal|Total)\b/i);
    if (totalMatchIndex !== -1) {
      tableContent = tableContent.slice(0, totalMatchIndex);
    }
    tableContent = tableContent.trim();

    const money = '-?\\s*\\d{1,3}(?:\\.\\d{3})*,\\d{2}';
    const rowRe = new RegExp(
      `([${NAME_START_CHARS}][${NAME_BODY_CHARS}]*?)\\s+([\\d\\.\\s]+)((?:\\s+R\\$\\s*${money}){6,8})`,
      'giu'
    );
    const normalizeApostas = (raw) => {
      const num = parseInt(String(raw || "").replace(/[^\d]/g, ""), 10);
      if (!Number.isFinite(num) || num < 0) return 0;
      if (num > 2000) return 0; // evita inflar total com linhas erradas
      return num;
    };

    const cambistas = [];
    let rowMatch;
    while ((rowMatch = rowRe.exec(tableContent)) !== null) {
      const nome = (rowMatch[1] || "").trim();
      if (
        !nome ||
        /(subtotal|total)/i.test(nome) ||
        shouldIgnoreHeader(nome)
      )
        continue;

      const apostaStr = normalizeApostas(rowMatch[2]).toString();
      const currencyBlock = rowMatch[3] || "";
      const valueMatches = Array.from(
        currencyBlock.matchAll(new RegExp(money, 'gu'))
      ).map((match) => (match[0] || "").replace(/\s+/g, ""));

      if (valueMatches.length < 7) {
        if (/(subtotal|total)/i.test(nome)) {
          continue;
        }
        const lastValue = valueMatches[valueMatches.length - 1] || "0,00";
        while (valueMatches.length < 7) {
          valueMatches.push(lastValue);
        }
      } else if (valueMatches.length > 7) {
        valueMatches.length = 7;
      }

      const [
        entradas = "0,00",
        saidas = "0,00",
        lancamentos = "0,00",
        cartoes = "0,00",
        comissao = "0,00",
        parcial = "0,00",
        liquido = "0,00",
      ] = valueMatches;

      cambistas.push({
        nome,
        nApostas: apostaStr,
        entradas,
        saidas,
        lancamentos,
        cartoes,
        comissao,
        parcial,
        liquido,
      });
    }

    if (DEBUG) console.log(`Cambistas em ${headers[i].nome}:`, cambistas.length);
    gerentes.push({
      nome: headers[i].nome,
      comissao: headers[i].comissao,
      periodo: periodo || "Período não informado",
      cambistas,
    });
  }

  if (DEBUG) {
    console.log('Gerentes totais:', gerentes.length);
    console.log('Nomes:', gerentes.map((g) => g.nome));
  }

  return gerentes;
};

// Parser global mantem compatibilidade apontando para o parser estavel
const parsePDFTextGlobal = (text) => parsePDFTextStable(text);
export default App;









































