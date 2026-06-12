(function () {
  const listEl = document.getElementById("tg-thread-list");
  const msgsEl = document.getElementById("tg-messages");
  const headEl = document.getElementById("tg-chat-head");
  const searchEl = document.getElementById("tg-search");
  if (!listEl || !msgsEl) return;

  let threads = [];
  let active = null;

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function initials(name) {
    return name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";
  }

  function timeShort(iso) {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }

  function renderThreads(filter = "") {
    const q = filter.trim().toLowerCase();
    const rows = threads.filter((t) => {
      if (!q) return true;
      const hay = `${t.displayName} ${t.username || ""} ${t.botName} ${t.chatId}`.toLowerCase();
      return hay.includes(q);
    });

    if (rows.length === 0) {
      listEl.innerHTML =
        '<div class="tg-loading">Nenhum contato ainda. Quando alguém mandar mensagem no bot, aparece aqui.</div>';
      return;
    }

    listEl.innerHTML = rows
      .map((t) => {
        const key = `${t.botId}:${t.chatId}`;
        const activeCls = active === key ? " is-active" : "";
        const you = t.lastRole === "assistant" ? '<span class="tg-you">Você: </span>' : "";
        const handle = t.username ? `@${esc(t.username)}` : `ID ${t.chatId}`;
        return `<button type="button" class="tg-thread${activeCls}" data-key="${esc(key)}" data-bot="${esc(t.botId)}" data-chat="${t.chatId}">
          <div class="tg-avatar">${esc(initials(t.displayName))}</div>
          <div class="tg-thread-body">
            <div class="tg-thread-top">
              <strong>${esc(t.displayName)}</strong>
              <time>${esc(timeShort(t.lastMessageAt))}</time>
            </div>
            <div class="tg-thread-sub">${esc(t.botName)} · ${handle}</div>
            <div class="tg-thread-preview">${you}${esc(t.lastPreview || "Sem mensagens")}</div>
          </div>
          ${t.messageCount ? `<span class="tg-badge">${t.messageCount > 99 ? "99+" : t.messageCount}</span>` : ""}
        </button>`;
      })
      .join("");

    listEl.querySelectorAll(".tg-thread").forEach((btn) => {
      btn.addEventListener("click", () => openThread(btn.dataset.bot, Number(btn.dataset.chat), btn.dataset.key));
    });
  }

  async function openThread(botId, chatId, key) {
    active = key;
    renderThreads(searchEl?.value || "");
    const t = threads.find((x) => x.botId === botId && x.chatId === chatId);
    if (!t) return;

    headEl.innerHTML = `<div class="tg-chat-head-active">
      <div class="tg-avatar tg-avatar--lg">${esc(initials(t.displayName))}</div>
      <div>
        <strong>${esc(t.displayName)}</strong>
        <span>${esc(t.botName)} · ${t.username ? "@" + esc(t.username) : "chat " + chatId}</span>
      </div>
    </div>`;

    msgsEl.innerHTML = '<div class="tg-loading">Carregando mensagens...</div>';

    const res = await fetch(`/api/panel/conversations/messages?botId=${encodeURIComponent(botId)}&chatId=${chatId}`);
    if (!res.ok) {
      msgsEl.innerHTML = '<div class="tg-loading">Erro ao carregar mensagens.</div>';
      return;
    }
    const data = await res.json();
    renderMessages(data.messages || [], t);
  }

  function renderMessages(messages, thread) {
    if (messages.length === 0) {
      msgsEl.innerHTML = '<div class="tg-loading">Nenhuma mensagem registrada neste chat.</div>';
      return;
    }

    const html = messages
      .map((m) => {
        const role = m.role;
        if (role === "system") {
          return `<div class="tg-bubble tg-bubble--system"><span>${esc(m.content)}</span></div>`;
        }
        const out = role === "assistant" || role === "bot";
        const cls = out ? "tg-bubble tg-bubble--out" : "tg-bubble tg-bubble--in";
        const label = out ? "Byanca" : esc(thread.displayName);
        return `<div class="${cls}">
          <div class="tg-bubble-meta">${label} · ${esc(timeShort(m.createdAt))}</div>
          <div class="tg-bubble-text">${esc(m.content).replace(/\n/g, "<br>")}</div>
        </div>`;
      })
      .join("");

    msgsEl.innerHTML = html;
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  async function loadThreads() {
    const res = await fetch("/api/panel/conversations/threads");
    if (!res.ok) {
      listEl.innerHTML = '<div class="tg-loading">Erro ao carregar conversas.</div>';
      return;
    }
    const data = await res.json();
    threads = data.threads || [];
    renderThreads();
    if (threads.length > 0) {
      const first = threads[0];
      openThread(first.botId, first.chatId, `${first.botId}:${first.chatId}`);
    }
  }

  searchEl?.addEventListener("input", () => renderThreads(searchEl.value));

  loadThreads();
})();
