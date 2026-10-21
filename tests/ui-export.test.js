'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { join } = require('node:path');
const Core = require('../core.js');

// Executa o tratador do app com renderização controlada, sem copiar sua regra.
const app = readFileSync(join(__dirname, '../app.js'), 'utf8');
const start = app.indexOf('  const outSampleRate =');
const end = app.indexOf('  /* aviso ao sair com exportação em curso */', start);
assert.ok(start >= 0 && end > start, 'Seção de exportação ausente');
function harness() {
  const values = {'export.bits':'24', 'export.sampleRate':'48000', 'export.normalize':true, 'export.ceiling':-1, 'export.name':'{nome}_{rate}pct'};
  const element = () => ({textContent:'', disabled:false, classList:{add(){},remove(){}}, attributes:new Map(),setAttribute(k,v){this.attributes.set(k,v)},removeAttribute(k){this.attributes.delete(k)}});
  const el = Object.fromEntries(['exportName','exportFormat','exportProcessing','btnExport','exportLabel'].map(k => [k,element()]));
  let click;
  el.btnExport.addEventListener = (_, callback) => { click=callback; };
  let finishRender;
  const calls={encodes:[],downloads:[],contexts:[]};
  const state={loaded:true,exporting:false,rate:125,playing:false,meta:{name:'ensaio.wav',sampleRate:44100,channels:1},buffer:{duration:10,numberOfChannels:1}};
  class OfflineAudioContext {
    constructor(channels,frames,sr){calls.contexts.push({channels,frames,sr});this.destination={};}
    createBufferSource(){return {playbackRate:{value:0},connect(){},start(){}};}
    startRendering(){return new Promise(resolve => {finishRender=resolve});}
  }
  const context={Core,el,state,cfg:k=>values[k],scope:{},performance:{now:()=>0},motionSweep:()=>false,syncStatusPriority(){},status(){},dot(){},repaintScope(){},announceExport(){},celebrateExport(){},setTimeout(){},window:{OfflineAudioContext,Motion:{cancel(){}}},URL:{createObjectURL:()=>'blob:fixture',revokeObjectURL(){}},document:{createElement:()=>({click(){calls.downloads.push(this.download)}})},encodeOffThread:async(out,depth,opts)=>{calls.encodes.push({depth,opts});return {size:100};},encodeOnThread:()=>{throw new Error('Fallback inesperado')}};
  vm.runInNewContext(app.slice(start,end)+'\nglobalThis.renderSummary=renderExportSummary;', context);
  return {values,el,state,calls,render:context.renderSummary,click:()=>click(),finish:()=>finishRender({})};
}

test('Resumo acompanha o nome, amostragem, canais, profundidade e normalização',()=>{
  const h=harness();h.render();
  assert.equal(h.el.exportName.textContent,'ensaio_125-0pct.wav');
  assert.equal(h.el.exportFormat.textContent,'WAV · 24 bits PCM · 48 kHz · 1 canal');
  assert.equal(h.el.exportProcessing.textContent,'Pico normalizado a -1.0 dBFS');
  h.values['export.bits']='32f';h.values['export.normalize']=false;h.state.meta.channels=2;h.render();
  assert.equal(h.el.exportFormat.textContent,'WAV · 32 bits float · 48 kHz · 2 canais');
  assert.equal(h.el.exportProcessing.textContent,'');
  assert.equal(h.el.exportProcessing.hidden,true);
});

test('Alterações durante renderização não mudam a saída confirmada nem permitem exportação duplicada', async()=>{
  const h=harness();const pending=h.click();
  assert.equal(h.el.btnExport.disabled,true);
  assert.equal(h.el.btnExport.attributes.get('aria-busy'),'true');
  h.state.rate=200;h.state.meta.name='outra.wav';h.values['export.bits']='32f';h.values['export.normalize']=false;h.values['export.ceiling']=-3;h.values['export.sampleRate']='96000';h.render();
  assert.equal(h.el.exportName.textContent,'ensaio_125-0pct.wav');
  await h.click();assert.equal(h.calls.contexts.length,1);
  h.finish();await pending;
  assert.deepEqual(h.calls.downloads,['ensaio_125-0pct.wav']);
  assert.equal(h.calls.encodes[0].depth,'24');
  assert.equal(h.calls.encodes[0].opts.normalize,true);
  assert.equal(h.calls.encodes[0].opts.ceiling,-1);
  assert.deepEqual(h.calls.contexts[0],{channels:1,frames:384000,sr:48000});
  assert.equal(h.el.btnExport.disabled,false);
  assert.equal(h.el.btnExport.attributes.has('aria-busy'),false);
  assert.equal(h.el.exportName.textContent,'outra_200-0pct.wav');
  assert.ok(h.el.exportFormat.textContent.includes('32 bits float · 96 kHz'));
});
