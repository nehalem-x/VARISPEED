(() => {
  'use strict';

  const YOUTUBE_ORIGIN = 'https://*.youtube.com/*';
  const button = document.getElementById('export');
  const status = document.getElementById('status');

  const setStatus = (message, kind = '') => {
    status.textContent = message;
    if (kind) status.dataset.kind = kind;
    else status.removeAttribute('data-kind');
  };

  const downloadText = (text) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'youtube-cookies.txt';
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  button.addEventListener('click', async () => {
    button.disabled = true;
    setStatus('Solicitando acesso somente a youtube.com…');

    try {
      const granted = await chrome.permissions.request({ origins: [YOUTUBE_ORIGIN] });
      if (!granted) {
        setStatus('Acesso não concedido. Nenhum cookie foi lido.', 'error');
        return;
      }

      const cookies = await chrome.cookies.getAll({ domain: 'youtube.com' });
      const result = CookieExport.buildNetscapeFile(cookies);
      if (!result.authenticated) {
        setStatus('A sessão não parece autenticada. Entre no YouTube e tente novamente.', 'error');
        return;
      }

      downloadText(result.text);
      setStatus(`${result.count} cookies do YouTube exportados localmente.`, 'success');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Não foi possível exportar os cookies.', 'error');
    } finally {
      button.disabled = false;
    }
  });
})();
