# Refinamento da iconografia

A interface usa agora uma seleção local do Lucide. A troca preserva as caixas dos controles e a identidade monocromática, mas substitui geometrias pequenas apertadas, terminais pesados e desenhos ambíguos por uma família consistente.

## Referências avaliadas

| Conjunto | Licença | Avaliação para o VARISPEED |
| --- | --- | --- |
| [Lucide](https://github.com/lucide-icons/lucide) | [ISC; MIT para desenhos derivados do Feather](https://lucide.dev/license) | Selecionado: geometria SVG de 24×24, desenhos legíveis em 16 px e símbolos adequados às ações existentes |
| [Tabler Icons](https://github.com/tabler/tabler-icons) | MIT | Alternativa coerente, com [grade de 24×24 e traço de 2 unidades](https://docs.tabler.io/icons/design-guide); não misturada ao conjunto adotado |

Os SVGs selecionados contêm apenas primitivas vetoriais, sem scripts, imagens externas ou fontes. São incorporados ao sprite local. Não há dependência JavaScript adicional nem requisições a um CDN. A revisão upstream está fixada no [manifesto](assets/icons/lucide-manifest.json), com a [licença completa](assets/icons/LICENSE.lucide.txt). Os avisos legais também acompanham o HTML e o componente opcional que distribuem os desenhos.

## Mudanças por contexto

| Contexto | Refinamento |
| --- | --- |
| Cabeçalho | Biblioteca identificada por livros; salvar usa livro com plus; visualizador separado usa janela picture-in-picture |
| Importação e exportação | Símbolos diferentes para entrar com um arquivo e salvar o WAV; pasta aberta e corrente distinguem arquivo local e link |
| Configurações | Sliders substituem a engrenagem apertada; ajuda, presets e remover usam desenhos compartilhados |
| Editor e modo foco | Plus/minus alinhados; controles clonados mantêm a mesma família; play, pause e stop preenchidos preservados como exceção funcional |
| Biblioteca e detalhes | Categoria, renomear, remover, fechar, favorito e fallback de áudio seguem o sprite; estrela pequena mantém o mesmo desenho da ação Favoritas |
| Disclosures | Chevrons centrados substituem sinais tipográficos; abertura gira o indicador dentro da mesma caixa |
| Dropdowns | Seta usa a mesma geometria do chevron; alto contraste preserva a alternativa nativa |
| GraphEngine | Controles opcionais usam os desenhos equivalentes, sem dependência do sprite; continuam ocultos na Biblioteca |
| Janela de áudio e inicialização | Janela de áudio usa os favicons do editor; mascote e marcas existentes são preservadas |

## Medidas e estados

Caixas de 16 px para ações, 12 px para indicadores auxiliares e 32 px para o fallback de artwork. Todas usam os tokens compartilhados. A geometria permanece em 24×24, sem esticar eixos. Traço de 2,25 unidades: 1,5 px na apresentação padrão, proporcional nas demais escalas. Terminais e junções próprios da família são preservados.

Ícones recebem a cor do controle, sem posições ou escalas específicas de hover, active, selected, focus ou disabled. Os indicadores de disclosure giram ao abrir, mantendo o centro e as dimensões. SVGs decorativos não são focáveis e deixam os eventos de ponteiro para o controle. Os rótulos acessíveis dos botões continuam sendo a referência funcional.

Não foram acrescentados ícones a ações que já são claras por texto. Os novos símbolos do sprite distinguem funções antes compartilhadas, sem multiplicar elementos visíveis.

## Verificação

- 86 testes JavaScript passaram, incluindo os testes da política de interação e do GraphEngine.
- HTML validado; sintaxe dos scripts e `git diff --check` passaram.
- Chromium, temas escuro/claro, larguras 320, 390, 768, 1280 e 1840 px: referências SVG válidas, dimensões esperadas, sem overflow horizontal ou exceções JavaScript.
- Geometria de ícone e controle estável em hover, active, selected, focus e disabled.
- Importação local, reprodução/pausa, ajuda, disclosures, favoritos, menu e criação de categoria conferidos; exportação WAV e favicons da janela de áudio verificados.
- Nenhuma requisição externa durante a conferência da interface.

Relatório em `/tmp/varispeed-icon-review/browser-report.json`; folha visual em `/tmp/varispeed-icon-review/icon-family.png`; capturas dos módulos nesse mesmo diretório.
