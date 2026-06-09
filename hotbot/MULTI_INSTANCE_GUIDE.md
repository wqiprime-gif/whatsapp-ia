# 🤖 Guia de Multi-Instância WhatsApp Bot

## 📋 Visão Geral

O sistema agora suporta múltiplas instâncias de bot WhatsApp rodando simultaneamente, cada uma em uma porta diferente. Um painel de admin centralizado gerencia todas as instâncias.

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────┐
│        Terminal Admin Panel              │
│     (admin-panel.js)                    │
│  - Ver sessões ativas                  │
│  - Adicionar nova sessão               │
│  - Remover sessão                      │
│  - Reiniciar sessão                    │
│  - Ver detalhes                        │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│      Session Manager                    │
│   (session-manager.js)                  │
│  - Gerencia sessões (JSON)              │
│  - Aloca portas                         │
│  - Persiste dados                       │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│       Bot Factory                       │
│    (bot-factory.js)                     │
│  - Spawna processos bot                 │
│  - Monitora saúde                       │
│  - Kill/restart instâncias              │
└────────────────┬────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
    Instance 1        Instance 2
   (port 4001)       (port 4002)
   bot-instance.js   bot-instance.js
   [Byanca Costa]    [Outro Modelo]
```

## 🚀 Como Usar

### 1. Iniciar o Painel Admin

```bash
cd "C:\Users\eduar\OneDrive\Área de Trabalho\hotbot\hotbot"
npm start
```

Você verá:
```
╔════════════════════════════════════════╗
║                                        ║
║     🤖 HOTBOT - Multi-Instance        ║
║        WhatsApp Bot Manager            ║
║                                        ║
╚════════════════════════════════════════╝
```

### 2. Menu Principal

```
📊 SESSÕES ATIVAS

┌─────┬──────┬────────────────┬─────────────┬──────────────────┐
│ ID  │Porta │ Modelo         │ WhatsApp    │ Status           │
├─────┼──────┼────────────────┼─────────────┼──────────────────┤
│ 1   │ 4001 │ Byanca Costa   │ [NÚMERO]    │ 🟢 Conectado     │
└─────┴──────┴────────────────┴─────────────┴──────────────────┘

Selecione uma ação:
1) ➕ Adicionar Nova Sessão
2) ❌ Remover Sessão
3) 🔄 Reiniciar Sessão
4) 📋 Ver Detalhes
5) 🚪 Sair
```

### 3. Adicionar Nova Sessão

1. Escolha opção **1** no menu
2. Digite o nome da modelo
3. O bot inicia na próxima porta disponível
4. QR Code aparece no terminal
5. Escaneie com WhatsApp
6. Número é registrado automaticamente

**Exemplo:**
```
Nome da modelo: Jessica Modelo
⏳ Criando sessão...
✅ Sessão criada: Jessica Modelo (Porta: 4002)
⏳ Iniciando bot...
✅ Bot iniciado na porta 4002
📱 Verifique o terminal para escanear o QR Code!
```

### 4. Remover Sessão

1. Escolha opção **2** no menu
2. Selecione a sessão pelo número
3. Bot é encerrado automaticamente
4. Dados salvos, mas instância morta

### 5. Reiniciar Sessão

1. Escolha opção **3** no menu
2. Selecione a sessão pelo número
3. Bot é reiniciado (reconecta com dados salvos)

### 6. Ver Detalhes

Mostra todas as informações de cada sessão:
- ID único
- Porta
- Nome do cliente (clientId)
- Status (conectado/desconectado/erro)
- Número do WhatsApp
- Quando foi criada

## 📂 Estrutura de Arquivos

```
hotbot/
├── index.js                 # Entry point - inicia painel
├── session-manager.js       # Gerencia sessões em JSON
├── bot-factory.js           # Spawna/mata instâncias
├── admin-panel.js           # Menu interativo
├── bot-instance.js          # Bot individual (recebe parâmetros)
├── bot.js                   # Versão antiga (não usar)
├── sessions.json            # Persiste dados (criado automaticamente)
├── .wwebjs_auth/
│   ├── session-cliente-4001/  # Sessão 1 (número 1)
│   ├── session-cliente-4002/  # Sessão 2 (número 2)
│   └── session-cliente-4003/  # Sessão 3 (número 3)
└── prompts/
    ├── session-4001-prompt.json  # Prompt customizado 1
    ├── session-4002-prompt.json  # Prompt customizado 2
    └── session-4003-prompt.json  # Prompt customizado 3
