# HANDOFF — VARISPEED

**Última atualização:** 21/08/2026 — baseline pós-REV 7 + Configurações auditadas + launcher oculto/LAN + startup minimalista + animação de exportação padronizada como feedback textual global.

## Objetivo deste documento

Este arquivo entrega o estado técnico atual do projeto para outro agente/desenvolvedor continuar sem precisar redescobrir a arquitetura.

Leia antes de modificar qualquer arquivo.

---

# 1. Estado do projeto

VARISPEED é um editor de velocidade de áudio com estética minimalista/técnica.

A característica central é **varispeed sem preservação de pitch**.

O projeto começou como aplicação 100% estática/client-side. Agora existe um backend local exclusivamente para **importação por link através de yt-dlp**.

Arquitetura atual:

```text
Frontend: HTML + CSS + JavaScript puro
Backend:  Python + FastAPI + yt-dlp
Áudio:    Web Audio API / HTMLAudioElement
Export:   WAV no navegador
```

Não há framework JS, bundler, npm ou banco de dados.

Feedbacks textuais do produto usam `Motion.status()`, cuja assinatura visual é derivada da confirmação de exportação. Não criar animações de status paralelas por componente.

Pré-requisitos de runtime para a versão com importação por URL:

- Windows/Linux/macOS com Python disponível no sistema;
- Python **3.11+ recomendado**;
- acesso à internet para instalar dependências na primeira execução e para o yt-dlp acessar a mídia;
- FFmpeg recomendado no `PATH` — alguns extractors/formatos podem depender dele.

Sem Python/backend, a interface estática ainda pode ser aberta, mas a **importação por URL via yt-dlp não funciona**.

---

# 2. Invariantes — não quebrar

## 2.1 Sem pitch correction

Esta é a decisão mais importante do produto.

Ao alterar velocidade:

- abaixo de 100% => áudio fica mais grave;
- acima de 100% => áudio fica mais agudo.

Não adicionar:

- phase vocoder;
- Rubber Band;
- SoundTouch com preserve pitch;
- `preservesPitch = true`;
- time-stretch compensado;
- qualquer DSP que mantenha tonalidade original.

O player define explicitamente:

```js
state.audio.preservesPitch = false;
state.audio.mozPreservesPitch = false;
state.audio.webkitPreservesPitch = false;
```

## 2.2 Backend não é motor de áudio

`yt-dlp` só resolve/obtém mídia remota.

Não mover para o backend:

- alteração de velocidade;
- waveform;
- osciloscópio;
- scrub;
- exportação WAV;
- processamento de arquivos locais.

## 2.3 Arquivo local continua privado/client-side

`load(file)` -> `ingest(file)`.

Nenhum upload ao FastAPI.

## 2.4 Entrada única do motor

Toda mídia deve convergir para:

```js
ingest(blob, srcName, srcSize)
```

Isso mantém importação local e remota equivalentes depois que os bytes chegam ao navegador.

---


# 2.5 Mascote do header — gato

A antiga identidade do cabeçalho (`ícone + VARISPEED + 1.0`) foi substituída por duas artes fotográficas pareadas do gato.

## Invariantes visuais

- `assets/cat-brand-light.png`: pelagem preta, olhos amarelos, fundo branco;
- `assets/cat-brand-dark.png`: pelagem branca, olhos amarelos, fundo preto;
- os olhos **não** devem ser dessaturados; não voltar a usar `grayscale()`/`invert()` para criar a versão Dark;
- as duas imagens têm o mesmo canvas/crop final (`1535 × 955`) e são renderizadas no mesmo container;
- Light e Dark ficam simultaneamente montadas, absolutas e sobrepostas; o tema alterna **somente `opacity`**;
- não alterar `object-position`, `object-fit`, largura, altura, `transform`, margin ou padding por tema;
- não adicionar transição geométrica entre Dark ↔ Light;
- o objetivo é que o gato permaneça imóvel durante a troca de tema.

## Tratamento dos assets

As imagens geradas originalmente continham uma faixa/"bordinha" horizontal artificial na parte inferior, aproximadamente a partir da linha `y=955`. Essa faixa foi removida dos dois arquivos antes de entrarem no projeto. **Não reintroduzir essa borda dentro da imagem.** A linha visual correta é a própria `border-bottom` do `.hdr`.

A arte Dark também foi submetida a um registro geométrico muito pequeno em relação à Light (aprox. `0.988×` e `-0.22°`) para alinhar melhor os centros dos olhos e minimizar deslocamento perceptível entre as duas fotografias. Não reaplicar filtros/transformações CSS sobre uma variante apenas.

Geometria atual em `styles.css`:

```css
.hdr__mascot {
  width: 168px;
  min-width: 168px;
  overflow: hidden;
}

.hdr__cat {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 90%;
  opacity: 0;
  filter: none;
  transform: none;
  transition: none;
}

[data-theme='dark'] .hdr__cat--dark { opacity: 1; }
[data-theme='light'] .hdr__cat--light { opacity: 1; }
```

A estrutura atual usa `.hdr__mascot`. Ela não é referenciada por `app.js` para efeitos visuais e **não possui bloom/glow**. O mascote é estático; Dark/Light alterna somente a camada fotográfica correspondente.

---

# 2.7 Créditos do criador nas Configurações

O final de `Configurações` agora possui um bloco de créditos, montado por `settings.js`, com a fotografia à esquerda e o texto centralizado verticalmente à direita.

Conteúdo atual e intencional:

```text
VARISPEED 1.0
CRIAÇÃO E DESENVOLVIMENTO — Gaspar
WEB AUDIO / OSCILOSCÓPIO
```

Assets:

```text
assets/creator-light.png
assets/creator-dark.png
```

## Invariantes do retrato

- as duas imagens precisam manter **o mesmo canvas, crop, escala e posição**;
- Dark e Light não podem usar transformações CSS diferentes;
- `.cfg__credits-photo` usa o mesmo `object-fit` e `object-position` para ambas;
- a troca de tema deve alterar somente qual camada possui `opacity: 1`;
- não aplicar `filter`, `scale`, `translate` ou animação individual a uma das variantes;
- preservar ao máximo rosto, cabelo, óculos, expressão e enquadramento;
- Dark: fundo preto + camiseta branca;
- Light: fundo branco + camiseta preta.

### Asset Light aprovado

`assets/creator-light.png` foi substituído pelo **retrato aprovado explicitamente pelo criador** nesta etapa. O arquivo original enviado é quadrado e foi somente redimensionado para `640 × 640 px` para corresponder ao canvas do asset Dark. Não houve regeneração, recorte adicional, estilização nem filtro CSS.

Não substituir o Light por uma imagem reimaginada/gerada sem pedido explícito. O objetivo é manter a aparência do retrato aprovado. A estabilidade entre temas continua sendo responsabilidade do mesmo container CSS e da alternância exclusiva por `opacity`; não aplicar `transform`, `filter`, `object-position` ou dimensões diferentes por tema.

## Blast radius

Se mexer neste bloco, revisar:

- `settings.js` — `buildCredits()` e montagem no fim de `#cfgBody`;
- `styles.css` — `.cfg__credits*`;
- `assets/creator-light.png`;
- `assets/creator-dark.png`;
- `server/main.py` — `PUBLIC_FILES`.

Nenhuma dependência nova foi adicionada por esta funcionalidade; `server/requirements.txt` permanece inalterado.

---


# 2.8 Responsividade — invariantes e breakpoints

A responsividade foi refinada sem redesenhar o desktop largo. Trate `>1200px` como **baseline visual**. As media queries adicionais ficam no final de `styles.css`, depois das regras legadas, para funcionarem como camada final de override.

Breakpoints vigentes:

```text
>1200           baseline desktop
901–1199        desktop compacto / notebook
641–900         tablet / janela estreita
521–640         mobile largo
421–520         phone
<=420           phone estreito
height <=720    notebook baixo (somente width >=901)
height <=520    mobile landscape / viewport baixo (width <=900)
```

## Regras por área

1. **Main/Inspector**
   - `<=900px`: `.main` vira uma coluna; a timeline fica em cima. `.insp` usa grid horizontal `painel | divisor | painel | divisor | painel`, e `.insp__foot` ocupa a largura inteira.
   - `<=640px`: `.insp` volta para `flex-direction: column`; divisores retornam a linhas horizontais.
   - Não mover a timeline para baixo do inspector em mobile.

