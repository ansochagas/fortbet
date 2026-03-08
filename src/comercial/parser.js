import * as pdfjsLib from "pdfjs-dist";
import { monthKeyFromPeriod, parseNumberBR, toSlug } from "./domain";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

const normalizeText = (input) =>
  String(input || "")
    .normalize("NFKC")
    .replace(/[\u00A0\u2007\u202F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const sanitizeHeaderName = (value) =>
  String(value || "")
    .replace(/^\s*\d+\s*/, "")
    .replace(/^gerente:\s*todos\s*/i, "")
    .trim();

const moneyPattern = "-?\\s*\\d{1,3}(?:\\.\\d{3})*,\\d{2}";

const parseMoneyList = (rawBlock) =>
  Array.from(String(rawBlock || "").matchAll(new RegExp(moneyPattern, "gu"))).map((match) =>
    (match[0] || "").replace(/\s+/g, "")
  );

const parseSectionRows = (rawSection) => {
  const rowRe = new RegExp(
    `([A-Za-z\\u00C0-\\u017F0-9][A-Za-z\\u00C0-\\u017F0-9\\s._'\\-]*?)\\s+([\\d.]+)\\s+((?:R\\$\\s*${moneyPattern}\\s*){6,8})`,
    "giu"
  );
  const rows = [];

  let match;
  while ((match = rowRe.exec(rawSection)) !== null) {
    const label = String(match[1] || "").trim();
    if (!label || /^(subtotal|total)$/i.test(label)) continue;
    rows.push(label);
  }

  return rows;
};

const parseSectionTotals = (rawSection) => {
  const totalRe = new RegExp(
    `(?:Subtotal|Total)\\s+([\\d.]+)\\s+((?:R\\$\\s*${moneyPattern}\\s*){6,8})`,
    "giu"
  );

  let lastMatch = null;
  let match;

  while ((match = totalRe.exec(rawSection)) !== null) {
    lastMatch = match;
  }

  if (!lastMatch) {
    return {
      totalApostas: 0,
      entradas: 0,
      saidas: 0,
      lancamentos: 0,
      cartoes: 0,
      comissao: 0,
      parcial: 0,
      liquido: 0,
    };
  }

  const moneyValues = parseMoneyList(lastMatch[2]);
  const [
    entradas = "0,00",
    saidas = "0,00",
    lancamentos = "0,00",
    cartoes = "0,00",
    comissao = "0,00",
    parcial = "0,00",
    liquido = "0,00",
  ] = moneyValues;

  return {
    totalApostas: Number(String(lastMatch[1] || "0").replace(/[^\d]/g, "")) || 0,
    entradas: parseNumberBR(entradas),
    saidas: parseNumberBR(saidas),
    lancamentos: parseNumberBR(lancamentos),
    cartoes: parseNumberBR(cartoes),
    comissao: parseNumberBR(comissao),
    parcial: parseNumberBR(parcial),
    liquido: parseNumberBR(liquido),
  };
};

export const parseCommercialPdfText = (rawText) => {
  const text = normalizeText(rawText);
  if (!text) {
    return {
      periodLabel: "",
      monthKey: "",
      sections: [],
    };
  }

  const headerRe = new RegExp(
    "([A-Za-z\\u00C0-\\u017F0-9\\s._'\\-]{2,80}?)\\s*\\/\\s*Comiss(?:\\u00E3o|ao)\\s*R\\$\\s*(-?\\s*\\d{1,3}(?:\\.\\d{3})*,\\d{2})",
    "giu"
  );

  const headers = [];
  for (const match of text.matchAll(headerRe)) {
    const name = sanitizeHeaderName(match[1]);
    if (!name) continue;
    headers.push({
      index: match.index ?? 0,
      rawName: name,
      comissao: (match[2] || "").replace(/\s+/g, ""),
    });
  }

  if (headers.length === 0) {
    return {
      periodLabel: "",
      monthKey: "",
      sections: [],
    };
  }

  const globalPeriodMatch = text.match(/Per[ií]odo:\s*(\d{2}\/\d{2}\/\d{4}\s+à\s+\d{2}\/\d{2}\/\d{4})/iu);
  const globalPeriodLabel = globalPeriodMatch ? globalPeriodMatch[1] : "";
  const sections = [];

  headers.forEach((header, index) => {
    const start = header.index;
    const end = index + 1 < headers.length ? headers[index + 1].index : text.length;
    const section = text.slice(start, end).trim();
    const periodMatch = section.match(
      /Per[ií]odo:\s*(\d{2}\/\d{2}\/\d{4}\s+à\s+\d{2}\/\d{2}\/\d{4})/iu
    );
    const periodLabel = periodMatch ? periodMatch[1] : globalPeriodLabel;
    const totals = parseSectionTotals(section);
    const rows = parseSectionRows(section);

    sections.push({
      rawName: header.rawName,
      comissao: parseNumberBR(header.comissao),
      periodLabel,
      monthKey: monthKeyFromPeriod(periodLabel),
      cambistasCount: rows.length,
      rows,
      ...totals,
    });
  });

  return {
    periodLabel: globalPeriodLabel,
    monthKey: sections.find((section) => section.monthKey)?.monthKey || monthKeyFromPeriod(globalPeriodLabel),
    sections,
  };
};

export const parseCommercialPdfFile = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = "";

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    text += `${textContent.items.map((item) => item.str).join(" ")}\n`;
  }

  return parseCommercialPdfText(text);
};

export const buildImportRecords = ({ parsed, fileName, resolveCollaborator }) => {
  const sections = Array.isArray(parsed?.sections) ? parsed.sections : [];
  const importedAt = new Date().toISOString();
  const grouped = new Map();

  sections.forEach((section) => {
    const resolved = resolveCollaborator ? resolveCollaborator(section.rawName) : null;
    const collaboratorId = resolved?.id || `pdf-${toSlug(section.rawName)}`;
    const displayName = resolved?.name || section.rawName;
    const current = grouped.get(collaboratorId) || {
      collaboratorId,
      displayName,
      gerenciaPdf: section.rawName,
      aliasNames: [],
      faturamentoRealizado: 0,
      cambistasCount: 0,
      importedAt,
      fileName,
      periodLabel: section.periodLabel || parsed?.periodLabel || "",
      year: 0,
      month: 0,
    };

    current.faturamentoRealizado += Number(section.entradas || 0);
    current.cambistasCount += Number(section.cambistasCount || 0);
    current.periodLabel = current.periodLabel || section.periodLabel || "";
    if (!current.aliasNames.includes(section.rawName)) {
      current.aliasNames.push(section.rawName);
    }

    grouped.set(collaboratorId, current);
  });

  const monthKey = parsed?.monthKey || "";
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number(yearRaw) || 0;
  const month = Number(monthRaw) || 0;

  const entries = Array.from(grouped.values()).map((entry) => ({
    ...entry,
    year,
    month,
  }));

  return {
    monthKey,
    entries,
  };
};
