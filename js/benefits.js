/**
 * Popup de benefícios da solução (por painel)
 */
(function () {
  var benefitContents = {
    dashboard: {
      title: "Benefícios – Visão de Mercado",
      body: "<h4>Para o motorista</h4><p>Visão clara do cenário de mercado e ofertas, ajudando na decisão de compra e no acompanhamento de tendências.</p><h4>Para o negócio</h4><p>Dashboards centralizados permitem análise de desempenho, metas e oportunidades de venda em um só lugar.</p>"
    },
    genie: {
      title: "Benefícios – Pergunte sobre o Tera",
      body: "<h4>Para o motorista</h4><p>Respostas rápidas em linguagem natural sobre o veículo Tera, manual, funcionalidades e dúvidas frequentes.</p><h4>Para o negócio</h4><p>Redução de custos de atendimento e maior satisfação do cliente com suporte inteligente e escalável.</p>"
    },
    motorista: {
      title: "Benefícios – Visão do Motorista",
      body: "<h4>Para o motorista</h4><p>Acompanhamento em tempo real do status dos módulos do veículo, alertas e orientações de solução para dirigir com mais segurança.</p><h4>Para o negócio</h4><p>Monitoramento da frota, prevenção de falhas e dados para manutenção preditiva e decisões operacionais.</p>"
    },
    pac: {
      title: "Benefícios – Visão PAC",
      body: "<h4>Para o motorista</h4><p>Informações e indicadores da solução PAC ao alcance, com foco em uso e benefícios no dia a dia.</p><h4>Para o negócio</h4><p>Visibilidade do uso da solução PAC, métricas de adoção e ganhos de eficiência para o negócio.</p>"
    },
    centralizada: {
      title: "Benefícios – Visão Centralizada",
      body: "<h4>Para o motorista</h4><p>Uma visão unificada de informações relevantes, simplificando o acesso e a compreensão dos dados.</p><h4>Para o negócio</h4><p>Governança e controle centralizados, melhor tomada de decisão e visão integrada dos processos.</p>"
    }
  };

  var overlay = document.getElementById("benefit-popup-overlay");
  var titleEl = document.getElementById("benefit-popup-title");
  var bodyEl = document.getElementById("benefit-popup-body");
  var openBtn = document.getElementById("nav-benefit-btn");
  var closeBtn = document.getElementById("benefit-popup-close");

  function getActivePanelId() {
    var active = document.querySelector(".panel.active");
    return active ? active.id.replace("panel-", "") : "dashboard";
  }

  function openBenefitPopup() {
    var panelId = getActivePanelId();
    var data = benefitContents[panelId] || benefitContents.dashboard;
    if (titleEl) titleEl.textContent = data.title;
    if (bodyEl) bodyEl.innerHTML = data.body;
    if (overlay) {
      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden", "false");
    }
  }

  function closeBenefitPopup() {
    if (overlay) {
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
    }
  }

  if (openBtn) openBtn.addEventListener("click", openBenefitPopup);
  if (closeBtn) closeBtn.addEventListener("click", closeBenefitPopup);
  if (overlay) overlay.addEventListener("click", function (e) { if (e.target === overlay) closeBenefitPopup(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeBenefitPopup(); });
})();
