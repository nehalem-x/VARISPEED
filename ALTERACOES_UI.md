# Alterações de UI integradas ao VARISPEED

O workspace `/caminho/para/VARISPEED` agora contém o clone completo de `https://github.com/nehalem-x/VARISPEED.git`, baseado em `4dfdef8`, na branch local `ui/padronizacao`. As alterações estão nos arquivos reais do projeto; nenhum código foi enviado ao GitHub.

## Resultado

- Editor vazio com ação explícita de importação. Depois de carregar, comparação de duração original/saída e indicação de velocidade e tom.
- Dados da fonte recolhidos e resumo de nome, formato, profundidade e normalização junto à exportação. A saída conserva os ajustes confirmados no início da operação.
- Transporte compartilhado entre editor, Biblioteca e modo foco; ciclo de Tab, isolamento do fundo e retorno de foco nos contextos modais.
- Importação por link com etapas explícitas, cancelamento nomeado e retorno ao campo.
- Tokens comuns de tipografia, espaçamento, dimensões e estados. Hover condicionado ao ponteiro; seleção persistente; carregamento legível; botões de 44 px em toque.
- Erros junto aos campos de velocidade, presets, links e categorias. Uma entrada inválida de velocidade conserva o texto editável e o último ajuste válido do áudio.

## Integração com a versão atual

As alterações anteriores foram conciliadas com o clone por comparação de três versões. Foram preservadas as correções atuais de foco após clique de ponteiro, tratamento de Espaço na Biblioteca, artwork nas linhas da lista, opções nativas de selects, safe areas e layout da importação em toque. Backend, motor de áudio, grafo e assets originais foram mantidos.

A indicação de foco de teclado reforça a borda ou superfície existente, sem contorno externo, aumento de espessura ou deslocamento. Linhas da Biblioteca preservam o foco interno na borda já reservada. O teste de política de UI foi atualizado para esse contrato. A edição por teclado e a liberação de foco após ativação por ponteiro continuam com os testes originais.

O material da cópia parcial foi preservado em `/caminho/para/VARISPEED-backup-ui-20261004`. Os patches antigos e a prévia simulada foram retirados do workspace principal para evitar confusão com o projeto real.

## Verificação

- 86 testes JavaScript passaram, incluindo os testes originais de lógica, grafo, Biblioteca, política de interação e os novos testes de velocidade/exportação.
- 46 testes Python passaram. Lint Ruff, consistência das dependências e validação HTML passaram.
- Sintaxe de todos os scripts do app e `git diff --check` passaram.
- Chromium acessou o servidor real em 1280 e 390 px: inicialização, mascote carregada, importação WAV local, reprodução/pausa, velocidade inválida preservando o ajuste, exportação WAV, validação de presets e ausência de overflow horizontal. Não houve exceções JavaScript.
- Um WAV estéreo de 2 segundos a 125% foi exportado com duração de 1,6 segundo. A importação e a exportação locais não fizeram requisições aos endpoints de mídia do backend.
- Capturas dos estados vazio/carregado e temas claro/escuro estão em `/tmp/varispeed-real-*.png`. O relatório do navegador está em `/tmp/varispeed-real-browser-report.json`.

Reproduzir as verificações do repositório:

```sh
node --test tests/*.test.js
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
.venv/bin/python -m ruff check launcher.py server tests
.venv/bin/python -m pip check
npx --yes html-validate@10.4.0 index.html startup.html scope.html
```

O runner `python3 tests/run-ui-browser.py` verifica 18 interações por largura no Firefox usando backend simulado e perfil temporário. É uma verificação adicional de frontend, separada da execução integrada em Chromium.

## Executar

O servidor local foi iniciado em `http://127.0.0.1:8765/`, usando o backend real. Para iniciar novamente:

```sh
cd /caminho/para/VARISPEED
.venv/bin/python -m uvicorn server.main:app --host 127.0.0.1 --port 8765
```

O launcher original `start-tempo.sh` também está disponível e publica na rede local conforme sua configuração original. Os retratos pessoais dos créditos são opcionais e não fazem parte do repositório público.

Não foram repetidos download de plataforma externa, autenticação real, desligamento do sistema ou verificação com leitor de tela. Os testes Python cobrem as regras correspondentes do backend; isso não equivale a validar uma sessão externa real.

## Refinamento do cabeçalho da Biblioteca

