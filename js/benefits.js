/**
 * Popup de benefícios da solução (por painel)
 */
(function () {
  var benefitContents = {
    dashboard: {
      title: "Benefícios – Visão de Mercado",
      body: "<h4>Liderança Executiva</h4><p>Decisões estratégicas mais rápidas, com validação de hipóteses quase em tempo real durante reuniões.</p><h4>Vendas e Planejamento Comercial</h4><p>Visibilidade contínua de market share e mix por região e segmento, permitindo ajustes ágeis de rota e orçamento comercial.</p><h4>Pós-Vendas e Logística</h4><p>Previsão regional de demanda baseada na frota e seu envelhecimento, reduzindo rupturas e estoques parados.</p><h4>Marketing e CRM</h4><p>Campanhas hiper-segmentadas com inteligência geográfica e ciclo de troca de veículos, reduzindo CAC e aumentando conversão.</p><h4>Engenharia de Dados</h4><p>Redução de demandas repetitivas, permitindo foco em arquiteturas e modelos avançados de IA dentro de uma plataforma governada.</p>"
    },
    pac: {
      title: "Benefícios – Visão Pós-venda",
      body: "<h4>Gestores de Pós-Vendas e Dealers</h4><p>Substituição do \"feeling\" por previsões orientadas a dados da frota, evitando rupturas e recuperando receitas perdidas.</p><h4>Logística</h4><p>Visibilidade do risco regional e rebalanceamento proativo, reduzindo estoque parado e transportes emergenciais.</p><h4>Liderança Executiva</h4><p>Visão imediata do desalinhamento entre envelhecimento da frota e disponibilidade de peças, eliminando a latência de relatórios tradicionais.</p><h4>Finanças</h4><p>Melhoria do fluxo de caixa via liberação de capital imobilizado e aumento da receita recorrente de peças de alta margem.</p><h4>Marketing e CRM</h4><p>Campanhas segmentadas de retenção e serviços baseadas no envelhecimento da frota por região e modelo.</p>"
    },
    motorista: {
      title: "Benefícios – Visão do Motorista",
      body: "<h4>Pós-Vendas e Concessionárias</h4><p>Manutenção preditiva baseada em telemetria e histórico do veículo, antecipando serviços e aumentando retenção na rede.</p><h4>Marketing, Vendas e CRM</h4><p>Ofertas personalizadas e hiper-segmentadas conforme uso real do carro, elevando fidelidade e reduzindo custo de aquisição.</p><h4>Engenharia, Qualidade e Produto</h4><p>Feedback contínuo do comportamento dos veículos em campo, permitindo análise de causa raiz e prevenção de recalls.</p><h4>Cliente Final (Motorista)</h4><p>Experiência de companionship com o assistente Otto, recebendo alertas preditivos e contextuais que aumentam conveniência e segurança.</p>"
    },
    genie: {
      title: "Benefícios – Pergunte sobre o seu negócio",
      body: "<h4>Para o motorista</h4><p>Respostas rápidas em linguagem natural sobre o veículo Tera, manual, funcionalidades e dúvidas frequentes.</p><h4>Para o negócio</h4><p>Redução de custos de atendimento e maior satisfação do cliente com suporte inteligente e escalável.</p>"
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
