# VARISPEED

Editor web de velocidade de áudio que não preserva o pitch. Reduzir a velocidade deixa o som mais grave e aumentar deixa mais agudo, como numa fita ou num toca-discos.

Quase tudo roda no navegador. O backend local (Python + FastAPI) existe para importar áudio por link com `yt-dlp`, servir a interface e responder às rotas de sistema.

O estado técnico completo e o histórico das revisões estão em [docs/HANDOFF.md](docs/HANDOFF.md). As medidas da interface estão em [docs/PADRAO_UI.md](docs/PADRAO_UI.md), a origem dos ícones em [docs/REVISAO_ICONES.md](docs/REVISAO_ICONES.md) e as mudanças recentes no [CHANGELOG.md](CHANGELOG.md).

## Regra central

Não adicionar time-stretch com preservação de pitch.

```text
50%  -> mais lento + mais grave
100% -> original
150% -> mais rápido + mais agudo
```

O player garante isso com:

```js
state.audio.preservesPitch = false;
state.audio.mozPreservesPitch = false;
state.audio.webkitPreservesPitch = false;
```

O `yt-dlp` só obtém a mídia e não participa da mudança de velocidade.

## Recursos

- Importação de arquivo local, por seletor ou arrastando para a janela, e importação por link com prévia de título, autor/canal, duração, thumbnail e origem antes do download.
- Waveform e timeline em Canvas, com zoom, scrub e playhead alinhado ao pixel físico.
- Velocidade em porcentagem aplicada por `playbackRate`, com passos, presets e limites configuráveis.
- Osciloscópio e vectorscope de partículas no cabeçalho, no modo foco e numa janela separada.
- Exportação WAV feita offline no navegador.
- Biblioteca persistente organizada como grafo de categorias.
- Tema claro/escuro, configurações persistentes e presets em JSON.
- Layout para desktop, notebook, tablet e celular, inclusive telas baixas, toque, zoom do navegador e DPR fracionário.
- Launcher para Windows sem terminal visível, com tela de inicialização e logs.
- Acesso por outros dispositivos da rede local, com desligamento permitido só no próprio computador.

## Interface

O editor vazio mostra uma ação de importação no centro. Com áudio carregado, mostra a duração original ao lado da duração de saída e o resumo da exportação. Biblioteca, editor e modo foco usam o mesmo controle de reprodução.

Os botões compartilham os estados de hover, foco, pressão, seleção, indisponível e carregando. Campos de velocidade, presets, links e categorias mostram o erro junto ao controle. Os ícones são uma seleção local do Lucide.

### Cabeçalho

O cabeçalho usa duas fotografias do mesmo gato, uma por tema:

- `assets/cat-brand-light.png`: gato preto, olhos amarelos, fundo branco.
- `assets/cat-brand-dark.png`: gato branco, olhos amarelos, fundo preto.

As duas ficam sobrepostas no mesmo container, com o mesmo `width`, `height`, `object-fit: cover` e `object-position: 50% 90%`. Trocar o tema muda só a opacidade; não há filtro, resize, translate nem recálculo de crop. A faixa inferior gerada nas imagens foi removida no próprio asset, para o gato parecer sair da borda do cabeçalho, e a versão escura recebeu um ajuste para alinhar os olhos com a clara. O mascote é estático, sem bloom, glow ou animação. O favicon (`assets/favicon.png`) é recortado do mesmo gato.

Controles do cabeçalho:

- `Importar` é um único botão com menu: `Arquivo local` abre o seletor nativo e `Link` abre a barra de link.
- O botão da janela separada do osciloscópio fica logo à esquerda do visualizador.
- O tema só muda em Configurações → Interface → Tema.

Não recriar botões separados de importação nem um botão de tema no cabeçalho sem revisar o layout.

### Barra de importação por link

- A linha de consulta tem colunas fixas para `LINK`, URL, `ANALISAR` e fechar, todos com a mesma altura.
- A prévia tem quatro colunas: thumbnail, metadados (título, origem e autor/canal), duração e `IMPORTAR ÁUDIO`.
- A duração tem largura fixa, alinhamento à direita e numerais tabulares, para `3:09` e `12:48` não deslocarem o botão.
- Em caso de sucesso, não aparece a linha `Origem: ...` abaixo da prévia, porque a origem já está no micro-label. Mensagens abaixo da prévia ficam para erros.
- Depois que `ingest()` conclui, o botão muda para `Importado` e fica desabilitado enquanto a mesma URL estiver na prévia. Uma URL diferente libera o botão de novo. Falha de download ou de decodificação não marca a mídia como importada.
- Em telas menores, thumbnail, metadados e duração continuam alinhados e o botão ocupa a largura disponível.

## Arquitetura

```text
ARQUIVO LOCAL ───────────────────────────────┐
                                             │
LINK ─> FastAPI ─┬─ /api/media/info  (yt-dlp, sem download)
                 └─ /api/media/audio (yt-dlp) ─> Blob ─┤
                                                       ▼
                                                ingest(blob)
                                                       │
                                               decodeAudioData()
                                                       │
                              ┌────────────────────────┼──────────────┐
                              ▼                        ▼              ▼
                          waveform              player (playbackRate)  metadados
                                                       │
                                          osciloscópio / vectorscope
                                                       │
                                                 exportação WAV
```

A fronteira é `ingest()` em `app.js`: arquivos locais e áudio vindo do backend chegam ali como `Blob`.

O `yt-dlp` roda no backend porque é uma aplicação Python e precisa lidar com CORS, URLs assinadas, manifests, headers, cookies e formatos que não cabem no sandbox do navegador. Por isso o caminho é `browser -> backend local -> yt-dlp`, e os extractors não devem ser portados para `app.js`.

## Estrutura de arquivos

