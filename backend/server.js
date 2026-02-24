/**
 * Backend do app: API /api/chat e /health.
 * Serve o frontend (estático) da pasta raiz do projeto (mesmo domínio = sem CORS).
 */
const path = require("path");

// Carrega .env da raiz do projeto ou de backend/
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");

const app = express();
// Databricks Apps exige escutar em DATABRICKS_APP_PORT; local usa PORT ou 8080.
const PORT = process.env.DATABRICKS_APP_PORT || process.env.PORT || 8080;
const HOST = "0.0.0.0";

app.use(express.json());

// ---------- API ----------
// Token: KA_TOKEN, ou resource key do Secret (ka_token, secret), ou valor direto no app.yaml
const KA_ENDPOINT_URL = (process.env.KA_ENDPOINT_URL || "").trim();
const KA_TOKEN = (
  process.env.KA_TOKEN ||
  process.env.ka_token ||
  process.env.secret ||
  ""
).trim();

function isKAConfigured() {
  return !!KA_ENDPOINT_URL && !!KA_TOKEN;
}

function getConfigError() {
  const missing = [];
  if (!KA_ENDPOINT_URL) missing.push("KA_ENDPOINT_URL");
  if (!KA_TOKEN) missing.push("KA_TOKEN (ou resource key do secret, ex.: ka_token)");
  return missing.length ? `Variáveis faltando: ${missing.join(", ")}. Verifique app.yaml e Resources do app.` : null;
}

function extractTextFromKAResponse(data) {
  if (data.error && data.error.message) return null;
  if (data.choices && data.choices[0]?.message?.content) return data.choices[0].message.content;
  if (typeof data.output === "string") return data.output;
  if (data.predictions?.[0]) {
    const p = data.predictions[0];
    if (typeof p === "string") return p;
    if (p.content) return p.content;
    if (p.output) return p.output;
  }
  if (data.text) return data.text;
  if (Array.isArray(data.output) && data.output.length > 0) {
    const parts = [];
    for (const item of data.output) {
      if (item.type === "output_text" && item.text) parts.push(item.text);
      else if (item.text) parts.push(item.text);
      else if (item.content && Array.isArray(item.content)) {
        for (const block of item.content) {
          if (block.type === "output_text" && block.text) parts.push(block.text);
          else if (block.text) parts.push(block.text);
        }
      }
    }
    if (parts.length) return parts.join("\n\n");
  }
  if (data.output && typeof data.output === "object" && data.output.content) {
    const c = data.output.content;
    if (Array.isArray(c)) {
      const parts = c.map((b) => (b && b.text) || (b && typeof b.content === "string" ? b.content : null)).filter(Boolean);
      if (parts.length) return parts.join("\n\n");
    }
    if (typeof c === "string") return c;
  }
  if (data.output && typeof data.output === "object" && typeof data.output.output === "string") return data.output.output;
  if (data.result && typeof data.result === "string") return data.result;
  return null;
}

async function callKnowledgeAssistant(content) {
  let url = KA_ENDPOINT_URL;
  if (!url.endsWith("/invocations")) url = url.replace(/\/?$/, "") + "/invocations";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KA_TOKEN}`,
    },
    body: JSON.stringify({
      input: [{ role: "user", content }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  const data = await res.json();
  const text = extractTextFromKAResponse(data);
  return text || "Sem resposta em texto.";
}

app.post("/api/chat", async (req, res) => {
  try {
    const content = req.body?.content;
    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "Body deve conter 'content' (string)." });
    }
    if (!isKAConfigured()) {
      const msg = getConfigError();
      return res.status(503).json({ error: msg || "Chat não configurado." });
    }
    const text = await callKnowledgeAssistant(content.trim());
    return res.json({ text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message || "Erro ao consultar o assistente.",
    });
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true, ka: isKAConfigured() });
});

// ---------- Forecast (Databricks SQL) ----------
const DATABRICKS_HOST = (process.env.DATABRICKS_HOST || process.env.DATABRICKS_INSTANCE || "").replace(/\/$/, "");
const DATABRICKS_WAREHOUSE_ID = (process.env.DATABRICKS_WAREHOUSE_ID || "").trim();
const SQL_TOKEN = process.env.KA_TOKEN || process.env.ka_token || process.env.secret || "";

function isSqlConfigured() {
  return !!DATABRICKS_HOST && !!DATABRICKS_WAREHOUSE_ID && !!SQL_TOKEN;
}

function buildForecastSql(storeId, productId) {
  const catalog = "leticia_demo_automobilistic_1_catalog.default";
  const storeIdNum =
    storeId != null && storeId !== ""
      ? parseInt(String(storeId).trim(), 10)
      : NaN;
  const storeFilter =
    !isNaN(storeIdNum) ? ` AND h.store_id = ${storeIdNum}` : "";
  return `
