# Manutenção do VARISPEED

Este documento descreve como o VARISPEED funciona por dentro, as regras que não podem quebrar e como validar uma mudança. O [README](../README.md) cobre o uso e a instalação; o [CHANGELOG](../CHANGELOG.md) registra o que mudou em cada versão.

## Resumo

```text
VARISPEED = varispeed sem correção de pitch.

Arquivo local:  File -> ingest -> decode -> editor
Link:           URL -> /api/media/info -> prévia -> confirmação
                    -> /api/media/audio -> yt-dlp -> Blob -> ingest -> decode -> editor
Windows:        VARISPEED.vbs -> launcher.py -> .venv -> dependências
                    -> Uvicorn em 0.0.0.0:8765 (local via 127.0.0.1, rede via IPv4 privado)
```

O `yt-dlp` não entra no motor de áudio, o pitch nunca é preservado e o backend não deve ser exposto à internet sem as proteções da seção 5.5.

```text
Frontend: HTML + CSS + JavaScript puro, sem framework, bundler ou npm
Backend:  Python + FastAPI + yt-dlp
Áudio:    Web Audio API / HTMLAudioElement
Export:   WAV gerado no navegador
```

Sem Python e backend, a interface ainda abre, mas a importação por link não funciona. Requisitos: Python 3.11 ou mais novo, internet na primeira execução e para o `yt-dlp`, FFmpeg recomendado no `PATH` e Node.js 22 ou mais novo para vídeos do YouTube que exigem PO Token.

## 1. Regras do produto

### 1.1 Sem correção de pitch

É a decisão mais importante do projeto. Abaixo de 100% o áudio fica mais grave e acima fica mais agudo. Não adicionar phase vocoder, Rubber Band, SoundTouch com preservação de pitch, `preservesPitch = true`, time-stretch compensado nem qualquer DSP que mantenha a tonalidade. O player define:

```js
state.audio.preservesPitch = false;
state.audio.mozPreservesPitch = false;
state.audio.webkitPreservesPitch = false;
```

### 1.2 O backend não é motor de áudio

O `yt-dlp` só resolve e obtém mídia remota. Velocidade, waveform, osciloscópio, scrub, exportação WAV e o processamento de arquivos locais ficam no navegador.

### 1.3 Arquivo local não sai do navegador

`load(file)` chama `ingest(file)`. Nada é enviado ao FastAPI.

### 1.4 Entrada única do motor

Toda mídia passa por `ingest(blob, srcName, srcSize)`. Isso deixa a importação local e a remota equivalentes depois que os bytes chegam ao navegador.

### 1.5 Interface

1. Claro e escuro nunca mudam a geometria do gato nem do retrato do criador: nada de `translate`, `scale`, crop ou filtro por tema.
2. O desktop largo é a referência; os breakpoints só mudam a estrutura quando falta espaço.
3. Toque, teclado e mouse chegam às mesmas ações, sem depender só de hover.
4. O foco visível não muda tamanho nem borda efetiva do layout.
5. Animações respeitam `prefers-reduced-motion`.
6. Alto contraste continua usável, mesmo perdendo detalhes cosméticos.
7. O HTML distribuído não leva scripts nem atributos de ferramentas de preview ou edição.

## 2. Arquivos e responsabilidades

A árvore completa está no README. Aqui fica o papel de cada parte.

### 2.1 `launcher.py`, `startup.*` e `VARISPEED.vbs`

Bootstrap do Windows, sem dependências externas. Prepara o runtime e o backend, mostra o progresso real e redireciona para o app. Não mistura motor de áudio nem lógica do `yt-dlp`. `startup.js` pode mostrar estados, mas não inventa porcentagem de `pip` ou de download. Detalhes na seção 3.

### 2.2 `core.js`

Lógica pura, sem DOM, sem `window` e sem estado. Reúne o que antes ficava solto em `app.js`:

- formatação: `fmtTime`, `fmtClock`, `fmtBytes`, `niceStep`;
- velocidade: `rateText`, `rateSuffix`, `rateUnitLabel`, `parseRate`, `presetLabel`, `parsePresets`, `rateMarks`, `markOffset`;
- nome de arquivo: `stripExt`, `scrub`, `sanitizeStem`, `outNameTokens`, `outName`, `outSampleRate`;
- geometria: `dprClamp`, `sizeChanged`, `dprChanged`, `backingSize`, `canvasScale`, `snapToDevice`, `pointerToLogical`;
- janela visível: `viewDuration`, `srcToX`, `xToSrc`, `clampView`;
- vectorscope: `stereoVectorPoint`, `stereoVectorStride`.

Regras:

1. Sem dependência nova e sem ESM. Segue o padrão global de `motion.js` e `settings.js` (`globalThis.VarispeedCore`) com `module.exports` opcional para os testes, e `index.html` continua abrindo por `file://`.
2. Toda dependência entra por parâmetro. `cfg()`, `state` e `W` ficam em `app.js`.
3. `app.js` só delega: as funções correspondentes são invólucros de uma linha que injetam configuração e estado. A regra não é escrita duas vezes.
4. `core.js` vem antes de `app.js` em `index.html` e está em `PUBLIC_FILES` (`server/main.py`). Sem isso o backend devolve 404 e `app.js` para com um erro explícito.
5. Alguns comportamentos antigos foram mantidos de propósito, com comentário e teste. Não "corrigir" sem decisão:
   - `parsePresets` usa vírgula como separador, então `1,5` são dois valores (`1` e `5`);
   - `presetLabel` em multiplicador remove só um zero final (`1.00` vira `1.0`, `1.25` fica `1.25`);
   - `sanitizeStem` limpa duas vezes, e é a segunda passada que transforma `"..."` em `audio`;
   - `fmtBytes` devolve `—` para tamanho ausente.

A única mudança deliberada em relação ao código antigo: `fmtClock` filtra `Infinity` (antes gerava `"Infinity:NaN:NaN"`). Nenhum valor finito mudou.

### 2.3 `app.js`

Núcleo do frontend: estado de áudio, `load()`, `ingest()`, `decodeAudioData()`, reprodução, velocidade, waveform, zoom, transporte, exportação WAV, estados visuais, menu de importação (`importMenuOpen()`) e a orquestração da importação por link. A parte de link controla só a interface e o fluxo e chama `window.RemoteImport`. É o arquivo de maior risco (seção 17).

### 2.4 `remote-import.js`

Transporte da importação remota: valida a URL no navegador, chama `POST /api/media/info` e `POST /api/media/audio`, lê os erros JSON, recebe o binário em partes, calcula o progresso real quando há `Content-Length` e extrai o nome de `Content-Disposition`. Opções do `yt-dlp` não entram aqui.

### 2.5 `server/main.py`

Backend local: valida a URL, bloqueia destinos locais e privados, extrai metadados sem baixar, baixa uma faixa de áudio, serve e apaga o arquivo temporário e publica só os arquivos do frontend que estão na whitelist. Os módulos `browser_auth.py`, `dedicated_auth.py` e `youtube_pot.py` cuidam da autenticação (seção 6).

### 2.6 `settings.js`

Configurações e persistência (seção 8). Parâmetros do backend ficam em variáveis de ambiente ou na configuração do backend, não aqui.

### 2.7 `motion.js`

Microinterações e o feedback textual padrão (seção 9).

### 2.8 `scope-view.js`, `scope-win.js` e `scope.html`

Osciloscópio, vectorscope e janela separada. Não dependem da origem do áudio (seção 13).

### 2.9 `library.js`, `library-model.js` e `graph-engine.js`

Biblioteca persistente, projeções puras dos dados e a engine de física e câmera do grafo (seção 14).

### 2.10 `index.html` e `styles.css`

`index.html` tem a interface principal; não colocar lógica de negócio em scripts inline. `styles.css` é o design system: fundo preto sólido no tema escuro, bordas mínimas, cantos retos (`--radius: 0`), nada de visual de dashboard, tipografia mono para valores técnicos e espaçamento por tokens. As media queries da responsividade ficam no fim do arquivo, como última camada.

### 2.11 `tests/`

Não vai para o app nem para `PUBLIC_FILES`. Usa `node:test` no JavaScript e `unittest` no Python, sem framework externo (seção 16).

### 2.12 `.github/`

`workflows/ci.yml` roda três jobs em push, pull request e acionamento manual:

- Python 3.11 e 3.13 no Windows: instala `requirements-dev.txt` com cache, roda Ruff, compila os módulos, executa `unittest` e `pip check`; o 3.13 também roda `pip-audit`.
- JavaScript no Node.js 24/Linux: confere a sintaxe dos scripts, roda `tests/*.test.js` e valida `index.html`, `startup.html` e `scope.html` com html-validate.
- Repository hygiene: falha se segredos comuns, cookies, chaves, ambientes, caches, logs, ZIPs ou `GraphEngine.txt` estiverem no repositório.

As actions ficam presas ao SHA completo, o workflow só declara `contents: read` e cancela execuções antigas do mesmo branch. Não adicionar permissão de escrita sem necessidade. `dependabot.yml` abre no máximo três atualizações por mês para `pip` e GitHub Actions. O html-validate roda por versão fixa via `npx`, sem dependência npm guardada.

## 3. Inicialização

### 3.1 Launcher do Windows

O ponto de entrada é `VARISPEED.vbs` ou o atalho criado por `Create VARISPEED shortcut.vbs`. O atalho chama `wscript.exe` com `VARISPEED.vbs` e usa `assets/varispeed.ico`; `WshShell.Run(..., 0, False)` mantém o console oculto.

```text
VARISPEED.lnk
  -> wscript.exe -> VARISPEED.vbs
  -> py -3 launcher.py (janela oculta)
  -> ThreadingHTTPServer (stdlib) em :8764
  -> startup.html + /status + /retry
  -> bootstrap numa thread: .venv, dependências, yt-dlp, FFmpeg
  -> Uvicorn em :8765
  -> /api/health + GET /
  -> pronto: a tela redireciona para :8765
```

