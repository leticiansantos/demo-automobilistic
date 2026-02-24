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
  const storeFilter =
    storeId != null && storeId !== "" && !isNaN(Number(storeId))
      ? ` AND h.store_id = ${Number(storeId)}`
      : "";
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
