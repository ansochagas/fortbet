export const VIEW_MODES = {
  MONTHLY: "monthly",
  ANNUAL: "annual",
};

export const KPI_STATUS = {
  ABOVE: "acima",
  WARNING: "atencao",
  CRITICAL: "critico",
  NO_GOAL: "sem_meta",
};

export const MANAGER_ROLE = "gerente";

export const normalizeName = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const toSlug = (value, fallback = "colaborador") => {
  const normalized = normalizeName(value).replace(/\s+/g, "-");
  return normalized || fallback;
};

export const formatMonthKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

export const splitMonthKey = (monthKey) => {
  const [yearRaw, monthRaw] = String(monthKey || formatMonthKey()).split("-");
  const year = Number(yearRaw) || new Date().getFullYear();
  const month = Number(monthRaw) || new Date().getMonth() + 1;
  return { year, month };
};

export const monthKeyFromPeriod = (periodLabel) => {
  const match = String(periodLabel || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return "";
  const [, , mm, yyyy] = match;
  return `${yyyy}-${mm}`;
};

export const formatMonthLabel = (monthKey) => {
  const { year, month } = splitMonthKey(monthKey);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString("pt-BR", {
    month: "long",
    year: "numeric",
  });
};

export const formatCurrencyBR = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const formatNumberBR = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

export const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

export const parseNumberBR = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  const normalized = String(value)
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(/,/, ".")
    .replace(/-\s+/, "-")
    .replace(/[^\d.-]/g, "");
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const ratioToStatus = (ratio) => {
  if (ratio >= 1) return KPI_STATUS.ABOVE;
  if (ratio >= 0.8) return KPI_STATUS.WARNING;
  return KPI_STATUS.CRITICAL;
};

export const statusPriority = {
  [KPI_STATUS.CRITICAL]: 0,
  [KPI_STATUS.WARNING]: 1,
  [KPI_STATUS.ABOVE]: 2,
  [KPI_STATUS.NO_GOAL]: 3,
};

export const getStatusMeta = (status) => {
  switch (status) {
    case KPI_STATUS.ABOVE:
      return {
        label: "Acima da Meta",
        badgeClass:
          "bg-emerald-500/15 text-emerald-700 border border-emerald-500/20",
        ringClass: "ring-emerald-300/50",
        progressClass: "from-emerald-500 to-emerald-300",
      };
    case KPI_STATUS.WARNING:
      return {
        label: "Em atencao",
        badgeClass:
          "bg-amber-400/20 text-amber-800 border border-amber-500/30",
        ringClass: "ring-amber-300/50",
        progressClass: "from-amber-500 to-orange-300",
      };
    case KPI_STATUS.NO_GOAL:
      return {
        label: "Sem meta",
        badgeClass: "bg-slate-300/30 text-slate-700 border border-slate-300/60",
        ringClass: "ring-slate-300/50",
        progressClass: "from-slate-400 to-slate-300",
      };
    default:
      return {
        label: "Critico",
        badgeClass: "bg-rose-500/15 text-rose-700 border border-rose-500/20",
        ringClass: "ring-rose-300/50",
        progressClass: "from-rose-500 to-red-300",
      };
  }
};

export const initialsFromName = (value) => {
  const parts = String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "--";
  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
};