Título e contagem juntos; busca ampla antes das ações; criar categoria por superfície e retorno ao editor com menor peso. Navegação do mapa identificada por “Explorar”, sem a orientação textual adicional. Em telas menores, a busca ocupa uma segunda linha. A altura da navegação acompanha a densidade e as áreas do grafo/detalhes seguem esse mesmo token. Os botões de zoom/centralização do mapa foram removidos por `showControls: false`. Os contornos externos de foco foram removidos de todos os controles conforme solicitado.

As frases “SELECIONE UM PONTO PARA EXPLORAR” e “Mais lento e mais grave. A duração aumenta.” foram removidas conforme solicitado. O cabeçalho foi conferido em 320, 390, 768, 1024 e 1840 px: sem botões do grafo, contornos externos ou overflow; criar categoria, navegar e voltar ao editor continuam funcionando.

A mensagem de orientação do editor vazio foi removida. O visualizador de áudio permanece no cabeçalho: a regra que o ocultava na Biblioteca abaixo de 520 px foi retirada. Verificação em 390, 768 e 1840 px confirmou visualizador e botão de janela visíveis, canvas dimensionado e modo foco funcionando no editor e na Biblioteca.

Campos, dropdowns, botões e caixas de interface passaram a usar cantos retos (`--radius: 0`), incluindo ajuda e créditos. O estilo computado de todos os controles montados foi conferido no navegador, sem arredondamento.


## Revisão de poluição visual por bordas

| Área | Problema encontrado | Tratamento aplicado |
| --- | --- | --- |
| Botões | Molduras em cada ação, incluindo hover e seleção de ações auxiliares | Superfície nos botões comuns; ghost transparente; foco com uma linha inferior |
| Campos e dropdowns | Risco de contorno externo somado à borda do campo | Uma borda funcional, com espessura estável; interação por cor; disabled atenuado |
| Presets e passos | Grupo fragmentado em caixas individuais | Superfície compartilhada, sem molduras individuais |
| Biblioteca | Cabeçalho, toolbar e ajuda acumulavam divisórias | Espaçamento e superfície; linhas discretas entre faixas; foco com linha lateral |
| Detalhes da faixa | Capa e metadados enquadrados; divisória em cada informação | Capa sem moldura; duração/velocidade por superfície; metadados por alinhamento e espaço |
| Editor e configurações | Divisórias redundantes entre painéis, navegação, ajuda e diagnóstico | Resultado e navegação por fundo; removidas linhas e molduras redundantes |
| Modal de categoria | Moldura externa e linhas internas nas duas extremidades | Preservada a borda externa; organização interna por espaçamento |

Preservadas as bordas dos campos, switches, menus flutuantes e modal, a separação do painel lateral e as divisórias dos rodapés fixos. Nenhum estado acrescenta outline/ring ou altera a espessura da borda. Cantos continuam retos.

O detalhe da faixa também recebeu título completo, capa em proporção fixa, categoria em campo amplo e ações com rótulos. O corpo agora usa fluxo vertical sem comprimir a capa sobre os metadados. Conteúdo longo permanece rolável, com ações fixas no rodapé.

Removida a orientação “1. Cole o link · 2. Confira o áudio · 3. Importe para o editor”; o elemento associado ao campo permanece oculto para preservar a referência acessível.

Conferência em Chromium, com backend real, nas larguras 320, 390, 768, 1024 e 1840 px, nos dois temas: controles sem arredondamento ou outline, foco sem mudança de dimensão, capa sem sobreposição aos rótulos, favoritos e modal de categoria funcionando, sem overflow horizontal ou exceções JavaScript. Relatório em `/tmp/varispeed-borders-report.json` e capturas em `/tmp/varispeed-borders-*.png`.

A verificação integrada de importação WAV, reprodução, velocidade e exportação foi repetida em 390 e 1280 px. Os 86 testes JavaScript passaram, assim como a validação HTML.


## Seletor Explorar no cabeçalho

O seletor de mapa/categoria foi movido para o grupo de ações do cabeçalho, junto de Nova categoria e Voltar ao editor. A faixa exclusiva foi removida, incluindo os deslocamentos que reservavam seu espaço no grafo, na lista e no detalhe da faixa. O identificador do campo e sua associação com o rótulo foram preservados.

Em telas menores, o cabeçalho reorganiza a busca e mantém o seletor junto das ações. Conferência nos dois temas, em 320, 390, 768, 1024 e 1840 px: navegação de categoria, favoritos e modal funcionando; sem overflow horizontal ou exceções JavaScript. Os 86 testes JavaScript e a validação HTML passaram.


## Ordenação no cabeçalho

