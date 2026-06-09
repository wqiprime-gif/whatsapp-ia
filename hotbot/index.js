const chalk = require('chalk');
const sessionManager = require('./session-manager');
const botFactory = require('./bot-factory');
const AdminPanel = require('./admin-panel');

async function main() {
  console.clear();

  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║                                        ║'));
  console.log(chalk.bold.cyan('║     🤖 HOTBOT - Multi-Instance        ║'));
  console.log(chalk.bold.cyan('║        WhatsApp Bot Manager            ║'));
  console.log(chalk.bold.cyan('║                                        ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════╝\n'));

  try {
    // Carregar sessões existentes
    const sessions = sessionManager.getActiveSessions();

    if (sessions.length > 0) {
      console.log(chalk.cyan(`📋 Encontradas ${sessions.length} sessão(ões) salva(s).`));
      console.log(chalk.yellow('⏳ Reiniciando bots...\n'));

      for (const session of sessions) {
        try {
          console.log(chalk.gray(`   → ${session.modelName} (Porta ${session.port})...`));
          sessionManager.updateSessionStatus(session.id, 'initializing');
          await botFactory.spawnBot(session);
          console.log(chalk.green(`     ✅ Iniciado\n`));
        } catch (error) {
          console.error(chalk.red(`     ❌ Erro: ${error.message}\n`));
        }
      }
    } else {
      console.log(chalk.yellow('ℹ️  Nenhuma sessão salva. Adicione uma nova sessão no painel!\n'));
    }

    // Iniciar painel de admin
    console.log(chalk.cyan('\n🚀 Iniciando painel de admin...\n'));
    const adminPanel = new AdminPanel();
    await adminPanel.run();

  } catch (error) {
    console.error(chalk.red(`\n❌ Erro fatal: ${error.message}`));
    process.exit(1);
  }
}

// Tratamento de encerramento gracioso
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n\n⏳ Encerrando aplicação...'));
  await botFactory.killAllBots();
  console.log(chalk.green('✅ Aplicação encerrada com sucesso!'));
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(chalk.yellow('\n\n⏳ Encerrando aplicação...'));
  await botFactory.killAllBots();
  console.log(chalk.green('✅ Aplicação encerrada com sucesso!'));
  process.exit(0);
});

// Iniciar aplicação
main().catch(error => {
  console.error(chalk.red(`\n❌ Erro: ${error.message}`));
  process.exit(1);
});