`launcher.py` usa `APP_BIND_HOST = 0.0.0.0`, `APP_HOST = 127.0.0.1` (health check e redirecionamento) e `APP_PORT = 8765`, que muda com `VARISPEED_PORT`.

Regras:

- `launcher.py` não depende de FastAPI, Uvicorn, `yt-dlp` nem de bibliotecas externas, porque precisa funcionar antes de `.venv` existir. Não adicionar FastAPI ou Flask a ele.
- Se `/api/health` já responde, não sobe outro backend. Se `:8764/status` já existe, o segundo clique reaproveita o bootstrap em andamento.
- FFmpeg ausente é aviso, não erro.
- Os logs ficam em `logs/startup.log` e `logs/server.log`.
- Em erro, a tela continua aberta com `TENTAR NOVAMENTE` e `VER DETALHES`.
- Depois de pronto, a tela fica alguns segundos para concluir o redirecionamento e então encerra.
- Se uma tentativa criou o backend mas falhou antes de terminar, o launcher encerra só o processo daquela tentativa antes do retry. Nunca mata uma instância que já existia.
- O backend sobrevive ao fim do launcher; no Windows ele nasce sem console e num novo process group.
- O launcher e os scripts conferem `yt-dlp-ejs` e `yt-dlp-getpot-wpc`, então uma `.venv` antiga recebe as dependências novas no próximo início.
- `_auto_update_ytdlp()` consulta o PyPI no máximo uma vez a cada 24 h (preferência "Atualizar ao abrir", ligada por padrão) e instala a versão nova antes de subir o servidor. Rede fora, PyPI fora ou pip com erro nunca bloqueiam a abertura: o launcher registra no log e segue com a versão instalada. `server/ytdlp_update.py` usa só a biblioteca padrão justamente para o launcher poder importá-lo.
- O backend iniciado pelo launcher recebe `VARISPEED_MANAGED=1` e `VARISPEED_BIND_HOST`. Só esse processo se reinicia sozinho depois de `POST /api/system/ytdlp/update`: dispara `python -m server.relaunch`, que espera a porta liberar e sobe o Uvicorn com os mesmos parâmetros, e então encerra. Sem a marca (start-tempo, execução manual), a resposta traz `restart_required` e a interface pede o reinício.
- O yt-dlp se apresenta como `2026.08.19` e o pip registra `2026.8.19`; as nightlies vêm do PyPI como `….dev0` e se apresentam sem o sufixo. Comparar versões sempre com `ytdlp_update.same_version()`/`version_key()` (e `sameVersion()` em `settings.js`), nunca como texto.

### 3.2 Tela de inicialização

A máquina de estados acompanha Python, `.venv`, dependências, `yt-dlp`, FFmpeg, servidor e interface, mas a tela mostra uma linha por vez:

```text
INICIALIZANDO... -> VERIFICANDO PYTHON... -> PREPARANDO AMBIENTE... -> ... -> PRONTO
```

`startup.js` consulta `/status` a cada 260 ms e, quando `stage` muda, chama `Motion.status()`. Abaixo vem uma barra indeterminada com a mesma varredura de `linkbar__track[data-mode="indet"]`. A tela não mostra porcentagem, progresso inventado nem checklist, e não usa animação estrutural.

O layout aprovado é um bloco compacto e centralizado, com o gato e `VARISPEED 1.0`, a linha de estado e a barra. Não há linha decorativa acima do logo nem abaixo da barra, e `.boot__panel` não tem `border-top`/`border-bottom`. Os logs técnicos só aparecem quando o usuário pede detalhes.

### 3.3 `start-tempo.bat` (modo diagnóstico)

Fica por compatibilidade e para depuração; não é o launcher do dia a dia. O terminal fica visível e ligado ao Uvicorn. O script detecta Python 3.11+, prefere `py -3`, cria ou reaproveita `.venv`, instala as dependências, avisa sobre o FFmpeg e sobe o Uvicorn em `0.0.0.0:8765`.

Ele chama direto `py -3 -m venv .venv`, usa `python -m venv .venv` só como alternativa validada, recria uma `.venv` sem `.venv\Scripts\python.exe` e para na hora se a criação falhar. O fluxo usa rótulos e `goto` por causa de um erro já visto: com Python 3.13.15, o script antigo fazia `set "PY_CMD=py -3"` dentro de um bloco `IF (...)` e usava `%PY_CMD% -m venv .venv` no mesmo bloco. O `cmd.exe` expande `%VAR%` ao ler o bloco, antes das atribuições, então só `-m venv .venv` era executado e aparecia `'-m' is not recognized as an internal or external command`. Não definir uma variável dentro de `IF (...)` e usá-la com `%VAR%` no mesmo bloco sem `EnableDelayedExpansion`. O launcher gráfico não justifica piorar o `.bat`.

### 3.4 Linux e macOS

Num clone, `./VARISPEED.sh` abre o mesmo launcher gráfico do Windows com o `python3` do sistema, e `./start-tempo.sh` continua como modo diagnóstico com terminal. `./criar-atalho.sh` gera o `.desktop` com o caminho real da pasta. Não adicionar Electron ou PyInstaller: o download pronto (3.5) resolve a instalação sem empacotar o app num executável.

### 3.5 Download pronto

`tools/build_bundle.py` monta, por sistema, uma pasta `VARISPEED/` que abre sem instalar nada:

- `runtime/python/`: Python portátil do python-build-standalone, obtido com `uv python install` (uv e Python fixados no script). O marcador `EXTERNALLY-MANAGED` que o uv cria é removido, porque o pip do pacote instala e atualiza o yt-dlp. As dependências de `server/requirements.txt` já vêm instaladas.
- `runtime/node/`: só o executável e a licença do Node.js LTS fixado, com o SHA-256 conferido contra o `SHASUMS256.txt` oficial.
- Os arquivos do app saem de `git ls-files`, sem `tests/`, `docs/`, `.github/`, `tools/`, `pyproject.toml` e `start-tempo.*`, e sem os arquivos do outro sistema. O script escreve `LEIA-ME.txt`, `THIRD-PARTY.txt` e `VERSION`.
- Windows sai em `.zip`; Linux em `.tar.gz`, que guarda permissões de execução e os links simbólicos do Python. Cada um ganha um `.sha256`.
- Antes de terminar, o script extrai o pacote numa pasta nova e sobe o servidor de lá (`/api/health` e `GET /`).

O launcher detecta o pacote por `runtime/python`: usa esse Python no lugar da `.venv` (`PORTABLE`), não cria ambiente nem roda o pip se as dependências validarem, e passa `runtime/node` ao backend em `VARISPEED_NODE_PATH`. `VARISPEED.vbs` prefere `runtime\python\pythonw.exe` e só cai para `py -3` num clone. `VARISPEED.sh` faz o mesmo com `runtime/python/bin/python3`.

O Node do pacote serve ao mesmo caminho de antes: desafios de JavaScript na verificação de reprodução com login (`youtube_pot.py`). Links públicos continuam sem runtime auxiliar.

`.github/workflows/release.yml` roda o script em `windows-latest` e `ubuntu-22.04` (glibc mais antiga, para o pacote abrir em mais distribuições) e anexa os arquivos a um rascunho de release com `gh release upload`. Tag `v*` gera o rascunho da versão; execução manual gera `build-<número>` como pré-lançamento. Publicar é sempre manual.

### 3.5 Ícones

`assets/varispeed.ico` vem do favicon do gato e tem as resoluções `16, 24, 32, 48, 64, 128, 256`. Ele serve ao atalho `.lnk`; o navegador usa `assets/favicon.png`. Se o favicon mudar, gerar o `.ico` de novo.

## 4. Importação por link

### 4.1 Análise

Colar, clicar em Analisar ou apertar Enter chama `analyzeUrl(raw)`:

```text
RemoteImport.parse -> POST /api/media/info -> yt-dlp extract_info(download=False) -> metadados -> linkShowPreview(meta)
```

A análise não baixa a mídia. `/api/media/info` devolve `id`, `title`, `uploader`, `channel`, `duration`, `thumbnail`, `extractor`, `site` e `webpage_url`; a interface usa principalmente título, autor/canal, duração, thumbnail e extractor. Não mandar o objeto completo do `yt-dlp` ao navegador: ele é grande, instável e traz dados desnecessários.

Opções da extração: `skip_download = True`, `format = "bestaudio/best"`, `noplaylist = True`.

### 4.2 Download

Importar áudio chama `importRemoteAudio()`:

```text
POST /api/media/audio -> yt-dlp download -> FileResponse -> Blob no navegador -> ingest(blob) -> decodeAudioData -> waveform
```

O formato segue `bestaudio[ext=m4a] / bestaudio[ext=webm] / bestaudio / best`, para preferir o que os navegadores tocam sem transcodificar. Não converter tudo para WAV no backend.

`_download_sync()` escolhe o maior arquivo final no diretório temporário. Isso funciona porque o `outtmpl` usa o ID e não há arquivos auxiliares. Se um dia forem salvos thumbnails, legendas, info JSON, capítulos ou vários formatos, essa escolha precisa ser revista.

### 4.3 Estados e progresso

Os estados são `Obtendo informações`, `Baixando áudio`, `Decodificando` e `Pronto`. Enquanto o servidor prepara a resposta, a barra é indeterminada; quando a resposta começa e há `Content-Length`, o navegador mede os bytes e mostra a porcentagem real. Não inventar porcentagem.

### 4.4 Botão Importado

Depois que download, decodificação e `ingest()` terminam com sucesso, a prévia entra no estado de já importado:

