import { normalizeName, parseNumberBR, splitMonthKey } from "./domain";
import {
  buildAreaOwnerIndex,
  DEFAULT_AREA_OWNERS,
  normalizeAreaCode,
  normalizeAreaToken,
  resolveAreaOwner,
} from "./areaOwnership";
import { canonicalCollaboratorId, isCommercialCollaboratorId } from "./registry";

const toIsoDay = (value, fallback = new Date()) => {
  if (!value) return fallback.toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback.toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
};

const monthFromDay = (isoDay) => {
  const [year, month] = String(isoDay || "").split("-");
  return `${year || new Date().getFullYear()}-${month || String(new Date().getMonth() + 1).padStart(2, "0")}`;
};

const parseCurrency = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  return parseNumberBR(value);
};

const dedupe = (items) => Array.from(new Set((items || []).filter(Boolean)));

const hasAutoNovosValue = (entry) =>
  entry && Object.prototype.hasOwnProperty.call(entry, "novosCambistasAuto");

const buildCambistaKey = (areaToken, vendedor) => {
  const normalizedName = normalizeName(vendedor);
  if (!normalizedName) return "";
  return `${areaToken}::${normalizedName}`;
};

const parseRowsFromPayload = (payload) => {
  const rawRows = Array.isArray(payload) ? payload : payload?.rows;
  if (!Array.isArray(rawRows)) return [];

  return rawRows
    .map((row) => {
      const areaRaw = String(row?.areaRaw ?? row?.area ?? row?.areaCode ?? "").trim();
      const areaCode = normalizeAreaCode(row?.areaCode || areaRaw);
      const areaToken = areaCode || normalizeAreaToken(areaRaw) || "sem-area";
      const vendedor = String(row?.vendedor ?? row?.nome ?? "").trim();
      const vendido = parseCurrency(row?.vendido ?? row?.vendidoRaw);

      if (!vendedor) return null;
      return {
        areaRaw: areaRaw || areaCode || areaToken,
        areaCode: areaCode || areaToken,
        areaToken,
        vendedor,
        vendido,
      };
    })
    .filter(Boolean);
};

const readCollaboratorFromOwner = (ownerName, resolveCollaborator) => {
  if (!ownerName) return null;
  return resolveCollaborator ? resolveCollaborator(ownerName) : null;
};

const calculateMonthlyNewByCollaborator = (registryItems, monthKey) => {
  const counters = new Map();

  (registryItems || []).forEach((item) => {
    if (item?.firstSeenMonth !== monthKey) return;
    const id = item?.ownerCollaboratorId;
    if (!id) return;
    counters.set(id, (counters.get(id) || 0) + 1);
  });

  return counters;
};

const mergeImportedEntry = (current, next) => {
  if (!current) return { ...next };
  const currentDate = new Date(current?.importedAt || 0).getTime();
  const nextDate = new Date(next?.importedAt || 0).getTime();
  const preferred = nextDate >= currentDate ? next : current;
  const fallback = preferred === next ? current : next;

  return {
    ...fallback,
    ...preferred,
    collaboratorId: canonicalCollaboratorId(preferred?.collaboratorId || fallback?.collaboratorId),
    aliasNames: dedupe([...(fallback?.aliasNames || []), ...(preferred?.aliasNames || [])]),
    cambistasCount: Number(preferred?.cambistasCount || fallback?.cambistasCount || 0),
  };
};

