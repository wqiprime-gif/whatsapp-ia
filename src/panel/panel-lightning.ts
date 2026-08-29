/** Raios no login — a cada 3,5s até 3 raios, leve na GPU. */
export function loginLightningScript() {
  return `
(function(){
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var canvas = document.getElementById("login-lightning-canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var w, h, bolts = [], flash = 0;
  var INTERVAL = 3500;

  function resize(){
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  function branch(x, y, len, angle, depth){
    if (depth <= 0 || len < 6) return [{x:x,y:y}];
    var pts = [{x:x,y:y}];
    var segs = 4 + Math.floor(Math.random()*3);
    var cx = x, cy = y, a = angle;
    for (var i = 0; i < segs; i++){
      var step = len / segs;
      a += (Math.random()-0.5) * 0.45;
      cx += Math.cos(a) * step;
      cy += Math.sin(a) * step;
      if (Math.random() < 0.28 && depth > 1){
        var sub = branch(cx, cy, len*0.45, a + (Math.random()>0.5?0.6:-0.6), depth-1);
        bolts.push({ pts: sub, life: 1, width: 0.8 + Math.random()*0.6 });
      }
    }
    pts.push({x:cx,y:cy});
    return pts;
  }

  function spawnBolt(){
    if (bolts.length >= 8) return;
    var x = w * (0.1 + Math.random() * 0.8);
    var pts = branch(x, -25, h * (0.38 + Math.random()*0.35), Math.PI/2 + (Math.random()-0.5)*0.4, 5);
    bolts.push({ pts: pts, life: 1, width: 1.4 + Math.random()*1.2 });
    flash = 0.14 + Math.random() * 0.1;
  }

  function burst(){
    var n = 3;
    for (var i = 0; i < n; i++) setTimeout(spawnBolt, i * 70);
  }

  setInterval(burst, INTERVAL);
  setTimeout(burst, 800);

  function loop(){
    ctx.clearRect(0,0,w,h);
    if (flash > 0){
      ctx.fillStyle = "rgba(255, 255, 255," + (flash * 0.08) + ")";
      ctx.fillRect(0,0,w,h);
      flash *= 0.86;
    }
    for (var i = bolts.length-1; i >= 0; i--){
      var b = bolts[i];
      b.life -= 0.042;
      if (b.life <= 0){ bolts.splice(i,1); continue; }
      var alpha = b.life * 0.82;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(255, 255, 255," + alpha + ")";
      ctx.lineWidth = b.width * b.life;
      ctx.beginPath();
      for (var j = 0; j < b.pts.length; j++){
        if (j === 0) ctx.moveTo(b.pts[j].x, b.pts[j].y);
        else ctx.lineTo(b.pts[j].x, b.pts[j].y);
      }
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 255, 255," + (alpha*0.5) + ")";
      ctx.lineWidth = (b.width * 0.45) * b.life;
      ctx.stroke();
    }
    requestAnimationFrame(loop);
  }
  loop();
})();
`.trim();
}
