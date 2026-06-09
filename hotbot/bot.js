const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { OpenAI } = require("openai");
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const port = process.env.PORT || 4000;
const filePath = 'messages.json';
const qrcode = require('qrcode');
const gerarCPFValido = require('./utils/gerarcpf');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');


puppeteer.use(StealthPlugin());

const clientId = 'teste';
const client = new Client({
  authStrategy: new LocalAuth({ clientId: clientId }),
  puppeteer: {
    executablePath: puppeteer.executablePath(),
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-web-security',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--autoplay-policy=no-user-gesture-required',
    ],
  },
});

client.initialize();

const openAiApiKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({
  apiKey: openAiApiKey,
});

const MAX_TOKENS = 256;
const userConversations = {};
const hasSentInformacoes = {};
const hasSentAmostra = {};
const hasSentNaoSouFake = {};
const arrayImport = require('./arrayImport');
const messageBuffers = {};
const bufferTimers = {};
let isProcessing = {};
const isWatchingPayment = {}
const paymentIdGlobal = {}

function getUserConversation(userNumber) {
  if (!userConversations[userNumber]) {
    userConversations[userNumber] = [
      { role: "system", content: JSON.stringify(arrayImport) }
    ];
    hasSentInformacoes[userNumber] = false;
    hasSentAmostra[userNumber] = false;
    hasSentNaoSouFake[userNumber] = false;
  }
  return userConversations[userNumber];
}

async function runCompletion(userNumber, message) {
  const conversation = getUserConversation(userNumber);
  if (conversation.length >= 15) {
    conversation.splice(1, 1);
  }
  conversation.push({ role: "user", content: message });

  try {
    const functions = [
      {
        name: 'send_saudacao',
        description: 'Use a função send_saudacao na a sua primeira mensagem com o usuário. Não use outras funções na primeira interação, Apenas a send_saudacao',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'send_informacoes',
        description: 'Use a função send_informacoes na sua segunda interação para informar sobre valores, quantidade de fotos, videos e etc e tambem para enviar informacoes sobre o pacote.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'send_chave_pix',
        description: 'Use a função send_chave_pix para enviar a chave pix no formato Copia e Cola. Use o parametro de preço de acordo com o pack que foi escolhido. No formato 29.99 ou 49.99. Só é necessário o valor do pix, as outras informações devem ser totalmente aleatorias  para satisfazer a api. Não use informações muito genericas, aleatorize de verdade.',
        parameters: {
          type: 'object',
          properties: {
            valorPix: { type: 'string', description: 'Valor do pacote escolhido.' },
            nome: { type: 'string', description: 'Faça uma lista de nomes aleatórios e coloque somente um aleatorio nessa string' },
            sobrenome: { type: 'string', description: 'Faça uma lista de sobrenomes aleatórios e coloque somente um aleatorio nessa string' },
            email: { type: 'string', description: 'Faça o email no formato: nome.sobrenome99@gmail.com, ou use outlook.com, hotmail.com, etc. O 99 pode ser qualquer número' },
          },
        },
      },
      {
        name: 'archive_chat',
        description: 'Use a função archive_chat quando o usuario mostrar desinteresse em adquirir os conteudos e fotos ou quando não tiver dinheiro para comprar os conteudos',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'send_amostra_gratis',
        description: 'Use a função send_amostra_gratis para enviar uma foto de amostra gratuita. Use para quando pedirem amostras gratis e tambem quando pedirem uma foto, ou teste grátis.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'chamada_video',
        description: 'Use a função chamada_video para dizer que faz sim chamadas de vídeo e para informar sobre os valores da chamada de vídeo.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'naosou_fake',
        description: 'Use a função naosou_fake quando o usuário achar que é golpe ou fake ou se questionar se é você mesmo na foto. Essa função irá provar que você não é fake.',
        parameters: {
          type: 'object',
          properties: {},
        },
      }
    ];

    const availableFunctions = hasSentInformacoes[userNumber] ? functions.filter(f => f.name !== 'send_informacoes') : functions;
    console.log(`Funções disponíveis para ${userNumber}:`, availableFunctions.map(f => f.name));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: conversation,
      max_tokens: MAX_TOKENS,
      n: 1,
      functions: availableFunctions,
    });

    const choice = completion.choices[0];
    const functionCall = choice.message?.function_call;

    console.log(`Resultado da completude para ${userNumber}:`, choice);
    console.log(`Function call detectada: ${functionCall?.name}`);

    if (hasSentNaoSouFake[userNumber] && functionCall?.name === 'naosou_fake') {
      const response = `Te garanto que sou real tá? 😉`;
      conversation.push({ role: "assistant", content: response });
      return response;
    }
    if (hasSentAmostra[userNumber] && functionCall?.name === 'send_amostra_gratis') {
      const response = `Eu já te enviei a amostra bb... Posso te mandar a chave pix para vc adquirir o pack completo? 😉`;
      conversation.push({ role: "assistant", content: response });
      return response;
    }

    if (hasSentInformacoes[userNumber] && functionCall?.name === 'send_informacoes') {
      const response = `Tenho pacotes exclusivos! 💖Pacote Prata: 9 fotos e 5 vídeos por R$30. Pacote Ouro: 12 fotos e 8 vídeos por R$50. Posso te mandar a chave pix? 😉`;
      conversation.push({ role: "assistant", content: response });
      return response;
    }

    if (functionCall && functionCall.name && functionCalls[functionCall.name]) {
      if (functionCall.name === 'send_informacoes' && !hasSentInformacoes[userNumber]) {
        hasSentInformacoes[userNumber] = true;
        await functionCalls[functionCall.name](client, userNumber, conversation);
        return '';
      } if (functionCall.name === 'send_amostra_gratis' && !hasSentAmostra[userNumber]) {
        hasSentAmostra[userNumber] = true;
        await functionCalls[functionCall.name](client, userNumber, conversation);
        return '';
      }
      if (functionCall.name === 'naosou_fake' && !hasSentNaoSouFake[userNumber]) {
        hasSentNaoSouFake[userNumber] = true;
        await functionCalls[functionCall.name](client, userNumber, conversation);
        return '';
      }
      if (functionCall.name === 'archive_chat' ) {
        await functionCalls[functionCall.name](client, userNumber, conversation);
        return '';
      }
      if (functionCall.name === 'chamada_video' ) {
        await functionCalls[functionCall.name](client, userNumber, conversation);
        return '';
      }
      await functionCalls[functionCall.name](JSON.parse(functionCall.arguments), userNumber, conversation);
      return '';
    }

    const assistantMessage = choice.message?.content || '';
    console.log(`Mensagem do assistente para ${userNumber}:`, assistantMessage);
    conversation.push({ role: "assistant", content: assistantMessage });
    return assistantMessage;
  } catch (error) {
    console.error('Error in runCompletion:', error.message);
    return;
  }
}

