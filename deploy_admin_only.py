#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import paramiko, sys, os

HOST = '212.47.73.205'
USER = 'root'
PASS = 'o628bgdJGNRse2wato7sAdAJ'

LOCAL_ADMIN_DIR = os.path.join(os.path.dirname(__file__), 'hotbot-admin')
REMOTE_ADMIN = '/root/hotbot-admin'

def p(msg):
    sys.stdout.buffer.write((str(msg) + '\n').encode('utf-8'))

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=15)
sftp = client.open_sftp()

def run(cmd):
    _, out, err = client.exec_command(cmd)
    o = out.read().decode('utf-8', errors='replace')
    e = err.read().decode('utf-8', errors='replace')
    if o.strip(): p(o.strip())
    if e.strip(): p('ERR: ' + e.strip())

for fname in ['admin-server.js', 'admin.html', 'package.json']:
    local  = os.path.join(LOCAL_ADMIN_DIR, fname)
    remote = REMOTE_ADMIN + '/' + fname
    p('Enviando: ' + fname)
    sftp.put(local, remote)
    p('   OK')

sftp.close()

p('Reiniciando hotbot-admin...')
run('pm2 restart hotbot-admin')
import time; time.sleep(2)
run('pm2 status')
run('pm2 logs hotbot-admin --lines 5 --nostream --raw')

p('\nAdmin Panel: http://212.47.73.205:3001')
p('Senha: hotbot2025')
client.close()
