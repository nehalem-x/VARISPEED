# VARISPEED — velocidade de áudio sem preservação de pitch

VARISPEED é uma ferramenta web para reproduzir e exportar áudio em velocidades diferentes **sem correção/preservação de pitch**. Ao reduzir a velocidade, o áudio fica naturalmente mais grave; ao aumentar, fica mais agudo.

A interface continua majoritariamente client-side. A única parte que exige backend é a **importação por link**, agora feita com `yt-dlp`.

## Estado atual

Implementado:

- importação de arquivo local;
- arrastar e soltar áudio;
- waveform/timeline em Canvas;
- reprodução com `playbackRate` sem preservação de pitch;
- controle percentual de velocidade;
- zoom e navegação da timeline;
- osciloscópio em tempo real;
- modo de foco e janela separada do osciloscópio;
- botão da janela separada posicionado imediatamente à esquerda do visualizador do osciloscópio no header;
- exportação WAV offline;
- light/dark mode, alterado exclusivamente em Configurações (sem atalho redundante no header);
- mascote fotográfico do gato no header, com duas variantes cromáticas sincronizadas ao tema e sem mudança de crop/posição;
- configurações persistentes;
- feedback textual padronizado pela animação de exportação em status, importação, startup e sistema;
- menu único `Importar` no header, com `Arquivo local` e `Link`;
- importação remota via `yt-dlp`;
- prévia de link antes do download;
- título, autor/canal, duração, thumbnail e origem/extractor;
- estados de importação: obtenção de informações, download, decodificação e pronto.
- responsividade estrutural para notebook, tablet, mobile e viewports de baixa altura, preservando o desktop largo como baseline visual;
- hardening de edge cases: concorrência de importação, falha não destrutiva, teclado virtual/foco e conteúdo extremo;
- Canvas HiDPI resiliente a resize/orientação/DPR, preservando zoom, posição temporal, playhead e reprodução;
- scaling/zoom endurecido para DPR fracionário (incluindo <1 em zoom abaixo de 100%), com backing store proporcional e playhead alinhado ao pixel físico.
- interação touch/mobile endurecida: scrub horizontal sem conflito com scroll vertical, sliders com gesto próprio, targets maiores, Configurações com scroll contido e estados sem dependência de hover;
- launcher gráfico no Windows: inicia sem terminal visível, mostra etapas reais de bootstrap no navegador, registra logs e redireciona automaticamente para o VARISPEED quando o backend está pronto.

## Regra central do projeto

**Não adicionar time-stretch com preservação de pitch.**

O comportamento desejado é varispeed:

```text
50%  -> mais lento + mais grave
100% -> original
150% -> mais rápido + mais agudo
```

No player, isso é garantido por:

```js
state.audio.preservesPitch = false;
state.audio.mozPreservesPitch = false;
state.audio.webkitPreservesPitch = false;
```

O `yt-dlp` serve somente para obter a mídia. Ele não participa da alteração de velocidade.

---


# Mascote do header

A antiga identidade textual/ícone do header foi substituída por duas fotografias pareadas do mesmo conceito visual de gato, uma específica para cada tema:

- `assets/cat-brand-light.png`: gato de pelagem preta, olhos amarelos e fundo branco;
- `assets/cat-brand-dark.png`: gato de pelagem branca, olhos amarelos e fundo preto.

As duas artes ficam **sobrepostas no mesmo container**, com exatamente o mesmo `width`, `height`, `object-fit` e `object-position`. A troca de tema altera apenas a opacidade da camada correspondente; não há filtro de grayscale/invert, resize, translate ou recálculo de crop.

Antes da integração, a faixa horizontal artificial gerada na parte inferior das duas imagens foi removida no próprio asset. Assim, a borda inferior real do header funciona como a linha visual de onde o gato parece emergir. A versão Dark também recebeu um pequeno registro geométrico para aproximar os centros dos olhos da versão Light e reduzir qualquer sensação de deslocamento na alternância de tema.

O crop visual continua fixo com `object-fit: cover` e `object-position: 50% 90%`. Não existe mais bloom, glow ou animação aplicada ao mascote; ele é uma composição fotográfica estática.

O favicon antigo de waveform também foi substituído por `assets/favicon.png`, recortado do próprio gato, para manter a identidade visual coerente fora do header.

## Controles do header

A toolbar do header foi simplificada para reduzir ações duplicadas e aproximar controles do elemento que comandam:

- `Importar` é um único botão com menu:
  - `Arquivo local` abre o seletor nativo de arquivos;
  - `Link` abre a linkbar do fluxo `yt-dlp`;
- o botão de **janela separada do osciloscópio** fica imediatamente à esquerda do visualizador do osciloscópio;
- o botão rápido de Light/Dark foi removido do header; o tema continua disponível em **Configurações → Interface → Tema**.

Essas decisões são de hierarquia de interface: não recriar botões separados `Importar arquivo`, `Importar por link` ou controles duplicados de tema no header sem uma revisão explícita do layout.

### Alinhamento da importação por link

A linkbar foi refinada para trabalhar com eixos fixos e gutters consistentes:

- a linha de consulta usa colunas dedicadas para `LINK`, URL, `ANALISAR` e fechar;
- `ANALISAR` e fechar usam a mesma altura dos demais controles;
- a prévia usa quatro colunas explícitas: thumbnail, metadados, duração e `IMPORTAR ÁUDIO`;
- a duração possui largura fixa, alinhamento à direita e numerais tabulares, evitando deslocamento visual entre `3:09`, `12:48` ou durações maiores;
- `IMPORTAR ÁUDIO` possui largura fixa e fica no mesmo eixo vertical da duração e da prévia;
- título, origem e autor/canal ficam agrupados em uma única coluna, sem a duração competir por espaço com o texto;
- a mensagem redundante `Origem: ...` abaixo da prévia foi removida nos estados de sucesso, pois a origem já aparece no micro-label da mídia;
- mensagens abaixo da prévia ficam reservadas para erros/estados que realmente precisam de texto;
- após uma importação remota concluir com sucesso, o CTA da prévia muda de `Importar áudio` para `Importado` e permanece desabilitado enquanto aquela mesma URL estiver representada no preview;
- editar/analisar uma URL diferente libera novamente o CTA para o novo resultado; reanalisar a mesma URL já importada mantém o estado `Importado`;
- o estado desabilitado é aplicado somente depois de `ingest()` concluir com sucesso — falha de download/decodificação não marca a mídia como importada;
- em telas menores, a composição degrada de forma previsível: thumbnail/metadados/duração permanecem alinhados e o CTA passa a ocupar a largura disponível.

---

# 1. Arquitetura

```text
                 ARQUIVO LOCAL
                      │
                      ▼
                 File / Blob
                      │
                      ├─────────────────────┐
                      │                     │
LINK REMOTO           │                     │
    │                 │                     │
    ▼                 │                     │
FastAPI               │                     │
    │                 │                     │
    ├─ /api/media/info│                     │
    │      │          │                     │
    │      └─ yt-dlp  │                     │
    │                 │                     │
    └─ /api/media/audio                     │
           │                                │
           └─ yt-dlp -> Blob ───────────────┘
                                            │
                                            ▼
                                     ingest(blob)
                                            │
                                            ▼
                                   decodeAudioData()
                                            │
                          ┌─────────────────┼────────────────┐
                          ▼                 ▼                ▼
                       waveform          player         metadados
                          │                 │
                          │                 ▼
                          │           playbackRate
                          │                 │
                          └──────► osciloscópio
                                            │
                                            ▼
                                      exportação WAV
```

A fronteira importante é `ingest()` em `app.js`: tanto arquivos locais quanto áudio recebido do backend chegam ali como `Blob`.

## Biblioteca visual

Uma faixa carregada no editor e uma faixa salva na Biblioteca são estados independentes. Por padrão, a importação apenas carrega o áudio; **Adicionar à Biblioteca** cria o nó e persiste a mídia. A opção **Biblioteca → Adicionar importações automaticamente** restaura o fluxo automático quando desejado.

Na primeira entrada, `#libraryTutorial` apresenta a ideia da Biblioteca em quatro atos: memória visual, músicas como nós, categorias como territórios e crescimento semelhante a neurônios e conexões. Cada ato reenquadra a mesma rede, revela rótulos semânticos nos nós e acrescenta um sinal conceitual curto; a trilha segmentada mostra o crescimento sem automatizar o ritmo de leitura. A rede exibida é uma ilustração SVG e nunca altera os dados reais. `Explorar biblioteca` encerra o último ato com uma transição curta que revela o grafo por baixo; pular, usar `Escape`, sair da Biblioteca ou ativar movimento reduzido continuam fechando imediatamente. Concluir, pular ou pressionar `Escape` grava `varispeed.library.tutorial.v1`; sair da Biblioteca por outro fluxo antes de concluir não grava a etapa. A preferência `library.alwaysShowGuide`, em Configurações → Biblioteca, ignora essa marca enquanto estiver ativa e reabre o guia em toda entrada. O tutorial oferece voltar/avançar, setas do teclado, foco modal e uma versão sem transições quando movimento reduzido está ativo.

