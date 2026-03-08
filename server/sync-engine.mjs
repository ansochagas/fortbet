const DEFAULT_AREA_OWNERS = Object.freeze({
  "00": "Bruninho",
  "00 Bruninho": "Bruninho",
  "00 Bruno": "Bruno",
  "02": "Dije",
  "02 Dije": "Dije",
  "03": "Anderson",
  "04": "Neutel",
  "04 Chefe": "Neutel",
  "04 Neutel": "Neutel",
  "06": "Victor",
  "06 Torugo": "Victor",
  "07": "Jarbas",
  "07 Professor": "Jarbas",
  "07 Jarbas": "Jarbas",
});

const OWNER_TO_COLLABORATOR = Object.freeze({
  bruninho: { id: "col-bruninho", name: "Bruninho" },
  bruno: { id: "col-bruno", name: "Bruno" },
  dije: { id: "col-dije", name: "Dije" },
  anderson: { id: "col-anderson", name: "Anderson" },
  chefe: { id: "col-neutel", name: "Neutel" },
  neutel: { id: "col-neutel", name: "Neutel" },
  torugo: { id: "col-victor", name: "Victor" },
  victor: { id: "col-victor", name: "Victor" },
  vitor: { id: "col-victor", name: "Victor" },
  professor: { id: "col-jarbas", name: "Jarbas" },
  jarbas: { id: "col-jarbas", name: "Jarbas" },
});

const COLLABORATOR_ID_ALIASES = Object.freeze({
  "col-torugo": "col-victor",
  "col-chefe": "col-neutel",
  "col-professor": "col-jarbas",
});

const canonicalCollaboratorId = (value) =>
  COLLABORATOR_ID_ALIASES[String(value || "")] || String(value || "");

const ACTIVE_COLLABORATOR_IDS = Object.freeze(
  new Set([
    "col-bruninho",
    "col-bruno",
    "col-dije",
    "col-anderson",
    "col-neutel",
    "col-victor",
    "col-jarbas",
  ])
);

const normalizeName = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeAreaCode = (value) => String(value || "").match(/\d{2}/)?.[0] || "";
const normalizeAreaToken = (value) => normalizeName(value).replace(/\s+/g, "-").trim();

const toMonthKey = (snapshotDate) => String(snapshotDate || "").slice(0, 7);

const parseOwnerMap = (raw) => {
  const normalized = {};

  Object.entries(DEFAULT_AREA_OWNERS).forEach(([key, owner]) => {
    const code = normalizeAreaCode(key);
    const token = normalizeAreaToken(key);
    if (code) normalized[`code:${code}`] = owner;
    if (token) normalized[`token:${token}`] = owner;
  });

  if (!raw) return normalized;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return normalized;

    Object.entries(parsed).forEach(([key, value]) => {
      const owner = String(value || "").trim();
      if (!owner) return;
      const code = normalizeAreaCode(key);
      const token = normalizeAreaToken(key);
      if (code) normalized[`code:${code}`] = owner;
      if (token) normalized[`token:${token}`] = owner;
    });

    return normalized;
  } catch {
    return normalized;
  }
};

const uniqueStrings = (items) => Array.from(new Set((items || []).filter(Boolean)));

const buildKey = (areaToken, vendedor) => {
  const cleanArea = String(areaToken || "").trim();
  const cleanName = normalizeName(vendedor);
  if (!cleanArea || !cleanName) return "";
  return `${cleanArea}::${cleanName}`;
};

const resolveCollaborator = (ownerName) => {
  const normalized = normalizeName(ownerName);
  const mapped = OWNER_TO_COLLABORATOR[normalized];
  if (mapped) return { ...mapped, id: canonicalCollaboratorId(mapped.id) };
  return null;
};

