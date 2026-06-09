/** Cena 3D: partículas flutuantes + raios azuis (Three.js). */
export function panelSceneScript(mode: "auth" | "app" = "app") {
  const intensity = mode === "auth" ? "0.35" : "0.72";
  const particles = mode === "auth" ? 380 : 1400;
  return `
(function(){
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var canvas = document.getElementById("panel-scene-canvas");
  if (!canvas) return;
  canvas.style.opacity = "${intensity}";

  var s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.min.js";
  s.onload = function(){
    var THREE = window.THREE;
    var w = window.innerWidth, h = window.innerHeight;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(52, w/h, 0.1, 150);
    camera.position.set(0, 0, 9);

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    var blue = 0x25d366;
    var cyan = 0x00b4ff;
    var white = 0xddeeff;

    var group = new THREE.Group();
    scene.add(group);

    var core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.1, 2),
      new THREE.MeshPhysicalMaterial({
        color: blue, metalness: 0.95, roughness: 0.08,
        emissive: 0x0033aa, emissiveIntensity: 0.55,
        clearcoat: 1, transparent: true, opacity: 0.85
      })
    );
    group.add(core);

    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.022, 64, 120),
      new THREE.MeshBasicMaterial({ color: cyan, transparent: true, opacity: 0.45 })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    var rayCount = 14;
    var rayGroup = new THREE.Group();
    for (var r = 0; r < rayCount; r++) {
      var angle = (r / rayCount) * Math.PI * 2;
      var pts = new Float32Array([0, 0, 0, Math.cos(angle) * 16, Math.sin(angle) * 16, -3]);
      var geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
      rayGroup.add(new THREE.Line(geo, new THREE.LineBasicMaterial({
        color: blue, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending
      })));
    }
    scene.add(rayGroup);

    var pCount = ${particles};
    var positions = new Float32Array(pCount * 3);
    var velocities = [];
    for (var i = 0; i < pCount; i++) {
      positions[i*3] = (Math.random() - 0.5) * 32;
      positions[i*3+1] = (Math.random() - 0.5) * 22;
      positions[i*3+2] = (Math.random() - 0.5) * 16;
      velocities.push({
        x: (Math.random() - 0.5) * 0.012,
        y: (Math.random() - 0.5) * 0.008,
        z: (Math.random() - 0.5) * 0.006
      });
    }
    var pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    var particlesMesh = new THREE.Points(pGeo, new THREE.PointsMaterial({
      size: 0.045, color: white, transparent: true, opacity: 0.75,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    }));
    scene.add(particlesMesh);

    scene.add(new THREE.AmbientLight(0xffffff, 0.22));
    var l1 = new THREE.PointLight(blue, 2.2, 45); l1.position.set(5, 4, 8); scene.add(l1);
    var l2 = new THREE.PointLight(cyan, 1.6, 40); l2.position.set(-6, -3, 5); scene.add(l2);

    var mx = 0, my = 0;
    document.addEventListener("mousemove", function(e){
      mx = (e.clientX / w - 0.5) * 1.0;
      my = (e.clientY / h - 0.5) * 0.6;
    });

    var t0 = performance.now();
    function loop(now){
      var t = (now - t0) * 0.001;
      group.rotation.x = t * 0.08 + my * 0.22;
      group.rotation.y = t * 0.11 + mx * 0.3;
      rayGroup.rotation.z = t * 0.025;
      var pos = pGeo.attributes.position.array;
      for (var j = 0; j < pCount; j++) {
        pos[j*3] += velocities[j].x;
        pos[j*3+1] += velocities[j].y;
        pos[j*3+2] += velocities[j].z;
        if (Math.abs(pos[j*3]) > 16) velocities[j].x *= -1;
        if (Math.abs(pos[j*3+1]) > 11) velocities[j].y *= -1;
        if (Math.abs(pos[j*3+2]) > 8) velocities[j].z *= -1;
      }
      pGeo.attributes.position.needsUpdate = true;
      particlesMesh.rotation.y = t * 0.03;
      camera.position.x = mx * 0.5;
      camera.position.y = -my * 0.35;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    }
    loop(performance.now());

    window.addEventListener("resize", function(){
      w = window.innerWidth; h = window.innerHeight;
      camera.aspect = w/h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
  };
  document.head.appendChild(s);
})();
`.trim();
}
