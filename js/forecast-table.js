/**
 * Tabelas "Previsão de quantidade de vendas" (Por loja / Por produto) – carrega dados de /api/forecast.
 */
(function () {
  var tableIds = ["forecast-table", "forecast-table-produto"];
  var targets = [];
  tableIds.forEach(function (id) {
    var table = document.getElementById(id);
    if (!table) return;
    var tbody = table.querySelector("tbody");
    var loadingRow = table.querySelector("tr.forecast-loading");
    if (tbody) targets.push({ table: table, tbody: tbody, loadingRow: loadingRow || null });
  });
  if (!targets.length) return;

  var lastRowsByTable = { 0: [], 1: [] };
  var sortState = { 0: { key: null, asc: true }, 1: { key: null, asc: true } };
  var paginationState = { 0: { page: 1, pageSize: 10 }, 1: { page: 1, pageSize: 10 } };
  var PRODUTO_TABLE_ID = "forecast-table-produto";
  var PAGINATION_SUFFIX = ["loja", "produto"];

  function formatNum(n) {
    if (n == null || n === "" || isNaN(Number(n))) return "–";
    return Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  }

  function formatPct(n) {
    if (n == null || n === "" || isNaN(Number(n))) return "–";
    return Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
  }

  function formatDeviationPct(vendas, previsao) {
    if (vendas == null || previsao == null || vendas === 0) return "–";
    var v = Number(vendas);
    var p = Number(previsao);
    if (isNaN(v) || isNaN(p)) return "–";
    var diff = ((p - v) / v) * 100;
    var formatted = Math.abs(diff).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
    if (diff > 0) return "+" + formatted;
    if (diff < 0) return "-" + formatted;
    return "0,0%";
  }

  function formatDate(val) {
    if (val == null || val === "") return "–";
    var d = typeof val === "string" ? new Date(val) : val;
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });
  }

  function parseAsDate(val) {
    if (val == null || val === "") return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    var d = typeof val === "number" ? new Date(val) : new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  function parseAsNumber(val) {
    if (val == null || val === "") return NaN;
    var n = Number(val);
    return isNaN(n) ? NaN : n;
  }

  function compareVal(a, b, key) {
    var va = a[key];
    var vb = b[key];
    if (key === "periodo") {
      var da = parseAsDate(va);
      var db = parseAsDate(vb);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.getTime() - db.getTime();
    }
    if (key === "vendas" || key === "previsao" || key === "acuracia_pct" || key === "product_id") {
      var na = parseAsNumber(va);
      var nb = parseAsNumber(vb);
      if (isNaN(na) && isNaN(nb)) return 0;
      if (isNaN(na)) return 1;
      if (isNaN(nb)) return -1;
      return na - nb;
    }
    if (key === "risco_estoque") {
      var order = { baixo: 0, medio: 1, alto: 2 };
      var ra = order[(va != null ? String(va) : "").toLowerCase()];
      var rb = order[(vb != null ? String(vb) : "").toLowerCase()];
      if (ra == null) ra = -1;
      if (rb == null) rb = -1;
      return ra - rb;
    }
    var sa = (va != null ? String(va) : "").toLowerCase();
    var sb = (vb != null ? String(vb) : "").toLowerCase();
    return sa.localeCompare(sb, "pt-BR");
  }

  function sortRows(rows, key, asc) {
    if (!rows || rows.length === 0 || !key) return rows;
    var out = rows.slice();
    out.sort(function (a, b) {
      var c = compareVal(a, b, key);
      return asc ? c : -c;
    });
    return out;
  }

  function getTargetIndex(table) {
    return table && table.id === PRODUTO_TABLE_ID ? 1 : 0;
  }

  function updateSortHeader(activeKey, asc, targetIndex) {
    var t = targets[targetIndex];
    if (!t) return;
    t.table.querySelectorAll("thead th.sortable").forEach(function (th) {
      var k = th.getAttribute("data-sort");
      th.classList.remove("sort-asc", "sort-desc");
      if (k === activeKey) th.classList.add(asc ? "sort-asc" : "sort-desc");
    });
  }

  function renderRowLoja(r) {
    var vendas = r.vendas != null ? Number(r.vendas) : null;
    var previsao = r.previsao != null ? Number(r.previsao) : null;
    var acuraciaCell = formatDeviationPct(vendas, previsao);
    return (
      "<td>" + (r.parceiro != null ? String(r.parceiro) : "–") + "</td>" +
      "<td>" + (r.regiao != null ? String(r.regiao) : "–") + "</td>" +
      "<td>" + formatDate(r.periodo) + "</td>" +
      "<td>" + formatNum(vendas) + "</td>" +
      "<td>" + (previsao != null ? "<span class=\"num-positive\">" + formatNum(previsao) + "</span>" : "–") + "</td>" +
      "<td>" + acuraciaCell + "</td>"
    );
  }

  function formatProdutoCell(r) {
    var name = r.product_name != null ? String(r.product_name).trim() : "";
    var sku = r.product_sku != null ? String(r.product_sku).trim() : "";
    if (!name && !sku) return "–";
    if (name && sku) return name + " (" + sku + ")";
    return name || sku;
  }

  function renderRowProduto(r) {
    var vendas = r.vendas != null ? Number(r.vendas) : null;
    var previsao = r.previsao != null ? Number(r.previsao) : null;
    var acuraciaCell = formatDeviationPct(vendas, previsao);
    var risco = (r.risco_estoque != null ? String(r.risco_estoque) : "").toLowerCase();
    var riscoLabel = risco === "alto" ? "Alto" : risco === "medio" ? "Médio" : risco === "baixo" ? "Baixo" : "–";
    var riscoClass = risco === "alto" ? "risco-alto" : risco === "medio" ? "risco-medio" : risco === "baixo" ? "risco-baixo" : "";
    return (
      "<td>" + formatDate(r.periodo) + "</td>" +
      "<td>" + formatProdutoCell(r) + "</td>" +
      "<td>" + formatNum(vendas) + "</td>" +
      "<td>" + (previsao != null ? "<span class=\"num-positive\">" + formatNum(previsao) + "</span>" : "–") + "</td>" +
      "<td>" + acuraciaCell + "</td>" +
      "<td>" + (riscoClass ? "<span class=\"forecast-risco-tile " + riscoClass + "\">" + riscoLabel + "</span>" : "–") + "</td>"
    );
  }

  function renderRows(rows, targetIndex) {
    var t = targets[targetIndex];
    if (!t) return;
    var tb = t.tbody;
    var isProduto = targetIndex === 1;
    var colspan = isProduto ? 6 : 6;
    tb.innerHTML = "";
    if (!rows || rows.length === 0) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td colspan=\"" + colspan + "\">Nenhum dado disponível. Verifique se o backend e o warehouse estão configurados.</td>";
      tb.appendChild(tr);
      return;
    }
    rows.forEach(function (r) {
      var tr = document.createElement("tr");
      tr.innerHTML = isProduto ? renderRowProduto(r) : renderRowLoja(r);
      tb.appendChild(tr);
    });
  }

  function getSortedRows(targetIndex) {
    var rows = lastRowsByTable[targetIndex] || [];
    var state = sortState[targetIndex];
    return state.key ? sortRows(rows, state.key, state.asc) : rows;
  }

  function renderTablePage(targetIndex) {
    var fullRows = getSortedRows(targetIndex);
    var total = fullRows.length;
    var ps = paginationState[targetIndex];
    var page = Math.max(1, Math.min(ps.page, total === 0 ? 1 : Math.ceil(total / ps.pageSize)));
    ps.page = page;
    var start = (page - 1) * ps.pageSize;
    var end = Math.min(start + ps.pageSize, total);
    var pageRows = fullRows.slice(start, end);
    renderRows(pageRows, targetIndex);
    updatePaginationUI(targetIndex, total);
  }

  function updatePaginationUI(targetIndex, total) {
    var suffix = PAGINATION_SUFFIX[targetIndex];
    var infoEl = document.getElementById("forecast-pagination-info-" + suffix);
    var pagesEl = document.getElementById("forecast-pagination-pages-" + suffix);
    var prevBtn = document.getElementById("forecast-pagination-prev-" + suffix);
    var nextBtn = document.getElementById("forecast-pagination-next-" + suffix);
    var ps = paginationState[targetIndex];
    var totalPages = total === 0 ? 1 : Math.ceil(total / ps.pageSize);
    var start = total === 0 ? 0 : (ps.page - 1) * ps.pageSize + 1;
    var end = Math.min(ps.page * ps.pageSize, total);
    if (infoEl) infoEl.textContent = total === 0 ? "0 registros" : start + "–" + end + " de " + total.toLocaleString("pt-BR") + " registros";
    if (pagesEl) pagesEl.textContent = "Página " + ps.page + " de " + totalPages;
    if (prevBtn) prevBtn.disabled = ps.page <= 1;
    if (nextBtn) nextBtn.disabled = ps.page >= totalPages || total === 0;
  }

  function computeForecastMetrics(rows) {
    var r = rows || [];
    var acuraciaVals = r.map(function (x) { return x.acuracia_pct != null && x.acuracia_pct !== "" ? Number(x.acuracia_pct) : NaN; }).filter(function (n) { return !isNaN(n); });
    var acuraciaGeral = acuraciaVals.length ? acuraciaVals.reduce(function (a, b) { return a + b; }, 0) / acuraciaVals.length : null;
    var vendas = r.map(function (x) { return x.vendas != null && x.vendas !== "" ? Number(x.vendas) : NaN; });
    var previsao = r.map(function (x) { return x.previsao != null && x.previsao !== "" ? Number(x.previsao) : NaN; });
    var n = 0;
    var mapeSum = 0;
    var sqSum = 0;
    var biasSum = 0;
    for (var i = 0; i < r.length; i++) {
      var v = vendas[i];
      var p = previsao[i];
      if (isNaN(v) || isNaN(p)) continue;
      if (v > 0) {
        mapeSum += Math.abs(v - p) / v * 100;
        n++;
      }
      sqSum += (v - p) * (v - p);
      biasSum += p - v;
    }
    var mape = n > 0 ? mapeSum / n : null;
    var rmse = r.length > 0 ? Math.sqrt(sqSum / r.length) : null;
    var bias = r.length > 0 ? biasSum / r.length : null;
    var status = null;
    if (mape != null) {
      if (mape < 5) status = { key: "good", label: "Bom" };
      else if (mape < 10) status = { key: "medium", label: "Atenção" };
      else status = { key: "bad", label: "Ruim" };
    }
    return { acuraciaGeral: acuraciaGeral, mape: mape, rmse: rmse, bias: bias, status: status };
  }

  function updateForecastMetrics(rows, suffix) {
    var m = computeForecastMetrics(rows || []);
    var elAcuracia = document.getElementById("forecast-tile-acuracia" + suffix);
    var elMape = document.getElementById("forecast-tile-mape" + suffix);
    var elRmse = document.getElementById("forecast-tile-rmse" + suffix);
    var elBias = document.getElementById("forecast-tile-bias" + suffix);
    var elStatus = document.getElementById("forecast-tile-status" + suffix);
    var wrapStatus = document.getElementById("forecast-tile-status-wrap" + suffix);
    if (!elAcuracia || !elMape || !elRmse || !elBias || !elStatus || !wrapStatus) return;
    elAcuracia.textContent = m.acuraciaGeral != null ? m.acuraciaGeral.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%" : "–";
    elMape.textContent = m.mape != null ? m.mape.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%" : "–";
    elRmse.textContent = m.rmse != null ? Math.round(m.rmse).toLocaleString("pt-BR") : "–";
    elBias.textContent = m.bias != null ? (m.bias >= 0 ? "+" : "") + m.bias.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "–";
    elStatus.textContent = m.status ? m.status.label : "–";
    wrapStatus.classList.remove("status-good", "status-medium", "status-bad", "status-neutral");
    wrapStatus.classList.add(m.status ? "status-" + m.status.key : "status-neutral");
  }

  function getForecastBaseUrl() {
    var p = window.location.pathname || "/";
    var base = p.endsWith("/") ? p : p.replace(/\/[^/]*$/, "") || "/";
    return base.replace(/\/$/, "");
  }

  function getFilterParams() {
    var storeEl = document.getElementById("aao-filter-loja");
    var productIdEl = document.getElementById("aao-filter-produto-id");
    var storeVal = storeEl && storeEl.value != null ? String(storeEl.value).trim() : "";
    var storeId = storeVal !== "" ? storeVal : "";
    var productId = productIdEl && productIdEl.value != null ? String(productIdEl.value).trim() : "";
    return { storeId: storeId, productId: productId };
  }

  function fetchJson(url) {
    return fetch(url).then(function (res) {
      var ct = (res.headers.get("Content-Type") || "").toLowerCase();
      var isJson = ct.indexOf("application/json") !== -1;
      if (!res.ok) {
        return res.text().then(function (text) {
          var msg = res.status + "";
          if (isJson) try { var j = JSON.parse(text); if (j && j.error) msg = j.error; } catch (e) {}
          else if (text && text.trim().substring(0, 1) === "<") msg = "Resposta em HTML (status " + res.status + ").";
          else if (text) msg = text.substring(0, 120);
          throw new Error(msg);
        });
      }
      if (!isJson) return res.text().then(function () { throw new Error("Resposta não é JSON."); });
      return res.json();
    });
  }

  function loadForecast() {
    targets.forEach(function (t) {
      if (t.loadingRow) t.loadingRow.style.display = "";
    });
    var base = getForecastBaseUrl();
    var params = getFilterParams();
    var qsLoja = [];
    if (params.storeId) qsLoja.push("store_id=" + encodeURIComponent(params.storeId));
    var qsProduto = [];
    if (params.productId) qsProduto.push("product_id=" + encodeURIComponent(params.productId));
    var urlLoja = base + "/api/forecast" + (qsLoja.length ? "?" + qsLoja.join("&") : "");
    var urlProduto = base + "/api/forecast-by-product" + (qsProduto.length ? "?" + qsProduto.join("&") : "");

    Promise.all([
      fetchJson(urlLoja).then(function (data) { return data.rows || []; }),
      fetchJson(urlProduto).then(function (data) { return data.rows || []; }),
    ])
      .then(function (results) {
        var lojaRows = results[0];
        var prodRows = results[1];
        targets.forEach(function (t) { if (t.loadingRow) t.loadingRow.style.display = "none"; });
        lastRowsByTable[0] = lojaRows;
        lastRowsByTable[1] = prodRows;
        paginationState[0].page = 1;
        paginationState[1].page = 1;
        var s0 = sortState[0];
        var s1 = sortState[1];
        updateSortHeader(s0.key, s0.asc, 0);
        updateSortHeader(s1.key, s1.asc, 1);
        renderTablePage(0);
        renderTablePage(1);
        updateForecastMetrics(lojaRows, "");
        updateForecastMetrics(prodRows, "-produto");
        if (typeof window.updateForecastChartFromTableData === "function") {
          window.updateForecastChartFromTableData("loja", lojaRows);
          window.updateForecastChartFromTableData("produto", prodRows);
        }
        if (typeof window.updateMetricsProduct === "function") window.updateMetricsProduct();
      })
      .catch(function (err) {
        targets.forEach(function (t) {
          if (t.loadingRow) t.loadingRow.style.display = "none";
          t.tbody.innerHTML = "";
          var tr = document.createElement("tr");
          var colspan = t.table.id === PRODUTO_TABLE_ID ? 6 : 6;
          tr.innerHTML = "<td colspan=\"" + colspan + "\">Erro ao carregar: " + (err.message || "Erro desconhecido") + ".</td>";
          t.tbody.appendChild(tr);
        });
        lastRowsByTable[0] = [];
        lastRowsByTable[1] = [];
        updatePaginationUI(0, 0);
        updatePaginationUI(1, 0);
        updateForecastMetrics([], "");
        updateForecastMetrics([], "-produto");
      });
  }

  function onPanelVisible() {
    var panel = document.getElementById("panel-pac");
    if (!panel || !panel.classList.contains("active")) return;
    loadForecast();
  }

  targets.forEach(function (t, targetIndex) {
    t.table.querySelectorAll("thead th.sortable").forEach(function (th) {
      th.addEventListener("click", function () {
        var key = th.getAttribute("data-sort");
        if (!key) return;
        var state = sortState[targetIndex];
        if (state.key === key) state.asc = !state.asc;
        else { state.key = key; state.asc = true; }
        paginationState[targetIndex].page = 1;
        updateSortHeader(state.key, state.asc, targetIndex);
        renderTablePage(targetIndex);
      });
    });
  });

  PAGINATION_SUFFIX.forEach(function (suffix, targetIndex) {
    var prevBtn = document.getElementById("forecast-pagination-prev-" + suffix);
    var nextBtn = document.getElementById("forecast-pagination-next-" + suffix);
    var pageSizeSelect = document.getElementById("forecast-page-size-" + suffix);
    if (prevBtn) prevBtn.addEventListener("click", function () {
      var ps = paginationState[targetIndex];
      if (ps.page > 1) { ps.page--; renderTablePage(targetIndex); }
    });
    if (nextBtn) nextBtn.addEventListener("click", function () {
      var ps = paginationState[targetIndex];
      var total = (getSortedRows(targetIndex) || []).length;
      var totalPages = total === 0 ? 1 : Math.ceil(total / ps.pageSize);
      if (ps.page < totalPages) { ps.page++; renderTablePage(targetIndex); }
    });
    if (pageSizeSelect) pageSizeSelect.addEventListener("change", function () {
      var val = parseInt(pageSizeSelect.value, 10);
      if (!isNaN(val) && val > 0) {
        paginationState[targetIndex].pageSize = val;
        paginationState[targetIndex].page = 1;
        renderTablePage(targetIndex);
      }
    });
  });

  window.refreshForecastTable = loadForecast;

  window.getForecastTableRows = function () {
    return { loja: lastRowsByTable[0] || [], produto: lastRowsByTable[1] || [] };
  };

  var storeSelect = document.getElementById("aao-filter-loja");
  if (storeSelect) storeSelect.addEventListener("change", loadForecast);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      onPanelVisible();
      document.querySelector("a[data-panel=\"pac\"]")?.addEventListener("click", function () {
        setTimeout(loadForecast, 100);
      });
    });
  } else {
    onPanelVisible();
    document.querySelector("a[data-panel=\"pac\"]")?.addEventListener("click", function () {
      setTimeout(loadForecast, 100);
    });
  }
})();
