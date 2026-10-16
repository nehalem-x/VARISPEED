# Registro de mudanças

## Outubro de 2026: padronização da interface

Medidas, estados e ícones agora seguem as regras de [docs/PADRAO_UI.md](docs/PADRAO_UI.md). A troca de ícones está documentada em [docs/REVISAO_ICONES.md](docs/REVISAO_ICONES.md).

### Editor

- O editor vazio mostra uma ação de importação no centro. Com áudio carregado, mostra a duração original ao lado da duração de saída e o efeito da velocidade no tom.
- Velocidade, Resultado e Arquivo original perderam a numeração. Os passos de velocidade ficam lado a lado e os presets deixaram de usar uma faixa preenchida.
- Arquivo original virou uma seção sempre visível. A capa ocupa a largura do painel em 16:9, com a thumbnail desfocada atrás do bloco (22% no tema escuro, 12% no claro). O nome do arquivo quebra linha em vez de ser cortado.
- O painel não comprime mais os blocos na vertical. Quando o conteúdo passa da altura, o painel rola.
- Uma velocidade inválida mostra o erro junto ao campo, mantém o texto para edição e conserva o último ajuste válido no áudio.
- A exportação mostra nome, formato, profundidade e normalização junto ao botão e usa os ajustes confirmados no início da operação.

### Biblioteca

- O cabeçalho reúne Explorar, Ordenar, busca e Nova categoria. Voltar ao editor ficou separado. As faixas exclusivas de categoria e de ordenação foram removidas, assim como as instruções de teclado abaixo da lista. Os atalhos continuam funcionando.
- A busca começa como uma lupa e abre até 240 px em 220 ms. Ctrl/Cmd+F abre a busca, e Escape fecha, limpa o filtro e devolve o foco à lupa. Uma busca com texto continua aberta.
- O detalhe da faixa foi reorganizado: origem e fechar no topo, capa 16:9, título de 20 px, duração e velocidade sem caixas e categoria abaixo de uma única divisória. As ações ficam fixas no rodapé.
- A thumbnail desfocada aparece atrás de cada linha da lista e do painel de detalhes. Na lista, a cor some nos últimos 160 px para não atrapalhar duração e velocidade, e cada linha recorta o próprio blur.
- Os botões de zoom e centralização do grafo foram removidos (`showControls: false`).

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
