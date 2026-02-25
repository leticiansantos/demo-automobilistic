/**
 * Visão do Motorista: pontos no carro, tabela de alertas, bandeira seguro para dirigir.
 * Dados da tabela alertas_por_motorista (Databricks). Filtro por ID do motorista e autocomplete.
 */
(function () {
  var ITENS = [];
  var statusPorId = {};

function getStatusClass(s) {
  if (s === "crit") return "status-crit";
  if (s === "warn") return "status-warn";
  return "status-ok";
}

function normPos(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v + "%";
  var s = String(v).trim();
  return s.indexOf("%") >= 0 ? s : s + "%";
}

function normArrow(v) {
  var a = (v && String(v).toLowerCase()) || "";
  if (a === "top" || a === "bottom" || a === "left" || a === "right") return a;
  return "bottom";
}

function getItemPosition(item) {
  return {
    top: normPos(item.top != null ? item.top : item.pos_top) || "10%",
    left: normPos(item.left != null ? item.left : item.pos_left) || "20%",
    arrow: normArrow(item.arrow != null ? item.arrow : item.pos_arrow)
  };
}

function renderCarPoints() {
  var container = document.getElementById("car-points");
  if (!container) return;
  container.innerHTML = "";
  if (!ITENS.length) return;

  var posKey = function (item) {
    var p = getItemPosition(item);
    return p.top + "," + p.left;
  };
  var byPos = {};
  ITENS.forEach(function (item, idx) {
    var key = posKey(item);
    if (!byPos[key]) byPos[key] = [];
    byPos[key].push({ item: item, index: idx });
  });

  var minOffsetPercent = 3;
  var charsPerLine = 14;
  var percentPerLine = 2.5;
  function estimateHeightPercent(titulo) {
    if (!titulo || !String(titulo).length) return minOffsetPercent;
    var estimatedLines = Math.max(1, Math.ceil(String(titulo).length / charsPerLine));
    return Math.max(minOffsetPercent, estimatedLines * percentPerLine);
  }
  var adjustedTopByIndex = {};
  Object.keys(byPos).forEach(function (key) {
    var group = byPos[key];
    if (group.length > 1) {
      var baseTop = getItemPosition(group[0].item).top;
      var baseNum = parseFloat(String(baseTop).replace("%", "")) || 0;
      var stackUp = baseNum <= 50;
      // Multi-linha: tratar apenas os elementos ABAIXO (altura só empurra o próximo); não dobrar distância para o elemento acima
      var nextTop = baseNum;
      group.forEach(function (entry, i) {
        adjustedTopByIndex[entry.index] = (stackUp ? Math.max(0, nextTop) : nextTop) + "%";
        // distância até o próximo: primeiro gap = mínimo (não dobrar acima); depois = altura do item atual (só empurra os abaixo)
        var step = i === 0 ? minOffsetPercent : estimateHeightPercent(entry.item.titulo);
        nextTop = stackUp ? nextTop - step : nextTop + step;
      });
    }
  });

  ITENS.forEach(function (item, index) {
    var pos = getItemPosition(item);
    var top = adjustedTopByIndex.hasOwnProperty(index) ? adjustedTopByIndex[index] : pos.top;
    var status = statusPorId[item.id] || "ok";
    var div = document.createElement("div");
    div.className = "car-point " + getStatusClass(status);
    div.setAttribute("data-id", item.id);
    div.style.top = top;
    div.style.left = pos.left;
    div.innerHTML = "<span class=\"car-point-dot\"></span><span class=\"car-point-label\">" + escapeHtml(item.titulo) + "</span>";
    container.appendChild(div);
  });
  bindPointHover();
}

function escapeHtml(text) {
  var d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

function renderTable() {
  var tbody = document.getElementById("alerts-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!ITENS.length) {
    var tr = document.createElement("tr");
    tr.innerHTML = "<td colspan=\"4\">Digite o ID do motorista e clique em Pesquisar para carregar os alertas.</td>";
    tbody.appendChild(tr);
    return;
  }
  ITENS.forEach(function (item) {
    var status = statusPorId[item.id] || "ok";
    var tr = document.createElement("tr");
    tr.setAttribute("data-id", item.id);
    tr.innerHTML = "<td><span class=\"table-dot " + getStatusClass(status) + "\"></span></td><td><strong>" + escapeHtml(item.titulo) + "</strong></td><td>" + escapeHtml(item.descricao) + "</td><td>" + escapeHtml(item.solucao) + "</td>";
    tbody.appendChild(tr);
  });
  bindTableHover();
}

function updateDriveSafetyFlag() {
  var flag = document.getElementById("drive-safety-flag");
  if (!flag) return;
  var hasCrit = false;
  var hasWarn = false;
  ITENS.forEach(function (item) {
    var s = statusPorId[item.id] || "ok";
    if (s === "crit") hasCrit = true;
    if (s === "warn") hasWarn = true;
  });
  flag.classList.remove("safe", "not-safe", "warn");
  var text = flag.querySelector(".drive-safety-text");
  if (!ITENS.length) {
    text.textContent = "Digite o ID do motorista e pesquise.";
    return;
  }
  if (hasCrit) {
    flag.classList.add("not-safe");
    text.textContent = "Não é seguro dirigir no momento";
  } else if (hasWarn) {
    flag.classList.add("warn");
    text.textContent = "Dirigir com cautela";
  } else {
    flag.classList.add("safe");
    text.textContent = "Seguro para dirigir";
  }
}

function clearHighlights() {
  document.querySelectorAll(".car-point").forEach(function (el) { el.classList.remove("highlight"); });
  document.querySelectorAll("#alerts-tbody tr").forEach(function (el) { el.classList.remove("highlight"); });
}

function highlightItem(id, on) {
  document.querySelectorAll(".car-point[data-id=\"" + id + "\"]").forEach(function (el) {
    el.classList.toggle("highlight", on);
  });
  var tr = document.querySelector("#alerts-tbody tr[data-id=\"" + id + "\"]");
  if (tr) tr.classList.toggle("highlight", on);
}

function scrollToAlertRow(id) {
  var tr = document.querySelector("#alerts-tbody tr[data-id=\"" + id + "\"]");
  if (tr) tr.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
}

function bindPointHover() {
  document.querySelectorAll(".car-point").forEach(function (el) {
    var id = el.getAttribute("data-id");
    el.addEventListener("mouseenter", function () {
      clearHighlights();
      highlightItem(id, true);
      scrollToAlertRow(id);
    });
    el.addEventListener("mouseleave", function () {
      clearHighlights();
    });
  });
}

function bindTableHover() {
  document.querySelectorAll("#alerts-tbody tr").forEach(function (tr) {
    var id = tr.getAttribute("data-id");
    tr.addEventListener("mouseenter", function () {
      clearHighlights();
      highlightItem(id, true);
    });
    tr.addEventListener("mouseleave", function () {
      clearHighlights();
    });
  });
}

renderCarPoints();
renderTable();
updateDriveSafetyFlag();

function getBaseUrl() {
  var p = window.location.pathname || "/";
  var base = p.endsWith("/") ? p : p.replace(/\/[^/]*$/, "") || "/";
  return base.replace(/\/$/, "");
}

function mapEstado(estado) {
  if (estado == null || estado === "") return "ok";
  var e = String(estado).toLowerCase();
  if (e.indexOf("crit") !== -1 || e.indexOf("critico") !== -1) return "crit";
  if (e.indexOf("warn") !== -1 || e.indexOf("aviso") !== -1) return "warn";
  return "ok";
}

function loadAlertasForMotorista(idMotorista) {
  var base = getBaseUrl();
  var url = base + "/api/alertas-motorista";
  if (idMotorista) url += "?id_motorista=" + encodeURIComponent(idMotorista);
  var flag = document.getElementById("drive-safety-flag");
  var textEl = flag && flag.querySelector(".drive-safety-text");
  if (textEl) textEl.textContent = "Carregando…";
  fetch(url)
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      if (!data || !data.rows) {
        ITENS = [];
        statusPorId = {};
        window.setWelcomeUserName("");
        renderCarPoints();
        renderTable();
        updateDriveSafetyFlag();
        if (textEl) textEl.textContent = idMotorista ? "Nenhum alerta encontrado." : "Digite o ID do motorista e pesquise.";
        return;
      }
      var idMotoristaResp = data.id_motorista || idMotorista || "";
      var mapped = data.rows.map(function (r) {
        var id = (r.id_item != null ? String(r.id_item) : "").trim();
        var status = mapEstado(r.estado);
        statusPorId[id] = status;
        return {
          id: id,
          titulo: r.titulo != null ? String(r.titulo) : "",
          descricao: r.descricao != null ? String(r.descricao) : "",
          solucao: r.solucao != null ? String(r.solucao) : "",
          status: status,
          top: r.top,
          left: r.left,
          arrow: r.arrow,
          ponto: r.ponto != null ? String(r.ponto) : ""
        };
      });
      var nomeCliente = (data.nome_cliente != null && String(data.nome_cliente).trim() !== "")
        ? String(data.nome_cliente).trim()
        : (idMotoristaResp ? "Motorista " + idMotoristaResp : "");
      window.setDriverViewDataFromDatabricks(mapped);
      window.setWelcomeUserName(nomeCliente);
    })
    .catch(function () {
      ITENS = [];
      statusPorId = {};
      renderCarPoints();
      renderTable();
      updateDriveSafetyFlag();
      window.setWelcomeUserName("");
      if (textEl) textEl.textContent = "Erro ao carregar alertas.";
    });
}

function fetchMotoristaIds(q, callback) {
  var base = getBaseUrl();
  var url = base + "/api/alertas-motorista-ids";
  if (q != null && String(q).trim() !== "") url += "?q=" + encodeURIComponent(String(q).trim());
  fetch(url).then(function (res) { return res.ok ? res.json() : { ids: [] }; }).then(function (data) { callback(data.ids || []); }).catch(function () { callback([]); });
}

function showSuggestions(ids) {
  var list = document.getElementById("driver-id-suggestions");
  var input = document.getElementById("driver-id-input");
  if (!list || !input) return;
  list.innerHTML = "";
  list.setAttribute("aria-hidden", "true");
  if (!ids || ids.length === 0) return;
  list.removeAttribute("aria-hidden");
  input.setAttribute("aria-expanded", "true");
  ids.forEach(function (id, idx) {
    var div = document.createElement("div");
    div.className = "driver-id-suggestion-item";
    div.setAttribute("role", "option");
    div.setAttribute("id", "driver-id-option-" + idx);
    div.textContent = id;
    div.addEventListener("click", function () {
      input.value = id;
      hideSuggestions();
      triggerDriverSearch();
    });
    list.appendChild(div);
  });
}

function hideSuggestions() {
  var list = document.getElementById("driver-id-suggestions");
  var input = document.getElementById("driver-id-input");
  if (list) { list.innerHTML = ""; list.setAttribute("aria-hidden", "true"); }
  if (input) { input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); }
}