```text
.
├── index.html              # interface principal
├── styles.css              # design system e layout
├── theme-boot.js           # tema/densidade antes do primeiro paint
├── app.js                  # núcleo da aplicação e fluxo de áudio
├── core.js                 # lógica pura, sem DOM, coberta por testes
├── settings.js             # preferências e configurações
├── motion.js               # microinterações e feedback textual
├── scope-view.js           # osciloscópio + vectorscope de partículas
├── scope-win.js            # comunicação com a janela externa
├── scope.html              # janela dedicada do osciloscópio
├── remote-import.js        # cliente HTTP da integração yt-dlp
├── graph-engine.js         # física, câmera e interação do grafo
├── library.js              # histórico persistente e tela Biblioteca
├── library-model.js        # projeções puras da Biblioteca
├── assets/
│   ├── cat-brand-light.png # gato preto / olhos amarelos / fundo branco
│   ├── cat-brand-dark.png  # gato branco / olhos amarelos / fundo preto
│   ├── creator-light.png   # retrato pessoal local, não publicado
│   ├── creator-dark.png    # retrato pessoal local, não publicado
│   ├── favicon.png         # favicon derivado do mascote
│   ├── varispeed.ico       # ícone multi-resolução do atalho Windows
│   └── icons/              # licença e manifesto do Lucide
├── VARISPEED.vbs           # launcher normal no Windows, sem terminal visível
├── Create VARISPEED shortcut.vbs # cria atalho com ícone do gato no Desktop
├── VARISPEED.desktop       # atalho de menu para Linux (ajustar caminhos)
├── launcher.py             # bootstrap gráfico, somente stdlib Python
├── startup.html / startup.css / startup.js # tela de inicialização
├── logs/                   # startup.log / server.log em runtime
├── start-tempo.bat         # modo diagnóstico/manual no Windows
├── start-tempo.sh          # inicialização manual em Linux/macOS
├── server/
│   ├── main.py             # FastAPI + integração yt-dlp
│   ├── browser_auth.py     # descoberta/validação de perfis instalados
│   ├── dedicated_auth.py   # sessão isolada e filtrada do YouTube
│   ├── youtube_pot.py      # PO Token WPC + runtime EJS local
│   ├── requirements.txt
│   └── requirements-dev.txt # lint e auditoria usados na CI
├── tests/                  # testes node:test e unittest
├── tools/youtube-cookie-exporter/ # extensão opcional para exportar cookies
├── docs/                   # HANDOFF, padrão de UI e revisão de ícones
├── pyproject.toml          # política Ruff do projeto
├── CHANGELOG.md
└── README.md
```

O antigo `providers.js`, com adapters CORS, foi substituído pela importação via `yt-dlp` no backend.

## Requisitos

