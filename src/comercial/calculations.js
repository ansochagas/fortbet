import {
  KPI_STATUS,
  VIEW_MODES,
  ratioToStatus,
  statusPriority,
} from "./domain";
import {
  COMMERCIAL_COLLABORATORS,
  canonicalCollaboratorId,
} from "./registry";

const toPositiveNumber = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildKpi = (goal, actual, extra = {}) => {
  const safeGoal = toPositiveNumber(goal);
  const safeActual = toPositiveNumber(actual);
  const hasGoal = safeGoal > 0;
  const ratio = hasGoal ? safeActual / safeGoal : 0;
  const status = hasGoal ? ratioToStatus(ratio) : KPI_STATUS.NO_GOAL;

  return {
    goal: safeGoal,
    actual: safeActual,
    ratio,
    percent: ratio * 100,
    gap: hasGoal ? safeGoal - safeActual : 0,
    status,
    ...extra,
  };
};

const buildOverallStatus = (firstStatus, secondStatus) => {
  const priorities = [firstStatus, secondStatus].map((status) => statusPriority[status] ?? 0);
  return priorities[0] <= priorities[1] ? firstStatus : secondStatus;
};

const buildYearLookup = (entries, keyField = "collaboratorId") => {
  const grouped = new Map();
  (entries || []).forEach((entry) => {
    const key = entry?.[keyField];
    if (!key) return;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(entry);
  });
  return grouped;
};

const normalizeCollaboratorEntries = (entries, allowedIds) =>
  (entries || [])
    .map((entry) => {
      const collaboratorId = canonicalCollaboratorId(entry?.collaboratorId);
      if (!collaboratorId || !allowedIds.has(collaboratorId)) return null;
      return {
        ...entry,
        collaboratorId,
      };
    })
    .filter(Boolean);

