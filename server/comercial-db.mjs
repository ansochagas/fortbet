import fs from "node:fs";
import path from "node:path";

const defaultState = () => ({
  importedResults: [],
  monthlyConfig: [],
  annualConfig: [],
  onlineRegistry: [],
  onlineSnapshots: [],
  sync: {
    running: false,
    intervalMinutes: 30,
    lastRunAt: "",
    lastSuccessAt: "",
    lastError: "",
    lastTrigger: "",
    lastStats: null,
  },
});

export const resolveDbPath = () =>
  path.resolve(process.cwd(), process.env.COMERCIAL_DB_PATH || "server/data/comercial-db.json");

export const loadState = (dbPath) => {
  const finalPath = dbPath || resolveDbPath();
  fs.mkdirSync(path.dirname(finalPath), { recursive: true });

  if (!fs.existsSync(finalPath)) {
    const state = defaultState();
    fs.writeFileSync(finalPath, JSON.stringify(state, null, 2), "utf8");
    return state;
  }

  try {
    const raw = fs.readFileSync(finalPath, "utf8");
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      ...defaultState(),
      ...parsed,
      importedResults: Array.isArray(parsed?.importedResults) ? parsed.importedResults : [],
      monthlyConfig: Array.isArray(parsed?.monthlyConfig) ? parsed.monthlyConfig : [],
      annualConfig: Array.isArray(parsed?.annualConfig) ? parsed.annualConfig : [],
      onlineRegistry: Array.isArray(parsed?.onlineRegistry) ? parsed.onlineRegistry : [],
      onlineSnapshots: Array.isArray(parsed?.onlineSnapshots) ? parsed.onlineSnapshots : [],
      sync: {
        ...defaultState().sync,
        ...(parsed?.sync || {}),
      },
    };
  } catch {
    const state = defaultState();
    fs.writeFileSync(finalPath, JSON.stringify(state, null, 2), "utf8");
    return state;
  }
};

export const saveState = (dbPath, state) => {
  const finalPath = dbPath || resolveDbPath();
  fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  fs.writeFileSync(finalPath, JSON.stringify(state, null, 2), "utf8");
};
