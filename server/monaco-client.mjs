const normalizeText = (value) =>
  String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u00A0\u2007\u202F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const decodeHtml = (value) =>
  String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    });

const cleanCell = (value) => normalizeText(decodeHtml(value));

const parseMoney = (value) => {
  const normalized = String(value || "")
    .replace(/\s+/g, "")
    .replace(/R\$/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseHidden = (html, name) => {
  const pattern = new RegExp(`name="${name.replace(/\$/g, "\\$")}"[^>]*value="([^"]*)"`, "i");
  const match = html.match(pattern);
  return match?.[1] || "";
};

const parseSelectValue = (html, elementId) => {
  const selectMatch = html.match(
    new RegExp(`<select[^>]*id="${elementId}"[^>]*>([\\s\\S]*?)</select>`, "i")
  );
  if (!selectMatch) return "";

  const block = selectMatch[1];
  const selected = block.match(/<option[^>]*selected[^>]*value="([^"]*)"/i);
  if (selected) return selected[1];

  const first = block.match(/<option[^>]*value="([^"]*)"/i);
  return first?.[1] || "";
};

const buildCookieHeader = (jar) =>
  Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

const captureCookies = (response, jar) => {
  const fromMethod = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [];
  const rawHeader = response.headers.get("set-cookie");
  const fromRaw = rawHeader
    ? rawHeader.split(/,(?=[^;,\s]+=)/g).map((part) => part.trim()).filter(Boolean)
    : [];
  const cookieValues = [...fromMethod, ...fromRaw];

  cookieValues.forEach((raw) => {
    const base = String(raw || "").split(";")[0];
    const [name, ...rest] = base.split("=");
    if (!name) return;
    jar.set(name.trim(), rest.join("=").trim());
  });
};

const requestWithCookies = async (url, options, jar) => {
  let currentUrl = url;
  let method = String(options?.method || "GET").toUpperCase();
  let body = options?.body;
  let baseHeaders = new Headers(options?.headers || {});

  for (let redirects = 0; redirects < 8; redirects += 1) {
    const headers = new Headers(baseHeaders);
    const cookieHeader = buildCookieHeader(jar);
    if (cookieHeader) headers.set("cookie", cookieHeader);

    const response = await fetch(currentUrl, {
      ...options,
      method,
      body,
      headers,
      redirect: "manual",
    });

    captureCookies(response, jar);

    const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
    const location = response.headers.get("location");
    if (isRedirect && location) {
      currentUrl = new URL(location, currentUrl).toString();
      if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === "POST")) {
        method = "GET";
        body = undefined;
        baseHeaders = new Headers(baseHeaders);
        baseHeaders.delete("content-type");
      }
      continue;
    }

    const text = await response.text();
    return { response, text };
  }

  throw new Error("Numero maximo de redirecionamentos excedido.");
};

const toIsoDate = (date = new Date(), timeZone = "America/Fortaleza") => {
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

const parseRowsFromTable = (html) => {
  const tableMatch = html.match(
    /<table[^>]*id="ContentPlaceHolderMaster_gridviewCaixa"[^>]*>([\s\S]*?)<\/table>/i
  );
  if (!tableMatch) {
    throw new Error("Tabela ContentPlaceHolderMaster_gridviewCaixa nao encontrada.");
  }

  const rows = [];
  const rowMatches = tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);

  for (const rowMatch of rowMatches) {
    const rowHtml = rowMatch[1];
    if (/<th/i.test(rowHtml)) continue;

    const cells = Array.from(rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((m) => m[1]);
    if (cells.length < 4) continue;

    const areaRaw = cleanCell(cells[1]);
    const vendedor = cleanCell(cells[2]);
    const vendidoRaw = cleanCell(cells[3]);
    if (!areaRaw || !vendedor) continue;

    const areaCode = areaRaw.match(/\d{2}/)?.[0] || "";
    rows.push({
      areaRaw,
      areaCode,
      vendedor,
      vendidoRaw,
      vendido: parseMoney(vendidoRaw),
    });
  }

  return rows;
};

export const fetchMonacoCaixaVendedor = async ({
  baseUrl,
  login,
  senha,
  snapshotDate,
  timeZone = "America/Fortaleza",
}) => {
  const root = String(baseUrl || "https://monacoloterias.ddns.net").replace(/\/+$/, "");
  const loginUrl = `${root}/Login`;
  const caixaUrl = `${root}/CaixaVendedor`;
  const day = snapshotDate || toIsoDate(new Date(), timeZone);
  const jar = new Map();

  const { text: loginPage } = await requestWithCookies(loginUrl, { method: "GET" }, jar);

  const loginBody = new URLSearchParams();
  loginBody.set("__VIEWSTATE", parseHidden(loginPage, "__VIEWSTATE"));
  loginBody.set("__VIEWSTATEGENERATOR", parseHidden(loginPage, "__VIEWSTATEGENERATOR"));
  loginBody.set("__EVENTVALIDATION", parseHidden(loginPage, "__EVENTVALIDATION"));
  loginBody.set("usuario", login);
  loginBody.set("senha", senha);
  loginBody.set("brnLogin", "Login");

  await requestWithCookies(
    loginUrl,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: loginBody.toString(),
    },
    jar
  );

  const { text: homePage } = await requestWithCookies(`${root}/`, { method: "GET" }, jar);
  if (!/lblUsuario/i.test(homePage)) {
    throw new Error("Login no sistema Monaco nao foi confirmado.");
  }

  const { text: caixaPage } = await requestWithCookies(caixaUrl, { method: "GET" }, jar);

  const searchBody = new URLSearchParams();
  searchBody.set("__VIEWSTATE", parseHidden(caixaPage, "__VIEWSTATE"));
  searchBody.set("__VIEWSTATEGENERATOR", parseHidden(caixaPage, "__VIEWSTATEGENERATOR"));
  searchBody.set("__EVENTVALIDATION", parseHidden(caixaPage, "__EVENTVALIDATION"));
  searchBody.set("ctl00$ContentPlaceHolderMaster$data", day);
  searchBody.set("ctl00$ContentPlaceHolderMaster$dataH", "");
  searchBody.set(
    "ctl00$ContentPlaceHolderMaster$DropDownListRegiao",
    parseSelectValue(caixaPage, "ContentPlaceHolderMaster_DropDownListRegiao")
  );
  searchBody.set(
    "ctl00$ContentPlaceHolderMaster$dropDownListArea",
    parseSelectValue(caixaPage, "ContentPlaceHolderMaster_dropDownListArea")
  );
  searchBody.set(
    "ctl00$ContentPlaceHolderMaster$dropDownListVendedor",
    parseSelectValue(caixaPage, "ContentPlaceHolderMaster_dropDownListVendedor")
  );
  searchBody.set("ctl00$ContentPlaceHolderMaster$btnBuscar", "Buscar");

  const { text: resultPage } = await requestWithCookies(
    caixaUrl,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: searchBody.toString(),
    },
    jar
  );

  const rows = parseRowsFromTable(resultPage);
  return {
    baseUrl: root,
    snapshotDate: day,
    fetchedAt: new Date().toISOString(),
    rows,
  };
};