- `linkUI.importedUrl` guarda a URL concluída e `linkSyncImportButton()` decide o estado do botão;
- para a mesma `requestUrl`, o texto vira `Importado` e `#btnUrlImport` fica `disabled`; reanalisar a mesma URL mantém isso, e outra URL libera o botão;
- `linkIdle()` não reabilita o botão por conta própria, ele chama `linkSyncImportButton()`;
- só marcar como importado depois que `ingest()` retorna sucesso. Erro de rede, download, cancelamento ou decodificação mantém a chance de tentar de novo;
- `importRemoteAudio()` também barra a mesma URL na função, então Enter no campo não contorna o `disabled`;
- `importedUrl` representa só a mídia remota carregada agora: um arquivo local carregado com sucesso faz `importedUrl = null`, e uma falha de arquivo local não mexe nela.

A proteção evita reimportar o mesmo áudio logo depois; não remover sem uma decisão de UX.

### 4.5 Erros

O frontend separa URL inválida, backend parado, erro do `yt-dlp`, cancelamento e falha de decodificação. `netFail()` em `app.js` transforma falha de conexão em instrução para iniciar o backend. O backend responde:

```text
400 -> URL inválida ou bloqueada
413 -> limite configurado excedido
422 -> o yt-dlp não conseguiu processar ou a mídia não é suportada
500 -> falha interna inesperada
```

### 4.6 Cancelamento e concorrência

O frontend usa `AbortController`; Escape ou fechar a barra aborta a requisição. Isso não garante parar na hora um `yt-dlp` que já roda numa thread do servidor, porque o backend é síncrono por job (`asyncio.to_thread`). Não afirmar que o cancelamento mata o processo. Se cancelamento no servidor virar requisito, o download precisa virar um job com ID e endpoint de cancelamento.

Cada download usa o próprio diretório temporário. O modelo serve para uso local leve, não para escala pública.

### 4.7 FFmpeg

O FFmpeg é recomendado, mas não há conversão fixa de toda entrada, para evitar CPU extra, perda dupla de qualidade, arquivos enormes e espera. Se aparecerem muitos problemas de codec, o caminho é uma normalização opcional: tentar o stream M4A/WebM original e, se o navegador falhar, pedir ao backend uma versão compatível (FFmpeg para M4A/AAC, por exemplo). Isso não tem relação com correção de pitch.

### 4.8 Plataformas

A versão antiga bloqueava YouTube, Spotify e outros no navegador por causa do CORS. Hoje o critério é se o `yt-dlp` consegue extrair a URL no ambiente atual. YouTube, links diretos e outras plataformas suportadas podem funcionar, às vezes com cookies; DRM não é removido; extractors quebram quando os sites mudam. Não prometer suporte a todas as plataformas.

## 5. Backend, rede e segurança

### 5.1 Rede local

O backend escuta em `0.0.0.0:8765` de propósito, para outros dispositivos da rede usarem o editor. O host acessa por `127.0.0.1:8765`.

- `GET /api/system/info` devolve `local_url`, `lan_urls`, `port` e `can_shutdown`.
- `POST /api/system/shutdown` encerra o processo depois de responder. Só aceita cliente loopback e, quando há header `Origin`, exige `127.0.0.1:8765` ou `localhost:8765`. Clientes em `192.168.x.x:8765` usam o editor, mas não desligam o host.
- Se o Firewall do Windows bloquear, liberar o Python/Uvicorn só em redes privadas. Não orientar redirecionamento da porta 8765 para a internet.

### 5.2 Validação de URL

`_validate_url()` aceita só HTTP e HTTPS, bloqueia localhost e `.local`, confere IP literal, resolve o DNS e recusa qualquer IP não global. Isso impede que a importação vire proxy para a rede local (SSRF). Também valem `noplaylist`, recusa de lives, diretório temporário por download, limpeza depois da resposta e whitelist de arquivos públicos.

### 5.3 Cabeçalhos HTTP

`_apply_response_headers()` aplica a mesma política a tudo:

- a API usa `Cache-Control: no-store`; arquivos públicos usam `no-cache`, revalidando a revisão atual;
- a CSP e os headers `X-Frame-Options`, `nosniff`, `Referrer-Policy` e `Permissions-Policy` ficam como estão;
- o bootstrap de tema mora em `theme-boot.js`; colocar JavaScript inline no HTML obrigaria a afrouxar `script-src`.

### 5.4 Limite de duração

`VARISPEED_MAX_DURATION_SECONDS` limita a duração aceita; `0` ou ausente significa sem limite. Se o app for publicado, esse limite passa a ser obrigatório.

### 5.5 Publicação na internet

Publicar o backend deixa de ser uma mudança simples. Antes, seriam necessários autenticação, rate limit, filas ou jobs, limites de duração e tamanho, quotas, sandbox do processo, logs estruturados, timeout global, política de cookies, reverse proxy e prevenção de abuso.

## 6. Autenticação e conteúdo restrito

### 6.1 Regras gerais

- Cookies nunca vão para o repositório nem para o frontend, e credenciais não ficam em `settings.js` nem no `localStorage`.
- `remote.authBrowser` guarda só `off`, `auto`, `dedicated`, `chrome`, `edge`, `firefox`, `brave` ou `vivaldi`, e `app.js` envia a escolha por `POST /api/auth/browser`.
- Configuração e status de autenticação só aceitam loopback; os POSTs também validam a origem local.
- `_extract_info_sync()` tenta sem sessão e só repete com `cookiesfrombrowser` diante de erro explícito de autenticação. `auth_required` acompanha a prévia até o download, sem levar cookies nem segredos.
- Dispositivos da rede local nunca recebem `_AUTH_BROWSER` nas opções do `yt-dlp`.
- A escolha fica salva no frontend, mas a autorização ativa do backend vive só na memória e é refeita a cada início.

### 6.2 Modo automático

`server/browser_auth.py`, acionado por `POST /api/auth/browser/auto` ou no retry de um link restrito:

- descobre perfis Chromium e Firefox que têm banco de cookies;
- testa cada um no próprio link e só ativa o que conclui a extração;
- guarda o caminho do perfil só na memória, nunca exporta cookies nem devolve caminhos ou valores;
- distingue `browser_locked`, `browser_not_found`, `youtube_session_not_found`, `youtube_playback_verification_required`, `youtube_po_token_unavailable` e `youtube_po_token_failed`;
- com Edge ou Chrome aberto, não tenta contornar o bloqueio do Windows e indica a sessão dedicada.

### 6.3 Sessão dedicada

`server/dedicated_auth.py`, a opção recomendada:

- abre só o Edge instalado, com `--user-data-dir` temporário e porta DevTools aleatória restrita a `127.0.0.1`;
- coleta os cookies pela instância isolada, sem ler o banco bloqueado do navegador principal;
- `_safe_cookie_text()` descarta domínios fora de `youtube.com` e recusa quebras de linha e tabulações antes de gerar o formato Netscape;
- após a confirmação, fecha a janela e apaga o diretório `login-*`; fica só `youtube.cookies.txt` em `%LOCALAPPDATA%/VARISPEED/youtube-auth`;
- o `yt-dlp` recebe uma cópia em memória, sem permissão para regravar o arquivo;
- `status()` carrega o arquivo com `YoutubeDLCookieJar`; existência ou tamanho não provam conexão;
- `session-state.json` guarda só `unverified`, `verified`, `playback_verification_required` ou `invalid`;
- `_auth_mode_for_url()` impede usar a sessão fora de `youtube.com`/`youtu.be`;
- `disconnect` apaga o arquivo e `cancel` fecha só a tentativa pendente;
- `start`, `finish`, `cancel` e `disconnect` exigem loopback e origem local, e as respostas trazem só `available`, `connected`, `login_open` e `validation`.

`ExtractionLogger` guarda só dois booleanos do log do `yt-dlp`: conta reconhecida e exigência de confirmação de idade. Não salvar nem devolver o log completo, que pode ter contexto sensível. Uma conta reconhecida sem idade confirmada não é "cookie inválido".

### 6.4 Arquivo de cookies manual

O backend aceita `VARISPEED_COOKIES_FILE` (por exemplo `C:\segredo\cookies.txt`). A extensão opcional `tools/youtube-cookie-exporter/` gera esse arquivo: é Manifest V3, com `permissions: [cookies]`, acesso opcional só a `https://*.youtube.com/*` e `incognito: split`. Não tem background, content script, rede, telemetria nem storage; o usuário a carrega manualmente e clica para autorizar e exportar. O backend continua recebendo só o caminho da variável.

### 6.5 PO Token e desafios EJS

`server/youtube_pot.py` cuida dos vídeos autenticados que pedem verificação de reprodução:

- encontra Chrome, Edge, Brave ou Vivaldi (ou `VARISPEED_CHROMIUM_PATH`) e Node.js 22+ (ou `VARISPEED_NODE_PATH`);
- confere o pacote `yt-dlp-getpot-wpc` sem importá-lo nem expor caminhos;
- injeta `youtube:player_client=mweb`, o caminho privado `youtubepot-wpc:browser_path` e `js_runtimes.node` só quando há fonte autenticada; links públicos usam o cliente padrão e não abrem o navegador auxiliar;
- o plugin WPC cria um perfil Chromium próprio, minimizado e sem os cookies da conta, que ficam só no cookie jar do `yt-dlp`;
- `/api/health` devolve `youtube_po` e `/api/auth/status` devolve `po_token`, só com disponibilidade, versões e rótulos públicos;
- falha estrutural vira `youtube_po_token_unavailable` e falha na geração vira `youtube_po_token_failed`, nunca "idade não verificada".

Não trocar `yt-dlp[default]` por `yt-dlp`: é essa variante que traz os scripts EJS compatíveis. O Node é só o runtime desses scripts; o projeto continua sem pacotes npm.

