# 🚀 Guia de Deploy na Contabo

## ✅ Resumo Rápido

1. Copiar arquivos do seu PC para a Contabo
2. Executar o script `deploy-contabo.sh`
3. Pronto! Bot rodando nas portas 5000+

---

## 📋 Pré-requisitos

- ✅ VPS Contabo ativo
- ✅ IP do VPS
- ✅ Senha SSH (ou chave SSH)
- ✅ OpenAI API Key
- ✅ Easypanel já instalado (não será afetado)

---

## 🔄 Passo a Passo

### **Passo 1: Copiar Arquivos do PC para Contabo**

Abra **PowerShell** ou **Terminal** no seu PC e execute:

```powershell
scp -r "C:\Users\eduar\OneDrive\Área de Trabalho\hotbot\hotbot\*" root@SEU_IP_CONTABO:/root/hotbot/
```

**Substitua `SEU_IP_CONTABO`** pelo IP do seu VPS (você encontra na dashboard da Contabo).

**Exemplo real:**
```powershell
scp -r "C:\Users\eduar\OneDrive\Área de Trabalho\hotbot\hotbot\*" root@123.45.67.89:/root/hotbot/
```

Ele vai pedir a **senha SSH** - cole a senha do seu VPS.

---

### **Passo 2: Acessar o VPS**

Abra PowerShell e execute:

```powershell
ssh root@SEU_IP_CONTABO
```

Substitua pelo seu IP real. Exemplo:
```powershell
ssh root@123.45.67.89
```

Ele vai pedir a senha SSH - cole novamente.

Pronto! Você está dentro do VPS. 🎉

---

### **Passo 3: Executar o Script de Deploy**

Dentro do VPS, execute:

```bash
bash /root/hotbot/deploy-contabo.sh
```

O script vai:

✅ Atualizar o sistema  
✅ Instalar Node.js (se não tiver)  
✅ Instalar Chromium (para Puppeteer)  
✅ Instalar dependências do projeto  
✅ Pedir sua OpenAI API Key  
✅ Instalar PM2  
✅ Iniciar o bot automaticamente  

**Vai demorar uns 5-10 minutos na primeira vez.**

---

### **Passo 4: Confirmar que Está Rodando**

Após o script terminar, execute:

```bash
pm2 status
```

Você vai ver algo assim:

```
┌────┬─────────┬─────────┬────────┬─────────┐
│ id │ name    │ status  │ cpu    │ memory  │
├────┼─────────┼─────────┼────────┼─────────┤
│ 0  │ hotbot  │ online  │ 0.5%   │ 45.2MB  │
└────┴─────────┴─────────┴────────┴─────────┘
```

Se aparecer `online` = **✅ Está funcionando!**

---

## 📊 Verificar Logs

Para ver o que o bot está fazendo:

```bash
pm2 logs hotbot
```

Você vai ver algo como:

```
🔊 Verificando arquivos de áudio...
✅ saudacao: /root/hotbot/saudacao.mp3
✅ informacoes: /root/hotbot/informacoes.mp3
...
✅ Prompt padrão carregado de SYSTEM_PROMPT.md

📱 ========================================
✅ Autenticado com WhatsApp!
Conectando ao bot...
========================================

✅ ========================================
🚀 BOT CONECTADO E PRONTO PARA USAR!
========================================

📱 Modelo: byanca
🔌 Porta: 5000
📍 Sessão: session-5000

O bot está aguardando mensagens dos leads...
```

---

## 🎮 Comandos Úteis

```bash
# Ver status
pm2 status

# Ver logs em tempo real (sair com Ctrl+C)
pm2 logs hotbot

# Parar o bot (vai ficar parado, não remove)
pm2 stop hotbot

# Reiniciar o bot
pm2 restart hotbot

# Ver uso de CPU e memória
pm2 monit

# Remover o bot (se quiser desinstalar)
pm2 delete hotbot
pm2 save
```

---

## 🌐 Portas Usadas

- **Bot**: 5000, 5001, 5002, ... (conforme adiciona instâncias)
- **Easypanel**: Não afeta (portas diferentes)
- **n8n**: Não afeta (portas diferentes)
- **typebot**: Não afeta (portas diferentes)

Você pode adicionar quantas instâncias quiser pelo painel admin do bot!

---

## 📱 QR Code (Primeira Vez)

Quando o bot inicia pela primeira vez, você precisa **fazer login no WhatsApp**.

O QR Code aparece nos logs. Para ver:

```bash
pm2 logs hotbot | grep -i "qr"
```

Scaneie com WhatsApp no celular e pronto!

---

## ⚠️ Importante

- ✅ O bot **auto-reinicia** se cair
- ✅ Sobrevive a **reboots do VPS**
- ✅ **Não afeta** as outras aplicações (easypanel, n8n, typebot)
- ✅ Rodando **24/7** na Contabo
- ✅ Basta deixar a conexão SSH aberta (ou sair com `exit`)

---

## 🆘 Troubleshooting

### "Comando não encontrado: scp"

Você está no PowerShell? Tente:

```powershell
# PowerShell
scp -r "C:\Users\eduar\OneDrive\Área de Trabalho\hotbot\hotbot\*" root@123.45.67.89:/root/hotbot/
```

Ou use **Git Bash** se tiver instalado.

### "Permission denied (publickey,password)"

A senha está errada ou o IP está errado. Confira na dashboard da Contabo.

### "command not found: bash"

Tente com `sh` em vez de `bash`:

```bash
sh /root/hotbot/deploy-contabo.sh
```

### Bot não está conectando

Verifique os logs:

```bash
pm2 logs hotbot
```

Se houver erro com Chromium, execute:

```bash
apt install -y chromium-browser
pm2 restart hotbot
```

---

## 📞 Próximas Steps

1. ✅ Deploy completo
2. ✅ Bot rodando 24/7
3. ✅ Começar a receber leads
4. ✅ Configurar prompts conforme necessário (editar `SYSTEM_PROMPT.md` e dar `pm2 restart hotbot`)

---

**Pronto! Seu bot está no ar! 🚀**
