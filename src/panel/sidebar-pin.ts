/** Fixador da sidebar — mantém o menu expandido entre páginas (localStorage).
 *  Roda logo após o <aside> para o estado já valer na primeira pintura. */
export const sidebarPinScript = `
<script>
(function () {
  var KEY = "x1black:sidebar-pinned";
  var sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  function isPinned() {
    try { return localStorage.getItem(KEY) === "1"; } catch (_) { return false; }
  }
  function apply(pinned) {
    sidebar.classList.toggle("is-pinned", pinned);
    var btn = document.getElementById("sidebar-pin");
    if (btn) {
      btn.setAttribute("aria-pressed", pinned ? "true" : "false");
      var label = btn.querySelector(".nav-text");
      if (label) label.textContent = pinned ? "Desafixar sidebar" : "Fixar sidebar";
      btn.title = pinned ? "Desafixar sidebar" : "Fixar sidebar";
    }
  }

  apply(isPinned());

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("#sidebar-pin");
    if (!btn) return;
    e.preventDefault();
    var next = !isPinned();
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch (_) {}
    apply(next);
  });
})();
</script>`;