export const buildCommercialDashboard = ({
  monthKey,
  viewMode = VIEW_MODES.MONTHLY,
  monthlyImported = [],
  yearlyImported = [],
  monthlyConfig = [],
  yearlyMonthlyConfig = [],
  annualConfig = [],
  registry = COMMERCIAL_COLLABORATORS,
}) => {
  const registryById = new Map(
    (registry || []).map((entry) => [canonicalCollaboratorId(entry.id), entry])
  );
  const allowedIds = new Set(registryById.keys());
  const normalizedMonthlyImported = normalizeCollaboratorEntries(monthlyImported, allowedIds);
  const normalizedYearlyImported = normalizeCollaboratorEntries(yearlyImported, allowedIds);
  const normalizedMonthlyConfig = normalizeCollaboratorEntries(monthlyConfig, allowedIds);
  const normalizedYearlyMonthlyConfig = normalizeCollaboratorEntries(yearlyMonthlyConfig, allowedIds);
  const normalizedAnnualConfig = normalizeCollaboratorEntries(annualConfig, allowedIds);

  const importedById = new Map(
    normalizedMonthlyImported.map((entry) => [entry.collaboratorId, entry])
  );
  const monthlyConfigById = new Map(
    normalizedMonthlyConfig.map((entry) => [entry.collaboratorId, entry])
  );
  const annualConfigById = new Map(
    normalizedAnnualConfig.map((entry) => [entry.collaboratorId, entry])
  );
  const yearlyImportedById = buildYearLookup(normalizedYearlyImported);
  const yearlyMonthlyConfigById = buildYearLookup(normalizedYearlyMonthlyConfig);

  const ids = new Set(allowedIds);

  const cards = Array.from(ids)
    .map((id) => {
      const registryEntry = registryById.get(id);
      const importedEntry = importedById.get(id) || null;
      const monthlyConfigEntry = monthlyConfigById.get(id) || null;
      const annualConfigEntry = annualConfigById.get(id) || null;
      const yearlyRevenue = (yearlyImportedById.get(id) || []).reduce(
        (sum, entry) => sum + toPositiveNumber(entry?.faturamentoRealizado),
        0
      );
      const yearlyNew = (yearlyMonthlyConfigById.get(id) || []).reduce(
        (sum, entry) => sum + toPositiveNumber(entry?.realizadoMensalNovosCambistas),
        0
      );

      const hasAutoMonthlyNew =
        importedEntry &&
        Object.prototype.hasOwnProperty.call(importedEntry, "novosCambistasAuto");
      const monthlyNewActual = hasAutoMonthlyNew
        ? toPositiveNumber(importedEntry?.novosCambistasAuto)
        : toPositiveNumber(monthlyConfigEntry?.realizadoMensalNovosCambistas);

      const monthlyNew = buildKpi(
        monthlyConfigEntry?.metaMensalNovosCambistas,
        monthlyNewActual,
        {
          source: hasAutoMonthlyNew ? "automatico" : "manual",
        }
      );
      const monthlyRevenue = buildKpi(
        toPositiveNumber(monthlyConfigEntry?.baseFaturamentoMesAnterior) * 1.1,
        importedEntry?.faturamentoRealizado,
        {
          baseMesAnterior: toPositiveNumber(monthlyConfigEntry?.baseFaturamentoMesAnterior),
        }
      );

      const annualNew = buildKpi(
        annualConfigEntry?.metaAnualNovosCambistas,
        yearlyNew
      );
      const annualRevenue = buildKpi(
        annualConfigEntry?.metaAnualFaturamento,
        yearlyRevenue
      );

      const selectedNew = viewMode === VIEW_MODES.ANNUAL ? annualNew : monthlyNew;
      const selectedRevenue =
        viewMode === VIEW_MODES.ANNUAL ? annualRevenue : monthlyRevenue;
      const overallStatus = buildOverallStatus(selectedNew.status, selectedRevenue.status);
      const progressAverage =
        (selectedNew.percent + selectedRevenue.percent) / 2;

      return {
        id,
        name: registryEntry.name,
        photo: registryEntry.photo || "",
        aliases: registryEntry.aliases || [],
        displayNames: importedEntry?.aliasNames || [],
        groupNames: importedEntry?.aliasNames?.length
          ? importedEntry.aliasNames
          : importedEntry?.gerenciaPdf
            ? [importedEntry.gerenciaPdf]
            : [],
        cambistasCount: toPositiveNumber(importedEntry?.cambistasCount),
        monthly: {
          novosCambistas: monthlyNew,
          faturamento: monthlyRevenue,
        },
        annual: {
          novosCambistas: annualNew,
          faturamento: annualRevenue,
        },
        selected: {
          novosCambistas: selectedNew,
          faturamento: selectedRevenue,
        },
        overallStatus,
        progressAverage,
        sortGap:
          Math.max(selectedNew.gap, 0) + Math.max(selectedRevenue.gap, 0),
        lastImportedAt: importedEntry?.importedAt || "",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const totals = cards.reduce(
    (acc, card) => {
      acc.monthly.novosCambistas.goal += card.monthly.novosCambistas.goal;
      acc.monthly.novosCambistas.actual += card.monthly.novosCambistas.actual;
      acc.monthly.faturamento.goal += card.monthly.faturamento.goal;
      acc.monthly.faturamento.actual += card.monthly.faturamento.actual;

      acc.annual.novosCambistas.goal += card.annual.novosCambistas.goal;
      acc.annual.novosCambistas.actual += card.annual.novosCambistas.actual;
      acc.annual.faturamento.goal += card.annual.faturamento.goal;
      acc.annual.faturamento.actual += card.annual.faturamento.actual;
      return acc;
    },
    {
      monthly: {
        novosCambistas: { goal: 0, actual: 0 },
        faturamento: { goal: 0, actual: 0 },
      },
      annual: {
        novosCambistas: { goal: 0, actual: 0 },
        faturamento: { goal: 0, actual: 0 },
      },
    }
  );

  totals.monthly.novosCambistas = buildKpi(
    totals.monthly.novosCambistas.goal,
    totals.monthly.novosCambistas.actual
  );
  totals.monthly.faturamento = buildKpi(
    totals.monthly.faturamento.goal,
    totals.monthly.faturamento.actual
  );
  totals.annual.novosCambistas = buildKpi(
    totals.annual.novosCambistas.goal,
    totals.annual.novosCambistas.actual
  );
  totals.annual.faturamento = buildKpi(
    totals.annual.faturamento.goal,
    totals.annual.faturamento.actual
  );

  const selectedTotals =
    viewMode === VIEW_MODES.ANNUAL ? totals.annual : totals.monthly;

  const summary = {
    totalColaboradores: cards.length,
    acima: cards.filter((card) => card.overallStatus === KPI_STATUS.ABOVE).length,
    atencao: cards.filter((card) => card.overallStatus === KPI_STATUS.WARNING).length,
    critico: cards.filter((card) => card.overallStatus === KPI_STATUS.CRITICAL).length,
    semMeta: cards.filter((card) => card.overallStatus === KPI_STATUS.NO_GOAL).length,
    topNovosCambistas:
      [...cards].sort(
        (a, b) =>
          b.selected.novosCambistas.percent - a.selected.novosCambistas.percent ||
          b.selected.novosCambistas.actual - a.selected.novosCambistas.actual
      )[0] || null,
    topFaturamento:
      [...cards].sort(
        (a, b) =>
          b.selected.faturamento.percent - a.selected.faturamento.percent ||
          b.selected.faturamento.actual - a.selected.faturamento.actual
      )[0] || null,
  };

  return {
    monthKey,
    viewMode,
    cards,
    totals,
    selectedTotals,
    summary,
  };
};
