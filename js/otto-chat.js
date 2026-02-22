/**
 * Popup Otto (chat) – mensagens, submit, askGenieViaApi, limpar conversa, Enter
 */
(function () {
  var ottoOverlay = document.getElementById("otto-popup-overlay");
  var ottoMessages = document.getElementById("otto-chat-messages");
  var ottoForm = document.getElementById("otto-chat-form");
  var ottoInput = document.getElementById("otto-chat-input");
  var ottoSend = document.getElementById("otto-chat-send");
  var ottoTrigger = document.getElementById("otto-trigger");
  var ottoClose = document.getElementById("otto-popup-close");
  var ottoClear = document.getElementById("otto-popup-clear");

  function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text == null ? "" : String(text);
    return div.innerHTML;
  }

  function appendMessage(role, text, className) {
    if (!ottoMessages) return;
    var div = document.createElement("div");
    div.className = "otto-msg " + (role === "user" ? "user" : "assistant") + (className ? " " + className : "");
    div.textContent = text;
    ottoMessages.appendChild(div);
    ottoMessages.scrollTop = ottoMessages.scrollHeight;
  }

  function openOttoPopup() {
    if (ottoOverlay) {
      ottoOverlay.classList.add("open");
      ottoOverlay.setAttribute("aria-hidden", "false");
    }
    if (ottoMessages && ottoMessages.children.length === 0) {
      appendMessage("assistant", "Olá! Sou o Otto. Pergunte sobre seu carro: revisões, alertas, manual, consumo e muito mais.");
    }
    if (ottoInput) ottoInput.focus();
  }

  function closeOttoPopup() {
    if (ottoOverlay) {
      ottoOverlay.classList.remove("open");
      ottoOverlay.setAttribute("aria-hidden", "true");
    }
  }

  function askGenieViaApi(question) {
    if (typeof window.askOttoGenie === "function") {
      var result = window.askOttoGenie(question);
      return result != null && typeof result.then === "function" ? result : Promise.resolve(result);
    }
    return Promise.resolve("Configure a função window.askOttoGenie(pergunta) para chamar a API do Genie/Databricks e retornar a resposta (texto ou Promise). Você pode usar o ID do motorista atual: " + (window.getDriverIdForSearch ? window.getDriverIdForSearch() : "") + ".");
  }

  if (ottoInput) {
    ottoInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (ottoForm) ottoForm.requestSubmit();
      }
    });
  }

  if (ottoForm) {
    ottoForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = (ottoInput && ottoInput.value || "").trim();
      if (!text) return;
      if (ottoInput) ottoInput.value = "";
      appendMessage("user", text);
      ottoSend.disabled = true;
      appendMessage("assistant", "Pensando...", "thinking");
      var thinkingEl = ottoMessages.lastElementChild;

      askGenieViaApi(text).then(function (reply) {
        if (thinkingEl && thinkingEl.parentNode) thinkingEl.remove();
        appendMessage("assistant", reply == null ? "Sem resposta." : String(reply));
      }).catch(function (err) {
        if (thinkingEl && thinkingEl.parentNode) thinkingEl.remove();
        var msg = err && err.message ? err.message : String(err);
        if (msg.indexOf("Failed to fetch") !== -1 || msg.indexOf("NetworkError") !== -1) {
          msg = "Não foi possível conectar ao servidor (geralmente CORS no navegador). " +
            "Use um proxy no backend: em js/databricks-genie.js defina PROXY_URL com a URL do seu backend que chama o KA/Genie e devolve { \"text\": \"...\" }.";
        } else {
          msg = "Erro ao consultar: " + msg;
        }
        appendMessage("assistant", msg);
      }).then(function () {
        ottoSend.disabled = false;
        if (ottoInput) ottoInput.focus();
      });
    });
  }

  function clearOttoConversation() {
    if (!ottoMessages) return;
    ottoMessages.innerHTML = "";
    if (typeof window.genieResetConversation === "function") window.genieResetConversation();
    appendMessage("assistant", "Olá! Sou o Otto. Pergunte sobre seu carro: revisões, alertas, manual, consumo e muito mais.");
  }

  if (ottoTrigger) ottoTrigger.addEventListener("click", openOttoPopup);
  if (ottoClose) ottoClose.addEventListener("click", closeOttoPopup);
  if (ottoClear) ottoClear.addEventListener("click", clearOttoConversation);
  if (ottoOverlay) ottoOverlay.addEventListener("click", function (e) { if (e.target === ottoOverlay) closeOttoPopup(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && ottoOverlay && ottoOverlay.classList.contains("open")) closeOttoPopup(); });

  window.openOttoPopup = openOttoPopup;
  window.closeOttoPopup = closeOttoPopup;
})();