Ordenar agora acompanha Explorar, Nova categoria e Voltar ao editor no cabeçalho. A faixa de ordenação e o rótulo FAIXAS foram removidos; as linhas da grade foram ajustadas para a lista ocupar o espaço liberado e manter a ajuda no rodapé. Os quatro critérios e o identificador do campo foram preservados. Em telas pequenas, os dois dropdowns ficam lado a lado, com ações abaixo, sem faixa exclusiva.

Conferidos os dois temas em cinco larguras, ordenação por título, troca de critério, retorno ao mapa e lista vazia. Os 86 testes JavaScript e a validação HTML passaram.


As instruções de teclado abaixo da lista (selecionar, Enter abrir e Esc voltar) foram removidas, junto do rodapé e da referência acessível ao texto. A lista ocupa o espaço restante, sem linha reservada às instruções. Os atalhos continuam funcionando.


## Blur contido em cada faixa

Adicionado `overflow: hidden` à linha da música para recortar a camada ampliada nos limites da própria faixa. Isso elimina a invasão das linhas vizinhas e as faixas de luminosidade causadas pela sobreposição. Preservados o inset negativo, blur de 22 px, escala, máscara, blend e intensidades de cada tema e estado. Conferidos os dois temas em 390 e 1280 px, incluindo hover, abertura dos detalhes e ausência de overflow horizontal.


## Scrollbars padronizadas

O tratamento antes limitado ao inspector e às configurações tornou-se global. Trilho transparente, largura fina e cinza discreto conforme o tema; fallback WebKit de 6 px. O mesmo padrão foi aplicado ao diagnóstico da inicialização. Removida a borda do thumb que simulava uma superfície diferente.

Conferidos estilos computados iguais entre regiões roláveis, rolagem efetiva das configurações e de uma lista com 20 faixas, nos temas claro/escuro e em 390/1280 px. O CSS de inicialização foi conferido em fixture isolada. Testes de política de UI e `git diff --check` passaram.


## Revisão global dos ícones

Consolidados tamanhos de ação em 16 px, chevrons/marcas em 12 px e traços outline em 1,5 px, sem variação de espessura entre estados. Removidos os glifos de texto usados para adicionar, reduzir, remover preset, ajuda, disclosure avançado, favorito na lista e fallback de capa. Ícones estáticos e dinâmicos compartilham o sprite. Menu e presets herdam a cor do controle; setas dos selects seguem a mesma família. Play recebeu ajuste óptico horizontal. Mantidos os símbolos preenchidos do transporte e logos de terceiros.

Conferidos os temas claro/escuro em 390/1280 px: referências SVG válidas, dimensões esperadas, geometria estável no hover, active, selected, focus e disabled; ajuda, disclosure, menu e favoritos funcionando. Os 86 testes JavaScript, validação HTML, sintaxe e `git diff --check` passaram. Repetida a integração de importação local, reprodução e exportação WAV. Relatório em `/tmp/varispeed-icons-report.json`.

Removida também a mensagem “Mais rápido e mais agudo. A duração diminui.” do resumo de velocidade.


## Blur mais claro e amplo

A camada colorida passou a ocupar a largura da faixa, com intensidade de 32% no tema escuro e 18% no claro; hover/foco usam 42%/28%. A máscara agora reserva os últimos 160 px sem cor, com transição nos 140 px anteriores, protegendo duração e velocidade. O hover altera apenas a intensidade. O recorte vertical continua impedindo vazamento entre músicas. Conferência com thumbnail vermelha em 390/1280 px nos dois temas confirmou por amostragem de pixels a região dos metadados no fundo puro do tema e a cor visível antes da transição.


## Blur no painel de detalhes

O painel ganhou uma camada decorativa com a thumbnail da faixa, blur de 32 px e a mesma linguagem de cor da lista (screen/32% no tema escuro; multiply/18% no claro). Uma máscara vertical suaviza o cabeçalho e dissolve a cor antes da organização e das ações. Valores e campo de categoria mantêm suas superfícies; o rodapé usa fundo sólido. A camada não recebe interação, é recortada pelo painel e não ocupa espaço na grade.

A imagem acompanha a seleção e o fundo desaparece para músicas sem thumbnail ou em erro de carregamento. Conferidos troca de faixa, ausência/falha da imagem, favoritos, modal de categoria e layout em 390/1280 px nos dois temas; teste de detalhes também passou em 1840 px. Os 86 testes JavaScript, validação HTML e `git diff --check` passaram. Capturas em `/tmp/varispeed-card-blur-*.png`.


## Nova composição do detalhe da faixa

