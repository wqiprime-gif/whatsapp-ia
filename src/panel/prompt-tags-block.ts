import { PROMPT_ACTION_TAGS, PROMPT_EFFECTIVE_HINT, PROMPT_TAGS_HINT } from "../lib/prompt-tags.js";
import { escapeHtml } from "./layout.js";

/** Painel lateral fixo — guia completo das tags para clientes. */
export function promptTagsSidebar() {
  const items = PROMPT_ACTION_TAGS.map(
    (item) => `<article class="prompt-tag-doc">
      <button type="button" class="prompt-tag-doc-head" data-prompt-tag="${escapeHtml(item.tag)}" title="Inserir no prompt">
        <code>${escapeHtml(item.tag)}</code>
        <span class="prompt-tag-doc-label">${escapeHtml(item.label)}</span>
      </button>
      <p class="prompt-tag-doc-when">${escapeHtml(item.when)}</p>
      ${item.example ? `<p class="prompt-tag-doc-ex"><strong>Ex:</strong> ${escapeHtml(item.example)}</p>` : ""}
    </article>`
  ).join("");

  return `
    <aside class="instance-form-aside" id="prompt-tags">
      <div class="prompt-tags-panel">
        <div class="prompt-tags-panel-head">
          <span class="prompt-tags-panel-icon">⚡</span>
          <div>
            <h4>Tags do prompt</h4>
            <p>${escapeHtml(PROMPT_TAGS_HINT)}</p>
          </div>
        </div>
        <p class="form-hint prompt-tags-panel-tip">Clique na tag para inserir no cursor do prompt.</p>
        <div class="prompt-tag-doc-list">${items}</div>
        <div class="prompt-tags-panel-foot">
          <p>${escapeHtml(PROMPT_EFFECTIVE_HINT)}</p>
          <p><strong>Comprovante:</strong> lead manda imagem/PDF → sistema valida sozinho.</p>
          <p><strong>Entrega:</strong> após pagamento aprovado, envia link e mídias de Entrega do produto.</p>
        </div>
      </div>
    </aside>
    <script>
      (function(){
        document.querySelectorAll("[data-prompt-tag]").forEach(function(btn){
          btn.addEventListener("click", function(){
            var tag = btn.getAttribute("data-prompt-tag") || "";
            var ta = document.querySelector('[name="prompt"]');
            if (!ta || !tag) return;
            var start = ta.selectionStart ?? ta.value.length;
            var end = ta.selectionEnd ?? ta.value.length;
            var before = ta.value.slice(0, start);
            var after = ta.value.slice(end);
            var glue = before && !/\\s$/.test(before) ? " " : "";
            ta.value = before + glue + tag + (after && !/^\\s/.test(after) ? " " : "") + after;
            ta.focus();
            var pos = (before + glue + tag).length;
            ta.setSelectionRange(pos, pos);
            ta.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        });
      })();
    </script>`;
}

/** Bloco inline (legado) — mantido para outras páginas se necessário. */
export function promptTagsBlock() {
  return promptTagsSidebar();
}
