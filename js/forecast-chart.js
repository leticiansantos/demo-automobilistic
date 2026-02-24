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

  function getChartApiUrl() {
    var p = window.location.pathname || "/";
    var base = p.endsWith("/") ? p : p.replace(/\/[^/]*$/, "") || "/";
    return base.replace(/\/$/, "") + "/api/forecast-chart";
  }

  function getStoreId() {
    var el = document.getElementById("aao-filter-loja");
    return el && el.value ? String(el.value).trim() : "";
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
    var cutoffIndex = cutoffPeriod != null
      ? data.findIndex(function (d) { return String(d.period) === String(cutoffPeriod); })
      : -1;
    if (cutoffIndex < 0 && data.some(function (d) { return d.isFuture; })) {
      cutoffIndex = data.findIndex(function (d) { return d.isFuture; });
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
    loadChart();
  }

  document.querySelectorAll(".forecast-chart-period-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setPeriod(btn.getAttribute("data-period") || "monthly");
    });
  });

  window.refreshForecastChart = loadChart;

  var storeSelect = document.getElementById("aao-filter-loja");
  if (storeSelect) storeSelect.addEventListener("change", loadChart);

  function onPanelVisible() {
    var panel = document.getElementById("panel-pac");
    if (!panel || !panel.classList.contains("active")) return;
    if (typeof Chart !== "undefined") loadChart();
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
    setTimeout(function () { if (window.refreshForecastChart) window.refreshForecastChart(); }, 200);
  });
})();