## 7. Interface

### 7.1 Cabeçalho e menu Importar

1. Há um único botão `Importar`, que abre `#importMenu`: `#importFile` (Arquivo local) dispara `<input type="file" id="file">` e `#importLink` (Link) abre `#linkbar`.
2. Não existe `#btnLink` separado.
3. `#btnPop` fica em `.hdr__scope-tools`, logo à esquerda de `#scopeWrap`, junto do osciloscópio que controla.
4. Não existem `#themeLight` e `#themeDark`. O tema muda só em Configurações → Interface → Tema (`ui.theme`); `app.js` continua aplicando o tema, seguindo `prefers-color-scheme` no modo `system` e redesenhando os Canvas.

O menu fica ancorado ao botão, fecha com clique fora ou Escape, mantém `aria-expanded`, `aria-haspopup="menu"`, `role="menu"` e `role="menuitem"`, e as duas opções convergem em `ingest()`.

### 7.2 Mascote

- `assets/cat-brand-light.png`: pelagem preta, olhos amarelos, fundo branco. `assets/cat-brand-dark.png`: pelagem branca, olhos amarelos, fundo preto. Os olhos não são dessaturados; não usar `grayscale()` ou `invert()` para fazer a versão escura.
- As duas têm o mesmo canvas (`1535 × 955`), ficam montadas, absolutas e sobrepostas no mesmo container, e o tema muda só a `opacity`. Não mudar `object-position`, `object-fit`, tamanho, `transform`, margin ou padding por tema, nem animar a troca.
- As imagens originais tinham uma faixa artificial perto de `y=955`, removida dos arquivos. A linha visual certa é o `border-bottom` do `.hdr`. A versão escura recebeu um pequeno ajuste (cerca de `0.988×` e `-0.22°`) para alinhar os olhos com a clara; não aplicar filtro ou transformação CSS a uma variante só.
- Container `.hdr__mascot` e camadas `.hdr__cat--light`/`.hdr__cat--dark`. O mascote é estático: `app.js` não o usa para efeitos, e não há bloom, brilho, flicker, escala nem deslocamento.
- O favicon `assets/favicon.png` é recortado do gato escuro e precisa continuar em `PUBLIC_FILES`.

```css
.hdr__mascot { width: 168px; min-width: 168px; overflow: hidden; }

.hdr__cat {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; object-position: 50% 90%;
  opacity: 0; filter: none; transform: none; transition: none;
}

[data-theme='dark'] .hdr__cat--dark { opacity: 1; }
[data-theme='light'] .hdr__cat--light { opacity: 1; }
```

### 7.3 Barra de importação por link

1. `.linkbar` é o container de uma coluna.
2. `.linkbar__query` tem quatro colunas: rótulo, URL, `Analisar` e fechar.
3. `.linkbar__preview` tem quatro colunas: `112px` de thumbnail, `minmax(0, 1fr)` de metadados, uma coluna fixa de duração (`72px`, para caber horas) e uma coluna fixa para `Importar áudio`.
4. `#urlDuration` fica fora de `.linkbar__media`, para duração e título não disputarem a mesma grade. A duração usa numerais tabulares e alinhamento à direita.
5. O botão tem largura fixa no desktop.
6. Em caso de sucesso, `#urlMsg` não mostra `Origem: ...`, que já está em `#urlSource`. `#urlMsg` fica para erros e casos excepcionais.
7. Os breakpoints põem o botão em largura total, sem mudar fluxo nem IDs.

Impacto: `index.html` e `.linkbar*` em `styles.css`; `app.js` só para estados e mensagens. Ajuste puramente visual não mexe em `remote-import.js`.

### 7.4 Créditos

A seção Sobre o VARISPEED tem um bloco montado por `buildCredits()` em `settings.js`:

```text
CRIADOR DO VARISPEED
Gaspar
Design e desenvolvimento
[GITHUB · nehalem-x/VARISPEED] · [LOGO YT_DLP]
```

O logo é um link externo na mesma linha (`target="_blank"` com `rel="noopener noreferrer"`), sem URL em texto abaixo. Os assets são `assets/creator-light.png`, `assets/creator-dark.png` e `assets/yt-dlp-logo.png`.

Os dois retratos são pessoais e estão no `.gitignore`. `buildCredits()` começa com as imagens ocultas, observa `load`/`error` e só reserva a coluna da foto quando pelo menos uma carrega. Sem nenhuma, aplica `.is-text-only`; com uma só, ela vale para os dois temas. Um clone limpo nunca mostra ícone quebrado nem espaço vazio.

Regras do retrato:

- as duas imagens têm o mesmo canvas, crop, escala e posição, e `.cfg__credits-photo` usa o mesmo `object-fit` e `object-position`;
- o tema muda só qual camada tem `opacity: 1`, sem `filter`, `scale`, `translate` nem animação por variante;
- escuro: fundo preto e camiseta branca; claro: fundo branco e camiseta preta;
- `creator-light.png` é o retrato aprovado pelo criador, apenas redimensionado para `640 × 640 px` para igualar o escuro. Rosto, cabelo, óculos, expressão e enquadramento não devem ser refeitos nem trocados por uma versão reinterpretada sem pedido explícito.

Impacto: `buildCredits()` e o fim de `#cfgBody` em `settings.js`, `.cfg__credits*` em `styles.css`, os dois retratos e `PUBLIC_FILES` em `server/main.py`.

## 8. Configurações

### 8.1 Organização

A ordem vem de `GROUP_ORDER` em `settings.js`, e o painel mostra uma seção por vez, escolhida num seletor que lembra a última seção durante a sessão:

1. Interface.
2. Velocidade, com `Lembrar última velocidade` (chave antiga `load.rememberRate`).
3. Exportação, com `Avisar ao sair durante exportação` (chave antiga `load.confirmExit`).
4. Biblioteca.
5. Importação por link, com Conteúdo restrito.
6. Timeline.
7. Visualização de áudio: vectorscope e osciloscópio sobre o mesmo analisador.
8. Animações: as chaves continuam `motion.*`, mas o título `Motion` não aparece.
9. Ao importar: tocar automaticamente, voltar a 100% e manter o zoom.
10. Sistema, Atalhos e Diagnóstico (o rótulo `Animações efetivas` usa o id `motion`).
11. Sobre o VARISPEED, com os créditos.

Mudar a apresentação não renomeia chaves salvas nem muda `tempo.cfg.v1`.

### 8.2 Edição assistida

- `#cfgStatus` é o canal de feedback dentro do painel; ações de Configurações não dependem só da barra de status global, que fica coberta no celular.
- Cada preferência tem o mesmo botão `.cfg__help-toggle`. Os textos ficam em `FIELD_HELP`, e um campo pode trocar o seu com `help`. As ajudas abrem num painel com título e fechar, uma por vez, devolvendo o foco ao botão.
- `#cfgUndo` desfaz o Restaurar por alguns segundos.
- `rate.presets` tem um editor de chips, mas continua salvo e exportado como texto separado por vírgulas.
- `export.name` tem botões que inserem tokens no cursor sem mudar a sintaxe do modelo.
- Campos técnicos podem declarar `help` e `bounds` no mesmo schema.
- O rodapé avisa que tudo é salvo automaticamente e agrupa Carregar e Salvar preset.
- `motion.status` aparece como Animação padrão de status e o antigo `Microtick da velocidade` como Microanimação numérica.

### 8.3 Grupo Sistema

O grupo é só de runtime: não entra em `tempo.cfg.v1` nem nos presets. Mostra servidor, URL da rede e porta, com `Copiar endereço` e `Desligar VARISPEED`. O desligamento dispara `varispeed:shutdown` antes do POST, para `app.js` pausar o áudio e fechar o AudioContext.

Layout: os dois botões ficam empilhados, cada um com a largura toda, usando `.btn.cfg__system-action` e não `btn--ghost` (que é compacto demais para rótulos longos). Mantêm `white-space: nowrap`, `min-width: 0`, `overflow: hidden` e `text-overflow: ellipsis`. Não voltar a pôr os dois lado a lado sem testar em larguras estreitas. As linhas Servidor, Rede local e Porta têm rótulo à esquerda e valor à direita, sem overflow. `Desligar VARISPEED` fica isolado por `.cfg__system-danger`. Impacto: `buildSystemGroup()` em `settings.js` e `.cfg__system-*` em `styles.css`.

### 8.4 Comportamento das chaves

- Todo campo em `GROUPS` precisa ter pelo menos um uso real fora da montagem do painel.
- `load.rememberRate=false` não grava `tempo.lastRate` e apaga o valor anterior.
- `load.keepZoom` mantém `state.zoom`, mas uma faixa nova sempre começa em `state.view = 0`.
- `tl.seek` vale para as setas sem modificador; `Shift + seta` anda exatamente 1 segundo.
- `scope.smooth` só vale para `columns`; o slider tem direção invertida porque mostra `1 - smooth`.
- O estado de movimento fica em `html[data-motion]`, então `motion.level=off` e `prefers-reduced-motion` controlam CSS e JavaScript juntos.
- `motion.sweep` é a chave única da varredura em exportar, abrir e adicionar à Biblioteca.
- Testar Osciloscópio, Animações e os campos dependentes ficam indisponíveis quando a função principal está desligada; as linhas dependentes recebem `aria-disabled` junto com `.is-off` e `input.disabled`.
- O diagnóstico diz `localStorage` ou `memória temporária`; a mídia da Biblioteca fica no IndexedDB, que é outra coisa.

### 8.5 Chaves removidas e presets

Saíram `motion.bloom`, `motion.bloomGain`, `motion.bloomFreq`, `Motion.bloom()`, as custom properties `--bloom*`, a referência `el.brand`/`.hdr__brand` e `motion.exportName`. Presets antigos podem trazer essas chaves: `settings.js` ignora campos desconhecidos e apaga chaves obsoletas do armazenamento local. Não mudar `tempo.cfg.v1` por causa dessa limpeza.

