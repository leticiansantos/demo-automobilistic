/**
 * Gráfico de comparação demanda real vs previsão (histórico + futuro), com linha vertical de corte.
 */
(function () {
  var canvas = document.getElementById("forecast-chart-canvas");
  var canvasProduto = document.getElementById("forecast-chart-canvas-produto");
  if (!canvas && !canvasProduto) return;

  var chartInstance = null;
  var chartInstanceProduto = null;
  var currentPeriod = "monthly";

  function getChartBaseUrl() {
    var p = window.location.pathname || "/";
    var base = p.endsWith("/") ? p : p.replace(/\/[^/]*$/, "") || "/";
    return base.replace(/\/$/, "");
  }

  function getChartApiUrl() {
    return getChartBaseUrl() + "/api/forecast-chart";
  }

  function getStoreId() {
    var el = document.getElementById("aao-filter-loja");
    return el && el.value != null ? String(el.value).trim() : "";
  }

  function getProductId() {
    var el = document.getElementById("aao-filter-produto-id");
    return el && el.value != null ? String(el.value).trim() : "";
  }

  var verticalLinePlugin = {
    id: "forecastVerticalLine",
    afterDraw: function (chart, args, opts) {
      var idx = (opts && opts.cutoffIndex != null) ? opts.cutoffIndex : (chart.config && chart.config._cutoffIndex);
      if (idx == null || idx < 0) return;
      var ctx = chart.ctx;
      var xScale = chart.scales.x;
      if (!xScale) return;
      var x = xScale.getPixelForValue(chart.data.labels[idx], idx);
      if (x == null || isNaN(x)) x = xScale.getPixelForValue(idx);
      var top = chart.scales.y ? chart.scales.y.top : 0;
      var bottom = chart.scales.y ? chart.scales.y.bottom : chart.height;
      ctx.save();
      ctx.strokeStyle = "#c96a0a";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      ctx.restore();
    },
  };

  var hoverVerticalLinePlugin = {
    id: "forecastHoverLine",
    afterDraw: function (chart) {
      var active = chart.getActiveElements();
      if (!active || active.length === 0) return;
      var idx = active[0].index;
      var ctx = chart.ctx;
      var xScale = chart.scales.x;
      if (!xScale) return;
      var x = xScale.getPixelForValue(chart.data.labels[idx], idx);
      if (x == null || isNaN(x)) x = xScale.getPixelForValue(idx);
      var top = chart.scales.y ? chart.scales.y.top : 0;
      var bottom = chart.scales.y ? chart.scales.y.bottom : chart.height;
      ctx.save();
      ctx.strokeStyle = "rgba(0, 33, 87, 0.5)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      ctx.restore();
    },
  };

  function formatLabel(period, isAnnual) {
    if (isAnnual) return period;
    var d = new Date(period);
    if (isNaN(d.getTime())) return period;
    var m = d.getMonth() + 1;
    var y = d.getFullYear();
    return m + "/" + y;
  }

  function buildChartConfig(payload) {
    var data = payload.data || [];
    var cutoffPeriod = payload.cutoffPeriod;
    var isAnnual = payload.period === "annual";
    var labels = data.map(function (d) { return formatLabel(d.period, isAnnual); });
    var actualData = data.map(function (d) { return d.actual; });
    var forecastData = data.map(function (d) { return d.forecast; });
    var cutoffIndex = data.findIndex(function (d) { return d.isFuture === true; });
    if (cutoffIndex < 0 && cutoffPeriod != null) {
      cutoffIndex = data.findIndex(function (d) {
        return String(d.period) === String(cutoffPeriod) || periodToTime(d.period) === periodToTime(cutoffPeriod);
      });
    }

    var chartPayload = { data: data, period: payload.period };
    return {
      _cutoffIndex: cutoffIndex,
      _payload: chartPayload,
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Demanda real",
            data: actualData,
            borderColor: "#002157",
            backgroundColor: "rgba(0, 33, 87, 0.08)",
            borderWidth: 2,
            fill: false,
            tension: 0.2,
            pointRadius: 4,
          },
          {
            label: "Previsão",
            data: forecastData,
            borderColor: "#0093D0",
            backgroundColor: "rgba(0, 147, 208, 0.06)",
            borderWidth: 2,
            borderDash: [6, 4],
            fill: false,
            tension: 0.2,
            pointRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: "index" },
        plugins: {
          forecastVerticalLine: { cutoffIndex: cutoffIndex },
          legend: { display: false },
          tooltip: {
            enabled: true,
            mode: "index",
            intersect: false,
            backgroundColor: "#e8e8e8",
            titleColor: "#1a1a1a",
            bodyColor: "#333",
            borderColor: "rgba(0, 0, 0, 0.12)",
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            titleFont: { size: 13, weight: "bold" },
            bodyFont: { size: 12 },
            displayColors: true,
            callbacks: {
              labelColor: function (ctx) {
                var color = ctx.dataset.borderColor || ctx.dataset.backgroundColor;
                return { borderColor: color, backgroundColor: color };
              },
              title: function (items) {
                if (items.length && items[0].label) return items[0].label;
                return "";
              },
              label: function (ctx) {
                var label = ctx.dataset.label || "";
                var value = ctx.parsed.y;
                var formatted = value != null && !isNaN(value)
                  ? Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 0 })
                  : "–";
                var payloadData = chartPayload.data[ctx.dataIndex];
                var suffix = payloadData && payloadData.isFuture ? " (futuro)" : "";
                return label + ": " + formatted + suffix;
              },
              afterBody: function (tooltipItems) {
                if (!tooltipItems.length || !chartPayload.data) return [];
                var i = tooltipItems[0].dataIndex;
                var row = chartPayload.data[i];
                var actual = row && row.actual != null ? Number(row.actual) : NaN;
                var forecast = row && row.forecast != null ? Number(row.forecast) : NaN;
                if (isNaN(actual) || isNaN(forecast)) return [];
                var ref = actual !== 0 ? actual : forecast;
                if (ref === 0 || isNaN(ref)) return [];
                var pct = ((forecast - actual) / ref) * 100;
                var sign = pct >= 0 ? "+" : "";
                return ["Variação (Previsão vs Real): " + sign + pct.toFixed(1) + "%"];
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxRotation: 45, font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(0, 33, 87, 0.08)" },
            ticks: { font: { size: 11 } },
          },
        },
      },
      plugins: [verticalLinePlugin, hoverVerticalLinePlugin],
    };
  }

  function destroyCharts() {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    if (chartInstanceProduto) {
      chartInstanceProduto.destroy();
      chartInstanceProduto = null;
    }
  }

  function renderCharts(payload) {
    if (typeof Chart === "undefined") return;
    destroyCharts();
    var config = buildChartConfig(payload);
    if (canvas) {
      chartInstance = new Chart(canvas, Object.assign({}, config));
    }
    if (canvasProduto) {
      chartInstanceProduto = new Chart(canvasProduto, Object.assign({}, config));
    }
  }

  function renderOneChart(payload, which) {
    if (typeof Chart === "undefined") return;
    var config = buildChartConfig(payload);
    if (which === "loja" && canvas) {
      if (chartInstance) chartInstance.destroy();
      chartInstance = new Chart(canvas, Object.assign({}, config));
    } else if (which === "produto" && canvasProduto) {
      if (chartInstanceProduto) chartInstanceProduto.destroy();
      chartInstanceProduto = new Chart(canvasProduto, Object.assign({}, config));
    }
  }

  function tableRowsToChartPayload(rows) {
    if (!rows || rows.length === 0) return null;
    var byKey = {};
    rows.forEach(function (r) {
      var p = r.periodo;
      if (p == null) return;
      var d = typeof p === "string" ? new Date(p) : p;
      if (isNaN(d.getTime())) return;
      var key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      if (!byKey[key]) byKey[key] = { period: key + "-01", actual: 0, forecast: 0 };
      var v = r.vendas != null ? Number(r.vendas) : 0;
      var f = r.previsao != null ? Number(r.previsao) : 0;
      byKey[key].actual += v;
      byKey[key].forecast += f;
    });
    var keys = Object.keys(byKey).sort();
    if (keys.length === 0) return null;
    var data = keys.map(function (k) {
      var x = byKey[k];
      return { period: x.period, actual: x.actual, forecast: x.forecast, isFuture: false };
    });
    if (currentPeriod === "annual") {
      var byYear = {};
      data.forEach(function (d) {
        var y = new Date(d.period).getFullYear();
        if (!byYear[y]) byYear[y] = { period: String(y), actual: 0, forecast: 0 };
        byYear[y].actual += d.actual;
        byYear[y].forecast += d.forecast;
      });
      data = Object.keys(byYear).sort().map(function (y) {
        var x = byYear[y];
        return { period: x.period, actual: x.actual, forecast: x.forecast, isFuture: false };
      });
    }
    return { data: data, cutoffPeriod: null, period: currentPeriod === "annual" ? "annual" : "monthly" };
  }

  function periodToTime(p) {
    if (p == null) return 0;
    var d = typeof p === "string" ? new Date(p) : p;
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function normalizePeriodMonthly(p) {
    if (p == null) return p;
    var d = typeof p === "string" ? new Date(p) : p;
    if (isNaN(d.getTime())) return p;
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    return y + "-" + m + "-01";
  }

  function aggregateFutureByYear(futurePoints) {
    var byYear = {};
    futurePoints.forEach(function (d) {
      var y = new Date(d.period).getFullYear();
      if (!byYear[y]) byYear[y] = { period: String(y), forecast: 0 };
      if (d.forecast != null) byYear[y].forecast += d.forecast;
    });
    return Object.keys(byYear).sort().map(function (y) {
      return { period: byYear[y].period, actual: null, forecast: byYear[y].forecast, isFuture: true };
    });
  }

  function fetchFutureLoja() {
    var storeId = getStoreId();
    var params = ["period=" + (currentPeriod === "annual" ? "annual" : "monthly")];
    if (storeId) params.push("store_id=" + encodeURIComponent(storeId));
    var url = getChartApiUrl() + "?" + params.join("&");
    return fetch(url).then(function (res) {
      if (!res.ok) return { data: [] };
      return res.json();
    }).then(function (json) {
      var list = (json.data || []).filter(function (d) { return d.isFuture; });
      return list.map(function (d) { return { period: d.period, actual: null, forecast: d.forecast, isFuture: true }; });
    }).catch(function () { return []; });
  }

  function fetchChartByProduct() {
    var productId = getProductId();
    var params = ["period=" + (currentPeriod === "annual" ? "annual" : "monthly")];
    if (productId) params.push("product_id=" + encodeURIComponent(productId));
    var url = getChartBaseUrl() + "/api/forecast-chart-by-product?" + params.join("&");
    return fetch(url).then(function (res) {
      if (!res.ok) return null;
      return res.json();
    }).then(function (json) {
      if (!json || !json.data || !json.data.length) return null;
      return {
        data: json.data,
        cutoffPeriod: json.cutoffPeriod || null,
        period: json.period || (currentPeriod === "annual" ? "annual" : "monthly"),
      };
    }).catch(function () { return null; });
  }

  function updateForecastChartFromTableData(source, rows) {
    if (source === "produto") {
      fetchChartByProduct().then(function (payload) {
        if (payload && payload.data.length) {
          renderOneChart(payload, "produto");
        } else {
          if (chartInstanceProduto) {
            chartInstanceProduto.destroy();
            chartInstanceProduto = null;
          }
        }
      });
      return;
    }

    if (source !== "loja" || !rows || rows.length === 0) {
      return;
    }
    var payload = tableRowsToChartPayload(rows);
    var historicData = (payload && payload.data) ? payload.data : [];

    function mergeAndRender(futurePoints) {
      var combined = historicData.length || futurePoints.length
        ? (historicData.concat(futurePoints)).sort(function (a, b) { return periodToTime(a.period) - periodToTime(b.period); })
        : [];
      var cutoffPeriod = null;
      var cutoffIdx = combined.findIndex(function (d) { return d.isFuture; });
      if (cutoffIdx >= 0 && combined[cutoffIdx]) cutoffPeriod = combined[cutoffIdx].period;
      var finalPayload = {
        data: combined,
        cutoffPeriod: cutoffPeriod,
        period: currentPeriod === "annual" ? "annual" : "monthly",
      };
      if (combined.length) {
        renderOneChart(finalPayload, "loja");
      } else {
        if (chartInstance) {
          chartInstance.destroy();
          chartInstance = null;
        }
      }
    }

    fetchFutureLoja().then(mergeAndRender);
  }

  window.updateForecastChartFromTableData = updateForecastChartFromTableData;

  function loadChart() {
    var url = getChartApiUrl();
    var storeId = getStoreId();
    var params = ["period=" + (currentPeriod === "annual" ? "annual" : "monthly")];
    if (storeId) params.push("store_id=" + encodeURIComponent(storeId));
    var fullUrl = url + "?" + params.join("&");

    fetch(fullUrl)
      .then(function (res) {
        if (!res.ok) return res.text().then(function (t) { throw new Error(res.status + ": " + (t || "").slice(0, 80)); });
        return res.json();
      })
      .then(function (data) {
        if (data.data && data.data.length) {
          renderCharts(data);
        } else {
          destroyCharts();
        }
      })
      .catch(function () {
        destroyCharts();
      });
  }

  function setPeriod(period) {
    currentPeriod = period;
    document.querySelectorAll(".forecast-chart-period-btn").forEach(function (btn) {
      var isActive = btn.getAttribute("data-period") === period;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
    var rows = typeof window.getForecastTableRows === "function" ? window.getForecastTableRows() : null;
    if (rows) {
      updateForecastChartFromTableData("loja", rows.loja);
      updateForecastChartFromTableData("produto", rows.produto);
    } else {
      loadChart();
    }
  }

  document.querySelectorAll(".forecast-chart-period-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setPeriod(btn.getAttribute("data-period") || "monthly");
    });
  });

  window.refreshForecastChart = function () {
    var rows = typeof window.getForecastTableRows === "function" ? window.getForecastTableRows() : null;
    if (rows) {
      updateForecastChartFromTableData("loja", rows.loja);
      updateForecastChartFromTableData("produto", rows.produto);
    } else {
      loadChart();
    }
  };

  function onPanelVisible() {
    var panel = document.getElementById("panel-pac");
    if (!panel || !panel.classList.contains("active")) return;
    if (typeof Chart !== "undefined" && typeof window.refreshForecastTable === "function") {
      window.refreshForecastTable();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      if (typeof Chart !== "undefined") onPanelVisible();
      else window.addEventListener("load", function () { setTimeout(onPanelVisible, 100); });
    });
  } else {
    if (typeof Chart !== "undefined") onPanelVisible();
  }

  document.querySelector("a[data-panel=\"pac\"]") && document.querySelector("a[data-panel=\"pac\"]").addEventListener("click", function () {
    setTimeout(function () { if (window.refreshForecastTable) window.refreshForecastTable(); }, 200);
  });
})();
