/**
 * Chat Otto – integração com o backend (Knowledge Assistant).
 * O frontend sempre envia a pergunta para o backend; o backend chama o KA no Databricks.
 *
 * ========== CONFIGURAÇÃO ==========
 * - Local: usa backend em localhost:8080.
 * - Produção (Databricks Apps): usa /api/chat (mesma origem – evita CORS).
 */
(function () {
  var CHAT_BACKEND_URL_LOCAL = "http://localhost:8080/api/chat";
  var isLocalhost = typeof window !== "undefined" && window.location && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  // Produção: mesma origem (frontend e API no mesmo app)
  var CHAT_BACKEND_URL = isLocalhost ? CHAT_BACKEND_URL_LOCAL : "/api/chat";

  function isConfigured() {
    return !!(CHAT_BACKEND_URL && CHAT_BACKEND_URL.trim());
  }

  function askBackend(question) {
    var url = CHAT_BACKEND_URL.replace(/\/$/, "");
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: question })
    })
      .then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error(t || String(r.status)); });
        return r.json();
      })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        return data.text != null ? data.text : "Sem resposta.";
      });
  }

  window.askOttoGenie = function (question) {
    if (!isConfigured()) {
      return Promise.resolve(
        "Configure CHAT_BACKEND_URL em js/databricks-genie.js com a URL do backend (ex.: http://localhost:8080/api/chat)."
      );
    }
    return askBackend(question);
  };

  window.genieResetConversation = function () {};
})();