SELECT
  s.store_name AS parceiro,
  s.region AS regiao,
  CAST(h.year_month AS DATE) AS periodo,
  COALESCE(CAST(h.sales_monthly AS DOUBLE), 0) AS vendas,
  COALESCE(h.prediction, 0) AS previsao,
  CASE
    WHEN COALESCE(h.sales_monthly, 0) > 0
    THEN ROUND(100.0 * COALESCE(h.prediction, 0) / h.sales_monthly, 1)
    ELSE NULL
  END AS acuracia_pct
FROM ${catalog}.sales_br_forecast_qty_by_store_monthly_historic h
LEFT JOIN ${catalog}.stores_br s ON h.store_id = s.store_id
WHERE 1=1${storeFilter}
ORDER BY h.year_month DESC, s.store_name
LIMIT 100
`;
}

const catalogProduct = "leticia_demo_automobilistic_1_catalog.default";

function buildForecastByProductSql(storeId, productId) {
  const storeFilter =
    storeId != null && storeId !== "" && !isNaN(Number(storeId))
      ? ` AND h.store_id = ${Number(storeId)}`
      : "";
  const productFilter =
    productId != null && productId !== "" && !isNaN(Number(productId))
      ? ` AND h.product_id = ${Number(productId)}`
      : "";
  return `
SELECT
  s.store_name AS parceiro,
  COALESCE(s.region, '') AS regiao,
  CAST(h.year_month AS DATE) AS periodo,
  h.product_id AS product_id,
  COALESCE(p.product_name, '') AS product_name,
  COALESCE(p.sku, '') AS product_sku,
  COALESCE(CAST(h.sales_monthly AS DOUBLE), 0) AS vendas,
  COALESCE(CAST(h.prediction AS DOUBLE), 0) AS previsao,
  CASE
    WHEN COALESCE(h.sales_monthly, 0) > 0
    THEN ROUND(100.0 * COALESCE(h.prediction, 0) / h.sales_monthly, 1)
    ELSE NULL
  END AS acuracia_pct,
  CASE
    WHEN COALESCE(h.sales_monthly, 0) = 0 THEN 'medio'
    WHEN h.prediction IS NULL THEN 'medio'
    WHEN (h.prediction / h.sales_monthly) > 1.2 THEN 'alto'
    WHEN (h.prediction / h.sales_monthly) < 0.8 THEN 'baixo'
    ELSE 'medio'
  END AS risco_estoque