const functionCalls = {
  send_saudacao: async (arguments, messageFrom, conversation) => { await sendSaudacao(messageFrom, conversation); },
  send_informacoes: async (client, messageFrom, conversation) => { await sendInformacoes(client, messageFrom, conversation); },
  send_chave_pix: async (arguments, messageFrom, conversation) => { await sendChavePix(arguments, messageFrom, conversation); },
  send_amostra_gratis: async (client, messageFrom, conversation) => { await sendAmostraGratis(client, messageFrom, conversation); },
  archive_chat: async (client, messageFrom, conversation) => { await archiveChat(client, messageFrom, conversation); },
  chamada_video: async (client, messageFrom, conversation) => { await chamadaVideo(client, messageFrom, conversation); },
  naosou_fake: async (client, messageFrom, conversation) => { await naosouFake(client, messageFrom, conversation); },
};

async function sendSaudacao(messageFrom, conversation) {
  try {
    isProcessing[messageFrom] = true;
    console.log('Iniciando saudacao para ', messageFrom);
    
    const mediaPaths = ['./saudacao.mp3'];
    const mediaFiles = []
    for (const mediaPath of mediaPaths) {
      try {
        const media = MessageMedia.fromFilePath(mediaPath);
        mediaFiles.push(media);
      } catch (error) {
        console.error('Erro ao carregar mídia:', error.message);
      }
    }
    const [media] = mediaFiles;
    const chat = await client.getChatById(messageFrom);
    if (!chat){
      console.error('Erro ao obter chat para send_saudacao');
      return;
    }
    await chat.sendStateRecording();
    await new Promise(resolve => setTimeout(resolve, 19000));
    await client.sendMessage(messageFrom, media, {sendAudioAsVoice: true});
    console.log(`Audio saudacao enviado para ${messageFrom}`);
    conversation.push({ role: "system", content: 'Foi enviada a saudação para o usuário em forma de audio.' });
    conversation.push({ role: "assistant", content: 'Oi amor, tudo bem com você? Então... Eu trabalho com a venda de conteúdo adulto e eu peço que você responda somente se você tiver interesse de comprar. Eu prometo que você não vai se arrepender.' });
    isProcessing[messageFrom] = false
  } catch (error) {
    console.error('Error sending send_saudacao:', error.message);
  }
}