Hierarquia reorganizada: origem e fechar no cabeçalho compacto; capa em 16:9 com altura limitada; título de 20 px abaixo da imagem; duração e velocidade por tipografia, sem caixas individuais; canais e crédito como apoio; categoria separada por uma única divisória discreta. Ações permanecem fixas no rodapé. O blur do painel foi reduzido para 22%/12% (escuro/claro) e termina antes, mantendo a cor como ambiente da capa. O efeito da lista permanece independente.

Conferidos dois temas em 320, 390, 768, 1024 e 1840 px, títulos longos, ausência de sobreposição/overflow, troca de faixa, imagens ausentes ou com erro, favoritos e criação de categoria. Validação HTML e `git diff --check` passaram. Capturas atualizadas em `/tmp/varispeed-card-blur-*.png` e `/tmp/varispeed-borders-details-*.png`.


## Refinamento da iconografia com Lucide

A família artesanal foi substituída por uma seleção local do Lucide, preservando a geometria original de 24×24 e terminais/junções próprios do conjunto. Tamanhos do controle permanecem estáveis, com tokens de 16/12/32 px e traço proporcional. Importação, exportação, Biblioteca, janela do visualizador e configurações ganharam desenhos semanticamente distintos; disclosures usam chevrons. A janela de áudio passou a usar o mesmo favicon do editor.

Os controles opcionais do GraphEngine também foram revisados e continuam ocultos na Biblioteca. Transportes preenchidos e marcas foram preservados. Licenças ISC/MIT e revisão upstream documentadas; integração por SVG local sem nova dependência de runtime. Conferência global, referências, mapeamento e resultados em [REVISAO_ICONES.md](REVISAO_ICONES.md).


## Refatoração das Configurações e ajudas

Configurações agora apresentam uma seção por vez, com opções agrupadas por contexto. A lista longa e o disclosure Avançado foram substituídos pelo seletor de seção; Sistema, Atalhos e Diagnóstico continuam disponíveis. A conclusão da medição do grafo revela a seção Diagnóstico. O painel preserva a última seção durante a sessão e mantém todos os controles sincronizados. Créditos ganharam uma seção Sobre o VARISPEED.

Painel mais amplo no desktop, hierarquia de títulos/descrições revisada, campos com ritmo consistente e menos divisórias. Switches passaram de tamanho condicionado à densidade para trilho fixo de 36×20 px e knob de 12 px; área de clique 36×28 px ou 44×44 px no toque. Permanecem retos e comunicam estado por posição, superfície e contraste.

As ajudas Sobre cada item ganharam painel contextual, título e fechar. Uma ajuda por vez; a anterior fecha ao trocar item/seção. Fechar devolve o foco ao botão de ajuda. Explicações continuam associadas ao campo e acessíveis mesmo quando o ajuste depende de outro controle.

Conferidos os dois temas em 320, 390, 768, 1280 e 1840 px, as 13 seções, presets, dependências dos campos, switches por clique/teclado, reabertura, salvar preset, restaurar/desfazer e fechar por Escape: sem overflow horizontal ou exceções JavaScript. Os 86 testes JavaScript e a validação HTML passaram. Relatório em `/tmp/varispeed-settings-report.json`; capturas em `/tmp/varispeed-settings-*.png`. Os testes de UI persistentes foram ampliados para navegação, compactação do switch e exclusividade/foco das ajudas.


## Refatoração do painel do editor

Velocidade, Resultado e Arquivo original ganharam uma hierarquia sem numeração decorativa. A leitura de velocidade conserva o campo principal e a linha funcional; passos ficam lado a lado e presets dispensam a faixa preenchida contínua. Resultado destaca a duração de saída e mantém a duração original secundária.

Arquivo original usa capa em componente próprio: imagem nítida em contain, com respiro e uma camada ampliada/desfocada da mesma thumbnail atrás. Blur de 28 px, recortado no componente, com intensidade adequada aos dois temas. A camada acompanha a seleção e é limpa ao carregar um áudio sem thumbnail; não reaproveita estilos do detalhe da Biblioteca.

O nome do arquivo passou a ocupar uma linha inteira com quebra natural, sem ellipsis ou marquee. Os metadados ficam em duas colunas, e o resumo de saída segue essa leitura. Corrigida também a grade intermediária do inspector, eliminando colunas de 1 px antes reservadas às divisórias removidas.

Conferidos escuro/claro em 320, 390, 768, 1024, 1280 e 1840 px, nome longo, troca com/sem capa, recorte e sincronização do blur, ajustes de velocidade, valor inválido preservando o ajuste e exportação WAV. Um áudio local de 2 s a 90% foi exportado em aproximadamente 2,222 s; nenhuma requisição aos endpoints de mídia. Os 86 testes JavaScript, validação HTML, sintaxe e `git diff --check` passaram. Relatório `/tmp/varispeed-inspector-report.json`; capturas `/tmp/varispeed-inspector-*.png`.


