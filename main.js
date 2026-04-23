// SCENE SETUP
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xc2956b, 0.008);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 800);
camera.position.set(0, 2.2, 22);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

// resize handler so canvas fills window
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// LIGHTS
// main sun light, casts shadows
const sun = new THREE.DirectionalLight(0xffd090, 2.5);
sun.position.set(80, 120, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -120; sun.shadow.camera.right = 120;
sun.shadow.camera.top = 120;   sun.shadow.camera.bottom = -120;
sun.shadow.camera.near = 0.5;  sun.shadow.camera.far = 400;
scene.add(sun);

// fills in the shadows a bit
const ambient = new THREE.AmbientLight(0x8090a0, 0.7);
scene.add(ambient);

// fire lights, off by default until campfire is built
const fireGlow1 = new THREE.PointLight(0xff6a00, 0, 18);
fireGlow1.position.set(-3, 1.5, 8);
scene.add(fireGlow1);

const fireGlow2 = new THREE.PointLight(0xff3300, 0, 10);
fireGlow2.position.set(-3, 1, 8);
scene.add(fireGlow2);

// blue light near the water
const waterLight = new THREE.PointLight(0x44aaff, 1.2, 22);
waterLight.position.set(0, 1, -22);
scene.add(waterLight);

// TEXTURES
// helper to make a canvas texture from a draw function
function mkTex(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  fn(c.getContext('2d'), w, h);
  return new THREE.CanvasTexture(c);
}

// sand texture with noise dots and some wavy lines
const sandTex = mkTex(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#d4a96a'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 6000; i++) {
    ctx.fillStyle = `rgba(${160 + Math.random() * 60 | 0},${120 + Math.random() * 40 | 0},${60 + Math.random() * 30 | 0},0.25)`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  ctx.strokeStyle = 'rgba(180,140,80,0.1)';
  for (let i = 0; i < 30; i++) {
    ctx.lineWidth = 0.5 + Math.random() * 1.5;
    ctx.beginPath();
    const y = Math.random() * h;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.3, y + Math.random() * 20 - 10, w * 0.7, y + Math.random() * 20 - 10, w, y + Math.random() * 8 - 4);
    ctx.stroke();
  }
});
sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
sandTex.repeat.set(24, 24);

// grass texture, green base with tiny grass blade lines
const grassTex = mkTex(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#4a7a2c'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    ctx.strokeStyle = `rgba(${50 + Math.random() * 40 | 0},${90 + Math.random() * 60 | 0},${15 + Math.random() * 20 | 0},0.9)`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - 0.5) * 5, y - 5 - Math.random() * 6); ctx.stroke();
  }
});
grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
grassTex.repeat.set(4, 4);

// TERRAIN
// flat plane, then bump the outer vertices to make dunes
const tGeo = new THREE.PlaneGeometry(320, 320, 100, 100);
tGeo.rotateX(-Math.PI / 2);
const tPos = tGeo.attributes.position;
for (let i = 0; i < tPos.count; i++) {
  const x = tPos.getX(i), z = tPos.getZ(i), d = Math.sqrt(x * x + z * z);
  // keep center flat, push outer stuff up with some sine waves
  if (d > 28) tPos.setY(i, Math.sin(x * 0.07) * 2.2 + Math.cos(z * 0.065) * 2.8 + Math.sin(x * 0.18 + z * 0.14) * 0.9 + (Math.random() - 0.5) * 0.4);
}
tGeo.computeVertexNormals();
const terrain = new THREE.Mesh(tGeo, new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 }));
terrain.receiveShadow = true;
scene.add(terrain);

// grass patch near the oasis
const grass = new THREE.Mesh(
  new THREE.PlaneGeometry(24, 20),
  new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.9, transparent: true, opacity: 0.92 })
);
grass.rotation.x = -Math.PI / 2;
grass.position.set(-6, 0.02, -18);
grass.receiveShadow = true;
scene.add(grass);

// SKYBOX
// big inside-out sphere with a custom gradient shader
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {
    topColor: { value: new THREE.Color(0x3a6fa0) },
    botColor: { value: new THREE.Color(0xe8c088) }
  },
  vertexShader: `
    varying vec3 vW;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vW = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: `
    uniform vec3 topColor, botColor;
    varying vec3 vW;
    void main() {
      // blend top and bottom color based on Y height
      float h = normalize(vW).y + 0.3;
      gl_FragColor = vec4(mix(botColor, topColor, pow(max(h, 0.0), 0.5)), 1.0);
    }
  `
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat));

// WATER
// blue base with wavy line streaks
const waterTex = mkTex(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#1a5c8a'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) {
    ctx.strokeStyle = `rgba(100,200,255,${0.1 + Math.random() * 0.2})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const y = Math.random() * h;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.3, y + Math.random() * 10 - 5, w * 0.7, y + Math.random() * 10 - 5, w, y + Math.random() * 6 - 3);
    ctx.stroke();
  }
});
waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
waterTex.repeat.set(3, 3);