```

## 📊 Arquivo sessions.json

```json
{
  "sessions": [
    {
      "id": "session-4001",
      "port": 4001,
      "clientId": "cliente-4001",
      "whatsappNumber": "551234567890@c.us",
      "modelName": "Byanca Costa",
      "status": "connected",
      "createdAt": "2026-05-02T10:30:00Z",
      "processId": 1234
    },
    {
      "id": "session-4002",
      "port": 4002,
      "clientId": "cliente-4002",
      "whatsappNumber": "559876543210@c.us",
      "modelName": "Jessica Modelo",
      "status": "connected",
      "createdAt": "2026-05-02T10:35:00Z",
      "processId": 5678
    }
  ],
  "nextPort": 4003
}
```

## 🔄 Fluxo de Funcionamento

### Ao Iniciar (npm start)

```
1. index.js carrega
2. sessionManager carrega sessions.json
3. Para cada sessão salva:
   a. botFactory.spawnBot() inicia processo
   b. Cada bot-instance.js é um processo separado
   c. Bots se conectam com LocalAuth (sessão salva)
4. adminPanel inicia e mostra menu
```

### Ao Adicionar Sessão

```
1. Usuário escolhe opção 1
2. Digita nome da modelo
3. sessionManager.addSession() cria nova entrada
4. Salva em sessions.json
5. botFactory.spawnBot() spawna processo
6. bot-instance.js inicia e mostra QR
7. Usuário escaneia QR
8. bot-instance.js autentica e atualiza sessionManager
9. Número é registrado em sessions.json
```

### Ao Remover Sessão

```
1. Usuário escolha opção 2
2. Seleciona sessão
3. botFactory.killBot() encerra processo
4. sessionManager.removeSession() remove de JSON
5. Dados de autenticação permanecem em .wwebjs_auth/
   (para recuperação futura se necessário)
```

## 🖥️ Parâmetros do Bot Instance

Cada bot-instance.js é iniciado com estes parâmetros:

```javascript
node bot-instance.js \
  --port 4001 \
  --clientId cliente-4001 \
  --modelName "Byanca Costa" \
  --sessionId session-4001
```

**Parâmetros:**
- `--port`: Porta HTTP para painel (usado pelo Express server)
- `--clientId`: ID único para LocalAuth (salva em .wwebjs_auth/)
- `--modelName`: Nome exibido no painel admin
- `--sessionId`: ID da sessão (usado para arquivo de prompt)

## 📝 Logs e Debugging

### Logs do Painel (index.js)
```
🚀 Iniciando painel de admin...
📋 Encontradas 2 sessão(ões) salva(s).
⏳ Reiniciando bots...
   → Byanca Costa (Porta 4001)...
     ✅ Iniciado
   → Jessica Modelo (Porta 4002)...
     ✅ Iniciado
```

### Logs de Instância (bot-instance.js)
```
[Port 4001] 🔊 Verificando arquivos de áudio...
[Port 4001] ✅ saudacao: ...
[Port 4001] ✅ Autenticado!
[Port 4001] 📱 Número conectado: 551234567890@c.us
[Port 4001] 🌐 Abrindo: http://localhost:4001
```

## ⚠️ Troubleshooting

### Problema: "Port already in use"
- Solução: Outra instância está rodando na porta. Verifique com `lsof -i :4001` (Linux/Mac) ou `netstat -ano` (Windows)

### Problema: "Cannot find sessionManager"
- Solução: session-manager.js está faltando ou em lugar errado. Verifique caminho relativo.

### Problema: Sessions não carregam ao reiniciar
- Solução: Verifique se sessions.json está no diretório correto e tem permissão de leitura.

### Problema: QR Code não aparece
- Solução: Verifique se bot-instance.js está sendo iniciado. Logs devem aparecer prefixado com `[Port XXXX]`

## 🔐 Segurança

### Dados Persisted
- `sessions.json`: contém portas, IDs, nomes de modelos, status
- `.wwebjs_auth/`: contém cookies/tokens de autenticação (SENSÍVEL)
- `prompts/`: contém prompts customizados do ChatGPT

**Recomendação:** Não compartilhe `.wwebjs_auth/` ou `sessions.json` com terceiros.

## 📞 Cada Instância Processa Mensagens Independentemente

- Mensagens chegam na porta específica (4001, 4002, 4003, etc.)
- Cada bot tem seu próprio cliente OpenAI (mesmo OPENAI_API_KEY do .env)
- Cada bot tem seu próprio prompt customizado
- Contatos são processados em paralelo (sem sincronização)

## ✅ Checklist de Inicialização

- [ ] `npm install` executado (dependencies instaladas)
- [ ] `.env` tem OPENAI_API_KEY válida
- [ ] Arquivos de áudio existem (saudacao.mp3, etc.)
- [ ] `sessions.json` existe (mesmo que vazio)
- [ ] `.wwebjs_auth/` diretório existe
- [ ] `npm start` inicia sem erros
- [ ] Painel de admin aparece com menu
- [ ] Primeira sessão pode ser adicionada
- [ ] QR code aparece quando sessão é iniciada

---

**Versão:** 2.0 (Multi-Instance)  
**Data:** 2026-05-02  
**Status:** ✅ Pronto para Testes
