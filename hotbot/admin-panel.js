const chalk = require('chalk');
const Table = require('cli-table3');
const readline = require('readline');
const sessionManager = require('./session-manager');
const botFactory = require('./bot-factory');

class AdminPanel {
  constructor() {
    this.running = true;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  formatStatus(status) {
    switch (status) {
      case 'connected':
        return chalk.green('🟢 Conectado');
      case 'initializing':
        return chalk.yellow('🟡 Inicializando');
      case 'disconnected':
        return chalk.red('🔴 Desconectado');
      case 'error':
        return chalk.red('❌ Erro');
      default:
        return chalk.gray('⚪ Desconhecido');
    }
  }

  displaySessions() {
    console.clear();
    console.log(chalk.bold.cyan('\n📊 SESSÕES ATIVAS\n'));

    const sessions = sessionManager.getActiveSessions();

    if (sessions.length === 0) {
      console.log(chalk.yellow('Nenhuma sessão ativa. Adicione uma nova sessão!'));
      console.log();
      return;
    }

    const table = new Table({
      head: [
        chalk.bold.cyan('ID'),
        chalk.bold.cyan('Porta'),
        chalk.bold.cyan('Modelo'),
        chalk.bold.cyan('WhatsApp'),
        chalk.bold.cyan('Status')
      ],
      style: { compact: true, 'padding-left': 1, 'padding-right': 1 }
    });

    sessions.forEach((session, index) => {
      table.push([
        chalk.gray(index + 1),
        chalk.white(session.port),
        chalk.cyan(session.modelName),
        session.whatsappNumber ? chalk.green(session.whatsappNumber) : chalk.gray('Aguardando...'),
        this.formatStatus(session.status)
      ]);
    });

    console.log(table.toString());
    console.log();
  }

  question(query) {
    return new Promise(resolve => {
      this.rl.question(query, resolve);
    });
  }

  async showMainMenu() {
    this.displaySessions();

    console.log(chalk.bold('Selecione uma ação:'));
    console.log(chalk.green('1) ➕ Adicionar Nova Sessão'));
    console.log(chalk.red('2) ❌ Remover Sessão'));
    console.log(chalk.blue('3) 🔄 Reiniciar Sessão'));
    console.log(chalk.yellow('4) 📋 Ver Detalhes'));
    console.log(chalk.gray('5) 🚪 Sair'));
    console.log();

    const choice = await this.question(chalk.bold('Digite o número da ação: '));

    return choice.trim();
  }

  async addSession() {
    console.clear();
    console.log(chalk.bold.cyan('\n➕ ADICIONAR NOVA SESSÃO\n'));

    const modelName = await this.question('Nome da modelo: ');

    if (!modelName.trim()) {
      console.log(chalk.red('❌ Nome não pode ser vazio!'));
      await this.question('\nPressione Enter para continuar...');
      return;
    }

    try {
      console.log(chalk.yellow('\n⏳ Criando sessão...'));

      const session = sessionManager.addSession(modelName);
      console.log(chalk.green(`✅ Sessão criada: ${session.modelName} (Porta: ${session.port})`));

      console.log(chalk.yellow('\n⏳ Iniciando bot...'));
      await botFactory.spawnBot(session);

      console.log(chalk.green(`✅ Bot iniciado na porta ${session.port}`));
      console.log(chalk.cyan(`\n📱 Verifique o terminal para escanear o QR Code!\n`));

      await this.question('Pressione Enter para continuar...');
    } catch (error) {
      console.error(chalk.red(`❌ Erro ao adicionar sessão: ${error.message}`));
      await this.question('\nPressione Enter para continuar...');
    }
  }

  async removeSession() {
    console.clear();
    console.log(chalk.bold.red('\n❌ REMOVER SESSÃO\n'));

    const sessions = sessionManager.getActiveSessions();

    if (sessions.length === 0) {
      console.log(chalk.yellow('Nenhuma sessão para remover.'));
      await this.question('Pressione Enter para continuar...');
      return;
    }

    sessions.forEach((s, i) => {
      console.log(`${i + 1}) ${s.modelName} (Porta: ${s.port}) - ${s.status}`);
    });
    console.log();

    const choice = await this.question('Selecione o número da sessão para remover: ');
    const index = parseInt(choice.trim()) - 1;

    if (isNaN(index) || index < 0 || index >= sessions.length) {
      console.log(chalk.red('❌ Opção inválida!'));
      await this.question('Pressione Enter para continuar...');
      return;
    }

    try {
      const session = sessions[index];
      console.log(chalk.yellow('\n⏳ Encerrando bot...'));

      await botFactory.killBot(session.id);
      sessionManager.removeSession(session.id);

      console.log(chalk.green(`✅ Sessão ${session.modelName} removida com sucesso!`));

      await this.question('\nPressione Enter para continuar...');
    } catch (error) {
      console.error(chalk.red(`❌ Erro ao remover sessão: ${error.message}`));
      await this.question('\nPressione Enter para continuar...');
    }
  }

  async restartSession() {
    console.clear();
    console.log(chalk.bold.blue('\n🔄 REINICIAR SESSÃO\n'));

    const sessions = sessionManager.getActiveSessions();

    if (sessions.length === 0) {
      console.log(chalk.yellow('Nenhuma sessão para reiniciar.'));
      await this.question('Pressione Enter para continuar...');
      return;
    }

    sessions.forEach((s, i) => {
      console.log(`${i + 1}) ${s.modelName} (Porta: ${s.port})`);
    });
    console.log();

    const choice = await this.question('Selecione o número da sessão para reiniciar: ');
    const index = parseInt(choice.trim()) - 1;

    if (isNaN(index) || index < 0 || index >= sessions.length) {
      console.log(chalk.red('❌ Opção inválida!'));
      await this.question('Pressione Enter para continuar...');
      return;
    }

    try {
      const session = sessions[index];
      console.log(chalk.yellow('\n⏳ Reiniciando bot...'));
      sessionManager.updateSessionStatus(session.id, 'initializing');
      await botFactory.restartBot(session.id);

      console.log(chalk.green(`✅ Sessão reiniciada com sucesso!`));

      await this.question('\nPressione Enter para continuar...');
    } catch (error) {
      console.error(chalk.red(`❌ Erro ao reiniciar sessão: ${error.message}`));
      await this.question('\nPressione Enter para continuar...');
    }
  }

  async showDetails() {
    console.clear();
    console.log(chalk.bold.cyan('\n📋 DETALHES DAS SESSÕES\n'));

    const sessions = sessionManager.getActiveSessions();

    if (sessions.length === 0) {
      console.log(chalk.yellow('Nenhuma sessão.'));
      await this.question('Pressione Enter para continuar...');
      return;
    }

    sessions.forEach((session, index) => {
      console.log(chalk.bold.white(`\n${index + 1}. ${session.modelName}`));
      console.log(`   ID: ${chalk.cyan(session.id)}`);
      console.log(`   Porta: ${chalk.yellow(session.port)}`);
      console.log(`   Client ID: ${chalk.gray(session.clientId)}`);
      console.log(`   Status: ${this.formatStatus(session.status)}`);
      console.log(`   WhatsApp: ${session.whatsappNumber ? chalk.green(session.whatsappNumber) : chalk.gray('Aguardando...')}`);
      console.log(`   Criado em: ${new Date(session.createdAt).toLocaleString('pt-BR')}`);
    });

    console.log();
    await this.question('Pressione Enter para continuar...');
  }

  async run() {
    while (this.running) {
      const action = await this.showMainMenu();

      switch (action) {
        case '1':
          await this.addSession();
          break;
        case '2':
          await this.removeSession();
          break;
        case '3':
          await this.restartSession();
          break;
        case '4':
          await this.showDetails();
          break;
        case '5':
          this.running = false;
          console.log(chalk.yellow('\n⏳ Encerrando todos os bots...'));
          await botFactory.killAllBots();
          console.log(chalk.green('✅ Todos os bots foram encerrados!'));
          console.log(chalk.cyan('\nAté logo! 👋\n'));
          this.rl.close();
          break;
        default:
          console.log(chalk.red('\n❌ Opção inválida! Tente novamente.'));
          await this.question('\nPressione Enter para continuar...');
      }
    }
  }
}

module.exports = AdminPanel;