O preset exportado declara `{ "app": "VARISPEED", "version": 1 }`. O importador aceita presets antigos porque lê o objeto `settings` sem exigir o nome do app. O evento `cfg:imported` usa `detail` para dizer o resultado, e a mensagem acompanha:

```text
< 0  JSON inválido
= 0  carregou, mas nenhum ajuste compatível mudou
> 0  quantidade de ajustes aplicados
```

Limites: `export.name` até 180 caracteres e `rate.presets` até 120, aplicados também em `coerce()` para valores vindos de preset ou `localStorage`. `buildPresets()` tira repetidos, inválidos e fora dos limites antes do teto de 8 presets.

## 9. Feedback textual

A animação da confirmação `Exportado · arquivo · tamanho` é o padrão de todo feedback textual, exposto por `Motion.status(host, text, opts)` em `motion.js`.

- Transporte, importação, análise de link, download e decodificação, presets, mensagens de sistema e a tela de inicialização usam `Motion.status()`.
- A cadência é a da exportação: `charEvent` com o jitter correspondente, `dissolve=420 ms`, `outStep=11` e intensidade cheia por padrão.
- Eventos curtos mudam só o `hold`. Estados que precisam ficar legíveis usam `persist:true`, e a próxima atualização cancela a anterior. Mensagens muito longas têm a entrada limitada a cerca de `1800 ms`.
- `motion.status` liga e desliga a linguagem; `motion.caret` vale para status temporários (estados persistentes podem omitir o cursor); `motion.exportHold` continua só da exportação, porque nome e tamanho precisam de mais tempo.
- Não recriar uma engine separada para a exportação nem usar `Motion.ephemeral()` direto em novos estados.
- `typeOut()` serve para conteúdo que não é status (como o nome da mídia) e `digitTick()` para números.
- Configurações, dropdowns, barra de link e botões não recebem animação estrutural; o padrão vale só para texto.

Outras partes podem emitir `varispeed:status` para pedir uma mensagem na barra de status sem conhecer a implementação; `settings.js` faz isso ao copiar o endereço da rede e ao iniciar o desligamento.

## 10. Responsividade

### 10.1 Breakpoints

```text
> 1200           desktop largo (referência)
901–1199         desktop compacto / notebook
641–900          tablet / janela estreita
521–640          mobile largo
421–520          phone
<= 420           phone estreito
height <= 720    notebook baixo (só com width >= 901)
height <= 520    mobile em paisagem / viewport baixo (width <= 900)
```

Para acomodar algo novo: reduzir densidade e gutters, permitir truncar texto secundário, reorganizar grid ou flex, empilhar e, por último, esconder informação secundária. Não criar breakpoints por aparelho.

### 10.2 Regras por área

1. Painel do editor: em `<=900px`, `.main` vira uma coluna com a timeline em cima e `.insp` usa a grade horizontal `painel | divisor | painel | divisor | painel`, com `.insp__foot` na largura toda. Em `<=640px`, `.insp` volta a `flex-direction: column` e os divisores viram linhas horizontais. A timeline nunca vai para baixo do painel.
2. Barra de link: o desktop mantém `thumbnail | metadados | duração | botão`. Em `<=720px` o botão ganha linha própria. Em `<=520px` a consulta vira URL + fechar com Analisar embaixo e a prévia fica em duas colunas. O estado `Importado` continua no JavaScript.
3. Cabeçalho: o mascote estreita aos poucos. Em `<=720px`, mascote e ações ficam na primeira linha, e arquivo, botão da janela separada e osciloscópio na segunda, com o botão sempre à esquerda do visualizador. Sem atalho de tema.
4. Timeline e transporte: `DUR` e `RATE` somem antes de a waveform encolher, o volume segue oculto em telas estreitas, e no celular os espaçamentos diminuem antes de o transporte empilhar.
5. Velocidade: em `<=640px` os presets usam grade `3 × 2`.
6. Configurações: `.cfg` ocupa a largura toda em `<=520px` e linhas inline podem empilhar em `<=420px`. Os créditos mantêm as duas imagens sobrepostas no mesmo box; media queries mudam o tamanho do box, nunca a geometria por tema.
7. Telas baixas: o desktop baixo comprime `--hdr-h`, `--transport-h`, `--ruler-h`, `--sbar-h` e os espaçamentos do painel e da barra; o celular em paisagem rola em vez de reduzir a waveform a uma faixa inútil.

### 10.3 Conteúdo extremo

- `.hdr__filemeta` fica no DOM só como destino interno e sempre oculto; sample rate, canais e duração aparecem só nos painéis, e o cabeçalho prioriza o nome da mídia.
- Duração desconhecida aparece como `—` com `title="Duração desconhecida"`.
- `urlTitle`, `urlByline` e `urlSource` levam o texto completo em `title`.
- O texto de etapa do progresso é cortado em vez de alargar a grade, e mensagens da barra quebram URLs e tokens longos.
- Em `<=520px` o título remoto pode ter duas linhas; em `<=380px` thumbnail e espaçamentos encolhem antes do texto importante.
- Com `height <=520px` e `width <=900px`, cabeçalho e barra ficam mais compactos e a waveform tem piso de cerca de `240px`.
- O painel de Configurações usa até `440px` em `<=720px` e até `480px` em paisagem baixa, antes de ocupar a tela toda.
- Para evitar overflow horizontal, `body` usa `overflow-x: clip`. Não pôr `overflow` em `html`, que quebra a rolagem vertical no Chromium.
- A camada final do CSS também cuida de opacidade de controles desabilitados, cursor de `aria-busy`, quebra de tokens em linhas, dicas, créditos e atalhos, `scroll-padding`/`scroll-margin` para foco no celular e tamanho do painel a partir da visual viewport.

Matriz de teste: `1920×1080`, `1600×900`, `1366×768`, `1280×720`, `1024×768`, `900×600`, `768×1024`, `430×932`, `390×844`, `360×800`, `844×390` e `667×375`, com nomes, URLs e títulos longos, duração `123:45:56`, velocidade `800%`, progresso com texto longo, erro com URL sem espaços e Configurações roladas até os créditos.

## 11. Canvas, redimensionamento e DPR

### 11.1 Redimensionamento

Redimensionar muda só a geometria do desenho, nunca o tempo da sessão. Durante resize ou rotação ficam iguais `state.zoom`, `state.view`, `state.rate`, `state.playing`, `audio.currentTime` e `audio.playbackRate`. O playhead pode mudar de X porque a largura mudou; o tempo que ele representa não.

- Waveform e régua compartilham `W`, `H`, `RH` e `canvasDpr`. `resize(force = false)` compara largura, altura e DPR antes de tocar em `canvas.width/height`.
- `scheduleResize()` agrupa eventos em `requestAnimationFrame` e faz uma passada final cerca de 140 ms depois.
- Observar `#wave`, `#ruler` e `#canvasWrap`, não só o pai, e ouvir também `window.resize`, `visualViewport.resize` e `orientationchange`.
- Depois de realocar, chamar `scopeResize()`, `draw()` e `movePlayhead()`. O caminho de resize não chama `setZoom`, `seek`, `play` nem `pause`.
- O osciloscópio guarda `top/bot` antes de trocar o bitmap e, se houver quadro congelado, reamostra para a nova largura. Zerar esses arrays faz o osciloscópio pausado sumir.
- A janela separada e o modo foco (`#scopeFocus`) agrupam resize em `requestAnimationFrame`, e a janela também ouve `visualViewport.resize`. Nenhuma das apresentações tem fonte de áudio própria.

### 11.2 DPR e backing store

```text
tamanho CSS real (pode ser fracionário) × devicePixelRatio
  -> round() só no backing store físico
  -> ctx.setTransform(backing / css)
```

- `canvasDprNow()` aceita `0.5–3`. Não voltar ao mínimo `1`: zoom abaixo de 100% gera DPR `0.8` ou `0.9`.
- Não arredondar `getBoundingClientRect()` antes de calcular o bitmap. `setCanvasBitmap()` usa `backing / cssSize` como escala efetiva.
- A tolerância de tamanho é `0.05 CSS px` e a de DPR é `0.0001`. O erro máximo do backing store é de meio pixel físico, conferido para DPR `0.80`, `0.90`, `1.00`, `1.10`, `1.25`, `1.50`, `2.00`, `2.25` e `3.00`.
- `app.js` e `scope-win.js` armam `matchMedia('(resolution: <DPR atual>dppx)')` e o rearmam no `change`, chamando `scheduleResize(settle)`. Não depender só de `window.resize`: trocar de monitor pode mudar o DPR sem um resize confiável. A janela separada tem o próprio watcher porque pode estar em outro monitor.
- `pointerSeek()` converte `clientX` de `rect.width` para `W` antes de `xToSrc()`.
- O playhead encaixa na grade física com `round(x * waveScaleX) / waveScaleX`.
- Grade e ticks com `fillRect()` usam coordenadas inteiras, sem `+0.5`, que serve para traços de 1 px e não para retângulos.
- Waveform e régua usam `image-rendering:auto`, nunca `pixelated` ou `crisp-edges`.
- `scope-view.js` mede `cssW/cssH` fracionários, limita o número de colunas ao arredondamento em CSS px, cria o bitmap com `round(cssSize × DPR)` e aplica a escala pela razão backing/lógico.
- `settings.js` escreve `visualViewport.height/offsetTop` com até 3 casas em `--cfg-vvh`/`--cfg-vvtop`; `text-size-adjust:100%` evita inflação de texto sem bloquear o zoom; números dinâmicos usam `tabular-nums`.

## 12. Toque, teclado virtual e estados

