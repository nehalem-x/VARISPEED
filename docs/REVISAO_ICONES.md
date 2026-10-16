# Refinamento da iconografia

A interface usa agora uma seleção local do Lucide. A troca preserva as caixas dos controles e a identidade monocromática, mas substitui geometrias pequenas apertadas, terminais pesados e desenhos ambíguos por uma família consistente.

## Referências avaliadas

| Conjunto | Licença | Avaliação para o VARISPEED |
| --- | --- | --- |
| [Lucide](https://github.com/lucide-icons/lucide) | [ISC; MIT para desenhos derivados do Feather](https://lucide.dev/license) | Selecionado: geometria SVG de 24×24, desenhos legíveis em 16 px e símbolos adequados às ações existentes |
| [Tabler Icons](https://github.com/tabler/tabler-icons) | MIT | Alternativa coerente, com [grade de 24×24 e traço de 2 unidades](https://docs.tabler.io/icons/design-guide); não misturada ao conjunto adotado |

Os SVGs selecionados contêm apenas primitivas vetoriais, sem scripts, imagens externas ou fontes. São incorporados ao sprite local. Não há dependência JavaScript adicional nem requisições a um CDN. A revisão upstream está fixada no [manifesto](../assets/icons/lucide-manifest.json), com a [licença completa](../assets/icons/LICENSE.lucide.txt). Os avisos legais também acompanham o HTML e o componente opcional que distribuem os desenhos.

## Mudanças por contexto

| Contexto | Refinamento |
| --- | --- |
| Cabeçalho | Biblioteca identificada por livros; salvar usa livro com plus; visualizador separado usa janela picture-in-picture |
| Importação e exportação | Símbolos diferentes para entrar com um arquivo e salvar o WAV; pasta aberta e corrente distinguem arquivo local e link |
| Configurações | Sliders substituem a engrenagem apertada; ajuda, presets e remover usam desenhos compartilhados |
| Editor e modo foco | Plus/minus alinhados; controles clonados mantêm a mesma família; play, pause e stop usam `play`, `pause` e `square` do Lucide, preenchidos |
| Biblioteca e detalhes | Categoria, renomear, remover, fechar, favorito e fallback de áudio seguem o sprite; estrela pequena mantém o mesmo desenho da ação Favoritas; a pausa sobre a capa usa o mesmo `pause` do transporte |
| Disclosures | Chevrons centrados substituem sinais tipográficos; abertura gira o indicador dentro da mesma caixa |
| Dropdowns | Seta usa a mesma geometria do chevron; alto contraste preserva a alternativa nativa |
| GraphEngine | Controles opcionais usam os desenhos equivalentes, sem dependência do sprite; continuam ocultos na Biblioteca |
| Importação por link | Sem capa, a miniatura mostra o ícone de onda, como a Biblioteca, em vez do texto ÁUDIO |
| Janela de áudio e inicialização | Janela de áudio usa os favicons do editor; mascote e marcas existentes são preservadas |

## Medidas e estados

Caixas de 16 px para ações, 12 px para indicadores auxiliares e 32 px para o fallback de artwork. Todas usam os tokens compartilhados. A geometria permanece em 24×24, sem esticar eixos. O traço tem 1,5 px na tela em qualquer tamanho: os símbolos não fixam `stroke-width`, e o CSS usa 2,25 unidades em 16 px, 3 em 12 px e 1,125 em 32 px. Terminais e junções próprios da família são preservados.

Ícones recebem a cor do controle, sem posições ou escalas específicas de hover, active, selected, focus ou disabled. Os indicadores de disclosure giram ao abrir, mantendo o centro e as dimensões. SVGs decorativos não são focáveis e deixam os eventos de ponteiro para o controle. Os rótulos acessíveis dos botões continuam sendo a referência funcional.

Fora do Lucide ficam só a marca do GitHub nos créditos (o Lucide não tem ícones de marca nessa revisão), o logo do yt-dlp, o mascote, os favicons e as barras animadas de reprodução sobre a capa, que não têm equivalente animado.

Não foram acrescentados ícones a ações que já são claras por texto. Os novos símbolos do sprite distinguem funções antes compartilhadas, sem multiplicar elementos visíveis.

## Verificação

- Testes JavaScript passam, incluindo os da política de interação e do GraphEngine.
- Cada símbolo do sprite foi comparado com o SVG do Lucide na revisão do manifesto: os desenhos são idênticos.
- Chromium, temas escuro e claro: ícones de 12, 16 e 32 px com o mesmo traço, transporte preenchido, pausa sobre a capa e miniatura sem capa do link conferidos.