2. **Linkbar**
   - Desktop mantém `thumbnail | metadados | duração | CTA`.
   - `<=720px`: CTA vai para linha inteira; thumbnail/metadados/duração permanecem alinhados.
   - `<=520px`: query vira `URL + fechar`, com `Analisar` em linha própria; preview vira duas colunas.
   - O estado `Importado`/disabled continua controlado por JS; responsividade não deve alterar a máquina de estados.

3. **Header**
   - Reduz a largura do mascote progressivamente.
   - `<=720px`: mascote e ações ficam na primeira linha; arquivo + popout + osciloscópio ficam na segunda.
   - O botão de popout permanece imediatamente **à esquerda** do visualizador do osciloscópio.
   - Não reintroduzir atalho de tema no header.

4. **Timeline/Transport**
   - Metadados `DUR` e `RATE` são secundários e podem desaparecer antes da waveform ser comprimida.
   - Volume continua oculto em telas estreitas conforme regra existente.
   - Em mobile, reduzir gaps/paddings antes de empilhar transport.

5. **Inspector de velocidade**
   - `<=640px`: presets usam grid `3 × 2`.
   - Dispositivos touch (`pointer: coarse`) recebem targets um pouco maiores.

6. **Configurações e créditos**
   - `<=520px`: `.cfg` ocupa 100% da largura.
   - `<=420px`: rows inline podem empilhar.
   - Créditos preservam os dois assets Light/Dark sobrepostos no mesmo box; media queries podem mudar o tamanho do box, mas **nunca aplicar geometria diferente por tema**.

7. **Viewports baixos**
   - Desktop baixo comprime tokens estruturais (`--hdr-h`, `--transport-h`, `--ruler-h`, `--sbar-h`) e paddings do inspector/linkbar.
   - Mobile landscape baixo deve rolar verticalmente em vez de reduzir a waveform a uma faixa inutilizável.

## Regra de manutenção

Ordem recomendada ao acomodar novos componentes:

```text
1. reduzir densidade/gutters
2. permitir truncamento de texto secundário
3. reorganizar grid/flex
4. empilhar
5. ocultar apenas informação secundária
```

Não adicionar dezenas de breakpoints específicos por dispositivo. Prefira os breakpoints estruturais acima.

## REV 2 concluída — hardening por viewport e conteúdo extremo

A REV 2 foi executada sobre a estrutura responsiva anterior. Mudanças vigentes:

- `.hdr__filemeta` agora possui largura máxima + ellipsis e é ocultado em `<=900px`, dando prioridade ao nome da mídia;
- duração da prévia remota recebeu coluna de `72px` para suportar horas sem colidir com o CTA;
- duração desconhecida usa `—` visualmente e `title="Duração desconhecida"`;
- `urlTitle`, `urlByline` e `urlSource` recebem `title` com o conteúdo completo;
- progresso remoto limita/trunca o texto de estágio em vez de expandir o grid;
- mensagens da linkbar quebram URLs/tokens longos com segurança;
- em `<=520px`, o título remoto pode usar duas linhas;
- em `<=380px`, thumbnail e gutters são reduzidos antes de comprimir texto crítico;
- em `height <=520px` + `width <=900px`, header/linkbar ficam mais compactos e a waveform usa piso de aproximadamente `240px`;
- Configurações usam drawer de até `440px` em `<=720px` e até `480px` em landscape baixo, passando a full-width em phone;
- prevenção de overflow horizontal foi aplicada sem colocar `overflow` no elemento `html`, pois isso quebra a rolagem vertical root em Chromium. O `body` usa `overflow-x: clip` na camada responsiva.

QA da REV 2:

```text
1920×1080, 1600×900, 1366×768, 1280×720, 1024×768, 900×600,
768×1024, 430×932, 390×844, 360×800, 844×390 e 667×375
```

Foram simulados nomes/URLs/títulos longos, duração `123:45:56`, rate `800%`, tempos grandes, progresso com label longo, erro com URL sem espaços e Configurações roladas até os créditos. O documento permaneceu sem overflow horizontal e com rolagem vertical funcional.

## REV 3 concluída — Canvas / resize real

A REV 3 foi implementada sem alterar o layout visual. O contrato agora é: **resize muda somente geometria de renderização; nunca o estado temporal da sessão**.

### `app.js`

- waveform e ruler compartilham `W/H/RH/canvasDpr`;
- `resize(force = false)` compara CSS width/height e DPR antes de tocar em `canvas.width/height`;
- não chamar `setZoom`, `seek`, `play` ou `pause` no caminho de resize;
- `scheduleResize()` agrupa eventos em `requestAnimationFrame` e possui uma passada de *settle* de ~140 ms;
- observar `#wave`, `#ruler` **e** `#canvasWrap` — não simplificar para observar apenas o pai;
- escutar também `window.resize`, `visualViewport.resize` e `orientationchange`;
- depois da realocação, executar `scopeResize()`, `draw()` e `movePlayhead()`; isso repinta o mesmo estado já existente.

### `scope-view.js`

O resize do osciloscópio preserva o envelope visual pausado. Antes de trocar o bitmap, guarda `top/bot`; quando existe frame congelado, reamostra esses arrays para a nova largura. Não voltar a zerar indiscriminadamente `top/bot`, pois isso faz o scope pausado desaparecer/virar linha plana após resize.

### `scope-win.js` e Focus Mode

- resize da janela independente é coalescido por `requestAnimationFrame`;
- a janela também observa `visualViewport.resize`;
- Focus Mode possui coalescing próprio para `#scopeFocus`;
- nenhuma dessas apresentações possui fonte de áudio ou estado de reprodução próprio.

### Invariantes de estado

Durante resize/orientação devem permanecer iguais:

```text
state.zoom
state.view
state.rate
state.playing
audio.currentTime
audio.playbackRate
```

O playhead pode mudar de coordenada X porque a largura física mudou; isso é correto. O **tempo representado** não pode mudar.

### QA da REV 3

- `node --check` em todos os `.js`;
- `python -m py_compile` no backend;
- verificação estática de listeners/observers e de que o caminho de resize não chama funções que alteram estado temporal;
- tentativa de smoke test automatizado com Chromium + áudio local foi bloqueada pelo ambiente de empacotamento com `ERR_BLOCKED_BY_ADMINISTRATOR`. Repetir no navegador real: carregar áudio, aplicar zoom, seek, iniciar playback, redimensionar/rotacionar e confirmar continuidade.

Nenhuma dependência nova foi necessária; `server/requirements.txt` permanece inalterado.

## REV 4 concluída — Touch / mobile

A REV 4 altera interação e hitboxes, não a arquitetura visual do desktop. Trate estes pontos como contrato vigente.

### Waveform/régua

- `#wave` e `#ruler` usam `touch-action: pan-y pinch-zoom`; não trocar por `none`, pois isso bloquearia o scroll vertical da página quando o gesto começa sobre a timeline;
- `app.js` mantém `waveGesture` com limiar `TOUCH_SLOP = 8`;
- mouse: seek/scrub imediato no `pointerdown`;
- touch/pen: tap curto faz seek; drag só vira scrub quando o deslocamento horizontal passa o limiar e domina o vertical;
- gesto vertical deve permanecer com o navegador; se houver `pointercancel`, limpar a sessão;
- sempre tratar `pointerup`, `pointercancel` e `lostpointercapture`; não voltar ao listener temporário antigo que tratava apenas `pointerup`.

### Scrub/ranges

- `#scrub` encerra `state.scrubbing` em `pointerup`, `pointercancel`, `lostpointercapture`, `change` e `blur`;
- `.slider`/`.scrub` usam `touch-action: none` porque o gesto iniciado diretamente no range é deliberadamente horizontal;
- em `pointer: coarse`, o input ganha 32 px de altura e thumb um pouco maior, mas o track continua com 2 px.

### Touch targets e hover

- `pointer: coarse`: `--ctl-h` sobe para 36 px; itens do menu `Importar` usam 44 px; fechar linkbar/Configurações/Focus usa 44×44 px;
- não reduzir esses alvos sem testar em phone real;
- controles usam `touch-action: manipulation` e `-webkit-tap-highlight-color: transparent`;
- `@media (hover: none)` neutraliza hover cosmético sticky. Não remover sem substituir por uma estratégia equivalente; feedback funcional deve vir de `:active`, `:focus-visible`, `aria-pressed` e estados de dados.

### Configurações móveis