### 12.1 Waveform e régua

- `#wave` e `#ruler` usam `touch-action: pan-y pinch-zoom`. Não trocar por `none`, que bloquearia a rolagem da página quando o gesto começa na timeline.
- `waveGesture` usa `TOUCH_SLOP = 8`. Mouse faz seek ou scrub no `pointerdown`; com toque ou caneta, um toque curto faz seek e o arraste só vira scrub quando o deslocamento horizontal passa do limite e domina o vertical. O gesto vertical fica com o navegador.
- Sempre tratar `pointerup`, `pointercancel` e `lostpointercapture`.

### 12.2 Sliders e alvos de toque

- `#scrub` encerra `state.scrubbing` em `pointerup`, `pointercancel`, `lostpointercapture`, `change` e `blur`.
- `.slider` e `.scrub` usam `touch-action: none`, porque o gesto sobre eles é horizontal. Com `pointer: coarse`, o input tem 32 px de altura e um thumb maior, mas o trilho continua com 2 px.
- Com `pointer: coarse`, `--ctl-h`, `--ctl-step` e `--ctl-subtle` passam a 44 px (ver [PADRAO_UI.md](PADRAO_UI.md)), os itens do menu Importar têm 44 px e fechar a barra de link, as Configurações e o modo foco têm 44 × 44 px. Não reduzir sem testar num celular.
- Controles usam `touch-action: manipulation` e `-webkit-tap-highlight-color: transparent`. `@media (hover: none)` desliga hovers que ficariam presos; o feedback vem de `:active`, `:focus-visible`, `aria-pressed` e atributos de estado.
- Gestos nunca mudam sem intenção `state.rate`, `state.zoom` (fora dos controles próprios), `state.playing`, o estado de importação ou o tema. Scrub muda só o tempo, e a rolagem vertical não muda o tempo.

### 12.3 Configurações no celular

- `settings.js` põe `html.cfg-open` ao abrir e tira ao fechar; em `<=900px` isso trava a rolagem do fundo.
- `.cfg` usa `height: 100dvh` em telas estreitas e `.cfg__body` tem rolagem própria, com momentum e overscroll contido.
- O `label` de cada switch tem `for=<id do switch>`, então tocar no texto também alterna.
- Em celular com `pointer: coarse`, `.txt` e `.sel` usam 16 px para o iOS não dar zoom.
- `index.html` e `scope.html` têm `viewport-fit=cover`, e `styles.css` trata as safe areas.

Com o painel aberto, `--cfg-vvh` e `--cfg-vvtop` acompanham `visualViewport.height` e `offsetTop`. Em `<=900px` o painel usa essas variáveis para ficar acima do teclado (sem elas, `100dvh` e `top:0`). Campos focados chamam `scrollIntoView({block:'nearest'})` depois que o viewport assenta. Nesse tamanho, `Tab` fica preso no painel, `aria-modal` acompanha o breakpoint e o foco volta ao elemento anterior ao fechar. `panelTimer` é cancelado ao reabrir, para um fechamento antigo não esconder o painel.

### 12.4 Troca de mídia

`app.js` usa `mediaIntent` (a intenção mais recente de trocar a mídia) e `activeDecodeIntent` (a decodificação que controla a barra de carregamento):

- arquivo local e importação remota criam uma nova intenção, e `ingest(blob, ..., intent)` só aplica o resultado se `intent === mediaIntent`; uma decodificação antiga devolve `null`;
- se já havia faixa carregada, uma falha de decodificação a mantém. Não voltar a pôr `state.loaded = false` sem condição no `catch` de `ingest()`;
- só numa troca bem-sucedida o áudio anterior é pausado e `state.playing` e o botão Play são acertados.

Isso evita três problemas antigos: arquivo inválido apagando a tela, duas decodificações concorrentes e o botão Play preso depois da troca de `src`.

### 12.5 Barra de link

`linkUI.op` identifica a operação atual; `analyzeUrl`, o download, o progresso e os timers só mexem na interface se o `op` ainda for o atual. `linkAbort()` aborta o `AbortController`, incrementa `linkUI.op`, incrementa também `mediaIntent` se a fase era `import` (porque `decodeAudioData()` não é cancelado pelo abort) e restaura `aria-busy`, controles e osciloscópio. Sem invalidar `mediaIntent`, fechar a barra durante "Decodificando" carregaria o áudio pouco depois. `linkSettle(op)` também confere o `op`, para um "Pronto" antigo não esconder a barra de uma nova análise.

### 12.6 Arquivos e colagem

- O `<input type=file>` é limpo depois de ler o `File`, para permitir escolher o mesmo arquivo de novo.
- O overlay de arrastar só reage quando `DataTransfer.types` contém `Files`.
- Escolher ou soltar um arquivo local durante um download cancela o download.
- A análise automática só dispara no `input` que veio de colar, e qualquer digitação depois cancela o timer de 180 ms. `#url` tem `maxlength=8192`.
- O nome do WAV é limpo e cortado em 176 caracteres e evita nomes reservados do Windows; `server/main.py` limita o título de `Content-Disposition` a 180 caracteres.

## 13. Visualização de áudio

- `app.js` cria um único `MediaElementSource`. Um `ChannelSplitterNode` alimenta analisadores L/R só para leitura visual.
- `scope.visualizer='vectorscope'` é o modo inicial e `waveform` mantém o osciloscópio clássico.
- `Core.stereoVectorPoint()` faz a rotação ortonormal L/R para Side/Mid: mono fica vertical e diferença de fase abre o eixo horizontal. `Core.stereoVectorStride()` limita os pontos por quadro conforme a área do canvas.
- `ScopeView` usa `lighter` para as partículas e `destination-out` para o rastro, sem simular milhares de objetos. O último par de buffers fica congelado ao pausar e é redesenhado depois de um resize.
- `scope.vectorTrail`, `scope.vectorSize` e `scope.vectorDensity` são só visuais. A cor vem de `--text`, sem configuração própria.
- Cabeçalho, modo foco e janela separada usam `compactHorizontal`, que gira a projeção para o eixo principal ocupar a largura; o osciloscópio clássico não passa por isso.
- A miniatura do cabeçalho mede até `136 × 28 CSS px` no desktop e diminui por breakpoint. Ela é `flex:none` com `max-width` e `overflow:hidden`, e `.hdr__filename` tem `min-width:0`, para títulos longos não estourarem.

## 14. Biblioteca e grafo

### 14.1 Dados

- `library.js` guarda categorias pessoais em `varispeed.library.categories.v1`, com IDs prefixados por `category:custom:`. Cada música guarda um único `categoryId` no registro antigo, sem mudar o formato do IndexedDB.
- Toda categoria (`Favoritas` ou pessoal) tem uma ligação estrutural de mesma distância com `Biblioteca`, e cada música tem uma mola com sua categoria principal. Uma música categorizada e favorita ganha uma ligação `kind: affinity` só visual: `layout: false` a tira do posicionamento inicial e `physics: false` a tira das molas e do grau físico do nó.
- Excluir uma categoria pede confirmação com o número de músicas afetadas, que voltam para `Biblioteca` (`categoryId: ''`) e nunca são apagadas.
- Criar e renomear usam `#libraryCategoryDialog`; associar usa `#libraryCategorySelect` no painel. `Biblioteca` e `Favoritas` são fixas.

### 14.2 Tutorial

- `#libraryTutorial` é um modal de quatro etapas sobre a Biblioteca inteira. A rede SVG é só ilustração e não passa por `GraphEngine`, `items`, `categories`, IndexedDB nem `graphData()`.
- `.library-tutorial__camera` reenquadra a ilustração e os grupos `core`, `music`, `categories` e `growth` acumulam a topologia. Rótulos, pulsos e a trilha são apresentação; não trocar por nós reais nem ligar a cena à física.
- `library.alwaysShowGuide` é do schema de `settings.js`. Ligado, `tutorialWasSeen()` ignora a marca salva e a dispensa da sessão.
- A conclusão fica em `varispeed.library.tutorial.v1`. Chegar ao fim, `Pular tutorial` ou `Escape` marcam como visto; fechar a Biblioteca por fora chama `closeTutorial({ remember: false })`.
- Textos e estado ficam em `TUTORIAL_STEPS`; o HTML tem só o conteúdo inicial para acessibilidade e primeiro paint.
- `Motion.reduced()` alimenta `data-reduced`, junto com `prefers-reduced-motion`, e nesses modos não roda animação estrutural.
- Com o tutorial aberto, `Tab` fica nos botões dele e as setas mudam de etapa.

### 14.3 Interação

