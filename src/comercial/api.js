const STORAGE_KEYS = {
  imported: "fortbet_comercial_results_v1",
  monthly: "fortbet_comercial_monthly_config_v1",
  annual: "fortbet_comercial_annual_config_v1",
  onlineRegistry: "fortbet_comercial_online_registry_v1",
  onlineSnapshots: "fortbet_comercial_online_snapshots_v1",
};

const API_BASE =
  typeof window !== "undefined" ? import.meta.env.VITE_COMERCIAL_API_URL || "" : "";
const API_TOKEN =
  typeof window !== "undefined" ? import.meta.env.VITE_COMERCIAL_API_TOKEN || "" : "";

const readLocal = (key) => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("[FORTBET][comercial] erro ao ler armazenamento local", err);
    return [];
  }
};

const writeLocal = (key, value) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn("[FORTBET][comercial] erro ao salvar armazenamento local", err);
  }
};

const requestRemote = async (path, options = {}) => {
  if (!API_BASE) return null;
  const url = `${API_BASE.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
};

export const hasRemoteCommercialApi = Boolean(API_BASE);

export const getImportedResultsForMonth = async (year, month) => {
  if (API_BASE) {
    try {
      return (await requestRemote(`/results?year=${year}&month=${month}`)) || [];
    } catch (err) {
      console.warn("[FORTBET][comercial] falha remoto, usando local", err);
    }
  }

  return readLocal(STORAGE_KEYS.imported).filter(
    (entry) => Number(entry.year) === Number(year) && Number(entry.month) === Number(month)
  );
};

export const getImportedResultsForYear = async (year) => {
  if (API_BASE) {
    try {
      return (await requestRemote(`/results?year=${year}`)) || [];
    } catch (err) {
      console.warn("[FORTBET][comercial] falha remoto, usando local", err);
    }
  }

  return readLocal(STORAGE_KEYS.imported).filter(
    (entry) => Number(entry.year) === Number(year)
  );
};

export const replaceImportedResultsForMonth = async (year, month, entries) => {
  const payload = Array.isArray(entries) ? entries : [];

  if (API_BASE) {
    try {
      await requestRemote(`/results`, {
        method: "PUT",
        body: JSON.stringify({ year, month, entries: payload }),
      });
      return payload;
    } catch (err) {
      console.warn("[FORTBET][comercial] falha remoto, usando local", err);
    }
  }

  const current = readLocal(STORAGE_KEYS.imported).filter(
    (entry) => !(Number(entry.year) === Number(year) && Number(entry.month) === Number(month))
  );
  writeLocal(STORAGE_KEYS.imported, [...current, ...payload]);
  return payload;
};

export const getMonthlyConfigForMonth = async (year, month) => {
  if (API_BASE) {
    try {
      return (await requestRemote(`/monthly-config?year=${year}&month=${month}`)) || [];
    } catch (err) {
      console.warn("[FORTBET][comercial] falha remoto, usando local", err);
    }
  }

  return readLocal(STORAGE_KEYS.monthly).filter(
    (entry) => Number(entry.year) === Number(year) && Number(entry.month) === Number(month)
  );
};

export const getMonthlyConfigForYear = async (year) => {
  if (API_BASE) {
    try {
      return (await requestRemote(`/monthly-config?year=${year}`)) || [];
    } catch (err) {
      console.warn("[FORTBET][comercial] falha remoto, usando local", err);
    }
  }

  return readLocal(STORAGE_KEYS.monthly).filter(
    (entry) => Number(entry.year) === Number(year)
  );
};

export const saveMonthlyConfigForMonth = async (year, month, entries) => {
  const payload = Array.isArray(entries) ? entries : [];

  if (API_BASE) {
    try {
      await requestRemote(`/monthly-config`, {
        method: "PUT",
        body: JSON.stringify({ year, month, entries: payload }),
      });
      return payload;
    } catch (err) {
      console.warn("[FORTBET][comercial] falha remoto, usando local", err);
    }
  }

  const current = readLocal(STORAGE_KEYS.monthly).filter(
    (entry) => !(Number(entry.year) === Number(year) && Number(entry.month) === Number(month))
  );
  writeLocal(STORAGE_KEYS.monthly, [...current, ...payload]);
  return payload;
};

export const getAnnualConfigForYear = async (year) => {
  if (API_BASE) {
    try {
      return (await requestRemote(`/annual-config?year=${year}`)) || [];
    } catch (err) {
      console.warn("[FORTBET][comercial] falha remoto, usando local", err);
    }
  }

  return readLocal(STORAGE_KEYS.annual).filter(
    (entry) => Number(entry.year) === Number(year)
  );
};

export const saveAnnualConfigForYear = async (year, entries) => {
  const payload = Array.isArray(entries) ? entries : [];

  if (API_BASE) {
    try {
      await requestRemote(`/annual-config`, {
        method: "PUT",
        body: JSON.stringify({ year, entries: payload }),
      });
      return payload;
    } catch (err) {
      console.warn("[FORTBET][comercial] falha remoto, usando local", err);
    }
  }

  const current = readLocal(STORAGE_KEYS.annual).filter(
    (entry) => Number(entry.year) !== Number(year)
  );
  writeLocal(STORAGE_KEYS.annual, [...current, ...payload]);
  return payload;
};

export const getOnlineCambistaRegistry = async () => readLocal(STORAGE_KEYS.onlineRegistry);

export const saveOnlineCambistaRegistry = async (entries) => {
  const payload = Array.isArray(entries) ? entries : [];
  writeLocal(STORAGE_KEYS.onlineRegistry, payload);
  return payload;
};

export const getOnlineSnapshots = async () => readLocal(STORAGE_KEYS.onlineSnapshots);

export const appendOnlineSnapshot = async (snapshot) => {
  const current = readLocal(STORAGE_KEYS.onlineSnapshots);
  const next = [snapshot, ...current].slice(0, 120);
  writeLocal(STORAGE_KEYS.onlineSnapshots, next);
  return next;
};

export const getOnlineSyncStatus = async () => {
  if (!API_BASE) return null;
  return requestRemote(`/sync-status`);
};

export const runOnlineSyncNow = async () => {
  if (!API_BASE) return null;
  return requestRemote(`/sync-now`, {
    method: "POST",
    body: JSON.stringify({}),
  });
};
