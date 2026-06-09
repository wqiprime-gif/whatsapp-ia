const { spawn } = require('child_process');
const path = require('path');
const sessionManager = require('./session-manager');

class BotFactory {
  constructor() {
    this.processes = new Map();
  }

  spawnBot(sessionConfig) {
    return new Promise((resolve, reject) => {
      try {
        const botPath = path.join(__dirname, 'bot-instance.js');

        const args = [
          '--port', sessionConfig.port.toString(),
          '--clientId', sessionConfig.clientId,
          '--modelName', sessionConfig.modelName,
          '--sessionId', sessionConfig.id
        ];

        const child = spawn('node', [botPath, ...args], {
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false
        });

        // Timeout para detecção de erro na inicialização
        const timeout = setTimeout(() => {
          sessionManager.updateSessionStatus(sessionConfig.id, 'connected');
          resolve({ sessionId: sessionConfig.id, processId: child.pid });
        }, 3000);

        child.stdout.on('data', (data) => {
          const message = data.toString();
          console.log(`[Port ${sessionConfig.port}] ${message}`);

          if (message.includes('Autenticado') || message.includes('Dispositivo pronto')) {
            clearTimeout(timeout);
            sessionManager.updateSessionStatus(sessionConfig.id, 'connected');
          }
        });

        child.stderr.on('data', (data) => {
          console.error(`[Port ${sessionConfig.port}] ERROR: ${data.toString()}`);
        });

        child.on('error', (error) => {
          clearTimeout(timeout);
          sessionManager.updateSessionStatus(sessionConfig.id, 'error');
          console.error(`Erro ao spawn bot ${sessionConfig.id}:`, error);
          reject(error);
        });

        child.on('exit', (code) => {
          clearTimeout(timeout);
          this.processes.delete(sessionConfig.id);
          sessionManager.updateSessionStatus(sessionConfig.id, 'disconnected');
          console.log(`[Port ${sessionConfig.port}] Processo encerrado com código ${code}`);
        });

        this.processes.set(sessionConfig.id, child);

        setTimeout(() => {
          if (this.processes.has(sessionConfig.id)) {
            resolve({ sessionId: sessionConfig.id, processId: child.pid });
          }
        }, 500);

      } catch (error) {
        sessionManager.updateSessionStatus(sessionConfig.id, 'error');
        reject(error);
      }
    });
  }

  async killBot(sessionId) {
    const process = this.processes.get(sessionId);
    if (process) {
      return new Promise((resolve) => {
        process.on('exit', () => {
          this.processes.delete(sessionId);
          resolve(true);
        });
        process.kill('SIGTERM');

        // Force kill se não morrer em 5 segundos
        setTimeout(() => {
          if (this.processes.has(sessionId)) {
            process.kill('SIGKILL');
            this.processes.delete(sessionId);
          }
          resolve(true);
        }, 5000);
      });
    }
    return true;
  }

  async restartBot(sessionId) {
    await this.killBot(sessionId);
    const session = sessionManager.getSession(sessionId);
    if (session) {
      return this.spawnBot(session);
    }
  }

  getProcessStatus(sessionId) {
    const process = this.processes.get(sessionId);
    return process ? 'running' : 'stopped';
  }

  getAllProcesses() {
    return Array.from(this.processes.keys());
  }

  async killAllBots() {
    const promises = Array.from(this.processes.keys()).map(sessionId =>
      this.killBot(sessionId)
    );
    return Promise.all(promises);
  }
}

module.exports = new BotFactory();