// circle mesh for the pond, low roughness so it looks wet
const waterGeo = new THREE.CircleGeometry(10, 48);
const waterMat = new THREE.MeshStandardMaterial({ map: waterTex, color: 0x1a7ab0, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.75 });
const water = new THREE.Mesh(waterGeo, waterMat);
water.rotation.x = -Math.PI / 2;
water.position.set(0, 0.05, -22);
water.receiveShadow = true;
scene.add(water);

// FISH
// just stretched orange spheres, looks fine from a distance
const fishMat = new THREE.MeshStandardMaterial({ color: 0xf0a020, roughness: 0.5 });
function makeFish(x, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), fishMat);
  m.scale.set(1.8, 0.6, 0.7);
  m.position.set(x, 0.08, z);
  m.castShadow = true;
  scene.add(m);
  return m;
}
const fish1 = makeFish(-1, -20);
const fish2 = makeFish(2, -23);

// PALM TREES
// trunk is a cylinder, canopy is a squashed sphere
const palms = [];
function makePalm(x, z, h) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.22, h, 6),
    new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 1 })
  );
  trunk.position.y = h / 2; trunk.castShadow = true; g.add(trunk);
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 7, 5),
    new THREE.MeshStandardMaterial({ color: 0x357a25, roughness: 0.9 })
  );
  canopy.scale.set(1, 0.55, 1); canopy.position.y = h + 0.5; canopy.castShadow = true; g.add(canopy);
  g.position.set(x, 0, z); palms.push(g); scene.add(g);
}
// place palms around the oasis with random heights
[[-9,-18],[9,-20],[-7,-27],[7,-16],[1,-31],[-12,-24],[11,-28]].forEach(([x, z]) => makePalm(x, z, 6.5 + Math.random() * 2));

// RUINS
// a few boxes arranged like broken walls
(function () {
  const g = new THREE.Group();
  const cm = new THREE.MeshStandardMaterial({ color: 0x9a8a78, roughness: 0.95 });
  [[8,3,0.5,0,1.5,0],[0.5,3,5,-4,1.5,-2.5],[5,1.5,0.5,2,0.75,-5]].forEach(([w, h, d, x, y, z]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cm);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m);
  });
  g.position.set(18, 0, -5); scene.add(g);
})();

// CRASHED PLANE
// made of primitive shapes, will swap with real model later if we have time
(function () {
  const g = new THREE.Group();
  const grey = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.7, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
  // main body
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.7, 12, 8), grey);
  fuse.rotation.z = Math.PI / 2; fuse.rotation.y = 0.55; fuse.position.set(0, 0.9, 0); fuse.castShadow = true; g.add(fuse);
  // left wing
  const wL = new THREE.Mesh(new THREE.BoxGeometry(7, 0.2, 2.5), grey);
  wL.rotation.y = 0.55; wL.rotation.z = -0.25; wL.position.set(-1.5, 0.55, 3); wL.castShadow = true; g.add(wL);
  // right wing (broken off, angled up)
  const wR = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 2), grey);
  wR.rotation.y = 0.55; wR.rotation.z = 0.4; wR.position.set(2, 1.6, -2); wR.castShadow = true; g.add(wR);
  // tail fin
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.5, 2.8), grey);
  tail.position.set(-4.5, 2, 0.8); tail.rotation.y = 0.28; g.add(tail);
  // engine cylinder
  const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.38, 2, 8), dark);
  eng.rotation.z = Math.PI / 2; eng.position.set(0, 0.3, 3); g.add(eng);
  g.position.set(-9, 0, 5); g.rotation.y = 0.3;
  g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  scene.add(g);
})();

// SKULL
// simple bone-colored sphere, just some set dressing
(function () {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 8, 7),
    new THREE.MeshStandardMaterial({ color: 0xd4c9a8, roughness: 0.85 })
  );
  m.position.set(6, 0.2, 12); m.castShadow = true; m.receiveShadow = true; scene.add(m);
})();

// CAPTAIN
// box body + sphere head, jointed arms and legs so we can animate him
const captainGroup = new THREE.Group();
captainGroup.position.set(-3, 0, 8);
scene.add(captainGroup);

const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a5a7a, roughness: 0.9 });
const headMat = new THREE.MeshStandardMaterial({ color: 0xd4956a, roughness: 0.9 });
const cap = {};