- `graph-engine.js` é uma adaptação de carregamento de `GraphEngine.txt`; o corpo da engine e seus parâmetros físicos permanecem idênticos ao original;
- `library.js` mantém metadados, velocidade, última posição e vínculo organizacional em `localStorage` (`varispeed.library.v1`), categorias personalizadas em `varispeed.library.categories.v1` e os bytes de áudio no IndexedDB (`varispeed.media.v1`);
- o botão **Biblioteca** permanece disponível no editor mesmo quando não há músicas;
- sem músicas e sem categorias o grafo apresenta um estado vazio contextual; categorias personalizadas vazias permanecem visíveis para poderem ser renomeadas e receber músicas;
- o nó `Biblioteca` usa o papel físico `root` já existente na engine e cada música se conecta diretamente a ele;
- `Favoritas` continua sendo uma categoria especial e fixa; categorias pessoais podem ser criadas no cabeçalho da Biblioteca, renomeadas ao selecionar seu nó e escolhidas no painel de cada música;
- cada música possui uma categoria organizacional principal: sem escolha ela orbita `Biblioteca`; ao ser vinculada, passa a orbitar a categoria pessoal. Uma música favorita dentro de uma categoria pessoal mantém uma conexão secundária apenas visual com `Favoritas`: ela não participa do grau, do spawn ou das molas físicas;
- categorias pessoais podem ser excluídas pelo próprio painel. As músicas vinculadas voltam para `Biblioteca`, preservando áudio, metadados e estado de favorita;
- categorias são persistidas por ordem de criação e nunca são ocultadas ou consolidadas automaticamente: o crescimento e a complexidade legível do grafo fazem parte da identidade da Biblioteca;
- ao soltar uma categoria arrastada, a recuperação reduz o pico de energia e devolve progressivamente às músicas sua influência sobre o hub; não existe velocidade mínima injetada, limite rígido nem frenagem radial, portanto a aproximação desacelera de maneira contínua;
- entrar na Biblioteca não pausa nem reinicia a reprodução atual;
- quando há uma faixa carregada, o cabeçalho da Biblioteca reutiliza o padrão visual do transporte do editor — play/pause, parar, repetição, tempo atual, timeline e duração — sempre sincronizado com o mesmo áudio;
- Play/Pause, Stop, Loop e o grupo de scrub da Biblioteca são clonados dos controles oficiais no startup da interface; o modo foco faz o mesmo com os passos de velocidade;
- o painel de detalhes reutiliza a thumbnail já persistida para músicas remotas e apresenta o autor/canal separadamente como Crédito;
- o painel `Fonte` reutiliza essa mesma thumbnail como capa acima dos metadados; quando a mídia não possui imagem ou ela falha ao carregar, o espaço é removido integralmente;

## Desempenho do grafo

A simulação física permanece contínua, com colisões, `alpha`, amortecimento e movimento flutuante ativos. O perfil atual adapta a intenção visual do grafo do Obsidian à escala do VARISPEED: repulsão mais presente, coesão central moderada e ligações mais espaçosas, sem copiar números incompatíveis entre engines.

- músicas usam distância `198` e força `0,44`, acompanhando diretamente a referência semântica do Obsidian;
- categorias preservam seu papel hierárquico com distância `520` e força `0,52`, mantendo os aglomerados separados da Biblioteca;
- cargas internas são `420` para Biblioteca, `250` para categorias e `175` para músicas; a atração central continua ponderada por papel para não colapsar os clusters;
- durante a recuperação de uma categoria, a influência das músicas cresce suavemente de `24%` até `100%` conforme o hub se aproxima de sua distância estrutural;

- a distribuição inicial é dirigida pela topologia: cada categoria nasce na distância de repouso de sua ligação e cada música nasce em um anel ao redor da categoria à qual pertence; anéis adicionais continuam escalonados, sem congelar posições;
- ao criar uma categoria com o grafo já desenvolvido, sua posição inicial usa o maior setor angular disponível e a folga real até músicas e hubs existentes para desempatar. Categorias preservadas viram as âncoras reais de novas músicas, impedindo que expansões incrementais nasçam sobre outro aglomerado;
- o enquadramento automático preserva uma escala mínima legível conforme a rede cresce; o zoom manual ainda alcança a visão geral mais afastada quando desejado;
- `setData()` reutiliza integralmente o SVG quando nós, links e conteúdo não mudaram;
- nós e links novos ainda são montados normalmente, mas entram no DOM em fragmentos para evitar layouts intermediários;
- largura de títulos longos é cacheada e o marquee é medido dois frames depois da montagem;
- raio, carga, atração central, fase flutuante, distância e força dos links são cacheados depois da indexação;
- a colisão usa uma grade espacial dimensionada pelo maior alcance possível entre dois nós; somente células vizinhas produzem candidatos e, dentro delas, a rejeição por eixo continua acontecendo antes de `Math.hypot()`;
- a grade não altera posição, velocidade, força ou ordem: os candidatos são reordenados pelo índice `i/j` original e a fórmula, o espaçamento de `44 px` e o impulso da colisão permanecem integrais;
- eventos de roda/trackpad são acumulados e consumidos pelo mesmo ciclo da câmera; mesmo durante scroll contínuo existe no máximo uma transformação visual por quadro;
- zoom ancorado no ponteiro não calcula os insets do viewport, pois eles são necessários somente no zoom centralizado;
- a origem do host é atualizada em `resize()` e reutilizada pela roda, removendo leituras de layout do caminho normal do zoom;
- a roda aplica `62%` do novo alvo no próprio frame consolidado e, se não houver nova entrada no quadro seguinte, conclui exatamente o movimento. Isso preserva a continuidade de trackpads sem deixar a cauda exponencial de um passo isolado do mouse ativa por centenas de milissegundos;
- conexões vivem em um Canvas próprio atrás do SVG interativo dos nós. As linhas são projetadas diretamente em coordenadas de tela, agrupadas por aparência e rejeitadas quando o segmento inteiro está fora do viewport; tracejados de afinidade, destaque e atenuação continuam visualmente equivalentes, sem o custo de rasterizar linhas SVG longas no zoom próximo;
- nós continuam vetoriais e posicionados por transformações CSS compostas. Até `1,16×`, a câmera usa composição CSS; acima disso, troca o SVG dos nós para `viewBox`, evitando rasterizar uma textura gigante. A volta só ocorre abaixo de `1,04×`, impedindo alternância durante o gesto;
- durante o burst curto da roda, a física continua avançando em todos os frames, mas as escritas de posição ficam consolidadas por até `72 ms`; a escala da câmera concorre apenas com composição e uma posição integral é redesenhada imediatamente ao final. Arraste de nó nunca entra nessa consolidação;
- posições continuam sendo calculadas com precisão total; somente serializações visuais idênticas dentro de 0,01 px são suprimidas;
- apenas o `ResizeObserver` interno do `GraphEngine` mede o host; a Biblioteca recebe o resultado por `onResize`;
- Configurações → Avançado → Diagnóstico mostra FPS, física, renderização e também latência de entrada, intervalo entre quadros, custo da câmera, resposta completa e frames tardios específicos do zoom.
- **Medir grafo · 8 s** fecha temporariamente as Configurações para permitir zoom, pan e arraste reais, sem alterar a Biblioteca. Ao terminar, reabre o Diagnóstico com FPS observado, cadência estimada, orçamento de frame, frames tardios, renders consolidados e média/p95/máximo de frame, física, render e zoom; **Copiar relatório** gera um bloco reproduzível para comparar computadores e sessões.

Na linha de base sintética deste projeto, 17 músicas passaram de aproximadamente `0,61 ms` para `0,45 ms` de física por quadro; com 50 músicas, de `4,07 ms` para `2,56 ms`. Esses números são comparativos e variam conforme o computador.

Uma verificação adicional no teto estrutural usou `200` músicas, `64` categorias pessoais, `Favoritas` e `Biblioteca`: `266` nós e `315` ligações. Na captura de maior densidade, a grade encaminhou `1.819` dos `35.245` pares possíveis para a colisão; `463` passaram pela rejeição por eixo e `385` estavam efetivamente sobrepostos. O navegador integrado limitou tanto o FPS geral quanto o FPS do grafo à mesma faixa de aproximadamente `30/s`, por isso essa limitação do ambiente não foi tratada como custo exclusivo da engine.
- scrubs do editor, Biblioteca e modo foco compartilham o mesmo binder de eventos e a mesma rotina de atualização de posição;
- depois de clicar em um botão com mouse/toque, `Espaço` continua sendo o atalho global de Play/Pause; controles alcançados por `Tab`, campos, sliders, menus e Configurações preservam a semântica nativa do teclado;
- ícones semanticamente idênticos, como Fechar, usam símbolos SVG centrais; um símbolo não deve ser reaproveitado para outra função apenas por semelhança visual;
- músicas começam sem pré-seleção; clique, Enter ou Espaço selecionam o nó e abrem o painel lateral;
- ao selecionar um nó, a câmera usa `focusNode()`, aproxima até pelo menos `1.35×` e centraliza suavemente no viewport útil; blocos visíveis marcados com `data-graph-viewport-block` são descontados pela lateral correspondente. Enquanto o painel permanece aberto, a câmera acompanha a flutuação do nó; fechar o painel restaura o enquadramento geral suavemente;
- `Abrir música`/`Voltar à música` usa o mesmo estado ocupado, pulso e varredura do botão `Exportar WAV`;
- Blobs importados são mantidos no IndexedDB e continuam disponíveis após F5 ou reabertura do app;
- links antigos sem Blob persistido ainda podem ser obtidos novamente pelo backend;
- entradas locais sem áudio correspondente são removidas durante a inicialização, evitando nós indisponíveis;
- remover a faixa ativa da Biblioteca não interrompe o editor: o áudio continua carregado e pode ser adicionado novamente;
- O CSS do grafo usa os mesmos tokens, temas e breakpoints do VARISPEED;
- O reenquadramento após resize pertence à câmera da biblioteca e não modifica a simulação física;
- a captura do ponteiro pertence ao SVG estável, e atualizações de dados recebidas durante um gesto são aplicadas somente depois do `pointerup`/cancelamento; isso impede que uma reconstrução de nós interrompa o arraste;
- perda de captura, mudança de aba, desfoque da janela e saída da Biblioteca encerram qualquer interação pendente de forma segura;
- a simulação é pausada enquanto a Biblioteca está oculta e retomada ao reabrir, sem alterar os parâmetros da física;
- medições `0 × 0` emitidas enquanto a Biblioteca está oculta não substituem o último viewport válido; nós novos aguardam a próxima medição visível antes de receber posição;
- câmera, foco e enquadramento rejeitam coordenadas não finitas e restauram um estado seguro, impedindo que `translate(NaN NaN)` bloqueie pan e arraste;
- nomes de músicas usam marquee horizontal apenas quando ultrapassam a largura disponível: cabeçalho, detalhe da Biblioteca e `Fonte → Arquivo` medem overflow real, enquanto o grafo recorta o título completo em uma janela fixa sob o nó;
- o marquee espera antes de mover, revela o final e retorna ao início; nomes curtos permanecem estáticos, hover pausa o movimento e a preferência de movimento reduzido é respeitada;
- atalhos globais não interceptam teclas usadas em campos, botões, links, sliders ou outros controles interativos.

