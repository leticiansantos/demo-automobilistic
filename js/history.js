/**
 * Histórico do carro: lista, pesquisa, paginação, setDriverHistoryFromDatabricks
 */
(function () {
  var HISTORY_EVENTS = [
    { descricao: "Revisão programada 10.000 km realizada na concessionária", data: "2025-02-15", local: "Green Nações – Avenida das Nações Unidas, 23253, São Paulo/SP" },
    { descricao: "Alerta de pressão dos pneus verificado – calibração feita", data: "2025-02-14", local: "Cliente" },
    { descricao: "Troca de óleo do motor concluída", data: "2025-02-10", local: "Green Nações – Avenida das Nações Unidas, 23253, São Paulo/SP" },
    { descricao: "Diagnóstico de check engine – sensor O2 substituído", data: "2025-02-08", local: "Loja externa" },
    { descricao: "Atualização de software do sistema multimídia", data: "2025-02-05", local: "" },
    { descricao: "Inspeção de freios – pastilhas em bom estado", data: "2025-02-01", local: "Green Nações – Avenida das Nações Unidas, 23253, São Paulo/SP" },
    { descricao: "Substituição do filtro de ar do motor", data: "2025-01-28", local: "Loja externa" },
    { descricao: "Verificação do sistema de arrefecimento", data: "2025-01-22", local: "" },
    { descricao: "Alinhamento e balanceamento realizados", data: "2025-01-18", local: "Green Nações – Avenida das Nações Unidas, 23253, São Paulo/SP" },
    { descricao: "Troca do filtro de cabine", data: "2025-01-12", local: "Cliente" },
    { descricao: "Recall airbag – verificação concluída", data: "2025-01-08", local: "Green Nações – Avenida das Nações Unidas, 23253, São Paulo/SP" },
    { descricao: "Revisão dos 5.000 km", data: "2024-12-20", local: "Green Nações – Avenida das Nações Unidas, 23253, São Paulo/SP" },
    { descricao: "Troca de bateria auxiliar", data: "2024-12-10", local: "Loja externa" },
    { descricao: "Calibração dos sensores de estacionamento", data: "2024-11-28", local: "" },
    { descricao: "Substituição das palhetas do limpador", data: "2024-11-15", local: "Cliente" }
  ];
  var currentPage = 1;
  var pageSize = 10;
  var filterText = "";

  var listEl = document.getElementById("history-list");
  var paginationEl = document.getElementById("history-pagination");
  var pageSizeSelect = document.getElementById("history-page-size");
  var searchInput = document.getElementById("history-search");

  function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text == null ? "" : String(text);
    return div.innerHTML;
  }

  function formatDate(val) {
    if (val == null || val === "") return "—";
    var s = String(val);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10).split("-").reverse().join("/");
    return s;
  }

  function renderHistory() {
    var filtered = HISTORY_EVENTS;
    if (filterText) {
      var q = filterText.trim().toLowerCase();
      filtered = HISTORY_EVENTS.filter(function (ev) {
        var desc = (ev.descricao != null ? ev.descricao : (ev.description != null ? ev.description : "")).toLowerCase();
        var dataStr = formatDate(ev.data != null ? ev.data : (ev.date != null ? ev.date : ev.data_hora != null ? ev.data_hora : "")).toLowerCase();
        return desc.indexOf(q) !== -1 || dataStr.indexOf(q) !== -1;
      });
    }
    var total = filtered.length;
    var totalPages = Math.max(1, Math.ceil(total / pageSize));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    var start = (currentPage - 1) * pageSize;
    var slice = filtered.slice(start, start + pageSize);

    if (!listEl) return;

    if (slice.length === 0) {
      listEl.innerHTML = "<div class=\"history-empty\">" + (filterText.trim() ? "Nenhum evento encontrado para a pesquisa." : "Nenhum evento no histórico. Os dados serão carregados do Databricks.") + "</div>";
    } else {
      var header = "<div class=\"history-list-header\"><span>Data</span><span>Descrição</span><span>Local realizado</span></div>";
      var rows = slice.map(function (ev) {
        var desc = ev.descricao != null ? ev.descricao : (ev.description != null ? ev.description : "");
        var data = ev.data != null ? ev.data : (ev.date != null ? ev.date : ev.data_hora != null ? ev.data_hora : "");
        var local = ev.local_realizado != null ? ev.local_realizado : (ev.local != null ? ev.local : (ev.localRealizado != null ? ev.localRealizado : ""));
        return "<div class=\"history-item\"><span class=\"history-item-date\">" + escapeHtml(formatDate(data)) + "</span><span class=\"history-item-desc\">" + escapeHtml(desc) + "</span><span class=\"history-item-local\">" + escapeHtml(local) + "</span></div>";
      }).join("");
      listEl.innerHTML = header + rows;
    }

    if (!paginationEl) return;

    if (total === 0) {
      paginationEl.innerHTML = "";
      return;
    }

    var startIdx = start + 1;
    var endIdx = Math.min(start + pageSize, total);
    var info = "Exibindo " + startIdx + " a " + endIdx + " de " + total + " eventos";
    var prevDisabled = currentPage <= 1;
    var nextDisabled = currentPage >= totalPages;

    paginationEl.innerHTML =
      "<span class=\"history-pagination-info\">" + escapeHtml(info) + "</span>" +
      "<div class=\"history-pagination-btns\">" +
      "<button type=\"button\" id=\"history-prev\" " + (prevDisabled ? "disabled" : "") + ">Anterior</button>" +
      "<button type=\"button\" id=\"history-next\" " + (nextDisabled ? "disabled" : "") + ">Próxima</button>" +
      "</div>";

    var prevBtn = document.getElementById("history-prev");
    var nextBtn = document.getElementById("history-next");
    if (prevBtn) prevBtn.addEventListener("click", function () { currentPage--; renderHistory(); });
    if (nextBtn) nextBtn.addEventListener("click", function () { currentPage++; renderHistory(); });
  }

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", function () {
      pageSize = parseInt(pageSizeSelect.value, 10) || 10;
      currentPage = 1;
      renderHistory();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      filterText = searchInput.value || "";
      currentPage = 1;
      renderHistory();
    });
  }

  window.setDriverHistoryFromDatabricks = function (events) {
    HISTORY_EVENTS = Array.isArray(events) ? events.slice() : [];
    currentPage = 1;
    renderHistory();
  };

  renderHistory();
})();