(function () {
  const g = captainGroup;
  // torso, hips, head
  cap.torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.55, 0.22), bodyMat); cap.torso.position.y = 0.65; g.add(cap.torso);
  cap.hips  = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.20), bodyMat); cap.hips.position.y  = 0.32; g.add(cap.hips);
  cap.head  = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 6), headMat);    cap.head.position.y  = 1.1;  g.add(cap.head);
  cap.capMesh = cap.head;

  // arm builder, upper arm + forearm on nested groups so we can rotate joints
  const mkArm = (side) => {
    const ag = new THREE.Group(); ag.position.set(side * 0.22, 0.93, 0); g.add(ag);
    const ua = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.38, 5), bodyMat); ua.position.y = -0.19; ag.add(ua);
    const fg = new THREE.Group(); fg.position.y = -0.38; ag.add(fg);
    const fa = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.30, 5), bodyMat);  fa.position.y = -0.15; fg.add(fa);
    return { ag, fg };
  };
  // same idea for legs, thigh + shin
  const mkLeg = (side) => {
    const lg = new THREE.Group(); lg.position.set(side * 0.1, 0.32, 0); g.add(lg);
    const th = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.065, 0.40, 5), bodyMat); th.position.y = -0.20; lg.add(th);
    const sg = new THREE.Group(); sg.position.y = -0.40; lg.add(sg);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.36, 5), bodyMat); sh.position.y = -0.18; sg.add(sh);
    return { lg, sg };
  };
  // save refs to each limb group so updateCaptain can rotate them
  const armL = mkArm(-1); const armR = mkArm(1);
  cap.aLg = armL.ag; cap.aLf = armL.fg;
  cap.aRg = armR.ag; cap.aRf = armR.fg;
  const legL = mkLeg(-1); const legR = mkLeg(1);
  cap.lLg = legL.lg; cap.lLs = legL.sg;
  cap.lRg = legR.lg; cap.lRs = legR.sg;
  g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
})();

// captain state machine, each state has its own animation logic
let captainState = 'idle_day', captainAnimT = 0;
function setCaptainState(s) { captainState = s; captainAnimT = 0; }
// little helpers
function lp(a, b, t) { return a + (b - a) * t; }
function cl(v) { return Math.max(0, Math.min(1, v)); }

