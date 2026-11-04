# Padrão de interface do VARISPEED

A interface acompanha a decisão do usuário: adquirir o áudio, ouvir e ajustar, comparar o resultado e exportar. O peso visual deve corresponder à tarefa de cada área.

## Hierarquia

| Contexto | Leitura principal | Apoio | Informação sob demanda |
| --- | --- | --- | --- |
| Editor vazio | Importar áudio no centro | Arrastar arquivo; formatos aceitos | Resultado e saída aparecem após carregar |
| Editor carregado | Transporte e velocidade | Duração original versus saída; efeito no tom | Dados do arquivo original em bloco sempre visível |
| Exportação | Nome e formato junto ao botão | Normalização; etapa em andamento | Opções completas em Configurações |
| Biblioteca | Encontrar e abrir música | Categoria, organização e transporte da sessão | Metadados no detalhe da seleção |
| Modo foco | Reproduzir/pausar e posição | Velocidade | Retorno ao editor pelo botão ou Escape |
| Configurações | Grupo e campo em edição | Valor e explicação | Diagnóstico em seção própria |

## Tipografia

Todo tamanho, peso e espaçamento de letra vem de um token de `styles.css`. Não usar valores em pixel soltos.

| Token | Tamanho | Uso |
| --- | --- | --- |
| `--text-xs` | 12 px | rótulos, texto de apoio, etiquetas |
| `--text-sm` | 13 px | controles e texto corrido |
| `--text-md` | 14 px | títulos de bloco e itens de lista |
| `--text-lg` | 16 px | títulos de painel |
| `--text-title` | 20 px | títulos de página, de detalhe e valores em destaque |
| `--text-heading` | 24 a 36 px | título da lista de uma categoria |
| `--text-xl` | 32 a 48 px | valor da velocidade |
| `--text-display` | 28 a 56 px | título do estado vazio e do guia da Biblioteca |

Fonte: a de interface vale para todo texto, inclusive rótulos, títulos, botões e mensagens. A monoespaçada fica para valores: tempos, durações, velocidade, frequência, tamanhos, nomes de arquivo de saída, teclas e campos técnicos.

Caixa: títulos, rótulos, botões e mensagens usam só a primeira letra maiúscula. A caixa alta é reservada para etiquetas curtas de origem e de estado (`LINK`, `ARQUIVO LOCAL`, `TOCANDO`, `PAUSADO`), sempre em mono, `--text-xs` e `--tr-wide`. A tela de inicialização mantém sua linha de estado própria.

Peso: 400 para texto, 500 para controles, rótulos e títulos grandes, 600 para títulos de bloco e de página.

Espaçamento entre letras: zero no texto comum, `--tr-wide` só nas etiquetas e `--tr-tight` só nos tamanhos `--text-heading` e `--text-display`.

Cor: títulos de bloco usam `--text`, rótulos e apoio usam `--text-2` ou `--text-3`. Não diferenciar blocos do mesmo nível pela cor do título.

As fontes são locais, sem imports remotos: Space Grotesk (interface, títulos e os números grandes de velocidade e duração) e JetBrains Mono (valores técnicos), em `assets/fonts/`, sob a SIL Open Font License 1.1. As pilhas de fallback em `--font-ui` e `--font-mono` cobrem o intervalo até o arquivo carregar.

## Visualizador do cabeçalho

Sem áudio carregado, o visualizador mostra "Sem áudio"; com áudio que ainda não tocou, mostra "Parado". Nos dois casos o canvas só fica invisível, sem perder as medidas. Depois da primeira reprodução, a pausa volta a mostrar o último quadro atenuado. O visualizador não tem fundo próprio.

## Textos

