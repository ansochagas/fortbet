import http from "node:http";
import { URL } from "node:url";
import { loadState, resolveDbPath, saveState } from "./comercial-db.mjs";
import { fetchMonacoCaixaVendedor } from "./monaco-client.mjs";
import { applyOnlineSnapshotToState } from "./sync-engine.mjs";

const port = Number(process.env.PORT || process.env.COMERCIAL_PORT || 8787);
const host = process.env.COMERCIAL_HOST || "0.0.0.0";
const apiBase = (process.env.COMERCIAL_API_BASE || "/api/comercial").replace(/\/+$/, "");
const apiToken = String(process.env.COMERCIAL_API_TOKEN || "").trim();
const corsOriginRaw = String(process.env.COMERCIAL_CORS_ORIGIN || "*");
const corsAllowedOrigins = corsOriginRaw
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const corsAllowAny = corsAllowedOrigins.includes("*");
const syncIntervalMinutes = Number(process.env.COMERCIAL_SYNC_INTERVAL_MINUTES || 30);
const syncOnStartup = process.env.COMERCIAL_SYNC_ON_STARTUP !== "0";
const syncTimeZone = process.env.COMERCIAL_SYNC_TIMEZONE || "America/Fortaleza";
const dbPath = resolveDbPath();

const state = loadState(dbPath);
state.sync.intervalMinutes = syncIntervalMinutes;

const isOriginAllowed = (origin) => {
  const value = String(origin || "").trim();
  if (!value) return true;
  if (corsAllowAny) return true;
  return corsAllowedOrigins.includes(value);
};

const resolveAllowOrigin = (origin) => {
  const value = String(origin || "").trim();
  if (corsAllowAny) return "*";
  if (!value) return corsAllowedOrigins[0] || "";
  return corsAllowedOrigins.includes(value) ? value : "";
};

const buildCorsHeaders = (req) => {
  const origin = req?.headers?.origin || "";
  const allowOrigin = resolveAllowOrigin(origin);
  const headers = {
    "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-max-age": "86400",
  };

  if (allowOrigin) {
    headers["access-control-allow-origin"] = allowOrigin;
  }
  if (!corsAllowAny) {
    headers.vary = "Origin";
  }

  return headers;
};

const sendJson = (req, res, statusCode, payload = {}) => {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...buildCorsHeaders(req),
  });
  res.end(JSON.stringify(payload));
};

const sendNoContent = (req, res, statusCode = 204) => {
  res.writeHead(statusCode, {
    ...buildCorsHeaders(req),
  });
  res.end();
};

const parseBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("JSON invalido no body."));
      }
    });
    req.on("error", reject);
  });

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isIsoDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

const toIsoDateInZone = (date = new Date(), timeZone = "America/Fortaleza") => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value || "1970";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
};

const monthDaysUntil = (todayIso) => {
  if (!isIsoDay(todayIso)) return [];
  const [year, month, dayRaw] = String(todayIso).split("-");
  const day = Number(dayRaw) || 1;
  const days = [];
  for (let current = 1; current <= day; current += 1) {
    days.push(`${year}-${month}-${String(current).padStart(2, "0")}`);
  }
  return days;
};

const withYearMonth = (entries, year, month) =>
  (Array.isArray(entries) ? entries : []).map((entry) => ({
    ...entry,
    year: toNumber(year),
    month: toNumber(month),
  }));

const withYear = (entries, year) =>
  (Array.isArray(entries) ? entries : []).map((entry) => ({
    ...entry,
    year: toNumber(year),
  }));

const filterByYearMonth = (entries, year, month) =>
  (entries || []).filter((entry) => {
    const sameYear = !year || Number(entry?.year) === Number(year);
    const sameMonth = !month || Number(entry?.month) === Number(month);
    return sameYear && sameMonth;
  });

const isPublicRoute = (pathname, method) =>
  pathname === `${apiBase}/health` && method === "GET";

const isAuthorized = (req) => {
  if (!apiToken) return true;
  const header = String(req.headers.authorization || "").trim();
  return header === `Bearer ${apiToken}`;
};

let syncPromise = null;

const runSync = async (trigger) => {
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    const startedAt = new Date().toISOString();
    state.sync.running = true;
    state.sync.lastRunAt = startedAt;
    state.sync.lastTrigger = trigger;
    saveState(dbPath, state);

    try {
      const login = process.env.MONACO_LOGIN || "";
      const senha = process.env.MONACO_SENHA || "";
      const baseUrl = process.env.MONACO_BASE_URL || "https://monacoloterias.ddns.net";
      const areaOwnersRaw = process.env.COMERCIAL_AREA_OWNERS_JSON || "";

      if (!login || !senha) {
        throw new Error("Credenciais MONACO_LOGIN e MONACO_SENHA nao configuradas.");
      }
      const todayIso = toIsoDateInZone(new Date(), syncTimeZone);
      const currentMonthKey = todayIso.slice(0, 7);
      const syncedMonthDays = new Set(
        (state.onlineSnapshots || [])
          .filter(
            (entry) =>
              entry?.source === "monaco-auto-sync" &&
              String(entry?.monthKey || "") === currentMonthKey &&
              isIsoDay(entry?.snapshotDate)
          )
          .map((entry) => String(entry.snapshotDate))
      );
      const missingMonthDays = monthDaysUntil(todayIso).filter((day) => !syncedMonthDays.has(day));
      const syncDays = Array.from(new Set([...missingMonthDays, todayIso])).sort();

      let summary = null;
      for (const syncDay of syncDays) {
        const fetched = await fetchMonacoCaixaVendedor({
          baseUrl,
          login,
          senha,
          snapshotDate: syncDay,
          timeZone: syncTimeZone,
        });

        summary = applyOnlineSnapshotToState({
          state,
          rows: fetched.rows,
          snapshotDate: fetched.snapshotDate,
          fetchedAt: fetched.fetchedAt,
          areaOwnersRaw,
          source: "monaco-auto-sync",
        });
      }

      if (!summary) {
        throw new Error("Nenhum dia valido foi sincronizado.");
      }

      state.sync.running = false;
      state.sync.lastSuccessAt = new Date().toISOString();
      state.sync.lastError = "";
      state.sync.lastStats = {
        ...summary,
        syncedDays: syncDays.length,
        backfilledDays: Math.max(syncDays.length - 1, 0),
      };
      saveState(dbPath, state);
      return state.sync.lastStats;
    } catch (error) {
      state.sync.running = false;
      state.sync.lastError = error?.message || "Falha desconhecida na sincronizacao.";
      saveState(dbPath, state);
      throw error;
    }
  })().finally(() => {
    syncPromise = null;
  });

  return syncPromise;
};