function updateCaptain(dt, gt) {
  captainAnimT += dt;
  const at = captainAnimT, g = captainGroup;
  // shortcut to set all limb rotations at once
  const setAll = (torsoY, headY, aLx, aLz, aRx, aRz, fLx, fRx, lLx, lRx, sLx, sRx) => {
    cap.torso.position.y = torsoY; cap.head.position.y = headY;
    cap.aLg.rotation.x = aLx; cap.aLg.rotation.z = aLz;
    cap.aRg.rotation.x = aRx; cap.aRg.rotation.z = aRz;
    cap.aLf.rotation.x = fLx; cap.aRf.rotation.x = fRx;
    cap.lLg.rotation.x = lLx; cap.lRg.rotation.x = lRx;
    cap.lLs.rotation.x = sLx; cap.lRs.rotation.x = sRx;
  };
  if (captainState === 'idle_day') {
    // standing still, slow breathing and arm sway
    g.position.set(-3, 0, 8); g.rotation.x = 0; g.rotation.y = Math.sin(gt * 0.3) * 0.08 - 0.4;
    cap.head.rotation.z = Math.sin(gt * 0.8) * 0.06; cap.head.rotation.y = 0; cap.head.rotation.x = 0;
    setAll(0.65 + Math.sin(gt * 1.5) * 0.005, 1.1 + Math.sin(gt * 1.5) * 0.005,
      Math.sin(gt * 0.9) * 0.05, Math.sin(gt * 1.2) * 0.12 + 0.1,
      -Math.sin(gt * 0.9) * 0.05, -Math.sin(gt * 1.2 + 1) * 0.12 - 0.1,
      -0.15, -0.15, 0, 0, 0, 0);
  } else if (captainState === 'building_fire') {
    // crouched down, arms moving fast like he's gathering wood
    g.position.set(-3, 0, 8); g.rotation.x = 0; g.rotation.y = -0.5;
    cap.head.rotation.x = -0.3; cap.head.rotation.z = 0; cap.head.rotation.y = 0;
    const py = lp(0.65, 0.32, cl(at * 1.5));
    setAll(py, py + 0.45, -0.8 + Math.sin(gt * 10) * 0.6, 0.4, -0.8 + Math.cos(gt * 10) * 0.6, -0.4,
      -0.5 + Math.sin(gt * 10) * 0.3, -0.5 + Math.cos(gt * 10) * 0.3, -1.1, -1.1, 1.4, 1.4);
    // after 3 sec, fire is built
    if (at > 3.0) activateFire();
  } else if (captainState === 'sitting_fire') {
    // sitting cross-legged next to the campfire
    g.position.set(-3, 0, 8); g.rotation.x = 0; g.rotation.y = -0.5;
    cap.head.rotation.z = Math.sin(gt * 0.5) * 0.04; cap.head.rotation.x = 0.1; cap.head.rotation.y = 0;
    setAll(0.4, 0.85, -0.3, 0.5, -0.3, -0.5, -0.8, -0.8, -1.6, -1.6, 1.8, 1.8);
    cap.aLg.position.set(-0.22, 0.68, 0); cap.aRg.position.set(0.22, 0.68, 0);
  } else if (captainState === 'frustrated') {
    // arms in the air, shaking head, mad the fire got ruined
    g.position.set(-3, 0, 8); g.rotation.x = 0;
    g.rotation.y = -0.5 + Math.sin(gt * 6) * 0.15;
    cap.head.rotation.z = Math.sin(gt * 8) * 0.28; cap.head.rotation.y = Math.sin(gt * 6) * 0.3;
    const raise = Math.sin(at * 3) * 0.4 + 0.6;
    setAll(0.65, 1.1, -(0.8 + raise), 0.5 + Math.sin(gt * 5) * 0.3, -(0.8 + raise), -0.5 - Math.sin(gt * 5) * 0.3,
      -0.5, -0.5, -1.6, -1.6, 1.8, 1.8);
    // after frustrated animation, he gives up and lies down
    if (at > 4.5) setCaptainState('lying_pointing');
  } else if (captainState === 'lying_pointing') {
    // lies down slowly, arm pointing back toward the plane
    const pct = cl(at * 0.4);
    g.rotation.x = lp(0, 1.45, pct);
    g.position.y = lp(0, -0.35, pct);
    cap.head.rotation.z = 0; cap.head.rotation.y = 0; cap.head.rotation.x = 0;
    cap.aRg.rotation.x = -Math.PI * 0.9; cap.aRg.rotation.z = -0.15; cap.aRf.rotation.x = -0.1;
    cap.aLg.rotation.x = -0.1; cap.aLg.rotation.z = 0.4; cap.aLf.rotation.x = -0.3;
    cap.lLg.rotation.x = 0; cap.lRg.rotation.x = 0; cap.lLs.rotation.x = 0; cap.lRs.rotation.x = 0;
    // small chest rise and fall so he looks like he's still breathing
    cap.torso.position.y = 0.55 + Math.sin(gt * 1.2) * 0.008; cap.head.position.y = 0.98;
  }
}

// CAMPFIRE
// hidden at first, shows up when captain builds it
const campfireGroup = new THREE.Group();
campfireGroup.position.set(-3.4, 0, 7.5);
campfireGroup.visible = false;
scene.add(campfireGroup);
// log
const logPlaceholder = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0x4a2e0a, roughness: 1 }));
logPlaceholder.position.y = 0.06; campfireGroup.add(logPlaceholder);
// ring of stones, made from a torus
const stoneRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 5, 10), new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 1 }));
stoneRing.rotation.x = Math.PI / 2; stoneRing.position.y = 0.08; campfireGroup.add(stoneRing);

// FIRE PARTICLES
// each particle is a little sphere with its own lifespan
const allFireParts = [];
function spawnFire(ox, oy, oz, scl, grp) {
  const m = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.85 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.11 * scl, 4, 4), m);
  // store stuff per particle, velocity, life, origin point
  mesh.userData = { vx: (Math.random() - 0.5) * 0.04, vy: 0.04 + Math.random() * 0.07, vz: (Math.random() - 0.5) * 0.04, life: Math.random(), maxLife: 0.7 + Math.random() * 0.6, ox, oy, oz, scl };
  mesh.position.set(ox + (Math.random() - 0.5) * 0.4, oy, oz + (Math.random() - 0.5) * 0.4);
  grp.add(mesh); allFireParts.push(mesh); return mesh;
}

// crash fire, big fire at the plane
const crashFireGrp = new THREE.Group(); scene.add(crashFireGrp);
for (let i = 0; i < 70; i++) spawnFire(-13 + Math.random() * 3, 0.5, 7 + Math.random() * 2, 1.1, crashFireGrp);
for (let i = 0; i < 30; i++) spawnFire(-16, 0.5, 10, 0.7, crashFireGrp);

// campfire, smaller fire, hidden till captain builds it
const campFireGrp = new THREE.Group(); campFireGrp.visible = false; scene.add(campFireGrp);
const campParts = [];
for (let i = 0; i < 45; i++) campParts.push(spawnFire(-3.4, 0.3, 7.5, 0.65, campFireGrp));

