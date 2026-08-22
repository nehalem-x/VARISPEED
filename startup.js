(() => {
  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const errorMessage = $('errorMessage');
  const actions = $('actions');
  const retry = $('retry');
  const detailsToggle = $('detailsToggle');
  const details = $('details');

  let redirected = false;
  let readyTimer = 0;
  let lastStage = '';

  const statusLabel = (data) => {
    if (data.ready) return 'PRONTO';
    if (data.error) return 'FALHA NA INICIALIZAÇÃO';
    const raw = String(data.stage || 'INICIALIZANDO').trim().replace(/\.+$/, '');
    return `${raw}...`;
  };

  function setStage(text) {
    if (text === lastStage) return;
    lastStage = text;
    if (window.Motion) {
      // Usa a assinatura oficial de status do VARISPEED — a mesma cadência
      // da confirmação de exportação. Fica persistente até o próximo stage.
      window.Motion.status(stage, text, {
        persist: true,
        caret: true,
        intensity: 0.92,
      });
    } else {
      stage.textContent = text;
    }
  }

  function render(data) {
    setStage(statusLabel(data));
    details.textContent = (data.logs || []).join('\n');
    document.body.dataset.state = data.error ? 'error' : (data.ready ? 'ready' : 'loading');
    actions.hidden = !data.error;
    errorMessage.hidden = !data.error;
    errorMessage.textContent = data.error ? (data.message || 'Não foi possível iniciar o VARISPEED.') : '';

    if (data.ready && !redirected && !readyTimer) {
      readyTimer = window.setTimeout(() => {
        redirected = true;
        location.replace(data.app_url || 'http://127.0.0.1:8765/');
      }, 720);
    }
  }

  async function poll() {
    try {
      const response = await fetch('/status', { cache: 'no-store' });
      if (!response.ok) throw new Error('status indisponível');
      render(await response.json());
    } catch (_) {
      // Durante o redirecionamento o servidor temporário pode encerrar.
    }
  }

  retry.addEventListener('click', async () => {
    retry.disabled = true;
    try {
      await fetch('/retry', { method: 'POST' });
      details.hidden = true;
      detailsToggle.setAttribute('aria-expanded', 'false');
      detailsToggle.textContent = 'VER DETALHES';
      errorMessage.hidden = true;
      lastStage = '';
    } finally {
      window.setTimeout(() => { retry.disabled = false; }, 600);
    }
  });

  detailsToggle.addEventListener('click', () => {
    const open = details.hidden;
    details.hidden = !open;
    detailsToggle.setAttribute('aria-expanded', String(open));
    detailsToggle.textContent = open ? 'OCULTAR DETALHES' : 'VER DETALHES';
    if (open) details.scrollTop = details.scrollHeight;
  });

  setStage('INICIALIZANDO...');
  poll();
  window.setInterval(poll, 260);
})();
