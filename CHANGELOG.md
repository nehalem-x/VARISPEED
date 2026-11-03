# Registro de mudanças

## Novembro de 2026: transições na Biblioteca e no carregamento

- Editor ↔ Biblioteca: a área que chega sobe de leve e aparece, com o cabeçalho primeiro e o conteúdo logo depois.
- Na lista da Biblioteca, ao abrir uma categoria ou buscar, as músicas entram em onda.
- Ao clicar numa bolinha do mapa, o painel da lista desliza de leve da direita e aparece. Na seta de voltar ao mapa, ele sai pelo mesmo caminho antes de o mapa ocupar o espaço. Reabrir a mesma categoria repete a onda, e reabrir ou buscar no meio da saída mantém a lista aberta.
- O resumo da música desliza de leve, o conteúdo vem em onda e a capa sai de um desfoque até o foco.
- Ao carregar uma música, a forma de onda é revelada da esquerda para a direita, com as barras crescendo e acendendo.
- Configurações abrem na curva nova e as seções entram em onda ao abrir ou trocar de aba. Na barra de link, o campo aparece de cima e a prévia entra em onda.
- Com "reduzir movimento", tudo aparece direto.

## Novembro de 2026: botões no mesmo padrão

- O X do modo foco voltou a funcionar. A visualização tinha ficado por cima dele e recebia o clique.
- Ao sair do modo foco com Esc, a visualização do cabeçalho não fica mais com o destaque de selecionada. O mesmo vale ao fechar modais, Configurações, a barra de link e a Biblioteca: o foco volta para o botão que os abriu, sem o destaque.
- Os botões do cabeçalho (Biblioteca, Salvar na Biblioteca, Importar e Configurações) agora têm a mesma aparência: borda, texto e respiro iguais. Antes, Biblioteca não tinha borda e Importar tinha um estilo só dele.
- "Editor" na barra da Biblioteca e o + de nova categoria no resumo seguem o mesmo padrão, sem borda e cor feitas sob medida.

## Novembro de 2026: transições cinematográficas

- Base nova de movimento: uma curva de cauda longa e durações diferentes para opacidade, posição e foco, para o fim das transições não se perceber, e uma mola em `motion.js` para os voos, que pode ser interrompida no meio.
- Modo foco: a visualização do cabeçalho cresce até a tela cheia enquanto o fundo escurece; ao sair, encolhe de volta para o lugar dela. A interface por trás só some quando a visualização chega, e a barra e o X aparecem depois, em onda. Clicar de novo no meio do caminho inverte a partir de onde está.
- Modais: o fundo escurece e desfoca de leve, o quadro sobe e entra em foco e o conteúdo vem em onda. A saída ficou curta, e reabrir no meio da saída volta de onde está.
- Com "reduzir movimento", tudo continua sendo troca imediata.

## Novembro de 2026: importar em modal

- O botão Importar abre um modal ("De onde vem o áudio?") em vez da listinha embaixo do botão. São duas opções grandes, Arquivo local e Link, cada uma com uma frase dizendo o que aceita. O modal tem a mesma animação dos outros, começa com o foco em Arquivo local, troca de opção com as setas e fecha com o X, clique fora ou Escape.
- A setinha ao lado de "Importar" saiu, porque o botão não abre mais uma lista.

## Novembro de 2026: atualização do yt-dlp com etapas

- Ao atualizar o yt-dlp, o botão mostra a etapa e o tempo passando ("Instalando 2026.11.02... (12 s)", "Reiniciando o servidor...", "Conferindo a versão..."), com uma varredura na base. A linha de baixo explica cada etapa (1 de 3, 2 de 3, 3 de 3).
- No fim, o botão mostra um check e "Atualizado para …" por alguns segundos. Ao só verificar, mostra "Você já tem a mais recente".

## Novembro de 2026: Biblioteca sem linha entre resumo e lista