// update each particle every frame
function tickFire(list, t, dt) {
  list.forEach(m => {
    m.userData.life += dt;
    // if it died, reset it back to the origin
    if (m.userData.life > m.userData.maxLife) {
      m.userData.life = 0;
      m.position.set(m.userData.ox + (Math.random() - 0.5) * 0.5, m.userData.oy, m.userData.oz + (Math.random() - 0.5) * 0.5);
      m.material.opacity = 0.85; return;
    }
    // move up, fade out, grow bigger over life
    const p = m.userData.life / m.userData.maxLife;
    m.position.x += m.userData.vx + Math.sin(t * 3) * 0.004;
    m.position.y += m.userData.vy * (1 - p * 0.5);
    m.position.z += m.userData.vz;
    m.material.opacity = 0.85 * (1 - p);
    m.scale.setScalar((1 + p * 1.5) * m.userData.scl);
    // color shifts from orange to red to dark as it ages
    m.material.color.setHex(p < 0.3 ? 0xff4400 : p < 0.6 ? 0xff8800 : 0x444444);
  });
}

// SMOKE
// dark spheres that rise and grow, same lifespan idea as fire
const smokeParts = [];
const smokeGrp = new THREE.Group(); scene.add(smokeGrp);
for (let i = 0; i < 80; i++) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.5 + Math.random() * 0.5, 5, 5), new THREE.MeshBasicMaterial({ color: 0x181818, transparent: true, opacity: 0.15 }));
  s.userData = { vx: (Math.random() - 0.5) * 0.012, vy: 0.02 + Math.random() * 0.025, vz: (Math.random() - 0.5) * 0.012, life: Math.random() };
  s.position.set(-13 + (Math.random() - 0.5) * 3, 2 + Math.random() * 5, 7 + (Math.random() - 0.5) * 2);
  smokeGrp.add(s); smokeParts.push(s);
}

// ROCKS & CRATES
// random rocks scattered around the terrain
const rMat = new THREE.MeshStandardMaterial({ color: 0x998877, roughness: 0.95 });
[[-5,8],[12,-3],[20,12],[-18,-8],[8,15],[-14,10],[22,-10],[4,18],[-20,5]].forEach(([x, z]) => {
  const s = 0.4 + Math.random() * 1.3;
  const r = new THREE.Mesh(new THREE.SphereGeometry(s, 6, 5), rMat);
  r.position.set(x, s * 0.5, z); r.castShadow = true; r.receiveShadow = true; scene.add(r);
});
// a few wooden crates near the ruins
const crateMat = new THREE.MeshStandardMaterial({ color: 0x7a6040, roughness: 1 });
[[14,5],[16,7],[13,8]].forEach(([x, z]) => {
  const c = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.75, 0.9), crateMat);
  c.position.set(x, 0.38, z); c.rotation.y = Math.random() * 0.8 - 0.4;
  c.castShadow = true; c.receiveShadow = true; scene.add(c);
});

// RAIN
// just a bunch of short vertical lines that fall and reset
const rainDrops = [];
const rainGrp = new THREE.Group(); rainGrp.visible = false; scene.add(rainGrp);
for (let i = 0; i < 1500; i++) {
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0,0,-0.5,0], 3));
  const d = new THREE.Line(rg, new THREE.LineBasicMaterial({ color: 0x99bbdd, transparent: true, opacity: 0.45 }));
  d.position.set((Math.random() - 0.5) * 180, Math.random() * 65, (Math.random() - 0.5) * 180);
  d.userData = { speed: 0.9 + Math.random() * 0.6 };
  rainGrp.add(d); rainDrops.push(d);
}

// DAY / NIGHT / RAIN STATES
// each state holds all the lighting and fog values we want to hit
const STATES = {
  day:   { sI:2.5,  sC:new THREE.Color(0xffd090), aI:0.7,  aC:new THREE.Color(0x8090a0), sT:new THREE.Color(0x3a6fa0), sB:new THREE.Color(0xe8c088), fC:new THREE.Color(0xc2956b), fD:0.008 },
  night: { sI:0.18, sC:new THREE.Color(0x4060a0), aI:0.12, aC:new THREE.Color(0x102040), sT:new THREE.Color(0x050a1a), sB:new THREE.Color(0x0a1a30), fC:new THREE.Color(0x050a1a), fD:0.012 },
  rain:  { sI:0.45, sC:new THREE.Color(0x7090b0), aI:0.22, aC:new THREE.Color(0x304050), sT:new THREE.Color(0x181e28), sB:new THREE.Color(0x303d44), fC:new THREE.Color(0x20292e), fD:0.02  }
};

