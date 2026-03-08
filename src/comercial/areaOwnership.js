import { normalizeName } from "./domain";

export const DEFAULT_AREA_OWNERS = Object.freeze({
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

export const normalizeAreaCode = (rawValue) => {
  const match = String(rawValue || "").match(/\d{2}/);
  return match ? match[0] : "";
};

export const normalizeAreaToken = (rawValue) =>
  normalizeName(rawValue)
    .replace(/\s+/g, "-")
    .trim();

export const buildAreaOwnerIndex = (areaOwners = DEFAULT_AREA_OWNERS) => {
  const index = new Map();

  Object.entries(areaOwners || {}).forEach(([rawKey, rawOwner]) => {
    const owner = String(rawOwner || "").trim();
    if (!owner) return;

    const code = normalizeAreaCode(rawKey);
    const token = normalizeAreaToken(rawKey);
    if (code) index.set(`code:${code}`, owner);
    if (token) index.set(`token:${token}`, owner);
  });

  return index;
};

export const resolveAreaOwner = ({ areaRaw, areaCode, areaOwners = DEFAULT_AREA_OWNERS }) => {
  const index = areaOwners instanceof Map ? areaOwners : buildAreaOwnerIndex(areaOwners);
  const code = normalizeAreaCode(areaCode || areaRaw);
  const token = normalizeAreaToken(areaRaw || areaCode);

  if (token && index.has(`token:${token}`)) {
    return String(index.get(`token:${token}`) || "").trim();
  }
  if (code && index.has(`code:${code}`)) {
    return String(index.get(`code:${code}`) || "").trim();
  }

  return "";
};