- Com o resumo da música aberto ao lado da lista, a linha entre os dois saiu. Eram duas bordas coladas, que pareciam uma linha mais grossa. A separação agora vem só do fundo: o brilho da capa no resumo e o preto da lista. Sem o resumo aberto, a linha entre o mapa e a lista continua.

## Novembro de 2026: vectorscope sem borda

- As partículas do vectorscope vão até o fim da tela. Antes elas paravam numa linha nas laterais e se acumulavam ali, como uma parede.
- Com música alta ou ganho alto não aparece mais o contorno de um octógono. Acima de um certo nível, as partículas passam a se espalhar mais devagar, e os picos mais altos saem pela borda em vez de se empilhar nela.
- No modo foco, o vectorscope ocupa a tela inteira, sem margem, e a barra fica por cima com um degradê. A forma de onda continua com a margem de antes.

## Novembro de 2026: barra do modo foco

- A barra do modo foco ficou mais limpa: sem a linha em cima, com mais espaço entre os controles, a parte já tocada clara na linha de posição e a velocidade um pouco maior.
- Os botões de reproduzir e de velocidade do modo foco voltaram a ser quadrados. Antes eles encolhiam na largura e ficavam retangulares.
- Enquanto a música toca, a barra, o X e o cursor somem depois de 2,5 s parados e voltam ao mexer o mouse ou apertar uma tecla.

## Novembro de 2026: visualizador em tela cheia

- A janela separada do visualizador de áudio não congela mais em tela cheia. Antes, quando ela cobria a janela principal, o navegador pausava a janela coberta e os quadros paravam de chegar. Agora cada quadro é enviado assim que o visualizador pede.

## Novembro de 2026: modais do app

- Remover uma música, excluir uma categoria e desligar o VARISPEED não abrem mais a janela de confirmação do navegador. A pergunta aparece num modal do próprio app, no mesmo desenho do modal de categoria, e o foco começa em Cancelar.
- Os modais ganharam animação: ao abrir, o fundo escurece e o quadro sobe um pouco enquanto aparece; ao fechar, o contrário, mais rápido. Com "reduzir movimento" não há animação.

## Novembro de 2026: textos sem ponto médio

- Os textos do app não usam mais "·" como separador. Viraram frases normais: "36 músicas em 4 categorias", "Carregado: musica.mp3", "Link analisado. Confirme a importação.", "WAV, MP3, FLAC, OGG e M4A".
- Os títulos das janelas ficaram mais simples: "VARISPEED", "Inicializando o VARISPEED" e "Visualização de áudio do VARISPEED".
- Nos créditos, o separador entre o GitHub e o logo do yt-dlp saiu; os dois ficaram só com espaço entre eles.

## Novembro de 2026: pontos em rotação dupla

- Nova variação do indicador de pontos: os três pontos giram na horizontal e na vertical ao mesmo tempo. Ela aparece quando o app espera uma resposta de fora: ao analisar um link e ao abrir e aguardar o login do YouTube. Baixar e decodificar continuam com os três pontos de antes.
- Os indicadores de pontos ficaram maiores: 20 px no app (antes 14 px) e 24 px na tela de inicialização (antes 16 px).
- O campo de link ganhou 8 px de respiro acima e abaixo. Antes ele quase encostava na linha do cabeçalho.

## Outubro de 2026: indicador de espera

- No painel do editor, Arquivo original subiu para logo abaixo de Velocidade, e Resultado desceu para perto da exportação.
- O brilho borrado da capa (Arquivo original, detalhes e faixas da Biblioteca) agora entra e sai numa curva suave. Antes dava para ver uma risca onde ele acabava, e as laterais escureciam.
- Enquanto o app trabalha, um indicador pequeno de pontos aparece antes do texto de status no rodapé. Três pontos girando aparecem ao abrir ou decodificar um áudio. Uma grade de quatro pontos, em que os cantos trocam de lugar, aparece ao exportar.
- Na importação por link, os três pontos aparecem ao lado da etapa enquanto ainda não há porcentagem.
- A tela de inicialização mostra a grade ao lado de "INICIALIZANDO...".
- Com "reduzir movimento" os pontos ficam parados.