let curState = 'day', isNight = false, rainActive = false, fireBuilt = false, fireActivating = false;
// tr holds the transition progress, dur is how long it takes
let tr = { on: false, from: null, to: null, p: 1, dur: 3.5 };

// grab whatever the scene looks like right now so we can lerp from it
function snapFrom() {
  return {
    sI: sun.intensity,
    sC: sun.color.clone(),
    aI: ambient.intensity,
    aC: ambient.color.clone(),
    sT: skyMat.uniforms.topColor.value.clone(),
    sB: skyMat.uniforms.botColor.value.clone(),
    fC: scene.fog.color.clone(),
    fD: scene.fog.density
  };
}
// kick off a transition to a new state
function goState(n) {
  if (n === curState) return;
  tr.from = snapFrom(); tr.to = STATES[n]; tr.p = 0; tr.on = true;
  curState = n; isNight = n === 'night';
}
// actually does the interpolation, gets called every frame during a transition
function lerpSt(a, b, al) {
  sun.intensity = lp(a.sI, b.sI, al); sun.color.copy(a.sC).lerp(b.sC, al);
  ambient.intensity = lp(a.aI, b.aI, al); ambient.color.copy(a.aC).lerp(b.aC, al);
  skyMat.uniforms.topColor.value.copy(a.sT).lerp(b.sT, al);
  skyMat.uniforms.botColor.value.copy(a.sB).lerp(b.sB, al);
  scene.fog.color.copy(a.fC).lerp(b.fC, al);
  scene.fog.density = lp(a.fD || 0.008, b.fD || 0.008, al);
}

// INTERACTIONS
// little popup text at top of screen, auto fades
let statusTm = null;
function showStatus(m) {
  const el = document.getElementById('status');
  el.textContent = m; el.style.opacity = '1';
  clearTimeout(statusTm);
  statusTm = setTimeout(() => el.style.opacity = '0', 3200);
}

// turn on the campfire
function activateFire() {
  if (fireBuilt || fireActivating) return;
  fireBuilt = true; fireActivating = false;
  campfireGroup.visible = true; campFireGrp.visible = true;
  setCaptainState('sitting_fire');
  showStatus('Fire lit. Warmth at last.');
}

// F key, try to build the fire, has a bunch of checks
function handleFireKey() {
  if (!isNight)  { showStatus('Night time only, press [T] first'); return; }
  if (fireBuilt) { showStatus('Fire already burning'); return; }
  if (rainActive){ showStatus("Can't light fire in the rain"); return; }
  if (captainState === 'lying_pointing') { showStatus('Too exhausted...'); return; }
  if (fireActivating) return;
  fireActivating = true;
  setCaptainState('building_fire');
  showStatus('Captain building fire...');
}

// R key, toggle rain on and off
function handleRainKey() {
  if (!rainActive) {
    rainActive = true; rainGrp.visible = true; goState('rain'); showStatus('Rain...');
    // if the fire was going, rain puts it out after a short delay
    if (fireBuilt) {
      fireBuilt = false;
      setTimeout(() => {
        campfireGroup.visible = false; campFireGrp.visible = false;
        fireGlow1.intensity = 0; fireGlow2.intensity = 0;
        setCaptainState('frustrated');
        showStatus('Fire out. Captain is furious.');
      }, 1800);
    } else if (fireActivating) { fireActivating = false; setCaptainState('idle_day'); }
  } else {
    // turning rain off, go back to whatever state we were in before
    rainActive = false; rainGrp.visible = false;
    goState(isNight ? 'night' : 'day');
    showStatus('Rain clears...');
  }
}

// T key, swap between day and night
function toggleTime() {
  if (rainActive) { showStatus('Stop rain first [R]'); return; }
  if (curState === 'night') {
    // going back to day, reset fire stuff
    goState('day'); isNight = false; fireBuilt = false; fireActivating = false;
    campfireGroup.visible = false; campFireGrp.visible = false;
    fireGlow1.intensity = 0; fireGlow2.intensity = 0;
    setCaptainState('idle_day'); showStatus('Dawn breaks');
  } else {
    goState('night'); isNight = true; setCaptainState('idle_day'); showStatus('Night falls...');
  }
}

// INTRO CRASH SEQUENCE
// 9 second cutscene at the start, camera follows a scripted path
const INTRO_DUR = 9.0;
let introActive = true;
let introDone   = false;

