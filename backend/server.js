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