const readOwnerName = (ownerMap, areaCode, areaRaw, areaToken) => {
  const areaRawToken = normalizeAreaToken(areaRaw);
  if (areaRawToken && ownerMap[`token:${areaRawToken}`]) {
    return String(ownerMap[`token:${areaRawToken}`] || "").trim();
  }
  if (areaToken && ownerMap[`token:${areaToken}`]) return String(ownerMap[`token:${areaToken}`] || "").trim();
  if (areaCode && ownerMap[`code:${areaCode}`]) return String(ownerMap[`code:${areaCode}`] || "").trim();

  return "";
};

const calculateMonthlyNewByCollaborator = (registryEntries, monthKey) => {
  const map = new Map();
  (registryEntries || []).forEach((entry) => {
    if (entry?.firstSeenMonth !== monthKey) return;
    const id = entry?.ownerCollaboratorId;
    if (!id) return;
    map.set(id, (map.get(id) || 0) + 1);
  });
  return map;
};

const ensureStateShapes = (state) => {
  if (!Array.isArray(state.importedResults)) state.importedResults = [];
  if (!Array.isArray(state.onlineRegistry)) state.onlineRegistry = [];
  if (!Array.isArray(state.onlineSnapshots)) state.onlineSnapshots = [];
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
    aliasNames: uniqueStrings([...(fallback?.aliasNames || []), ...(preferred?.aliasNames || [])]),
    cambistasCount: Number(preferred?.cambistasCount || fallback?.cambistasCount || 0),
  };
};

