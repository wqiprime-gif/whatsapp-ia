/** Gerador de prompt com IA — bloco no formulário de instância. */
export function promptGeneratorBlock() {
  return `
    <div class="form-section span-2" id="prompt-generator">
      <div class="form-section-head">
        <span class="form-section-icon form-section-icon-cyan">✨</span>
        <div>
          <h4>Gerador de prompt</h4>
          <p>Descreva a persona e a IA monta um prompt pronto com as tags corretas.</p>
        </div>
      </div>
      <div class="prompt-gen-grid">
        <label class="field">Nome da persona
          <input id="pg-persona" placeholder="Ex: Morena VIP" />
        </label>
        <label class="field">Tom
          <select id="pg-tone">
            <option value="carinhosa e safadinha">Carinhosa e safadinha</option>
            <option value="misteriosa e provocante">Misteriosa e provocante</option>
            <option value="fofa e descontraída">Fofa e descontraída</option>
            <option value="direta mas gentil">Direta mas gentil</option>
          </select>
        </label>
        <label class="field span-2">Nicho / o que vende
          <input id="pg-niche" placeholder="Ex: packs de fotos e vídeos + chamada de vídeo" />
        </label>
        <label class="field span-2">Pacotes e preços
          <textarea id="pg-packages" rows="4" placeholder="Básico R$ 9,90 — 50 fotos&#10;Chamada 5min R$ 15&#10;Completo R$ 20"></textarea>
        </label>
        <label class="field span-2">Regras extras (opcional)
          <textarea id="pg-rules" rows="2" placeholder="Ex: não dar desconto abaixo de R$ 5 no básico"></textarea>
        </label>
      </div>
      <button type="button" class="btn btn-primary" id="pg-generate-btn">✨ Gerar prompt com IA</button>
      <p class="form-hint" id="pg-status" style="margin-top:8px"></p>
      <script>
        (function(){
          var btn = document.getElementById("pg-generate-btn");
          var status = document.getElementById("pg-status");
          if (!btn) return;
          btn.addEventListener("click", async function(){
            var persona = document.getElementById("pg-persona")?.value?.trim() || "";
            var tone = document.getElementById("pg-tone")?.value || "";
            var niche = document.getElementById("pg-niche")?.value?.trim() || "";
            var packages = document.getElementById("pg-packages")?.value?.trim() || "";
            var rules = document.getElementById("pg-rules")?.value?.trim() || "";
            if (!persona || !packages) {
              status.textContent = "Preencha pelo menos nome da persona e pacotes.";
              status.style.color = "var(--danger)";
              return;
            }
            btn.disabled = true;
            status.textContent = "Gerando prompt...";
            status.style.color = "var(--muted)";
            try {
              var res = await fetch("/api/prompt-generator", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ personaName: persona, tone: tone, niche: niche, packages: packages, extraRules: rules })
              });
              var data = await res.json();
              if (!res.ok) throw new Error(data.error || "Erro ao gerar");
              var ta = document.querySelector('[name="prompt"]');
              if (ta) { ta.value = data.prompt || ""; ta.focus(); }
              status.textContent = "Prompt gerado! Revise e salve a instância.";
              status.style.color = "var(--primary)";
            } catch (e) {
              status.textContent = e.message || "Falha ao gerar prompt. Configure a IA na instância.";
              status.style.color = "var(--danger)";
            } finally {
              btn.disabled = false;
            }
          });
        })();
      </script>
    </div>`;
}