// keyframes, each one has a time, camera position, and where to look
const introPath = [
  { t:0,   pos:new THREE.Vector3( 60, 80, 80), look:new THREE.Vector3(-9, 0, 5) },
  { t:2,   pos:new THREE.Vector3( 30, 55, 50), look:new THREE.Vector3(-9, 0, 5) },
  { t:4.5, pos:new THREE.Vector3( -2, 22, 28), look:new THREE.Vector3(-9, 0, 5) },
  { t:6,   pos:new THREE.Vector3( -9,  1,  8), look:new THREE.Vector3(-9, 0, 5) },
  { t:7.5, pos:new THREE.Vector3( -9, 0.1, 7), look:new THREE.Vector3(-12,0.5,5) },
  { t:9,   pos:new THREE.Vector3( -3, 2.2, 22),look:new THREE.Vector3(  0, 1, 0) },
];

// black overlay for the fade-in at the start
const overlay = document.createElement('div');
Object.assign(overlay.style, { position:'fixed', inset:'0', background:'#000', opacity:'1', pointerEvents:'none', transition:'none', zIndex:'10' });
document.body.appendChild(overlay);
requestAnimationFrame(() => { overlay.style.transition = 'opacity 1.2s ease'; overlay.style.opacity = '0'; });

// random jitter for camera shake
function shake(amp) { return (Math.random() - 0.5) * amp; }
// smoothstep easing for shake amount, hermite curve, starts and ends slow
function smoothstep(a, b, t) { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); }

// figure out where the camera should be at time globalT
function samplePath(globalT) {
  const path = introPath;
  // clamp to start/end if outside the range
  if (globalT <= path[0].t) return { pos: path[0].pos.clone(), look: path[0].look.clone() };
  if (globalT >= path[path.length - 1].t) return { pos: path[path.length - 1].pos.clone(), look: path[path.length - 1].look.clone() };
  // find which two keyframes we're between
  let i = 0;
  for (let k = 0; k < path.length - 1; k++) { if (globalT >= path[k].t && globalT < path[k+1].t) { i = k; break; } }
  const a = path[i], b = path[i+1];
  const local = (globalT - a.t) / (b.t - a.t);
  // ease in out quad, feels smoother than just linear
  const ease = local < 0.5 ? 2 * local * local : 1 - Math.pow(-2 * local + 2, 2) / 2;
  return { pos: a.pos.clone().lerp(b.pos, ease), look: a.look.clone().lerp(b.look, ease) };
}

let introFlashed = false;
const _lookTarget = new THREE.Vector3();

// runs every frame during the intro
function runIntro(t, dt) {
  // intro finished, hand control back to player
  if (t >= INTRO_DUR) {
    if (!introDone) {
      introDone = true; introActive = false;
      yaw = 0; pitch = 0;
      camera.position.set(-3, 2.2, 22);
      showStatus('Click to look around, WASD to move');
    }
    return;
  }
  const { pos, look } = samplePath(t);
  // shake amount ramps up before impact then fades after
  const shakeMag   = smoothstep(3.5, 6.2, t) * (1 - smoothstep(6.2, 7.5, t));
  // extra hard shake right at the moment of crash
  const impactShake = smoothstep(5.8, 6.1, t) * (1 - smoothstep(6.1, 6.6, t));
  camera.position.set(
    pos.x + shake(shakeMag * 0.4 + impactShake * 1.2),
    pos.y + shake(shakeMag * 0.25 + impactShake * 0.8),
    pos.z + shake(shakeMag * 0.4 + impactShake * 1.2)
  );
  _lookTarget.copy(look).add(new THREE.Vector3(shake(shakeMag * 0.3), shake(shakeMag * 0.2), shake(shakeMag * 0.3)));
  camera.lookAt(_lookTarget);
  // flash of white at the moment of impact, like a concussion
  if (!introFlashed && t > 5.9) {
    introFlashed = true;
    overlay.style.transition = 'none'; overlay.style.opacity = '1';
    setTimeout(() => { overlay.style.transition = 'opacity 1.8s ease'; overlay.style.opacity = '0'; }, 80);
  }
  // after the crash, slowly raise camera like the player is standing up
  if (t > 7.5) camera.position.y = THREE.MathUtils.lerp(0.15, 2.2, smoothstep(7.5, 9.0, t));
}

// FPS CAMERA
// track keys that are currently held down
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  // hotkeys for scene actions
  const k = e.key.toLowerCase();
  if (k === 't') toggleTime();
  if (k === 'f') handleFireKey();
  if (k === 'r') handleRainKey();
});
window.addEventListener('keyup', e => keys[e.code] = false);

// mouse look, YXZ order so roll doesn't get weird
let yaw = 0, pitch = 0;
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
// click anywhere to lock the pointer, but not during intro
document.addEventListener('click', () => { if (!introActive) renderer.domElement.requestPointerLock(); });
document.addEventListener('mousemove', e => {
  if (!introActive && document.pointerLockElement === renderer.domElement) {
    yaw   -= e.movementX * 0.002;
    // clamp pitch so you can't flip upside down
    pitch  = Math.max(-1.2, Math.min(0.7, pitch - e.movementY * 0.002));
  }
});
const camDir = new THREE.Vector3(), camRight = new THREE.Vector3();