FROM ${catalogProduct}.sales_br_forecast_by_product_store_monthly_historic h
LEFT JOIN ${catalogProduct}.stores_br s ON h.store_id = s.store_id
LEFT JOIN ${catalogProduct}.products_br p ON h.product_id = p.product_id
WHERE 1=1${storeFilter}${productFilter}
ORDER BY h.year_month DESC, s.store_name, p.product_name, h.product_id
LIMIT 500
`;
}

async function runDatabricksSql(statement) {
  const baseUrl = `${DATABRICKS_HOST}/api/2.0/sql/statements`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SQL_TOKEN}`,
  };
  const createRes = await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      warehouse_id: DATABRICKS_WAREHOUSE_ID,
      statement: statement,
      wait_timeout: "30s",
    }),
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Databricks SQL ${createRes.status}: ${text}`);
  }
  let data = await createRes.json();
  if (data.status?.state === "FAILED") {
    throw new Error(data.status.error?.message || "SQL failed");
  }
  let statementId = data.statement_id;
  while (statementId && (data.status?.state === "PENDING" || data.status?.state === "RUNNING")) {
    await new Promise((r) => setTimeout(r, 500));
    const getRes = await fetch(`${baseUrl}/${statementId}`, { headers });
    if (!getRes.ok) throw new Error(`Databricks SQL get ${getRes.status}`);
    data = await getRes.json();
    if (data.status?.state === "FAILED") {
      throw new Error(data.status.error?.message || "SQL failed");
    }
  }
  const manifest = data.manifest || data.result?.manifest;
  const result = data.result;
  const colDefs = manifest?.schema?.columns || result?.schema?.columns || [];
  const columns = colDefs.length
    ? colDefs.map((c) => (c.name || "").toLowerCase())
    : (result?.data_array?.[0] ? [] : []);
  const dataArray = result?.data_array || [];
  const rows = dataArray.map((arr) => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = arr[i];
    });
    return obj;
  });
  return { columns, rows };
}

const PRODUCTS_SQL = `
SELECT product_id AS id, product_name AS name, COALESCE(sku, '') AS code
FROM leticia_demo_automobilistic_1_catalog.default.products_br
ORDER BY product_name
`;

const STORES_SQL = `
SELECT store_id AS id, store_name AS name
FROM leticia_demo_automobilistic_1_catalog.default.stores_br
ORDER BY store_name
`;

app.get("/api/forecast", async (req, res) => {
  try {
    if (!isSqlConfigured()) {
      return res.status(503).json({
        error: "Forecast não configurado. Defina DATABRICKS_HOST, DATABRICKS_WAREHOUSE_ID e token (KA_TOKEN).",
      });
    }
    const storeId = (req.query.store_id != null && req.query.store_id !== "") ? String(req.query.store_id).trim() : null;
    const productId = (req.query.product_id != null && req.query.product_id !== "") ? String(req.query.product_id).trim() : null;
    const sql = buildForecastSql(storeId, productId);
    const { columns, rows } = await runDatabricksSql(sql);
    return res.json({ columns, rows });
  } catch (err) {
    console.error("[forecast]", err);
    return res.status(500).json({
      error: err.message || "Erro ao consultar previsão.",
    });
  }
});

app.get("/api/forecast-by-product", async (req, res) => {
  try {
    if (!isSqlConfigured()) {
      return res.status(503).json({
        error: "Forecast por produto não configurado. Defina DATABRICKS_HOST, DATABRICKS_WAREHOUSE_ID e token.",
      });
    }
    const storeId = (req.query.store_id != null && req.query.store_id !== "") ? String(req.query.store_id).trim() : null;
    const productId = (req.query.product_id != null && req.query.product_id !== "") ? String(req.query.product_id).trim() : null;
    const sql = buildForecastByProductSql(storeId, productId);
    const { rows } = await runDatabricksSql(sql);
    return res.json({ rows: rows || [] });
  } catch (err) {
    console.error("[forecast-by-product]", err);
    return res.status(500).json({
      error: err.message || "Erro ao consultar previsão por produto.",
    });
  }
});

const filtersHandler = async (req, res) => {
  try {
    if (!isSqlConfigured()) {
      return res.status(503).json({
        error: "Filtros não configurados. Defina DATABRICKS_HOST, DATABRICKS_WAREHOUSE_ID e token (KA_TOKEN).",
      });
    }
    const [productsResult, storesResult] = await Promise.all([
      runDatabricksSql(PRODUCTS_SQL),
      runDatabricksSql(STORES_SQL),
    ]);
    const products = (productsResult.rows || []).map((r) => ({ id: r.id, name: r.name, code: r.code != null ? String(r.code) : "" }));
    const stores = (storesResult.rows || []).map((r) => ({ id: r.id, name: r.name }));
    return res.json({ products, stores });
  } catch (err) {
    console.error("[filters]", err);
    return res.status(500).json({
      error: err.message || "Erro ao carregar filtros.",
    });
  }
};
app.get("/api/filters", filtersHandler);
app.get(/\/api\/filters\/?$/, filtersHandler);

// ---------- Métricas produto: estoque ótimo e valor de estoque ----------
const catalogDefault = "leticia_demo_automobilistic_1_catalog.default";

app.get("/api/metrics-product", async (req, res) => {
  try {
    const productId = (req.query.product_id != null && req.query.product_id !== "") ? String(req.query.product_id).trim() : null;
    const storeId = (req.query.store_id != null && req.query.store_id !== "") ? String(req.query.store_id).trim() : null;

    if (!productId) {
      return res.json({ estoque_otimo: null, valor_estoque: null, estoque_atual: null });
    }

    if (!isSqlConfigured()) {
      return res.json({ estoque_otimo: null, valor_estoque: null, estoque_atual: null });
    }

    const storeFilterStock =
      storeId && !isNaN(Number(storeId))
        ? ` AND id_store = ${Number(storeId)}`
        : "";

    const storeFilterForecast =
      storeId && !isNaN(Number(storeId)) ? ` AND f.store_id = ${Number(storeId)}` : "";

    const [forecastResult, priceResult, stockResult] = await Promise.all([
      runDatabricksSql(`