- "Música" é o que fica na Biblioteca; "áudio" é o que está no editor. Não usar "faixa".
- "Biblioteca" sempre com maiúscula, por ser o nome de uma área do app.
- Tom técnico e direto: frases curtas que dizem o que acontece ou o que fazer, sem metáfora nem slogan. A única frase de marca é "Dê outro tempo à sua música.", no editor vazio.
- Termos de áudio ficam (preset, WAV, dBFS, pico, ganho, timeline). Termos de programação não aparecem na tela: usar "servidor local" em vez de "backend" e "alternativa" em vez de "fallback".
- Nada de ponto médio (·) nem travessão como separador. Os textos se escrevem como frases normais:
  - estado seguido de um nome ou valor usa dois-pontos: "Carregado: musica.mp3", "Categoria criada: Rock";
  - duas ideias viram duas frases ou uma frase com vírgula: "Link analisado. Confirme a importação.", "Conectado, sessão válida";
  - listas usam vírgula e "e": "WAV, MP3, FLAC, OGG e M4A", "36 músicas em 4 categorias";
  - um detalhe complementar vai entre parênteses: "Medir grafo (8 s)".
- Títulos de janela: "VARISPEED" na tela principal; nas outras, uma frase curta como "Inicializando o VARISPEED".

## Base compartilhada

Usar os tokens de `styles.css`, com espaçamento em múltiplos de 4 px.

Controles normais usam `--ctl-h`: 36 px na densidade compacta, 40 px na confortável e 44 px em dispositivos de toque. Os passos de velocidade usam `--ctl-step`: 32/36/44 px. Ações auxiliares (ajuda, remover preset, inserir token e desfazer) usam `--ctl-subtle`: 28/32/44 px. Switches usam desenho fixo de 36 × 20 px, com área de clique de 36 × 28 px no desktop e 44 × 44 px no toque. Os botões de organização e do grafo usam a medida normal. A barra da timeline tem sua própria altura, calculada a partir dos controles; a altura da régua permanece independente.

Todos os campos, selects, dropdowns e botões usam cantos retos (`--radius: 0`), inclusive controles de ajuda. Usar `.btn` para controles; `.btn--icon` define a caixa quadrada, `.btn--ghost` reduz o peso visual e `.btn--primary` destaca a conclusão da tarefa local. Botões de texto mantêm largura conforme o conteúdo. As bordas funcionais usam `--control-border`; divisórias continuam usando `--divider`. O foco reforça a borda ou superfície existente, usando a cor do tema, sem contorno externo nem aumento de espessura.

O contraste principal segue monocromático nos dois temas. Seleção deve combinar apresentação e atributo acessível (`aria-pressed`); trabalho em andamento deve expor `aria-busy` mesmo com animações desligadas. Rótulos visíveis e nomes acessíveis devem corresponder.

## Quando o botão tem borda

Cada botão cai em um destes quatro tipos. O tipo sai do papel do botão, não do lugar em que ele está.

| Tipo | Classe | Aparência | Quando usar | Exemplos |
| --- | --- | --- | --- | --- |
| Principal | `.btn--primary` | Preenchido com a cor de destaque | A conclusão do que está aberto, no máximo um por região | Exportar WAV, Importar áudio do editor vazio, Importar áudio da barra de link, Abrir na Biblioteca, Próximo do guia, Play |
| Secundário | `.btn--outline` | Borda, sem fundo | Ação própria que não é a conclusão: abre algo, executa algo ou muda dados. Também toda ação das barras do topo | Biblioteca, Salvar na Biblioteca, Importar e Configurações do cabeçalho; Editor e Nova categoria da Biblioteca; + de categoria no resumo; Analisar, Entrar no YouTube, Copiar endereço, Verificar atualização, Desligar, Medir grafo, Carregar e Salvar preset |
| Discreto | `.btn--ghost` | Sem borda e sem fundo | Fechar, cancelar, desfazer e ajustes de contexto dentro de uma área | fechar (×), zoom, janela separada da visualização, Cancelar, Desfazer, Restaurar, Voltar e Pular do guia, Testar, Favoritar, Remover |
| Transporte | `.btn` sem variante | Fundo cinza, sem borda | Só os controles de mídia ao lado do Play | Parar, Repetir |

