import { appLayout, type NavId } from "./layout.js";
import { icons } from "./icons.js";

function wrap(title: string, nav: NavId, body: string, partial?: boolean) {
  if (partial) return body;
  return appLayout(title, nav, body, partial);
}

export function conversationsPage(partial?: boolean) {
  const body = `
    <div class="tg-workspace" data-tg-inbox>
      <aside class="tg-threads glass-3d">
        <div class="tg-threads-head">
          <h2>${icons.chat} Conversas</h2>
          <span class="tg-threads-hint">Histórico por contato</span>
        </div>
        <div class="tg-search-wrap">
          <input type="search" id="tg-search" placeholder="Buscar contato..." autocomplete="off" />
        </div>
        <div id="tg-thread-list" class="tg-thread-list">
          <div class="tg-loading">Carregando contatos...</div>
        </div>
      </aside>
      <section class="tg-chat glass-3d">
        <header class="tg-chat-head" id="tg-chat-head">
          <div class="tg-chat-head-placeholder">
            <div class="tg-avatar tg-avatar--lg">💬</div>
            <div>
              <strong>Selecione um contato</strong>
              <span>Veja toda a conversa como no Telegram</span>
            </div>
          </div>
        </header>
        <div id="tg-messages" class="tg-messages">
          <div class="tg-empty-chat">
            <div class="tg-empty-orbit" aria-hidden="true"></div>
            <p>Escolha um lead na lista ao lado.</p>
          </div>
        </div>
      </section>
    </div>
    <script src="/panel/conversations.js" defer></script>`;

  return wrap("Conversas", "conversations", body, partial);
}
