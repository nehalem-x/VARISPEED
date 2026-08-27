/* ═════════════════════════════════════════════════════════
   VARISPEED — sistema de motion
   Hierarquia atual:
     STATUS       → status() — assinatura global derivada da exportação
     CONTEÚDO     → typeOut() — conteúdo não-efêmero (ex.: nome da mídia)
     MICRO        → digitTick() — atualização numérica localizada
     DADO         → osciloscópio — contínuo, dirigido por sinal

   ephemeral() é o núcleo tipográfico de baixo nível. Novos feedbacks
   de estado devem chamar status(), não ephemeral() diretamente.

   ephemeral() adapta o núcleo da engine de referência
   (revelação por caractere com cadência natural, deslocamento
   próprio por glifo, sustentação e dissolução) para a escala
   tipográfica desta interface: amplitudes em px de 1 dígito,
   sem rotação 3D, sem drift contínuo.
   ═════════════════════════════════════════════════════════ */
window.Motion = (() => {
  'use strict';

  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const rand = (a, b) => a + Math.random() * (b - a);

  /* configuração global — o painel escreve aqui.
     'system' delega ao prefers-reduced-motion; 'off' equivale a ele. */
  const cfg = { level: 'system', scale: 1, intensity: 1 };
  const configure = (next) => { Object.assign(cfg, next || {}); };
  const reduced = () => {
    if (cfg.level === 'off') return true;
    if (cfg.level === 'system') return mq.matches;
    return false;
  };
  /* escala de tempo e de intensidade efetivas; 'discreet' comprime as duas */
  const S = () => cfg.scale * (cfg.level === 'discreet' ? 0.85 : 1);
  const K = () => cfg.intensity * (cfg.level === 'discreet' ? 0.45 : 1);

  /* tokens de tempo (ms) — espelham as CSS vars */
  const T = {
    micro: 110,   // interações frequentes
    quick: 170,   // troca de estado
    event: 220,   // evento notável
    charEvent: 26, charEventJitter: 11,
    charState: 10, charStateJitter: 4,
  };

  /* pausa proporcionalmente maior em separadores → ritmo natural */
  const PAUSE = { ' ': 1.5, '·': 1.9, '.': 1.7, '_': 1.4, '-': 1.4, '/': 1.4 };
  /* multiplicadores da engine de referência, reduzidos para UI densa */
  const SPACE_MULT = 1.55;
  const PUNCT_MULT = 1.85;
  const JITTER_LO = 0.84, JITTER_HI = 1.18;

  const tokens = new WeakMap();
  const timers = new WeakMap();
  const marquees = new WeakMap();

  function unwrapMarquee(host) {
    const track = host.firstElementChild;
    if (!track?.classList.contains('marquee__track')) return;
    const content = track.firstElementChild;
    if (!content?.classList.contains('marquee__content')) return;
    host.replaceChildren(...content.childNodes);
  }

  function applyMarquee(host) {
    const state = marquees.get(host);
    if (!state) return;

    unwrapMarquee(host);
    host.classList.remove('is-marquee');
    host.style.removeProperty('--marquee-distance');
    host.style.removeProperty('--marquee-duration');

    const available = host.clientWidth;
    const contentWidth = host.scrollWidth;
    if (reduced() || available <= 0 || contentWidth <= available + 2) return;

    const speed = Math.max(18, Number(state.options.speed) || 28);
    const track = document.createElement('span');
    const content = document.createElement('span');
    track.className = 'marquee__track';
    content.className = 'marquee__content';
    while (host.firstChild) content.appendChild(host.firstChild);

    track.appendChild(content);
    host.appendChild(track);

    const distance = content.scrollWidth - available;
    const duration = Math.max(7, Math.min(20, 4 + distance / speed));
    host.style.setProperty('--marquee-distance', `${distance}px`);
    host.style.setProperty('--marquee-duration', `${duration.toFixed(2)}s`);
    host.classList.add('is-marquee');
  }

  function marquee(host, options = {}) {
    if (!host) return;
    let state = marquees.get(host);
    if (!state) {
      state = { frame: 0, options: {} };
      state.observer = new ResizeObserver(() => {
        cancelAnimationFrame(state.frame);
        state.frame = requestAnimationFrame(() => {
          state.frame = 0;
          applyMarquee(host);
        });
      });
      state.observer.observe(host);
      marquees.set(host, state);
    }
    state.options = { ...options };
    applyMarquee(host);
  }

  function cancel(host) {
    tokens.set(host, (tokens.get(host) || 0) + 1);
    const list = timers.get(host);
    if (list) list.forEach(clearTimeout);
    timers.set(host, []);
  }

  function schedule(host, fn, ms) {
    const id = setTimeout(fn, ms);
    const list = timers.get(host) || [];
    list.push(id);
    timers.set(host, list);
    return id;
  }

  function makeChar(c, opts) {
    const s = document.createElement('span');
    s.className = 'ch ch--pending';
    s.textContent = c;
    s.style.setProperty('--ch-dur', `${opts.charDur}ms`);
    s.style.setProperty('--ch-dy', `${opts.dy}px`);
    s.style.setProperty('--ch-blur', `${opts.blur}px`);
    return s;
  }

  /**
   * Digitação caractere por caractere, com variação natural de cadência
   * e dissolução (opacidade + deslocamento + desfoque mínimo) por glifo.
   * Retorna a duração total estimada em ms.
   */
  function typeOut(host, text, opts = {}) {
    const o = Object.assign({
      speed: T.charEvent,
      jitter: T.charEventJitter,
      charDur: 200,
      dy: 1.5,
      blur: 1,
      caret: false,
      onDone: null,
    }, opts);

    const s = S();
    o.speed *= s; o.jitter *= s; o.charDur *= s;

    unwrapMarquee(host);
    host.classList.remove('is-marquee');
    cancel(host);
    const token = tokens.get(host) || 0;

    if (reduced()) {
      host.textContent = text;
      if (o.onDone) o.onDone();
      return 0;
    }

    host.textContent = '';
    const frag = document.createDocumentFragment();
    const spans = [];
    for (const c of text) {
      const s = makeChar(c, o);
      spans.push(s);
      frag.appendChild(s);
    }
    let caret = null;
    if (o.caret) {
      caret = document.createElement('span');
      caret.className = 'caret';
      caret.setAttribute('aria-hidden', 'true');
      frag.appendChild(caret);
    }
    host.appendChild(frag);

    let t = 0;
    spans.forEach((s, i) => {
      const c = text[i];
      schedule(host, () => {
        if ((tokens.get(host) || 0) !== token) return;
        s.classList.remove('ch--pending');
        s.classList.add('ch--in');
        // o caret acompanha a posição digitada; os glifos pendentes
        // permanecem no fluxo (invisíveis) para não haver reflow.
        if (caret) host.insertBefore(caret, s.nextSibling);
      }, t);
      const base = o.speed * (PAUSE[c] || 1);
      t += Math.max(4, base + rand(-o.jitter, o.jitter));
    });

    const total = t + o.charDur;
    schedule(host, () => {
      if ((tokens.get(host) || 0) !== token) return;
      if (caret) {
        caret.classList.add('caret--out');
        schedule(host, () => caret.remove(), 300);
      }
      if (o.onDone) o.onDone();
    }, t + 40);

    return total;
  }

  /* ── frase efêmera ──────────────────────────────────────
     Ciclo completo: revelação por caractere → sustentação →
     dissolução → o espaço volta a ficar vazio.
     `intensity` escala deslocamento, blur e escala por glifo.  */
  function letterDelay(c, base) {
    const j = rand(JITTER_LO, JITTER_HI);
    if (c === ' ' || c === '\u00a0') return base * SPACE_MULT * j;
    if (/[.,;:!?·]/.test(c)) return base * PUNCT_MULT * j;
    return base * j;
  }

  function makeEphChar(c, k) {
    const s = document.createElement('span');
    s.className = 'eph';
    if (c === ' ' || c === '\u00a0') {
      s.classList.add('eph--space');
      s.textContent = '\u00a0';
    } else {
      s.textContent = c;
    }
    s.style.setProperty('--dx', `${rand(-1.6, 1.6) * k}px`);
    s.style.setProperty('--dy', `${rand(1.2, 3.4) * k}px`);
    s.style.setProperty('--rot', `${rand(-1.1, 1.1) * k}deg`);
    s.style.setProperty('--scl', (1 - rand(0.012, 0.038) * k).toFixed(3));
    s.style.setProperty('--blur', `${rand(0.5, 1.3) * k}px`);
    s.style.setProperty('--dur', `${rand(150, 235)}ms`);
    return s;
  }

  function ephemeral(host, text, opts = {}) {
    const o = Object.assign({
      speed: T.charState,
      jitter: T.charStateJitter,
      hold: 900,
      dissolve: 260,
      outStep: 8,
      intensity: 0.7,
      caret: false,
      persist: false,
      lead: '',
      wrapWords: false,
      onDone: null,
    }, opts);

    const s = S();
    o.speed *= s; o.jitter *= s; o.dissolve *= s; o.outStep *= s;
    o.hold = Math.max(420, o.hold * s);
    o.intensity *= K();

    cancel(host);
    const token = tokens.get(host) || 0;
    const alive = () => (tokens.get(host) || 0) === token;
    host.textContent = '';

    const phrase = document.createElement('span');
    phrase.className = 'eph-phrase';
    if (o.lead) {
      const lead = document.createElement('span');
      lead.className = 'sbar__lead';
      lead.textContent = o.lead;
      phrase.appendChild(lead);
    }

    const k = reduced() ? 0 : o.intensity;
    const chars = [];
    const appendChars = (parent, value) => {
      for (const c of value) {
        const char = makeEphChar(c, k);
        chars.push(char);
        parent.appendChild(char);
      }
    };
    if (o.wrapWords) {
      // Mantém a primitiva e a cadência originais, agrupando apenas o fluxo
      // tipográfico para que o navegador nunca divida uma palavra ao meio.
      const groups = text.match(/\S+\s*|\s+/gu) || [];
      groups.forEach((value) => {
        const word = document.createElement('span');
        word.className = 'eph-word';
        appendChars(word, value);
        phrase.appendChild(word);
      });
    } else {
      appendChars(phrase, text);
    }
    let caret = null;
    if (o.caret && !reduced()) {
      caret = document.createElement('span');
      caret.className = 'caret';
      caret.setAttribute('aria-hidden', 'true');
      phrase.appendChild(caret);
    }
    host.appendChild(phrase);

    /* dissolução: da esquerda para a direita, mais rápida que a entrada */
    const dissolveAll = () => {
      if (!alive()) return;
      if (caret) caret.classList.add('caret--out');
      chars.forEach((s, i) => {
        s.style.setProperty('--out-dur', `${o.dissolve}ms`);
        schedule(host, () => { if (alive()) s.classList.add('eph--out'); }, i * (reduced() ? 0 : o.outStep));
      });
      const lead = phrase.querySelector('.sbar__lead');
      if (lead) lead.classList.add('is-fading');
      const total = chars.length * (reduced() ? 0 : o.outStep) + o.dissolve + 40;
      schedule(host, () => {
        if (!alive()) return;
        host.textContent = '';
        if (o.onDone) o.onDone();
      }, total);
    };

    if (reduced()) {
      chars.forEach((s) => s.classList.add('eph--in'));
      if (o.persist) {
        if (o.onDone) o.onDone();
        return 0;
      }
      schedule(host, dissolveAll, o.hold);
      return o.hold + o.dissolve;
    }

    let t = 0;
    chars.forEach((s, i) => {
      schedule(host, () => {
        if (!alive()) return;
        s.classList.add('eph--in');
        if (caret) s.after(caret);
      }, t);
      t += Math.max(6, letterDelay(text[i], o.speed) + rand(-o.jitter, o.jitter));
    });

    if (o.persist) {
      schedule(host, () => { if (alive() && o.onDone) o.onDone(); }, t + 40);
      return t;
    }

    schedule(host, dissolveAll, t + o.hold);
    return t + o.hold + o.dissolve;
  }

  /* ── status padrão VARISPEED ────────────────────────────
     Esta é a assinatura oficial de feedback textual do app.
     A cadência deriva diretamente da confirmação de exportação:
     entrada por glifo perceptível, sustentação legível e dissolução
     lenta da esquerda para a direita. Componentes podem variar apenas
     a sustentação/persistência; a linguagem de movimento é a mesma. */
  function statusFx(host, text, opts = {}) {
    const str = String(text == null ? '' : text);
    const o = Object.assign({
      speed: T.charEvent,
      jitter: T.charEventJitter,
      hold: 1450,
      dissolve: 420,
      outStep: 11,
      intensity: 1,
      caret: true,
      persist: false,
      maxEnter: 1800,
    }, opts);

    // Mensagens técnicas muito longas não podem levar vários segundos só
    // para entrar. Mantém a mesma cadência relativa, mas limita a duração
    // aproximada da revelação sem afetar mensagens comuns/exportações.
    if (!reduced() && o.maxEnter > 0 && str.length > 0) {
      const rough = str.length * o.speed;
      if (rough > o.maxEnter) {
        const factor = Math.max(0.34, o.maxEnter / rough);
        o.speed *= factor;
        o.jitter *= factor;
      }
    }
    delete o.maxEnter;
    return ephemeral(host, str, o);
  }

  /**
   * Microatualização numérica: só os glifos que mudaram se movem,
   * e a direção do deslocamento acompanha o sentido do incremento.
   */
  function digitTick(host, prev, next, dir, onDone) {
    cancel(host);
    const token = tokens.get(host) || 0;

    if (reduced()) {
      host.textContent = next;
      if (onDone) onDone();
      return 0;
    }

    host.textContent = '';
    const prevPad = String(prev).padStart(next.length, ' ');
    const frag = document.createDocumentFragment();
    const moving = [];

    for (let i = 0; i < next.length; i++) {
      const c = next[i];
      const changed = prevPad[i] !== c;
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = c;
      if (changed) {
        s.classList.add('ch--pending');
        s.style.setProperty('--ch-dur', `${T.micro * S()}ms`);
        s.style.setProperty('--ch-dy', `${dir >= 0 ? 3 : -3}px`);
        s.style.setProperty('--ch-blur', '0px');
        moving.push(s);
      }
      frag.appendChild(s);
    }
    host.appendChild(frag);

    moving.forEach((s, i) => {
      schedule(host, () => {
        if ((tokens.get(host) || 0) !== token) return;
        s.classList.remove('ch--pending');
        s.classList.add('ch--in');
      }, i * 13);
    });

    const total = moving.length * 13 + T.micro * S();
    schedule(host, () => {
      if ((tokens.get(host) || 0) !== token) return;
      if (onDone) onDone();
    }, total + 30);
    return total;
  }

  /** Troca de rótulo curta: dissolve o texto anterior e entra o novo. */
  function swapLabel(host, text, holdMs, onRevert) {
    const original = host.textContent;
    cancel(host);
    if (reduced()) {
      host.textContent = text;
      schedule(host, () => { host.textContent = original; if (onRevert) onRevert(); }, holdMs);
      return;
    }
    host.classList.add('is-swap-out');
    schedule(host, () => {
      host.textContent = text;
      host.classList.remove('is-swap-out');
      host.classList.add('is-swap-in');
      schedule(host, () => host.classList.remove('is-swap-in'), T.quick);
      schedule(host, () => {
        host.classList.add('is-swap-out');
        schedule(host, () => {
          host.textContent = original;
          host.classList.remove('is-swap-out');
          host.classList.add('is-swap-in');
          schedule(host, () => host.classList.remove('is-swap-in'), T.quick);
          if (onRevert) onRevert();
        }, 100);
      }, holdMs);
    }, 100);
  }

  return { typeOut, ephemeral, status: statusFx, digitTick, swapLabel, marquee, cancel, reduced, configure, T };
})();
