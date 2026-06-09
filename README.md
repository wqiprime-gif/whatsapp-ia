# BotManager WhatsApp

Painel completo com **paridade ao BotManager Telegram** — dashboard, instâncias, leads, remarketing, presentes, conversas, pagamentos, produtos, áudios, mídias e configurações. Tema **verde WhatsApp** (`#25D366`).

## Stack

| Parte | Tecnologia |
|-------|------------|
| Painel + API | Fastify + TypeScript + PostgreSQL |
| Bots WhatsApp | `hotbot/bot-instance.js` (whatsapp-web.js + OpenAI) |
| Deploy | Railway (Nixpacks) |

## Local

```bash
npm install
cp .env.example .env
# Edite PANEL_PASSWORD e opcionalmente DATABASE_URL
npm run dev
```

Abra `http://localhost:3000/login`

## Railway

1. Conecte o repo [wqiprime-gif/whatsapp-ia](https://github.com/wqiprime-gif/whatsapp-ia)
2. Adicione **PostgreSQL** e referencie `DATABASE_URL` no serviço do app
3. Variáveis obrigatórias:
   - `PANEL_PASSWORD` — senha do painel
   - `INTERNAL_SECRET` — segredo entre painel e bots WA
4. Deploy: `npm run build && npm start` (via `railway.json`)

### Sessão WhatsApp

O whatsapp-web.js precisa de **disco persistente** para `.wwebjs_auth`. No Railway:

- Monte um **Volume** em `/app/data` e defina `DATA_DIR=/app/data`
- Ou rode os bots em VPS e use o painel só na Railway apontando para o mesmo Postgres

## Fluxo

1. Crie conta em `/register` (código de convite no `.env`)
2. **Nova instância** → salve prompt, Pix, mídias
3. Abra **QR Code** na instância e escaneie no WhatsApp
4. Leads, conversas e vendas aparecem no painel automaticamente

## Estrutura

```
src/           Painel TypeScript (igual Telegram)
hotbot/        Motor WhatsApp (legado, integrado via subprocess)
data/          Uploads + sessões (local ou volume)
```