- Python 3.11 ou mais novo e acesso à internet, para a importação por link e para instalar as dependências de `server/requirements.txt` na primeira execução.
- `ffmpeg` no `PATH` é recomendado. O fluxo prioriza streams M4A/WebM e evita transcodificar, então muitas fontes funcionam sem ele, mas alguns formatos e protocolos do `yt-dlp` dependem dele.
- Node.js 22 ou mais novo, só para vídeos que exigem PO Token (ver [Conteúdo restrito](#conteúdo-restrito)).

## Como executar

### Windows

Use `VARISPEED.vbs` ou o atalho `VARISPEED` da Área de Trabalho. Para criar o atalho, rode uma vez `Create VARISPEED shortcut.vbs`; ele cria `VARISPEED.lnk` com o ícone `assets/varispeed.ico`.

```text
Atalho VARISPEED
  -> VARISPEED.vbs (sem console visível)
  -> launcher.py em 127.0.0.1:8764
  -> tela de inicialização no navegador
  -> /api/health responde em 127.0.0.1:8765
  -> redirecionamento automático para o VARISPEED
```

O `launcher.py` usa só a biblioteca padrão do Python e sobe um `ThreadingHTTPServer` temporário em `127.0.0.1:8764`, para a tela existir antes de `.venv` e das dependências. Ele confere, nesta ordem: Python 3.11+, `.venv`, FastAPI/Uvicorn/yt-dlp, versão do yt-dlp, FFmpeg (opcional), início do Uvicorn e resposta de `/api/health` e `GET /`. Com tudo pronto, `startup.js` mantém `PRONTO` na tela por uns 720 ms, chama `location.replace()` e o servidor temporário se encerra. Não adicionar FastAPI ou Flask ao launcher, porque ele precisaria das dependências que ainda vai instalar.

A tela de inicialização mostra o gato e `VARISPEED 1.0` no mesmo eixo, uma única linha de estado e uma barra indeterminada logo abaixo, sem checklist nem porcentagem. A linha troca de texto com `Motion.status()` e a barra usa a mesma varredura da importação por link. Não há linhas de moldura acima do logo nem abaixo da barra; não reintroduzir `border-top`/`border-bottom` em `.boot__panel`. Em caso de erro, o bloco cresce para mostrar `TENTAR NOVAMENTE` e `VER DETALHES`, sem mudar a geometria do estado normal. A ausência do FFmpeg aparece como aviso.

Se o VARISPEED já estiver rodando em `127.0.0.1:8765`, um segundo clique abre a instância existente. Se outro bootstrap estiver em andamento, o clique reaproveita a tela em `127.0.0.1:8764`.

Os logs ficam em `logs/startup.log` (bootstrap, ambiente, pip e diagnóstico) e `logs/server.log` (saída do Uvicorn/FastAPI).

Para instalar o Python com o Python Install Manager:

```bat
py install 3.13
py -3.13 --version
```

`start-tempo.bat` é o modo de diagnóstico: abre o terminal e deixa o console ligado ao Uvicorn. Use-o para depurar instalação, Python, pip ou backend. Ele detecta `py -3`, cria `.venv` com `py -3 -m venv .venv` e recria uma `.venv` incompleta. O fluxo usa rótulos e `goto` em vez de blocos `IF (...)`, porque o `cmd.exe` expande `%PY_CMD%` antes das atribuições dentro do bloco e o comando ficava vazio.

### Linux e macOS

```bash
chmod +x start-tempo.sh
./start-tempo.sh
```

Depois abra `http://127.0.0.1:8765/`.

Para abrir pelo menu de aplicativos, use `VARISPEED.desktop`. O arquivo aponta para `/caminho/para/VARISPEED`; troque pelo caminho do seu clone antes de instalar:

```bash
sed "s#/caminho/para/VARISPEED#$PWD#g" VARISPEED.desktop > ~/.local/share/applications/VARISPEED.desktop
```

### Execução manual

```bash
python -m venv .venv
.venv/bin/python -m pip install -r server/requirements.txt
.venv/bin/python -m uvicorn server.main:app --host 0.0.0.0 --port 8765
```

No Windows, troque `.venv/bin/python` por `.venv\Scripts\python` e use `server\requirements.txt`.

Abrir `index.html` direto por `file://` mostra a interface, mas sem `/api/media/*` a importação por link não funciona.

## Importação local

O arquivo nunca sai do navegador:

```text
<input type=file> -> load(file) -> ingest(file) -> blob.arrayBuffer() -> AudioContext.decodeAudioData()
```

O frontend aceita WAV, MP3, FLAC, OGG, M4A, AAC, OPUS e WebM. A decodificação depende dos codecs do navegador.

## Importação por link

`Importar → Link` abre a barra. Ao colar um endereço válido, o app busca os metadados sem baixar a mídia. O download só começa ao clicar em Importar áudio, e a tela passa por `Baixando áudio...`, `Decodificando...`, waveform e `Pronto`.

`POST /api/media/info` recebe `{"url": "https://..."}`, chama `ydl.extract_info(url, download=False)` e devolve só o que a interface usa:

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

`POST /api/media/audio` recebe o mesmo corpo e escolhe o formato nesta ordem:

```text
bestaudio[ext=m4a] / bestaudio[ext=webm] / bestaudio / best
```

A ordem prefere M4A, depois WebM, para evitar transcodificar, gastar menos CPU e entregar algo que o navegador consiga transformar em `Blob`. O backend baixa para um diretório temporário, envia com `FileResponse` e apaga o diretório depois da resposta. O navegador passa o resultado pelo mesmo `ingest()` dos arquivos locais.

### Progresso

Quando não há total conhecido (obtendo informações, download antes de o servidor responder, decodificação), a barra é indeterminada. Quando a resposta traz `Content-Length`, o navegador conta os bytes recebidos e mostra a porcentagem. O app não inventa porcentagem de download do `yt-dlp`.

### Plataformas

O que funciona depende dos extractors da versão instalada do `yt-dlp` e das regras de cada site. YouTube e links diretos costumam funcionar; alguns sites exigem cookies ou `ffmpeg`; conteúdo com DRM não é descriptografado; e mudanças num site podem quebrar um extractor até a próxima versão. Use o recurso só com conteúdo que você tem direito de baixar e processar.

## Backend

O arquivo principal é `server/main.py`. O backend não edita áudio: não altera velocidade, pitch, waveform nem WAV.

| Endpoint | Método | Função |
|---|---|---|
| `/api/health` | GET | estado do backend e versão do yt-dlp |
| `/api/system/info` | GET | porta, URL local, URLs da LAN e permissão de desligamento |
| `/api/system/shutdown` | POST | encerra o backend; só via loopback |
| `/api/auth/status` | GET | estado não sensível da autenticação local |
| `/api/auth/browser` | POST | escolhe o modo de autenticação; loopback + origem local |
| `/api/auth/browser/auto` | POST | descobre perfis instalados e valida uma sessão no link pedido |
| `/api/auth/dedicated/start` | POST | abre a janela isolada do YouTube |
| `/api/auth/dedicated/finish` | POST | filtra a sessão do YouTube e apaga o perfil temporário |
| `/api/auth/dedicated/cancel` | POST | fecha a janela temporária sem remover uma sessão válida anterior |
| `/api/auth/dedicated/disconnect` | POST | remove a sessão dedicada guardada localmente |
| `/api/media/info` | POST | metadados sem download |
| `/api/media/audio` | POST | obtém e transmite o áudio |
| `/` | GET | `index.html` |
| arquivos públicos | GET | CSS/JS/scope permitidos por whitelist |

Resposta esperada de `GET http://127.0.0.1:8765/api/health`:

```json
{ "ok": true, "yt_dlp": "...", "ffmpeg": true }
```

### Rede local e segurança

O backend escuta em `0.0.0.0:8765` (a porta muda com `VARISPEED_PORT`), para que outros dispositivos da rede local abram o app. No computador host, use `http://127.0.0.1:8765/`. Configurações → Sistema mostra o IPv4 da rede, como `http://192.168.1.20:8765/`, priorizando o da rota ativa. Com adaptadores virtuais pode haver outras URLs; a principal é a primeira devolvida pelo backend.

No Windows, o Firewall pode pedir permissão para o Python. Libere só em redes privadas. Não encaminhe a porta 8765 no roteador nem exponha o serviço à internet sem autenticação, rate limiting e isolamento.

A rota de desligamento só aceita loopback (`127.0.0.1`/localhost): um celular na rede usa o editor, mas não desliga o host. `Desligar VARISPEED` pede confirmação, dispara `varispeed:shutdown` para pausar o áudio e fechar o AudioContext, chama `POST /api/system/shutdown` e troca a aba para a tela `VARISPEED DESLIGADO`; o processo termina alguns milissegundos depois de responder. Em clientes da rede o botão fica desabilitado. Um novo clique no atalho inicia o backend de novo.

Na importação, `server/main.py`:

- aceita só `http` e `https`;
- bloqueia localhost e IPs locais, privados ou reservados, inclusive depois de resolver o DNS;
- desativa playlists e rejeita lives;
- usa um diretório temporário por download e o apaga depois do envio;
- não publica `server/` como conteúdo estático.

Todas as respostas recebem a mesma política HTTP:

- a API usa `Cache-Control: no-store`, porque pode conter metadados de mídia ou estado de autenticação;
- HTML, JS, CSS e imagens usam `no-cache`, então um F5 sempre pega a revisão atual;
- a CSP limita scripts ao próprio VARISPEED e libera só as fontes, imagens HTTPS, mídia e Workers `blob:` e os estilos inline necessários;
- `X-Frame-Options`, `nosniff`, `Referrer-Policy` e `Permissions-Policy` fecham recursos que o editor não usa.

O bootstrap de tema fica em `theme-boot.js`, fora do HTML, para manter o tema antes do primeiro paint sem afrouxar a política de scripts.

`VARISPEED_MAX_DURATION_SECONDS=7200` limita a duração aceita; `0` ou ausente significa sem limite.

### Conteúdo restrito

Configurações → Importação por link → Conteúdo restrito tem três caminhos. Em todos, o backend tenta primeiro sem autenticação e só repete com ela quando o extractor pede login, confirmação de idade ou cookies. Toda configuração sensível só aceita loopback, e clientes da rede nunca herdam a sessão.

Usar cookies do navegador procura os perfis compatíveis instalados e testa cada um no link pedido. A interface recebe só o navegador e o nome público do perfil validado; caminho, banco e valores de cookies ficam no backend, e nada é gravado em arquivo. Chrome, Edge, Firefox, Brave e Vivaldi também estão disponíveis como opções avançadas via `cookiesfrombrowser`, que exigem o navegador fechado, porque os navegadores Chromium travam o banco de cookies enquanto estão abertos.

Sessão dedicada é o caminho recomendado quando o navegador principal está aberto (o próprio VARISPEED pode estar rodando no Edge). Ela abre uma instância isolada do Edge com perfil temporário e porta DevTools aleatória restrita a `127.0.0.1`. Depois que você entra no YouTube e confirma, o VARISPEED:

1. verifica a autenticação sem receber a senha;
2. navega a mesma página para `youtube.com/robots.txt`;
3. exporta só cookies de domínios de `youtube.com`;
4. fecha a janela e apaga o perfil temporário;
5. guarda só o arquivo Netscape filtrado em `%LOCALAPPDATA%/VARISPEED/youtube-auth`.

Desconectar fecha uma janela pendente e apaga esse arquivo. A interface recebe só `available`, `connected`, `login_open` e o estado de validação (`unverified`, `verified`, `playback_verification_required` ou `invalid`); nomes e valores de cookies nunca passam pela API. Durante a importação, o arquivo é lido para um buffer temporário, para o `yt-dlp` não regravar a cópia guardada, e o modo dedicado é recusado para qualquer host fora de `youtube.com`/`youtu.be`. O indicador só considera a sessão válida se o arquivo tiver cookies de conta legíveis pelo `yt-dlp` e o conteúdo pedido abrir com eles.

Arquivo de cookies manual: `VARISPEED_COOKIES_FILE=/caminho/para/cookies.txt`. Use só cookies de contas que você pode usar e proteja o arquivo. Para gerar esse arquivo sem dar acesso a outros domínios, existe a extensão Chromium `tools/youtube-cookie-exporter`. Ela pede acesso a `youtube.com` só depois de um clique, não usa rede, telemetria nem armazenamento próprio, e não é instalada nem executada automaticamente. Veja o README da pasta e prefira uma conta secundária.

Vídeos que reconhecem a conta mas ainda pedem verificação de reprodução usam o provedor local WPC PO Token. O backend mantém a sessão só no `yt-dlp`, força o cliente `mweb` apenas nessa nova tentativa, abre um Chromium isolado e minimizado para rodar o WebPoClient, gera o token do vídeo, fecha a instância e habilita o Node local e os scripts `yt-dlp-ejs` para os desafios de assinatura. O navegador auxiliar não recebe os cookies. Chrome, Edge, Brave ou Vivaldi servem de runtime; `VARISPEED_CHROMIUM_PATH` e `VARISPEED_NODE_PATH` apontam outro executável. O estado aparece em `/api/health` e `/api/auth/status`, sem caminhos locais.

## Áudio

### Reprodução e pitch

`state.audio` é um `HTMLAudioElement` e a velocidade vem de `playbackRate`. O pitch muda junto. A duração de saída é aproximadamente `sourceDuration / (rate / 100)`; para 4 minutos, 50% dá uns 8 min, 80% uns 5 min, 125% uns 3 min 12 s e 200% uns 2 min.

### Waveform

A waveform vem do `AudioBuffer` decodificado, reduzido a `BUCKETS = 16384` para não desenhar cada sample. Ela é só visual e não altera os samples.

### Visualização

O visualizador usa a reprodução real e aparece integrado, no modo foco e numa janela separada (`scope-view.js`, `scope-win.js`, `scope.html`). Ele não depende do backend e funciona com áudio de qualquer origem.

A mesma primitiva `ScopeView` tem dois modos. O osciloscópio desenha o envelope no tempo, em colunas ou linha contínua. O vectorscope de partículas projeta L/R em Side/Mid, desenha pontos com composição aditiva e mantém parte dos quadros anteriores para formar o rastro.

`app.js` cria um único `MediaElementSource`. O áudio passa pelo analisador principal até a saída e, em paralelo, um `ChannelSplitterNode` alimenta dois analisadores sem duplicar a reprodução. Cabeçalho, modo foco e janela separada recebem o mesmo quadro. O número de pontos cresce com a área do canvas, limitado por `Core.stereoVectorStride()`.

### Exportação WAV

A exportação é offline, no navegador, e sai sempre em WAV, mesmo que a entrada seja M4A, WebM ou MP3. Ela não depende do `yt-dlp`. Não fazer o backend converter tudo para WAV, porque isso aumentaria muito o tráfego, o espaço temporário e o tempo de processamento.

O nome do arquivo é limpo, limitado a 176 caracteres antes de `.wav`, sem ponto ou espaço no final e sem nomes reservados do Windows (`CON`, `NUL`, `COM1` etc.). O nome vindo no `Content-Disposition` do backend também é truncado.

## Biblioteca

Carregar uma faixa no editor e salvá-la na Biblioteca são coisas separadas. Por padrão, importar só carrega o áudio; Adicionar à Biblioteca cria o nó e guarda a mídia. Biblioteca → Adicionar importações automaticamente volta ao fluxo automático.

Dados:

- `library.js` guarda metadados, velocidade, última posição e categoria em `localStorage` (`varispeed.library.v1`), as categorias pessoais em `varispeed.library.categories.v1` e os bytes do áudio no IndexedDB (`varispeed.media.v1`).
- O áudio importado continua disponível depois de F5 ou de reabrir o app. Links antigos sem áudio guardado podem ser baixados de novo pelo backend. Entradas locais sem áudio são removidas na inicialização.
- Remover da Biblioteca a faixa que está no editor não a descarrega; ela pode ser adicionada de novo.

Mapa e lista:

- O grafo mostra só categorias. As músicas ficam numa lista que abre ao selecionar um ponto do mapa.
- `Biblioteca` reúne todas as faixas, `Favoritas` mostra as marcadas e cada categoria pessoal filtra as músicas ligadas a ela. O nó `Biblioteca` usa o papel `root` da engine e só se liga às categorias.
- Cada música tem uma categoria principal. Sem escolha, fica só em `Biblioteca`. Excluir uma categoria pessoal devolve as músicas para `Biblioteca` com áudio, metadados e favorito intactos.
- Categorias são guardadas na ordem de criação e nunca são escondidas ou fundidas automaticamente. Uma categoria vazia continua no mapa para ser renomeada e receber músicas.
- A lista tem busca, ordenação por inclusão, título, última abertura ou duração, navegação por setas e abertura com Enter. Títulos longos são cortados sem invadir duração e velocidade.
- O botão Biblioteca aparece no editor mesmo sem músicas. Entrar na Biblioteca não pausa nem reinicia a reprodução.

Interação:

- Com uma faixa carregada, o cabeçalho da Biblioteca mostra o mesmo transporte do editor (play/pause, parar, repetir, tempo, timeline e duração), sincronizado com o mesmo áudio. Play/Pause, Stop, Loop e o scrub são clonados dos controles oficiais na inicialização; o modo foco faz o mesmo com os passos de velocidade. Os três scrubs usam o mesmo binder de eventos.
- Nenhuma música começa selecionada. Clique, Enter ou Espaço selecionam o nó e abrem o painel lateral. A câmera usa `focusNode()`, aproxima até pelo menos `1.35×` e centraliza no espaço útil, descontando os blocos marcados com `data-graph-viewport-block`. Com o painel aberto, a câmera acompanha a flutuação do nó; clicar de novo no mesmo nó não reconstrói o painel, e fechar o painel volta ao enquadramento geral.
- O painel de detalhes usa a thumbnail guardada das músicas remotas e mostra autor/canal como Crédito. O painel `Fonte` usa a mesma thumbnail como capa e remove o espaço quando não há imagem ou ela falha.
- `Abrir música`/`Voltar à música` usa o mesmo estado ocupado, pulso e varredura de `Exportar WAV`.
- Nomes longos rolam (marquee) só quando passam da largura disponível, no cabeçalho, no detalhe e em `Fonte → Arquivo`. O marquee espera, mostra o final e volta; hover pausa e o movimento reduzido é respeitado.
- Depois de clicar num botão com mouse ou toque, `Espaço` continua sendo Play/Pause. Controles alcançados por `Tab`, campos, sliders, menus e Configurações mantêm o comportamento nativo, e os atalhos globais não capturam teclas desses controles.
- Ícones com o mesmo significado, como Fechar, usam o mesmo símbolo SVG, e um símbolo não é reaproveitado para outra função só por parecer.

Na primeira entrada, `#libraryTutorial` apresenta a Biblioteca em quatro partes: memória local, categorias como pontos do mapa, organização e navegação até o editor. Cada parte reenquadra a mesma rede ilustrativa (um SVG que não toca nos dados reais), mostra rótulos nos nós e uma frase curta; a trilha segmentada mostra o avanço sem passar sozinha. `Explorar biblioteca` termina com uma transição curta que revela o grafo; pular, `Escape`, sair da Biblioteca ou movimento reduzido fecham na hora. Concluir, pular ou `Escape` grava `varispeed.library.tutorial.v1`; sair por outro caminho não grava. A opção `library.alwaysShowGuide` (Configurações → Biblioteca) mostra o guia em toda entrada. O tutorial tem voltar/avançar, setas, foco modal e uma versão sem transições.

### Desempenho do grafo

`graph-engine.js` é uma adaptação de carregamento de `GraphEngine.txt`; o corpo da engine e os parâmetros físicos são os do original. A simulação é contínua, com colisões, `alpha`, amortecimento e flutuação. O perfil segue a intenção do grafo do Obsidian na escala do VARISPEED: repulsão mais presente, coesão central moderada e ligações mais espaçadas.

- Categorias ficam a distância `380` com força `0,52` em volta de `Biblioteca`. As cargas são `420` para Biblioteca e `250` para categorias, e a atração central é ponderada por papel para o mapa não colapsar.
- Cada categoria nasce na distância de repouso da sua ligação e cada música num anel em volta da sua categoria. Uma categoria nova num grafo já formado nasce no maior setor angular livre, desempatando pela folga até músicas e hubs; categorias existentes viram âncoras das músicas novas.
- O enquadramento automático mantém uma escala mínima legível (`minFitZoom: 0.68`); o zoom manual ainda alcança a visão geral.
- `setData()` reaproveita o SVG quando nada mudou. Nós e links novos entram no DOM em fragmentos. Largura de títulos longos fica em cache e o marquee é medido dois frames depois de montar. Raio, carga, atração, fase, distância e força dos links ficam em cache depois da indexação.
- A colisão usa uma grade espacial do tamanho do maior alcance entre dois nós; só células vizinhas geram candidatos, a rejeição por eixo vem antes de `Math.hypot()` e os candidatos voltam à ordem `i/j` original. A fórmula, o espaçamento de `44 px` e o impulso não mudam.
- Roda, câmera, física e pintura usam o mesmo `requestAnimationFrame`, e cada quadro faz no máximo uma transformação visual. O zoom ancorado no ponteiro não mede os insets, e a origem do host vem do `resize()`. O zoom usa uma mola criticamente amortecida de `150 ms`, que chega ao alvo sem passar dele.
- As ligações ficam num Canvas atrás do SVG dos nós, projetadas em coordenadas de tela, agrupadas por aparência e descartadas quando estão fora da tela. Os nós continuam vetoriais: até `1,16×` a câmera usa composição CSS; acima disso o SVG troca para `viewBox`, e só volta abaixo de `1,04×`.
- A física roda a `60 Hz` ativa e `30 Hz` em repouso, independente do monitor; os quadros interpolam o último passo, menos para o nó arrastado. Posições idênticas até 0,01 px não são reescritas.
- Só o `ResizeObserver` interno mede o host; a Biblioteca recebe o resultado por `onResize`, e o reenquadramento pertence à câmera, não à física. A simulação pausa com a Biblioteca oculta, e medições `0 × 0` nesse estado não substituem o último tamanho válido.
- A captura do ponteiro pertence ao SVG estável e mudanças de dados durante um gesto esperam o `pointerup`. Perda de captura, troca de aba, perda de foco da janela ou saída da Biblioteca encerram o gesto. Câmera e foco rejeitam coordenadas não finitas para evitar `translate(NaN NaN)`.
- Soltar uma categoria arrastada reduz o pico de energia sem velocidade mínima, limite rígido nem frenagem radial.

Configurações → Diagnóstico mostra FPS, física, renderização, latência de entrada, intervalo entre quadros, custo da câmera, resposta do zoom, quadros perdidos e long tasks. Medir grafo · 8 s fecha as Configurações para você usar zoom, pan e arraste de verdade e depois reabre o Diagnóstico com FPS, cadência, orçamento por quadro e média/p95/máximo de cada etapa. Copiar relatório gera um bloco para comparar máquinas.

Numa medição sintética, a física por quadro caiu de cerca de `0,61 ms` para `0,45 ms` com 17 músicas e de `4,07 ms` para `2,56 ms` com 50. No teste de limite (200 músicas, 64 categorias, `266` nós e `315` ligações), a grade mandou `1.819` de `35.245` pares para a colisão; `463` passaram pela rejeição por eixo e `385` estavam sobrepostos. Os números variam com a máquina.

## Configurações

`settings.js` controla as preferências e guarda tudo localmente quando possível. O painel mostra uma seção por vez, escolhida num seletor, na ordem do uso:

- Interface: tema, densidade e dicas de teclado.
- Velocidade: unidade, passo, limites, presets e memória da última velocidade.
- Exportação: WAV, normalização, nome e aviso ao sair durante uma exportação.
- Biblioteca e Importação por link (inclusive Conteúdo restrito).
- Timeline: régua, formato, passo de seek e zoom pela roda.
- Visualização de áudio: vectorscope ou osciloscópio, ganho, janela, persistência, partículas e FPS. A cor segue o tema.
- Animações: nível, escala, intensidade, status animado, sustentação da exportação, cursor nos status, microanimação numérica e varredura das operações.
- Ao importar: tocar automaticamente, voltar a 100% e manter o zoom.
- Sistema, Atalhos, Diagnóstico e Sobre o VARISPEED.

Cada preferência tem um botão `?` com explicação. Há status local no rodapé, Restaurar com Desfazer, editor visual de `rate.presets` (gravado como a mesma lista separada por vírgulas), botões para inserir tokens em `export.name` e aviso de que tudo é salvo automaticamente. Desligar fica separado das outras ações de Sistema.

Regras para mexer no módulo:

- manter as chaves internas que ainda têm uso e os valores de velocidade em porcentagem;
- não quebrar presets já gravados; campos removidos são ignorados em presets antigos e podados do armazenamento local sem migração manual;
- tratar mudança de apresentação como UI, não como mudança no motor.

Comportamentos conferidos na auditoria de agosto de 2026 (todas as chaves do schema têm uso no runtime):

- `Lembrar última velocidade` só grava `tempo.lastRate` quando ligado e apaga o valor ao desligar.
- `Manter zoom` guarda só a escala entre músicas, nunca a posição da faixa anterior.
- As setas usam o passo de seek configurado; `Shift + seta` anda sempre 1 segundo.
- `Suavização` mostra a porcentagem real, só afeta o traço em colunas e fica desabilitada no modo Linha.
- `Animações → Desligado` para os efeitos em JavaScript e as transições CSS e desabilita os controles dependentes.
- `Varredura em operações` controla o mesmo efeito em exportar, abrir e adicionar à Biblioteca.
- O diagnóstico mostra se as preferências estão em `localStorage` ou em memória temporária.

Saíram do schema `motion.bloom`, `motion.bloomGain`, `motion.bloomFreq` e `motion.exportName`; presets antigos com essas chaves continuam importáveis. A importação de preset diferencia JSON inválido, preset sem mudanças compatíveis e preset aplicado, com a contagem de ajustes. Presets de velocidade repetidos ou fora dos limites são descartados, até 8 itens.

Atalhos: `Espaço` reproduz/pausa, `←`/`→` andam na posição, `⇧ ←` anda 1 s, `[`/`]` mudam a velocidade um passo, `⇧ ]` cinco passos, `0` volta a 100%, `Ctrl + roda` dá zoom na timeline, `,` abre e `Esc` fecha as Configurações.

### Créditos

A seção Sobre o VARISPEED mostra:

```text
CRIADOR DO VARISPEED
Gaspar
Design e desenvolvimento
[GITHUB · nehalem-x/VARISPEED] · [LOGO YT_DLP]
```

`nehalem-x/VARISPEED` abre o repositório e o logo abre o projeto yt-dlp, os dois numa nova aba sem acesso à página de origem. Os assets são `assets/creator-light.png`, `assets/creator-dark.png` e `assets/yt-dlp-logo.png`.

Os dois retratos ficam só no computador do criador e estão no `.gitignore`. Num clone limpo o crédito aparece só em texto, sem ícone quebrado; com uma só variante, ela vale para os dois temas. Quando existem, as duas têm o mesmo tamanho e o mesmo box CSS, `object-fit` e `object-position`, e o tema muda só a opacidade. A versão escura tem fundo preto e camiseta branca. A clara é o retrato aprovado pelo criador, com fundo branco e camiseta preta, só normalizado para `640 × 640 px`; rosto, óculos, cabelo, expressão e enquadramento não devem ser refeitos por IA nem trocados por versão estilizada sem pedido explícito. A whitelist do backend tem os dois caminhos; renomear os arquivos exige atualizar `server/main.py`.

## Responsividade

O desktop largo é a referência visual. Abaixo dele, os componentes primeiro reduzem densidade, depois se reorganizam e só por último escondem informação secundária. Não alterar o desktop largo para forçar a responsividade.

```text
> 1200 px      desktop largo / referência
901–1199 px    notebook / desktop compacto
641–900 px     tablet / janela estreita
521–640 px     mobile largo
421–520 px     phone
<= 420 px      phone estreito
```

- Painel do editor: em `<=900px` sai da lateral e vira uma faixa com Velocidade, Resultado e Fonte; em `<=640px` empilha. A timeline continua primeiro.
- Barra de link: mantém as colunas no desktop; no tablet o botão de importar ganha linha própria; no celular URL e `Analisar` se reorganizam sem apertar thumbnail e metadados.
- Cabeçalho: em `<=720px` arquivo e osciloscópio vão para uma segunda linha, mantendo o botão da janela separada à esquerda do visualizador.
- Waveform: metadados secundários somem antes de a waveform encolher; o volume some no breakpoint existente.
- Presets de velocidade: grade `3 × 2` no celular.
- Configurações: tela cheia em `<=520px`.
- Créditos: foto à esquerda e texto à direita, menores no celular.
- Altura baixa: em `<=720px` de altura, cabeçalho, régua e transporte ficam mais compactos; em paisagem muito baixa a página rola em vez de esmagar a waveform.

Conteúdo extremo também está coberto: nomes de arquivo, URLs, títulos e extractors longos; durações com horas (`123:45:56`); duração desconhecida como `—` com explicação no `title`; erros com URLs sem espaço (`overflow-wrap: anywhere`); título remoto em até duas linhas no celular estreito; e nenhum overflow horizontal sem quebrar a rolagem vertical. A matriz de teste vai de `1920×1080` a `360×800`, incluindo `844×390` e `667×375` em paisagem.

### Canvas, redimensionamento e DPR

Redimensionar recria os bitmaps, mas não mexe no estado do áudio:

```text
resize/orientação -> recalcular CSS px + DPR -> recriar o bitmap só se mudou
                  -> redesenhar -> zoom / view / currentTime / playing intactos
```

- `ResizeObserver` observa `#wave`, `#ruler` e `#canvasWrap`; `window.resize`, `visualViewport.resize`, `orientationchange` e um watcher `matchMedia('(resolution: …dppx)')` cobrem rotação, barra do navegador móvel e troca de monitor. Os callbacks são agrupados em `requestAnimationFrame`, com uma segunda passada curta depois que o CSS assenta.
- O redraw reposiciona o playhead e redesenha régua e waveform sem chamar `setZoom()`, `seek()`, `play()` ou `pause()`. O osciloscópio pausado guarda o último envelope e o reamostra para a nova largura. Modo foco e janela separada seguem as mesmas regras.
- O DPR dos Canvas fica entre `0.5` e `3` (abaixo de 1 acontece com zoom de 80% ou 90% em monitor DPR 1). O backing store usa `round(cssSize × DPR)` com a razão efetiva `backingSize / cssSize`, sem arredondar o tamanho CSS antes. Mudanças menores que `0.05 CSS px` são ignoradas. O erro máximo de arredondamento é de 0,5 pixel físico.
- O playhead é alinhado à grade física (`round(x × scale) / scale`), o seek converte `clientX` para o espaço lógico da waveform, e retângulos desenhados com `fillRect()` não usam o deslocamento `+0.5`, que só serve para traços de 1 px.
- Canvas usa `image-rendering:auto` (não usar `pixelated`/`crisp-edges` com DPR fracionário), números dinâmicos usam `tabular-nums` e `text-size-adjust:100%` evita que o texto infle sozinho.

### Toque e celular

```text
toque na waveform
  movimento < 8 px                 -> toque/seek
  movimento horizontal dominante   -> scrub
  movimento vertical dominante     -> rolagem nativa
```

- Waveform e régua usam `touch-action: pan-y pinch-zoom`; com mouse, `pointerdown` continua fazendo seek na hora. `pointercancel` e `lostpointercapture` encerram gestos interrompidos, e o slider de posição limpa `state.scrubbing` também em `change` e `blur`.
- Sliders usam `touch-action: none` e área de toque maior com `pointer: coarse`. Itens do menu Importar e botões de fechar (barra de link, Configurações, modo foco) têm 44 × 44 px no toque. Botões e campos usam `touch-action: manipulation` sem destaque de toque.
- No celular, `select` e campos de texto usam 16 px para o iOS não dar zoom ao focar. `@media (hover: none)` desliga hovers que ficariam presos; o estado real usa `:active`, `:focus-visible`, `aria-pressed` e `data-state`. `viewport-fit=cover` com `env(safe-area-inset-*)` protege cabeçalho, Configurações e modo foco em telas com notch.
- As Configurações usam `100dvh` em telas estreitas, rolagem interna contida e bloqueiam a rolagem do fundo. Tocar no texto de um switch também o alterna.

Com teclado virtual, em `<=900px` o painel acompanha `visualViewport.height/offsetTop` (via `--cfg-vvh` e `--cfg-vvtop`) para ficar acima do teclado. Campos focados usam `scrollIntoView({block:'nearest'})`. Nesse tamanho o painel funciona como modal: `Tab` fica preso nele, `aria-modal` acompanha o breakpoint e o foco volta para quem abriu. Fechar e reabrir rápido não deixa um timer antigo esconder o painel.

### Estados e concorrência

- Cada importação recebe um `mediaIntent`, e uma decodificação antiga não sobrescreve uma escolha mais nova. Se já há uma faixa carregada, um arquivo inválido não apaga waveform, fonte nem transporte.
- O estado de reprodução é sincronizado antes de trocar o `src`. Escolher um arquivo local durante um download cancela o download. Fechar a barra de link durante o download ou o `decodeAudioData()` também cancela a mídia. `linkUI.op` descarta respostas atrasadas de operações antigas.
- O botão `Importado` também é protegido na função, então `Enter` no campo não o contorna. `importedUrl` representa a mídia remota carregada agora: carregar um arquivo local libera a URL anterior.
- Escolher de novo o mesmo arquivo local funciona porque o `<input type=file>` é limpo. Arrastar texto ou link não abre o overlay. A análise automática só dispara no `input` vindo de colar e é cancelada se você continuar digitando. A URL aceita até 8192 caracteres.
- Campos de nome e presets têm limite também quando o valor vem de preset JSON ou do `localStorage`. Textos sem espaço quebram com segurança.

### Acessibilidade e acabamento

Tema e densidade são aplicados antes do primeiro paint e `theme-color` segue o tema. Botões só com ícone têm `aria-label`, e Play/Loop atualizam o rótulo. O progresso remoto usa `progressbar`, as mensagens usam live regions, e há suporte a `prefers-contrast`, `forced-colors` e `prefers-reduced-motion`. O modo foco é modal. Nenhuma animação move o gato nem os retratos ao trocar o tema.

## Feedback textual

A animação de confirmação da exportação é o padrão de todo feedback textual. `Motion.status()` a encapsula: revela glifo por glifo no ritmo da exportação, sustenta para leitura e dissolve da esquerda para a direita. Mensagens persistentes entram do mesmo jeito e ficam até o próximo estado, e textos técnicos longos têm a entrada limitada.

Ela é usada em `REPRODUZINDO`, `PAUSADO`, `PARADO` e repetição; importação e decodificação local; análise, download, decodificação, sucesso, cancelamento e erro por link; confirmação de exportação; presets; cópia do endereço da rede e desligamento; e na tela de inicialização.

`motion.status` é a chave principal e `motion.exportHold` define quanto tempo a exportação mostra nome e tamanho. Não usar `Motion.ephemeral()` direto em novos estados; use `Motion.status()` e ajuste `hold`, `persist`, `lead`, `caret` ou `intensity`.

`motion.js` concentra as microinterações, inclusive mudança de etapa, porcentagem e `Pronto` da importação por link, e respeita `prefers-reduced-motion`. O antigo `bloom()` da logo foi removido.

## Nomes e compatibilidade

O produto se chama VARISPEED 1.0. Os scripts continuam `start-tempo.bat` e `start-tempo.sh` para não quebrar atalhos, mas os logs usam `[VARISPEED]`. Alguns identificadores internos antigos ficam de propósito e não devem ser renomeados sem migração: `tempo.cfg.v1`, `tempo.lastRate` e o namespace `tempo:*` do `postMessage` do osciloscópio. As variáveis `TEMPO_COOKIES_FILE` e `TEMPO_MAX_DURATION_SECONDS` ainda funcionam como apelidos de `VARISPEED_COOKIES_FILE` e `VARISPEED_MAX_DURATION_SECONDS`.

## Desenvolvimento

JavaScript:

```bash
for f in app.js core.js graph-engine.js library.js motion.js remote-import.js scope-view.js scope-win.js settings.js startup.js theme-boot.js; do node --check "$f"; done
node --test tests/*.test.js
npx --yes html-validate@10.4.0 index.html startup.html scope.html
```

Python:

```bash
python -m py_compile launcher.py server/main.py server/browser_auth.py server/dedicated_auth.py server/youtube_pot.py
python -m unittest discover -s tests -p "test_*.py"
python -m pip check
python -m ruff check launcher.py server tests
python -m pip_audit -r server/requirements.txt
```

`python3 tests/run-ui-browser.py` testa 18 interações por largura no Firefox, com backend simulado e perfil temporário.

O CI (`.github/workflows/ci.yml`) roda em todo push, pull request e acionamento manual:

- Python 3.11 e 3.13 no Windows, com `server/requirements-dev.txt`, Ruff, compilação, testes e `pip check`; o 3.13 também roda `pip-audit`.
- Node.js 24 no Linux, com verificação de sintaxe, toda a suíte `node:test` e validação dos três HTML.
- Uma checagem que recusa `.env`, cookies, chaves privadas, ambientes, caches, logs, ZIPs e o protótipo `GraphEngine.txt` no repositório.

As actions ficam presas a SHAs completos e o workflow só tem permissão de leitura. O projeto não tem `package.json` nem dependências npm. O Dependabot confere dependências Python e GitHub Actions todo mês, com no máximo três PRs abertos por ecossistema.

### Onde mexer

- Prévia do link: `index.html`, `styles.css` e `app.js`.
- Comunicação frontend/backend: `remote-import.js`.
- Opções do `yt-dlp`: `server/main.py`. Não colocar opções do `yt-dlp` em `app.js`.
- Áudio e reprodução: `app.js`. Não passar isso para o backend.

### Testes manuais

Antes de dar uma mudança por concluída:

- Básico: abrir pelo FastAPI; importar WAV e MP3; arrastar um arquivo; tocar, pausar e parar; scrub; zoom; exportar WAV.
- Pitch: abaixo de 100% o som fica mais grave e acima fica mais agudo.
- Visualização: osciloscópio integrado, modo foco e janela separada.
- Link: o link só existe em `Importar → Link`; os metadados aparecem sem download; Importar áudio mostra download e decodificação e termina com a waveform; Escape ou X cancelam no meio; URL inválida, local ou privada é recusada; link que exige login mostra um erro legível.
- Layout da barra de link: URL, `ANALISAR` e fechar no mesmo eixo; thumbnail, metadados, duração e `IMPORTAR ÁUDIO` alinhados; durações curtas e longas não deslocam o botão; não aparece a linha `Origem: ...` depois do sucesso.
- Cabeçalho: tema só em Configurações → Interface → Tema; botão da janela separada à esquerda do visualizador nos dois temas.
- Escala: Windows 100%, 125% e 150% com zoom do navegador em 80%, 90%, 100%, 110%, 125% e 150%; régua, grade, playhead, barra de link e Configurações sem frestas nem overflow; mudar o zoom durante a reprodução sem perder `currentTime`, velocidade e play/pause; mover a janela entre monitores com escalas diferentes e conferir o redraw; abrir a janela separada num monitor com outro DPR; seek no início, meio e fim com DPR fracionário.

## Invariantes

Manter, salvo pedido explícito:

1. sem preservação ou correção de pitch;
2. arquivos locais não vão para o servidor;
3. o `yt-dlp` só obtém mídia remota;
4. toda mídia entra no motor por `ingest(blob, ...)`;
5. waveform e exportação WAV continuam no navegador;
6. interface minimalista e técnica, com fundo preto sólido no tema escuro;
7. progresso com número só quando o número é real;
8. backend em `0.0.0.0:8765` para a rede local, com ações destrutivas só via loopback.

## Problemas comuns

"Não foi possível acessar o backend do VARISPEED": o HTML foi aberto direto ou o FastAPI não está rodando. Use `start-tempo.bat` ou `start-tempo.sh`.

O `yt-dlp` parou de funcionar num site: atualize com `python -m pip install -U yt-dlp`. Os sites mudam e o extractor precisa acompanhar.

O site exige login: veja [Conteúdo restrito](#conteúdo-restrito).

O áudio baixou mas o navegador não decodifica: a origem mandou um codec ou container que o navegador não suporta.

`ffmpeg: false` no health check: instale o FFmpeg e coloque no `PATH` se a fonte precisar dele.

## Site de apresentação

O site fica no repositório [nehalem-x/VARISPEED-site](https://github.com/nehalem-x/VARISPEED-site):

```powershell
git clone https://github.com/nehalem-x/VARISPEED-site.git
cd VARISPEED-site
npm ci
npm run dev
```

Abra o endereço mostrado pelo servidor de desenvolvimento, normalmente `http://localhost:3000`. O repositório não tem configuração de hospedagem.