---

# 2. Estrutura de arquivos

```text
.
├── index.html              # interface principal
├── styles.css              # design system e layout
├── theme-boot.js           # tema/densidade antes do primeiro paint
├── app.js                  # core da aplicação e fluxo de áudio
├── settings.js             # preferências/configurações
├── motion.js               # microinterações e motion system
├── scope-view.js           # osciloscópio + vectorscope de partículas
├── scope-win.js            # comunicação com janela externa
├── scope.html              # janela dedicada do osciloscópio
├── remote-import.js        # cliente HTTP da integração yt-dlp
├── graph-engine.js         # física, câmera e interação do grafo
├── library.js              # histórico persistente e tela Biblioteca
├── assets/
│   ├── cat-brand-light.png # gato preto / olhos amarelos / fundo branco
│   ├── cat-brand-dark.png  # gato branco / olhos amarelos / fundo preto
│   ├── creator-light.png   # retrato pessoal local, não publicado
│   ├── creator-dark.png    # retrato pessoal local, não publicado
│   ├── favicon.png         # favicon derivado do mascote
│   └── varispeed.ico       # ícone multi-resolução do atalho Windows
├── VARISPEED.vbs           # launcher normal no Windows, sem terminal visível
├── Create VARISPEED shortcut.vbs # cria atalho com ícone do gato no Desktop
├── launcher.py             # bootstrap gráfico, somente stdlib Python
├── startup.html            # tela de inicialização real
├── startup.css
├── startup.js
├── logs/                   # startup.log / server.log em runtime
├── start-tempo.bat         # modo diagnóstico/manual no Windows
├── start-tempo.sh          # inicialização manual em Linux/macOS
├── server/
│   ├── __init__.py
│   ├── main.py             # FastAPI + integração yt-dlp
│   ├── browser_auth.py     # descoberta/validação de perfis instalados
│   ├── dedicated_auth.py   # sessão isolada e filtrada do YouTube
│   ├── youtube_pot.py      # PO Token WPC + runtime EJS local
│   ├── requirements.txt
│   └── requirements-dev.txt # lint e auditoria usados na CI
├── pyproject.toml          # política Ruff do projeto
├── README.md
├── HANDOFF.md
└── .gitignore
```

`providers.js` foi removido. A antiga arquitetura de adapters CORS foi substituída pela importação backend via `yt-dlp`.

---

# 3. Requisitos

## Obrigatórios para importação por link

- Python **3.11+**;
- acesso à internet;
- dependências de `server/requirements.txt`.

O `yt-dlp` recomenda versões modernas do Python; a release estável consultada durante esta implementação era a série 2026.x.

## Recomendado

- `ffmpeg` disponível no `PATH`.

O fluxo atual prioriza streams de áudio M4A/WebM e evita transcodificação desnecessária, portanto várias fontes funcionam sem converter nada. Mesmo assim, `ffmpeg` aumenta a compatibilidade do `yt-dlp` com determinados formatos/protocolos.

---

# 4. Como executar

## Windows — uso normal

O ponto de entrada recomendado é **`VARISPEED.vbs`** ou o atalho `VARISPEED` criado na Área de Trabalho. O launcher usa o Windows Script Host para iniciar o bootstrap com a janela do console oculta.

Na primeira vez, execute uma vez:

```text
Create VARISPEED shortcut.vbs
```

Isso cria `VARISPEED.lnk` na Área de Trabalho usando `assets/varispeed.ico`, derivado do favicon do gato. Depois, abra o aplicativo pelo atalho.

Fluxo normal:

```text
Atalho VARISPEED
      ↓
VARISPEED.vbs (sem console visível)
      ↓
launcher.py em 127.0.0.1:8764
      ↓
tela de inicialização no navegador
      ↓
uma única linha de estado: INICIALIZANDO... → VERIFICANDO PYTHON... → ... → PRONTO
      ↓
barra indeterminada de varredura (mesma linguagem da importação por link)
      ↓
/api/health responde em 127.0.0.1:8765
      ↓
redirecionamento automático para o VARISPEED
```

A tela de startup é propositalmente mínima: **não há checklist nem porcentagem**. Só existe uma linha de estado por vez e uma barra indeterminada rápida. A troca de texto usa `Motion.status()`, a assinatura oficial de feedback textual do VARISPEED, derivada diretamente da animação de confirmação de exportação (`Exportado · arquivo · tamanho`). Logs detalhados continuam disponíveis apenas quando ocorre erro e o usuário escolhe `VER DETALHES`.

### Composição visual da tela de inicialização

A tela de startup usa a composição central aprovada do VARISPEED: **gato + `VARISPEED 1.0` no mesmo eixo**, uma única linha de status abaixo e a barra indeterminada imediatamente em seguida. O bloco é compacto e centralizado no viewport.

Não existem linhas decorativas de moldura acima do logotipo nem abaixo da barra de carregamento. A única linha horizontal permanente do estado normal é a própria trilha da barra indeterminada. Não reintroduzir `border-top`/`border-bottom` em `.boot__panel` ou divisores externos equivalentes sem pedido explícito.

O estado de erro pode expandir o mesmo bloco para mostrar ações e detalhes, mas não deve alterar a geometria base do cabeçalho/status durante a inicialização normal.

O launcher exige Python **3.11+**. Com o Python Install Manager, por exemplo:

```bat
py install 3.13
py -3.13 --version
```

Se o VARISPEED já estiver rodando em `127.0.0.1:8765`, um segundo clique **não cria outro backend**; ele abre a instância existente. Se outro bootstrap ainda estiver em andamento, o segundo clique reutiliza a tela de startup já ativa em `127.0.0.1:8764`.

### Logs e erros

O terminal fica oculto, mas a saída não é descartada:

```text
logs/startup.log   # bootstrap, criação de ambiente, pip e diagnóstico
logs/server.log    # stdout/stderr do Uvicorn/FastAPI
```

Se houver falha, a própria tela mostra `TENTAR NOVAMENTE` e `VER DETALHES`. FFmpeg continua sendo opcional: ausência dele é exibida como aviso, não como falha fatal.

## Windows — diagnóstico/manual

`start-tempo.bat` continua no projeto deliberadamente como **modo de diagnóstico**. Ele abre o terminal, exibe as mensagens tradicionais e mantém o console anexado ao Uvicorn:

```bat
start-tempo.bat
```

Use esse modo quando precisar depurar instalação, Python, pip ou backend. Para uso cotidiano, prefira `VARISPEED.vbs`/atalho.

## Linux/macOS

```bash
chmod +x start-tempo.sh
./start-tempo.sh
```

Depois abra:

```text
http://127.0.0.1:8765/
```

## Execução manual

```bash
python -m venv .venv
```

Windows:

```bat
.venv\Scripts\python -m pip install -r server\requirements.txt
.venv\Scripts\python -m uvicorn server.main:app --host 0.0.0.0 --port 8765
```

Linux/macOS:

```bash
.venv/bin/python -m pip install -r server/requirements.txt
.venv/bin/python -m uvicorn server.main:app --host 0.0.0.0 --port 8765
```

Não abra apenas `index.html` via `file://` se quiser usar links. A interface pode aparecer, mas `/api/media/*` não existirá.

---

# 5. Importação local

A importação local permanece totalmente no navegador.

Fluxo:

```text
<input type=file>
      │
      ▼
load(file)
      │
      ▼
ingest(file)
      │
      ▼
blob.arrayBuffer()
      │
      ▼
AudioContext.decodeAudioData()
```

Nenhum arquivo local é enviado ao backend.

Formatos aceitos pela validação do frontend incluem:

- WAV;
- MP3;
- FLAC;
- OGG;
- M4A;
- AAC;
- OPUS;
- WebM.

A decodificação final depende dos codecs suportados pelo navegador.

---

# 6. Importação por link com yt-dlp

## 6.1 Fluxo de interface

O fluxo remoto é aberto por `Importar → Link`. Ao colar um endereço válido, o VARISPEED tenta obter os metadados automaticamente, sem baixar a mídia completa.

```text
colar link
    │
    ▼
Obtendo informações...
    │
    ▼
┌─────────────────────────────────────────┐
│ thumbnail                               │
│ título                                  │
│ autor / canal                           │
│ duração                                 │
│ origem / extractor                      │
│                                         │
│                 Importar áudio          │
└─────────────────────────────────────────┘
```

O download só começa após **Importar áudio**.

Depois:

```text
Baixando áudio...
        ↓
Decodificando...
        ↓
waveform
        ↓
Pronto
```

## 6.2 Metadados sem download

O endpoint:

```text
POST /api/media/info
```

recebe:

```json
{
  "url": "https://..."
}
```

O backend usa conceitualmente:

```python
info = ydl.extract_info(url, download=False)
```

A resposta do VARISPEED contém apenas os campos necessários para a interface:

```json
{
  "id": "...",
  "title": "...",
  "uploader": "...",
  "channel": "...",
  "duration": 222,
  "thumbnail": "https://...",
  "extractor": "Youtube",
  "site": "youtube.com",
  "webpage_url": "https://..."
}
```

## 6.3 Obtenção do áudio

O endpoint:

```text
POST /api/media/audio
```

recebe o mesmo corpo JSON.

A seleção atual é:

```text
bestaudio[ext=m4a] /
bestaudio[ext=webm] /
bestaudio /
best
```

Objetivos dessa ordem:

1. preferir M4A quando disponível;
2. usar WebM como segunda opção;
3. evitar transcodificação quando possível;
4. reduzir CPU e tempo de processamento;
5. entregar ao navegador uma mídia que possa ser convertida em `Blob`.