Ícone sozinho segue o mesmo papel: o × de fechar é discreto e Configurações é secundário.

Nenhum botão tem aparência própria. Um botão usa só a classe do seu tipo; ajustes locais podem mudar largura e respiro, nunca a cor do texto, a borda ou o fundo. Botões vizinhos na mesma barra são do mesmo tipo (no cabeçalho, todos secundários), com o mesmo respiro.

Ao fechar uma sobreposição (modo foco, modal, Configurações, barra de link, Biblioteca), o foco volta para o botão que a abriu sem o destaque de foco, mesmo saindo pelo Esc. O destaque volta no próximo Tab. Grupos de opções (presets, unidades) e os passos − e + seguem as regras próprias de grupo.

## Estados dos controles

As variantes definem intenção por tokens `--btn-*`; a base `.btn` aplica os estados. Evitar regras locais de `background`, `border-color` e `color` que sobrescrevam essa base. Exceções de geometria, como a divisão entre botões do grafo, permanecem locais.

| Estado | Apresentação | Comportamento |
| --- | --- | --- |
| Normal | Botão por superfície; outline discreto em ações independentes; ghost transparente; campos com borda funcional; primário com contraste invertido | Peso corresponde à ação no contexto |
| Hover | Botões mudam superfície; campos reforçam a cor da borda existente | Somente em `(hover: hover) and (pointer: fine)`; sem mudar tamanho ou peso da fonte |
| Pressionado | Superfície distinta | `:active`; disponível também no toque, sem mover o controle |
| Foco | Botões sem contorno usam linha inferior; outline reforça a borda existente; campos reforçam a borda; listas com linha lateral | `:focus-visible`; não depende de hover nem altera tamanho |
| Selecionado | Superfície e texto persistentes | `aria-pressed="true"` ou `.is-on`; hover preserva a seleção |
| Ajuda aberta | Mesmo tratamento de seleção | Ghost com `aria-expanded="true"` |
| Desabilitado | Opacidade compartilhada de 0,58; cursor de indisponível | `disabled`; hover e pressed não se aplicam; orientações da linha permanecem legíveis |
| Carregando | Mantém cores e opacidade do controle; cursor de progresso | `aria-busy="true"`; combinar com `disabled` para impedir operação duplicada |
| Campo somente leitura | Superfície de apoio | `readonly`; permanece selecionável para copiar |
| Campo inválido | Borda tracejada e mensagem junto ao campo | `aria-invalid="true"` e mensagem associada por `aria-describedby`; foco reforça a borda existente |

Na busca da Biblioteca, `:focus-within` muda somente a cor da borda existente do wrapper. Sliders mantêm a geometria do thumb no hover; o foco reforça a cor do thumb e trilho. A seleção do switch usa `aria-checked`, independente de hover.

## Bordas e organização

Organizar primeiro por espaçamento, depois por diferença de superfície e hierarquia tipográfica. Usar divisórias simples quando essas ferramentas não bastarem. Reservar bordas completas para campos, ações independentes que precisam de delimitação, menus flutuantes e limites importantes entre regiões. Usar `.btn--outline` nessas ações; não aplicar a variante a todos os botões.

Ícones, ajudas e controles internos a campos não recebem uma moldura completa no hover ou na seleção. Grupos de presets e passos compartilham uma superfície, sem caixas individuais. Metadados usam alinhamento e espaçamento; duração e velocidade ganham superfícies de apoio. Toolbars dispensam linhas acima e abaixo quando o fundo já separa a região. Duas regiões vizinhas nunca somam bordas (uma linha de 2 px): na Biblioteca, o resumo da música e a lista ficam sem linha entre eles, separados pelo brilho da capa.