function getHighlightedSuggestionIndex() {
  var list = document.getElementById("driver-id-suggestions");
  if (!list || list.getAttribute("aria-hidden") === "true") return -1;
  var items = list.querySelectorAll(".driver-id-suggestion-item");
  for (var i = 0; i < items.length; i++) {
    if (items[i].classList.contains("highlight")) return i;
  }
  return -1;
}

function setHighlightedSuggestion(index) {
  var list = document.getElementById("driver-id-suggestions");
  var input = document.getElementById("driver-id-input");
  if (!list || !input) return;
  var items = list.querySelectorAll(".driver-id-suggestion-item");
  items.forEach(function (el, i) { el.classList.toggle("highlight", i === index); });
  if (index >= 0 && index < items.length) {
    input.setAttribute("aria-activedescendant", items[index].id);
  } else {
    input.removeAttribute("aria-activedescendant");
  }
}

window.getDriverIdForSearch = function () {
  var el = document.getElementById("driver-id-input");
  return el ? el.value.trim() : "";
};

  window.setWelcomeUserName = function (name) {
    var el = document.getElementById("welcome-name");
    if (el) el.textContent = name != null && name !== "" ? String(name) : "Nome da Pessoa";
  };

  var driverIdInput = document.getElementById("driver-id-input");
  if (driverIdInput) {
    driverIdInput.placeholder = "Digite o ID do motorista (autocomplete)";
  }

  if (driverIdInput) {
    driverIdInput.addEventListener("input", function () {
      var q = driverIdInput.value.trim();
      if (q.length < 1) { hideSuggestions(); return; }
      fetchMotoristaIds(q, showSuggestions);
    });
    driverIdInput.addEventListener("focus", function () {
      var q = driverIdInput.value.trim();
      fetchMotoristaIds(q, showSuggestions);
    });
    driverIdInput.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        hideSuggestions();
        return;
      }
      var list = document.getElementById("driver-id-suggestions");
      if (!list || list.getAttribute("aria-hidden") === "true") {
        if (e.key === "Enter") {
          e.preventDefault();
          triggerDriverSearch();
        }
        return;
      }
      var items = list.querySelectorAll(".driver-id-suggestion-item");
      if (items.length === 0) {
        if (e.key === "Enter") {
          e.preventDefault();
          triggerDriverSearch();
        }
        return;
      }
      var idx = getHighlightedSuggestionIndex();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        var next = idx < 0 ? 0 : Math.min(idx + 1, items.length - 1);
        setHighlightedSuggestion(next);
        items[next].scrollIntoView({ block: "nearest" });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        var prev = idx <= 0 ? items.length - 1 : Math.max(idx - 1, 0);
        setHighlightedSuggestion(prev);
        items[prev].scrollIntoView({ block: "nearest" });
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (idx >= 0 && idx < items.length) {
          driverIdInput.value = items[idx].textContent;
        }
        hideSuggestions();
        triggerDriverSearch();
      }
    });
  }
  document.addEventListener("click", function (e) {
    var list = document.getElementById("driver-id-suggestions");
    var input = document.getElementById("driver-id-input");
    if (list && input && !list.contains(e.target) && !input.contains(e.target)) hideSuggestions();
  });