O navegador então chama o mesmo `ingest()` utilizado para arquivos locais.

---

# 7. Backend

Arquivo principal:

```text
server/main.py
```

Endpoints:

| Endpoint | Método | Função |
|---|---|---|
| `/api/health` | GET | estado do backend e versão do yt-dlp |
| `/api/system/info` | GET | porta, URL local, URLs da LAN e permissão de desligamento |
| `/api/system/shutdown` | POST | encerra o backend; restrito ao próprio computador (loopback) |
| `/api/auth/status` | GET | estado não sensível da autenticação local |
| `/api/auth/browser` | POST | seleciona modo de autenticação; loopback + origem local |
| `/api/auth/browser/auto` | POST | descobre perfis instalados e valida uma sessão no link solicitado |
| `/api/auth/dedicated/start` | POST | abre a janela isolada do YouTube |
| `/api/auth/dedicated/finish` | POST | filtra a sessão do YouTube e apaga o perfil temporário |
| `/api/auth/dedicated/cancel` | POST | fecha a janela temporária sem remover uma sessão válida anterior |
| `/api/auth/dedicated/disconnect` | POST | remove a sessão dedicada armazenada localmente |
| `/api/media/info` | POST | metadados sem download |
| `/api/media/audio` | POST | obtém e transmite o áudio |
| `/` | GET | `index.html` |
| arquivos públicos | GET | CSS/JS/scope permitidos por whitelist |

O backend não é um editor de áudio. Ele não altera velocidade, pitch, waveform ou WAV.

---

# 8. Segurança do backend local

O backend principal escuta por padrão em:

```text
0.0.0.0:8765
```

Isso permite abrir o VARISPEED em **outros dispositivos da mesma rede local**. O navegador do computador host continua usando `http://127.0.0.1:8765/`; em **Configurações → Sistema** o app mostra o IPv4 LAN detectado e a porta, por exemplo `http://192.168.1.20:8765/`.

No Windows, o Firewall pode pedir permissão para o Python aceitar conexões. Para uso doméstico/LAN, libere apenas em **redes privadas**. Não encaminhe a porta 8765 no roteador e não exponha diretamente o serviço à internet sem autenticação, rate limiting e isolamento adicionais.

A rota de desligamento (`POST /api/system/shutdown`) é deliberadamente restrita a requisições vindas de loopback (`127.0.0.1`/localhost), portanto um celular ou outro computador na LAN pode usar o editor, mas não desligar o host.

`server/main.py` também:

- aceita apenas `http` e `https`;
- bloqueia localhost;
- rejeita IPs locais/privados/reservados;
- resolve DNS e rejeita destinos não globais;
- desativa playlists;
- rejeita lives;
- usa diretório temporário por download;
- remove o diretório temporário após enviar o arquivo;
- não publica `server/` como conteúdo estático.

Há suporte opcional a cookies através de:

```text
VARISPEED_COOKIES_FILE=/caminho/para/cookies.txt
```

Use apenas cookies de contas às quais você tem autorização de acesso e proteja esse arquivo.

O fluxo principal não exige mais criar esse arquivo. Em **Configurações →
Importação por link → Conteúdo restrito**, **Usar cookies do navegador**
descobre os perfis compatíveis instalados e testa localmente cada candidato no
link solicitado. Somente o navegador e o nome público do perfil validado chegam
à interface; caminho, banco e valores de cookies permanecem no backend. Nada é
exportado para um arquivo pelo modo automático.

Navegadores Chromium bloqueiam o banco de cookies enquanto estão abertos. Como
o próprio VARISPEED pode estar rodando no Edge, **Sessão dedicada** continua
como fallback recomendado nesse caso. Ela abre uma instância isolada do Edge
com perfil temporário e porta
DevTools aleatória limitada a `127.0.0.1`. Depois que o usuário entra no YouTube
e confirma a conexão, o VARISPEED:

1. verifica a autenticação sem receber senha;
2. navega a mesma página isolada para `youtube.com/robots.txt`;
3. exporta somente cookies cujo domínio pertence a `youtube.com`;
4. fecha a janela e remove o perfil temporário;
5. mantém apenas o arquivo Netscape filtrado em `%LOCALAPPDATA%/VARISPEED/youtube-auth`.

O botão **Desconectar** encerra uma janela pendente e remove esse arquivo. O
frontend recebe somente `available`, `connected`, `login_open` e o estado de
validação (`unverified|verified|playback_verification_required|invalid`); nomes e valores
de cookies nunca passam pela API. Durante uma importação, o arquivo é carregado
em um buffer efêmero para impedir que o yt-dlp amplie ou regrave a cópia
persistente, e o modo dedicado é recusado para qualquer host que não seja
`youtube.com`/`youtu.be`. O fluxo também mantém as opções avançadas de
Chrome, Edge, Firefox, Brave e Vivaldi via `cookiesfrombrowser`, que exigem o
navegador completamente fechado. Em ambos os modos o backend tenta primeiro sem
autenticação e repete somente se o extractor indicar login, confirmação de idade
ou cookies obrigatórios. Toda configuração sensível é restrita ao loopback;
clientes da LAN nunca herdam a sessão.

O indicador não considera mais a mera existência do arquivo como prova de
funcionamento. O arquivo precisa conter cookies de conta legíveis pelo yt-dlp e
a validação final acontece contra o conteúdo solicitado.

Vídeos que reconhecem uma conta adulta, mas ainda exigem verificação de
reprodução, usam automaticamente o provedor local **WPC PO Token**. O backend:

1. conserva a sessão autenticada somente no `yt-dlp`;
2. força o cliente `mweb` apenas nesse retry autenticado;
3. abre uma instância Chromium isolada e minimizada para executar o WebPoClient;
4. gera o token vinculado ao vídeo e fecha a instância ao terminar;
5. habilita o Node local e os scripts `yt-dlp-ejs` para resolver os desafios de assinatura.

O navegador auxiliar não recebe os cookies da conta. Chrome, Edge, Brave ou
Vivaldi pode ser usado como runtime; `VARISPEED_CHROMIUM_PATH` permite indicar
outro executável compatível e `VARISPEED_NODE_PATH` permite indicar o Node.
Esse caminho requer Node.js 22 ou superior. O estado público aparece em
`/api/health` e `/api/auth/status`, sem expor caminhos locais.

Para produzir esse arquivo sem conceder acesso a outros domínios, o repositório
mantém como alternativa avançada a extensão Chromium auditável
`tools/youtube-cookie-exporter`. Ela pede
acesso opcional somente a `youtube.com` após um clique explícito, não usa rede,
telemetria ou armazenamento próprio e gera localmente o formato Netscape. A
extensão não é instalada nem executada automaticamente; consulte o README da
própria pasta e prefira uma conta secundária.

Também existe limite opcional para metadados:

```text
VARISPEED_MAX_DURATION_SECONDS=7200
```

Valor `0`/ausente significa sem limite configurado pelo VARISPEED.

---

# 9. Plataformas e limitações

O suporte remoto depende dos extractors disponíveis na versão instalada do `yt-dlp` e das condições impostas por cada plataforma.

Isso significa que:

- YouTube pode ser processado quando o extractor/ambiente conseguem acessar a mídia;
- links diretos também podem ser tratados pelo extractor genérico;
- alguns sites podem exigir cookies/autenticação;
- alguns conteúdos podem exigir `ffmpeg`;
- conteúdo com DRM não é removido/descriptografado pelo VARISPEED;
- alterações de uma plataforma podem quebrar temporariamente determinado extractor.

Use o recurso apenas com conteúdo que você tem direito/autorização para baixar e processar.

---

# 10. Reprodução e pitch

`state.audio` é um `HTMLAudioElement`.

A velocidade é aplicada por `playbackRate`.

A duração de saída é aproximadamente:

```text
outputDuration = sourceDuration / (rate / 100)
```

Exemplo para 4 minutos:

```text
50%  -> ~8 min
80%  -> ~5 min
100% -> 4 min
125% -> ~3 min 12 s
200% -> ~2 min
```

Pitch varia naturalmente junto com a velocidade.

---

# 11. Waveform

A waveform é gerada a partir do `AudioBuffer` decodificado.

O projeto reduz os dados em buckets para evitar desenhar cada sample bruto em tela.

Constante atual:

```js
const BUCKETS = 16384;
```

A waveform é representação visual; ela não modifica os samples.

---

# 12. Visualização de áudio

O visualizador usa a reprodução real como fonte e possui três apresentações:

- integrado;
- focus mode;
- janela separada.

Arquivos relevantes:

```text
scope-view.js
scope-win.js
scope.html
```

Não vincular sua lógica ao backend de importação. O scope deve continuar funcionando independentemente da origem do áudio.

Existem dois modos na mesma primitiva `ScopeView`:

- **Osciloscópio** — envelope temporal em colunas ou linha contínua;
- **Vectorscope de partículas** — projeta os canais L/R em Side/Mid, desenha pontos com composição aditiva e preserva parcialmente os quadros anteriores para formar o rastro luminoso.

`app.js` cria um único `MediaElementSource`. O áudio segue pelo analisador principal até o destino e, em paralelo, um `ChannelSplitterNode` alimenta dois analisadores sem duplicar reprodução. Header, Focus Mode e popout recebem o mesmo quadro. O orçamento de pontos cresce com a área do canvas, mas é limitado por `Core.stereoVectorStride()`.

---

# 13. Exportação WAV

A exportação é feita offline no navegador.

O arquivo importado pode ser M4A, WebM, MP3 etc., mas a saída do editor continua WAV.

O pipeline de exportação deve continuar independente do `yt-dlp`.

Não faça o backend baixar e converter automaticamente tudo para WAV: isso aumentaria muito tráfego, armazenamento temporário e tempo de processamento.

---

# 14. Configurações

`settings.js` controla preferências do app e utiliza persistência local quando disponível.

Ao alterar este módulo:

- preservar chaves internas existentes quando ainda representam comportamento ativo;
- evitar quebrar presets já gravados;
- manter valores internos de velocidade em porcentagem;
- tratar mudanças de apresentação como UI, não como mudança no motor;
- campos removidos/obsoletos devem ser ignorados em presets antigos e podados da persistência local sem exigir migração manual.

## Organização atual das Configurações

A auditoria pós-REV 7 removeu opções que pertenciam à antiga logo. O refinamento posterior de hierarquia passou a ordenar as preferências pelo fluxo de uso:

- **Interface**: tema, densidade e dicas de teclado;
- **Velocidade**: unidade, passo, limites, presets e memória da última velocidade;
- **Exportação**: formato WAV, normalização, nome e aviso ao sair durante uma exportação;
- **Timeline**: régua, formato, passo de seek e zoom pela roda;
- **Visualização de áudio**: seleção entre vectorscope/osciloscópio, ganho, janela, persistência, partículas e FPS; a cor acompanha o tema;
- **Animações** (antigo título `Motion`): nível, escala, intensidade, animação padrão de status, sustentação da confirmação de exportação, cursor nos status temporários, microanimação numérica e varredura das operações;
- **Ao importar**: autoplay, retorno a 100% e preservação do zoom;
- **Avançado** (recolhível): Sistema, Atalhos e Diagnóstico.

O disclosure `Avançado` é nativo (`details`/`summary`) e permanece fechado por padrão. Créditos continuam no final do painel, fora desse disclosure.

O painel também oferece uma camada de edição assistida sem alterar as chaves persistidas:

- status local no rodapé, visível inclusive quando o drawer cobre a aplicação;
- botão de ajuda `?` em todas as preferências, com descrição contextual controlada pelo mesmo componente acessível;
- restauração com ação temporária `Desfazer`;
- editor visual de `rate.presets`, ainda serializado como a mesma string separada por vírgulas;
- botões para inserir tokens em `export.name` no cursor do campo;
- ajuda contextual nos controles técnicos e limites visíveis nos sliders selecionados;
- indicação permanente de que as alterações são salvas automaticamente;
- ação de desligamento isolada das ações comuns de Sistema.

Foram removidos definitivamente do schema: `motion.bloom`, `motion.bloomGain` e `motion.bloomFreq`. Presets antigos que ainda contenham essas chaves continuam importáveis; os campos desconhecidos são simplesmente ignorados. A persistência local também poda chaves obsoletas ao carregar.

## Auditoria funcional de Configurações — agosto de 2026

Todas as chaves atualmente expostas pelo schema possuem consumidor no runtime. A auditoria também consolidou estas regras:

- `Lembrar última velocidade` só grava `tempo.lastRate` quando está ativo; ao desligar, o valor antigo é removido;
- `Manter zoom` preserva apenas a escala entre músicas, nunca a posição temporal da faixa anterior;
- as setas usam o passo de seek configurado e `Shift + seta` continua sendo o atalho fixo de 1 segundo;
- `Suavização` representa visualmente a porcentagem mostrada, atua apenas no traço por colunas e fica desabilitada no modo Linha;
- `Animações → Desligado` interrompe tanto os efeitos criados por JavaScript quanto transições/animações CSS, e desabilita os controles subordinados;
- `Varredura em operações` governa o mesmo feedback visual em exportar, abrir e adicionar músicas à Biblioteca;
- o diagnóstico identifica corretamente `localStorage` ou `memória temporária`, sem sugerir armazenamento da mídia;
- chaves históricas desconhecidas continuam sendo ignoradas em presets e podadas da persistência.

## Créditos no final do painel

O final da lista de Configurações contém um bloco autoral. Quando os retratos pessoais estão instalados localmente, a fotografia aparece à esquerda e as informações ficam centralizadas verticalmente à direita:

```text
CRIADOR DO VARISPEED
Gaspar
Design e desenvolvimento
[GITHUB · nehalem-x/VARISPEED] · [LOGO YT_DLP]
```

O identificador `nehalem-x/VARISPEED` abre o repositório oficial do projeto no GitHub. O logo isolado continua funcionando como link externo acessível para o projeto yt-dlp. Ambos abrem em uma nova aba sem conceder acesso à página de origem.

Os assets são:

```text
assets/creator-light.png
assets/creator-dark.png
assets/yt-dlp-logo.png
```

Os dois retratos são assets pessoais locais: permanecem no computador do criador, mas estão no `.gitignore` e não são publicados no GitHub. Um clone limpo renderiza automaticamente o crédito em modo somente texto, sem ícone quebrado nem espaço vazio. Se apenas uma variante existir, ela é usada como fallback nos dois temas.

Quando presentes, as duas variantes possuem exatamente o mesmo tamanho e usam o mesmo box CSS. O tema troca apenas a opacidade entre as camadas; não há `scale`, `translate`, `filter` ou `object-position` diferente entre Light e Dark. Isso evita deslocamento perceptível do retrato ao alternar o tema.

- Dark: fotografia integrada ao fundo preto, com camiseta branca.
- Light: usa **o retrato aprovado pelo criador**, com fundo branco e camiseta preta. O arquivo local foi apenas normalizado para `640 × 640 px`, sem regeneração, recorte adicional ou filtro CSS.
- O rosto, os óculos, o cabelo, a expressão e o enquadramento do asset Light não devem ser reinterpretados por IA nem substituídos por uma versão estilizada sem solicitação explícita.
- As duas camadas continuam usando o mesmo box CSS, `object-fit`, `object-position` e geometria de layout para impedir deslocamentos causados pela troca de tema.

O backend local possui whitelist explícita para os dois caminhos opcionais. Se os arquivos forem renomeados, `server/main.py` também precisa ser atualizado.

Esta mudança é somente de UI/branding e **não adiciona dependências** ao projeto.

---


# 14.1 Responsividade estrutural

A interface passou a adotar uma estratégia de **degradação estrutural previsível**. O desktop largo (`>1200px`) continua sendo o baseline visual; abaixo disso, os componentes reduzem densidade e só mudam de estrutura quando realmente falta espaço.

Breakpoints principais:

```text
> 1200 px      desktop largo / baseline
901–1199 px    notebook / desktop compacto
641–900 px     tablet / janela estreita
521–640 px     mobile largo
421–520 px     phone
<= 420 px      phone estreito
```

Comportamento atual:

- **Sidebar/Inspector:** em `<=900px` sai da lateral e vira uma faixa horizontal com `Velocidade`, `Resultado` e `Fonte`; em `<=640px` volta a empilhar verticalmente. A timeline permanece primeiro elemento do fluxo.
- **Linkbar:** preserva as colunas no desktop; em tablet o CTA `Importar áudio` ocupa uma linha própria; em phone o campo de URL e o botão `Analisar` se reorganizam sem comprimir thumbnail/metadados.
- **Header:** gato, ações e área de arquivo reduzem densidade progressivamente; em `<=720px` o arquivo/osciloscópio passa para uma segunda linha, sem retirar o botão de popout do lado esquerdo do visualizador.
- **Waveform/transport:** a timeline continua prioritária. Metadados secundários somem antes de comprimir a waveform; volume é ocultado no breakpoint já existente e o scrub recebe gutters menores em phone.
- **Presets de velocidade:** em mobile passam para uma grade `3 × 2`, evitando botões estreitos demais.
- **Configurações:** tornam-se painel full-width em `<=520px`; campos inline podem empilhar em phones muito estreitos.
- **Créditos:** continuam com foto à esquerda e texto à direita nos tamanhos usuais, reduzindo foto/tipografia em phone sem alterar a geometria Light/Dark dos assets.
- **Baixa altura:** em notebooks com `<=720px` de altura, header/ruler/transport e espaçamentos ficam mais compactos. Em landscape móvel muito baixo, a página prefere rolagem a esmagar a waveform.
- **Touch:** controles pequenos recebem alvo um pouco maior em dispositivos `pointer: coarse`.

Regra de manutenção: **não alterar o desktop largo para “forçar” a responsividade**. Novas mudanças devem primeiro tentar reduzir densidade, depois reorganizar o componente e somente por último ocultar informação secundária.

## REV 2 — refinamento por viewport concluído

A segunda revisão de responsividade foi concluída com foco em conteúdo extremo e compressão real de viewport. Além da estrutura da REV 1, agora existem proteções explícitas para:

- nomes de arquivo muito longos no header;
- URLs extensas;
- títulos, uploader/canal e nome de extractor muito longos;
- duração remota com horas (incluindo valores como `123:45:56`);
- duração desconhecida, exibida de forma compacta como `—` com descrição em `title`;
- mensagens de erro com URLs sem espaços (`overflow-wrap: anywhere`);
- estados de progresso com textos longos sem roubar largura da barra;
- phone estreito, onde o título remoto pode ocupar até duas linhas;
- mobile landscape/viewport baixo, com chrome e linkbar mais compactos e piso menor para a waveform;
- Configurações em landscape estreito, com drawer mais largo antes de virar full-width;
- créditos e hints com quebra segura de texto;
- prevenção de overflow horizontal sem quebrar a rolagem vertical do documento.

Matriz de viewport usada no smoke test de layout:

```text
1920×1080
1600×900
1366×768
1280×720
1024×768
900×600
768×1024
430×932
390×844
360×800
844×390
667×375
```

Também foram simulados conteúdo extremo, estados de progresso/erro, duração com horas e painel de Configurações/Créditos. Nessas verificações não houve overflow horizontal do documento.

## REV 3 — Canvas / resize real concluído

A terceira revisão foi aplicada ao pipeline de renderização, sem redesign visual. O objetivo é separar o **estado temporal** da **geometria física do Canvas**: `state.view`, `state.zoom`, `audio.currentTime` e `state.playing` continuam intactos enquanto os bitmaps são recriados para o novo viewport.

Mudanças principais:

- `app.js` agora mantém `canvasDpr` e só recria os bitmaps de waveform/ruler quando largura, altura ou DPR realmente mudam;
- callbacks de resize são agrupados em `requestAnimationFrame`, evitando várias realocações no mesmo frame durante drag da janela;
- `ResizeObserver` observa diretamente `#wave`, `#ruler` e `#canvasWrap`, cobrindo mudanças em que o pai mantém a mesma altura, mas a régua/waveform redistribuem espaço;
- `window.resize`, `visualViewport.resize` e `orientationchange` complementam o observer para rotação, browser chrome móvel e alterações de DPR/zoom;
- existe uma segunda passada curta de *settle* após resize/orientação para capturar o tamanho final depois que o CSS responsivo estabiliza;
- o redraw reposiciona o playhead e redesenha ruler/waveform, mas **não** chama `setZoom()`, `seek()`, `play()` ou `pause()`;
- `scope-view.js` agora preserva o último envelope do osciloscópio pausado e o reamostra para a nova largura, evitando o traço “sumir” após resize;
- Focus Mode e a janela separada do osciloscópio também agrupam resize em `requestAnimationFrame`;
- a janela independente escuta `visualViewport.resize` e mantém o mesmo frame/estado recebido da sessão principal.

Invariantes da REV 3:

```text
resize/orientação
      ↓
recalcular CSS px + DPR
      ↓
recriar bitmap do canvas apenas se necessário
      ↓
redesenhar estado existente
      ↓
zoom / view / currentTime / playing permanecem intactos
```

QA técnico executado nesta revisão: `node --check` em todos os JavaScript, `py_compile` no backend e verificação estática das rotas de resize/observer. O ambiente de execução usado para empacotamento bloqueia navegação Chromium local (`ERR_BLOCKED_BY_ADMINISTRATOR`), portanto o teste visual automatizado com áudio durante resize deve ser repetido no navegador real do usuário como smoke test final.

## REV 4 — Touch / mobile concluída

A quarta revisão foi aplicada à camada de interação móvel sem alterar o layout-base do desktop. O objetivo é distinguir intenção de **scroll**, **tap** e **scrub** e tornar controles pequenos utilizáveis em telas de toque.

Mudanças principais:

- waveform e régua usam `touch-action: pan-y pinch-zoom`: o scroll vertical/pinch do navegador continua disponível, enquanto o gesto horizontal é reservado ao scrub;
- `app.js` ganhou uma pequena máquina de gesto para waveform/régua: mouse continua imediato; touch/pen usa limiar de 8 px e só assume scrub quando o movimento é predominantemente horizontal;
- taps curtos na waveform/régua continuam fazendo seek; movimentos verticais não causam seek acidental;
- `pointercancel`/`lostpointercapture` são tratados para não deixar gesto preso após scroll, rotação ou interrupção do SO;
- o slider de posição limpa `state.scrubbing` também em `pointercancel`, `lostpointercapture`, `change` e `blur`, evitando estado travado em touch;
- sliders usam `touch-action: none` e hitbox maior em `pointer: coarse`, mantendo o trilho visual fino;
- menu `Importar` recebe itens de 44 px em touch e feedback `:active`;
- botões críticos de fechar (`linkbar`, Configurações e Focus Mode) recebem área física de 44×44 px em touch;
- botões, menu, scope, switches e inputs usam `touch-action: manipulation` e removem tap highlight;
- Configurações usam `100dvh` em telas estreitas, scroll interno com momentum/overscroll contido e bloqueiam o scroll do documento ao fundo enquanto abertas;
- o `label` de cada switch permanece associado ao botão pelo `for`, então tocar no texto também alterna a opção;
- em phone/touch, `select` e campos de texto usam 16 px para impedir o auto-zoom do iOS ao receber foco;
- regras `@media (hover: none)` neutralizam hovers cosméticos que poderiam ficar presos após tap; estados reais continuam em `:active`, `:focus-visible`, `aria-pressed` e `data-state`;
- `viewport-fit=cover` + `env(safe-area-inset-*)` protegem header, Configurações e Focus Mode em telas com notch/home indicator.

Contrato de gesto atual:

```text
touch na waveform
      ↓
movimento < 8 px → tap/seek
      ↓
movimento horizontal dominante → scrub
      ↓
movimento vertical dominante → scroll nativo
```

O desktop com mouse mantém o comportamento anterior: `pointerdown` inicia seek/scrub imediatamente. Nenhuma dependência nova foi adicionada; `server/requirements.txt` permanece inalterado.

## REV 5 — Edge cases de layout/estado concluída

A quinta revisão fecha estados raros de concorrência, falha e foco que não aparecem no fluxo feliz. O objetivo foi tornar cada troca de mídia e cada operação assíncrona **não destrutiva e previsível**, sem redesenhar o desktop.

Mudanças principais:

- **troca de mídia transacional:** cada importação recebe um `mediaIntent`; uma decodificação antiga não pode sobrescrever uma escolha iniciada depois;
- **falha de decode não destrutiva:** se já existe uma faixa carregada, tentar abrir um arquivo inválido mantém waveform, fonte e transporte anteriores intactos;
- ao trocar de faixa enquanto a anterior estava tocando, o estado `playing`/ícone Play é sincronizado antes da troca de `src`, evitando UI presa em “reproduzindo”;
- escolher um arquivo local durante aquisição `yt-dlp` cancela a operação remota anterior;
- fechar/cancelar a linkbar durante download **ou `decodeAudioData()`** invalida também a intenção de mídia, impedindo commit tardio;
- `linkUI.op` protege análise, download, progresso e timers de `Pronto` contra callbacks atrasados de uma operação antiga;
- o botão `Importado` possui guarda também na função, então pressionar `Enter` no campo não contorna o estado `disabled`;
- `importedUrl` representa a mídia remota atualmente carregada, não um histórico: ao carregar arquivo local com sucesso, a URL anterior volta a ser importável;
- selecionar novamente **o mesmo arquivo local** funciona porque o `<input type=file>` é limpo após capturar a seleção;
- drag/drop só reage a `DataTransfer` com arquivos; arrastar texto/link pela página não abre mais o overlay;
- autoanálise após colar URL só dispara para o `input` originado do paste e é cancelada se o usuário continuar digitando;
- URL tem `maxlength=8192`, igual à ordem de grandeza aceita pelo backend;
- nome de exportação é sanitizado, limitado a 176 caracteres antes de `.wav`, remove ponto/espaço final e evita nomes reservados do Windows (`CON`, `NUL`, `COM1` etc.);
- o nome entregue pelo backend no `Content-Disposition` também é truncado defensivamente;
- campos de configuração de nome/presets têm limite, inclusive quando valores entram por preset JSON/localStorage;
- presets de velocidade duplicados/fora dos limites são filtrados e continuam limitados a 8 itens;
- importação de preset agora diferencia JSON inválido, preset sem mudanças compatíveis e preset aplicado com contagem de ajustes;
- rows, hints, atalhos e créditos receberam quebra defensiva para tokens sem espaços;
- estados `disabled`/`aria-busy` ganharam tratamento visual consistente sem depender de hover.

### Configurações + teclado virtual

Em `<=900px`, o painel usa a `visualViewport` real enquanto está aberto:

```text
visualViewport.height / offsetTop
          ↓
--cfg-vvh / --cfg-vvtop
          ↓
painel acompanha a área visível acima do teclado
```

Além disso:

- campos focados usam `scrollIntoView({block:'nearest'})` com `scroll-padding`/`scroll-margin` para não ficar sob teclado/rodapé;
- Tab é contido dentro do painel somente quando ele funciona como tela/modal (`<=900px`);
- `aria-modal` acompanha o breakpoint em tempo real;
- foco retorna ao elemento que abriu o painel;
- o timeout da animação de fechamento é cancelável: fechar e reabrir rapidamente não faz um timer antigo esconder o painel já reaberto.

Nenhuma dependência nova foi adicionada; `server/requirements.txt` permanece inalterado.

## REV 6 — Scaling / zoom / DPR fracionário concluída

A sexta revisão endurece a camada de renderização contra **escala do Windows, zoom do navegador, DPR fracionário e troca de monitor**. O layout continua expresso em CSS px; o objetivo é fazer Canvas e overlays acompanharem a densidade física real sem alterar estado de áudio nem introduzir blur evitável.

Mudanças principais:

- o limite HiDPI dos Canvas passou de `2` para uma faixa defensiva de **`0.5–3`**. DPR abaixo de 1 é intencional: browser zoom de `80%/90%` em monitor DPR 1 pode produzir `devicePixelRatio < 1`;
- waveform/ruler deixaram de arredondar `getBoundingClientRect()` para CSS px inteiros antes de criar o bitmap;
- o backing store usa `round(cssSize × DPR)` e o contexto usa a razão **efetiva** `backingSize / cssSize`, removendo a pequena escala residual causada pelo arredondamento em DPR como `1.25`, `1.5` e `2.25`;
- mudanças inferiores a `0.05 CSS px` são ignoradas para não recriar bitmaps por ruído de layout, mas DPR é comparado com tolerância mais estrita;
- `matchMedia('(resolution: …dppx)')` é rearmado sempre que o DPR muda. Isso cobre casos em que mover a janela entre monitores com escalas diferentes não produz um resize de layout confiável;
- o mesmo watcher de DPR foi aplicado à janela independente do osciloscópio;
- `scope-view.js` usa a medida CSS fracionária real para dimensionar o backing store, mantendo o envelope visual com custo previsível por coluna CSS;
- o playhead DOM é alinhado à grade física do Canvas (`round(x × scale) / scale`) em vez de arredondar sempre para 1 CSS px;
- seek por pointer converte explicitamente `clientX` do retângulo CSS para o espaço lógico da waveform, evitando erro no fim da timeline quando `rect.width` é fracionário;
- ticks/grid desenhados com `fillRect()` não usam mais offset `+0.5` — esse ajuste pertence a strokes de 1 px e deixava retângulos verticais borrados em DPR 1;
- Configurações preservam os valores fracionários de `visualViewport.height/offsetTop`, evitando frestas de 1 px sob zoom/teclado virtual;
- numerais dinâmicos reforçam `tabular-nums`, e Canvas permanece com `image-rendering:auto` (não usar `pixelated`/`crisp-edges` em DPR fracionário);
- `text-size-adjust:100%` impede inflação automática paralela de texto sem bloquear o zoom explícito do navegador.