## Outubro de 2026: Configurações e botões

- Configurações: o menu de seções virou quatro abas no topo (Áudio, Biblioteca, Visual e Sistema). Cada aba mostra as suas seções em sequência; antes eram 13 telas separadas.
- Os títulos das seções ficaram menores, como subtítulos, e o título repetido saiu.
- Diagnóstico ficou recolhido no fim de Sistema, marcado como avançado.
- O rodapé virou uma linha só: Restaurar, a mensagem do momento e um menu Preset com Carregar e Salvar. A frase fixa "Alterações salvas automaticamente" saiu; "Salvo" aparece por um instante depois de cada mudança.
- Todo slider mostra o mínimo e o máximo embaixo, e o switch desligado ficou mais legível.
- Botões seguem uma regra única. Principal é preenchido e conclui a tarefa. Secundário tem borda. Discreto não tem borda nem fundo e serve para navegar, fechar e cancelar. O fundo cinza ficou só para Parar e Repetir. O botão de Configurações do cabeçalho ganhou borda, igual ao Importar.

## Outubro de 2026: identidade da interface

- Fontes próprias, embutidas no app: Space Grotesk para a interface e os números grandes, JetBrains Mono para os valores técnicos. Antes, o app usava as fontes do sistema, que mudavam de um computador para outro.
- A forma de onda virou barras finas. A parte já tocada fica clara e o resto fica apagado. Quando a música tem capa, um brilho borrado da capa aparece por trás.
- Ao lado do transporte, dois carretéis de fita giram enquanto a música toca, mais rápido quando a velocidade sobe. A fita passa de um carretel para o outro conforme a música avança.
- Pequenas respostas ao uso:
  - ao arrastar, o slider de velocidade encaixa no 100% quando passa perto, e a marca do original pisca (pelo teclado não encaixa);
  - ao terminar a exportação, o botão mostra um check e "Exportado" por alguns segundos;
  - o gato espia mais alto quando uma música carrega e quando a exportação termina;
  - o editor vazio mostra uma forma de onda apagada que respira atrás da frase.

  Tudo isso fica parado com "reduzir movimento".
- No mapa da Biblioteca, cada categoria com capas mostra um mosaico de até quatro capas das músicas mais recentes. Categorias sem capa continuam como um círculo vazio.
- No celular, o visualizador do cabeçalho mostra "Sem áudio" inteiro. Em telas de 900 px de altura, o painel do editor cabe inteiro acima do botão de exportar. Quando não cabe, o conteúdo some num degradê em vez de ser cortado.

## Outubro de 2026: painéis de Velocidade, Resultado e Arquivo original

- O `%` fica junto do número, e uma linha embaixo diz o efeito: "Mais lento e mais grave", "Original" ou "Mais rápido e mais agudo".
- O − e o + viraram dois botões com borda, à direita do número. A linha fixa abaixo do número saiu; o sublinhado só aparece ao editar o valor.
- O slider marca o 100% e pinta a distância entre o original e a velocidade atual.
- Os presets viraram uma fileira de botões com borda, sempre em ordem crescente, como o slider. O ativo fica invertido.
- Resultado: a diferença de duração aparece embaixo da duração de saída, no mesmo formato de tempo ("+0:44.19 mais longo"), e o tom diz o efeito ("−3.86 st, mais grave"). A linha Frequência saiu, porque repetia a velocidade.
- Arquivo original: o nome aparece sem a extensão e com a `/` que o yt-dlp troca por `⧸`. Formato e tamanho ficam numa linha pequena embaixo do nome. A duração saiu, porque já está em Resultado; amostragem e canais aparecem como "48 kHz" e "Estéreo".

## Outubro de 2026: login de um botão

