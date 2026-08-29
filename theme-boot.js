/* Aplica tema/densidade persistidos antes do primeiro paint para evitar flash.
   A chave legado tempo.cfg.v1 é mantida para não perder preferências existentes. */
(() => {
  'use strict';
  try {
    const saved = JSON.parse(localStorage.getItem('tempo.cfg.v1') || '{}');
    const theme = saved['ui.theme'];
    const density = saved['ui.density'];
    const resolved = theme === 'light' || theme === 'dark'
      ? theme
      : (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.dataset.theme = resolved;
    const themeColor = document.getElementById('themeColor');
    if (themeColor) themeColor.content = resolved === 'light' ? '#ffffff' : '#000000';
    if (density === 'comfortable' || density === 'compact') {
      document.documentElement.dataset.density = density;
    }
  } catch (_) {
    // Preferências inválidas nunca impedem o carregamento da interface.
  }
})();