async function sendInformacoes(client, messageFrom, conversation) {
  try {
    isProcessing[messageFrom] = true;
    console.log('Iniciando send_informacoes para ', messageFrom);
    const informacoes = MessageMedia.fromFilePath('./informacoes.mp3');
    const precos = MessageMedia.fromFilePath('./precos.jpg');
    const qualpack = MessageMedia.fromFilePath('./qualpack.mp3');
    const chat = await client.getChatById(messageFrom);
    if (!chat){
      console.error('Erro ao obter chat para send_informacoes');
      return;
    }
    await chat.sendStateRecording();
    await new Promise(resolve => setTimeout(resolve, 7000));
    await client.sendMessage(messageFrom, informacoes, {sendAudioAsVoice: true});
    conversation.push({ role: "assistant", content: 'Me conta aqui amor... Qual pacote que você mais se interessou?' });
    console.log(`Audio 1 enviado para ${messageFrom}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await client.sendMessage(messageFrom, precos);
    conversation.push({ role: "system", content: 'Foi enviado as informações sobre os packs com preços e quantidades de fotos e etc.' });
    console.log(`Tabela de precos enviado para ${messageFrom}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    chat.sendStateRecording();
    await new Promise(resolve => setTimeout(resolve, 7000));
    await client.sendMessage(messageFrom, qualpack, {sendAudioAsVoice: true});
    isProcessing[messageFrom] = false;
    }
    catch (error) {
      console.error('Error sending send_informacoes:', error.message);
    }
  }
  const ACCESS_TOKEN = process.env.ACCESS_TOKEN
  async function sendChavePix(arguments, messageFrom, conversation) {
    isWatchingPayment[messageFrom] = true
    const valorPix = arguments.valorPix
    const url = "https://api.wiinpay.com.br/payment/create";

    const paymentData = {
      api_key: ACCESS_TOKEN,
      value: parseFloat(valorPix),
      name: arguments.nome,
      email: arguments.email,
      description: "Transação de doação",
      metadata: {
        cpf: gerarCPFValido(),
        sobrenome: arguments.sobrenome
      }
    };

    console.log("payment data:", paymentData);

    try {
      const response = await axios.post(url, paymentData, {
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        }
      });
      const chavepixaudio = MessageMedia.fromFilePath('./chavepix.mp3');
      const chat = await client.getChatById(messageFrom);
      paymentIdGlobal[messageFrom] = response.data.id;
      const copiaColaPix = response.data.qr_code;
      console.log(`\n💳 [PAGAMENTO INICIADO]`);
      console.log(`   Número: ${messageFrom}`);
      console.log(`   Valor: R$ ${valorPix}`);
      console.log(`   ID Transação: ${response.data.id}`);
      console.log(`   Status: Aguardando pagamento\n`);
      chat.sendStateRecording()
      await new Promise(resolve => setTimeout(resolve, 15000));
      await client.sendMessage(messageFrom, chavepixaudio, {sendAudioAsVoice: true});
      await new Promise(resolve => setTimeout(resolve, 1000));
      chat.sendStateTyping();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await client.sendMessage(messageFrom,`${copiaColaPix}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      chat.sendStateTyping();
      await new Promise(resolve => setTimeout(resolve, 10000));
      await client.sendMessage(messageFrom, `Amor, você vai me ajudar muito com esses R$${valorPix} viu? Muito brigadaa 😍\nA chave pix é copia e cola ☝🏻️`);
      conversation.push({ role: "assistant", content: `Então meu amor, você vai me ajudar muito com esses R$${valorPix} viu? Obrigadaa 😍\nEstou aguardando o pagamento️` });
      conversation.push({ role: "system", content: 'Foi enviada a chave pix para o usuário e ele ainda não pagou. O sistema reconhece automaticamente se foi pago. Então diga que você ainda não recebeu o pagamento e está aguardando ansiosamente para enviar o conteúdo.' });
      verificarStatusPagamento(messageFrom);
  
    } catch (error) {
      console.error("Erro ao gerar Pix:", error.response ? error.response.data : error.message);
    }
  }
  
  async function verificarStatusPagamento(messageFrom) {
    const IdPagamento = paymentIdGlobal[messageFrom];
    console.log("paymentIdGlobal", IdPagamento);
    const url = `https://api.wiinpay.com.br/payment/list/${IdPagamento}`;
      try {
        const response = await axios.get(url, {
          headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${ACCESS_TOKEN}`
          }
        });
        const status = response.data.status;
        console.log(`💰 Status do Pagamento: ${status}`);
        if (status === "PAID") {
          console.log(`✅ [PAGAMENTO CONFIRMADO]`);
          console.log(`   Número: ${messageFrom}`);
          console.log(`   Status: PAGO`);
          console.log(`   Hora: ${new Date().toLocaleTimeString('pt-BR')}\n`);
          hasPaid(messageFrom);
        }
      } catch (error) {
        console.error("Erro ao verificar o status do Pix:", error.response ? error.response.data : error.message);
      }
  }
  

async function sendAmostraGratis(client, messageFrom, conversation) {
  try {
    isProcessing[messageFrom] = true;
    const imagePath = './amostra.jpg';
    const media = MessageMedia.fromFilePath(imagePath);

    const chat = await client.getChatById(messageFrom);
    await client.sendMessage(messageFrom, media, { caption: '', isViewOnce: true });

    await new Promise(resolve => setTimeout(resolve, 5000));
    chat.sendStateTyping();
    await new Promise(resolve => setTimeout(resolve, 2000));
    const response = `Gostou amor? 😘\nPosso te mandar minha chave pix?`;
    await client.sendMessage(messageFrom, response);
    conversation.push({ role: "assistant", content: response });
    conversation.push({ role: "system", content: 'Foi enviado a amostra gratuita. Não ofereça amostras gratuitas novamente.' });
    isProcessing[messageFrom] = false;
  } catch (error) {
    console.error('Error sending Amostra Gratis:', error.message);
  }
}

async function archiveChat(client, messageFrom, conversation) {
  try {
    const chat = await client.getChatById(messageFrom);
    await chat.archive();
    const response = `Tudo bem meu amor, quando quiser adquirir algum pacote, é só me chamar aqui tá bom? Beijos 😘`;
    await client.sendMessage(messageFrom, response);
    conversation.push({ role: "assistant", content: response });
  } catch (error) {
    console.error('Error archiving chat:', error.message);
  }
}

async function hasPaid(messageFrom) {
  try {
    const conversation = getUserConversation(messageFrom)
    isWatchingPayment[messageFrom] = false
    isProcessing[messageFrom] = true;
    const chat = await client.getChatById(messageFrom);
    await chat.archive();
    conversation.push({ role: "system", content: 'O usuário pagou com sucesso e o conteúdo foi enviado. Agradeça a compra e diga que está ansiosa para ele ver tudo! 😍' });
    client.sendMessage(messageFrom, '*Link para o conteúdo VIP* 😍:\n\nhttps://drive.google.com/drive/folders/1gG-7YikmcCxxYoKauDAFyS4asjVHP9kk?usp=sharing');
    isProcessing[messageFrom] = false;
  } catch (error) {
    console.error('Error sending has_paid:', error.message);
  }
  }
  async function chamadaVideo(client, messageFrom, conversation) {
    try {
      isProcessing[messageFrom] = true;
      const chat = await client.getChatById(messageFrom);
      const chamadavideo = MessageMedia.fromFilePath('./chamadavideo.mp3');
      chat.sendStateRecording();
      await new Promise(resolve => setTimeout(resolve, 11000));
      await client.sendMessage(messageFrom, chamadavideo, {sendAudioAsVoice: true});
      conversation.push({ role: "assistant", content: 'Então meu amor, eu faço chamada de vídeo sim tá? Me masturbando bem gostoso pra você gozar. E so R$170 até você gozar. Voce quer fazer a chamada?' });
      console.log(`Audio chamada de vídeo enviado para ${messageFrom}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      conversation.push({ role: "system", content: 'Foi enviada as informações da chamada de vídeo para o usuário em forma de audio.' });
      chat.sendStateTyping();
      await new Promise(resolve => setTimeout(resolve, 4000));
      await client.sendMessage(messageFrom, 'É só *R$170* até você gozar 😍\n\nVamos fazer?');
      isProcessing[messageFrom] = false;
    } catch (error) {
      console.error('Error sending chamada_video:', error.message);
    }
  }
  async function naosouFake(client, messageFrom, conversation) {
    try {
      isProcessing[messageFrom] = true;
      const chat = await client.getChatById(messageFrom);
      const naosoufake = MessageMedia.fromFilePath('./naosoufake.mp3');
      chat.sendStateRecording();
      await new Promise(resolve => setTimeout(resolve, 13000));
      await client.sendMessage(messageFrom, naosoufake, {sendAudioAsVoice: true});
      conversation.push({ role: "assistant", content: 'Então amor eu não sou fake. Eu sei que tem muita gente se passando pelos outros pra dar golpe, mas eu não sou fake. E eu vou te provar isso haha.' });
      console.log(`Audio naosoufake enviado para ${messageFrom}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      conversation.push({ role: "system", content: 'Foi enviada a mensagem provando que você não é fake para o usuário. Não use essa função novamente!' });
      isProcessing[messageFrom] = false;
    } catch (error) {
      console.error('Error sending naosou_fake:', error.message);
    }
  }

client.on("message", async (message) => {
  const getRandomDelay = () => {
    return Math.floor(Math.random() * (45000 - 120000 + 1) + 120000);
  };
  const chat = await message.getChat();
  if (message.from.includes('@g.us') || message.from.includes('@broadcast') || chat.archived) {
    return;
  }
  if (isWatchingPayment[message.from]){
    verificarStatusPagamento(message.from)
  }

  if (isProcessing[message.from]) {
    return;
    }

  if (!messageBuffers[message.from]) {
    messageBuffers[message.from] = [];
  }

  if (message.hasMedia) {
    const media = await message.downloadMedia();
    if (media.mimetype === 'audio/ogg; codecs=opus') {
      const buffer = Buffer.from(media.data, 'base64');
      const transcribedText = await transcribeAudio(buffer);
      if (transcribedText) {
        messageBuffers[message.from].push(transcribedText);
      }
    }
  } else {
    messageBuffers[message.from].push(message.body);
    console.log('Buffering...', message.body);
  }

  if (bufferTimers[message.from]) {
    clearTimeout(bufferTimers[message.from]);
  }

  bufferTimers[message.from] = setTimeout(async () => {
    const combinedMessage = messageBuffers[message.from].join(' ');
    console.log('\n📱 [NOVO CONTATO]');
    console.log(`   Número: ${message.from}`);
    console.log(`   Mensagem: ${combinedMessage}`);
    console.log(`   Hora: ${new Date().toLocaleTimeString('pt-BR')}`);
    console.log('⏳ Processando com IA...\n');
    const result = await runCompletion(message.from, combinedMessage);
    console.log('✅ Resposta gerada:', result.substring(0, 50) + '...');
    if (result) {
      const messageParts = splitMessages(result);
      if (messageParts.length > 0) {
        isProcessing[message.from] = true;
        await sendMessageParts(client, message.from, messageParts);
        console.log(`📤 Mensagem enviada para ${message.from}\n`);
        isProcessing[message.from] = false;
      }
    }
    messageBuffers[message.from] = [];
    bufferTimers[message.from] = null;
  }, getRandomDelay());
});

function splitMessages(text) {
  const complexPattern = /(http[s]?:\/\/[^\s]+)|(www\.[^\s]+)|([^\s]+@[^\s]+\.[^\s]+)|(["'].*?["'])|(\b\d+\.\s)|(\w+\.\w+)/g;
  const placeholders = text.match(complexPattern) ?? [];
  const placeholder = "PLACEHOLDER_";
  let currentIndex = 0;
  const textWithPlaceholders = text.replace(
    complexPattern,
    () => `${placeholder}${currentIndex++}`
  );
  const splitPattern = /(?<!\b\d+\.\s)(?<!\w+\.\w+)[^.?!]+(?:[.?!]+["']?|$)/g;
  let parts = textWithPlaceholders.match(splitPattern) ?? [];
  if (placeholders.length > 0) {
    parts = parts.map(
      (part) => placeholders.reduce(
        (acc, val, idx) => acc.replace(`${placeholder}${idx}`, val),
        part
      )
    );
  }
  return parts;
}

const getDelay = (part) => {
  const delayMin = 5000;
  const stringLength = (part.length / 60) * delayMin;
  if (stringLength < delayMin) return delayMin;
  return stringLength;
}

async function transcribeAudio(fileBuffer) {
  try {
    const formData = new FormData();
    formData.append('file', fileBuffer, 'audio.mp3');
    formData.append('model', 'whisper-1');

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          ...formData.getHeaders()
        },
      }
    );

    return response.data.text;
  } catch (error) {
    console.error('Erro ao transcrever áudio:', error.message);
    return null;
  }
}

async function sendMessageParts(client, messageFrom, textParts) {
  for (let i = 0; i < textParts.length; i++) {
    const chat = await client.getChatById(messageFrom);
    const part = textParts[i];
    const delay = getDelay(part);
    chat.sendStateTyping();
    await new Promise(resolve => setTimeout(resolve, delay - 1000));
    await client.sendMessage(messageFrom, part);
    chat.sendStateTyping();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}


//////////////////////////////////////////



app.use(bodyParser.json());
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});
app.get('/auth', (req, res) => {
  res.sendFile(__dirname + '/public/auth.html');
});

app.post('/api/messages', (req, res) => {
  const { message } = req.body;

  if (message) {
    try {
      const messages = loadMessages();
      messages[0] = message; 
      saveMessages(messages);

      console.log('Mensagem salva com sucesso:', message);
      res.sendStatus(200);
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error);
      res.status(500).send('Erro ao salvar mensagem.');
    }
  } else {
    res.status(400).send('Mensagem inválida.');
  }
});

app.get('/api/messages', (req, res) => {
  try {
    const messages = loadMessages();
    res.json(messages);
  } catch (error) {
    console.error('Erro ao carregar mensagens:', error);
    res.status(500).send('Erro ao carregar mensagens.');
  }
});

function loadMessages() {
  try {
    const data = fs.readFileSync('messages.json');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function saveMessages(messages) {
  const data = JSON.stringify(messages);
  fs.writeFileSync('messages.json', data);
}

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));
app.use(fileUpload({
  debug: true
}));
app.use("/", express.static(__dirname + "/"));

app.get('/', (req, res) => {
  res.sendFile('public/auth.html', {
    root: __dirname
  });
});

fs.watchFile(filePath, async (curr, prev) => {
  if (curr.mtime > prev.mtime) {
    console.log('Novo roteiro recebido.');
    process.kill(process.pid, 'SIGTERM');
  }
});

server.listen(port, function() {
  console.log('http://localhost:' + port);
});

const clientSockets = {};

io.on('connection', function(socket) {
  socket.emit('message', 'BOT Iniciado! Criando sessão. Aguarde.');

  client.on('qr', (qr) => {
    console.log('QR Recebido');
    socket.emit('message', 'QRCode recebido, faça a leitura com o seu Whatsapp!');
    console.log(qr)
    qrcode.toDataURL(qr, (err, url) => {
      socket.emit('qr', url);
    });
  });

  clientSockets[socket.id] = socket;

});

client.on('ready', () => {
  Object.values(clientSockets).forEach(socket => {
    socket.emit('ready', 'Dispositivo pronto!');
    socket.emit('message', 'Dispositivo pronto!');
  });
  console.log('Dispositivo pronto');
});

client.on('authenticated', () => {
  Object.values(clientSockets).forEach(socket => {
    socket.emit('authenticated', 'Autenticado!');
    socket.emit('message', 'Autenticado!');
  });
  console.log('Autenticado');
});

client.on('auth_failure', function() {
  Object.values(clientSockets).forEach(socket => {
    socket.emit('message', 'Falha na autenticação, aguarde um novo código');
  });
  console.error('Falha na autenticação');
});

client.on('change_state', state => {
  console.log('Status de conexão:', state);
});

client.on('disconnected', (reason) => {
  Object.values(clientSockets).forEach(socket => {
    socket.emit('message', 'Cliente desconectado!');
  });
  console.log('Cliente desconectado', reason);
  client.initialize();
});
