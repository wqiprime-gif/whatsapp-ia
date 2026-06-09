const fs = require('fs');
const path = require('path');

const SESSION_FILE = path.join(__dirname, 'sessions.json');

class SessionManager {
  constructor() {
    this.loadSessions();
  }

  loadSessions() {
    try {
      if (fs.existsSync(SESSION_FILE)) {
        const data = fs.readFileSync(SESSION_FILE, 'utf8');
        this.data = JSON.parse(data);
      } else {
        this.data = {
          sessions: [],
          nextPort: 6000
        };
        this.saveSessions();
      }
    } catch (error) {
      console.error('Erro ao carregar sessões:', error);
      this.data = {
        sessions: [],
        nextPort: 6000
      };
    }
  }

  saveSessions() {
    try {
      fs.writeFileSync(SESSION_FILE, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Erro ao salvar sessões:', error);
    }
  }

  addSession(modelName) {
    const port = this.data.nextPort;
    const clientId = `cliente-${port}`;

    const session = {
      id: `session-${port}`,
      port: port,
      clientId: clientId,
      whatsappNumber: null,
      modelName: modelName,
      status: 'initializing',
      createdAt: new Date().toISOString(),
      processId: null
    };

    this.data.sessions.push(session);
    this.data.nextPort = port + 1;
    this.saveSessions();

    return session;
  }

  removeSession(sessionId) {
    const index = this.data.sessions.findIndex(s => s.id === sessionId);
    if (index > -1) {
      this.data.sessions.splice(index, 1);
      this.saveSessions();
      return true;
    }
    return false;
  }

  getSession(sessionId) {
    return this.data.sessions.find(s => s.id === sessionId);
  }

  getSessionByPort(port) {
    return this.data.sessions.find(s => s.port === port);
  }

  updateSession(sessionId, updates) {
    const session = this.getSession(sessionId);
    if (session) {
      Object.assign(session, updates);
      this.saveSessions();
      return session;
    }
    return null;
  }

  updateSessionStatus(sessionId, status, whatsappNumber = null) {
    const session = this.getSession(sessionId);
    if (session) {
      session.status = status;
      if (whatsappNumber) {
        session.whatsappNumber = whatsappNumber;
      }
      this.saveSessions();
      return session;
    }
    return null;
  }

  getActiveSessions() {
    return this.data.sessions;
  }

  getNextPort() {
    return this.data.nextPort;
  }

  clearAllSessions() {
    this.data.sessions = [];
    this.data.nextPort = 6000;
    this.saveSessions();
  }
}

module.exports = new SessionManager();
