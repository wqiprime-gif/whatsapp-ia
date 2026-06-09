#!/usr/bin/env python3
"""
Deploy do HotBot Admin Panel para o VPS
Envia os arquivos admin e reinicia o PM2
"""
import paramiko, os, sys

HOST   = '212.47.73.205'
USER   = 'root'
PASS   = 'o628bgdJGNRse2wato7sAdAJ'
REMOTE = '/root/hotbot-admin'

LOCAL_DIR = r'C:\Users\eduar\OneDrive\Área de Trabalho\hotbot\hotbot-admin'
FILES = ['admin-server.js', 'admin.html', 'package.json']

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=15)
sftp = client.open_sftp()

def run(cmd):
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    if out.strip(): sys.stdout.buffer.write((out + '\n').encode('utf-8'))
    if err.strip(): sys.stdout.buffer.write(('ERR: ' + err + '\n').encode('utf-8'))

# Cria o diretório se não existir
run(f'mkdir -p {REMOTE}')

# Upload dos arquivos
for filename in FILES:
    local  = os.path.join(LOCAL_DIR, filename)
    remote = f'{REMOTE}/{filename}'
    sys.stdout.buffer.write(f'📤 Enviando {filename}...\n'.encode('utf-8'))
    sftp.put(local, remote)
    sys.stdout.buffer.write(f'   ✅ {remote}\n'.encode('utf-8'))

sftp.close()

# npm install no servidor
sys.stdout.buffer.write(b'\n📦 Instalando dependências...\n')
run(f'cd {REMOTE} && npm install --production 2>&1')

# Verifica se já existe processo PM2 hotbot-admin
_, out, _ = client.exec_command('pm2 describe hotbot-admin 2>&1')
desc = out.read().decode('utf-8', errors='replace')

if 'hotbot-admin' in desc and 'status' in desc:
    sys.stdout.buffer.write(b'\n🔄 Reiniciando PM2...\n')
    run('pm2 restart hotbot-admin')
else:
    sys.stdout.buffer.write(b'\n🚀 Iniciando hotbot-admin no PM2...\n')
    run(f'cd {REMOTE} && pm2 start admin-server.js --name hotbot-admin -- 2>&1')
    run('pm2 save')

run('pm2 status')
sys.stdout.buffer.write(b'\n✅ Admin Panel deployado! Acesse: http://212.47.73.205:3000\n')
client.close()