- `settings.js` adiciona `html.cfg-open` no `open()` e remove no `close()`; em `<=900px` isso bloqueia o scroll do documento de trás;
- `.cfg` usa `height: 100dvh` em telas estreitas; `.cfg__body` mantém scroll vertical próprio, momentum e overscroll contido;
- o `label` de campo booleano permanece com `for=<id do switch>`; não remover essa associação, pois ela amplia o alvo de toque para o texto;
- em phone + coarse, `.txt`/`.sel` usam 16 px para evitar auto-zoom do iOS;
- `viewport-fit=cover` está no `index.html`/`scope.html` e safe areas são tratadas em `styles.css`.

### Invariantes de produto durante touch

Gestos nunca podem alterar sem intenção explícita:

```text
state.rate
state.zoom (exceto botões/controles próprios)
state.playing
import state
tema
```

Scrub pode alterar somente o tempo; scroll vertical não pode alterar o tempo.

### QA da REV 4

- `node --check` em todos os `.js`;
- `python -m py_compile` no backend;
- verificação estática de `touch-action`, listeners `pointercancel/lostpointercapture`, associação `label[for]` dos switches e ausência de nova dependência;
- smoke test manual recomendado em dispositivo real: tap + drag horizontal na waveform, scroll começando sobre waveform, sliders, abrir/fechar Importar, fechar linkbar, rolar Configurações até Créditos e abrir teclado em campos.

Nenhuma dependência nova foi necessária; `server/requirements.txt` permanece inalterado.

## REV 5 concluída — Edge cases de layout/estado

A REV 5 endurece a máquina de estados. Trate os pontos abaixo como contrato, não como detalhes cosméticos.

### Importação de mídia é transacional

`app.js` agora usa dois conceitos:

```text
mediaIntent         = intenção mais recente de trocar a mídia
activeDecodeIntent  = decode que atualmente controla a barra global de loading
```

Regras:

- arquivo local e importação remota criam uma nova intenção;
- `ingest(blob, ..., intent)` só pode fazer commit se `intent === mediaIntent`;
- decode antigo que termina depois de uma ação mais recente retorna `null` e não altera a sessão;
- falha de decode preserva a faixa anterior quando `state.loaded` já era `true`;
- somente na troca bem-sucedida o áudio anterior é pausado e `state.playing`/botão Play são normalizados;
- não voltar a definir `state.loaded = false` incondicionalmente no `catch` de `ingest()`.

Esse contrato evita três bugs antigos: arquivo inválido apagando o estado visual, duas decodificações concorrentes competindo e UI de Play ficando ativa após troca de `src`.

### Concorrência/cancelamento da linkbar

`linkUI.op` identifica a operação assíncrona corrente. `analyzeUrl`, download, progress callbacks e timers de settle só podem alterar UI se o `op` ainda for atual.

`linkAbort()`:

- aborta o `AbortController`;
- incrementa `linkUI.op` para invalidar callbacks antigos;
- se a fase era `import`, também incrementa `mediaIntent` porque `decodeAudioData()` não é cancelado pelo `AbortController`;
- restaura `aria-busy`, controles e estado do scope imediatamente.

Não remover a invalidação de `mediaIntent` no cancelamento de import: sem ela, fechar a linkbar durante “Decodificando” pode carregar o áudio alguns instantes depois.

`linkSettle(op)` também verifica o `op`; timers antigos de “Pronto” não podem esconder a barra de progresso de uma nova análise.

### Estado `Importado`

- botão disabled continua sendo feedback visual;
- `importRemoteAudio()` possui guarda lógica para a mesma URL, portanto `Enter` no input não contorna o disabled;
- `importedUrl` representa **somente a mídia remota atualmente carregada**;
- após arquivo local carregado com sucesso, `importedUrl = null` e aquela URL volta a ser elegível;
- falha de arquivo local não limpa `importedUrl`, pois a mídia remota anterior continua ativa.

### Arquivo local / drag-and-drop

- o `<input type=file>` é zerado depois de capturar o `File`, permitindo selecionar o mesmo arquivo novamente;
- drag overlay só reage quando `DataTransfer.types` contém `Files`;
- escolher/soltar arquivo local durante yt-dlp cancela a operação remota anterior.

### Paste / conteúdo extremo

- autoanálise da URL é disparada apenas pelo input resultante de paste;
- qualquer digitação seguinte cancela o timer de 180 ms;
- `#url` tem `maxlength=8192`;
- `export.name` tem limite 180 e `rate.presets` limite 120, aplicados também em `coerce()` para presets/localStorage;
- `buildPresets()` remove duplicatas, inválidos e valores fora dos limites antes do teto de 8 presets;
- saída WAV é sanitizada/truncada e protege nomes reservados Windows;
- `server/main.py` limita o título de `Content-Disposition` a 180 caracteres.

### Configurações / teclado virtual / foco

Enquanto o painel está aberto, `settings.js` sincroniza:

```text
--cfg-vvh   <- visualViewport.height
--cfg-vvtop <- visualViewport.offsetTop
```

Em `<=900px`, `.cfg` usa essas variáveis para acompanhar a área realmente visível acima do teclado virtual. Fallback: `100dvh` / `top:0`.

Outras invariantes:

- foco em input/select móvel chama `scrollIntoView(block:'nearest')` após o viewport estabilizar;
- `scroll-padding`/`scroll-margin` reservam espaço para barra/rodapé/teclado;
- Tab fica preso dentro do painel somente em `<=900px`;
- `aria-modal` acompanha o breakpoint;
- foco volta ao elemento anterior ao fechar;
- `panelTimer` é sempre cancelado ao reabrir: não permitir que timeout de fechamento antigo esconda painel reaberto;
- rows dependentes recebem `aria-disabled` junto de `.is-off`/`input.disabled`.

### Preset JSON

Evento `cfg:imported` usa `detail`:

```text
< 0  JSON inválido
= 0  carregou, mas nenhum ajuste compatível mudou
> 0  quantidade de ajustes aplicados
```

Não voltar à mensagem genérica “Preset aplicado” para todos os casos.

### CSS da REV 5

A camada final de `styles.css` adiciona somente hardening:

- opacidade consistente para controles disabled;
- cursor de busy via `aria-busy`;
- quebra de tokens extremos em rows/hints/créditos;
- wrap de atalhos;
- `scroll-padding`/`scroll-margin` para foco móvel;
- dimensões de `.cfg` vindas da visual viewport.

Não usar esta seção para redesenhar os breakpoints das REV 1–4.

### QA da REV 5

Obrigatório ao mexer nestes fluxos:

1. tocar faixa A e tentar importar arquivo inválido → A continua utilizável;
2. iniciar importação remota e cancelar em “Baixando” e “Decodificando” → mídia não entra depois;
3. iniciar importação remota e soltar arquivo local → local vence;
4. importar URL A, carregar arquivo local, analisar A novamente → botão volta a habilitar;
5. importar URL A e pressionar Enter novamente → não reimporta A;
6. selecionar o mesmo arquivo local duas vezes → segundo `change` funciona;
7. colar URL e imediatamente continuar digitando → autoanálise antiga é cancelada;
8. abrir/fechar/reabrir Configurações rapidamente → painel não some por timer antigo;
9. abrir teclado em campo próximo ao fim das Configurações → campo/rodapé continuam navegáveis;
10. testar nome de exportação longo/reservado e preset JSON inválido.

Nenhuma dependência nova foi adicionada. `server/requirements.txt` permanece inalterado.

## REV 6 concluída — Scaling / zoom / DPR fracionário

A REV 6 trata a relação entre **CSS px, device px e backing store do Canvas** como contrato explícito.

### DPR e backing store

Em `app.js`:

```text
CSS size real (pode ser fracionário)
        × devicePixelRatio
        ↓
round() somente no backing store físico
        ↓
ctx.setTransform(backing/css)
```

Regras:

- `canvasDprNow()` aceita `0.5–3`; não voltar ao clamp mínimo `1`, pois zoom abaixo de 100% pode produzir DPR `0.8/0.9`;
- não arredondar `getBoundingClientRect().width/height` antes de calcular o bitmap;
- `setCanvasBitmap()` usa `backing / cssSize` como escala efetiva do contexto;
- tolerância de mudança geométrica é `0.05 CSS px`; DPR usa tolerância `0.0001`;
- `W/H/RH`, `state.zoom`, `state.view`, `currentTime` e playback continuam conceitualmente separados: scaling não pode alterar estado temporal.

### Mudança de DPR / troca de monitor

`app.js` e `scope-win.js` armam uma media query de resolução para o DPR atual e a rearmam no evento `change`:

```text
matchMedia('(resolution: <DPR atual>dppx)')
        ↓ DPR deixa de corresponder
rearmar watcher
        ↓
scheduleResize(settle)
```

Não remover esse watcher confiando somente em `window.resize`: mover uma janela entre monitores com escalas diferentes pode alterar DPR sem uma mudança de layout suficientemente confiável em todos os ambientes.

### Waveform / ruler / playhead

- `pointerSeek()` converte `clientX` proporcionalmente de `rect.width` para `W`; não voltar a passar o CSS offset diretamente para `xToSrc()`;
- playhead usa snap à grade física por `round(x * waveScaleX) / waveScaleX`; isso mantém a linha alinhada ao bitmap em DPR fracionário;
- grid/ticks desenhados com `fillRect()` ficam em coordenadas inteiras lógicas; não usar `+0.5` para retângulos. Offset de meio pixel é técnica para **stroke** de 1 px em DPR específico, não para `fillRect()`;
- waveform/ruler usam `image-rendering:auto`; não usar `pixelated` ou `crisp-edges` para “corrigir” blur.

### Osciloscópio

`scope-view.js`:

- mede `cssW/cssH` fracionários;
- limita o número de colunas do envelope ao arredondamento de CSS px para manter custo previsível;
- cria bitmap com `round(cssSize × DPR)`;
- aplica transform pela razão backing/logical;
- preserva/reinterpola envelope congelado conforme contrato da REV 3.

A janela popout possui watcher próprio de DPR porque vive em outro `Window`/monitor potencialmente diferente.

### Configurações e texto

- `settings.js` não arredonda mais `visualViewport.height/offsetTop`; escreve até 3 casas em `--cfg-vvh`/`--cfg-vvtop`;
- `text-size-adjust:100%` evita inflação automática inesperada, sem desabilitar browser zoom;
- numerais dinâmicos usam `tabular-nums` para reduzir deslocamento métrico quando rasterização/zoom muda.

### QA da REV 6

Matriz matemática validada para DPR:

```text
0.80 / 0.90 / 1.00 / 1.10 / 1.25 / 1.50 / 2.00 / 2.25 / 3.00
```

com CSS widths fracionárias; erro máximo de arredondamento do backing store `<= 0.5 device px`.

Validações automatizadas executadas:

- `node --check` em todos os JS;
- `python -m py_compile server/main.py`;
- balanceamento de chaves CSS;
- ausência de IDs duplicados em `index.html`;
- teste numérico da fórmula backing/CSS/DPR e endpoints de pointer mapping.

Smoke manual obrigatório no ambiente final:

```text
Windows: 100% / 125% / 150%
Browser: 80% / 90% / 100% / 110% / 125% / 150%
```

Além disso, mover o navegador entre dois monitores com scaling diferente e verificar inline scope + popout.

Nenhuma dependência nova foi adicionada; `server/requirements.txt` permanece inalterado.

### Estado da sequência de revisão

As REV 1–7 estão concluídas. A REV 7 é o baseline visual/comportamental; alterações posteriores devem ser tratadas como features ou correções específicas, não como uma nova revisão genérica.

# 2.9 Configurações pós-REV 7 — estado vigente

A tela de Configurações foi auditada contra a UI atual. **Não existe mais logo textual/ícone no header e não existe bloom no mascote.**

### Removido definitivamente

- `motion.bloom`;
- `motion.bloomGain`;
- `motion.bloomFreq`;
- `Motion.bloom()` em `motion.js`;
- custom properties CSS `--bloom*`;
- referência `el.brand`/`.hdr__brand` usada pelo runtime antigo.

Presets antigos podem conter essas chaves. `settings.js` ignora campos que não existem mais e poda chaves obsoletas da persistência local; **não mudar `tempo.cfg.v1` apenas por causa dessa limpeza**.

### Organização visível atual

1. **Animações** — mantém internamente o id/chaves `motion.*` para compatibilidade, mas o título `Motion` não é mais exibido.
2. **Osciloscópio** — parâmetros reais do analisador/visualizador.
3. **Exportação** — inclui agora `Avisar ao sair durante exportação` (chave legada `load.confirmExit`).
4. **Velocidade** — inclui agora `Lembrar última velocidade` (chave legada `load.rememberRate`).
5. **Timeline**.
6. **Interface**.
7. **Ao importar** — ficou restrito a comportamento de entrada: autoplay, reset de rate e preservação de zoom.
8. **Atalhos**.
9. **Diagnóstico** — rótulo `Animações efetivas`, mas o id de diagnóstico continua `motion`.
10. Créditos do criador no rodapé.

Rótulos de animação foram ajustados ao estado atual: `motion.status` aparece como **Animação padrão de status** e `Microtick da velocidade` como **Microanimação numérica**. A antiga opção `motion.exportName` foi removida do schema porque a animação de exportação passou a ser o padrão global, não uma exceção.

### Mascote / favicon

- container do gato: `.hdr__mascot`;
- camadas: `.hdr__cat--light` / `.hdr__cat--dark`;
- favicon: `assets/favicon.png`, recortado do gato Dark;
- `server/main.py::PUBLIC_FILES` deve continuar liberando o favicon;
- não reintroduzir configurações de bloom, brilho, flicker, escala ou deslocamento do gato.

---

# 2.9 Motion textual padrão — não fragmentar novamente

A animação visual da confirmação `Exportado · arquivo · tamanho` é agora a **referência oficial de feedback textual**. `motion.js` expõe `Motion.status(host, text, opts)` para centralizar essa linguagem.

Regras:

- transporte, importação, análise de link, download/decodificação, presets, mensagens de sistema e startup devem usar `Motion.status()` quando forem feedbacks textuais;
- `Motion.status()` herda a cadência da exportação: `charEvent`, jitter correspondente, `dissolve=420 ms`, `outStep=11`, intensidade cheia por padrão;
- eventos curtos variam somente a sustentação (`hold`);
- estados que precisam permanecer legíveis usam `persist:true`; a próxima atualização cancela o anterior;
- mensagens muito longas têm entrada automaticamente limitada a aproximadamente `1800 ms`;
- `motion.status` liga/desliga essa linguagem global;
- `motion.caret` vale para status temporários; estados persistentes podem omitir caret para não piscar indefinidamente;
- `motion.exportHold` continua específico à exportação porque nome e tamanho precisam de mais tempo de leitura;
- a chave antiga `motion.exportName` é legado removido do schema. Não reintroduzir uma engine separada apenas para exportação;
- `typeOut()` continua disponível para conteúdo que não é feedback de estado (ex.: nome da mídia), e `digitTick()` continua específico a números;
- **não aplicar motion estrutural em Configurações, dropdowns, Linkbar ou botões**. Esta padronização é apenas para feedback textual.

Outras áreas podem emitir `varispeed:status` para pedir feedback na status bar sem conhecer sua implementação. `settings.js` usa esse evento ao copiar o endereço LAN e ao iniciar o desligamento.

# 3. Estrutura atual

```text
.
├── index.html
├── styles.css
├── app.js
├── settings.js
├── motion.js
├── scope-view.js
├── scope-win.js
├── scope.html
├── remote-import.js
├── assets/
│   ├── cat-brand-light.png
│   ├── cat-brand-dark.png
│   ├── creator-light.png
│   ├── creator-dark.png
│   ├── favicon.png
│   └── varispeed.ico
├── VARISPEED.vbs
├── Criar atalho VARISPEED.vbs
├── launcher.py
├── startup.html
├── startup.css
├── startup.js
├── logs/
├── start-tempo.bat
├── start-tempo.sh
├── server/
│   ├── __init__.py
│   ├── main.py
│   └── requirements.txt
├── README.md
├── HANDOFF.md
└── .gitignore
```

`providers.js` não existe mais.

Se encontrar uma branch/cópia com `providers.js`, ela é anterior à migração yt-dlp.

---

# 2.6 Hierarquia atual do header

O header foi refinado para evitar controles redundantes. Trate os pontos abaixo como **decisões de UI vigentes**:

1. Existe apenas **um botão `Importar`** na área de ações. Ele abre `#importMenu` com duas opções:
   - `#importFile` → `Arquivo local` → dispara o `<input type="file" id="file">`;
   - `#importLink` → `Link` → abre `#linkbar` e o fluxo yt-dlp.