- Conteúdo restrito virou **Conta do YouTube**, com um botão só: Entrar no YouTube. O menu de oito opções saiu; navegador específico e arquivo de cookies ficaram em Opções avançadas.
- Quando um vídeo pede login, a barra de link mostra Entrar no YouTube. Ao terminar o login, o app tenta o mesmo link de novo sozinho.
- O app percebe sozinho quando o login termina; não existe mais o passo Concluir.
- A janela de login usa o primeiro navegador compatível instalado (Edge, Chrome, Chromium, Brave ou Vivaldi), no Windows e no Linux. Antes, exigia o Edge.
- Sessão que o YouTube deixou de aceitar aparece como "Sessão expirada", com Entrar de novo, em vez de um erro genérico.
- O arquivo de cookies pode ser escolhido pela interface, sem variável de ambiente.

## Outubro de 2026: download pronto

- O VARISPEED ganhou um download para Windows (`.zip`) e Linux (`.tar.gz`) que abre sem instalar nada: Python portátil com as dependências e Node.js LTS vêm na pasta `runtime/`.
- O GitHub Actions monta os dois pacotes a cada tag `v*`, testa cada um fora da pasta em que foi montado e os anexa a um rascunho de release.
- `VARISPEED.vbs` usa o Python do pacote quando ele existe. No Linux, `VARISPEED.sh` abre o mesmo launcher gráfico do Windows e `criar-atalho.sh` coloca o app no menu.

## Outubro de 2026: atualização do yt-dlp

- Configurações → Sistema mostra a versão do yt-dlp e a mais recente, com um botão para atualizar. Depois da instalação o servidor se reinicia sozinho e a página confirma quando ele volta com a versão nova.
- O launcher atualiza o yt-dlp ao abrir, no máximo uma vez por dia. Sem internet ou com erro, o app abre com a versão instalada. A opção pode ser desligada.
- O canal Nightly instala as pré-versões, que costumam corrigir o YouTube antes da estável.
- Só o computador em que o VARISPEED roda pode atualizar; um celular na rede local só vê a versão.

## Outubro de 2026: padronização da interface

Medidas, estados e ícones agora seguem as regras de [docs/PADRAO_UI.md](docs/PADRAO_UI.md). A troca de ícones está documentada em [docs/REVISAO_ICONES.md](docs/REVISAO_ICONES.md).

### Editor

- O editor vazio mostra uma ação de importação no centro. Com áudio carregado, mostra a duração original ao lado da duração de saída e o efeito da velocidade no tom.
- Velocidade, Resultado e Arquivo original perderam a numeração. Os passos de velocidade ficam lado a lado e os presets deixaram de usar uma faixa preenchida.
- Arquivo original virou uma seção sempre visível. A capa ocupa a largura do painel em 16:9, com a thumbnail desfocada atrás do bloco (50% com bloom no tema escuro, 12% sem bloom no claro). O nome do arquivo quebra linha em vez de ser cortado.
- O painel não comprime mais os blocos na vertical. Quando o conteúdo passa da altura, o painel rola.
- Uma velocidade inválida mostra o erro junto ao campo, mantém o texto para edição e conserva o último ajuste válido no áudio.
- A exportação mostra nome, formato, profundidade e normalização junto ao botão e usa os ajustes confirmados no início da operação.

### Ícones

- Play, pause e stop passaram a usar os desenhos do Lucide, preenchidos. Agora todos os ícones de interface são Lucide.
- O traço tem 1,5 px na tela em todos os tamanhos. Antes ia de 1,1 px nos ícones de 12 px a 3 px no de 32 px.
- A importação por link sem capa mostra o ícone de onda, como a Biblioteca, em vez do texto ÁUDIO. A pausa sobre a capa da linha usa o mesmo ícone do transporte.

### Biblioteca

