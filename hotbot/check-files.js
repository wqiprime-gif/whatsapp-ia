const fs = require('fs');
const path = require('path');

const __dirname = __dirname || path.dirname(require.main.filename);

const audioFiles = {
  saudacao: path.join(__dirname, 'saudacao.mp3'),
  informacoes: path.join(__dirname, 'informacoes.mp3'),
  chavepix: path.join(__dirname, 'chavepix.mp3'),
  qualpack: path.join(__dirname, 'qualpack.mp3'),
  chamadavideo: path.join(__dirname, 'chamadavideo.mp3'),
  naosoufake: path.join(__dirname, 'naosoufake.mp3'),
  precos: path.join(__dirname, 'precos.jpg'),
  amostra: path.join(__dirname, 'amostra.jpg')
};

console.log(`🔊 Verificando arquivos em: ${__dirname}\n`);

let found = 0;
let missing = 0;

for (const [name, filePath] of Object.entries(audioFiles)) {
  const exists = fs.existsSync(filePath);
  if (exists) {
    const stats = fs.statSync(filePath);
    console.log(`✅ ${name.padEnd(15)} (${(stats.size / 1024).toFixed(2)} KB) - ${filePath}`);
    found++;
  } else {
    console.log(`❌ ${name.padEnd(15)} - NÃO ENCONTRADO: ${filePath}`);
    missing++;
  }
}

console.log(`\n📊 Resultado: ${found} encontrados, ${missing} faltando`);
