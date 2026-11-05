/* VeriGate spotlight: the device in 3D, exploding into its parts and
   imploding back, on a loop. Click to explode / assemble now.
   The enclosure front (LCD bezel, SCAN print, switch) comes from
   verigate-device.glb; the parts inside are modelled here at real size
   (metres): Arduino Uno R4, RC522 reader, 16x2 LCD module, 9 V battery,
   load cell, RFID card and key fob. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const host = document.querySelector('.vg-xp');
if (host) start(host);

function start(host){
  const V3 = THREE.Vector3;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutBack = t => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  /* ---------- renderer, scene, light ---------- */
  const R = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  R.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
  host.prepend(R.domElement);
  const S = new THREE.Scene();
  S.environment = new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(R), .04).texture;
  S.add(new THREE.HemisphereLight(0xffffff, 0x9aa6b8, .9));
  const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(.4, .6, .7); S.add(key);
  const rim = new THREE.DirectionalLight(0xcfe9ff, 1.4); rim.position.set(-.6, .3, -.5); S.add(rim);
  // isometric camera: orthographic, looking down at 30 degrees from the front-right corner
  const ISO_A = 45 * Math.PI / 180, ISO_E = 30 * Math.PI / 180, LOOK = new V3(0, -.012, .006);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 5);
  cam.position.set(Math.sin(ISO_A) * Math.cos(ISO_E), Math.sin(ISO_E), Math.cos(ISO_A) * Math.cos(ISO_E)).multiplyScalar(1.2).add(LOOK);
  cam.lookAt(LOOK); cam.updateMatrixWorld();
  const SR = new V3().setFromMatrixColumn(cam.matrixWorld, 0), SU = new V3().setFromMatrixColumn(cam.matrixWorld, 1);   // screen right / up in world
  let aspect = 16 / 9, halfH = .08;
  const setFrustum = () => { cam.top = halfH; cam.bottom = -halfH; cam.left = -halfH * aspect; cam.right = halfH * aspect; cam.updateProjectionMatrix(); };

  /* ---------- materials and textures ---------- */
  const M = (color, rough = .6, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const abs = M(0x1b1c22, .68), absIn = M(0x24262e, .8);
  const black = M(0x111216, .5), gold = M(0xd2a64b, .3, 1), silver = M(0xc9ced6, .25, 1), alu = M(0xb9c0c9, .35, .9);
  const boxFaces = (side, front) => [side, side, side, side, front, side];   // +x -x +y -y +z -z

  // live LCD text (same look as the VeriGate site)
  const LW = 1024, LH = 220, lcdC = document.createElement('canvas'); lcdC.width = LW; lcdC.height = LH;
  const lctx = lcdC.getContext('2d'), lcdTex = new THREE.CanvasTexture(lcdC); lcdTex.colorSpace = THREE.SRGBColorSpace;
  const LCD_STATES = [['VERIGATE', 'READY · SCAN', false], ['SCANNING', 'CARD DETECTED', false], ['APPROVED', 'WELCOME', true]];
  function drawLCD(ms){
    const [l1, l2, ok] = LCD_STATES[Math.floor(ms / 2600) % 3], x = lctx;
    const bg = x.createRadialGradient(LW * .5, LH * .35, 50, LW * .5, LH * .35, LW * .7);
    (ok ? ['#2DD279', '#1aa05a', '#0d6e3a', '#094a27'] : ['#2A52BE', '#1f3f9e', '#142a72', '#0c1e5a']).forEach((c, i) => bg.addColorStop([0, .3, .65, 1][i], c));
    x.shadowBlur = 0; x.fillStyle = bg; x.fillRect(0, 0, LW, LH);
    x.fillStyle = 'rgba(0,0,0,.1)'; for (let y = 0; y < LH; y += 8) x.fillRect(0, y, LW, 1); for (let xx = 0; xx < LW; xx += 8) x.fillRect(xx, 0, 1, LH);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '700 90px "JetBrains Mono", Consolas, monospace'; x.shadowColor = ok ? 'rgba(170,255,200,.9)' : 'rgba(170,210,255,.9)'; x.shadowBlur = 26;
    x.fillStyle = ok ? '#E8FFEF' : '#E0EBFF'; x.fillText(l1 + (Math.floor(ms / 500) % 2 ? ' ' : '_'), LW / 2, LH * .36);
    x.font = '600 56px "JetBrains Mono", Consolas, monospace'; x.shadowBlur = 18; x.fillStyle = ok ? '#C8F5DA' : '#B5CDFF'; x.fillText(l2, LW / 2, LH * .74);
    lcdTex.needsUpdate = true;
  }
  drawLCD(0);
  const lcdMat = new THREE.MeshBasicMaterial({ map: lcdTex, toneMapped: false });

  const pcbTex = (base, draw) => canvasTex(512, 400, (x, w, h) => { x.fillStyle = base; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 2; for (let i = 0; i < 14; i++){ x.beginPath(); x.moveTo(0, 30 + i * 26); x.lineTo(w, 10 + i * 27); x.stroke(); }
    draw(x, w, h); });
  const unoTex = pcbTex('#0a7f86', (x, w, h) => {
    x.fillStyle = 'rgba(255,255,255,.92)'; x.font = '800 54px Arial'; x.fillText('UNO', 300, 250); x.font = '700 40px Arial'; x.fillText('R4', 410, 250);
    x.font = '600 20px Arial'; x.fillText('ARDUINO', 300, 290); x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 4; x.beginPath(); x.arc(250, 238, 24, 0, Math.PI * 2); x.stroke();
  });
  const rfidTex = pcbTex('#1d4fb8', (x, w, h) => {
    x.strokeStyle = '#d9a441'; x.lineWidth = 7;
    for (let i = 0; i < 4; i++){ const m = 34 + i * 18; x.beginPath(); x.roundRect(m, m - 10, w - m * 2, h - m * 2 - 40, 26); x.stroke(); }
    x.fillStyle = 'rgba(255,255,255,.9)'; x.font = '700 26px Arial'; x.fillText('RFID-RC522', 175, h - 40);
  });
  const lcdPcbTex = pcbTex('#1f7a3a', () => {});
  const cardTex = canvasTex(512, 324, (x, w, h) => {
    x.fillStyle = '#f7f9fc'; x.fillRect(0, 0, w, h);
    const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#2A52BE'); g.addColorStop(1, '#35d6ff'); x.fillStyle = g; x.fillRect(0, h * .68, w, h * .32);
    x.fillStyle = '#0B1220'; x.font = '800 40px Arial'; x.fillText('VERIGATE', 36, 74); x.font = '600 22px Arial'; x.fillStyle = '#5B6678'; x.fillText('DRIVER CARD · 13.56 MHz', 36, 112);
    x.fillStyle = '#d2a64b'; x.beginPath(); x.roundRect(36, 140, 70, 54, 8); x.fill();
  });

  /* ---------- the parts (assembled position, exploded offset) ---------- */
  const root = new THREE.Group(); S.add(root);
  const parts = [];
  const part = (name, label, at, off, delay, spin = [0, 0, 0], labelOff = [0, 0, 0]) => {
    const g = new THREE.Group(); g.position.copy(at); root.add(g);
    const p = { g, home: at.clone(), scr: off, off: new V3(), delay, spin: new V3(...spin), label, labelOff: new V3(...labelOff), rot0: new THREE.Euler() };
    parts.push(p); return p;
  };
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  // enclosure back shell (open at the front) + the switch on its side
  const tub = part('tub', 'Enclosure', new V3(0, 0, 0), [.16, .004], .0, [0, 0, 0], [0, .052, 0]);
  add(tub.g, new THREE.BoxGeometry(.09, .092, .002), abs, 0, 0, -.0215);
  add(tub.g, new THREE.BoxGeometry(.09, .002, .042), abs, 0, .045, -.0005);
  add(tub.g, new THREE.BoxGeometry(.09, .002, .042), abs, 0, -.045, -.0005);
  add(tub.g, new THREE.BoxGeometry(.002, .088, .042), abs, .044, 0, -.0005);
  add(tub.g, new THREE.BoxGeometry(.002, .088, .042), abs, -.044, 0, -.0005);
  add(tub.g, new THREE.BoxGeometry(.084, .086, .001), absIn, 0, 0, -.0199);

  // front panel; the GLB's LCD bezel, screen and SCAN print attach to it
  const front = part('front', 'Front panel', new V3(0, 0, .021), [-.16, .004], .0, [0, 0, 0], [0, .054, 0]);
  add(front.g, new THREE.BoxGeometry(.09, .092, .003), abs);

  // 16x2 LCD module
  const lcd = part('lcd', '16×2 LCD', new V3(0, .021, .0135), [-.048, .076], .12, [.25, 0, 0], [0, .026, 0]);
  add(lcd.g, new THREE.BoxGeometry(.08, .036, .0016), boxFaces(M(0x1f7a3a, .5), new THREE.MeshStandardMaterial({ map: lcdPcbTex, roughness: .5 })));
  add(lcd.g, new THREE.BoxGeometry(.071, .024, .007), black, 0, .001, .0043);
  add(lcd.g, new THREE.PlaneGeometry(.064, .0145), lcdMat, 0, .001, .0081);
  for (let i = 0; i < 16; i++) add(lcd.g, new THREE.CylinderGeometry(.0004, .0004, .004, 6), gold, -.036 + i * .00254, .0155, -.0025).rotation.x = Math.PI / 2;

  // RC522 RFID reader with its antenna coil
  const rfid = part('rfid', 'RC522 RFID', new V3(0, -.023, .0155), [-.05, -.076], .18, [-.3, 0, 0], [0, -.027, 0]);
  add(rfid.g, new THREE.BoxGeometry(.06, .04, .0016), boxFaces(M(0x1d4fb8, .5), new THREE.MeshStandardMaterial({ map: rfidTex, roughness: .45 })));
  add(rfid.g, new THREE.BoxGeometry(.006, .006, .0012), black, .012, .004, .0014);
  add(rfid.g, new THREE.BoxGeometry(.021, .0025, .0085), black, 0, -.0185, -.004);

  // Arduino Uno R4 (68.6 x 53.4 mm) with headers, USB-C, power jack and a few jumper wires
  const uno = part('uno', 'Arduino Uno R4', new V3(0, -.002, -.0115), [.052, .074], .1, [0, .5, 0], [0, .034, 0]);
  add(uno.g, new THREE.BoxGeometry(.0686, .0534, .0016), boxFaces(M(0x0a7f86, .5), new THREE.MeshStandardMaterial({ map: unoTex, roughness: .45 })));
  add(uno.g, new THREE.BoxGeometry(.05, .0025, .0085), black, .005, .0245, .0051);
  add(uno.g, new THREE.BoxGeometry(.045, .0025, .0085), black, .01, -.0245, .0051);
  add(uno.g, new THREE.BoxGeometry(.009, .0035, .007), silver, -.033, .012, .0043);
  add(uno.g, new THREE.BoxGeometry(.013, .009, .011), black, -.03, -.013, .0063);
  add(uno.g, new THREE.BoxGeometry(.01, .01, .0016), black, .006, -.003, .0016);

  // 9 V battery lying on the floor of the case
  const bat = part('bat', '9 V battery', new V3(-.008, -.0355, .0005), [.15, .088], .22, [0, 0, .6], [0, .02, 0]);
  add(bat.g, new RoundedBoxGeometry(.0485, .0175, .0265, 3, .002), M(0x18181a, .4, .2), -.006, 0, 0);
  add(bat.g, new RoundedBoxGeometry(.012, .0177, .0267, 3, .002), M(0xb87333, .3, .8), -.0245, 0, 0);
  add(bat.g, new THREE.CylinderGeometry(.0042, .0042, .004, 18), silver, .0195, 0, .006).rotation.z = Math.PI / 2;
  add(bat.g, new THREE.CylinderGeometry(.0042, .0042, .004, 6), silver, .0195, 0, -.006).rotation.z = Math.PI / 2;

  // load cell under the device (the weighing part of the station)
  const cell = part('cell', 'Load cell', new V3(0, -.0535, 0), [.07, -.088], .3, [0, -.4, 0], [0, -.015, 0]);
  add(cell.g, new THREE.BoxGeometry(.08, .0127, .0127), alu);
  [-.018, .018].forEach(x => add(cell.g, new THREE.CylinderGeometry(.0045, .0045, .0129, 20), M(0x2b2f36, .6), x, 0, 0).rotation.x = Math.PI / 2);
  add(cell.g, new THREE.BoxGeometry(.012, .0128, .008), M(0xf4f1ea, .6), 0, 0, 0);
  
  // RFID card and key fob, resting in front of the device
  const card = part('card', 'RFID card', new V3(.012, -.0603, .052), [-.055, -.004], .26, [0, 0, 0], [0, .034, 0]);
  const cardMesh = add(card.g, new THREE.BoxGeometry(.0856, .054, .0008), boxFaces(M(0xf7f9fc, .4), new THREE.MeshStandardMaterial({ map: cardTex, roughness: .35 })));
  cardMesh.rotation.x = -Math.PI / 2;
  const fob = part('fob', 'Key fob', new V3(-.038, -.0595, .06), [.012, .02], .32, [0, 0, 0], [0, .024, 0]);
  const fobShape = new THREE.Shape(); fobShape.absarc(0, 0, .015, Math.PI * .15, Math.PI * .85, true); fobShape.lineTo(0, .03); fobShape.closePath();
  const hole = new THREE.Path(); hole.absarc(0, .022, .0028, 0, Math.PI * 2, true); fobShape.holes.push(hole);
  const fobMesh = add(fob.g, new THREE.ExtrudeGeometry(fobShape, { depth: .004, bevelEnabled: true, bevelThickness: .0012, bevelSize: .0012, bevelSegments: 3, curveSegments: 24 }), M(0x2463d6, .35));
  fobMesh.rotation.x = -Math.PI / 2;
  const ring = add(fob.g, new THREE.TorusGeometry(.009, .0009, 8, 32), silver, 0, .002, -.034); ring.rotation.x = -Math.PI / 2;

  // the GLB: front details onto the panel, the switch onto the shell
  const panelScreens = [];
  new GLTFLoader().load('assets/verigate-device.glb', g => {
    const toFront = ['Verigate_SCAN_Text', 'Verigate_LCD_Bezel', 'Verigate_LCD_Screen', 'LCD_Screen_Plane'];
    const toTub = ['Verigate_Switch_Frame', 'Verigate_Switch_Rocker', 'Verigate_Switch_I', 'Verigate_Switch_O'];
    const nodes = []; g.scene.traverse(o => { if (o.isMesh) nodes.push(o); });
    nodes.forEach(o => { if (o.name === 'LCD_Screen_Plane' || o.name === 'Verigate_LCD_Screen') panelScreens.push(o); });
    nodes.forEach(o => {
      if (o.name === 'LCD_Screen_Plane') o.material = lcdMat;
      const dest = toFront.includes(o.name) ? front : toTub.includes(o.name) ? tub : null;
      if (!dest) return;                                   // the solid body is replaced by the shell + panel
      o.updateWorldMatrix(true, false);
      // the GLB is in device space; re-express each piece relative to its part's resting place
      const local = new THREE.Matrix4().makeTranslation(dest.home.x, dest.home.y, dest.home.z).invert().multiply(o.matrixWorld);
      dest.g.add(o); local.decompose(o.position, o.quaternion, o.scale);
    });
    host.classList.add('ready');
  }, undefined, () => host.classList.add('ready'));

  // thin edge lines on the dark enclosure pieces so their shape reads on any background
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x5b6274, transparent: true, opacity: .75 });
  [tub, front].forEach(p => p.g.children.slice().forEach(m => { if (m.isMesh && m.geometry.type === 'BoxGeometry') m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), edgeMat)); }));

  /* ---------- wiring harness: every lead runs inside the case and stretches out with its part ---------- */
  // [from part, local point, local pull-out direction, to part, local point, direction, colour]
  const W = (pa, a, na, pb, b, nb, c) => ({ pa, a: new V3(...a), na: new V3(...na), pb, b: new V3(...b), nb: new V3(...nb), mat: M(c, .45) });
  const wires = [
    // LCD (4 leads: VCC, GND, SDA, SCL) -> Arduino top header
    ...[0xe53935, 0x111111, 0x2f6fd6, 0xf2c14e].map((c, i) => W(lcd, [-.034 + i * .00254, .0155, -.0045], [0, .3, -1], uno, [-.004 + i * .00254, .0245, .0095], [0, .4, 1], c)),
    // RC522 (SPI: SDA, SCK, MOSI, MISO, 3.3 V) -> Arduino bottom header
    ...[0xff8a3d, 0x9b59d0, 0x2a9d6f, 0xf4f1ea, 0xe53935].map((c, i) => W(rfid, [-.005 + i * .0025, -.0185, -.0085], [0, -.3, -1], uno, [.0 + i * .00254, -.0245, .0095], [0, -.4, 1], c)),
    // 9 V battery -> power switch -> Arduino power jack
    W(bat, [.0215, 0, .006], [1, 0, 0], tub, [.0425, .021, -.004], [-1, 0, 0], 0xe53935),
    W(tub, [.0425, .021, .004], [-1, 0, 0], uno, [.0315, -.0245, .0095], [.4, -.4, 1], 0xe53935),
    W(bat, [.0215, 0, -.006], [1, 0, 0], uno, [.029, -.0245, .0095], [.4, -.4, 1], 0x111111),
    // load cell (through its amplifier) -> Arduino
    ...[0xe53935, 0x111111, 0xf4f1ea, 0x2a9d6f].map((c, i) => W(cell, [.026 + i * .0022, .0064, 0], [0, 1, 0], uno, [.02 + i * .00254, -.0245, .0095], [0, -.4, 1], c)),
  ];
  const pa = new V3(), pb = new V3(), qa = new V3(), qb = new V3(), mid = new V3();
  const inRoot = (p, v) => root.worldToLocal(p.g.localToWorld(v));
  wires.forEach(w => { w.mesh = new THREE.Mesh(new THREE.BufferGeometry(), w.mat); root.add(w.mesh); });
  let wiredAt = -1;
  const IN = { x: .039, y: .04, z0: -.0175, z1: .0165 };     // inside of the shell, in assembled space
  const keepIn = (v, c) => { if (c <= 0) return v;
    v.x = lerp(v.x, Math.max(-IN.x, Math.min(IN.x, v.x)), c); v.y = lerp(v.y, Math.max(-IN.y, Math.min(IN.y, v.y)), c); v.z = lerp(v.z, Math.max(IN.z0, Math.min(IN.z1, v.z)), c); return v; };
  function updateWires(s){
    if (Math.abs(s - wiredAt) < .002) return; wiredAt = s;
    root.updateMatrixWorld(true);
    const lead = .006 + s * .012;
    wires.forEach((w, i) => {
      inRoot(w.pa, pa.copy(w.a)); inRoot(w.pa, qa.copy(w.a).addScaledVector(w.na.clone().normalize(), lead));
      inRoot(w.pb, pb.copy(w.b)); inRoot(w.pb, qb.copy(w.b).addScaledVector(w.nb.clone().normalize(), lead));
      // the run sags a little and fans out so the leads stay apart
      mid.copy(qa).add(qb).multiplyScalar(.5).add(new V3(0, -.002 - s * .014, -.003 - s * .007 + (i % 4) * .0012));
      const c = 1 - clamp01(s * 2.5);
      const pts = [pa, qa, mid, qb, pb].map(v => keepIn(v.clone(), c));
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      w.mesh.geometry.dispose(); w.mesh.geometry = new THREE.TubeGeometry(curve, 28, .00055, 5);
    });
  }

  // soft floor shadow
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(.34, .34), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false,
    map: canvasTex(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 2, 64, 64, 64); g.addColorStop(0, 'rgba(20,30,45,.38)'); g.addColorStop(1, 'rgba(20,30,45,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }) }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -.061; S.add(shadow);

  // a quick burst ring when it comes apart
  const burst = new THREE.Mesh(new THREE.RingGeometry(.05, .056, 64), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  root.add(burst);

  /* ---------- labels ---------- */
  const layer = host.querySelector('.vg-xp-labels');
  // a pseudo part so the harness gets a label too
  const harness = { label: 'Wiring', labelOff: new V3(), k: 0, g: new THREE.Group() }; root.add(harness.g);
  [...parts, harness].forEach(p => { const el = document.createElement('span'); el.className = 'vg-xp-label'; el.innerHTML = '<i></i>' + p.label; layer.appendChild(el); p.el = el; });

  /* ---------- timeline: assembled -> explode -> hold -> implode -> hold ---------- */
  const LOOP = 11, A0 = 1.6, A1 = 3.0, B0 = 7.4, B1 = 8.8;   // seconds
  let manual = null, manualT = 0, manualFrom = 0;
  const autoS = t => { const u = t % LOOP; return u < A0 ? 0 : u < A1 ? (u - A0) / (A1 - A0) : u < B0 ? 1 : u < B1 ? 1 - (u - B0) / (B1 - B0) : 0; };
  const autoDir = t => { const u = t % LOOP; return u < B0 ? 1 : -1; };
  host.addEventListener('click', () => {
    const now = performance.now() / 1000, cur = lastS;
    manual = cur > .5 ? 0 : 1; manualFrom = cur; manualT = now;
  });
  let px = 0, py = 0, tx = 0, ty = 0;
  host.addEventListener('pointermove', e => { const r = host.getBoundingClientRect(); tx = ((e.clientX - r.left) / r.width - .5); ty = ((e.clientY - r.top) / r.height - .5); });
  host.addEventListener('pointerleave', () => { tx = ty = 0; });

    // on narrow frames the layout gets more room and squeezes sideways
  let roomK = 1, sideK = 1;
  const size = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; R.setSize(w, h, false); aspect = w / h;
    roomK = aspect < 1.4 ? 1.35 : 1; sideK = Math.min(1, (.118 * roomK * aspect) / (.118 * 1.78)); setFrustum(); };
  new ResizeObserver(size).observe(host); size();

  let lastS = 0, visible = false, raf = 0;
  const t0 = performance.now() / 1000, tmp = new V3();
  const frame = nowMs => {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    const now = nowMs / 1000, t = now - t0;
    // explode amount s (0 assembled .. 1 apart) and direction
    let s, dir;
    if (reduced){ s = 1; dir = 1; }
    else if (manual !== null){
      const k = clamp01((now - manualT) / 1.3); s = lerp(manualFrom, manual, k); dir = manual > manualFrom ? 1 : -1;
      if (now - manualT > 7){ manual = null; }                 // back to the loop after a while
    } else { s = autoS(t); dir = autoDir(t); }
    lastS = s;

    parts.forEach(p => {
      p.off.copy(LOOK).addScaledVector(SR, p.scr[0] * sideK).addScaledVector(SU, p.scr[1]).sub(p.home);
      const k = clamp01(s * 1.45 - p.delay);
      const e = dir > 0 ? easeOutBack(k) : easeInOut(k);
      p.g.position.copy(p.home).addScaledVector(p.off, e);
      const wob = Math.sin(clamp01(k) * Math.PI);              // a turn in flight that settles
      p.g.rotation.set(p.spin.x * wob, p.spin.y * wob, p.spin.z * wob);
      p.k = k;
    });
    // card and fob stand up as they leave the counter
    card.g.children[0].rotation.x = lerp(-Math.PI / 2, -.18, easeInOut(card.k));
    card.g.rotation.y = lerp(0, .5, easeInOut(card.k));
    fob.g.rotation.y = lerp(0, .5, easeInOut(fob.k));
    fob.g.children[0].rotation.x = lerp(-Math.PI / 2, -.1, easeInOut(fob.k)); ring.position.z = lerp(-.034, -.003, easeInOut(fob.k)); ring.position.y = lerp(.002, .034, easeInOut(fob.k)); ring.rotation.x = lerp(-Math.PI / 2, 0, easeInOut(fob.k));

    // burst ring right as it opens
    const b = dir > 0 ? clamp01(s * 2.2) : 0;
    burst.material.opacity = b > 0 && b < 1 ? (1 - b) * .7 : 0; burst.scale.setScalar(1 + b * 2.6);

    // the whole assembly turns gently and follows the pointer a little
    const es = easeInOut(clamp01(Math.max(...parts.map(p => p.k)))); // zoom follows the part that is furthest out
    px += (tx - px) * .06; py += (ty - py) * .06;
    root.rotation.y = ((reduced ? 0 : Math.sin(t * .35) * .3) + px * .4) * (1 - es);
    root.rotation.x = py * .12 * (1 - es);
    // camera pulls back to fit the exploded view
    halfH = lerp(.092 * roomK, .118 * roomK, es); setFrustum();
    shadow.material.opacity = lerp(1, .2, es);

    updateWires(s);
    const panelOn = front.k < .08;
    panelScreens.forEach(o => { o.visible = panelOn; });
    if (Math.floor(nowMs / 66) !== frame.lcdTick){ frame.lcdTick = Math.floor(nowMs / 66); drawLCD(nowMs); }
    R.render(S, cam);

    // labels follow their parts once it is apart
    const w = host.clientWidth, h = host.clientHeight;
    const lw = wires[6].mesh.geometry.parameters && wires[6].mesh.geometry.parameters.path;
    if (lw){ harness.g.position.copy(lw.getPoint(.5)); harness.k = lastS; }
    [...parts, harness].forEach(p => {
      tmp.copy(p.labelOff); p.g.localToWorld(tmp); tmp.project(cam);
      const show = clamp01((p.k - .8) / .2);
      p.el.style.opacity = show; p.el.style.transform = `translate(${(tmp.x + 1) / 2 * w}px, ${(1 - tmp.y) / 2 * h}px) translate(-50%, -50%) scale(${.9 + show * .1})`;
    });
  };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame); }, { rootMargin: '120px' }).observe(host);
}