## Arquivo original como bloco da Biblioteca

O disclosure de Arquivo original foi substituído por uma seção sempre visível com áudio carregado, sem seta ou controle de expansão. A capa usa a largura disponível, em 16:9 e contain, sem padding nem superfície que a enquadre. O blur foi movido para trás de todo o bloco, com máscara vertical e intensidades 22%/12% nos temas escuro/claro, seguindo o detalhe da Biblioteca. O nome do arquivo ganha hierarquia de título, com leitura completa.

A camada decorativa acompanha a imagem carregada e é desativada ao trocar para um áudio sem capa ou quando a imagem falha. Preservados os dados e a exportação. Os 86 testes JavaScript e a validação HTML passaram; a conferência integrada cobre os dois temas em seis larguras, sem expansão necessária, capa com largura integral, blur no bloco, nomes longos e troca com/sem thumbnail.

O painel do editor também passou a impedir a compressão vertical dos blocos: capa e metadados conservam suas alturas, e o excesso de conteúdo é rolável. A conferência de geometria confirma o nome do arquivo abaixo da capa nos 12 cenários de tema/largura.


## Cabeçalho da Biblioteca e busca expansível

O cabeçalho passou a agrupar Explorar, Ordenar, busca e Nova categoria; Voltar ao editor é uma ação separada. Dropdowns mais compactos e reorganização responsiva deixam a identificação da Biblioteca respirar. A busca começa como uma lupa, sem campo amplo permanente; ao ativar, expande sua largura até 240 px em 220 ms e revela o input com transição de opacidade. Preferências de movimento reduzido continuam respeitadas.

O botão expõe `aria-expanded`/`aria-controls`; conteúdo recolhido fica inert e fora da navegação de teclado. Abrir foca o campo; fechar/limpar ou Escape recolhe, limpa o filtro e devolve foco à lupa. Ctrl/Cmd+F abre a busca dentro da Biblioteca. Sair de uma busca vazia a recolhe; filtro preenchido permanece visível. O retorno do tutorial também aponta para a lupa.

Conferidos dois temas em 320, 390, 768, 1024, 1280 e 1840 px: expansão limitada, busca filtrando, Escape preservando a Biblioteca, abertura por teclado, limpar/fechar, categoria, ordenação e retorno ao editor, sem overflow horizontal ou exceções JavaScript. Os 86 testes JavaScript e a validação HTML passaram. Relatório `/tmp/varispeed-library-header-report.json`; capturas `/tmp/varispeed-library-header-*.png`.


## Rodada de bordas contextualizadas nos botões

Criada a variante `.btn--outline` para ações independentes: Nova categoria, Analisar link, Salvar preset, Copiar endereço e Copiar relatório. Importar com áudio carregado recebe contorno discreto; no editor vazio mantém a apresentação primária. A base global dos botões não recebeu borda visível indiscriminadamente.

Presets e tokens das Configurações ficaram sem caixas preenchidas permanentes; adicionar preset mantém o tratamento leve. A busca expandida conserva apenas a borda do campo, sem linha de foco extra nos botões internos. Ajuda e lupa continuam sem fundo quadrado. Cancelar, fechar, favoritar, ações embutidas e grupos permanecem leves.

Contornos mantêm 1 px em default, hover, active, focus e disabled. Foco reforça a própria borda, sem outline/ring; disabled atenua o contorno. O teste de política de UI foi corrigido para identificar declarações CSS de outline, sem confundir o nome da variante `.btn--outline:focus-visible` com uma propriedade.

Conferência nos dois temas em 390, 1280 e 1840 px: dimensões e espessura estáveis, foco por borda única, ajuda sem caixa, busca sem moldura interna, categoria e importação por link funcionando, sem overflow horizontal ou exceções JavaScript. Os 86 testes JavaScript e validação HTML passaram. Relatório em `/tmp/varispeed-button-borders-report.json`; capturas em `/tmp/varispeed-button-borders-*.png`.


Botões de ação agora mostram uma borda discreta de 1 px no hover, com contraste maior ao pressionar. A borda já ocupa espaço no estado normal, evitando deslocamento. Ajudas, lupa, botões internos da busca, presets e tokens mantêm contornos transparentes para não criar caixas dentro de grupos. Conferidos temas claro/escuro, dimensão estável e ajuda sem caixa. Capturas `/tmp/varispeed-button-hover-*.png`.