2. Não existe mais `#btnLink` separado no header. Não reintroduzir sem necessidade explícita.
3. `#btnPop` foi movido para `.hdr__scope-tools`, imediatamente **à esquerda** de `#scopeWrap`. O botão pertence visualmente ao osciloscópio que ele controla.
4. Os botões rápidos `#themeLight` / `#themeDark` foram removidos. O tema é alterado somente em **Configurações → Interface → Tema** (`ui.theme`).
5. Remover os atalhos do header **não removeu o sistema de temas**: `app.js` continua aplicando `ui.theme`, observando `prefers-color-scheme` no modo `system` e redesenhando Canvas quando necessário.

### Invariantes do menu Importar

- menu ancorado ao botão, não uma nova faixa permanente;
- fechar ao clicar fora ou pressionar `Escape`;
- `Arquivo local` não passa pelo backend;
- `Link` continua usando a linkbar existente;
- não duplicar regras de aquisição: ambos convergem em `ingest()` depois que existe um Blob;
- manter `aria-expanded`, `aria-haspopup="menu"`, `role="menu"` e `role="menuitem"`.

### Estado do botão `Importar áudio` na linkbar

Depois que uma mídia remota passa por download, decodificação e `ingest()` com sucesso, o preview atual entra em estado de **já importado**:

- `linkUI.importedUrl` guarda a URL remota concluída;
- `linkSyncImportButton()` centraliza o estado do CTA;
- para a mesma `requestUrl`, o texto passa a `Importado` e `#btnUrlImport` fica `disabled`;
- `linkIdle()` não deve reabilitar o botão de forma incondicional; ele chama `linkSyncImportButton()`;
- editar/analisar outra URL permite uma nova importação;
- reanalisar a mesma URL já importada continua mostrando `Importado`;
- **só marcar como importado depois de `ingest()` retornar sucesso**. Erro de rede, download, cancelamento ou falha de decodificação deve manter possibilidade de nova tentativa.

Não remover essa proteção sem uma decisão explícita de UX; ela evita clicar duas vezes e substituir/recarregar desnecessariamente o mesmo áudio logo após a importação.

---

# 4. Responsabilidade por arquivo


## `launcher.py` / `startup.*` / `VARISPEED.vbs`

Camada de bootstrap Windows sem dependências externas. Não misturar esse launcher com o motor de áudio nem mover lógica de yt-dlp para ele; sua responsabilidade é preparar runtime/backend, expor progresso real e redirecionar para a aplicação.

`startup.js` pode exibir estados e uma barra por marcos concluídos, mas não deve inventar percentual de `pip`/download quando essa informação não existir.

## `index.html`

Contém a interface principal.

O header contém um menu único `Importar` (`#importMenu`) com `Arquivo local` e `Link`. O botão de popout do osciloscópio está em `.hdr__scope-tools`, à esquerda do visualizador. O seletor rápido de tema foi removido; o tema permanece no painel de configurações.

A importação remota possui:

- campo URL;
- botão `Analisar`;
- preview de metadados;
- thumbnail;
- título;
- autor/canal;
- duração em coluna própria;
- CTA `Importar áudio` em coluna própria.

### Geometria vigente da linkbar

A área de importação por link foi refinada para não depender de distribuição implícita do espaço. Preserve esta estrutura salvo pedido explícito de redesign:

1. `.linkbar` é o container de uma coluna.
2. `.linkbar__query` controla a linha superior em quatro colunas: label, URL, `Analisar`, fechar.
3. `.linkbar__preview` usa quatro colunas: `112px` para thumbnail, `minmax(0, 1fr)` para metadados, coluna fixa para duração e coluna fixa para `Importar áudio`.
4. `#urlDuration` não fica mais dentro de `.linkbar__media`; isso evita que duração e título disputem a mesma grade.
5. A duração usa numerais tabulares e alinhamento à direita.
6. O CTA possui largura fixa no desktop, garantindo eixo consistente entre resultados de títulos/durações diferentes.
7. Em sucesso de análise/importação, não renderizar `Origem: ...` em `#urlMsg`; a origem já existe em `#urlSource`. `#urlMsg` fica disponível principalmente para erros e mensagens excepcionais.
8. Breakpoints reorganizam o CTA em largura total, mas não devem introduzir mudanças de fluxo ou IDs.

Blast radius dessa área: `index.html` + seção `.linkbar*` de `styles.css`; `app.js` apenas para estados/mensagens. Não alterar `remote-import.js` para ajustes puramente visuais.
- duração;
- extractor/origem;
- botão `Importar áudio`;
- barra de progresso/status.

Evitar adicionar lógica de negócio em scripts inline.

**REV 7:** o bloco `data-pplx-inline-edit` que vinha do ambiente de preview/edição foi removido de `index.html` e `scope.html`. Ele nunca fez parte da arquitetura do VARISPEED e não deve ser reintroduzido no build/pacote de produção.

## `styles.css`

Design system global.

Características:

- dark mode com fundo preto sólido;
- bordas mínimas;
- pouco arredondamento;
- sem visual de dashboard/card genérico;
- tipografia mono para valores técnicos;
- espaçamento baseado em tokens.

A preview do yt-dlp usa `.linkbar__preview` e derivados.

## `app.js`

Core do frontend.

Responsabilidades:

- estado de áudio;
- `load()`;
- `ingest()`;
- `decodeAudioData()`;
- playback;
- rate;
- waveform;
- zoom;
- transport;
- export WAV;
- estados visuais;
- menu unificado de importação (`importMenuOpen()`);
- orquestração da importação por link.

A seção `importação por link / yt-dlp` controla apenas UI/fluxo e chama `window.RemoteImport`.

## `remote-import.js`

Camada de transporte da importação remota.

Responsabilidades:

- validar URL básica no browser;
- `POST /api/media/info`;
- `POST /api/media/audio`;
- ler erros JSON do backend;
- receber a resposta binária em chunks;
- calcular progresso real quando existe `Content-Length`;
- extrair filename de `Content-Disposition`.

Não colocar options de yt-dlp aqui.

## `server/main.py`

Backend local.

Responsabilidades:

- validação defensiva da URL;
- bloquear destinos locais/privados;
- extrair metadados via yt-dlp sem download;
- baixar uma faixa de áudio;
- servir arquivo temporário;
- limpar temporários;
- servir somente os arquivos públicos necessários do frontend.

## `settings.js`

Configurações/persistência.

Não misturar configuração de yt-dlp aqui sem necessidade real. Parâmetros de backend devem preferencialmente ser env vars ou configuração backend separada.

## `motion.js`

Sistema de motion e microinterações.

Importação remota reutiliza animações de status e ticks de porcentagem.

## `scope-view.js`, `scope-win.js`, `scope.html`

Osciloscópio e popout.

São independentes da origem do áudio.

---

# 5. Fluxo da importação remota

## Etapa A — análise

Evento:

```text
paste / botão Analisar / Enter
```

Frontend:

```js
analyzeUrl(raw)
```

Depois:

```text
RemoteImport.parse
      ↓
POST /api/media/info
      ↓
yt-dlp extract_info(download=False)
      ↓
metadados
      ↓
linkShowPreview(meta)
```

A análise não deve baixar a mídia completa.

## Etapa B — confirmação

Usuário clica:

```text
Importar áudio
```

Frontend:

```js
importRemoteAudio()
```

Depois:

```text
POST /api/media/audio
      ↓
yt-dlp download
      ↓
FileResponse
      ↓
Blob no browser
      ↓
ingest(blob)
      ↓
decodeAudioData
      ↓
waveform
```

---

# 6. Estados visuais do link

Estados esperados:

```text
Obtendo informações
Baixando áudio
Decodificando
Pronto
```

Não criar porcentagem fictícia.

Durante preparação server-side do yt-dlp, a barra é indeterminada.

Depois que o servidor começa a responder e existe `Content-Length`, o navegador mede bytes recebidos e mostra porcentagem real.

---

# 7. Metadados atuais

`/api/media/info` retorna:

```text
id
title
uploader
channel
duration
thumbnail
extractor
site
webpage_url
```

A UI usa principalmente:

```text
title
uploader/channel
duration
thumbnail
extractor
```

Evitar enviar o objeto completo do yt-dlp para o browser. Ele é grande, instável e pode conter dados desnecessários.

---

# 8. Opções yt-dlp atuais

Metadados:

```python
skip_download = True
format = "bestaudio/best"
noplaylist = True
```

Download:

```text
bestaudio[ext=m4a]
/
bestaudio[ext=webm]
/
bestaudio
/
best
```