SELECT
  SUM(COALESCE(CAST(f.sales_forecast AS DOUBLE), 0)) AS soma_forecast,
  COUNT(DISTINCT f.year_month) AS meses
FROM ${catalogDefault}.sales_br_forecast_by_product_store_monthly f
WHERE 1=1
  ${storeFilterForecast}
  AND f.product_id = ${Number(productId)}
`),
      runDatabricksSql(`
SELECT COALESCE(CAST(price AS DOUBLE), 0) AS price
FROM ${catalogDefault}.products_br
WHERE product_id = ${Number(productId)}
LIMIT 1
`),
      runDatabricksSql(`
SELECT COALESCE(SUM(CAST(stock_quantity AS BIGINT)), 0) AS qtd
FROM ${catalogDefault}.stock_br
WHERE id_product = ${Number(productId)}${storeFilterStock}
`).catch(() => ({ rows: [] })),
    ]);

    const row = (forecastResult.rows && forecastResult.rows[0]) || {};
    const somaForecast = row.soma_forecast != null ? Number(row.soma_forecast) : null;
    const meses = row.meses != null ? Number(row.meses) : 0;

    let estoque_otimo = null;
    if (somaForecast != null && meses > 0) {
      const mediaMensal = somaForecast / meses;
      estoque_otimo = Math.round(mediaMensal * 1.2);
    }

    const priceRow = (priceResult.rows && priceResult.rows[0]) || {};
    const precoUnitario = priceRow.price != null ? Number(priceRow.price) : null;
    const valor_estoque =
      estoque_otimo != null && precoUnitario != null && !isNaN(estoque_otimo) && !isNaN(precoUnitario)
        ? estoque_otimo * precoUnitario
        : null;

    const stockRow = (stockResult && stockResult.rows && stockResult.rows[0]) || {};
    const estoque_atual =
      stockRow.qtd != null && !isNaN(Number(stockRow.qtd)) ? Number(stockRow.qtd) : null;

    return res.json({
      estoque_otimo: estoque_otimo,
      valor_estoque: valor_estoque,
      preco_unitario: precoUnitario,
      estoque_atual: estoque_atual,
    });
  } catch (err) {
    console.error("[metrics-product]", err);
    return res.status(500).json({
      error: err.message || "Erro ao carregar métricas do produto.",
    });
  }
});

// ---------- Chart: histórico (actual + forecast) + futuro (forecast) ----------
function buildChartHistoricSql(storeId) {
  const catalog = "leticia_demo_automobilistic_1_catalog.default";
  const storeFilter =
    storeId != null && storeId !== "" && !isNaN(Number(storeId))
      ? ` WHERE store_id = ${Number(storeId)}`
      : "";
  return `
