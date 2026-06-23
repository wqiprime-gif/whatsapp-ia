/** Script autônomo do drawer mobile — não depende do SPA client. */
export const mobileDrawerScript = `
<script>
(function () {
  function openDrawer() {
    var drawer = document.getElementById("mobile-menu-drawer");
    var backdrop = document.getElementById("mobile-drawer-backdrop");
    if (!drawer || !backdrop) return;
    drawer.classList.add("mobile-menu-drawer--open");
    backdrop.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    backdrop.setAttribute("aria-hidden", "false");
    document.body.classList.add("mobile-menu-open");
  }
  function closeDrawer() {
    var drawer = document.getElementById("mobile-menu-drawer");
    var backdrop = document.getElementById("mobile-drawer-backdrop");
    if (!drawer || !backdrop) return;
    drawer.classList.remove("mobile-menu-drawer--open");
    backdrop.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    backdrop.setAttribute("aria-hidden", "true");
    document.body.classList.remove("mobile-menu-open");
  }
  function toggleDrawer() {
    var drawer = document.getElementById("mobile-menu-drawer");
    if (drawer && drawer.classList.contains("mobile-menu-drawer--open")) closeDrawer();
    else openDrawer();
  }
  window.toggleOnlyChatMobileMenu = toggleDrawer;
  window.closeOnlyChatMobileMenu = closeDrawer;
  document.addEventListener("click", function (e) {
    if (e.target.closest("#mobile-menu-btn")) {
      e.preventDefault();
      e.stopPropagation();
      toggleDrawer();
      return;
    }
    if (e.target.closest("#mobile-menu-close") || e.target.closest("#mobile-drawer-backdrop")) {
      closeDrawer();
      return;
    }
    if (e.target.closest("#mobile-menu-drawer a, #mobile-menu-drawer form[action='/logout'] button")) {
      closeDrawer();
    }
  }, true);
})();
</script>`;