function triggerDriverSearch() {
  var id = window.getDriverIdForSearch();
  if (!id) {
    var flag = document.getElementById("drive-safety-flag");
    var textEl = flag && flag.querySelector(".drive-safety-text");
    if (textEl) textEl.textContent = "Digite o ID do motorista e pesquise.";
    return;
  }
  loadAlertasForMotorista(id);
  try {
    window.dispatchEvent(new CustomEvent("driverSearchRequested", { detail: { driverId: id } }));
  } catch (e) {}
}

var driverSearchBtn = document.getElementById("driver-search-btn");
if (driverSearchBtn) {
  driverSearchBtn.addEventListener("click", function () {
    hideSuggestions();
    triggerDriverSearch();
  });
}

window.triggerDriverSearch = triggerDriverSearch;

window.updateDriverViewFromDatabricks = function (statusMap) {
  if (statusMap && typeof statusMap === "object") {
    Object.keys(statusMap).forEach(function (id) {
      if (statusPorId.hasOwnProperty(id)) statusPorId[id] = statusMap[id];
    });
  }
  renderCarPoints();
  renderTable();
  updateDriveSafetyFlag();
};

window.setDriverViewDataFromDatabricks = function (rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  ITENS = rows.map(function (r) {
    var id = r.id != null ? String(r.id) : "";
    var titulo = r.titulo != null ? String(r.titulo) : "";
    var descricao = r.descricao != null ? String(r.descricao) : "";
    var solucao = r.solucao != null ? String(r.solucao) : "";
    var status = (r.status && String(r.status).toLowerCase()) || "ok";
    if (status !== "ok" && status !== "warn" && status !== "crit") status = "ok";
    statusPorId[id] = status;
    return {
      id: id,
      titulo: titulo,
      descricao: descricao,
      solucao: solucao,
      top: r.top != null ? r.top : r.pos_top,
      left: r.left != null ? r.left : r.pos_left,
      arrow: r.arrow != null ? r.arrow : r.pos_arrow,
      ponto: r.ponto != null ? r.ponto : ""
    };
    });
    renderCarPoints();
    renderTable();
    updateDriveSafetyFlag();
  };
})();