export const applyOnlinePayload = ({
  payload,
  existingMonthEntries = [],
  existingRegistry = [],
  areaOwners = DEFAULT_AREA_OWNERS,
  resolveCollaborator,
  importedAt = new Date().toISOString(),
}) => {
  const rows = parseRowsFromPayload(payload);
  if (!rows.length) {
    throw new Error("Nenhuma linha valida foi encontrada no snapshot online.");
  }

  const snapshotDate = toIsoDay(payload?.snapshotDate || payload?.date || payload?.data);
  const monthKey = monthFromDay(snapshotDate);
  const { year, month } = splitMonthKey(monthKey);

  const registryMap = new Map();
  (existingRegistry || []).forEach((item) => {
    if (!item?.key) return;
    registryMap.set(item.key, {
      ...item,
      ownerCollaboratorId: canonicalCollaboratorId(item?.ownerCollaboratorId),
    });
  });

  const ownerIndex = buildAreaOwnerIndex(areaOwners);
  const bootstrapBaseline = existingRegistry.length === 0;
  const collaboratorStats = new Map();
  let totalNovosNoDia = 0;
  let totalRowsConsiderados = 0;
  let totalVendidoConsiderado = 0;

  rows.forEach((row) => {
    const ownerName = resolveAreaOwner({
      areaRaw: row.areaRaw,
      areaCode: row.areaCode,
      areaOwners: ownerIndex,
    });
    const resolvedOwner = readCollaboratorFromOwner(ownerName, resolveCollaborator);
    if (!resolvedOwner) return;

    const collaboratorId = canonicalCollaboratorId(resolvedOwner.id);
    if (!isCommercialCollaboratorId(collaboratorId)) return;
    const collaboratorName = resolvedOwner.name || ownerName;
    const key = buildCambistaKey(row.areaToken, row.vendedor);
    if (!key) return;
    totalRowsConsiderados += 1;
    totalVendidoConsiderado += Number(row.vendido || 0);

    const existing = registryMap.get(key);
    if (!existing && !bootstrapBaseline) {
      totalNovosNoDia += 1;
    }

    registryMap.set(key, {
      key,
      vendedorNome: row.vendedor,
      areaCode: row.areaCode,
      areaRaw: row.areaRaw,
      ownerCollaboratorId: collaboratorId,
      ownerDisplayName: collaboratorName,
      firstSeenAt: existing?.firstSeenAt || importedAt,
      firstSeenDate: existing?.firstSeenDate || snapshotDate,
      firstSeenMonth: existing?.firstSeenMonth || (bootstrapBaseline ? "baseline" : monthKey),
      isBaseline: existing?.isBaseline ?? bootstrapBaseline,
      lastSeenAt: importedAt,
      lastSeenDate: snapshotDate,
      lastSeenMonth: monthKey,
    });

    const current = collaboratorStats.get(collaboratorId) || {
      collaboratorId,
      displayName: collaboratorName,
      soldTotal: 0,
      activeKeys: new Set(),
      areaCodes: new Set(),
    };

    current.soldTotal += Number(row.vendido || 0);
    current.activeKeys.add(key);
    current.areaCodes.add(row.areaCode || row.areaRaw);

    collaboratorStats.set(collaboratorId, current);
  });

  const registry = Array.from(registryMap.values()).sort((a, b) =>
    String(a?.vendedorNome || "").localeCompare(String(b?.vendedorNome || ""), "pt-BR")
  );

  const monthlyNewByCollaborator = calculateMonthlyNewByCollaborator(registry, monthKey);
  const importedByCollaborator = new Map();
  (existingMonthEntries || []).forEach((entry) => {
    const id = canonicalCollaboratorId(entry?.collaboratorId);
    if (!id || !isCommercialCollaboratorId(id)) return;
    const current = importedByCollaborator.get(id);
    importedByCollaborator.set(
      id,
      mergeImportedEntry(current, {
        ...entry,
        collaboratorId: id,
      })
    );
  });

  collaboratorStats.forEach((stats) => {
    const previous = importedByCollaborator.get(stats.collaboratorId) || {
      collaboratorId: stats.collaboratorId,
      displayName: stats.displayName,
      year,
      month,
      faturamentoRealizado: 0,
      aliasNames: [],
      cambistasCount: 0,
    };

    importedByCollaborator.set(stats.collaboratorId, {
      ...previous,
      collaboratorId: stats.collaboratorId,
      displayName: stats.displayName || previous.displayName || "",
      year,
      month,
      aliasNames: dedupe([...(previous.aliasNames || []), ...Array.from(stats.areaCodes)]),
      cambistasCount: stats.activeKeys.size,
      novosCambistasAuto: monthlyNewByCollaborator.get(stats.collaboratorId) || 0,
      faturamentoOnlineDia: Number(stats.soldTotal || 0),
      faturamentoRealizado: Number(stats.soldTotal || 0),
      source: "monaco-cx-vendedor",
      snapshotDate,
      importedAt,
    });
  });

  const monthEntries = Array.from(importedByCollaborator.values()).map((entry) => {
    if (hasAutoNovosValue(entry)) return entry;
    return {
      ...entry,
      novosCambistasAuto: 0,
    };
  });

  const monthSummary = {
    monthKey,
    snapshotDate,
    totalRows: totalRowsConsiderados,
    totalNovosNoDia,
    totalVendidoDia: totalVendidoConsiderado,
    colaboradoresComDados: collaboratorStats.size,
    baselineInicial: bootstrapBaseline,
  };

  return {
    monthKey,
    monthEntries,
    registry,
    summary: monthSummary,
  };
};