- O SVG raiz, que `setData()` não reconstrói, guarda a captura do ponteiro durante pan e arraste. Não capturar no `<g>` do nó, que é descartado quando os dados mudam.
- Se `library.js` atualizar nós ou ligações durante um gesto, `setData()` espera o fim da interação.
- `lostpointercapture`, `pointercancel`, perda de foco da janela e página oculta soltam nós fixados e limpam o gesto.
- Foco, enquadramento e resize enfileirados são cancelados ao ocultar ou reabrir a Biblioteca e nunca passam na frente de um arraste.
- A engine pausa fora da Biblioteca e volta ao entrar. O `ResizeObserver` nunca troca `W/H` válidos por zero com o host oculto; na reabertura, `library.js` chama `resize()` antes de retomar e reconstruir.
- Posições antigas só são reaproveitadas com `x/y` finitos; nós sem viewport esperam uma medição visível, e a câmera tem uma última barreira contra `NaN`.
- `Motion.marquee()` cuida de títulos longos no cabeçalho, no detalhe e em `#sName` (Fonte), por overflow real; `GraphEngine` usa `nodeLabelMaxWidth` com clip SVG no texto dos nós. O marquee não entra na física, o título continua clicável, nomes curtos não animam e `reduceMotion` desliga o movimento.
- O atalho global de teclado de `app.js` ignora controles interativos: Espaço continua digitável em `#librarySearch` e não toca o áudio ao acionar um nó ou botão. Depois de um clique com ponteiro, Play/Pause prevalece e o clique nativo por Espaço é cancelado; com navegação por `Tab`, o botão focado mantém a ativação normal. A exceção não vale para inputs, selects, sliders, menus abertos nem Configurações.
- Estado da música no editor: a linha recebe `.is-active` e, tocando, `.is-playing`. `.library__track-indicator` fica sobre a capa com barras (`.library__track-eq`) ou pausa (`.library__track-paused`), e a etiqueta diz `TOCANDO` ou `PAUSADO`, com a estrela de favorita ao lado. No mapa, `isNodeLoaded` marca a categoria com a classe `loaded` (anel parado) e `isNodePlaying` com `playing` (anel pulsando); `loaded` só vale quando não está tocando.
- `#libraryTransport` é só uma segunda interface para o áudio carregado: é a barra de baixo da Biblioteca, na mesma posição e com a mesma aparência da barra do editor, e aparece só com áudio carregado; compartilha play/pause, stop, loop, posição e duração com o editor e nunca cria nem reinicia uma fonte. Play, Stop, Loop e o scrub são clonados dos controles oficiais para os respectivos `.ui-slot`; não manter cópias manuais de marcação ou SVG.
- `bindScrub()` é o binder único dos scrubs do editor, da Biblioteca e do modo foco, e `syncScrubPosition()` atualiza o progresso de todos. Os passos de velocidade do modo foco são clones de `#rateDown` e `#rateUp` e usam `bindRateStep()`.
- O detalhe usa `item.thumbnail` direto, sem novo cache, e `byline` como subtítulo abaixo do título, sem mensagem de disponibilidade. A duração na velocidade salva é `duration / (rate / 100)`. Em `<=520px` ou altura `<=680px`, a capa some para priorizar os controles.
- `Fonte` usa o mesmo `.library__detail-artwork` e a thumbnail de `state.meta`, sem download ou cache paralelo; sem URL ou com erro, `#sourceArtwork` fica oculto e não ocupa espaço.
- Ícones com o mesmo significado apontam para um único `<symbol>` da sprite (por exemplo `#ui-icon-close`), e um símbolo não é usado para outra ação.

### 14.4 Contrato de desempenho do GraphEngine

A física usa os parâmetros da engine de origem; otimizações não mudam equações, constantes de força, `restingAlpha`, `floatForce`, `floatSpeed`, colisão nem decay. Os contratos abaixo têm testes em `tests/graph-engine.test.js`.

Colisão:

- Uma grade espacial do tamanho do maior raio físico mais o espaçamento de `44 px` gera candidatos só nas células vizinhas, e `_collisionCandidateIndices()` devolve a ordem crescente `i/j` antes da fórmula original. A grade é só filtro e tem teste contra falso negativo, duplicação e reordenação.
- A rejeição por eixo vem antes de `Math.hypot()` e só descarta pares que não podem se sobrepor.

Dados e posicionamento:

- `_dataSignature` deixa `setData()` ignorar reconstruções idênticas, mantendo `resetLayout()` e o reaquecimento.
- `_graphPhysics` guarda valores invariáveis recalculados em `_reindex()`; toda mudança estrutural passa por esse cache.
- `_initializeNodePositions()` põe `root` no centro, cada categoria na distância da sua ligação e as músicas em volta do `root` ou da categoria a que estão ligadas. Grupos acima de `initialRingCapacity` usam anéis extras via `nodeRingGap`, e nenhuma posição é fixada.
- Em atualizações, as posições de `root` e categorias alimentam `spawnAnchors`. `_categorySpawnAngle()` põe a categoria nova no maior intervalo angular, desempatando pela distância real aos nós; não voltar a calcular pelo índice da lista.
- Perfil adaptado do Obsidian: músicas com distância/força `198/0,44`, categorias `520/0,52`, cargas `420/250/175` para root, categoria e música, e coesão central por papel (`0,20`, `0,028–0,030`, `0,010–0,011`).
- `_graphDragRecovery` é temporário, nasce em `_releaseDraggedNode()` só para categorias, reduz o pico de `alpha` e mistura a reação das músicas do hub entre `24%` e `100%`. Não injeta velocidade mínima, não impõe limite rígido nem zera o componente radial, some depois de estabilizar ou do timeout e nunca é salvo.

Câmera e zoom:

- Roda, touchpad e pinça acumulam deltas; câmera, física e pintura usam um único `requestAnimationFrame`. Não criar outro loop de câmera nem medir host e painéis a cada evento.
- `_handleWheel()` separa os gestos: roda do mouse dá zoom; pinça no touchpad chega com `ctrlKey` e dá zoom; rolagem com `deltaX` move o mapa, e o gesto continua movendo até uma pausa de `180 ms`. `deltaMode` em linhas ou páginas é convertido para pixels.
- O zoom é ancorado: `_updateZoomTarget()` guarda em `zoomAnchor` o ponto do grafo que está sob o cursor na câmera atual, e `_stepCamera()` anima só a escala e deriva `x/y` dela. O ponto sob o cursor fica parado em todos os quadros, mesmo com vários giros seguidos. Foco, enquadramento, pan e `stopCameraAnimation()` limpam a âncora.
- Dois dedos no mapa viram pinça (`_beginPinch()`, captura no SVG em fase de captura). O ponto entre os dedos acompanha o meio deles e a distância define a escala; ao tirar um dedo, o outro continua arrastando.
- `_constrainCamera()` mantém o grafo visível usando `_contentBounds()` (raio e nome de cada nó): inteiro quando cabe na área útil, ou cobrindo `75%` dela quando é maior, com margem de até `24 px`. Durante o arrasto o mapa passa do limite com resistência; ao soltar, a inércia freia mais rápido fora do limite e a mola leva de volta. Wheel-pan para seco na borda. Acompanhamento de nó não é limitado.
- Inércia: `_panVelocity()` mede os últimos `90 ms` do arrasto; se o ponteiro parou mais de `50 ms` antes de soltar, ou com `reduceMotion`, não há inércia. `panGlide` decai com `τ = 180 ms` e acaba abaixo de `30 px/s`.
- Quando o host muda de tamanho, `resize()` desloca câmera, alvo e âncora pela diferença do centro útil no mesmo quadro. Ao abrir a lista, o mapa encolhe sem o conteúdo sumir atrás dela; o foco só anima o zoom.
- `fitGraph()` usa `_contentBounds()`, então nomes e contagens entram no enquadramento; `fitPadding` caiu de `84` para `48` por isso.
- `zoomBy()` só chama `getVisibleViewport()` sem âncora explícita. `hostOrigin` é atualizado no `resize()` visível; `getBoundingClientRect()` na roda só vale antes da primeira medição.
- A Biblioteca usa `minFitZoom: 0.68`, e o `minZoom` manual continua menor para a visão geral.
- Ao selecionar um nó, a câmera espera dois quadros para o painel ocupar espaço, usa o viewport útil, aplica zoom mínimo de `1.35` e passa `followDuration: Infinity` enquanto houver seleção. Selecionar de novo o mesmo nó não faz nada enquanto o acompanhamento está ativo, e o `pointerdown` só cancela a câmera depois de passar do limite de arraste. `closeDetails()` remove o painel antes de enfileirar `fitGraph()`, que encerra o acompanhamento sem salto; roda, pan e saída da Biblioteca também cancelam.
- `cameraSpringMs: 150` é uma mola criticamente amortecida analítica, que chega ao alvo sem passar dele e substitui o salto em dois quadros e a espera fixa de `72 ms`.

Pintura:

- As ligações ficam em `.graph-engine-links-canvas`, atrás do SVG `.graph-engine-nodes-svg`. `_renderLinks()` projeta os pontos em coordenadas de tela, descarta segmentos fora da tela e agrupa por cor, opacidade e tracejado; `maxLinkPixelRatio: 2` limita o backing store. Não voltar a um `<line>` por ligação.
- `_renderPositions()` interpola o último passo físico, move os nós antes de desenhar o Canvas e grava `_graphRenderedX/Y` como retrato visual, que as ligações usam. Um nó com `fx/fy` é imediato, sem interpolação. Só a serialização visual é arredondada a centésimos de pixel; `node.x/y/vx/vy` não.
- `applyCamera()` só afeta o SVG dos nós: até `vectorCameraEnterScale: 1.16` escreve a transformação em `world`; no zoom próximo, normaliza o mundo e usa `viewBox`, voltando abaixo de `vectorCameraExitScale: 1.04`. O Canvas usa `camera.x/y/scale` direto. Os caches `_graphCamera`/`_graphViewBox` ficam, e `style.transform` não é reescrito quando nada mudou.
- A física roda a `physicsHz: 60` ativa e `restingPhysicsHz: 30` quando `alpha`, arraste e recuperação permitem; forças, retenção de velocidade e decay são normalizados pelo passo.
- `_labelWidthCache` evita repetir `getComputedTextLength()` para o mesmo título e largura.
- Há um único `ResizeObserver`, da engine; os consumidores usam `onResize`.

Diagnóstico:

- O retrato de desempenho inclui latência, intervalo, custo e resposta do zoom, atraso de entrada, quadros perdidos estimados por múltiplos do refresh e long tasks. É só observação e alimenta Configurações → Diagnóstico.
- `startPerformanceCapture()` soma intervalos reais de `requestAnimationFrame` e os custos de física, render e câmera. O relatório traz média, p95 e máximo, estima o orçamento pela mediana, marca quadros acima de `1,5×`, conta múltiplos e observa Long Tasks quando a API existe.
- `MediaLibrary.measurePerformance()` fecha o painel enquanto o usuário usa o grafo e reabre com um relatório copiável. A captura não salva dados, não cria nós falsos e não muda forças. `MediaLibrary.performance` devolve uma cópia, nunca o objeto interno.

