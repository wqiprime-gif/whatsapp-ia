# CallHot — integração com ZapManager

O **CallHot** é um app **separado** do ZapManager. Ele simula uma chamada de vídeo para o lead após o pagamento.

A pasta `Callhot/` já está no repositório. Você precisa de **dois serviços** no Railway (ou outro host):

| Serviço | Pasta | Função |
|---------|-------|--------|
| **ZapManager** | raiz `whatsapp-ia` | Painel + bot WhatsApp |
| **CallHot** | `Callhot/` | Página da chamada + API para criar links |

## 1. Deploy do CallHot

1. No Railway, crie um **novo serviço** apontando para o mesmo repositório.
2. Defina a **root directory** como `Callhot`.
3. Variáveis de ambiente:
   - `CALLHOT_BOT_SECRET` — senha longa (ex.: `openssl rand -hex 32`)
   - `PUBLIC_BASE_URL` — URL pública do CallHot (ex.: `https://seu-callhot.up.railway.app`)
   - `PORT` — normalmente o Railway define automaticamente

4. Após o deploy, abra a URL do CallHot no navegador e faça login no painel.
5. Envie o **vídeo gravado** que o lead verá ao “atender” e copie a URL completa do arquivo.

## 2. Configurar no ZapManager

Na instância (Nova instância / Editar):

1. **Ativar CallHot** → Sim  
2. **URL do CallHot** → URL pública do serviço CallHot  
3. **URL do vídeo** → link do upload no painel CallHot  
4. **Secret** → o mesmo valor de `CALLHOT_BOT_SECRET`  

Opcional: no ZapManager (Railway), você pode definir `CALLHOT_BOT_SECRET` globalmente como fallback.

## 3. Prompt e pagamento

No prompt da instância, use a tag `[[send_link_chamada]]` quando o lead pagar o pacote de chamada ou completo.

**Fluxo:**

1. Lead paga o Pix (pacote chamada/completo).  
2. Motor confirma pagamento.  
3. ZapManager chama `POST {callhotUrl}/api/bot/create-call` com o secret.  
4. CallHot devolve um link `/ring/{id}`.  
5. Bot envia o link no WhatsApp.  
6. Lead abre e vê o vídeo gravado na interface de chamada.

## Troubleshooting

- **Link não enviado** — verifique se CallHot está ativo, URL e secret corretos.  
- **Vídeo não aparece** — confira a URL do vídeo (deve ser acessível publicamente).  
- **401 na API** — secret diferente entre ZapManager e CallHot.
