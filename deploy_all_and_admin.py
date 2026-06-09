#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Deploy completo:
  1. bot-instance.js atualizado (com qr.json) para todas as instâncias
  2. Admin Panel para /root/hotbot-admin
"""
import paramiko, os, sys

HOST = '212.47.73.205'
USER = 'root'
PASS = 'o628bgdJGNRse2wato7sAdAJ'

INSTANCES = [
    'Byanca - Facebook',
    'Byanca - Facebook 2',
    'Byanca - Facebook 3',
    'Amanda - Facebook - Felipe',
]

LOCAL_BOT       = r'C:\Users\eduar\OneDrive\Área de Trabalho\hotbot\hotbot\bot-instance.js'
LOCAL_ADMIN_DIR = r'C:\Users\eduar\OneDrive\Área de Trabalho\hotbot\hotbot-admin'
ADMIN_FILES = ['admin-server.js', 'admin.html', 'package.json']

def p(msg):
    sys.stdout.buffer.write((msg + '\n').encode('utf-8'))

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=15)
sftp = client.open_sftp()

def run(cmd):
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    if out.strip(): p(out.strip())
    if err.strip(): p('ERR: ' + err.strip())

# 1. Deploy bot-instance.js para todas as instancias
p('\n===== DEPLOY BOT-INSTANCE.JS =====')
for inst in INSTANCES:
    remote = '/root/' + inst + '/bot-instance.js'
    p('Enviando: ' + inst + '...')
    try:
        sftp.put(LOCAL_BOT, remote)
        p('   OK')
    except Exception as e:
        p('   ERRO: ' + str(e))

# 2. pm2 restart all
p('\nReiniciando todas as instancias...')
run('pm2 restart all')

# 3. Deploy Admin Panel
p('\n===== DEPLOY ADMIN PANEL =====')
REMOTE_ADMIN = '/root/hotbot-admin'
run('mkdir -p ' + REMOTE_ADMIN)

for filename in ADMIN_FILES:
    local  = os.path.join(LOCAL_ADMIN_DIR, filename)
    remote = REMOTE_ADMIN + '/' + filename
    p('Enviando: ' + filename + '...')
    sftp.put(local, remote)
    p('   OK: ' + remote)

sftp.close()

p('\nnpm install do admin...')
run('cd ' + REMOTE_ADMIN + ' && npm install --production 2>&1')

# PM2 para admin
_, out2, _ = client.exec_command('pm2 describe hotbot-admin 2>&1')
desc = out2.read().decode('utf-8', errors='replace')
if 'hotbot-admin' in desc and 'online' in desc:
    p('\nReiniciando hotbot-admin...')
    run('pm2 restart hotbot-admin')
else:
    p('\nIniciando hotbot-admin...')
    run('cd ' + REMOTE_ADMIN + ' && pm2 start admin-server.js --name hotbot-admin 2>&1')
    run('pm2 save')

p('\nStatus PM2:')
run('pm2 status')

p('\nDEPLOY COMPLETO!')
p('Admin Panel: http://212.47.73.205:3000')
p('Senha padrao: hotbot2025')
client.close()