A espessura permanece estável em todos os estados. O foco de teclado muda a cor da linha reservada na geometria do botão ou da borda existente do campo, sem outline ou ring adicional. Campos desabilitados atenuam a borda. Preservar as separações do painel lateral e dos rodapés fixos, além das divisórias discretas das listas.

## Comportamento

Reutilizar o controle oficial em apresentações repetidas. O editor, a Biblioteca e o modo foco clonam o mesmo botão de reprodução e sincronizam seu estado. Evitar marcações paralelas para a mesma ação.

Overlays devem conter a navegação por teclado quando modais, bloquear a interação com o fundo e devolver o foco ao contexto anterior. Ao cancelar a análise de um link, manter o campo disponível para corrigir ou tentar outro endereço.

A saída representa os ajustes confirmados no início da exportação. Nome, velocidade, amostragem, profundidade e normalização não devem mudar durante a operação. O resumo volta a acompanhar a edição quando ela termina.

Erros de velocidade, link e presets aparecem junto ao campo e permanecem até editar ou corrigir. A velocidade inválida conserva o texto para correção e o último ajuste válido do áudio; Enter inválido mantém o foco. Presets rejeitam entradas parcialmente numéricas, duplicadas e acima do limite de oito valores. Categorias usam o mesmo tratamento visual e acessível de erro. Falhas do provedor remoto recebem feedback operacional sem marcar um endereço válido como inválido.

O guia da Biblioteca e os textos longos de feedback podem receber uma revisão específica de conteúdo. A interface foi conferida com o backend real em Chromium; leitores de tela ainda não foram avaliados.

## Indicador de espera

Tarefas sem porcentagem mostram um indicador de pontos (`dots.js`) antes do texto de status, com 20 px no app e 24 px na tela de inicialização, na mesma cor do texto secundário. Ele existe em três formas:

| Forma | Movimento | Quando usar |
| --- | --- | --- |
| Três pontos | Um anel horizontal gira e a câmera sobe e desce (ciclo de 3,67 s) | Ler e trazer: decodificar, baixar, importar, abrir |
| Três pontos, rotação dupla | O mesmo anel gira na horizontal e, ao mesmo tempo, tomba sem parar no eixo vertical (ciclo de 3,67 s) | Esperar uma resposta de fora: analisar um link, abrir e aguardar o login |
| Grade | Uma grade 2×2 em que pares de cantos opostos trocam de lugar (ciclo de 1,27 s) | Processar: renderizar e codificar a exportação, inicializar |

O indicador aparece em um lugar só por vez. Na importação por link ele fica na barra de link, ao lado da etapa, e some quando surge a porcentagem; o rodapé não repete. Botões com varredura de progresso não ganham indicador. Com "reduzir movimento" os pontos aparecem parados.

## Modo foco

- No vectorscope, a visualização ocupa a tela inteira e a barra fica por cima, com um degradê. As partículas nunca mostram o formato do limite: nada de corte seco, nem linha nas bordas, nem octógono; o que passa do quadro sai pela borda. A forma de onda mantém a margem em volta.

- A barra de baixo não tem linha separando-a da visualização. Na linha de posição, a parte já tocada fica clara e o resto apagado, como na forma de onda. A posição atual é mais clara que a duração total.
- Tocando, a barra, o X e o cursor somem depois de 2,5 s sem mexer o mouse. Qualquer movimento, toque, rolagem ou tecla traz tudo de volta. Pausado, ou com o foco do teclado na barra, ela não some. Com "reduzir movimento" ela some sem transição.

## Tarefas longas em botões

Uma ação que leva mais que um instante (atualizar o yt-dlp, exportar) mostra no próprio botão o que está acontecendo: o nome da etapa com reticências e, a partir de 3 s, o tempo passando entre parênteses. A varredura de progresso corre na base do botão. Quando há etapas, a linha de ajuda embaixo diz qual é ("Etapa 2 de 3: ..."). No fim, um check com o resultado fica no botão por cerca de 3 s antes de ele voltar ao rótulo normal.

## Modais

