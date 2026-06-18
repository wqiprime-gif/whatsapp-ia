# CallSimulador

Sistema para criar **simulador de chamada por link** (tela “está te ligando” + “atender/recusar” + vídeo em tela cheia) e modo híbrido opcional (vídeo + voz ao vivo via WebRTC).

## 🎯 Funcionalidades

- ✅ **Dashboard completo** - Interface moderna para gerenciar calls
- ✅ **Upload de vídeo** - Faça upload de vídeos diretamente no sistema
- ✅ **Vídeo pré-gravado** - Reproduzido localmente no cliente
- ✅ **Voz ao vivo** - Host transmite áudio via WebRTC
- ✅ **Sincronização** - Vídeo e áudio sincronizados
- ✅ **Múltiplos clientes** - Suporte a vários participantes simultâneos
- ✅ **Interface simples** - Fácil de usar

## 🚀 Como Usar

### 1. Instalar Dependências

```bash
npm install
```

### 2. Iniciar Servidor

```bash
npm start
```

Ou em modo desenvolvimento:

```bash
npm run dev
```

O servidor iniciará em `http://localhost:3000`

### 3. Criar uma Call

**Opção 1: Dashboard (Recomendado)**
1. Acesse `http://localhost:3000/dashboard.html`
2. Faça upload de um vídeo (arraste ou clique)
3. Aguarde o upload completar
4. Clique em "Criar Call com este Vídeo"
5. Você receberá os links da call

**Opção 2: URL Manual**
1. Acesse `http://localhost:3000`
2. Cole a URL do vídeo (MP4, WebM, etc.)
3. Clique em "Criar Call"

### 4. Iniciar a Call

1. **Host**: Abra o link do host e ative o microfone
2. **Cliente**: Abra o link do cliente - o vídeo começará automaticamente quando o host estiver pronto

## 📁 Estrutura do Projeto

```
Projeto02/
├── server.js          # Backend (Express + WebSocket + Upload)
├── package.json       # Dependências
├── public/
│   ├── index.html     # Página de criação de calls (URL manual)
│   ├── dashboard.html # Dashboard principal (upload + gerenciamento)
│   ├── dashboard.js   # Lógica do dashboard
│   ├── host.html      # Painel do host
│   ├── host.js        # Lógica do host (WebRTC)
│   ├── call.html      # Página do cliente
│   ├── guest.js       # Lógica do cliente
│   └── uploads/       # Vídeos uploadados (criado automaticamente)
└── README.md
```

## 🎛️ Controles do Host

- **Microfone**: Ativa/desativa captura de áudio ao vivo

## 🔧 Melhorias Futuras

### Upload e Armazenamento

- Integração com serviços de cloud (AWS S3, Cloudinary)
- Compressão automática de vídeos
- Suporte a mais formatos

### Escalabilidade

Para muitos participantes simultâneos, considere:

- **SFU (Selective Forwarding Unit)**: LiveKit, Janus, mediasoup
- **TURN servers**: Para clientes atrás de NATs complexos
- **Redis**: Para armazenar estado das calls em produção

### Sincronização Perfeita

Para sincronização exata entre vídeo e áudio:

- Transmitir vídeo também via WebRTC (mais custoso)
- Usar timestamps precisos e ajustar playback do vídeo local

## 🌐 Deploy

### Opções de Deploy

1. **Heroku**: Adicione `Procfile` com `web: node server.js`
2. **Railway**: Conecte o repositório
3. **Vercel/Netlify**: Para frontend + backend serverless
4. **VPS**: DigitalOcean, AWS EC2, etc.

### Variáveis de Ambiente

```env
PORT=3000
NODE_ENV=production
```

## 📝 Notas Técnicas

- **Latência**: WebRTC tem ~100-300ms de latência
- **Navegadores**: Funciona em Chrome, Firefox, Edge (não Safari iOS)
- **HTTPS**: Necessário para WebRTC em produção (exceto localhost)
- **STUN/TURN**: Configure servidores TURN para melhor conectividade

## 🐛 Troubleshooting

### Microfone não funciona
- Verifique permissões do navegador
- Use HTTPS em produção
- Teste em diferentes navegadores

### Áudio não chega
- Verifique firewall/NAT
- Configure servidores TURN
- Verifique console do navegador para erros

### Vídeo não carrega
- Verifique CORS na URL do vídeo
- Use formatos compatíveis (MP4, WebM)
- Teste a URL diretamente no navegador

## 📄 Licença

MIT

---

Feito com ❤️ para criar experiências premium de comunicação

