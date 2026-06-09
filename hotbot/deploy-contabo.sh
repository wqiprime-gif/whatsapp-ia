#!/bin/bash

# 🚀 Script de Deploy Automático - HOTBOT na Contabo
# Execute como: bash deploy-contabo.sh

set -e

echo "════════════════════════════════════════════"
echo "🚀 DEPLOY AUTOMÁTICO - HOTBOT"
echo "════════════════════════════════════════════"
echo ""

# 1. Verificar se é root
if [[ $EUID -ne 0 ]]; then
   echo "❌ Este script precisa ser executado como root"
   echo "Execute: sudo bash deploy-contabo.sh"
   exit 1
fi

# 2. Update do sistema
echo "📦 Atualizando sistema..."
apt update && apt upgrade -y

# 3. Verificar/Instalar Node.js
echo "⚙️  Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "📥 Instalando Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
else
    echo "✅ Node.js já instalado: $(node --version)"
fi

# 4. Instalar dependências do Puppeteer/Chromium
echo "🎨 Instalando Chromium e dependências..."
apt install -y \
    chromium-browser \
    libxss1 \
    libappindicator1 \
    libindicator7 \
    libnss3 \
    libnss3-dev \
    libgconf-2-4 \
    libgconf-2 \
    libxss1 \
    xdg-utils \
    fonts-liberation \
    libappindicator3-1 \
    libindicator7 \
    libxss1 \
    libappindicator1 \
    libindicator7

# 5. Criar diretório do projeto
echo "📁 Criando diretório do projeto..."
mkdir -p /root/hotbot
cd /root/hotbot

# 6. Copiar arquivos (se ainda não existirem)
if [ ! -f "/root/hotbot/package.json" ]; then
    echo "📋 Aguardando upload dos arquivos..."
    echo ""
    echo "⚠️  Você precisa copiar os arquivos do seu PC para o VPS."
    echo ""
    echo "No seu PC, execute (PowerShell ou Cmd):"
    echo ""
    echo "scp -r \"C:\\Users\\eduar\\OneDrive\\Área de Trabalho\\hotbot\\hotbot\\*\" root@SEU_IP_CONTABO:/root/hotbot/"
    echo ""
    echo "Substitua SEU_IP_CONTABO pelo IP da sua Contabo"
    echo ""
    echo "Pressione ENTER quando os arquivos estiverem copiados..."
    read
fi

# 7. Instalar dependências Node
echo "📦 Instalando dependências do Node..."
npm install

# 8. Criar .env se não existir
if [ ! -f "/root/hotbot/.env" ]; then
    echo "🔐 Criando arquivo .env..."
    echo ""
    echo "Qual é sua OPENAI_API_KEY?"
    read -p "Cole sua chave: " API_KEY

    cat > /root/hotbot/.env << EOF
OPENAI_API_KEY=$API_KEY
EOF

    echo "✅ .env criado"
else
    echo "✅ .env já existe"
fi

# 9. Instalar PM2 globalmente
echo "🔧 Instalando PM2..."
npm install -g pm2

# 10. Iniciar o bot com PM2
echo "🚀 Iniciando o bot com PM2..."
pm2 start /root/hotbot/index.js --name "hotbot" --time
pm2 save
pm2 startup

# 11. Dar permissão de execução
chmod +x /root/hotbot/index.js

echo ""
echo "════════════════════════════════════════════"
echo "✅ DEPLOY CONCLUÍDO!"
echo "════════════════════════════════════════════"
echo ""
echo "📊 Status do Bot:"
pm2 status
echo ""
echo "📝 Próximos passos:"
echo ""
echo "1. Ver logs em tempo real:"
echo "   pm2 logs hotbot"
echo ""
echo "2. Ver status:"
echo "   pm2 status"
echo ""
echo "3. Parar o bot:"
echo "   pm2 stop hotbot"
echo ""
echo "4. Reiniciar o bot:"
echo "   pm2 restart hotbot"
echo ""
echo "5. Ver QR Code (primeira execução):"
echo "   pm2 logs hotbot | grep QR"
echo ""
echo "🔗 O bot está usando PORTAS 5000+:"
echo "   - Primeira instância: 5000"
echo "   - Segunda instância: 5001"
echo "   - E assim por diante..."
echo ""
echo "⚠️  IMPORTANTE:"
echo "   - Seu easypanel não será afetado (portas diferentes)"
echo "   - O bot vai auto-reiniciar se cair"
echo "   - Vai sobreviver a reboot do VPS"
echo ""
echo "════════════════════════════════════════════"
