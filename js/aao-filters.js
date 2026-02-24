/**
 * Filtros "Análises Avançadas e Otimização" – produtos (autocomplete) e lojas (select).
 */
(function () {
  var productInput = document.getElementById("aao-filter-produto");
  var productIdHidden = document.getElementById("aao-filter-produto-id");
  var productSuggestions = document.getElementById("aao-product-suggestions");
  var selectLoja = document.getElementById("aao-filter-loja");
  if (!productInput || !productSuggestions || !selectLoja) return;

  var productsList = [];
  var maxSuggestions = 10;
  var clearBtn = document.getElementById("aao-filters-clear");

  function apiBase() {
    var p = window.location.pathname || "/";
    var base = p.endsWith("/") ? p : p.replace(/\/[^/]*$/, "") || "/";
    return base.replace(/\/$/, "") + "/api/filters";
  }

  var defaultStoreName = "Loja VW #4";

  function fillStoreSelect(list) {
    selectLoja.innerHTML = "";
    var opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "Todas as lojas";
    selectLoja.appendChild(opt0);
    var storeList = list || [];
    storeList.forEach(function (item) {
      var opt = document.createElement("option");
      opt.value = item.id != null ? String(item.id) : "";
      opt.textContent = item.name != null ? String(item.name) : "";
      selectLoja.appendChild(opt);
    });
    var defaultStore = storeList.filter(function (s) {
      var n = (s.name != null ? String(s.name) : "").trim();
      return n.toLowerCase() === defaultStoreName.toLowerCase();
    })[0];
    if (defaultStore && defaultStore.id != null) {
      selectLoja.value = String(defaultStore.id);
      if (window.refreshForecastTable) window.refreshForecastTable();
      if (window.refreshForecastChart) window.refreshForecastChart();
    }
  }

  function productDisplay(p) {
    var name = (p.name != null ? String(p.name) : "").trim();
    var code = (p.code != null ? String(p.code) : "").trim();
    return code ? name + " (" + code + ")" : name;
  }

  function filterProducts(q) {
    var qq = (q || "").trim().toLowerCase();
    if (!qq) return productsList.slice(0, maxSuggestions);
    return productsList.filter(function (p) {
      var name = (p.name != null ? String(p.name) : "").toLowerCase();
      var code = (p.code != null ? String(p.code) : "").toLowerCase();
      return name.indexOf(qq) !== -1 || code.indexOf(qq) !== -1;
    }).slice(0, maxSuggestions);
  }

  function showSuggestions(items) {
    productSuggestions.innerHTML = "";
    productSuggestions.removeAttribute("hidden");
    productInput.setAttribute("aria-expanded", "true");
    if (!items || items.length === 0) {
      var empty = document.createElement("div");
      empty.className = "aao-product-suggestion-item";
      empty.textContent = "Nenhum produto encontrado";
      empty.style.opacity = "0.7";
      productSuggestions.appendChild(empty);
      return;
    }
    items.forEach(function (p, i) {
      var div = document.createElement("div");
      div.className = "aao-product-suggestion-item";
      div.setAttribute("role", "option");
      div.setAttribute("aria-selected", "false");
      div.setAttribute("data-product-id", p.id != null ? String(p.id) : "");
      var nameSpan = document.createElement("span");
      nameSpan.textContent = p.name != null ? String(p.name) : "";
      div.appendChild(nameSpan);
      if (p.code) {
        var codeSpan = document.createElement("span");
        codeSpan.className = "aao-product-suggestion-code";
        codeSpan.textContent = " " + p.code;
        div.appendChild(codeSpan);
      }
      div.addEventListener("click", function () {
        productInput.value = productDisplay(p);
        if (productIdHidden) productIdHidden.value = p.id != null ? String(p.id) : "";
        hideSuggestions();
        productInput.blur();
        if (window.refreshForecastTable) window.refreshForecastTable();
      });
      productSuggestions.appendChild(div);
    });
  }

  function hideSuggestions() {
    productSuggestions.setAttribute("hidden", "");
    productSuggestions.innerHTML = "";
    productInput.setAttribute("aria-expanded", "false");
  }

  function onProductInput() {
    var q = productInput.value;
    if (productIdHidden && !q.trim()) productIdHidden.value = "";
    if (productsList.length === 0) {
      hideSuggestions();
      return;
    }
    var matches = filterProducts(q);
    showSuggestions(matches);
  }

  productInput.addEventListener("input", onProductInput);
  productInput.addEventListener("focus", function () {
    if (productsList.length) showSuggestions(filterProducts(productInput.value));
  });
  productInput.addEventListener("blur", function () {
    setTimeout(function () {
      hideSuggestions();
      if (productInput.value.trim() === "" && window.refreshForecastTable) window.refreshForecastTable();
    }, 200);
  });
  productInput.addEventListener("keydown", function (e) {
    if (e.key === "Escape") hideSuggestions();
  });

  document.addEventListener("click", function (e) {
    if (!productInput.contains(e.target) && !productSuggestions.contains(e.target)) hideSuggestions();
  });

  function clearFilters() {
    productInput.value = "";
    if (productIdHidden) productIdHidden.value = "";
    if (selectLoja) selectLoja.value = "";
    hideSuggestions();
    if (window.refreshForecastTable) window.refreshForecastTable();
  }

  if (clearBtn) clearBtn.addEventListener("click", clearFilters);

  function loadFilters() {
    fetch(apiBase())
      .then(function (res) {
        var ct = (res.headers.get("Content-Type") || "").toLowerCase();
        if (!res.ok) return res.text().then(function (t) { throw new Error(res.status + (t ? ": " + t.substring(0, 80) : "")); });
        if (ct.indexOf("application/json") === -1) throw new Error("Resposta não é JSON");
        return res.json();
      })
      .then(function (data) {
        productsList = data.products || [];
        if (productIdHidden) productIdHidden.value = "";
        productInput.value = "";
        fillStoreSelect(data.stores || []);
      })
      .catch(function () {
        productsList = [];
        fillStoreSelect([]);
      });
  }

  function onPanelVisible() {
    var panel = document.getElementById("panel-pac");
    if (!panel || !panel.classList.contains("active")) return;
    loadFilters();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      onPanelVisible();
      var link = document.querySelector("a[data-panel=\"pac\"]");
      if (link) link.addEventListener("click", function () { setTimeout(loadFilters, 100); });
    });
  } else {
    onPanelVisible();
    var link = document.querySelector("a[data-panel=\"pac\"]");
    if (link) link.addEventListener("click", function () { setTimeout(loadFilters, 100); });
  }
})();
