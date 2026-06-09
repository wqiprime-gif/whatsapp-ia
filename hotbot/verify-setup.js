#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

console.log(chalk.bold.cyan('\n🔍 Verificando Setup Multi-Instância...\n'));

const checks = [];
const baseDir = __dirname;

// 1. Verificar dependências
console.log(chalk.bold('📦 Verificando Dependências:\n'));

const requiredPackages = [
  'chalk',
  'cli-table3',
  'inquirer',
  'whatsapp-web.js',
  'openai'
];

let depMissing = 0;
requiredPackages.forEach(pkg => {
  try {
    require(pkg);
    console.log(chalk.green(`  ✅ ${pkg}`));
    checks.push({ name: `Dependency: ${pkg}`, status: 'ok' });
  } catch (e) {
    console.log(chalk.red(`  ❌ ${pkg} (FALTANDO - execute npm install)`));
    checks.push({ name: `Dependency: ${pkg}`, status: 'error' });
    depMissing++;
  }
});

// 2. Verificar arquivos críticos
console.log(chalk.bold('\n📄 Verificando Arquivos:\n'));

const requiredFiles = [
  'index.js',
  'session-manager.js',
  'bot-factory.js',
  'admin-panel.js',
  'bot-instance.js',
  '.env',
  'package.json'
];

let fileMissing = 0;
requiredFiles.forEach(file => {
  const filePath = path.join(baseDir, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(chalk.green(`  ✅ ${file} (${stats.size} bytes)`));
    checks.push({ name: `File: ${file}`, status: 'ok' });
  } else {
    console.log(chalk.red(`  ❌ ${file} (FALTANDO)`));
    checks.push({ name: `File: ${file}`, status: 'error' });
    fileMissing++;
  }
});

// 3. Verificar arquivos de áudio
console.log(chalk.bold('\n🎵 Verificando Arquivos de Áudio:\n'));

const audioFiles = [
  'saudacao.mp3',
  'informacoes.mp3',
  'chavepix.mp3',
  'qualpack.mp3',
  'chamadavideo.mp3',
  'naosoufake.mp3',
  'precos.jpg',
  'amostra.jpg'
];

let audioMissing = 0;
audioFiles.forEach(file => {
  const filePath = path.join(baseDir, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(chalk.green(`  ✅ ${file} (${sizeMB} MB)`));
    checks.push({ name: `Audio: ${file}`, status: 'ok' });
  } else {
    console.log(chalk.red(`  ❌ ${file} (FALTANDO)`));
    checks.push({ name: `Audio: ${file}`, status: 'error' });
    audioMissing++;
  }
});

// 4. Verificar diretórios
console.log(chalk.bold('\n📁 Verificando Diretórios:\n'));

const requiredDirs = [
  '.wwebjs_auth',
  '.wwebjs_cache',
  'prompts'
];

let dirMissing = 0;
requiredDirs.forEach(dir => {
  const dirPath = path.join(baseDir, dir);
  if (fs.existsSync(dirPath)) {
    console.log(chalk.green(`  ✅ ${dir}`));
    checks.push({ name: `Directory: ${dir}`, status: 'ok' });
  } else {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(chalk.yellow(`  ⚠️  ${dir} (criado automaticamente)`));
      checks.push({ name: `Directory: ${dir}`, status: 'created' });
    } catch (e) {
      console.log(chalk.red(`  ❌ ${dir} (ERRO ao criar)`));
      checks.push({ name: `Directory: ${dir}`, status: 'error' });
      dirMissing++;
    }
  }
});

// 5. Verificar sessions.json
console.log(chalk.bold('\n💾 Verificando Persistência:\n'));

const sessionsFile = path.join(baseDir, 'sessions.json');
if (fs.existsSync(sessionsFile)) {
  try {
    const data = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
    console.log(chalk.green(`  ✅ sessions.json (${data.sessions.length} sessão(ões))`));
    console.log(chalk.gray(`     Próxima porta: ${data.nextPort}`));
    checks.push({ name: 'File: sessions.json', status: 'ok' });
  } catch (e) {
    console.log(chalk.red(`  ❌ sessions.json (JSON inválido)`));
    checks.push({ name: 'File: sessions.json', status: 'error' });
  }
} else {
  console.log(chalk.yellow(`  ⚠️  sessions.json (será criado na primeira execução)`));
  checks.push({ name: 'File: sessions.json', status: 'will-create' });
}

// 6. Verificar .env
console.log(chalk.bold('\n🔐 Verificando Configurações:\n'));

const envFile = path.join(baseDir, '.env');
if (fs.existsSync(envFile)) {
  try {
    const envContent = fs.readFileSync(envFile, 'utf8');
    if (envContent.includes('OPENAI_API_KEY')) {
      console.log(chalk.green(`  ✅ .env com OPENAI_API_KEY`));
      checks.push({ name: 'Config: OPENAI_API_KEY', status: 'ok' });
    } else {
      console.log(chalk.yellow(`  ⚠️  .env sem OPENAI_API_KEY`));
      checks.push({ name: 'Config: OPENAI_API_KEY', status: 'warning' });
    }
  } catch (e) {
    console.log(chalk.red(`  ❌ Erro ao ler .env`));
    checks.push({ name: 'Config: .env', status: 'error' });
  }
} else {
  console.log(chalk.red(`  ❌ .env FALTANDO`));
  checks.push({ name: 'File: .env', status: 'error' });
}

// Resultado Final
console.log(chalk.bold('\n📊 RESULTADO FINAL:\n'));

const okCount = checks.filter(c => c.status === 'ok' || c.status === 'created').length;
const errorCount = checks.filter(c => c.status === 'error').length;
const warningCount = checks.filter(c => c.status === 'warning' || c.status === 'will-create').length;

console.log(chalk.green(`  ✅ OK: ${okCount}`));
console.log(chalk.yellow(`  ⚠️  Avisos/Criar: ${warningCount}`));
console.log(chalk.red(`  ❌ Erros: ${errorCount}`));

console.log();

if (errorCount === 0) {
  console.log(chalk.bold.green('\n✅ Setup validado com sucesso!\n'));
  console.log(chalk.cyan('Você pode executar: npm start\n'));
  process.exit(0);
} else {
  console.log(chalk.bold.red('\n❌ Setup incompleto! Corrija os erros acima.\n'));
  console.log(chalk.yellow('Passos sugeridos:'));
  if (depMissing > 0) {
    console.log(chalk.cyan('  1. npm install'));
  }
  if (fileMissing > 0) {
    console.log(chalk.cyan('  2. Verifique se todos os arquivos .js existem'));
  }
  if (audioMissing > 0) {
    console.log(chalk.cyan('  3. Verifique se os arquivos de áudio (mp3, jpg) existem'));
  }
  console.log();
  process.exit(1);
}