- Nunca usar as janelas do navegador (`confirm`, `alert`, `prompt`). Toda confirmação usa `Modal.confirm()` (`modal.js`), com o mesmo desenho do modal de categoria: rótulo pequeno da área, título, uma frase que diz o que acontece, Cancelar (discreto) e a ação (principal) com o verbo da ação ("Remover", "Excluir", "Desligar").
- Escolhas entre poucas opções (como Importar: Arquivo local ou Link) também usam modal, não lista suspensa: cada opção é um bloco grande com ícone, nome e uma frase dizendo o que aceita.
- O foco começa em Cancelar, para que Enter nunca confirme uma ação destrutiva sem querer. Escape, o X e clicar fora cancelam.
- Ao abrir, o fundo escurece e desfoca de leve, o quadro sobe 14 px e sai de um desfoque até o foco, e o conteúdo entra em onda (veja "Movimento cinematográfico"). Ao fechar, uma saída curta de 260 ms, sem onda. Reabrir no meio da saída volta de onde está. Com "reduzir movimento" o modal aparece e some sem animação. Todo modal novo abre e fecha por `Modal.show()` e `Modal.hide()`.

## Movimento cinematográfico

Transições importantes começam rápido e terminam numa cauda longa, de um jeito que não dá para dizer quando pararam.

- **Curva:** `--ease-cine` (`cubic-bezier(0.16, 1, 0.3, 1)`) para entradas; `--ease-cine-exit` para saídas, que são curtas (`--dur-cine-exit`, 260 ms).
- **Camadas com durações diferentes:** opacidade `--dur-cine-fade` (340 ms), posição e escala `--dur-cine-move` (720 ms), desfoque e assentamento `--dur-cine-settle` (960 ms). Nada para no mesmo instante.
- **Onda:** blocos de um mesmo quadro entram com `--cine-stagger` (45 ms) de diferença entre si.
- **Foco de câmera:** o que entra sai de um desfoque leve (2 a 4 px) até o foco. Desfoque só em elementos pequenos; nunca na tela inteira.
- **Movimento com física:** voos e trocas de lugar usam `Motion.spring()` (`motion.js`), uma mola criticamente amortecida: 90% do caminho em 0,35 s, o resto assentando até perto de 1 s, sem passar do ponto. É interrompível: um clique no meio inverte a partir de onde está.
- **Modo foco:** a visualização do cabeçalho voa até a tela cheia (e volta ao sair) nessa mola, com o fundo escurecendo junto e as duas visualizações se cruzando no começo e no fim do voo. A interface por trás só some quando a visualização chega. A barra e o X chegam depois, em onda.
- **Editor ↔ Biblioteca:** a área que chega sobe de leve e aparece, com o cabeçalho dela antes do conteúdo (`.is-arriving`). Só anima quando a troca acontece de fato.
- **Mapa ↔ lista:** abrir uma categoria pelo mapa faz o painel da lista deslizar de leve da direita; voltar ao mapa faz ele sair pelo mesmo caminho (`.is-leaving`, 260 ms) antes de o mapa ocupar o espaço.
- **Lista da Biblioteca:** ao abrir uma categoria ou buscar, as músicas visíveis na tela (até 14) entram em onda a partir da primeira visível, 28 ms uma depois da outra. Favoritar ou renomear não repete a onda.
- **Resumo da música:** desliza de leve; capa, títulos e dados vêm em onda, e a capa sai de um desfoque até o foco. Ao trocar de música com o painel aberto, ele fica parado e só o conteúdo entra de novo (letras em onda, fundo borrado e capa saindo do desfoque). No celular, sobe em vez de deslizar.
- **Forma de onda ao carregar:** as barras são reveladas da esquerda para a direita numa frente suave, crescendo e acendendo (mola mais lenta, cerca de 1,4 s até assentar).
- **Configurações:** o painel abre na curva de cauda longa e fecha rápido; ao abrir ou trocar de aba, as seções entram em onda.
- **Barra de link:** o campo aparece de cima; a prévia do link entra em onda, com a capa saindo de um desfoque.
- **Peças:** `cine-fade-in`, `cine-lift`, `cine-slide` e `cine-focus-in` mexem cada uma numa propriedade só, para cada propriedade ter a sua duração. Ajuste a distância por `--cine-lift`, `--cine-slide` e `--cine-blur`. Nunca usar escala em áreas que medem o próprio tamanho ao abrir (mapa, forma de onda).
- **Resposta imediata:** o clique sempre move algo no mesmo quadro (a mola recebe um empurrão inicial). A cauda é só acabamento; nada espera a animação terminar para responder.
- **Reduzir movimento:** tudo vira troca imediata.

