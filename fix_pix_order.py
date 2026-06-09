#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Corrige ordem do PIX nos prompts:
ERRADO: perguntar "já fez o pix?" antes de mandar a chave
CERTO:  mandar a chave PIX primeiro, DEPOIS pedir comprovante
"""
import paramiko, sys

HOST = '212.47.73.205'
USER = 'root'
PASS = 'o628bgdJGNRse2wato7sAdAJ'

def p(msg):
    sys.stdout.buffer.write((str(msg) + '\n').encode('utf-8'))

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=15)
sftp = client.open_sftp()

def run(cmd):
    _, out, _ = client.exec_command(cmd)
    o = out.read().decode('utf-8', errors='replace')
    if o.strip(): p(o.strip())

def read_remote(path):
    with sftp.open(path, 'r') as f:
        return f.read().decode('utf-8')

def write_remote(path, content):
    with sftp.open(path, 'w') as f:
        f.write(content.encode('utf-8'))

# ── BYANCA ────────────────────────────────────────────────────────────────────
BYANCA_OLD = """6. LEAD QUER COMPRAR (menciona PIX, valor, "vou comprar"):
REGRA: só mande o PIX depois que o lead escolheu o pacote. Se não escolheu ainda, pergunte qual quer.
Chave PIX: 11981450987
"manda o comprovante depois que pagar tá amor? 💕 só libero o conteúdo com ele"
Nome da chave: Byanca Costa (só se ele perguntar)
- Se o lead disser "paguei" ou "já mandei" SEM enviar a imagem/PDF: "não recebi nada aqui amor, manda o comprovante pra eu liberar 😘"
- NUNCA libere o conteúdo sem o comprovante"""

BYANCA_NEW = """6. LEAD QUER COMPRAR (menciona PIX, valor, "vou comprar"):
REGRA: só mande o PIX depois que o lead escolheu o pacote. Se não escolheu ainda, pergunte qual quer.

ORDEM OBRIGATÓRIA — SEMPRE nessa sequência:
1. Manda a chave PIX
2. Pede o comprovante: "manda o comprovante depois que pagar tá amor? 💕"
NUNCA pergunte "você já fez o pix?" ou "já pagou?" ANTES de mandar a chave PIX. A chave vai primeiro, sempre.

Chave PIX: 11981450987
Nome da chave: Byanca Costa (só se ele perguntar)
- Se o lead disser "paguei" ou "já mandei" SEM enviar a imagem/PDF: "não recebi nada aqui amor, manda o comprovante pra eu liberar 😘"
- NUNCA libere o conteúdo sem o comprovante"""

# ── AMANDA ────────────────────────────────────────────────────────────────────
AMANDA_OLD = """- Se o lead JÁ viu a tabela E JÁ escolheu o pacote claramente: mande o PIX direto + peça o comprovante
- Se o lead mencionou um VALOR (ex: "15", "20") mas não disse o nome do pacote: confirme antes de mandar o PIX: "esse valor é pra [pacote correspondente] né amor? 😊" — aguarde a confirmação
Chave PIX: 75981642666
SEMPRE exija o comprovante: "manda o comprovante assim que pagar tá amor? 💕 só libero o conteúdo com ele"
Nome da chave: Amanda Mota (só se ele perguntar)
- Se o lead disser "paguei" ou "já mandei" SEM enviar a imagem/PDF: "não recebi nada aqui amor, manda o comprovante pra eu liberar 😘"
- NUNCA libere o conteúdo sem o comprovante"""

AMANDA_NEW = """- Se o lead JÁ viu a tabela E JÁ escolheu o pacote claramente: mande o PIX direto + peça o comprovante
- Se o lead mencionou um VALOR (ex: "15", "20") mas não disse o nome do pacote: confirme antes de mandar o PIX: "esse valor é pra [pacote correspondente] né amor? 😊" — aguarde a confirmação

ORDEM OBRIGATÓRIA — SEMPRE nessa sequência:
1. Manda a chave PIX
2. Pede o comprovante: "manda o comprovante assim que pagar tá amor? 💕"
NUNCA pergunte "você já fez o pix?" ou "já pagou?" ANTES de mandar a chave PIX. A chave vai primeiro, sempre.

Chave PIX: 75981642666
SEMPRE exija o comprovante: "manda o comprovante assim que pagar tá amor? 💕 só libero o conteúdo com ele"
Nome da chave: Amanda Mota (só se ele perguntar)
- Se o lead disser "paguei" ou "já mandei" SEM enviar a imagem/PDF: "não recebi nada aqui amor, manda o comprovante pra eu liberar 😘"
- NUNCA libere o conteúdo sem o comprovante"""

# ── Aplica ────────────────────────────────────────────────────────────────────
for inst in ['Byanca - Facebook', 'Byanca - Facebook 2', 'Byanca - Facebook 3']:
    path = '/root/' + inst + '/SYSTEM_PROMPT.md'
    try:
        content = read_remote(path)
        if BYANCA_OLD in content:
            write_remote(path, content.replace(BYANCA_OLD, BYANCA_NEW))
            p('OK: ' + inst)
        else:
            p('SKIP (trecho nao encontrado): ' + inst)
    except Exception as e:
        p('ERRO ' + inst + ': ' + str(e))

path_amanda = '/root/Amanda - Facebook - Felipe/SYSTEM_PROMPT.md'
try:
    content = read_remote(path_amanda)
    if AMANDA_OLD in content:
        write_remote(path_amanda, content.replace(AMANDA_OLD, AMANDA_NEW))
        p('OK: Amanda')
    else:
        p('SKIP (trecho nao encontrado): Amanda')
except Exception as e:
    p('ERRO Amanda: ' + str(e))

sftp.close()

p('\nReiniciando instancias...')
run('pm2 restart all')
p('Pronto!')
client.close()
