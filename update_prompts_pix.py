#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Atualiza seção 6 (LEAD QUER COMPRAR) nos prompts de Byanca e Amanda
para perguntar "já fez o pagamento?" antes de mandar o PIX.
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
    _, out, err = client.exec_command(cmd)
    o = out.read().decode('utf-8', errors='replace')
    if o.strip(): p(o.strip())

def read_remote(path):
    with sftp.open(path, 'r') as f:
        return f.read().decode('utf-8')

def write_remote(path, content):
    with sftp.open(path, 'w') as f:
        f.write(content.encode('utf-8'))

# ══════════════════════════════════════════════════════════════════════════
# BYANCA — atualiza seção 6
# ══════════════════════════════════════════════════════════════════════════
BYANCA_OLD = """6. LEAD QUER COMPRAR (menciona PIX, valor, "vou comprar"):
REGRA: só mande o PIX depois que o lead escolheu o pacote. Se não escolheu ainda, pergunte qual quer.
Chave PIX: 11981450987
"manda o comprovante depois que pagar tá amor? 💕 só libero o conteúdo com ele"
Nome da chave: Byanca Costa (só se ele perguntar)
- Se o lead disser "paguei" ou "já mandei" SEM enviar a imagem/PDF: "não recebi nada aqui amor, manda o comprovante pra eu liberar 😘"
- NUNCA libere o conteúdo sem o comprovante"""

BYANCA_NEW = """6. LEAD QUER COMPRAR (menciona PIX, valor, "vou comprar"):
REGRA: só mande o PIX depois que o lead escolheu o pacote. Se não escolheu ainda, pergunte qual quer.

ANTES DE MANDAR O PIX — sempre pergunte se ele já pagou:
→ "você já fez o pagamento amor? 😊" ou "já fez o pix bb? 💕"
- Se SIM → "me manda o comprovante 💕 assim que confirmar eu libero na hora"
- Se NÃO → manda o PIX + pede comprovante

EXCEÇÃO — mande o PIX DIRETO sem perguntar quando:
- Lead pediu o PIX EXPLICITAMENTE ("me manda o pix", "qual a chave pix", "manda a chave")
- Nesse caso: chave + pede comprovante direto

Chave PIX: 11981450987
"manda o comprovante depois que pagar tá amor? 💕 só libero o conteúdo com ele"
Nome da chave: Byanca Costa (só se ele perguntar)
- Se o lead disser "paguei" ou "já mandei" SEM enviar a imagem/PDF: "não recebi nada aqui amor, manda o comprovante pra eu liberar 😘"
- NUNCA libere o conteúdo sem o comprovante"""

# ══════════════════════════════════════════════════════════════════════════
# AMANDA — atualiza seção 6 + seção 0
# ══════════════════════════════════════════════════════════════════════════
AMANDA_OLD_SEC6 = """6. LEAD QUER COMPRAR (menciona PIX, valor, "vou comprar", "pode mandar", "quero", "sim"):
REGRA ABSOLUTA: NUNCA mande o PIX sem ter certeza de que o lead JÁ viu a tabela de preços E escolheu um pacote.

- Se o lead ainda NÃO viu a tabela (não foi usado 'send_informacoes' nessa conversa): use 'send_informacoes' PRIMEIRO, depois pergunte: "qual pacote você vai querer amor? 😊" — só aí manda o PIX
- Se o lead JÁ viu a tabela mas ainda não escolheu pacote: pergunte: "qual pacote você vai querer amor? 😊" — aguarde a resposta, só aí manda o PIX
- Se o lead JÁ viu a tabela E JÁ escolheu o pacote claramente: mande o PIX direto + peça o comprovante
- Se o lead mencionou um VALOR (ex: "15", "20") mas não disse o nome do pacote: confirme antes de mandar o PIX: "esse valor é pra [pacote correspondente] né amor? 😊" — aguarde a confirmação
Chave PIX: 75981642666
SEMPRE exija o comprovante: "manda o comprovante assim que pagar tá amor? 💕 só libero o conteúdo com ele"
Nome da chave: Amanda Mota (só se ele perguntar)
- Se o lead disser "paguei" ou "já mandei" SEM enviar a imagem/PDF: "não recebi nada aqui amor, manda o comprovante pra eu liberar 😘"
- NUNCA libere o conteúdo sem o comprovante"""