SELECT CAST(year_month AS DATE) AS period, sales_monthly AS actual, prediction AS forecast
FROM ${catalog}.sales_br_forecast_qty_by_store_monthly_historic
${storeFilter}
ORDER BY year_month
`;
}

function buildChartFutureSql(storeId) {
  const catalog = "leticia_demo_automobilistic_1_catalog.default";
  const storeFilter =
    storeId != null && storeId !== "" && !isNaN(Number(storeId))
      ? ` AND store_id = ${Number(storeId)}`
      : "";
  return `
SELECT CAST(year_month AS DATE) AS period, sales_forecast AS forecast
FROM ${catalog}.sales_br_forecast_qty_by_store_monthly
WHERE 1=1${storeFilter}
ORDER BY year_month
`;
}

const forecastChartHandler = async (req, res) => {
  try {
    if (!isSqlConfigured()) {
      return res.status(503).json({
        error: "Chart não configurado. Defina DATABRICKS_HOST, DATABRICKS_WAREHOUSE_ID e token.",
      });
    }
    const storeId = (req.query.store_id != null && req.query.store_id !== "") ? String(req.query.store_id).trim() : null;
    const period = (req.query.period === "annual" || req.query.period === "anual") ? "annual" : "monthly";

    const [historicResult, futureResult] = await Promise.all([
      runDatabricksSql(buildChartHistoricSql(storeId)),
      runDatabricksSql(buildChartFutureSql(storeId)),
    ]);

    let historicRows = historicResult.rows || [];
    let futureRows = futureResult.rows || [];
    if (!storeId && historicRows.length > 0) {
      const byPeriod = {};
      historicRows.forEach((r) => {
        const key = r.period ? new Date(r.period).toISOString().slice(0, 7) : "";
        if (!key) return;
        if (!byPeriod[key]) byPeriod[key] = { period: key + "-01", actual: 0, forecast: 0 };
        if (r.actual != null) byPeriod[key].actual += Number(r.actual);
        if (r.forecast != null) byPeriod[key].forecast += Number(r.forecast);
      });
      historicRows = Object.values(byPeriod).sort((a, b) => new Date(a.period).getTime() - new Date(b.period).getTime());
    }
    if (!storeId && futureRows.length > 0) {
      const byPeriod = {};
      futureRows.forEach((r) => {
        const key = r.period ? new Date(r.period).toISOString().slice(0, 7) : "";
        if (!key) return;
        if (!byPeriod[key]) byPeriod[key] = { period: key + "-01", forecast: 0 };
        if (r.forecast != null) byPeriod[key].forecast += Number(r.forecast);
      });
      futureRows = Object.values(byPeriod).sort((a, b) => new Date(a.period).getTime() - new Date(b.period).getTime());
    }

    const maxHistoricPeriod = historicRows.length
      ? historicRows.reduce((max, r) => {
          const p = r.period ? new Date(r.period).getTime() : 0;
          return p > max ? p : max;
        }, 0)
      : null;

    const futureFiltered = maxHistoricPeriod
      ? futureRows.filter((r) => r.period && new Date(r.period).getTime() > maxHistoricPeriod)
      : futureRows;

    const historicPoints = historicRows.map((r) => ({
      period: r.period,
      actual: r.actual != null ? Number(r.actual) : null,
      forecast: r.forecast != null ? Number(r.forecast) : null,
      isFuture: false,
    }));

    const futurePoints = futureFiltered.map((r) => ({
      period: r.period,
      actual: null,
      forecast: r.forecast != null ? Number(r.forecast) : null,
      isFuture: true,
    }));

    let data = [...historicPoints, ...futurePoints].sort(
      (a, b) => new Date(a.period).getTime() - new Date(b.period).getTime()
    );

    if (period === "annual") {
      const byYear = {};
      data.forEach((d) => {
        const y = new Date(d.period).getFullYear();
        if (!byYear[y]) byYear[y] = { period: String(y), actual: 0, forecast: 0, isFuture: d.isFuture, countActual: 0, countForecast: 0 };
        if (d.actual != null) { byYear[y].actual += d.actual; byYear[y].countActual++; }
        if (d.forecast != null) { byYear[y].forecast += d.forecast; byYear[y].countForecast++; }
        byYear[y].isFuture = byYear[y].isFuture || d.isFuture;
      });
      data = Object.keys(byYear)
        .sort()
        .map((y) => ({
          period: y,
          actual: byYear[y].countActual ? byYear[y].actual : null,
          forecast: byYear[y].countForecast ? byYear[y].forecast : null,
          isFuture: byYear[y].isFuture,
        }));
    }

    const cutoffIndex = data.findIndex((d) => d.isFuture);
    const cutoffPeriod = cutoffIndex >= 0 && data[cutoffIndex] ? data[cutoffIndex].period : null;

    return res.json({
      data,
      cutoffPeriod,
      period: period === "annual" ? "annual" : "monthly",
    });
  } catch (err) {
    console.error("[forecast-chart]", err);
    return res.status(500).json({ error: err.message || "Erro ao carregar gráfico." });
  }
};
app.get("/api/forecast-chart", forecastChartHandler);
app.get(/\/api\/forecast-chart\/?$/, forecastChartHandler);

// Tabelas para gráfico Por produto: histórico + previsão futura
const TABLE_HISTORIC_BY_PRODUCT = "leticia_demo_automobilistic_1_catalog.default.sales_br_forecast_by_product_store_monthly_historic";
const TABLE_FUTURE_BY_PRODUCT = "leticia_demo_automobilistic_1_catalog.default.sales_br_forecast_by_product_store_monthly";

function buildChartHistoricByProductSql(storeId, productId) {
  const storeFilter =
    storeId != null && storeId !== "" && !isNaN(Number(storeId))
      ? ` AND store_id = ${Number(storeId)}`
      : "";
  const productFilter =
    productId != null && productId !== "" && !isNaN(Number(productId))
      ? ` AND product_id = ${Number(productId)}`
      : "";
  return `