## 15. Compatibilidade

- O nome visível é VARISPEED em todo lugar (título, janela do osciloscópio, mensagens e backend). `start-tempo.bat` e `start-tempo.sh` mantêm o nome antigo, mas os logs usam `[VARISPEED]`.
- O protocolo `tempo:*`, `tempo.cfg.v1` e `tempo.lastRate` continuam com o nome antigo para não quebrar preferências e sessões.
- O backend prefere `VARISPEED_COOKIES_FILE` e `VARISPEED_MAX_DURATION_SECONDS`, mas aceita `TEMPO_COOKIES_FILE` e `TEMPO_MAX_DURATION_SECONDS`. Não remover os apelidos sem migração.
- O antigo `providers.js` não existe mais; uma cópia que o tenha é anterior à migração para o `yt-dlp`.

## 16. Testes e validação

### 16.1 Testes automáticos

```bash
node --test tests/*.test.js
python -m unittest discover -s tests -p "test_*.py"
```

Os testes de Python precisam das dependências de `server/requirements.txt`.

- `tests/legacy-snapshot.js` é uma cópia literal das funções que ficavam em `app.js`, com `cfg()`, `state` e `W` injetados por um objeto `CTX`. Serve de referência de equivalência: quando `core.js` muda de propósito, a diferença aparece ali primeiro, e aí se atualiza o snapshot e se registra a decisão.
- `tests/core.test.js` tem dois blocos. Os testes de equivalência comparam `core.js` com o snapshot numa malha de entradas (três unidades, três formatos de tempo, DPR de 0.5 a 3 com larguras fracionárias e mais de mil combinações de nome, modelo e velocidade). Os testes de contrato continuam valendo sem o snapshot: ida e volta da velocidade entre texto e número, `100%` neutro nas três unidades, sinal U+2212 em semitons, `xToSrc` e `srcToX` inversos, janela nunca além do fim da mídia, erro do backing store de no máximo meio pixel físico, nome exportado sempre válido no Windows (sem caractere ilegal, ponto ou espaço final, nome reservado nem corte no meio de um caractere multibyte em 176 code points) e `NaN`, `Infinity` ou negativo nunca chegando à interface.
- `tests/graph-engine.test.js` cobre os contratos da seção 14.4, e `tests/library-model.test.js` as projeções da Biblioteca.
- `tests/ui-controls.test.js`, `tests/ui-export.test.js` e `tests/ui-policy.test.js` cobrem velocidade, exportação, navegação das Configurações, switches, ajudas e a regra de foco sem outline. `tests/cookie-exporter.test.js` cobre a extensão de cookies.
- `tests/test_validate_url.py` cobre a barreira de SSRF: esquemas recusados, nomes locais, IP privado literal (inclusive `169.254.169.254` e CGNAT), domínio público que resolve para IP privado, vários registros DNS com um privado no meio, falha de resolução e porta padrão por esquema. `socket.getaddrinfo` é substituído e nada toca a rede. Um teste registra a limitação conhecida de DNS rebinding: a função devolve o nome, não o IP aprovado, e o `yt-dlp` resolve de novo. Portas inválidas devolvem `400`.
- `tests/test_response_headers.py` fixa o `no-store` da API, a revalidação da interface, as políticas específicas de rota e os headers de segurança.
- `tests/test_browser_auth.py`, `tests/test_dedicated_auth.py`, `tests/test_ytdlp_auth.py` e `tests/test_youtube_pot.py` cobrem a autenticação e o PO Token.
- `python3 tests/run-ui-browser.py` testa 18 interações por largura no Firefox, com backend simulado e perfil temporário.

Outros comandos:

```bash
node --check app.js            # e os demais scripts listados no CI
python -m py_compile launcher.py server/main.py server/browser_auth.py server/dedicated_auth.py server/youtube_pot.py server/ytdlp_update.py server/relaunch.py
python -m ruff check launcher.py server tests
python -m uvicorn server.main:app --host 0.0.0.0 --port 8765
```

No Windows, antes de validar o backend, confirme que `py --version` ou `python --version` encontra um Python válido.

### 16.2 Depois de mexer na importação por link

1. Iniciar pelo `start-tempo` e confirmar que `/api/health` responde.
2. Abrir a interface, colar uma URL válida e ver `Obtendo informações` e a prévia.
3. Confirmar que o download não começa antes de Importar áudio.
4. Importar e ver `Baixando áudio`, a porcentagem real quando houver `Content-Length`, `Decodificando` e a waveform.
5. Tocar, mudar a velocidade (o pitch muda junto) e exportar WAV.
6. Cancelar ou fechar sem quebrar a interface.
7. Ver erro legível para URL inválida, recusa de `http://127.0.0.1/...` e instrução clara com o backend desligado.
8. Confirmar que o arquivo local ainda funciona sem passar pela API.

### 16.3 Estados e concorrência

1. Tocar a faixa A e tentar importar um arquivo inválido: A continua usável.
2. Cancelar uma importação remota em "Baixando" e em "Decodificando": a mídia não entra depois.
3. Iniciar uma importação remota e soltar um arquivo local: o local vence.
4. Importar a URL A, carregar um arquivo local e analisar A de novo: o botão volta a habilitar.
5. Importar a URL A e apertar Enter de novo: não reimporta.
6. Escolher o mesmo arquivo local duas vezes: o segundo `change` funciona.
7. Colar uma URL e continuar digitando: a análise automática antiga é cancelada.
8. Abrir, fechar e reabrir as Configurações rápido: o painel não some.
9. Abrir o teclado num campo perto do fim das Configurações: campo e rodapé continuam acessíveis.
10. Testar nome de exportação longo ou reservado e preset JSON inválido.

### 16.4 Regressão geral

WAV e MP3 locais; arrastar e soltar; play, pause, stop e loop; scrub; zoom; presets; volume; tema claro e escuro só pelas Configurações; modo foco; janela separada à esquerda do visualizador; exportação; movimento reduzido; menu Importar abrindo e fechando, com Arquivo local chamando o seletor e Link abrindo a barra; ausência de `btnLink`, `themeLight` e `themeDark` no cabeçalho.

### 16.5 Celular, escala e monitores

- Em aparelho real: toque e arraste horizontal na waveform, rolagem começando sobre ela, sliders, abrir e fechar Importar, fechar a barra de link, rolar as Configurações até os créditos e abrir o teclado nos campos.
- Windows a 100%, 125% e 150% com zoom do navegador em 80%, 90%, 100%, 110%, 125% e 150%, conferindo waveform, régua, playhead, osciloscópio integrado, modo foco e janela separada, barra de link, Configurações, presets, sliders e transições de breakpoint.
- Mover a janela entre monitores com escalas diferentes e conferir o osciloscópio integrado e a janela separada, sem perder áudio nem zoom.
- Carregar áudio, aplicar zoom, buscar uma posição, tocar, redimensionar ou girar a tela e confirmar que nada reinicia.

## 17. Mapa de impacto

| Mudança | Arquivos principais | Risco |
|---|---|---|
| texto ou layout da prévia | `index.html`, `styles.css` | baixo |
| fluxo de analisar e importar | `app.js` | médio |
| protocolo HTTP do frontend | `remote-import.js` | médio |
| opções do `yt-dlp` | `server/main.py` | médio a alto |
| codecs e normalização | `server/main.py`, `app.js` | alto |
| pitch e velocidade | `app.js` | crítico |
| waveform | `app.js` | alto |
| exportação WAV | `app.js` | alto |
| osciloscópio | `scope-*`, `app.js` | alto |
| publicação na internet | backend e infraestrutura | crítico |

`app.js` é grande e concentra muita coisa. Ao mexer na importação remota, não alterar `ingest()` sem necessidade, a exportação WAV, o cálculo dos picos, o `playbackRate` nem o osciloscópio. Mudanças de rede ficam em `remote-import.js` e a interface do link na parte própria de `app.js`.

## 18. O que não fazer

- Reintroduzir providers CORS para o YouTube ou extrair streams assinados em JavaScript.
- Colocar o `yt-dlp` no navegador.
- Converter tudo para WAV no servidor.
- Habilitar playlists sem uma interface feita para isso.
- Guardar cookies no repositório.
- Preservar o pitch.
- Reescrever o app num framework só por causa do backend.
- Remover a importação local.
- Adicionar npm para uma função pequena sem justificar a mudança de arquitetura.

## 19. Evoluções possíveis

Se forem pedidas, fazem sentido:

1. Progresso real do `yt-dlp` no servidor, com jobs e SSE, WebSocket ou um endpoint de progresso. O `yt-dlp` tem progress hooks, mas a interface ainda não os recebe.
2. Cancelamento real no servidor, com downloads em subprocessos ou jobs identificáveis e encerráveis.
3. Alternativa de codec: se `decodeAudioData()` falhar, oferecer um reprocessamento compatível via FFmpeg.
4. Cache temporário curto, para não extrair e baixar de novo quando a mesma URL é reimportada logo em seguida, com TTL e tamanho definidos.
5. Token entre `/info` e `/audio`, para não repetir a URL e parte da extração.
6. Publicação na internet, só com as proteções da seção 5.5.

## 20. Site de apresentação

O site fica no repositório separado `nehalem-x/VARISPEED-site`, com dependências e build próprios. No grafo de demonstração, o palco captura a roda em modo não passivo, bloqueia a rolagem da página e manda o delta direto para `GraphEngine.zoomBy`, com o cursor como âncora. `.graph-stage` mantém `overscroll-behavior: contain` e `touch-action: none` para preservar essa fronteira.