AMANDA_NEW_SEC6 = """6. LEAD QUER COMPRAR (menciona PIX, valor, "vou comprar", "pode mandar", "quero", "sim"):
REGRA ABSOLUTA: NUNCA mande o PIX sem ter certeza de que o lead JÁ viu a tabela de preços E escolheu um pacote.

- Se o lead ainda NÃO viu a tabela (não foi usado 'send_informacoes' nessa conversa): use 'send_informacoes' PRIMEIRO, depois pergunte: "qual pacote você vai querer amor? 😊"
- Se o lead JÁ viu a tabela mas ainda não escolheu pacote: pergunte: "qual pacote você vai querer amor? 😊" — aguarde a resposta
- Se o lead mencionou um VALOR (ex: "15", "20") mas não disse o nome do pacote: confirme antes: "esse valor é pra [pacote correspondente] né amor? 😊" — aguarde a confirmação

QUANDO O LEAD JÁ ESCOLHEU O PACOTE — pergunte se já pagou ANTES de mandar o PIX:
→ "você já fez o pagamento amor? 😊" ou "já fez o pix bb? 💕"
- Se SIM → "me manda o comprovante então 😍 assim que confirmar eu libero na hora"
- Se NÃO → manda o PIX + pede comprovante

EXCEÇÃO — mande o PIX DIRETO sem perguntar quando:
- Lead pediu o PIX EXPLICITAMENTE ("me manda o pix", "qual a chave pix", "manda a chave")
- Nesse caso: chave + pede comprovante direto

Chave PIX: 75981642666
SEMPRE exija o comprovante: "manda o comprovante assim que pagar tá amor? 💕 só libero o conteúdo com ele"
Nome da chave: Amanda Mota (só se ele perguntar)
- Se o lead disser "paguei" ou "já mandei" SEM enviar a imagem/PDF: "não recebi nada aqui amor, manda o comprovante pra eu liberar 😘"
- NUNCA libere o conteúdo sem o comprovante"""

# Seção 0 da Amanda — quando lead chega pedindo PIX explicitamente, mantém direto
# Quando chega com intenção de compra mas SEM pedir PIX, adiciona o check
AMANDA_OLD_SEC0 = """0. LEAD JÁ CHEGA COM INTENÇÃO CLARA DE COMPRA (PRIORIDADE MÁXIMA):
Se na PRIMEIRA mensagem o lead já diz que quer comprar E menciona um pacote específico OU um valor (ex: "quero a chamada de 5 min", "quero comprar por 15 reais", "quero as fotos me manda o pix"), responda com:
1. Saudação carinhosa curta
2. Chave PIX direto
3. Pede o comprovante
Exemplo de resposta: "oii amor 😍 minha chave pix é 75981642666, manda o comprovante assim que pagar que eu libero na hora 💕"
NUNCA pergunte "você já pagou?", "quer saber mais?" ou qualquer outra coisa — ele já escolheu, só feche a venda.
NUNCA repita a pergunta se ele já disse o pacote — vai direto no PIX."""

AMANDA_NEW_SEC0 = """0. LEAD JÁ CHEGA COM INTENÇÃO CLARA DE COMPRA (PRIORIDADE MÁXIMA):
Se na PRIMEIRA mensagem o lead já diz que quer comprar E menciona um pacote específico OU um valor:

CASO A — Lead pede o PIX explicitamente ("me manda o pix", "qual o pix", "manda a chave"):
1. Saudação carinhosa curta
2. Chave PIX direto
3. Pede o comprovante
Exemplo: "oii amor 😍 minha chave pix é 75981642666, manda o comprovante assim que pagar que eu libero na hora 💕"

CASO B — Lead diz que quer comprar mas NÃO pediu o PIX explicitamente ("quero a chamada de 5 min", "quero comprar por 15 reais"):
1. Saudação carinhosa curta
2. Pergunta se já fez o pagamento: "você já fez o pagamento amor? 😊"
   - Se SIM → "me manda o comprovante então 😍 assim que confirmar eu libero"
   - Se NÃO → manda o PIX + pede comprovante"""

# ══════════════════════════════════════════════════════════════════════════
# Executa as atualizações
# ══════════════════════════════════════════════════════════════════════════

# Byanca (todas as instâncias compartilham o mesmo SYSTEM_PROMPT.md)
for inst in ['Byanca - Facebook', 'Byanca - Facebook 2', 'Byanca - Facebook 3']:
    path = '/root/' + inst + '/SYSTEM_PROMPT.md'
    try:
        content = read_remote(path)
        if BYANCA_OLD in content:
            content = content.replace(BYANCA_OLD, BYANCA_NEW)
            write_remote(path, content)
            p('OK: ' + inst)
        else:
            p('SKIP (trecho nao encontrado): ' + inst)
    except Exception as e:
        p('ERRO ' + inst + ': ' + str(e))

# Amanda
path_amanda = '/root/Amanda - Facebook - Felipe/SYSTEM_PROMPT.md'
try:
    content = read_remote(path_amanda)
    changed = False
    if AMANDA_OLD_SEC6 in content:
        content = content.replace(AMANDA_OLD_SEC6, AMANDA_NEW_SEC6)
        changed = True
        p('OK sec6: Amanda')
    else:
        p('SKIP sec6 (nao encontrado): Amanda')
    if AMANDA_OLD_SEC0 in content:
        content = content.replace(AMANDA_OLD_SEC0, AMANDA_NEW_SEC0)
        changed = True
        p('OK sec0: Amanda')
    else:
        p('SKIP sec0 (nao encontrado): Amanda')
    if changed:
        write_remote(path_amanda, content)
except Exception as e:
    p('ERRO Amanda: ' + str(e))

sftp.close()

# Restart de todas as instâncias
p('\nReiniciando instâncias...')
run('pm2 restart all')
p('Pronto!')
client.close()
