(function exposeCookieExporter(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CookieExport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  const AUTH_COOKIE_NAMES = new Set([
    'APISID',
    'HSID',
    'LOGIN_INFO',
    'SAPISID',
    'SID',
    'SSID',
    '__Secure-1PAPISID',
    '__Secure-1PSID',
    '__Secure-3PAPISID',
    '__Secure-3PSID',
  ]);

  const isYouTubeDomain = (domain) => {
    const normalized = String(domain || '').trim().replace(/^\./, '').toLowerCase();
    return normalized === 'youtube.com' || normalized.endsWith('.youtube.com');
  };

  const assertField = (value, label) => {
    const text = String(value == null ? '' : value);
    if (/[\t\r\n]/.test(text)) throw new Error(`Cookie inválido: ${label} contém quebra de linha ou tabulação.`);
    return text;
  };

  function toNetscapeLine(cookie) {
    if (!cookie || !isYouTubeDomain(cookie.domain)) {
      throw new Error('Cookie fora do domínio permitido youtube.com.');
    }

    const rawDomain = assertField(cookie.domain, 'domínio');
    const domain = cookie.httpOnly ? `#HttpOnly_${rawDomain}` : rawDomain;
    const includeSubdomains = cookie.hostOnly ? 'FALSE' : 'TRUE';
    const path = assertField(cookie.path || '/', 'caminho');
    const secure = cookie.secure ? 'TRUE' : 'FALSE';
    const expires = Number.isFinite(cookie.expirationDate)
      ? String(Math.max(0, Math.floor(cookie.expirationDate)))
      : '0';
    const name = assertField(cookie.name, 'nome');
    const value = assertField(cookie.value, 'valor');

    return [domain, includeSubdomains, path, secure, expires, name, value].join('\t');
  }

  function buildNetscapeFile(cookies) {
    const allowed = (Array.isArray(cookies) ? cookies : [])
      .filter((cookie) => cookie && isYouTubeDomain(cookie.domain))
      .sort((a, b) => {
        const domainOrder = String(a.domain).localeCompare(String(b.domain));
        if (domainOrder) return domainOrder;
        return String(a.name).localeCompare(String(b.name));
      });

    if (!allowed.length) throw new Error('Nenhum cookie do YouTube foi encontrado nesta sessão.');

    const lines = [
      '# Netscape HTTP Cookie File',
      '# Exportado localmente pelo VARISPEED — arquivo sensível, não compartilhe.',
      '# O conteúdo nunca foi enviado pela extensão.',
      ...allowed.map(toNetscapeLine),
      '',
    ];

    return {
      text: lines.join('\n'),
      count: allowed.length,
      authenticated: allowed.some((cookie) => AUTH_COOKIE_NAMES.has(String(cookie.name))),
    };
  }

  return { buildNetscapeFile, isYouTubeDomain, toNetscapeLine };
});