SELECT CAST(year_month AS DATE) AS period,
  SUM(COALESCE(CAST(sales_monthly AS DOUBLE), 0)) AS actual,
  SUM(COALESCE(CAST(prediction AS DOUBLE), 0)) AS forecast
FROM ${TABLE_HISTORIC_BY_PRODUCT}
WHERE 1=1${storeFilter}${productFilter}
GROUP BY CAST(year_month AS DATE)
ORDER BY period
`;
}

function buildChartFutureByProductSql(storeId, productId) {
  const storeFilter =
    storeId != null && storeId !== "" && !isNaN(Number(storeId))
      ? ` AND store_id = ${Number(storeId)}`
      : "";
  const productFilter =
    productId != null && productId !== "" && !isNaN(Number(productId))
      ? ` AND product_id = ${Number(productId)}`
      : "";
  return `
SELECT CAST(year_month AS DATE) AS period, SUM(COALESCE(CAST(sales_forecast AS DOUBLE), 0)) AS forecast
FROM ${TABLE_FUTURE_BY_PRODUCT}
WHERE 1=1${storeFilter}${productFilter}
GROUP BY CAST(year_month AS DATE)
ORDER BY period
`;
}

function toPeriodStr(period) {
  if (period == null) return period;
  const d = new Date(period);
  if (isNaN(d.getTime())) return period;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const forecastChartByProductHandler = async (req, res) => {
  try {
    if (!isSqlConfigured()) {
      return res.status(503).json({
        error: "Chart por produto não configurado. Defina DATABRICKS_HOST, DATABRICKS_WAREHOUSE_ID e token.",
      });
    }
    const storeId = (req.query.store_id != null && req.query.store_id !== "") ? String(req.query.store_id).trim() : null;
    const productId = (req.query.product_id != null && req.query.product_id !== "") ? String(req.query.product_id).trim() : null;
    const period = (req.query.period === "annual" || req.query.period === "anual") ? "annual" : "monthly";

    const [historicResult, futureResult] = await Promise.all([
      runDatabricksSql(buildChartHistoricByProductSql(storeId, productId)),
      runDatabricksSql(buildChartFutureByProductSql(storeId, productId)),
    ]);

    const historicRows = historicResult.rows || [];
    const futureRows = futureResult.rows || [];

    const maxHistoricTime = historicRows.length
      ? Math.max(...historicRows.map((r) => (r.period ? new Date(r.period).getTime() : 0)))
      : 0;

    const historicPoints = historicRows.map((r) => ({
      period: toPeriodStr(r.period),
      actual: r.actual != null ? Number(r.actual) : null,
      forecast: r.forecast != null ? Number(r.forecast) : null,
      isFuture: false,
    }));

    const futurePoints = futureRows
      .filter((r) => r.period && new Date(r.period).getTime() > maxHistoricTime)
      .map((r) => ({
        period: toPeriodStr(r.period),
        actual: null,
        forecast: r.forecast != null ? Number(r.forecast) : null,
        isFuture: true,
      }));

    let data = [...historicPoints, ...futurePoints].sort(
      (a, b) => new Date(a.period).getTime() - new Date(b.period).getTime()
    );

    if (period === "annual") {
      const byYear = {};
      data.forEach((d) => {
        const y = new Date(d.period).getFullYear();
        if (!byYear[y]) byYear[y] = { period: String(y), actual: 0, forecast: 0, isFuture: d.isFuture };
        if (d.actual != null) byYear[y].actual += d.actual;
        if (d.forecast != null) byYear[y].forecast += d.forecast;
        byYear[y].isFuture = byYear[y].isFuture || d.isFuture;
      });
      data = Object.keys(byYear)
        .sort()
        .map((y) => ({
          period: y,
          actual: byYear[y].actual || null,
          forecast: byYear[y].forecast != null ? byYear[y].forecast : null,
          isFuture: byYear[y].isFuture,
        }));
    }

    const cutoffIndex = data.findIndex((d) => d.isFuture);
    const cutoffPeriod = cutoffIndex >= 0 && data[cutoffIndex] ? data[cutoffIndex].period : null;

    return res.json({
      data,
      cutoffPeriod,
      period: period === "annual" ? "annual" : "monthly",
    });
  } catch (err) {
    console.error("[forecast-chart-by-product]", err);
    return res.status(500).json({ error: err.message || "Erro ao carregar gráfico por produto." });
  }
};

app.get("/api/forecast-chart-by-product", forecastChartByProductHandler);
app.get(/\/api\/forecast-chart-by-product\/?$/, forecastChartByProductHandler);

// Legado: só futuro (frontend pode usar o novo endpoint acima)
app.get("/api/forecast-chart-future-by-product", async (req, res) => {
  try {
    if (!isSqlConfigured()) {
      return res.status(503).json({
        error: "Chart futuro por produto não configurado. Defina DATABRICKS_HOST, DATABRICKS_WAREHOUSE_ID e token.",
      });
    }
    const storeId = (req.query.store_id != null && req.query.store_id !== "") ? String(req.query.store_id).trim() : null;
    const productId = (req.query.product_id != null && req.query.product_id !== "") ? String(req.query.product_id).trim() : null;
    const sql = buildChartFutureByProductSql(storeId, productId);
    const { rows } = await runDatabricksSql(sql);
    const data = (rows || []).map((r) => ({
      period: toPeriodStr(r.period),
      forecast: r.forecast != null ? Number(r.forecast) : null,
    }));
    return res.json({ data });
  } catch (err) {
    console.error("[forecast-chart-future-by-product]", err);
    return res.status(500).json({ error: err.message || "Erro ao carregar forecast futuro por produto." });
  }
});

// ---------- Estático: raiz do projeto (index.html, js/, css/) ----------
const projectRoot = path.join(__dirname, "..");
app.use(express.static(projectRoot));

app.listen(PORT, HOST, () => {
  console.log(`App rodando em http://${HOST}:${PORT}`);
  console.log(`  POST /api/chat  – Knowledge Assistant`);
  console.log(`  GET  /health   – status`);
  console.log(`  [config] KA_ENDPOINT_URL: ${KA_ENDPOINT_URL ? "definido" : "FALTANDO"}, KA_TOKEN: ${KA_TOKEN ? "definido" : "FALTANDO"}`);
  if (!isKAConfigured()) {
    console.warn("  Aviso:", getConfigError());
  }
});
