/** Partículas suaves no login do painel WhatsApp (mesmo estilo BotManager). */
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var canvas = document.getElementById("auth-particles");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var w, h, parts = [];
  var COUNT = 80;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  function spawn() {
    return {
      x: Math.random() * w,
      y: -Math.random() * h * 0.2,
      r: 0.6 + Math.random() * 2,
      vy: 0.4 + Math.random() * 1.2,
      vx: -0.25 + Math.random() * 0.5,
      a: 0.12 + Math.random() * 0.45,
      tw: Math.random() * Math.PI * 2
    };
  }
  for (var i = 0; i < COUNT; i++) parts.push(spawn());

  function loop() {
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.tw += 0.02;
      p.y += p.vy;
      p.x += p.vx + Math.sin(p.tw) * 0.12;
      var fade = p.a * (1 - Math.min(1, p.y / h));
      if (p.y > h + 8 || fade < 0.02) {
        parts[i] = spawn();
        continue;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(200,255,220," + fade + ")";
      ctx.fill();
    }
    requestAnimationFrame(loop);
  }
  loop();
})();
