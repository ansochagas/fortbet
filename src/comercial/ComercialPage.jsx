import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Briefcase, Loader2, Sparkles } from "lucide-react";
import {
  appendOnlineSnapshot,
  getAnnualConfigForYear,
  getImportedResultsForMonth,
  getImportedResultsForYear,
  getMonthlyConfigForMonth,
  getMonthlyConfigForYear,
  getOnlineCambistaRegistry,
  hasRemoteCommercialApi,
  replaceImportedResultsForMonth,
  runOnlineSyncNow,
  saveAnnualConfigForYear,
  saveMonthlyConfigForMonth,
  saveOnlineCambistaRegistry,
} from "./api";
import { buildCommercialDashboard } from "./calculations";
import {
  formatCurrencyBR,
  formatMonthKey,
  formatMonthLabel,
  MANAGER_ROLE,
  splitMonthKey,
  statusPriority,
  VIEW_MODES,
} from "./domain";
import { applyOnlinePayload } from "./onlineSync";
import { buildImportRecords, parseCommercialPdfFile } from "./parser";
import { resolveCollaborator } from "./registry";
import { DEFAULT_AREA_OWNERS } from "./areaOwnership";
import { CollaboratorCard } from "./ui/CollaboratorCard";
import { FiltersBar } from "./ui/FiltersBar";
import { GoalSettingsModal } from "./ui/GoalSettingsModal";
import { HeroMetas } from "./ui/HeroMetas";
import { TeamSummary } from "./ui/TeamSummary";
import { getCurrentUser, signInAs } from "../erp/auth";
import { getErpState } from "../erp/store";

const buildDraftFromCards = (cards) =>
  (cards || []).reduce((acc, card) => {
    acc[card.id] = {
      metaMensalNovosCambistas: String(card?.monthly?.novosCambistas?.goal || ""),
      realizadoMensalNovosCambistas: String(card?.monthly?.novosCambistas?.actual || ""),
      baseFaturamentoMesAnterior: String(card?.monthly?.faturamento?.baseMesAnterior || ""),
      metaAnualNovosCambistas: String(card?.annual?.novosCambistas?.goal || ""),
      metaAnualFaturamento: String(card?.annual?.faturamento?.goal || ""),
    };
    return acc;
  }, {});

const safeNumber = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sortCards = (items, sortKey) => {
  const sorted = [...items];

  switch (sortKey) {
    case "performance":
      return sorted.sort(
        (a, b) => b.progressAverage - a.progressAverage || a.name.localeCompare(b.name, "pt-BR")
      );
    case "faturamento":
      return sorted.sort(
        (a, b) =>
          b.selected.faturamento.actual - a.selected.faturamento.actual ||
          a.name.localeCompare(b.name, "pt-BR")
      );
    case "novos":
      return sorted.sort(
        (a, b) =>
          b.selected.novosCambistas.actual - a.selected.novosCambistas.actual ||
          a.name.localeCompare(b.name, "pt-BR")
      );
    case "alpha":
      return sorted.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    case "priority":
    default:
      return sorted.sort(
        (a, b) =>
          (statusPriority[a.overallStatus] ?? 99) - (statusPriority[b.overallStatus] ?? 99) ||
          b.sortGap - a.sortGap ||
          a.name.localeCompare(b.name, "pt-BR")
      );
  }
};

const extractRowsFromPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
};

