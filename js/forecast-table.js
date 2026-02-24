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

  var lastRows = [];
  var sortKey = null;
  var sortAsc = true;

  function formatNum(n) {
    if (n == null || n === "" || isNaN(Number(n))) return "–";
    return Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  }

  function formatPct(n) {
    if (n == null || n === "" || isNaN(Number(n))) return "–";
    return Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
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
    if (key === "vendas" || key === "previsao" || key === "acuracia_pct") {
      var na = parseAsNumber(va);
      var nb = parseAsNumber(vb);
      if (isNaN(na) && isNaN(nb)) return 0;
      if (isNaN(na)) return 1;
      if (isNaN(nb)) return -1;
      return na - nb;
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

  function updateSortHeader(activeKey, asc) {
    targets.forEach(function (t) {
      t.table.querySelectorAll("thead th.sortable").forEach(function (th) {
        var k = th.getAttribute("data-sort");
        th.classList.remove("sort-asc", "sort-desc");
        if (k === activeKey) th.classList.add(asc ? "sort-asc" : "sort-desc");
      });
    });
  }

  function renderRows(rows) {
    targets.forEach(function (t) {
      var tb = t.tbody;
      tb.innerHTML = "";
      if (!rows || rows.length === 0) {
        var tr = document.createElement("tr");
        tr.innerHTML = "<td colspan=\"6\">Nenhum dado disponível. Verifique se o backend e o warehouse estão configurados.</td>";
        tb.appendChild(tr);
        return;
      }
      rows.forEach(function (r) {
        var tr = document.createElement("tr");
        var vendas = r.vendas != null ? Number(r.vendas) : null;
        var previsao = r.previsao != null ? Number(r.previsao) : null;
        var acuracia = r.acuracia_pct != null ? Number(r.acuracia_pct) : null;
        tr.innerHTML =
          "<td>" + (r.parceiro != null ? String(r.parceiro) : "–") + "</td>" +
          "<td>" + (r.regiao != null ? String(r.regiao) : "–") + "</td>" +
          "<td>" + formatDate(r.periodo) + "</td>" +
          "<td>" + formatNum(vendas) + "</td>" +
          "<td>" + (previsao != null ? "<span class=\"num-positive\">" + formatNum(previsao) + "</span>" : "–") + "</td>" +
          "<td>" + formatPct(acuracia) + "</td>";
        tb.appendChild(tr);
      });
    });
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

  function updateForecastMetrics(rows) {
    var elAcuracia = document.getElementById("forecast-tile-acuracia");
    var elMape = document.getElementById("forecast-tile-mape");
    var elRmse = document.getElementById("forecast-tile-rmse");
    var elBias = document.getElementById("forecast-tile-bias");
    var elStatus = document.getElementById("forecast-tile-status");
    var wrapStatus = document.getElementById("forecast-tile-status-wrap");
    if (!elAcuracia || !elMape || !elRmse || !elBias || !elStatus || !wrapStatus) return;
    var m = computeForecastMetrics(rows || []);
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
    return base.replace(/\/$/, "") + "/api/forecast";
  }

  function getFilterParams() {
    var storeEl = document.getElementById("aao-filter-loja");
    var productIdEl = document.getElementById("aao-filter-produto-id");
    var storeId = storeEl && storeEl.value ? String(storeEl.value).trim() : "";
    var productId = productIdEl && productIdEl.value ? String(productIdEl.value).trim() : "";
    return { storeId: storeId, productId: productId };
  }

  function loadForecast() {
    targets.forEach(function (t) {
      if (t.loadingRow) t.loadingRow.style.display = "";
    });
    var baseUrl = getForecastBaseUrl();
    var params = getFilterParams();
    var qs = [];
    if (params.storeId) qs.push("store_id=" + encodeURIComponent(params.storeId));
    if (params.productId) qs.push("product_id=" + encodeURIComponent(params.productId));
    var apiUrl = qs.length ? baseUrl + "?" + qs.join("&") : baseUrl;
    fetch(apiUrl)
      .then(function (res) {
        var ct = (res.headers.get("Content-Type") || "").toLowerCase();
        var isJson = ct.indexOf("application/json") !== -1;
        if (!res.ok) {
          return res.text().then(function (text) {
            var msg = res.status + "";
            if (isJson) try { var j = JSON.parse(text); if (j && j.error) msg = j.error; } catch (e) {}
            else if (text && text.trim().substring(0, 1) === "<") msg = "Resposta em HTML (status " + res.status + "). O backend está rodando? A URL da página é a mesma do servidor (ex.: http://localhost:8080)?";
            else if (text) msg = text.substring(0, 120);
            throw new Error(msg);
          });
        }
        if (!isJson) return res.text().then(function () { throw new Error("Resposta não é JSON. Backend retornou HTML ou outro formato."); });
        return res.json();
      })
      .then(function (data) {
        targets.forEach(function (t) {
          if (t.loadingRow) t.loadingRow.style.display = "none";
        });
        lastRows = data.rows || [];
        var toRender = sortKey ? sortRows(lastRows, sortKey, sortAsc) : lastRows;
        renderRows(toRender);
        updateSortHeader(sortKey, sortAsc);
        updateForecastMetrics(lastRows);
      })
      .catch(function (err) {
        updateForecastMetrics([]);
        targets.forEach(function (t) {
          if (t.loadingRow) t.loadingRow.style.display = "none";
          t.tbody.innerHTML = "";
          var tr = document.createElement("tr");
          tr.innerHTML = "<td colspan=\"6\">Erro ao carregar: " + (err.message || "Erro desconhecido") + ".</td>";
          t.tbody.appendChild(tr);
        });
      });
  }

  function onPanelVisible() {
    var panel = document.getElementById("panel-pac");
    if (!panel || !panel.classList.contains("active")) return;
    loadForecast();
  }

  targets.forEach(function (t) {
    t.table.querySelectorAll("thead th.sortable").forEach(function (th) {
      th.addEventListener("click", function () {
        var key = th.getAttribute("data-sort");
        if (!key) return;
        if (sortKey === key) sortAsc = !sortAsc;
        else { sortKey = key; sortAsc = true; }
        var sorted = sortRows(lastRows, sortKey, sortAsc);
        renderRows(sorted);
        updateSortHeader(sortKey, sortAsc);
      });
    });
  });

  window.refreshForecastTable = loadForecast;

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
