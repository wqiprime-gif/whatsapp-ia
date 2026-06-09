import paramiko, sys

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('212.47.73.205', username='root', password='o628bgdJGNRse2wato7sAdAJ', timeout=15)

instances = ['Amanda - Facebook - Felipe', 'Byanca - Facebook']
for inst in instances:
    stdin, stdout, stderr = client.exec_command(f'cat "/root/{inst}/pacotes.json" 2>/dev/null || echo "NAO_EXISTE"')
    out = stdout.read().decode('utf-8', errors='replace')
    sys.stdout.buffer.write(f'\n=== {inst} ===\n'.encode('utf-8'))
    sys.stdout.buffer.write(out.encode('utf-8'))

client.close()