Motivo: preferir formatos reproduzíveis por browsers modernos sem transcodificar tudo.

Não adicionar conversão obrigatória para WAV no backend.

---

# 9. FFmpeg

FFmpeg é recomendado, mas a implementação não faz uma conversão fixa de todas as entradas.

Isso é intencional para evitar:

- CPU extra;
- dupla perda lossy;
- arquivos gigantes;
- espera desnecessária.

Se futuramente surgirem problemas frequentes de codec no browser, a evolução recomendada é **fallback opcional de normalização**, não conversão obrigatória de todos os links.

Exemplo de estratégia futura:

```text
1. tentar stream original M4A/WebM
2. se browser falhar
3. solicitar backend compatível
4. ffmpeg -> M4A/AAC ou outro formato definido
```

Não confundir isso com pitch correction.

---

# 10. Backend local e segurança

Os scripts iniciam Uvicorn em:

```text
127.0.0.1:8765
```

Manter localhost como padrão.

`server/main.py` implementa:

- esquema somente HTTP/HTTPS;
- bloqueio de localhost `.local`;
- verificação de IP literal;
- resolução DNS;
- rejeição de IP não global;
- `noplaylist`;
- rejeição de live;
- temporário por download;
- limpeza pós-resposta;
- whitelist de arquivos públicos.

Se alguém pedir deploy público, isso deixa de ser uma mudança simples. Antes de expor o serviço, considerar:

- autenticação;
- rate limit;
- filas/jobs;
- limites de duração/tamanho;
- quotas;
- sandbox do processo;
- logs estruturados;
- timeout global;
- política de cookies;
- proxy/reverse proxy;
- abuse prevention.

---

# 10.1 Inicialização local

## Windows — launcher de produção

O fluxo recomendado **não usa mais o terminal como interface de inicialização**. O ponto de entrada normal é:

```text
VARISPEED.vbs
```

ou o atalho criado por:

```text
Criar atalho VARISPEED.vbs
```

O atalho aponta para `wscript.exe`, passa `VARISPEED.vbs` como argumento e usa `assets/varispeed.ico`. Como `wscript.exe` + `WshShell.Run(..., 0, False)` são usados, a janela de console do bootstrap fica oculta.

Fluxo estrutural:

```text
VARISPEED.lnk
    ↓
wscript.exe → VARISPEED.vbs
    ↓
py -3 launcher.py (janela oculta)
    ↓
ThreadingHTTPServer stdlib :8764
    ↓
startup.html + /status + /retry
    ↓
bootstrap real em thread
    ↓
.venv + dependências + yt-dlp + FFmpeg
    ↓
Uvicorn :8765
    ↓
/api/health + GET /
    ↓
ready → startup redireciona para :8765
```

### Invariantes do launcher

- `launcher.py` **não pode depender de FastAPI, Uvicorn, yt-dlp ou libs externas**; ele deve continuar funcionando antes de `.venv` existir;
- startup temporário usa `127.0.0.1:8764`; backend principal escuta em `0.0.0.0:8765`, mas o host local/health-check usa `127.0.0.1:8765`;
- se `/api/health` já estiver saudável, não criar outra instância do backend;
- se `:8764/status` já existir, segundo clique reutiliza o bootstrap em andamento;
- FFmpeg ausente = `warn`, não erro fatal;
- a UI de startup **não mostra percentual nem checklist**; exibe uma única linha de estado e uma barra indeterminada de varredura;
- composição visual aprovada: bloco compacto centralizado com gato + `VARISPEED 1.0`, status abaixo e barra indeterminada; **não usar linha decorativa acima do logotipo nem linha decorativa abaixo da barra**; `.boot__panel` não possui `border-top`/`border-bottom`;
- logs técnicos devem continuar gravados em `logs/startup.log` e `logs/server.log`;
- erro no bootstrap deve manter a página de startup viva para `TENTAR NOVAMENTE` / `VER DETALHES`;
- depois de `ready`, startup permanece alguns segundos para completar o redirecionamento e então encerra;
- se uma tentativa criar o backend mas falhar antes de concluir, o launcher encerra **somente o processo criado por aquela tentativa** antes de permitir retry; nunca matar uma instância preexistente;
- o backend deve sobreviver ao encerramento do processo de launcher; no Windows ele é criado sem console e em novo process group.

### Arquivos envolvidos

- `VARISPEED.vbs` — ponto de entrada oculto;
- `Criar atalho VARISPEED.vbs` — cria `.lnk` no Desktop com ícone;
- `launcher.py` — state machine/bootstrap/HTTP temporário;
- `startup.html`, `startup.css`, `startup.js` — UI de inicialização;
- `assets/varispeed.ico` — ícone Windows multi-resolução;
- `server/main.py::/api/health` — health-check final;
- `logs/` — diagnóstico persistente.

## Windows — modo diagnóstico legado

`start-tempo.bat` permanece por compatibilidade e diagnóstico. **Ele não é mais o launcher principal do usuário.** Nesse modo, o terminal permanece visível e anexado ao Uvicorn.

O script ainda:

1. detecta Python 3.11+;
2. prefere `py -3`;
3. cria/reutiliza `.venv`;
4. instala/verifica dependências;
5. avisa sobre FFmpeg;
6. inicia Uvicorn em `0.0.0.0:8765` (acesso LAN); a interface local continua sendo aberta por `127.0.0.1:8765`.

Preservar as correções já documentadas para Python 3.13 e expansão de variáveis do `cmd.exe`; o fato de haver um launcher gráfico **não autoriza regredir o `.bat` de diagnóstico**.

## Linux/macOS

Permanece:

```bash
./start-tempo.sh
```

O launcher gráfico atual é uma experiência específica do Windows; não criar dependência Electron/PyInstaller apenas para igualar plataformas sem pedido explícito.

# 10.2 Tela de startup / máquina de estados

A máquina de estados interna continua acompanhando Python, `.venv`, dependências, yt-dlp, FFmpeg, servidor e interface, mas **a visão principal não renderiza essa lista**. Só existe uma linha textual por vez:

```text
INICIALIZANDO...
       ↓
VERIFICANDO PYTHON...
       ↓
PREPARANDO AMBIENTE...
       ↓
...
       ↓
PRONTO
```

`startup.js` consulta `/status` aproximadamente a cada 260 ms e, quando `stage` muda, chama `Motion.status()` do `motion.js` existente. É a mesma assinatura tipográfica da confirmação de exportação; **não introduzir motion estrutural na tela de startup**.

Abaixo da linha existe uma barra **indeterminada** com a mesma linguagem de varredura usada em `linkbar__track[data-mode="indet"]`. Não voltar a mostrar `%`, progresso fake ou checklist na tela principal.

Em falha, `TENTAR NOVAMENTE` e `VER DETALHES` continuam disponíveis. Logs técnicos só aparecem quando o usuário pede detalhes.

# 10.3 Favicon / ícone Windows

`assets/varispeed.ico` é derivado do favicon aprovado do gato e contém múltiplas resoluções (`16, 24, 32, 48, 64, 128, 256`). Ele serve ao atalho `.lnk`; o navegador continua aceitando também `assets/favicon.png`.

Se o favicon mudar no futuro, regenerar também o `.ico` para evitar identidade divergente entre navegador e launcher.


# 10.4 Rede local / Configurações → Sistema

O backend agora é intencionalmente acessível na LAN. `launcher.py` usa:

```text
APP_BIND_HOST = 0.0.0.0
APP_HOST      = 127.0.0.1   # health-check/redirecionamento local
APP_PORT      = 8765
```

`server/main.py` expõe:

- `GET /api/system/info` → `local_url`, `lan_urls`, `port`, `can_shutdown`;
- `POST /api/system/shutdown` → encerra o processo depois de responder.

### Invariantes de segurança

- `/api/system/shutdown` só aceita cliente loopback;
- quando houver header `Origin`, ele deve ser `127.0.0.1:8765` ou `localhost:8765`;
- clientes acessando por `192.168.x.x:8765` podem usar o editor/importação, mas **não podem desligar o computador host**;
- manter `_validate_url()` bloqueando destinos locais/privados para impedir que a importação yt-dlp vire proxy/SSRF da LAN;
- não orientar port-forward da porta 8765 para a internet.

Em `settings.js`, o grupo `Sistema` é runtime-only: **não entra em `tempo.cfg.v1` nem nos presets**. Ele mostra servidor, URL LAN e porta; possui `Copiar endereço` e `Desligar VARISPEED`. O desligamento dispara `varispeed:shutdown` antes do POST, para `app.js` pausar o áudio/fechar o AudioContext.