- O cabeçalho reúne Explorar, Ordenar, busca e Nova categoria. Voltar ao editor ficou separado. As faixas exclusivas de categoria e de ordenação foram removidas, assim como as instruções de teclado abaixo da lista. Os atalhos continuam funcionando.
- A busca começa como uma lupa e abre até 240 px em 220 ms. Ctrl/Cmd+F abre a busca, e Escape fecha, limpa o filtro e devolve o foco à lupa. Uma busca com texto continua aberta.
- O detalhe da faixa foi reorganizado: origem e fechar no topo, capa 16:9, título de 20 px, duração e velocidade sem caixas e categoria abaixo de uma única divisória. As ações ficam fixas no rodapé.
- A thumbnail desfocada aparece atrás de cada linha da lista e do painel de detalhes. Na lista, a cor some nos últimos 160 px para não atrapalhar duração e velocidade, e cada linha recorta o próprio blur.
- O blur atrás das linhas, do painel de detalhes e de Arquivo original ficou mais claro e ganhou bloom no tema escuro. Título e artista ganharam uma sombra curta para continuarem legíveis.
- Os botões de zoom e centralização do grafo foram removidos (`showControls: false`).
- A câmera do grafo não deixa mais o mapa sumir. Se ele cabe na tela, volta inteiro; se é maior, volta cobrindo 75% da área. Além do limite, o arrasto tem resistência e a câmera volta com uma mola.
- O zoom pela roda fica preso no ponto sob o cursor, mesmo com vários giros seguidos.
- No celular, dois dedos dão zoom. No touchpad, a pinça dá zoom e a rolagem com dois dedos move o mapa.
- Soltar o arrasto em movimento deixa uma inércia curta, que não aparece com movimento reduzido.
- Ao abrir uma categoria, o mapa encolhe sem que a bolinha suma atrás da lista; a câmera só anima o zoom até ela.
- O enquadramento conta o raio e o nome de cada nó, então nomes e contagens não ficam colados na borda.

### Configurações

- O painel mostra uma seção por vez, escolhida num seletor. Sistema, Atalhos e Diagnóstico continuam disponíveis, e há uma seção nova, Sobre o VARISPEED, com os créditos. Ao terminar a medição do grafo, o painel abre em Diagnóstico.
- Os switches têm tamanho fixo de 36 × 20 px, com área de clique de 36 × 28 px no desktop e 44 × 44 px no toque.
- Cada ajuda abre num painel com título e botão de fechar. Só uma fica aberta por vez, e fechar devolve o foco ao botão de ajuda.

### Controles e ícones

- Campos, selects, dropdowns e botões usam cantos retos (`--radius: 0`).
- O foco de teclado reforça a borda que o controle já tem, sem outline e sem mudar a espessura. Os botões ganham borda de 1 px no hover; ela já ocupa espaço no estado normal, então nada se desloca.
- A variante `.btn--outline` marca ações independentes: Nova categoria, Analisar link, Salvar preset, Copiar endereço e Copiar relatório.
- Várias molduras e divisórias repetidas foram tiradas de botões, presets, Biblioteca, detalhe da faixa, editor e Configurações. Campos, switches, menus, modal e painel lateral mantêm as bordas.
- Os ícones feitos à mão foram trocados por uma seleção local do Lucide, sem dependência nova. Os botões de transporte continuam preenchidos.
- As barras de rolagem usam o mesmo estilo fino em todo o app, inclusive na tela de inicialização.
- Saíram algumas frases de orientação: "Selecione um ponto para explorar", os resumos de efeito da velocidade ("Mais lento e mais grave...") e a sequência de passos da importação por link.

### Testes

- `tests/ui-controls.test.js` e `tests/ui-export.test.js` cobrem velocidade, exportação, navegação das Configurações, switches e ajudas.
- `tests/ui-policy.test.js` passou a exigir foco sem outline e reconhece `.btn--outline:focus-visible` como nome de classe.
- `python3 tests/run-ui-browser.py` testa 18 interações por largura no Firefox, com backend simulado e perfil temporário.

Na validação local passaram os 86 testes JavaScript, os 46 testes Python, o Ruff e a validação HTML. Também foram conferidos no Chromium, com o backend real, os dois temas entre 320 e 1840 px. Um WAV de 2 s exportado a 125% saiu com 1,6 s, e importar e exportar arquivos locais não fez nenhuma requisição aos endpoints de mídia do backend. Não foram testados downloads de plataformas externas, autenticação real nem leitores de tela.