// ANIMATION LOOP
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  // cap dt so things don't go crazy if the tab was backgrounded
  const dt = Math.min(clock.getDelta(), 0.05);
  const t  = clock.getElapsedTime();

  // camera, either intro sequence or player control
  if (introActive) {
    runIntro(t, dt);
  } else {
    // build the forward/right vectors from mouse look
    euler.set(pitch, yaw, 0); camera.quaternion.setFromEuler(euler);
    camera.getWorldDirection(camDir); camRight.crossVectors(camDir, camera.up).normalize();
    const spd = 9;
    if (keys['KeyW']  || keys['ArrowUp'])    camera.position.addScaledVector(camDir,   spd * dt);
    if (keys['KeyS']  || keys['ArrowDown'])  camera.position.addScaledVector(camDir,  -spd * dt);
    if (keys['KeyA']  || keys['ArrowLeft'])  camera.position.addScaledVector(camRight, -spd * dt);
    if (keys['KeyD']  || keys['ArrowRight']) camera.position.addScaledVector(camRight,  spd * dt);
    // don't let the camera go below ground
    camera.position.y = Math.max(1.1, camera.position.y);
  }

  // day/night/rain transitions
  if (tr.on) {
    tr.p = Math.min(1, tr.p + dt / tr.dur);
    // ease in out quad for smooth feel
    const e = tr.p < 0.5 ? 2 * tr.p * tr.p : 1 - Math.pow(-2 * tr.p + 2, 2) / 2;
    lerpSt(tr.from, tr.to, e);
    if (tr.p >= 1) tr.on = false;
  }

  // water, slide the texture around and bob up/down
  water.material.map.offset.x = Math.sin(t * 0.3) * 0.02;
  water.material.map.offset.y = t * 0.04;
  water.position.y = 0.05 + Math.sin(t * 1.5) * 0.02;

  // fish swim in loops
  fish1.position.x = Math.sin(t * 0.5) * 3;       fish1.position.z = -22 + Math.cos(t * 0.4) * 2;
  fish1.rotation.y = Math.PI / 2 + Math.sin(t * 0.5 + 0.5) * 0.8;
  fish2.position.x = Math.cos(t * 0.3) * 2.5;     fish2.position.z = -23 + Math.sin(t * 0.35) * 2.5;
  fish2.rotation.y = Math.PI + Math.cos(t * 0.3 + 1) * 0.8;

  // palm trees sway in the wind
  palms.forEach((p, i) => { p.rotation.z = Math.sin(t * 0.55 + i * 1.3) * 0.028; p.rotation.x = Math.cos(t * 0.45 + i) * 0.018; });

  // update fire particles, only first 100 of the crash fire to save frames
  tickFire(allFireParts.slice(0, 100), t, dt);
  if (fireBuilt) tickFire(campParts, t, dt);

  // flicker the campfire glow lights
  if (fireBuilt) {
    // brighter at night
    const fb = isNight ? 9 : 4;
    fireGlow1.intensity = fb + Math.sin(t * 12) * 1.8 + Math.cos(t * 17) * 0.9;
    fireGlow2.intensity = fb * 0.7 + Math.sin(t * 15 + 1) * 0.8;
    fireGlow1.position.y = 1.5 + Math.sin(t * 9) * 0.12;
  } else {
    // fade out when fire goes out
    fireGlow1.intensity = Math.max(0, fireGlow1.intensity - dt * 3);
    fireGlow2.intensity = Math.max(0, fireGlow2.intensity - dt * 3);
  }

  // smoke, rise up and expand, reset when faded out
  smokeParts.forEach(p => {
    p.userData.life += dt * 0.35;
    if (p.userData.life > 1) { p.userData.life = 0; p.position.set(-13 + (Math.random()-0.5)*3, 2, 7 + (Math.random()-0.5)*2); p.material.opacity = 0.15; }
    p.position.x += p.userData.vx; p.position.y += p.userData.vy; p.position.z += p.userData.vz;
    p.scale.setScalar(1 + p.userData.life * 3.5);
    p.material.opacity = 0.15 * (1 - p.userData.life);
  });

  // rain, drop each line down and respawn at the top when it hits the ground
  if (rainActive) rainDrops.forEach(d => { d.position.y -= d.userData.speed; if (d.position.y < -1) d.position.y = 65; });

  // captain animations
  updateCaptain(dt, t);

  renderer.render(scene, camera);
}

animate();