export const applyOnlineSnapshotToState = ({
  state,
  rows,
  snapshotDate,
  fetchedAt,
  areaOwnersRaw,
  source = "monaco-caixa-vendedor",
}) => {
  ensureStateShapes(state);

  const ownerMap = parseOwnerMap(areaOwnersRaw);
  const bootstrapBaseline =
    state.onlineRegistry.length === 0 && String(process.env.COMERCIAL_BOOTSTRAP_BASELINE || "1") !== "0";
  const monthKey = toMonthKey(snapshotDate);
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number(yearRaw) || new Date().getFullYear();
  const month = Number(monthRaw) || new Date().getMonth() + 1;

  const registryMap = new Map(
    state.onlineRegistry
      .filter((entry) => entry?.key)
      .map((entry) => [
        entry.key,
        {
          ...entry,
          ownerCollaboratorId: canonicalCollaboratorId(entry?.ownerCollaboratorId),
        },
      ])
  );

  const existingMonthEntries = state.importedResults.filter(
    (entry) => Number(entry?.year) === year && Number(entry?.month) === month
  );
  const importedByCollaborator = new Map();
  existingMonthEntries
    .filter((entry) => entry?.collaboratorId)
    .forEach((entry) => {
      const id = canonicalCollaboratorId(entry.collaboratorId);
      if (!id || !ACTIVE_COLLABORATOR_IDS.has(id)) return;
      const current = importedByCollaborator.get(id);
      importedByCollaborator.set(
        id,
        mergeImportedEntry(current, {
          ...entry,
          collaboratorId: id,
        })
      );
    });

  const statsByCollaborator = new Map();
  let totalNovosNoDia = 0;
  let totalRowsValidos = 0;
  let totalVendidoDia = 0;

  (rows || []).forEach((row) => {
    const areaRaw = String(row?.areaRaw || row?.areaCode || "").trim();
    const areaCode = normalizeAreaCode(row?.areaCode || areaRaw);
    const areaToken = areaCode || normalizeAreaToken(areaRaw) || "sem-area";
    const vendedor = String(row?.vendedor || "").trim();
    if (!vendedor) return;

    const key = buildKey(areaToken, vendedor);
    if (!key) return;

    const vendido = Number(row?.vendido || 0);

    const ownerName = readOwnerName(ownerMap, areaCode, areaRaw, areaToken);
    const collaborator = resolveCollaborator(ownerName);
    if (!collaborator) return;
    const collaboratorId = canonicalCollaboratorId(collaborator.id);
    if (!ACTIVE_COLLABORATOR_IDS.has(collaboratorId)) return;
    totalRowsValidos += 1;
    totalVendidoDia += vendido;

    const existingRegistry = registryMap.get(key);
    if (!existingRegistry && !bootstrapBaseline) {
      totalNovosNoDia += 1;
    }

    registryMap.set(key, {
      key,
      vendedorNome: vendedor,
      areaCode: areaCode || areaToken,
      areaRaw: areaRaw || areaCode || areaToken,
      ownerCollaboratorId: collaboratorId,
      ownerDisplayName: collaborator.name,
      firstSeenAt: existingRegistry?.firstSeenAt || fetchedAt,
      firstSeenDate: existingRegistry?.firstSeenDate || snapshotDate,
      firstSeenMonth: existingRegistry?.firstSeenMonth || (bootstrapBaseline ? "baseline" : monthKey),
      isBaseline: existingRegistry?.isBaseline ?? bootstrapBaseline,
      lastSeenAt: fetchedAt,
      lastSeenDate: snapshotDate,
      lastSeenMonth: monthKey,
    });

    const current = statsByCollaborator.get(collaboratorId) || {
      collaboratorId,
      displayName: collaborator.name,
      soldTotal: 0,
      areaCodes: new Set(),
      activeKeys: new Set(),
    };

    current.soldTotal += Number.isFinite(vendido) ? vendido : 0;
    current.areaCodes.add(areaCode || areaRaw || areaToken);
    current.activeKeys.add(key);
    statsByCollaborator.set(collaboratorId, current);
  });

  const registryEntries = Array.from(registryMap.values()).sort((a, b) =>
    String(a?.vendedorNome || "").localeCompare(String(b?.vendedorNome || ""), "pt-BR")
  );
  const monthlyNewByCollaborator = calculateMonthlyNewByCollaborator(registryEntries, monthKey);

  statsByCollaborator.forEach((stats, collaboratorId) => {
    const previous = importedByCollaborator.get(collaboratorId) || {
      collaboratorId,
      displayName: stats.displayName,
      year,
      month,
      aliasNames: [],
      cambistasCount: 0,
      faturamentoRealizado: 0,
    };

    importedByCollaborator.set(collaboratorId, {
      ...previous,
      collaboratorId,
      displayName: stats.displayName || previous.displayName || "",
      year,
      month,
      aliasNames: uniqueStrings([...(previous.aliasNames || []), ...Array.from(stats.areaCodes)]),
      cambistasCount: stats.activeKeys.size,
      novosCambistasAuto: monthlyNewByCollaborator.get(collaboratorId) || 0,
      faturamentoOnlineDia: Number(stats.soldTotal || 0),
      faturamentoRealizado: Number(stats.soldTotal || 0),
      source,
      snapshotDate,
      importedAt: fetchedAt,
    });
  });

  importedByCollaborator.forEach((entry, collaboratorId) => {
    if (!Object.prototype.hasOwnProperty.call(entry, "novosCambistasAuto")) return;
    entry.novosCambistasAuto = monthlyNewByCollaborator.get(collaboratorId) || 0;
  });

  const nextMonthEntries = Array.from(importedByCollaborator.values());
  state.importedResults = [
    ...state.importedResults.filter(
      (entry) => !(Number(entry?.year) === year && Number(entry?.month) === month)
    ),
    ...nextMonthEntries,
  ];
  state.onlineRegistry = registryEntries;

  const snapshotSummary = {
    source,
    importedAt: fetchedAt,
    snapshotDate,
    monthKey,
    totalRows: totalRowsValidos,
    totalNovosNoDia,
    totalVendidoDia: Number(totalVendidoDia || 0),
    colaboradoresComDados: statsByCollaborator.size,
    baselineInicial: bootstrapBaseline,
  };

  state.onlineSnapshots = [snapshotSummary, ...state.onlineSnapshots].slice(0, 300);
  return snapshotSummary;
};
