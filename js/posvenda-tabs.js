/**
 * Tabs abaixo do box Análises Avançadas e Otimização (Por loja, etc.).
 */
(function () {
  var tabs = document.querySelectorAll(".posvenda-tab[data-tab]");
  if (!tabs.length) return;

  tabs.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-tab");
      if (!id) return;
      var panel = document.getElementById("tab-" + id);
      if (!panel) return;
      document.querySelectorAll(".posvenda-tab").forEach(function (t) {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      document.querySelectorAll(".posvenda-tab-panel").forEach(function (p) {
        p.classList.remove("active");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      panel.classList.add("active");
    });
  });
})();
