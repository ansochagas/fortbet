// Mock de "backend" local para persistir snapshot/estados.
// Facilita migrar para um backend real no futuro mantendo a mesma API assíncrona.

const saveLocal = (key, value) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn("[FORTBET][persist] erro ao salvar", err);
  }
};

const loadLocal = (key) => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("[FORTBET][persist] erro ao ler", err);
    return null;
  }
};

export const saveSnapshotLocal = async (key, snapshot) => {
  saveLocal(key, snapshot);
  return { ok: true, savedAt: new Date().toISOString() };
};

export const loadSnapshotLocal = async (key) => {
  return loadLocal(key);
};

export const clearSnapshotLocal = async (key) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
    return { ok: true };
  } catch (err) {
    console.warn("[FORTBET][persist] erro ao limpar", err);
    return { ok: false, error: err };
  }
};

// Facade para futuro backend. Hoje usa apenas localStorage.
const BACKEND_KEY = "fortbet_snapshot_backend";
const SNAPSHOT_URL =
  typeof window !== "undefined" ? import.meta.env.VITE_SNAPSHOT_URL : null;
const SNAPSHOT_TOKEN =
  typeof window !== "undefined" ? import.meta.env.VITE_SNAPSHOT_TOKEN : null;
const SNAPSHOT_IS_LOCAL_BACKEND = SNAPSHOT_URL && SNAPSHOT_URL.startsWith("local:");
const SNAPSHOT_LOCAL_KEY = SNAPSHOT_IS_LOCAL_BACKEND
  ? `fortbet_snapshot_${SNAPSHOT_URL.replace(/[^a-z0-9_-]/gi, "_")}`
  : BACKEND_KEY;

export const saveSnapshot = async (snapshot) => {
  // Se houver URL configurada, tenta enviar via fetch POST
  if (SNAPSHOT_URL) {
    if (SNAPSHOT_IS_LOCAL_BACKEND) {
      return saveSnapshotLocal(SNAPSHOT_LOCAL_KEY, snapshot);
    }
    try {
      const res = await fetch(SNAPSHOT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(SNAPSHOT_TOKEN ? { Authorization: `Bearer ${SNAPSHOT_TOKEN}` } : {}),
        },
        body: JSON.stringify(snapshot),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const savedAt = res.headers.get("x-snapshot-saved-at") || new Date().toISOString();
      return { ok: true, savedAt, remote: true };
    } catch (err) {
      console.warn("[FORTBET][persist] falha ao salvar remoto, caindo para local", err);
    }
  }
  return saveSnapshotLocal(BACKEND_KEY, snapshot);
};

export const loadSnapshot = async () => {
  if (SNAPSHOT_URL) {
    if (SNAPSHOT_IS_LOCAL_BACKEND) {
      return loadSnapshotLocal(SNAPSHOT_LOCAL_KEY);
    }
    try {
      const res = await fetch(SNAPSHOT_URL, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(SNAPSHOT_TOKEN ? { Authorization: `Bearer ${SNAPSHOT_TOKEN}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      data._ts = data?._ts || res.headers.get("x-snapshot-saved-at") || "";
      return data;
    } catch (err) {
      console.warn("[FORTBET][persist] falha ao ler remoto, caindo para local", err);
    }
  }
  return loadSnapshotLocal(BACKEND_KEY);
};

export const clearSnapshot = async () => {
  if (SNAPSHOT_URL) {
    if (SNAPSHOT_IS_LOCAL_BACKEND) {
      return clearSnapshotLocal(SNAPSHOT_LOCAL_KEY);
    }
    try {
      const res = await fetch(SNAPSHOT_URL, {
        method: "DELETE",
        headers: {
          ...(SNAPSHOT_TOKEN ? { Authorization: `Bearer ${SNAPSHOT_TOKEN}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { ok: true, remote: true };
    } catch (err) {
      console.warn("[FORTBET][persist] falha ao limpar remoto, caindo para local", err);
    }
  }
  return clearSnapshotLocal(BACKEND_KEY);
};
