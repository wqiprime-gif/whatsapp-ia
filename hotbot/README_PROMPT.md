# 📝 Como Configurar o Prompt do Bot

## Opção 1: Alterar o Prompt Padrão (Recomendado)

O arquivo **`SYSTEM_PROMPT.md`** contém o prompt padrão que o bot usa para todas as sessões.

### Para editar:
1. Abra o arquivo `SYSTEM_PROMPT.md` em qualquer editor de texto
2. Faça as mudanças que desejar
3. Salve o arquivo
4. **Reinicie o bot** (vai automaticamente carregar o novo prompt)

### Exemplo de alterações comuns:

**Mudar o nome da modelo:**
```
Você se chama Byanca Costa
```
Para:
```
Você se chama Sofia Silva
```

**Mudar a localização:**
```
mora em São Paulo mas nasceu no Rio de Janeiro
```
Para:
```
mora em Salvador mas nasceu em Brasília
```

**Mudar a chave PIX:**
```
RESPONDA QUE A CHAVE PIX É: 11954229041
```
Para:
```
RESPONDA QUE A CHAVE PIX É: 11987654321
```

---

## Opção 2: Criar Prompt Customizado por Sessão

Se você quiser ter **prompts diferentes** para cada bot/modelo:

1. Crie um arquivo JSON na pasta `prompts/`:
   - Exemplo: `prompts/session-4004-prompt.json`

2. Cole o seguinte conteúdo:
```json
{
  "prompt": "Seu prompt customizado aqui..."
}
```

3. Este prompt customizado **sobrescreve o padrão** apenas para essa sessão

### Quando usar:
- Múltiplas modelos com personalidades diferentes
- Testes A/B de diferentes abordagens
- Ajustes específicos por cliente

---

## ⚠️ Importante

- O bot carrega o prompt **ao iniciar** (quando você roda `npm start`)
- Mudanças no `SYSTEM_PROMPT.md` só funcionam **após reiniciar o bot**
- Não reinicie enquanto há leads conversando (vai desconectar deles)
- Recomendação: reinicie de madrugada ou em horário com menos uso

---

## 🔍 Verificar Qual Prompt Está Sendo Usado

Quando o bot inicia, ele mostra:

```
✅ Prompt padrão carregado de SYSTEM_PROMPT.md
```

Ou:

```
✅ Prompt customizado carregado.
```

---

## 📋 Dicas

- **Mantenha textos curtos**: A instrução diz "não mande mais que 2 frases NUNCA!"
- **Use emojis**: Deixa mais natural e atrativo
- **Seja direto**: Foco em vender
- **Teste as funções**: `send_informacoes`, `send_amostra_gratis`, `naosou_fake`, `archive_chat`

---

**Qualquer dúvida, edite o `SYSTEM_PROMPT.md` e reinicie o bot!** 🚀
