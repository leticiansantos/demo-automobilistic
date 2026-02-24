/**
 * Métrica 1: Estoque ótimo. Métrica 2: Valor de estoque (preço de products_br).
 */
(function () {
  var elEstoqueOtimo = document.getElementById("aao-metric-estoque-otimo");
  var elValorEstoqueOtimo = document.getElementById("aao-metric-valor-estoque-otimo");
  var elEstoqueAtual = document.getElementById("aao-metric-estoque-atual");
  var elValorEstoqueReal = document.getElementById("aao-metric-valor-estoque-real");
  var elValorTooltipPreco = document.getElementById("aao-metric-valor-tooltip-preco");
  var elValorInfo = document.getElementById("aao-metric-valor-info");
  if (!elEstoqueOtimo || !elValorEstoqueOtimo) return;

  function getBaseUrl() {
    var p = window.location.pathname || "/";
    var base = p.endsWith("/") ? p : p.replace(/\/[^/]*$/, "") || "/";
    return base.replace(/\/$/, "");
  }

  function getProductId() {
    var el = document.getElementById("aao-filter-produto-id");
    return el && el.value != null ? String(el.value).trim() : "";
  }

  function getStoreId() {
    var el = document.getElementById("aao-filter-loja");
    return el && el.value != null ? String(el.value).trim() : "";
  }

  function formatNum(n) {
    if (n == null || n === "" || isNaN(Number(n))) return "–";
    return Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  }

  function formatCurrency(n) {
    if (n == null || n === "" || isNaN(Number(n))) return "–";
    return "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function setValorTooltipPreco(precoUnitario) {
    if (!elValorTooltipPreco) return;
    var text = "Preço unitário: –";
    if (precoUnitario != null && !isNaN(Number(precoUnitario))) {
      text = "Preço unitário: " + formatCurrency(precoUnitario);
    }
    elValorTooltipPreco.textContent = text;
    if (elValorInfo) {
      elValorInfo.setAttribute("title", "Valor de estoque ótimo = Estoque ótimo × Preço unitário. " + text);
    }
  }

  function updateMetricsProduct() {
    var productId = getProductId();
    if (!productId) {
      elEstoqueOtimo.textContent = "–";
      elValorEstoqueOtimo.textContent = "–";
      if (elEstoqueAtual) elEstoqueAtual.textContent = "–";
      if (elValorEstoqueReal) elValorEstoqueReal.textContent = "–";
      setValorTooltipPreco(null);
      return;
    }
    var storeId = getStoreId();
    var params = ["product_id=" + encodeURIComponent(productId)];
    if (storeId) params.push("store_id=" + encodeURIComponent(storeId));
    var url = getBaseUrl() + "/api/metrics-product?" + params.join("&");

    fetch(url)
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        if (!data) {
          elEstoqueOtimo.textContent = "–";
          elValorEstoqueOtimo.textContent = "–";
          if (elEstoqueAtual) elEstoqueAtual.textContent = "–";
          if (elValorEstoqueReal) elValorEstoqueReal.textContent = "–";
          setValorTooltipPreco(null);
          return;
        }
        elEstoqueOtimo.textContent = data.estoque_otimo != null ? formatNum(data.estoque_otimo) + " un." : "–";
        elValorEstoqueOtimo.textContent = data.valor_estoque != null ? formatCurrency(data.valor_estoque) : "–";
        if (elEstoqueAtual) elEstoqueAtual.textContent = data.estoque_atual != null ? formatNum(data.estoque_atual) + " un." : "–";
        if (elValorEstoqueReal) elValorEstoqueReal.textContent = data.valor_estoque_atual != null ? formatCurrency(data.valor_estoque_atual) : "–";
        setValorTooltipPreco(data.preco_unitario);
      })
      .catch(function () {
        elEstoqueOtimo.textContent = "–";
        elValorEstoqueOtimo.textContent = "–";
        if (elEstoqueAtual) elEstoqueAtual.textContent = "–";
        if (elValorEstoqueReal) elValorEstoqueReal.textContent = "–";
        setValorTooltipPreco(null);
      });
  }

  window.updateMetricsProduct = updateMetricsProduct;

  var storeSelect = document.getElementById("aao-filter-loja");
  if (storeSelect) storeSelect.addEventListener("change", updateMetricsProduct);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      updateMetricsProduct();
    });
  } else {
    updateMetricsProduct();
  }
})();
