/* ═════════════════════════════════════════════════════════
   VARISPEED — modais
   Modal.show(layer) / Modal.hide(layer): abre e fecha uma camada de modal
   com animação (a camada escurece e o quadro sobe um pouco ao entrar; o
   contrário ao sair). Com movimento reduzido a troca é imediata.
   Modal.isOpen(layer): aberta e não saindo.

   Modal.confirm({ eyebrow, title, message, confirmLabel, cancelLabel })
   substitui window.confirm() por um modal do próprio app e devolve uma
   Promise<boolean>. Escape, Cancelar, o X e clicar fora respondem false.
   ═════════════════════════════════════════════════════════ */
window.Modal = (() => {
  'use strict';

  const ENTER_MS = 200;
  const LEAVE_MS = 150;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => (window.Motion && window.Motion.reduced ? window.Motion.reduced() : mq.matches);
  const timers = new WeakMap();

  function settle(layer) {
    clearTimeout(timers.get(layer));
    timers.delete(layer);
  }

  function show(layer) {
    settle(layer);
    layer.hidden = false;
    layer.inert = false;
    if (reduced()) { layer.dataset.state = 'open'; return Promise.resolve(); }
    layer.dataset.state = 'enter';
    void layer.offsetWidth; // aplica o estado inicial antes da transição
    layer.dataset.state = 'open';
    return new Promise((resolve) => timers.set(layer, setTimeout(resolve, ENTER_MS)));
  }

  function hide(layer) {
    if (layer.hidden) return Promise.resolve();
    settle(layer);
    layer.inert = true;
    if (reduced()) { layer.hidden = true; delete layer.dataset.state; layer.inert = false; return Promise.resolve(); }
    layer.dataset.state = 'leave';
    return new Promise((resolve) => timers.set(layer, setTimeout(() => {
      timers.delete(layer);
      layer.hidden = true;
      layer.inert = false;
      delete layer.dataset.state;
      resolve();
    }, LEAVE_MS)));
  }

  const isOpen = (layer) => Boolean(layer) && !layer.hidden && layer.dataset.state !== 'leave';

  /* ── confirmação ─────────────────────────────────────── */
  let ui = null;
  let pending = null; // { resolve, returnFocus }

  function svgClose() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'ui-icon');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const use = document.createElementNS(ns, 'use');
    use.setAttribute('href', '#ui-icon-close');
    svg.appendChild(use);
    return svg;
  }

  function build() {
    const make = (tag, cls, attrs = {}) => {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      return node;
    };
    const layer = make('div', 'modal-layer', { id: 'confirmLayer' });
    layer.hidden = true;
    const box = make('div', 'modal', {
      id: 'confirmDialog', role: 'alertdialog', 'aria-modal': 'true',
      'aria-labelledby': 'confirmTitle', 'aria-describedby': 'confirmMessage',
    });
    // div, não header/footer: fora de uma seção eles virariam marcos da
    // página (banner e contentinfo) repetidos para o leitor de tela.
    const head = make('div', 'modal__head');
    const heading = make('div');
    const eyebrow = make('span', 'mono', { id: 'confirmEyebrow' });
    const title = make('strong', '', { id: 'confirmTitle' });
    heading.append(eyebrow, title);
    const close = make('button', 'btn btn--ghost btn--icon', { id: 'confirmClose', type: 'button', title: 'Fechar', 'aria-label': 'Fechar' });
    close.appendChild(svgClose());
    head.append(heading, close);
    const body = make('div', 'modal__body');
    const message = make('p', '', { id: 'confirmMessage' });
    body.appendChild(message);
    const foot = make('div', 'modal__foot');
    const cancel = make('button', 'btn btn--ghost modal__cancel', { id: 'confirmCancel', type: 'button' });
    const ok = make('button', 'btn btn--primary modal__ok', { id: 'confirmOk', type: 'button' });
    foot.append(cancel, ok);
    box.append(head, body, foot);
    layer.appendChild(box);
    document.body.appendChild(layer);

    close.addEventListener('click', () => answer(false));
    cancel.addEventListener('click', () => answer(false));
    ok.addEventListener('click', () => answer(true));
    layer.addEventListener('pointerdown', (event) => { if (event.target === layer) answer(false); });
    // Fase de captura: o modal responde antes dos atalhos da Biblioteca e das Configurações.
    document.addEventListener('keydown', (event) => {
      if (!pending) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        answer(false);
      } else if (event.key === 'Tab') {
        const focusable = [close, cancel, ok];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!box.contains(document.activeElement)) {
          event.preventDefault();
          first.focus({ preventScroll: true });
        } else if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus({ preventScroll: true });
        }
        event.stopImmediatePropagation();
      } else {
        event.stopImmediatePropagation();
      }
    }, true);
    return { layer, eyebrow, title, message, cancel, ok };
  }

  function answer(value) {
    if (!pending) return;
    const { resolve, returnFocus } = pending;
    pending = null;
    hide(ui.layer);
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    resolve(value);
  }

  function confirm({ eyebrow = 'Confirmação', title, message = '', confirmLabel = 'Confirmar', cancelLabel = 'Cancelar' } = {}) {
    if (!ui) ui = build();
    if (pending) answer(false);
    ui.eyebrow.textContent = eyebrow;
    ui.title.textContent = title || '';
    ui.message.textContent = message;
    ui.message.hidden = !message;
    ui.ok.textContent = confirmLabel;
    ui.cancel.textContent = cancelLabel;
    return new Promise((resolve) => {
      pending = { resolve, returnFocus: document.activeElement };
      show(ui.layer);
      // O foco começa em Cancelar: a ação destrutiva nunca é o padrão do Enter.
      ui.cancel.focus({ preventScroll: true });
    });
  }

  return { show, hide, isOpen, confirm };
})();