## Barras de rolagem

Toda região rolável usa `scrollbar-width: thin`, trilho transparente e indicador neutro definido pelo tema. A regra é global, incluindo Biblioteca, detalhes, configurações, inspector e relatórios. A inicialização usa o mesmo padrão com os tokens próprios de seu tema. Navegadores sem suporte às propriedades padrão usam o fallback WebKit de 6 px, sem borda, com cantos retos e reforço discreto no hover. Em cores forçadas, a cor retorna ao padrão do sistema operacional.


## Família de ícones

Ações usam a seleção local do Lucide, com geometria original de 24 × 24, terminais e junções arredondados. Usar `.ui-icon` e os tokens `--icon-size` (16 px), `--icon-size-small` (12 px) e `--icon-size-artwork` (32 px). O traço de 2,25 unidades produz 1,5 px na caixa padrão; tamanhos auxiliares escalam proporcionalmente. Evitar reescalar apenas um eixo, redesenhar a geometria para caber ou aplicar um traço absoluto que pese demais em ícones pequenos.

Os símbolos ficam no sprite do HTML; controles dinâmicos reutilizam o mesmo viewBox e desenho. Configurações, menus, Biblioteca, editor, tutorial e modo foco seguem essa família. Os controles opcionais do GraphEngine usam os SVGs correspondentes, preservando a autonomia do componente e a preferência que os mantém ocultos na Biblioteca.

Ícones herdam a cor do controle, não recebem eventos de ponteiro e não são focáveis. Os botões conservam seus rótulos acessíveis. Hover, active, focus e disabled alteram a apresentação do controle; a caixa e a posição do ícone permanecem fixas. Disclosures usam chevrons centrados que giram conforme a abertura. Reservar plus/minus para ajuste de valor e adicionar/remover.

Importar e exportar usam desenhos distintos. Biblioteca usa livros, salvar na Biblioteca usa livro com plus, janela do visualizador usa picture-in-picture, configurações usa sliders e repetição usa duas setas. Os três símbolos preenchidos de transporte (play, pause e stop) conservam sua geometria original como exceção funcional. Logos de terceiros e a mascote conservam sua identidade. Os favicons da janela de áudio acompanham os do editor.

As setas dos selects seguem o mesmo chevron, com contraste adequado ao tema; em cores forçadas, retorna o controle nativo. Não acrescentar ícones a ações que já são claras por texto.

Origem, revisão e mapeamento: [manifesto Lucide](../assets/icons/lucide-manifest.json). Licenças ISC e MIT/Feather preservadas em [LICENSE.lucide.txt](../assets/icons/LICENSE.lucide.txt) e nos arquivos que distribuem os desenhos. Nenhuma biblioteca JavaScript, fonte de ícones ou CDN é carregada em runtime.


## Configurações e ajudas por item

Quatro abas fixas no topo: Áudio, Biblioteca, Visual e Sistema. Cada aba mostra suas seções em sequência, separadas por uma divisória, com rolagem. A aba escolhida é mantida ao fechar e reabrir o painel durante a sessão. As setas, Home e End trocam de aba pelo teclado. Diagnóstico fica recolhido no fim de Sistema, como "Diagnóstico (avançado)"; Sobre o VARISPEED vem depois dele. Campos continuam montados e sincronizados, preservando dependências, persistência, validação e exportação de presets.

