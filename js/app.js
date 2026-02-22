/**
 * Navegação e painéis (Visão de Mercado, Genie, Motorista, PAC, Centralizada)
 */
(function () {
  const navLinks = document.querySelectorAll('.nav-item a[data-panel]');
  const panels = document.querySelectorAll('.panel');

  function switchPanel(panelId) {
    panels.forEach(function (p) {
      p.classList.toggle('active', p.id === 'panel-' + panelId);
    });
    navLinks.forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-panel') === panelId);
    });
    var topBar = document.getElementById('top-bar');
    if (topBar) topBar.classList.toggle('visible', panelId === 'motorista');
    history.replaceState(null, '', '#' + panelId);
  }

  navLinks.forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      switchPanel(a.getAttribute('data-panel'));
    });
  });

  var hash = (location.hash || '#dashboard').slice(1);
  if (['genie', 'dashboard', 'motorista', 'pac', 'centralizada'].indexOf(hash) !== -1) {
    switchPanel(hash);
  }
})();