const toSnapshotDate = (payload) => {
  const raw = payload?.snapshotDate || payload?.date || payload?.data || "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(raw))) return String(raw);
  const parsed = new Date(raw || Date.now());
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

export const ComercialPage = () => {
  const fileInputRef = useRef(null);
  const onlineJsonInputRef = useRef(null);
  const [monthKey, setMonthKey] = useState(formatMonthKey());
  const [viewMode, setViewMode] = useState(VIEW_MODES.MONTHLY);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [sortKey, setSortKey] = useState("priority");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState({});
  const [importState, setImportState] = useState({
    busy: false,
    message: "",
    tone: "info",
  });
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [monthlyImported, setMonthlyImported] = useState([]);
  const [yearlyImported, setYearlyImported] = useState([]);
  const [monthlyConfig, setMonthlyConfig] = useState([]);
  const [yearlyMonthlyConfig, setYearlyMonthlyConfig] = useState([]);
  const [annualConfig, setAnnualConfig] = useState([]);
  const [currentUser, setCurrentUser] = useState(
    () => getCurrentUser() || { nome: "Visitante", papel: "visitante" }
  );

  const roleOptions = useMemo(
    () =>
      Array.from(new Set((getErpState()?.usuarios || []).map((user) => user.papel))).filter(
        Boolean
      ),
    []
  );

  const { year, month } = useMemo(() => splitMonthKey(monthKey), [monthKey]);
  const canManage = currentUser?.papel === MANAGER_ROLE;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      getImportedResultsForMonth(year, month),
      getImportedResultsForYear(year),
      getMonthlyConfigForMonth(year, month),
      getMonthlyConfigForYear(year),
      getAnnualConfigForYear(year),
    ])
      .then(([monthImportedData, yearImportedData, monthConfigData, yearConfigData, annualData]) => {
        if (cancelled) return;
        setMonthlyImported(monthImportedData || []);
        setYearlyImported(yearImportedData || []);
        setMonthlyConfig(monthConfigData || []);
        setYearlyMonthlyConfig(yearConfigData || []);
        setAnnualConfig(annualData || []);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[FORTBET][comercial] erro ao carregar painel", err);
        setImportState({
          busy: false,
          message: "Nao foi possivel carregar os dados do painel comercial.",
          tone: "error",
        });
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [year, month, refreshNonce]);

  useEffect(() => {
    if (!hasRemoteCommercialApi) return undefined;

    const intervalId = window.setInterval(() => {
      setRefreshNonce((prev) => prev + 1);
    }, 5 * 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const dashboard = useMemo(
    () =>
      buildCommercialDashboard({
        monthKey,
        viewMode,
        monthlyImported,
        yearlyImported,
        monthlyConfig,
        yearlyMonthlyConfig,
        annualConfig,
      }),
    [
      monthKey,
      viewMode,
      monthlyImported,
      yearlyImported,
      monthlyConfig,
      yearlyMonthlyConfig,
      annualConfig,
    ]
  );

  const groupOptions = useMemo(
    () =>
      Array.from(new Set(dashboard.cards.flatMap((card) => card.groupNames || []).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, "pt-BR")
      ),
    [dashboard.cards]
  );

  useEffect(() => {
    if (groupFilter !== "all" && !groupOptions.includes(groupFilter)) {
      setGroupFilter("all");
    }
  }, [groupFilter, groupOptions]);

  const visibleCards = useMemo(() => {
    const base = dashboard.cards.filter((card) => {
      const matchesSearch = !search || card.name.toLowerCase().includes(search.toLowerCase());
      const matchesGroup = groupFilter === "all" || (card.groupNames || []).includes(groupFilter);
      return matchesSearch && matchesGroup;
    });

    return sortCards(base, sortKey);
  }, [dashboard.cards, groupFilter, search, sortKey]);

  const lastUpdated = useMemo(() => {
    const dates = monthlyImported.map((entry) => entry?.importedAt).filter(Boolean).sort().reverse();
    return dates[0] || "";
  }, [monthlyImported]);

  const settingsRows = useMemo(
    () => [...dashboard.cards].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [dashboard.cards]
  );

  const openSettings = () => {
    if (!canManage) return;
    setSettingsDraft(buildDraftFromCards(settingsRows));
    setSettingsOpen(true);
  };

  const handleDraftChange = (collaboratorId, key, value) => {
    setSettingsDraft((prev) => ({
      ...prev,
      [collaboratorId]: {
        ...(prev[collaboratorId] || {}),
        [key]: value,
      },
    }));
  };

  const handleSaveSettings = async () => {
    if (!canManage) return;

    setSaving(true);
    const timestamp = new Date().toISOString();
    const editorName = currentUser?.nome || currentUser?.papel || "gerente";

    const monthlyEntries = settingsRows.map((row) => ({
      collaboratorId: row.id,
      displayName: row.name,
      year,
      month,
      metaMensalNovosCambistas: safeNumber(settingsDraft?.[row.id]?.metaMensalNovosCambistas),
      realizadoMensalNovosCambistas: safeNumber(
        settingsDraft?.[row.id]?.realizadoMensalNovosCambistas
      ),
      baseFaturamentoMesAnterior: safeNumber(settingsDraft?.[row.id]?.baseFaturamentoMesAnterior),
      editadoPor: editorName,
      editadoEm: timestamp,
    }));

    const annualEntries = settingsRows.map((row) => ({
      collaboratorId: row.id,
      displayName: row.name,
      year,
      metaAnualNovosCambistas: safeNumber(settingsDraft?.[row.id]?.metaAnualNovosCambistas),
      metaAnualFaturamento: safeNumber(settingsDraft?.[row.id]?.metaAnualFaturamento),
      editadoPor: editorName,
      editadoEm: timestamp,
    }));

    try {
      await Promise.all([
        saveMonthlyConfigForMonth(year, month, monthlyEntries),
        saveAnnualConfigForYear(year, annualEntries),
      ]);

      setSettingsOpen(false);
      setImportState({
        busy: false,
        message: "Configuracoes comerciais salvas com sucesso.",
        tone: "success",
      });
      setRefreshNonce((prev) => prev + 1);
    } catch (err) {
      console.error("[FORTBET][comercial] erro ao salvar configuracoes", err);
      setImportState({
        busy: false,
        message: "Nao foi possivel salvar as configuracoes comerciais.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportState({
      busy: true,
      message: "Lendo e consolidando o PDF comercial...",
      tone: "info",
    });

    try {
      const parsed = await parseCommercialPdfFile(file);
      const payload = buildImportRecords({
        parsed,
        fileName: file.name,
        resolveCollaborator,
      });

      if (!payload.entries.length) {
        throw new Error("Nenhum bloco valido foi encontrado no PDF.");
      }

      const targetMonthKey = payload.monthKey || monthKey;
      const targetParts = splitMonthKey(targetMonthKey);
      const entries = payload.entries.map((entry) => ({
        ...entry,
        year: targetParts.year,
        month: targetParts.month,
      }));

      await replaceImportedResultsForMonth(targetParts.year, targetParts.month, entries);

      setMonthKey(targetMonthKey);
      setImportState({
        busy: false,
        message: `PDF importado com sucesso. ${entries.length} blocos consolidados em ${formatMonthLabel(
          targetMonthKey
        )}.`,
        tone: "success",
      });
      setRefreshNonce((prev) => prev + 1);
    } catch (err) {
      console.error("[FORTBET][comercial] erro ao importar PDF", err);
      setImportState({
        busy: false,
        message: `Erro ao importar PDF: ${err.message}`,
        tone: "error",
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const processOnlinePayload = async (payload, sourceLabel) => {
    const rows = extractRowsFromPayload(payload);
    if (!rows.length) {
      throw new Error("O JSON online nao possui linhas de cambistas.");
    }

    const snapshotDate = toSnapshotDate(payload);
    const targetMonthKey = snapshotDate.slice(0, 7);
    const { year: targetYear, month: targetMonth } = splitMonthKey(targetMonthKey);
    const importedAt = new Date().toISOString();

    const [monthEntries, registryEntries] = await Promise.all([
      getImportedResultsForMonth(targetYear, targetMonth),
      getOnlineCambistaRegistry(),
    ]);

    const result = applyOnlinePayload({
      payload: { rows, snapshotDate },
      existingMonthEntries: monthEntries,
      existingRegistry: registryEntries,
      areaOwners: DEFAULT_AREA_OWNERS,
      resolveCollaborator,
      importedAt,
    });

    await Promise.all([
      replaceImportedResultsForMonth(targetYear, targetMonth, result.monthEntries),
      saveOnlineCambistaRegistry(result.registry),
      appendOnlineSnapshot({
        source: sourceLabel,
        importedAt,
        monthKey: result.monthKey,
        snapshotDate: result.summary.snapshotDate,
        totalRows: result.summary.totalRows,
        totalNovosNoDia: result.summary.totalNovosNoDia,
        totalVendidoDia: result.summary.totalVendidoDia,
      }),
    ]);

    setMonthKey(result.monthKey);
    setImportState({
      busy: false,
      tone: "success",
      message:
        `Snapshot online aplicado (${result.summary.totalRows} cambistas, ` +
        `${result.summary.totalNovosNoDia} novos hoje, ` +
        `${formatCurrencyBR(result.summary.totalVendidoDia)} vendidos).`,
    });
    setRefreshNonce((prev) => prev + 1);
  };

  const handleImportOnlineJson = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportState({
      busy: true,
      message: "Importando snapshot online em JSON...",
      tone: "info",
    });

    try {
      const content = await file.text();
      const payload = JSON.parse(content);
      await processOnlinePayload(payload, `arquivo:${file.name}`);
    } catch (err) {
      console.error("[FORTBET][comercial] erro ao importar JSON online", err);
      setImportState({
        busy: false,
        message: `Erro ao importar JSON online: ${err.message}`,
        tone: "error",
      });
    } finally {
      if (onlineJsonInputRef.current) {
        onlineJsonInputRef.current.value = "";
      }
    }
  };

  const handleSyncLocalSnapshot = async () => {
    setImportState({
      busy: true,
      message: "Sincronizando dados comerciais...",
      tone: "info",
    });

    try {
      if (hasRemoteCommercialApi) {
        const summary = await runOnlineSyncNow();
        setImportState({
          busy: false,
          tone: "success",
          message:
            `Sincronizacao concluida (${summary?.totalRows || 0} cambistas, ` +
            `${summary?.totalNovosNoDia || 0} novos hoje, ` +
            `${formatCurrencyBR(summary?.totalVendidoDia || 0)} vendidos).`,
        });
        if (summary?.monthKey) {
          setMonthKey(summary.monthKey);
        }
        setRefreshNonce((prev) => prev + 1);
        return;
      }

      const response = await fetch("/comercial-sync/latest.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      await processOnlinePayload(payload, "snapshot-local");
    } catch (err) {
      console.error("[FORTBET][comercial] erro ao sincronizar snapshot local", err);
      setImportState({
        busy: false,
        message:
          hasRemoteCommercialApi
            ? "Nao foi possivel executar a sincronizacao remota. Verifique o backend comercial."
            : "Nao foi possivel carregar /comercial-sync/latest.json. Rode o script de sincronizacao e tente novamente.",
        tone: "error",
      });
    }
  };

  const handleRoleChange = (role) => {
    const nextUser = signInAs(role) || currentUser;
    setCurrentUser(nextUser);
  };

  const handleGoTo = (path) => {
    if (typeof window === "undefined") return;
    window.location.href = `${window.location.origin}${path}`;
  };

  const messageClass =
    importState.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : importState.tone === "error"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-sky-200 bg-sky-50 text-sky-700";

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#fff7ed_42%,#f8fafc_100%)] text-slate-950">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleImportFile}
      />
      <input
        ref={onlineJsonInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportOnlineJson}
      />

      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <HeroMetas
          monthLabel={formatMonthLabel(monthKey)}
          totals={dashboard.totals}
          viewMode={viewMode}
          lastUpdated={lastUpdated}
        />

        <TeamSummary summary={dashboard.summary} viewMode={viewMode} />

        <section className="rounded-[2rem] border border-slate-200 bg-white/85 p-5 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Performance Individual
              </p>
              <h2 className="mt-2 text-3xl font-black text-slate-950">
                Meta individual de cada colaborador
              </h2>
            </div>
            <p className="text-sm text-slate-500">
              {visibleCards.length} colaboradores visiveis de {dashboard.summary.totalColaboradores}.
            </p>
          </div>

          {loading ? (
            <div className="flex min-h-[18rem] items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Carregando dados comerciais...
              </div>
            </div>
          ) : visibleCards.length === 0 ? (
            <div className="flex min-h-[18rem] items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
              Nenhum colaborador encontrado com o filtro atual. Importe o PDF ou JSON online e
              ajuste os filtros para visualizar a equipe.
            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
              {visibleCards.map((card) => (
                <CollaboratorCard key={card.id} card={card} viewMode={viewMode} />
              ))}
            </div>
          )}
        </section>

        {importState.message && (
          <div className={`rounded-3xl border px-5 py-4 text-sm font-semibold ${messageClass}`}>
            <div className="flex items-center gap-3">
              {importState.busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {importState.message}
            </div>
          </div>
        )}

        <FiltersBar
          monthKey={monthKey}
          onMonthChange={(value) => setMonthKey(value || formatMonthKey())}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          search={search}
          onSearchChange={setSearch}
          groupFilter={groupFilter}
          onGroupFilterChange={setGroupFilter}
          groupOptions={groupOptions}
          sortKey={sortKey}
          onSortKeyChange={setSortKey}
          canManage={canManage}
          onImportClick={() => fileInputRef.current?.click()}
          onImportOnlineJsonClick={() => onlineJsonInputRef.current?.click()}
          onSyncOnlineClick={handleSyncLocalSnapshot}
          onOpenSettings={openSettings}
          onlineSyncBusy={importState.busy}
          currentRole={currentUser?.papel || ""}
          onRoleChange={handleRoleChange}
          roleOptions={roleOptions}
        />

        <section className="flex flex-wrap items-center justify-center gap-3 rounded-[2rem] border border-slate-200 bg-white/80 p-5 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => handleGoTo("/")}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Extrator
          </button>
          <button
            type="button"
            onClick={() => handleGoTo("/erp")}
            className="inline-flex items-center gap-2 rounded-2xl bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
          >
            <Briefcase className="h-4 w-4" />
            Ir para ERP
          </button>
        </section>
      </div>

      <GoalSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        rows={settingsRows}
        draft={settingsDraft}
        onDraftChange={handleDraftChange}
        onSave={handleSaveSettings}
        saving={saving}
      />
    </div>
  );
};

export default ComercialPage;