### Matriz técnica da REV 6

A matemática de backing store foi verificada para CSS widths fracionárias e DPR:

```text
0.80
0.90
1.00
1.10
1.25
1.50
2.00
2.25
3.00
```

com larguras lógicas representativas entre `320` e `1919.2 CSS px`. O erro máximo inevitável de arredondamento do backing store permanece `<= 0.5 device px`.

Smoke test manual recomendado no Windows:

```text
Windows scaling: 100% / 125% / 150%
Browser zoom:     80% / 90% / 100% / 110% / 125% / 150%
```

Em cada combinação, verificar waveform, ruler, playhead, osciloscópio inline/Focus/popout, linkbar, Configurações, presets, sliders e transição entre breakpoints. Mover a janela entre dois monitores com escalas diferentes também deve recriar os bitmaps sem resetar áudio/zoom.

Nenhuma dependência nova foi adicionada; `server/requirements.txt` permanece inalterado.

**Estado:** REV 7 concluída e adotada como baseline. Mudanças posteriores devem ser features/correções específicas, preservando as invariantes das REV 1–7.

## Padrão global de feedback textual

A confirmação de exportação foi escolhida como **referência oficial de motion textual do VARISPEED**. O helper `Motion.status()` encapsula essa assinatura e deve ser usado em qualquer feedback textual temporário ou de etapa:

- `REPRODUZINDO`, `PAUSADO`, `PARADO` e repetição;
- importação/decodificação de arquivo local;
- análise, download, decodificação, sucesso, cancelamento e erro por link;
- confirmação de exportação;
- aplicação/importação de presets;
- cópia do endereço de rede local e desligamento;
- linha única da tela de inicialização.

A linguagem visual é fixa: **revelação por glifo com a cadência da exportação, sustentação legível e dissolução progressiva da esquerda para a direita**. Mensagens persistentes usam a mesma entrada, mas permanecem visíveis até o próximo estado. Textos técnicos muito longos têm a duração de entrada limitada para não levar vários segundos para aparecer.

`motion.status` é a chave mestre. A antiga configuração `motion.exportName` deixou de existir no schema porque a exportação não possui mais uma engine exclusiva; presets antigos com essa chave continuam sendo tolerados e a chave é ignorada/podada. `motion.exportHold` permanece porque a exportação precisa sustentar nome e tamanho do arquivo por mais tempo que eventos curtos.

Não usar `Motion.ephemeral()` diretamente em novos feedbacks de estado. Use `Motion.status()` e altere somente `hold`, `persist`, `lead`, `caret` ou `intensity` quando o contexto exigir.

# 15. Animações (`motion.js`)

`motion.js` centraliza microinterações. O antigo efeito `bloom()` da logo/marca foi removido por completo, pois o header atual usa somente o mascote fotográfico estático.

A importação por URL reutiliza esse sistema para:

- mudança de estágios;
- porcentagem de transferência;
- estado `Pronto`.

A interface respeita `prefers-reduced-motion`.

---

# 16. Tratamento de progresso

Existem dois tipos de progresso no fluxo remoto.

## Indeterminado

Usado quando o frontend não conhece um total real:

```text
Obtendo informações
Baixando áudio enquanto o servidor ainda prepara a resposta
Decodificando
```

## Determinado

Quando `Content-Length` está disponível na resposta do áudio, o navegador mede os bytes realmente recebidos e mostra a porcentagem.

O app não inventa uma porcentagem de download do `yt-dlp`.

---

# 17. Por que não há yt-dlp no navegador

`yt-dlp` é uma aplicação/biblioteca Python e precisa realizar operações que não cabem no sandbox normal do browser.

O navegador também enfrenta limitações como:

- CORS;
- URLs assinadas;
- manifests;
- headers específicos;
- cookies;
- protocolos/formatos de mídia distintos.

Por isso a arquitetura correta é:

```text
browser -> backend local -> yt-dlp
```

em vez de tentar portar os extractors para `app.js`.

---

# 18. Desenvolvimento

## Verificação JavaScript

```bash
node --check app.js
node --check settings.js
node --check motion.js
node --check scope-view.js
node --check scope-win.js
node --check remote-import.js
node --check theme-boot.js
node --test tests/*.test.js
npx --yes html-validate@10.4.0 index.html startup.html scope.html
```

## Verificação Python

```bash
python -m py_compile launcher.py server/main.py server/browser_auth.py server/dedicated_auth.py server/youtube_pot.py
python -m unittest discover -s tests -p "test_*.py"
python -m pip check
python -m ruff check launcher.py server tests
python -m pip_audit -r server/requirements.txt
```

## Integração contínua

`.github/workflows/ci.yml` executa a mesma base de validação em todo `push`,
pull request e acionamento manual:

- Python 3.11 e 3.13 no Windows, com instalação por
  `server/requirements-dev.txt`, Ruff, compilação dos módulos, testes e
  `pip check`; a matriz 3.13 também executa `pip-audit`;
- Node.js 24 no Linux, com verificação sintática dos scripts, toda a suíte
  `node:test` e validação semântica dos três documentos HTML;
- auditoria de higiene que rejeita `.env`, cookies, chaves privadas, ambientes,
  caches, logs, ZIPs e o protótipo local `GraphEngine.txt` caso sejam rastreados.

As actions externas ficam presas a hashes completos e o workflow possui apenas
permissão de leitura do conteúdo. O projeto continua sem `package.json` e sem
dependências npm.

O Dependabot verifica mensalmente dependências Python e GitHub Actions, com teto
de três pull requests abertos por ecossistema para não gerar ruído excessivo.

## Política HTTP local

O backend aplica a mesma camada de proteção a todas as respostas:

- API usa `Cache-Control: no-store`, porque pode conter metadados de mídia ou
  estado de autenticação;
- HTML, JavaScript, CSS e imagens usam `no-cache`, revalidando o conteúdo em
  cada recarga e evitando que uma revisão pareça não ter sido aplicada após F5;
- CSP restringe scripts ao próprio VARISPEED, mantendo apenas os domínios das
  fontes, imagens HTTPS, mídia/Workers `blob:` e estilos inline necessários;
- `X-Frame-Options`, `nosniff`, `Referrer-Policy` e `Permissions-Policy`
  reduzem superfícies que o editor não utiliza.

O bootstrap de tema saiu do HTML inline e vive em `theme-boot.js`, preservando
o tema antes do primeiro paint sem relaxar a política de scripts.

## Health check

Com o backend em execução:

```text
GET http://127.0.0.1:8765/api/health
```

Resposta esperada:

```json
{
  "ok": true,
  "yt_dlp": "...",
  "ffmpeg": true
}
```

---

# 19. Testes manuais recomendados

Antes de considerar uma alteração concluída, testar:

1. abrir o app pelo FastAPI;
2. importar WAV local;
3. importar MP3 local;
4. arrastar arquivo para a janela;
5. alterar velocidade abaixo de 100%;
6. confirmar pitch naturalmente mais grave;
7. alterar velocidade acima de 100%;
8. confirmar pitch naturalmente mais agudo;
9. tocar/pausar/parar;
10. scrub da timeline;
11. zoom;
12. osciloscópio integrado;
13. focus mode;
14. popout;
15. exportação WAV;
16. abrir `Importar → Link` e confirmar que não existe botão separado de link no header;
17. colar link suportado pelo yt-dlp;
18. confirmar metadados sem iniciar download;
19. clicar em Importar áudio;
20. confirmar os estados de download e decodificação;
21. confirmar waveform após a importação;
22. cancelar com Escape/X durante uma requisição;
23. testar URL inválida;
24. testar URL local/privada e confirmar bloqueio;
25. testar link que exige autenticação e confirmar erro legível;
26. alterar Light/Dark em `Configurações → Interface → Tema` e confirmar que não existe controle duplicado no header;
27. confirmar que o botão de popout permanece à esquerda do visualizador do osciloscópio em ambos os temas;
28. abrir `Importar → Link` e verificar que URL, `ANALISAR` e fechar compartilham o mesmo eixo/altura;
29. analisar uma URL e verificar alinhamento horizontal de thumbnail, metadados, duração e `IMPORTAR ÁUDIO`;
30. testar durações curtas e longas e confirmar que a coluna de duração não desloca o CTA;
31. confirmar que, após análise bem-sucedida, não aparece uma segunda linha redundante `Origem: ...` abaixo da prévia;
32. Windows 100% + browser 100%: conferir ruler/grid/playhead;
33. repetir browser em 80%, 90%, 110%, 125% e 150%;
34. repetir pelo menos 100%/125%/150% de scaling do Windows quando disponível;
35. durante playback, mudar zoom do navegador e confirmar que `currentTime`, rate e play/pause não resetam;
36. mover a janela entre monitores com scaling diferente e conferir redraw da waveform/osciloscópio;
37. abrir popout do osciloscópio em monitor com DPR diferente da janela principal;
38. conferir linkbar/Configurações nos mesmos níveis de zoom, sem frestas/overflow horizontal;
39. testar seek no início/meio/fim da waveform sob DPR fracionário e confirmar correspondência temporal.

---

# 20. Pontos de manutenção

## Para alterar a interface da prévia do link

Arquivos:

```text
index.html
styles.css
app.js
```

## Para alterar comunicação frontend/backend

Arquivo:

```text
remote-import.js
```

## Para alterar opções do yt-dlp

Arquivo:

```text
server/main.py
```

Não coloque opções específicas do `yt-dlp` dentro de `app.js`.

## Para alterar áudio/reprodução

Arquivo principal:

```text
app.js
```

Não faça o backend assumir essa responsabilidade.

---

# 21. Invariantes

As seguintes decisões devem ser preservadas salvo solicitação explícita:

1. sem preservação/correção de pitch;
2. importação local não envia arquivos para o servidor;
3. `yt-dlp` é apenas aquisição remota;
4. toda mídia entra no motor por `ingest(blob, ...)`;
5. waveform continua client-side;
6. exportação WAV continua client-side;
7. interface deve permanecer minimalista/técnica;
8. dark mode usa preto sólido como fundo principal;
9. progresso determinado só mostra números reais;
10. backend deve escutar em `0.0.0.0:8765` para acesso LAN, enquanto controles destrutivos continuam restritos ao loopback.

---

# 22. Diagnóstico rápido

## “Não foi possível acessar o backend do VARISPEED”

Provavelmente o HTML foi aberto diretamente ou o FastAPI não está em execução.

Use `start-tempo.bat` / `start-tempo.sh`.

## yt-dlp falha em uma plataforma que funcionava antes

Atualize a dependência:

```bash
python -m pip install -U yt-dlp
```

Mudanças de sites podem exigir uma versão mais nova do extractor.

## O site exige login

Quando apropriado e autorizado, configure um cookies file através de `VARISPEED_COOKIES_FILE`.

## O arquivo foi baixado mas o browser não decodifica

A origem pode ter fornecido codec/container que o navegador não suporta. Uma evolução futura pode adicionar normalização opcional no backend com FFmpeg, sem alterar o princípio de varispeed do editor.

## `ffmpeg: false` no health check

Instale FFmpeg e adicione-o ao `PATH` se a fonte escolhida depender dele.

---

# 23. Referências de implementação

A integração utiliza a API Python oficial do `yt-dlp`, especialmente `YoutubeDL.extract_info(..., download=False)` para metadados e `extract_info(..., download=True)` para aquisição.

O backend usa `FileResponse` do FastAPI/Starlette para transmitir o arquivo temporário ao navegador e removê-lo depois da resposta.

---

## Resumo

VARISPEED agora possui duas rotas de entrada convergentes:

```text
arquivo local ───────────────┐
                             ├─> ingest -> editor
link -> FastAPI -> yt-dlp ───┘
```

Isso resolve a principal limitação da implementação antiga baseada em CORS sem transformar o backend no motor do editor.


### Correção do launcher Windows — expansão de variável no `IF`

Em teste real com **Python 3.13.15** instalado pelo Python Install Manager, foi identificado um segundo problema no launcher anterior. O script detectava corretamente `py -3`, mas armazenava o comando em `PY_CMD` dentro de um bloco `IF (...)` e tentava usar `%PY_CMD%` no mesmo bloco. O `cmd.exe` expande variáveis `%...%` quando analisa o bloco inteiro, antes das atribuições internas; por isso o comando ficava vazio e o Windows acabava tentando executar apenas:

```text
-m venv .venv
```

produzindo:

```text
'-m' is not recognized as an internal or external command
```

O `start-tempo.bat` atual não usa mais esse padrão. O fluxo foi refeito com rótulos e saltos (`goto`) e chama diretamente `py -3 -m venv .venv` quando o launcher `py` está disponível. Se existir uma pasta `.venv` incompleta, ela é removida e recriada. Python **3.11 ou superior** continua sendo aceito, incluindo Python 3.13.

Com Python 3.13 instalado, os comandos esperados são:

```bat
py -3.13 --version
start-tempo.bat
```

O launcher deverá detectar `py -3`, criar `.venv`, instalar as dependências e iniciar o Uvicorn.


---

# REV 7 — acabamento final

A REV 7 fecha a sequência de responsividade e QA do VARISPEED. Ela não altera o motor de áudio nem adiciona dependências; consolida acabamento, semântica e consistência de produto.

Principais pontos:

- branding visível consolidado como **VARISPEED**;
- tema/densidade são restaurados antes do primeiro paint para reduzir flash visual;
- `theme-color` do navegador acompanha o tema efetivo;
- scripts de instrumentação do ambiente de preview foram removidos do HTML de produção;
- foco, hover, active, disabled e busy foram harmonizados entre controles;
- botões apenas com ícone possuem `aria-label` explícito e Play/Loop atualizam o rótulo conforme o estado;
- progresso remoto expõe semântica de `progressbar`;
- mensagens de status usam live regions sem acrescentar popups;
- scrollbars do inspector/configurações seguem o tema;
- suporte adicional a `prefers-contrast`, `forced-colors` e `prefers-reduced-motion`;
- Focus Mode possui semântica modal;
- nenhuma microinteração da REV 7 move o gato ou os retratos entre Dark/Light.

## Nome e compatibilidade

O nome de produto é **VARISPEED 1.0**. Os launchers continuam se chamando `start-tempo.bat` e `start-tempo.sh` para não quebrar atalhos/instruções já existentes, embora os logs agora usem `[VARISPEED]`.

Alguns identificadores internos legados também permanecem intencionalmente:

```text
tempo.cfg.v1
tempo.lastRate
tempo:*            # namespace postMessage do osciloscópio
```

Eles não aparecem como branding e não devem ser renomeados sem migração.

As variáveis de ambiente preferidas agora são:

```text
VARISPEED_COOKIES_FILE
VARISPEED_MAX_DURATION_SECONDS
```

Os aliases antigos `TEMPO_COOKIES_FILE` e `TEMPO_MAX_DURATION_SECONDS` continuam aceitos pelo backend.

## Dependências

A REV 7 não adiciona pacotes. `server/requirements.txt` permanece:

```text
fastapi>=0.120,<1
uvicorn[standard]>=0.30,<1
yt-dlp>=2026.7.4
```

## Estado da sequência de revisão

```text
REV 1 — estrutura responsiva             ✅
REV 2 — viewports / conteúdo extremo     ✅
REV 3 — Canvas / resize real             ✅
REV 4 — touch / mobile                   ✅
REV 5 — edge cases de layout/estado      ✅
REV 6 — scaling / zoom / DPR             ✅
REV 7 — polimento final / QA global      ✅
```

Novas alterações devem partir deste estado como baseline.


# Atualização pós-REV 7 — Configurações e mascote

Esta atualização faz uma limpeza semântica/técnica após a estabilização da REV 7:

- removido todo o bloom legado do schema, runtime e CSS;
- removida a função `Motion.bloom()` e suas custom properties;
- `.hdr__brand` foi renomeada para `.hdr__mascot`; o app não trata mais o gato como uma logo animável;
- `Motion` passou a aparecer na UI como **Animações**, mantendo as chaves internas `motion.*` para compatibilidade;
- rótulos foram corrigidos para refletir o comportamento real (`Status animado` e `Microanimação numérica`);
- `Avisar ao sair durante exportação` foi movido visualmente para **Exportação**;
- `Lembrar última velocidade` foi movido visualmente para **Velocidade**;
- o favicon de waveform foi substituído por um favicon derivado do gato;
- presets antigos e `tempo.cfg.v1` continuam compatíveis; campos obsoletos são ignorados/podados.

Nenhuma dependência foi adicionada ou removida.


---

# 21. Launcher gráfico do Windows

O launcher gráfico foi adicionado como camada separada do FastAPI para que a interface de inicialização exista **antes** de `.venv` e dependências estarem prontas. `launcher.py` usa somente a biblioteca padrão do Python e sobe temporariamente um `ThreadingHTTPServer` em `127.0.0.1:8764`.

Etapas monitoradas:

1. Python 3.11+;
2. criação/validação de `.venv`;
3. FastAPI/Uvicorn/yt-dlp;
4. versão do yt-dlp;
5. presença opcional do FFmpeg;
6. inicialização do Uvicorn;
7. `/api/health` e `GET /` da interface.

O backend principal escuta em `0.0.0.0:8765`, mas o launcher testa e abre a instância local via `127.0.0.1:8765`. Quando fica pronto, `startup.js` mantém `PRONTO` visível por cerca de 720 ms e então usa `location.replace()` para entrar na aplicação. Após a transição, o servidor temporário de startup se aposenta automaticamente.

A página de startup carrega o `motion.js` existente apenas para a **troca tipográfica da linha de estado** via `Motion.status()`. Ela não usa motion estrutural para abrir/fechar painéis. A barra é indeterminada e reutiliza a mesma varredura visual do progresso de importação por link.

**Não adicionar FastAPI/Flask ao launcher de bootstrap.** Isso criaria o paradoxo de precisar instalar dependências antes de conseguir mostrar o progresso da instalação.


# 23. Rede local e desligamento pelo app

Em **Configurações → Sistema** são consultados dados de runtime por `/api/system/info`:

```text
Servidor     Ativo
Rede local   http://192.168.x.x:8765/
Porta        8765

[ Copiar endereço ]
[ Desligar VARISPEED ]
```

`Rede local` prioriza o IPv4 da rota ativa do computador e depois considera outros IPv4 privados detectados. Se houver adaptadores virtuais, outras URLs podem existir; o valor principal é o primeiro endereço retornado pelo backend.

### Layout do grupo Sistema

As ações ficam **empilhadas em uma faixa própria**, ocupando toda a largura útil do drawer. Elas não usam `btn--ghost`, porque esse modificador é voltado a botões compactos/ícones e pode conflitar com botões de texto dentro do painel estreito. `Copiar endereço` e `Desligar VARISPEED` usam `.cfg__system-action`, com altura fixa, texto em uma linha e sem sobreposição.

Os valores de `Servidor`, `Rede local` e `Porta` permanecem alinhados à direita; a URL é truncada com reticências apenas quando realmente não cabe.

`Desligar VARISPEED`:

1. pede confirmação;
2. dispara `varispeed:shutdown` para pausar o áudio/fechar o AudioContext;
3. envia `POST /api/system/shutdown`;
4. o backend responde e encerra o próprio processo alguns milissegundos depois;
5. a aba atual troca para uma tela local `VARISPEED DESLIGADO`.

O botão só é habilitado quando a interface foi aberta pelo próprio computador via loopback. Em clientes LAN ele fica indisponível. Um novo clique no atalho VARISPEED inicia o backend novamente.
