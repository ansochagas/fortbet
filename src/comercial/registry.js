import andersonPhoto from "../../fotos colaboradores/Anderson.jpeg";
import brunoPhoto from "../../fotos colaboradores/Bruno.jpeg";
import dijePhoto from "../../fotos colaboradores/Dij\u00E9.jpeg";
import jarbasPhoto from "../../fotos colaboradores/Jarbas.jpeg";
import neutelPhoto from "../../fotos colaboradores/Neutel.jpeg";
import victorPhoto from "../../fotos colaboradores/Victor.jpeg";
import { normalizeName, toSlug } from "./domain";

export const COLLABORATOR_ID_ALIASES = Object.freeze({
  "col-torugo": "col-victor",
  "col-chefe": "col-neutel",
  "col-professor": "col-jarbas",
});

export const canonicalCollaboratorId = (value) =>
  COLLABORATOR_ID_ALIASES[String(value || "")] || String(value || "");

export const COMMERCIAL_COLLABORATORS = [
  {
    id: "col-bruninho",
    name: "Bruninho",
    photo: brunoPhoto,
    aliases: ["BRUNINHO", "00 BRUNINHO"],
  },
  {
    id: "col-bruno",
    name: "Bruno",
    photo: brunoPhoto,
    aliases: ["BRUNO", "00 BRUNO"],
  },
  {
    id: "col-dije",
    name: "Dije",
    photo: dijePhoto,
    aliases: ["DIJE", "DIJE ADM", "02 DIJE", "02 DIJE ADM"],
  },
  {
    id: "col-anderson",
    name: "Anderson",
    photo: andersonPhoto,
    aliases: ["ANDERSON", "ADM ANDERSON", "03 ANDERSON"],
  },
  {
    id: "col-neutel",
    name: "Neutel",
    photo: neutelPhoto,
    aliases: ["NEUTEL", "NEUTELMONTEIRO", "CHEFE", "04 CHEFE", "04 NEUTEL"],
  },
  {
    id: "col-victor",
    name: "Victor",
    photo: victorPhoto,
    aliases: ["VICTOR", "VITOR", "TORUGO", "06 TORUGO", "BV VICTOR BOLINHA", "06 VICTOR"],
  },
  {
    id: "col-jarbas",
    name: "Jarbas",
    photo: jarbasPhoto,
    aliases: ["JARBAS", "BV JARBAS", "07 JARBAS", "PROFESSOR", "07 PROFESSOR"],
  },
];

export const COMMERCIAL_COLLABORATOR_IDS = Object.freeze(
  new Set(COMMERCIAL_COLLABORATORS.map((entry) => entry.id))
);

export const isCommercialCollaboratorId = (value) =>
  COMMERCIAL_COLLABORATOR_IDS.has(canonicalCollaboratorId(value));

const buildNormalizedAliases = (entry) => {
  const aliases = [entry.name, ...(entry.aliases || [])];
  return aliases.map((alias) => normalizeName(alias)).filter(Boolean);
};

export const resolveCollaborator = (rawName) => {
  const normalized = normalizeName(rawName);
  if (!normalized) return null;

  let bestMatch = null;

  COMMERCIAL_COLLABORATORS.forEach((entry) => {
    const aliases = buildNormalizedAliases(entry);
    aliases.forEach((alias) => {
      const isExact = alias === normalized;
      const isLoose = !isExact && (alias.includes(normalized) || normalized.includes(alias));

      if (!isExact && !isLoose) return;

      const score = (isExact ? 1000 : 0) + alias.length;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { entry, score };
      }
    });
  });

  return bestMatch?.entry || null;
};

export const createUnknownCollaborator = (rawName) => {
  const cleanName = String(rawName || "").trim() || "Colaborador";
  return {
    id: `pdf-${toSlug(cleanName)}`,
    name: cleanName,
    photo: "",
    aliases: [cleanName],
  };
};
