/** Partículas / neve suave no login — leve, somem ao cair. */
export function loginParticlesScript() {
  return `
(function(){
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var canvas = document.getElementById("login-particles-canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var w, h, parts = [];
  var COUNT = 90;

  function resize(){
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  function spawn(){
    return {
      x: Math.random() * w,
      y: -Math.random() * h * 0.2,
      r: 0.6 + Math.random() * 2.2,
      vy: 0.4 + Math.random() * 1.4,
      vx: -0.3 + Math.random() * 0.6,
      a: 0.15 + Math.random() * 0.55,
      tw: Math.random() * Math.PI * 2
    };
  }

  for (var i = 0; i < COUNT; i++) parts.push(spawn());

  function loop(){
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < parts.length; i++){
      var p = parts[i];
      p.tw += 0.02;
      p.y += p.vy;
      p.x += p.vx + Math.sin(p.tw) * 0.15;
      var fade = p.a * (1 - Math.min(1, p.y / h));
      if (p.y > h + 8 || fade < 0.02){
        parts[i] = spawn();
        continue;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(220,235,255," + fade + ")";
      ctx.fill();
      if (p.r > 1.2){
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(10,92,255," + (fade * 0.35) + ")";
        ctx.fill();
      }
    }
    requestAnimationFrame(loop);
  }
  loop();
})();
`.trim();
}
