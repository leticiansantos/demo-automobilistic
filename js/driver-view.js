/**
 * Visão do Motorista: pontos no carro, tabela de alertas, bandeira seguro para dirigir, hover, APIs window.
 * Usa dados mockados até a integração com Databricks.
 */
(function () {
  // Dados mockados – substituídos pela integração Databricks (setDriverViewDataFromDatabricks / updateDriverViewFromDatabricks)
var ITENS = [
  { id: "1", titulo: "Check engine", descricao: "Luz de motor acesa. Indica que o sistema de diagnóstico identificou uma falha.", solucao: "Recomenda-se verificar o veículo em uma oficina autorizada e ler os códigos OBD2.", ponto: "motor", top: "50%", left: "18%", arrow: "bottom" },
  { id: "2", titulo: "Motor e ignição", descricao: "Possível falha de ignição (misfire). Pode causar perda de potência e consumo elevado.", solucao: "Verificar velas, bobinas e sistema de combustível. Evitar acelerações fortes até a revisão.", ponto: "motor", top: "50%", left: "18%", arrow: "bottom" },
  { id: "3", titulo: "Temperatura do motor", descricao: "Temperatura do motor elevada. Risco de superaquecimento.", solucao: "Parar com segurança, desligar o motor e verificar nível do líquido de arrefecimento e radiador.", ponto: "motor", top: "50%", left: "18%", arrow: "bottom" },
  { id: "4", titulo: "Bateria e alternador", descricao: "Tensão da bateria baixa ou falha no sistema de carga.", solucao: "Verificar alternador, correia e bornes da bateria. Trocar bateria se necessário.", ponto: "eletrico", top: "54%", left: "25%", arrow: "right" },
  { id: "5", titulo: "Sensores MAF/MAP", descricao: "Sensor de fluxo ou pressão de ar com leitura anômala.", solucao: "Verificar admissão de ar, mangueiras e limpar ou substituir o sensor conforme diagnóstico.", ponto: "sensores", top: "50%", left: "18%", arrow: "right" },
  { id: "6", titulo: "Posição do acelerador", descricao: "Sensor do pedal/acelerador com comportamento irregular.", solucao: "Pode afetar resposta do motor. Verificar sensor e fiação em oficina.", ponto: "sensores", top: "65%", left: "38%", arrow: "top" },
  { id: "7", titulo: "Sistema de combustível", descricao: "Sistema de combustível com anomalia ou consumo acima do esperado.", solucao: "Agendar verificação. Verificar filtro de combustível, bicos e pressão.", ponto: "combustivel", top: "52%", left: "76%", arrow: "top" },
  { id: "8", titulo: "Transmissão automática", descricao: "Sistema de transmissão detectou irregularidade.", solucao: "Evitar esforços e agendar diagnóstico. Verificar fluido e sensores.", ponto: "transmissao", top: "65%", left: "38%", arrow: "top" },
  { id: "9", titulo: "Emissões / Catalisador", descricao: "Eficiência do catalisador reduzida ou sonda lambda com problema.", solucao: "Verificar sistema de escapamento e sondas. Pode afetar consumo e emissões.", ponto: "emissoes", top: "64%", left: "87%", arrow: "left" },
  { id: "10", titulo: "Sistema ABS/estabilidade", descricao: "Sistema de freios ou controle de estabilidade com falha.", solucao: "Dirigir com cautela e verificar sensores de roda e módulo ABS.", ponto: "freios", top: "70%", left: "78%", arrow: "top" },
  { id: "11", titulo: "Airbag / segurança", descricao: "Sistema de airbag ou suplementar de segurança com falha.", solucao: "Verificar o veículo em oficina. Luz no painel indica necessidade de diagnóstico.", ponto: "airbag", top: "47%", left: "44%", arrow: "bottom" },
  { id: "12", titulo: "Comunicação entre módulos", descricao: "Falha de comunicação entre módulos eletrônicos (CAN).", solucao: "Recomenda-se diagnóstico completo. Pode estar relacionado a bateria ou conectores.", ponto: "eletrico", top: "54%", left: "25%", arrow: "bottom" }
];

var statusPorId = {};
ITENS.forEach(function (item) { statusPorId[item.id] = "ok"; });
statusPorId["1"] = "crit";
statusPorId["3"] = "warn";
statusPorId["9"] = "crit";
statusPorId["4"] = "warn";

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

window.getDriverIdForSearch = function () {
  var el = document.getElementById("driver-id-input");
  return el ? el.value.trim() : "";
};

  window.setWelcomeUserName = function (name) {
    var el = document.getElementById("welcome-name");
    if (el) el.textContent = name != null && name !== "" ? String(name) : "Nome da Pessoa";
  };

  // Inicialização com dados mockados até a integração Databricks
  var MOCK_DRIVER_NAME = "Maria Silva";
  var MOCK_DRIVER_ID = "MOT-2025-001";
  window.setWelcomeUserName(MOCK_DRIVER_NAME);
  var driverIdInput = document.getElementById("driver-id-input");
  if (driverIdInput) {
    driverIdInput.placeholder = "Ex.: " + MOCK_DRIVER_ID + " (dados mock)";
    driverIdInput.value = MOCK_DRIVER_ID;
  }

  if (driverIdInput) {
    driverIdInput.addEventListener("input", function () {
      if (window.onDriverIdSearchChange) window.onDriverIdSearchChange(window.getDriverIdForSearch());
    });
  }

function triggerDriverSearch() {
  var id = window.getDriverIdForSearch();
  if (window.onDriverSearch) {
    window.onDriverSearch(id);
  } else if (window.onDriverIdSearchChange) {
    window.onDriverIdSearchChange(id);
  }
  try {
    window.dispatchEvent(new CustomEvent("driverSearchRequested", { detail: { driverId: id } }));
  } catch (e) {}
}

var driverSearchBtn = document.getElementById("driver-search-btn");
if (driverSearchBtn) {
  driverSearchBtn.addEventListener("click", function () {
    triggerDriverSearch();
    if (!window.onDriverSearch && !window.onDriverIdSearchChange) {
      // Modo mock: dados já exibidos; opcionalmente poderia mostrar um toast
    }
  });
}

if (driverIdInput) {
  driverIdInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") triggerDriverSearch();
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
