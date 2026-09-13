/* Synthetic, disposable fixtures. Never loaded or allowed by production. */
(async () => {
  'use strict';
  if (location.origin !== 'http://127.0.0.1:8767') throw new Error('Preview requires isolated port 8767');
  const params = new URLSearchParams(location.search);
  const groups = ['Atmosféricas', 'Ritmo & repetição', 'Escuta noturna', 'Ainda por ouvir'];
  const categories = groups.map((name, i) => ({ id: `category:custom:preview-${i}`, name }));
  const titles = ['Memória de uma tarde', 'Entre o silêncio e o ruído', 'O tempo se move devagar', 'Repetição / estudo 04', 'Uma faixa com título muito longo para verificar o encaixe da tipografia sem cobrir os metadados', 'Sinais de casa', 'Música para atravessar a noite', 'Antes do amanhecer'];
  const palettes = [['#17233d', '#c99a54'], ['#183832', '#79b5a9'], ['#3b1f2d', '#c0758f'], ['#302b55', '#8ca7d8']];
  const thumbnail = (index) => {
    const [from, to] = palettes[index % palettes.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><defs><linearGradient id="g"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="240" height="160" fill="url(#g)"/><circle cx="${52 + (index % 4) * 36}" cy="80" r="42" fill="rgba(255,255,255,.18)"/><path d="M0 ${110 - (index % 3) * 18} Q60 30 120 100 T240 58 V160 H0Z" fill="rgba(0,0,0,.25)"/></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  };
  const sampleRate = 8000, seconds = 8;
  const buffer = new ArrayBuffer(44 + sampleRate * seconds * 2);
  const view = new DataView(buffer);
  const ascii = (at, str) => [...str].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)));
  ascii(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); ascii(36, 'data'); view.setUint32(40, buffer.byteLength - 44, true);
  for (let i = 0; i < sampleRate * seconds; i++) view.setInt16(44 + i * 2, Math.sin(i / sampleRate * Math.PI * 2 * 220) * 800, true);
  const audio = new Blob([buffer], { type: 'audio/wav' });
  const tracks = Array.from({ length: params.has('empty') ? 0 : 32 }, (_, i) => ({
    id: `preview-track-${i}`, title: `${titles[i % titles.length]}${i >= 8 ? ` · ${i + 1}` : ''}`,
    fileName: `preview-${i}.wav`, sourceType: 'local', sourceLabel: 'ARQUIVO LOCAL',
    byline: i % 3 ? 'Acervo de teste / áudio sintético' : '',
    categoryId: i % 4 === 3 ? '' : categories[i % 3].id,
    favorite: i % 5 === 0, duration: seconds, rate: i % 3 === 0 ? 75 : 100,
    size: audio.size, channels: 1, sampleRate, thumbnail: thumbnail(i), createdAt: 1000 + i, lastOpenedAt: 1000 + i,
  }));
  localStorage.setItem('varispeed.library.v1', '[]');
  localStorage.setItem('varispeed.library.categories.v1', JSON.stringify(params.has('empty') ? [] : categories));
  localStorage.setItem('varispeed.library.tutorial.v1', params.has('guide') ? '0' : '1');
  const script = document.createElement('script');
  script.src = 'app.js';
  script.onload = async () => {
    await window.MediaLibrary.ready;
    for (const item of tracks) await window.MediaLibrary.record(item, audio);
  };
  document.body.append(script);
})();