const scheduler = () => {
  if (syncOnStartup) {
    runSync("startup").catch((error) => {
      console.error("[comercial-backend] erro no sync inicial:", error?.message || error);
    });
  }

  if (syncIntervalMinutes > 0) {
    setInterval(() => {
      runSync("interval").catch((error) => {
        console.error("[comercial-backend] erro no sync agendado:", error?.message || error);
      });
    }, syncIntervalMinutes * 60 * 1000);
  }
};

const handler = async (req, res) => {
  if (req.method === "OPTIONS") {
    if (!isOriginAllowed(req.headers.origin)) {
      sendJson(req, res, 403, { error: "Origin nao permitido." });
      return;
    }
    sendNoContent(req, res, 204);
    return;
  }

  if (!isOriginAllowed(req.headers.origin)) {
    sendJson(req, res, 403, { error: "Origin nao permitido." });
    return;
  }

  try {
    const fullUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = fullUrl.pathname.replace(/\/+$/, "") || "/";
    const query = fullUrl.searchParams;

    if (!isPublicRoute(pathname, req.method) && !isAuthorized(req)) {
      sendJson(req, res, 401, { error: "Nao autorizado." });
      return;
    }

    if (pathname === `${apiBase}/health` && req.method === "GET") {
      sendJson(req, res, 200, {
        ok: true,
        now: new Date().toISOString(),
        apiBase,
        dbPath,
      });
      return;
    }

    if (pathname === `${apiBase}/results`) {
      if (req.method === "GET") {
        const year = toNumber(query.get("year"));
        const month = toNumber(query.get("month"));
        sendJson(req, res, 200, filterByYearMonth(state.importedResults, year, month));
        return;
      }

      if (req.method === "PUT") {
        const body = await parseBody(req);
        const year = toNumber(body?.year);
        const month = toNumber(body?.month);
        const payload = withYearMonth(body?.entries, year, month);

        state.importedResults = [
          ...state.importedResults.filter(
            (entry) => !(Number(entry?.year) === year && Number(entry?.month) === month)
          ),
          ...payload,
        ];
        saveState(dbPath, state);
        sendJson(req, res, 200, payload);
        return;
      }
    }

    if (pathname === `${apiBase}/monthly-config`) {
      if (req.method === "GET") {
        const year = toNumber(query.get("year"));
        const month = toNumber(query.get("month"));
        sendJson(req, res, 200, filterByYearMonth(state.monthlyConfig, year, month));
        return;
      }

      if (req.method === "PUT") {
        const body = await parseBody(req);
        const year = toNumber(body?.year);
        const month = toNumber(body?.month);
        const payload = withYearMonth(body?.entries, year, month);

        state.monthlyConfig = [
          ...state.monthlyConfig.filter(
            (entry) => !(Number(entry?.year) === year && Number(entry?.month) === month)
          ),
          ...payload,
        ];
        saveState(dbPath, state);
        sendJson(req, res, 200, payload);
        return;
      }
    }

    if (pathname === `${apiBase}/annual-config`) {
      if (req.method === "GET") {
        const year = toNumber(query.get("year"));
        sendJson(
          req,
          res,
          200,
          (state.annualConfig || []).filter((entry) =>
            year ? Number(entry?.year) === year : true
          )
        );
        return;
      }

      if (req.method === "PUT") {
        const body = await parseBody(req);
        const year = toNumber(body?.year);
        const payload = withYear(body?.entries, year);

        state.annualConfig = [
          ...state.annualConfig.filter((entry) => Number(entry?.year) !== year),
          ...payload,
        ];
        saveState(dbPath, state);
        sendJson(req, res, 200, payload);
        return;
      }
    }

    if (pathname === `${apiBase}/sync-status` && req.method === "GET") {
      sendJson(req, res, 200, {
        ...state.sync,
        intervalMinutes: syncIntervalMinutes,
      });
      return;
    }

    if (pathname === `${apiBase}/sync-now` && req.method === "POST") {
      const summary = await runSync("manual");
      sendJson(req, res, 200, summary);
      return;
    }

    sendJson(req, res, 404, { error: "Rota nao encontrada." });
  } catch (error) {
    sendJson(req, res, 500, { error: error?.message || "Erro interno no backend comercial." });
  }
};

const server = http.createServer((req, res) => {
  handler(req, res);
});

server.listen(port, host, () => {
  console.log(`[comercial-backend] online em http://${host}:${port}${apiBase}`);
  console.log(`[comercial-backend] banco: ${dbPath}`);
  console.log(`[comercial-backend] intervalo: ${syncIntervalMinutes} minutos`);
  console.log(
    `[comercial-backend] auth token: ${apiToken ? "habilitado" : "desabilitado"} | cors: ${corsOriginRaw}`
  );
  scheduler();
});