O título de cada seção é um subtítulo (`.cfg__subtitle`), não um título de página: o nome do painel já está no topo. Usar subtítulo, descrição curta e campos alinhados, sem divisórias entre cada ajuste. Todo slider mostra o valor à direita e o mínimo e o máximo embaixo.

O rodapé tem uma linha: Restaurar à esquerda, a mensagem do momento no meio e o menu Preset à direita, que abre para cima com Carregar arquivo e Salvar arquivo. Não há mensagem fixa: "Salvo" aparece por um instante depois de uma mudança feita no painel. O painel tem largura suficiente para os controles e ocupa a tela no modo compacto. Switches conservam o desenho de 36 × 20 px em todas as densidades; o toque ganha área de interação sem ampliar trilho e knob.

A ajuda Sobre cada item é um painel contextual, com título e explicação. O próprio botão de ajuda abre e fecha o painel. Apenas uma ajuda fica aberta; trocar de aba a fecha. O botão expõe `aria-expanded`/`aria-controls` e o campo referencia a explicação por `aria-describedby`. Ao fechar pelo teclado, o foco permanece no botão de ajuda. Não desabilitar a ajuda de um campo indisponível, pois ela pode explicar a dependência.


## Painel do editor

A ordem do painel é Velocidade, Arquivo original, Resultado e o rodapé de exportação. Velocidade é a leitura principal; Resultado destaca a duração de saída e a compara à original. Usar tipografia e superfície para definir os grupos, sem numeração ou bordas completas em cada informação.

Arquivo original é um bloco sempre visível ao carregar áudio, com nome completo e metadados em duas colunas. A thumbnail conserva a proporção e ocupa a largura disponível, sem moldura ou recuo interno. O blur fica atrás de todo o bloco, com máscara vertical que o dissolve antes dos dados inferiores, seguindo a linguagem do detalhe da Biblioteca. A exportação permanece agrupada com o resumo do arquivo e acompanha o estado confirmado da operação. Os blocos do painel têm o mesmo fundo e são separados por uma divisória; acima de 900 px, o rodapé de exportação fica preso à base do painel para que Exportar esteja sempre visível.


## Busca da Biblioteca

O estado inicial mostra apenas a lupa, junto dos filtros e da criação de categoria. A expansão é horizontal, até 240 px, sem aumentar o campo até ocupar o cabeçalho. Usar transição de largura/opacidade e respeitar movimento reduzido. Conteúdo recolhido deve ficar inert, sem focos invisíveis.

Abrir move o foco para o campo; Escape e limpar/fechar recolhem a busca, removem o filtro e devolvem o foco à lupa. Ctrl/Cmd+F é a entrada de teclado da busca quando a Biblioteca está ativa e nenhum modal de categoria está aberto. Manter Explorar e Ordenar separados por função; Ordenar só aparece na lista de uma categoria. O rótulo Explorar fica só para leitores de tela.

A barra da Biblioteca tem dois tipos de controle: o select e botões com borda da mesma altura. Busca e Nova categoria são botões quadrados de ícone; o nome de Nova categoria fica no `aria-label` e no `title`. O botão "← Editor" fica antes do título acima de 1280 px e à direita do título abaixo disso, separando a navegação das ações da tela.


Ações independentes como Nova categoria, Analisar link, Salvar preset e Copiar podem usar contorno discreto. O Importar do cabeçalho é sempre secundário e usa esse tratamento; no editor vazio, a ação principal é o botão do centro. Não combinar contorno do grupo com contornos de todos os controles internos. Presets e tokens usam texto e espaçamento, sem caixas preenchidas permanentes em cada item. No campo de busca expandido, o foco usa a borda do wrapper e o contraste do ícone, sem acrescentar moldura aos botões internos.