### Invariante de layout — grupo Sistema

- os dois botões de ação ficam **empilhados**, cada um ocupando 100% da largura útil;
- usar `.btn.cfg__system-action`, **não** `btn--ghost`;
- `.btn--ghost` possui geometria compacta e é inadequado para estes rótulos longos;
- manter `white-space: nowrap`, `min-width: 0` e `overflow: hidden`/`text-overflow: ellipsis` nas ações;
- não voltar a colocar `Copiar endereço` e `Desligar VARISPEED` em duas colunas dentro do drawer sem testar explicitamente em larguras estreitas;
- as linhas `Servidor / Rede local / Porta` devem manter label à esquerda e valor alinhado à direita sem overflow horizontal.

Blast radius deste bloco: `settings.js` (`buildSystemGroup()`), `styles.css` (`.cfg__system-*`) e, se a semântica mudar, esta seção do README/HANDOFF.

Se o Windows Firewall bloquear conexões, o usuário deve permitir Python/Uvicorn apenas em redes privadas.

# 11. Cookies/autenticação

Backend aceita opcionalmente:

```text
VARISPEED_COOKIES_FILE
```

Exemplo:

```text
VARISPEED_COOKIES_FILE=C:\segredo\cookies.txt
```

Não colocar cookies no repositório.

Não enviar cookies ao frontend.

Não salvar credenciais em `settings.js`/localStorage.

---

# 12. Limite opcional de duração

Existe env var:

```text
VARISPEED_MAX_DURATION_SECONDS
```

`0` ou ausente = sem limite configurado pelo VARISPEED.

Se o app for publicado no futuro, definir um limite deve ser considerado obrigatório.

---

# 13. Plataformas

A versão antiga bloqueava explicitamente YouTube/Spotify/etc. no browser porque dependia de CORS.

Isso mudou.

Agora o critério é:

```text
yt-dlp consegue extrair essa URL no ambiente atual?
```

Portanto:

- YouTube pode funcionar;
- links diretos podem funcionar;
- outras plataformas suportadas pelo yt-dlp podem funcionar;
- autenticação/cookies podem ser necessários;
- DRM não é removido pelo projeto;
- extractors podem quebrar quando sites mudam.

Não codificar uma promessa de “suporta todas as plataformas”.

---

# 14. Erros esperados

Frontend diferencia principalmente:

- URL inválida;
- backend não iniciado;
- erro retornado pelo yt-dlp;
- cancelamento;
- falha de decodificação do browser.

`netFail()` em `app.js` transforma falhas de conexão em instrução para iniciar o backend.

Backend usa HTTP:

```text
400 -> URL inválida/bloqueada
413 -> limite configurado excedido
422 -> yt-dlp não conseguiu processar / mídia não suportada
500 -> falha interna inesperada
```

---

# 15. Cancelamento

O frontend usa `AbortController`.

Escape ou fechar a linkbar aborta a requisição HTTP no browser.

Importante: isso não garante interromper instantaneamente um `yt-dlp` que já está executando em thread no servidor. O backend atual é simples e síncrono por job (`asyncio.to_thread`).

Se cancelamento server-side forte se tornar requisito, migrar download para processo/job gerenciável e expor ID de job + endpoint de cancelamento.

Não fingir que o cancelamento atual mata o processo do yt-dlp.

---

# 16. Concorrência

Cada requisição de download usa diretório temporário próprio.

FastAPI chama a operação bloqueante via:

```python
asyncio.to_thread(...)
```

Isso é adequado para uso local leve.

Não considerar essa arquitetura pronta para grande escala pública.

---

# 17. Ponto de maior risco no frontend

`app.js` é grande e concentra várias responsabilidades.

Ao modificar a importação remota:

- não alterar `ingest()` sem necessidade;
- não tocar exportação WAV;
- não mudar cálculo de peaks;
- não alterar `playbackRate`;
- não alterar osciloscópio.

Idealmente mantenha mudanças de rede em `remote-import.js` e UI de link na seção dedicada do `app.js`.

---

# 18. Ponto de maior risco no backend

`_download_sync()` escolhe o maior arquivo final produzido no diretório temporário.

Isso funciona porque o outtmpl usa ID e não existem sidecars habilitados.

Se futuramente forem adicionados:

- thumbnails salvas;
- subtitles;
- info JSON;
- chapters;
- múltiplos formatos;

então a lógica de seleção do arquivo final deve ser revisada.

---

# 19. Blast radius por tipo de mudança

| Mudança | Arquivos principais | Risco |
|---|---|---|
| texto/layout da preview | `index.html`, `styles.css` | baixo |
| fluxo de analisar/importar | `app.js` | médio |
| protocolo HTTP frontend | `remote-import.js` | médio |
| opções yt-dlp | `server/main.py` | médio/alto |
| codecs/normalização | `server/main.py`, `app.js` | alto |
| pitch/velocidade | `app.js` | crítico |
| waveform | `app.js` | alto |
| export WAV | `app.js` | alto |
| osciloscópio | `scope-*`, `app.js` | alto |
| deploy público | backend + infra | crítico |

---

# 20. Testes obrigatórios após mexer em URL import

1. iniciar via `start-tempo`;
2. `/api/health` responde;
3. abrir interface;
4. colar URL válida;
5. estado `Obtendo informações`;
6. preview aparece;
7. download NÃO começa antes da confirmação;
8. clicar `Importar áudio`;
9. estado `Baixando áudio`;
10. progresso real aparece se houver `Content-Length`;
11. estado `Decodificando`;
12. waveform aparece;
13. play funciona;
14. alterar rate muda pitch naturalmente;
15. export WAV funciona;
16. cancelar/fechar não quebra estado da UI;
17. URL inválida gera erro legível;
18. `http://127.0.0.1/...` é rejeitado;
19. backend desligado gera instrução clara;
20. arquivo local ainda funciona sem passar pela API.

---

# 21. Testes de regressão gerais

Além do fluxo remoto:

- WAV local;
- MP3 local;
- drag and drop;
- play/pause/stop;
- loop;
- scrub;
- zoom;
- presets de rate;
- volume;
- dark/light via Configurações (sem botões de tema no header);
- configurações;
- focus mode;
- popout e sua posição à esquerda do visualizador do osciloscópio;
- exportação;
- reduced motion;
- menu `Importar` abre/fecha, `Arquivo local` chama o seletor nativo e `Link` abre a linkbar;
- não existe `btnLink` separado no header;
- não existem `themeLight`/`themeDark` no header;
- tema continua alterável em Configurações;
- `btnPop` permanece à esquerda de `scopeWrap`.

---

# 22. Comandos de validação

Antes de qualquer validação backend no Windows, confirmar:

```bat
py --version
python --version
```

Pelo menos um dos dois deve resolver para uma instalação Python válida.

JavaScript:

```bash
node --check app.js
node --check motion.js
node --check remote-import.js
node --check scope-view.js
node --check scope-win.js
node --check settings.js
```

Python:

```bash
python -m py_compile server/main.py
```

Servidor:

```bash
python -m uvicorn server.main:app --host 0.0.0.0 --port 8765
```

---

# 23. Dependências

Runtime local:

```text
Python 3.11+ recomendado
FFmpeg recomendado
```

`server/requirements.txt`:

```text
fastapi
uvicorn[standard]
yt-dlp
```

Não existe dependência JavaScript instalada.

Não adicionar npm apenas para uma função pequena sem justificar a mudança arquitetural.

---

# 24. Próximas evoluções coerentes

Se solicitadas, fazem sentido:

## A. progresso server-side real do yt-dlp

Implementar jobs + SSE/WebSocket/progress endpoint.

O `yt-dlp` possui progress hooks, mas a UI atual não os recebe.

## B. cancelamento server-side real

Executar downloads em subprocessos/jobs identificáveis e encerráveis.

## C. fallback de codec

Se `decodeAudioData()` falhar, oferecer reprocessamento compatível via FFmpeg.

## D. cache temporário curto

Evitar extrair/baixar duas vezes quando usuário reimporta imediatamente a mesma URL.

Requer política clara de TTL e tamanho.

## E. metadata token/job

Após `/info`, backend poderia devolver token curto para `/audio`, evitando repetir URL e parte da extração.

## F. deploy público

Só com autenticação/rate limit/quota/sandbox/observabilidade.

---

# 25. O que não fazer

Não:

- reintroduzir providers CORS para YouTube;
- tentar extrair stream assinado do YouTube em JS;
- colocar yt-dlp no browser;
- converter tudo para WAV no servidor;
- habilitar playlists sem UX específica;
- expor Uvicorn em `0.0.0.0` por padrão;
- gravar cookies no repositório;
- preservar pitch;
- reescrever o app inteiro para framework apenas por causa do backend;
- remover importação local.

---

# 26. Estado de QA desta entrega

Validações executadas na entrega:

- sintaxe de todos os arquivos JS com `node --check`;
- sintaxe de `server/main.py` com `python -m py_compile`;
- inspeção de referências removidas de `providers.js`;
- smoke test visual/HTTP deve ser repetido no ambiente final com as dependências instaladas.

Limitação do ambiente usado para preparar esta entrega: o container não possuía `yt-dlp` instalado e não tinha acesso de rede via `pip`, portanto não foi possível executar uma importação real de uma plataforma externa durante o empacotamento.

Isso não altera a implementação, mas é importante não declarar teste end-to-end remoto como realizado.

Validação adicional feita posteriormente em Windows:

- `start-tempo.bat` foi executado a partir da raiz correta do projeto;
- o launcher iniciou a etapa de criação de `.venv`;
- a máquina não possuía `py/python` utilizável;
- por isso o backend **ainda não chegou a iniciar nessa máquina**;
- o erro confirmou a necessidade de Python instalado e revelou a melhoria de tratamento de erro descrita em **10.2**.

Não interpretar esse teste como falha da integração yt-dlp. O processo parou antes da criação do ambiente Python.

---

# 27. Resumo para o próximo agente

Se você só ler uma parte, leia esta:

```text
VARISPEED = varispeed sem pitch correction.

Arquivo local:
File -> ingest -> decode -> editor

Link:
URL -> /api/media/info -> preview
   -> confirmação
   -> /api/media/audio -> yt-dlp -> Blob
   -> ingest -> decode -> editor

Inicialização Windows:
start-tempo.bat -> .venv -> dependências -> Uvicorn 0.0.0.0:8765 (local via 127.0.0.1; LAN via IPv4 privado)

Pré-requisito: Python instalado/disponível.
O launcher atual aborta corretamente quando Python 3.11+ não está disponível e também recria um `.venv` incompleto.

Não deixe o yt-dlp invadir o motor de áudio.
Não preserve pitch.
Não exponha o backend publicamente sem hardening.
```


## Correção adicional do launcher Windows — `PY_CMD` vazio

### Evidência observada

Em Windows com **Python 3.13.15** confirmado por:

```bat
py -3.13 --version
```

o launcher intermediário exibiu:

```text
[VARISPEED] Procurando Python 3.11+...
[VARISPEED] Criando ambiente Python local com ...
'-m' is not recognized as an internal or external command
```

### Causa raiz

Não era falha do Python. O `.bat` fazia `set "PY_CMD=py -3"` dentro de um bloco `IF (...)` e, ainda dentro do mesmo bloco, executava `%PY_CMD% -m venv .venv`. No `cmd.exe`, referências `%VAR%` em blocos parentizados são expandidas na leitura do bloco, antes de as atribuições internas acontecerem. Assim, `%PY_CMD%` chegava vazio e apenas `-m venv .venv` era enviado ao shell.

### Correção atual

`start-tempo.bat` foi reestruturado para não depender de uma variável de comando mutável dentro do mesmo bloco:

- detecta e valida `py -3` com Python >= 3.11;
- chama diretamente `py -3 -m venv .venv`;
- usa `python -m venv .venv` apenas como fallback validado;
- remove e recria `.venv` caso a pasta exista sem `.venv\Scripts\python.exe`;
- aborta imediatamente se a criação do ambiente falhar;
- mantém a instalação por `server\requirements.txt`;
- não adiciona dependências novas.

### Invariante para futuras alterações

Evitar construir launchers Windows que definam uma variável dentro de `IF (...)` e usem `%VAR%` dentro do mesmo bloco sem `EnableDelayedExpansion`. Para este projeto, prefira o fluxo atual com rótulos/chamadas explícitas, que é mais simples de auditar.


# 28. REV 7 — polimento final / estado de produto

A REV 7 é a última passagem da sequência de responsividade/QA e deve ser tratada como **baseline visual e comportamental final**.

## 28.1 O que foi refinado

- nome de produto visível consolidado como **VARISPEED** em título do navegador, janela do osciloscópio, mensagens e backend;
- `start-tempo.bat` / `start-tempo.sh` continuam com o nome de arquivo legado por compatibilidade, mas seus logs exibem `[VARISPEED]`;
- o protocolo interno `tempo:*`, a chave `tempo.cfg.v1` e `tempo.lastRate` permanecem intencionalmente legados para não quebrar preferências/sessões existentes;
- removida a instrumentação `data-pplx-inline-edit` dos HTMLs de produção;
- tema e densidade persistidos são aplicados antes do primeiro paint, reduzindo flash Dark/Light na inicialização;
- `theme-color` acompanha o tema efetivo escolhido dentro do app;
- controles icon-only receberam nomes acessíveis explícitos;
- o rótulo de Play acompanha dinamicamente `Reproduzir` / `Pausar`;
- Loop e janela externa do osciloscópio acompanham semanticamente o estado atual;
- progresso da importação por link agora expõe `role=progressbar`, valor determinado quando disponível e texto de estado;
- status principal e mensagens da linkbar usam regiões live/atomic sem alterar o layout;
- foco de teclado foi padronizado sem glow e sem deslocamento geométrico;
- scrollbars de inspector/configurações foram harmonizadas ao tema;
- estados `disabled`, `busy`, `active`, `focus` e `hover` foram consolidados;
- erro de importação ganhou indicação estrutural discreta (borda) sem depender só de cor;
- Focus Mode ganhou semântica de diálogo modal e separação visual consistente no rodapé;
- `prefers-contrast: more`, `forced-colors` e `prefers-reduced-motion` receberam fallbacks explícitos;
- gato e fotos dos créditos continuam protegidos contra transforms/offsets específicos por tema.

## 28.2 Compatibilidade de configuração

Variáveis preferidas do backend a partir da REV 7:

```text
VARISPEED_COOKIES_FILE
VARISPEED_MAX_DURATION_SECONDS
```

Por compatibilidade, `server/main.py` ainda aceita:

```text
TEMPO_COOKIES_FILE
TEMPO_MAX_DURATION_SECONDS
```

Não remover os aliases legados sem uma migração explícita.

O preset JSON exportado passa a declarar:

```json
{ "app": "VARISPEED", "version": 1 }
```

O importador continua aceitando presets antigos porque lê o objeto `settings` e não exige o nome da aplicação.

## 28.3 Invariantes finais de UI

1. Dark e Light **não podem alterar geometria** do gato ou do retrato do criador.
2. Não introduzir `translate`, `scale`, mudança de crop ou filtros por tema nesses assets.
3. Desktop largo continua sendo a referência; breakpoints degradam estrutura somente quando necessário.
4. Touch, teclado e mouse devem chegar às mesmas ações sem depender exclusivamente de hover.
5. Foco visível não pode alterar tamanho/borda efetiva do layout.
6. Motion deve respeitar `prefers-reduced-motion`.
7. Alto contraste deve continuar utilizável mesmo que perca detalhes cosméticos.
8. Não reintroduzir scripts de preview/editor no HTML distribuído.

## 28.4 QA final da REV 7

Executado no pacote:

- `node --check` em todos os JavaScript do app;
- `python -m py_compile` no backend;
- verificação de IDs HTML duplicados;
- verificação de remoção completa de `data-pplx-inline-edit`;
- balanceamento estrutural do CSS;
- auditoria de botões icon-only sem nome acessível;
- busca por referências visíveis antigas de `TEMPO` (restam somente aliases de ambiente legados no backend);
- revisão de `server/requirements.txt`: **nenhuma dependência nova**.

Limitação do ambiente de empacotamento: o `yt-dlp` não está instalado no Python global do container, então a importação remota real não foi repetida nesta rodada. A REV 7 não altera o mecanismo yt-dlp/download.

## 28.5 Próximo passo recomendado

A sequência REV 1–7 está encerrada. A partir daqui, novas mudanças devem ser tratadas como **features/correções específicas**, e não como uma nova rodada genérica de responsividade. Antes de alterar UI, comparar contra este baseline e repetir apenas a matriz de QA afetada pelo blast radius.
