# VARISPEED — extrator local de cookies do YouTube

Extensão Manifest V3 para Chrome/Edge que exporta somente cookies de
`youtube.com` no formato Netscape aceito pelo `yt-dlp`.

## Proteções

- nenhum `fetch`, servidor, telemetria ou dependência externa;
- não usa `storage`, não mantém cópia dos cookies;
- não possui acesso a Google, Gmail ou qualquer domínio fora de YouTube;
- o acesso a `youtube.com` é opcional e solicitado somente após o clique;
- `incognito: split` mantém a sessão privada separada da sessão comum;
- o arquivo é criado em memória e entregue diretamente ao download do navegador.

O arquivo exportado continua sendo uma credencial sensível. A extensão reduz a
superfície de acesso, mas não elimina o risco associado ao uso de uma conta com
`yt-dlp`.

## Instalação manual

1. Abra `chrome://extensions` ou `edge://extensions`.
2. Ative **Modo do desenvolvedor**.
3. Escolha **Carregar sem compactação**.
4. Selecione esta pasta `tools/youtube-cookie-exporter`.
5. Em **Detalhes**, ative **Permitir no modo anônimo/InPrivate**.

## Exportação recomendada

1. Abra uma única janela anônima/InPrivate.
2. Entre no YouTube com uma conta secundária que tenha a idade confirmada.
3. Na mesma aba, abra `https://www.youtube.com/robots.txt`.
4. Abra a extensão nessa janela e clique em **Autorizar e exportar**.
5. Guarde `youtube-cookies.txt` fora do projeto e de pastas sincronizadas.
6. Feche a janela anônima/InPrivate e não reabra essa sessão.

## Configuração do VARISPEED

No PowerShell, substitua o caminho abaixo pelo local real do arquivo:

```powershell
[Environment]::SetEnvironmentVariable(
  'VARISPEED_COOKIES_FILE',
  'C:\caminho\seguro\youtube-cookies.txt',
  'User'
)
```

Feche completamente o VARISPEED e abra novamente.

Para remover a configuração:

```powershell
[Environment]::SetEnvironmentVariable('VARISPEED_COOKIES_FILE', $null, 'User')
```

## Auditoria rápida

Pesquise por `fetch`, `XMLHttpRequest`, `WebSocket` e `storage` nesta pasta. A
implementação não utiliza nenhuma dessas APIs. O único acesso sensível é
`chrome.cookies.getAll({ domain: 'youtube.com' })`, acionado pelo botão.
