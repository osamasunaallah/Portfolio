/* HydraCap 3D bottles for the portfolio.
   Same procedural models as the HydraCap site (https://osamasunaallah.github.io/HydraCap/):
   the clear bottle with the integrated flip-top pill cap, and the steel
   bottle with the rope-tied case. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const V3 = THREE.Vector3;
const DEG = Math.PI / 180;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp01 = t => Math.max(0, Math.min(1, t));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const backOut = t => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);

// capsule colour pairs from the product photos
const PAIRS = [['#ffffff', '#ffffff'], ['#2f6fd6', '#f4f1ea'], ['#f2c14e', '#2f6fd6'], ['#ec6f93', '#ec6f93'],
               ['#d8462f', '#f4f1ea'], ['#f4f1ea', '#2a9d6f'], ['#ffffff', '#d8462f']];
const TABS = ['#f6f4ef', '#f6f4ef', '#f3d9c2', '#ec9fb4', '#f2c14e'];
const pick = a => a[Math.random() * a.length | 0];
const rnd = (a, b) => a + Math.random() * (b - a);

const plastic = (color, rough = .45) => new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0, clearcoat: .25, clearcoatRoughness: .5 });

/* ---------- textures made in code ---------- */
function canvasTex(w, h, draw, repeat = [1, 1], srgb = true){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// twisted rope: diagonal strands with dark grooves
const ropeMap = () => canvasTex(64, 64, (x, w, h) => {
  x.fillStyle = '#5c1724'; x.fillRect(0, 0, w, h);
  for (let i = -2; i < 6; i++){
    const g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#3b0c15'); g.addColorStop(.35, '#7e2b3a'); g.addColorStop(.6, '#6a1f2d'); g.addColorStop(1, '#3b0c15');
    x.fillStyle = g; x.save(); x.translate(i * 16, 0); x.transform(1, 0, -.9, 1, 0, 0); x.fillRect(0, 0, 14, h); x.restore();
  }
  for (let i = 0; i < 400; i++){ x.fillStyle = `rgba(255,220,225,${Math.random() * .05})`; x.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
});
const ropeBump = () => canvasTex(64, 64, (x, w, h) => {
  x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
  for (let i = -2; i < 6; i++){ const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#000'); g.addColorStop(.5, '#fff'); g.addColorStop(1, '#000');
    x.fillStyle = g; x.save(); x.translate(i * 16, 0); x.transform(1, 0, -.9, 1, 0, 0); x.fillRect(0, 0, 14, h); x.restore(); }
}, [1, 1], false);
// fine powder-coat grain for the steel bottle
const grain = () => canvasTex(256, 256, (x, w, h) => {
  const d = x.createImageData(w, h);
  for (let i = 0; i < d.data.length; i += 4){ const v = 110 + Math.random() * 60; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0);
}, [6, 6], false);

let ROPE = null;
function ropeMaterial(){
  if (!ROPE) ROPE = { map: ropeMap(), bump: ropeBump() };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: ROPE.map.clone(), bumpMap: ROPE.bump.clone(), bumpScale: 2.2, roughness: .9 });
  return m;
}
function setRopeRepeat(m, len){ m.map.repeat.set(len * 34, 1); m.bumpMap.repeat.set(len * 34, 1); m.map.needsUpdate = m.bumpMap.needsUpdate = true; }

/* ---------- 3D pills: capsules, round and oval tablets, softgels, in mixed sizes ---------- */
function capsule3D(r, len, [a, b]){
  const g = new THREE.Group();
  [[a, 1], [b, -1]].forEach(([col, s]) => {
    const m = plastic(col, .28);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len / 2, 20, 1, true), m); body.position.y = s * len / 4;
    const end = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, s > 0 ? 0 : Math.PI / 2, Math.PI / 2), m); end.position.y = s * len / 2;
    g.add(body, end);
  });
  return g;
}
function tablet3D(r, thick, col, oval = 1){
  const prof = [[0, -thick / 2], [r * .82, -thick / 2], [r, -thick / 4], [r, thick / 4], [r * .82, thick / 2], [0, thick / 2 + thick * .12]].map(([x, y]) => new THREE.Vector2(x, y));
  const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), plastic(col, .5));
  m.scale.set(oval, 1, 1);
  return m;
}
// amber softgel: a glossy, slightly see-through oval
function softgel3D(r){
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14),
    new THREE.MeshPhysicalMaterial({ color: 0xd99a2b, roughness: .1, clearcoat: 1, transparent: true, opacity: .9 }));
  m.scale.set(1.5, .72, .85);
  return m;
}
// k scales the whole set; returns a pill lying flat
function randomPill3D(k = 1, white = false){
  const t = Math.random();
  if (white){ const p = capsule3D(.032 * k * rnd(.85, 1.15), .1 * k * rnd(.8, 1.15), ['#ffffff', '#ffffff']); p.rotation.z = Math.PI / 2; return p; }
  if (t < .5){ const p = capsule3D(.024 * k * rnd(.7, 1.3), .07 * k * rnd(.7, 1.4), pick(PAIRS)); p.rotation.z = Math.PI / 2; return p; }
  if (t < .72) return tablet3D(.036 * k * rnd(.7, 1.25), .022 * k, pick(TABS));
  if (t < .87) return tablet3D(.03 * k * rnd(.8, 1.2), .022 * k, pick(TABS), 1.6);
  return softgel3D(.024 * k * rnd(.85, 1.2));
}

/* ---------- open / close behaviour for a hinged lid with pills inside ---------- */
function compartment({ pivot, caps, openAngle, mouth, mouthParent, hit }){
  let open = false, t0 = -1e9;
  // the pills inside stay put, so an open compartment never looks empty; copies of them jump out
  const jumpers = caps.map(c => { const j = c.clone(true); j.userData.home = c.userData.home.clone(); j.visible = false; c.parent.add(j); return j; });
  return {
    hit, pivot,
    isOpen: () => open,
    set(v){ if (v === open) return false; open = v; t0 = performance.now(); return true; },
    mouthWorld: () => mouthParent.localToWorld(mouth.clone()),
    update(){
      const now = performance.now(), k = clamp01((now - t0) / 650);
      pivot.rotation.x = open ? openAngle * backOut(k) : openAngle * (1 - smooth(k));
      const j = clamp01((now - t0 - 160) / 520);
      jumpers.forEach((c, i) => {
        const h = c.userData.home;
        c.visible = open && j > 0 && j < 1;
        if (!c.visible) return;
        c.position.set(h.x * (1 + j * 1.6), h.y + Math.sin(j * Math.PI) * (.25 + (i % 3) * .06), h.z * (1 + j * 1.6));
        c.scale.setScalar(Math.max(0, 1 - j * 1.25));
      });
    }
  };
}

function contactShadow(size, strength = .42){
  const tex = canvasTex(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, `rgba(15,40,70,${strength})`); g.addColorStop(1, 'rgba(15,40,70,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = .003;
  return m;
}

// see-through plastic: nearly invisible face-on, tinted at the silhouette, with two highlight streaks
function clearMat(edge, base, edgeAlpha, side){
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side,
    uniforms: { uEdge: { value: new THREE.Color(edge) }, uBase: { value: base }, uEdgeA: { value: edgeAlpha } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uEdge; uniform float uBase; uniform float uEdgeA; varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
        float f = pow(1. - abs(dot(n, vV)), 2.4);
        float s1 = smoothstep(.93, .99, dot(n, normalize(vec3(.55, .2, .8))));
        float s2 = smoothstep(.965, .995, dot(n, normalize(vec3(-.7, .1, .7))));
        vec3 c = mix(uEdge, vec3(1.), clamp(s1 + s2 * .7, 0., 1.));
        gl_FragColor = vec4(c, clamp(uBase + uEdgeA * f + s1 * .55 + s2 * .3, 0., 1.));
      }`,
  });
}

/* ======================================================================
   MODELS
   ====================================================================== */

// clear water bottle; integrated flip-top cap (default), or a plain screw cap that can morph into it
function buildCapBottle({ lid = '#f6f4ef', collar = 0x16161a, white = false, plain = false } = {}){
  const grp = new THREE.Group();
  const prof = [[0, 0], [.4, 0], [.5, .03], [.54, .1], [.54, .42], [.51, .5], [.54, .58], [.54, 1.22], [.52, 1.34], [.46, 1.48],
                [.37, 1.6], [.29, 1.69], [.27, 1.75], [.27, 1.9]].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(prof, 96);
  const back = new THREE.Mesh(geo, clearMat('#7f949c', 0, .22, THREE.BackSide)); back.renderOrder = 1;
  const front = new THREE.Mesh(geo, clearMat('#7f949c', .015, .55, THREE.FrontSide)); front.renderOrder = 3;
  const wprof = prof.map(v => new THREE.Vector2(Math.max(0, v.x - .025), v.y)).filter(v => v.y <= 1.2);
  wprof.push(new THREE.Vector2(.515, 1.2), new THREE.Vector2(0, 1.2));
  const water = new THREE.Mesh(new THREE.LatheGeometry(wprof, 96), clearMat('#86c2d8', .1, .4, THREE.FrontSide)); water.position.y = .02; water.renderOrder = 2;
  grp.add(back, water, front, contactShadow(2));

  // ribbed collar
  const cg = new THREE.CylinderGeometry(.32, .32, .3, 240, 1, true), pos = cg.attributes.position;
  for (let i = 0; i < pos.count; i++){ const a = Math.atan2(pos.getZ(i), pos.getX(i)), r = .318 + .014 * Math.pow(.5 + .5 * Math.cos(a * 60), 2); pos.setX(i, Math.cos(a) * r); pos.setZ(i, Math.sin(a) * r); }
  cg.computeVertexNormals();
  const black = plastic(collar, .55);
  const collarM = new THREE.Mesh(cg, black); collarM.position.y = 2.02;
  const ringBot = new THREE.Mesh(new THREE.TorusGeometry(.32, .018, 10, 96), black); ringBot.rotation.x = Math.PI / 2; ringBot.position.y = 1.875;
  grp.add(collarM, ringBot);

  // plain screw cap (story step 1)
  const plainCap = new THREE.Mesh(new THREE.CylinderGeometry(.322, .322, .035, 96), black); plainCap.position.y = 2.185;
  grp.add(plainCap);

  // integrated compartment: ring, shallow well, hinged lid, capsules
  const integ = new THREE.Group(); grp.add(integ);
  const ringTop = new THREE.Mesh(new THREE.RingGeometry(.245, .33, 96), black); ringTop.rotation.x = -Math.PI / 2; ringTop.position.y = 2.17;
  const lidMat = plastic(lid, .32);
  const well = new THREE.Mesh(new THREE.LatheGeometry([[0, 2.19], [.205, 2.19], [.205, 2.25], [.25, 2.25], [.25, 2.1]].map(([r, y]) => new THREE.Vector2(r, y)), 96), lidMat);
  const hinge = new THREE.Mesh(new RoundedBoxGeometry(.12, .05, .05, 2, .012), lidMat); hinge.position.set(0, 2.25, -.255);
  integ.add(ringTop, well, hinge);
  const pivot = new THREE.Group(); pivot.position.set(0, 2.255, -.255); integ.add(pivot);
  const lidG = new THREE.Group(); lidG.position.z = .255; pivot.add(lidG);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(.258, .258, .035, 96), lidMat); top.position.y = .018;
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(.258, .258, .03, 96, 1, true), lidMat); skirt.position.y = -.01;
  const tab = new THREE.Mesh(new RoundedBoxGeometry(.1, .025, .06, 2, .01), lidMat); tab.position.set(0, .01, .275);
  const ridge = new THREE.Mesh(new THREE.TorusGeometry(.19, .006, 6, 80), lidMat); ridge.rotation.x = Math.PI / 2; ridge.position.y = .037;
  lidG.add(top, skirt, tab, ridge);
  const floorDisc = new THREE.Mesh(new THREE.CircleGeometry(.204, 64), plastic(0xdfe6ec, .6)); floorDisc.rotation.x = -Math.PI / 2; floorDisc.position.y = 2.193;
  integ.add(floorDisc);
  const caps = [];
  [[-.08, .04, 20], [.07, -.06, -15], [-.01, -.1, 75], [.08, .07, 40], [-.1, -.07, 110], [.02, .11, -60], [.0, .0, 5], [-.06, .12, 150]].forEach(([x, z, rot], i) => {
    const c = white ? randomPill3D(1, true) : (i % 3 === 0 ? randomPill3D(1, true) : randomPill3D(1.25));
    const holder = new THREE.Group(); holder.add(c); holder.rotation.y = rot * DEG;
    // heaped so they show over the rim
    holder.position.set(x, 2.222 + (i > 4 ? .03 : 0), z); holder.userData.home = holder.position.clone();
    integ.add(holder); caps.push(holder);
  });
  integ.visible = !plain; plainCap.visible = plain;

  const comp = compartment({ pivot, caps, openAngle: -112 * DEG, mouth: new V3(0, 2.3, 0), mouthParent: grp, hit: [well, lidG, collarM, ringTop, plainCap] });
  return { grp, comp, integ, plainCap, height: 2.3 };
}

// rectangular flip-top case (used on the steel bottle, in the story and as an iteration)
function buildRectCase({ scale = 1 } = {}){
  const g = new THREE.Group();
  const W = .5, D = .48, Hb = .17, t = .03;
  const dark = plastic(0x141416, .55);
  const floor = new THREE.Mesh(new RoundedBoxGeometry(W, t, D, 3, .012), dark); floor.position.y = t / 2;
  g.add(floor);
  [[0, D / 2 - t / 2, W, t], [0, -D / 2 + t / 2, W, t]].forEach(([x, z, w, d]) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, Hb, d, 2, .012), dark); m.position.set(x, Hb / 2, z); g.add(m); });
  [W / 2 - t / 2, -W / 2 + t / 2].forEach(x => { const m = new THREE.Mesh(new RoundedBoxGeometry(t, Hb, D, 2, .012), dark); m.position.set(x, Hb / 2, 0); g.add(m); });
  // rope channels on the back: the rope runs through these
  const channels = [];
  [-.16, .16].forEach(x => { const c = new THREE.Mesh(new THREE.TorusGeometry(.032, .012, 10, 24, Math.PI), dark); c.position.set(x, Hb * .62, -D / 2 - .002); c.rotation.set(0, Math.PI / 2, Math.PI / 2); g.add(c); channels.push(c); });
  const pivot = new THREE.Group(); pivot.position.set(0, Hb, -D / 2); g.add(pivot);
  const lid = new THREE.Mesh(new RoundedBoxGeometry(W + .012, .055, D + .012, 3, .02), dark); lid.position.set(0, .027, D / 2); pivot.add(lid);
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, W * .7, 12), dark); hinge.rotation.z = Math.PI / 2; hinge.position.set(0, Hb, -D / 2); g.add(hinge);
  // mixed pills filling the tray
  const caps = [];
  for (let i = 0; i < 20; i++){
    const p = randomPill3D(1), holder = new THREE.Group(); holder.add(p);
    holder.rotation.y = Math.random() * Math.PI;
    holder.position.set(rnd(-.17, .17), t + .028 + (i % 3) * .018, rnd(-.16, .16));
    holder.userData.home = holder.position.clone();
    g.add(holder); caps.push(holder);
  }
  g.scale.setScalar(scale);
  const comp = compartment({ pivot, caps, openAngle: -86 * DEG, mouth: new V3(0, Hb + .06, 0), mouthParent: g, hit: [lid, floor, ...g.children] });
  return { g, comp, W, D, Hb, channelY: Hb * .62 };
}

// rope tube along a closed or open path of points
function ropeMesh(points, closed, radius = .017){
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  const m = ropeMaterial(); setRopeRepeat(m, curve.getLength());
  return new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(40, points.length * 3), radius, 10, closed), m);
}

// rope around a bottle of radius Rb at height y; it bulges out to run through the case channels at angle `side`
function wrapPoints(Rb, y, side, bulge, half){
  const pts = [];
  for (let i = 0; i < 160; i++){
    const a = i / 160 * Math.PI * 2;
    let d = Math.atan2(Math.sin(a - side), Math.cos(a - side));
    const w = Math.exp(-Math.pow(d / half, 6));           // flat-topped bump under the case
    const r = Rb + .017 + bulge * w;
    pts.push(new V3(Math.sin(a) * r, y - .01 * w, Math.cos(a) * r));
  }
  return pts;
}

// insulated steel bottle with the rope-tied case
function buildSteelBottle(){
  const grp = new THREE.Group();
  const g = grain();
  const coat = new THREE.MeshPhysicalMaterial({ color: 0x1c1c20, roughness: .58, metalness: .35, roughnessMap: g, bumpMap: g, bumpScale: .35, clearcoat: .25, clearcoatRoughness: .55 });
  const prof = [[0, 0], [.4, 0], [.49, .02], [.52, .08], [.525, .3], [.525, 1.5], [.515, 1.6], [.48, 1.68], [.41, 1.76], [.365, 1.81], [.358, 1.86], [0, 1.86]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 128), coat); grp.add(body, contactShadow(2.2, .5));
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xd3d6da, roughness: .18, metalness: 1 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(.364, .364, .055, 96), steel); band.position.y = 1.888;
  const lidB = new THREE.Mesh(new THREE.LatheGeometry([[0, 1.915], [.352, 1.915], [.36, 1.95], [.36, 2.13], [.33, 2.18], [.26, 2.2], [.26, 2.3], [.2, 2.33], [0, 2.33]].map(([r, y]) => new THREE.Vector2(r, y)), 96), coat);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(.075, .085, .09, 32), coat); spout.position.set(0, 2.37, .06);
  grp.add(band, lidB, spout);
  // flexible strap handle: a flattened loop from both sides of the lid
  const hc = new THREE.CatmullRomCurve3([new V3(-.27, 2.2, -.02), new V3(-.3, 2.5, -.02), new V3(-.2, 2.72, -.02), new V3(0, 2.78, -.02), new V3(.2, 2.72, -.02), new V3(.3, 2.5, -.02), new V3(.27, 2.2, -.02)]);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(hc, 60, .045, 14), coat); handle.scale.z = .55; grp.add(handle);
  [-1, 1].forEach(s => { const pin = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .025, 32), steel); pin.rotation.z = Math.PI / 2; pin.position.set(s * .285, 2.22, -.02); grp.add(pin); });
  // printed wordmark near the bottom
  const word = canvasTex(1024, 128, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = 'rgba(235,235,235,.82)'; x.font = '300 74px "Plus Jakarta Sans", Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('HYDRA', w * .25 - 55, h / 2); x.font = '300 74px "Plus Jakarta Sans", Arial'; x.fillText('Cap', w * .25 + 125, h / 2); });
  const label = new THREE.Mesh(new THREE.CylinderGeometry(.527, .527, .12, 96, 1, true, -.9, 1.8), new THREE.MeshBasicMaterial({ map: word, transparent: true, depthWrite: false }));
  word.repeat.set(1, 1); label.position.y = .32; grp.add(label);

  // the case sits on the rope against the bottle, front-right
  const side = 32 * DEG, out = new V3(Math.sin(side), 0, Math.cos(side));
  const kase = buildRectCase();
  const ropeY = .96, Rb = .525, rope = .017;
  kase.g.position.copy(out.clone().multiplyScalar(Rb + rope * 2 + .006 + kase.D / 2)).setY(ropeY - kase.channelY);
  kase.g.rotation.y = side;
  grp.add(kase.g);
  grp.add(ropeMesh(wrapPoints(Rb, ropeY, side, rope * 1.1, .42), true, rope));
  return { grp, comp: kase.comp, height: 2.78 };
}

/* ======================================================================
   PORTFOLIO MOUNTS
   <div class="bottle3d" data-bottles="cap">  the clear bottle with the flip-top cap
   <div class="bottle3d" data-bottles="duo">  both integrations side by side
   They turn slowly on their own and open / close every few seconds
   (click to open or close now). Rendering stops while off screen.
   ====================================================================== */
const CAMS = {
  cap: { pos: new V3(3.1, 3.9, 5.6), target: new V3(0, 1.22, 0), fit: .62 },
  duo: { pos: new V3(0, 2.3, 8.6), target: new V3(0, 1.25, 0), fit: 1.1 },
};
function mountBottles(el){
  const kind = el.dataset.bottles === 'duo' ? 'duo' : 'cap', C = CAMS[kind];
  const R = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  R.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.1;
  el.appendChild(R.domElement);
  const S = new THREE.Scene();
  S.environment = new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(R), .04).texture;
  S.add(new THREE.HemisphereLight(0xf2f9ff, 0x6f8aa3, .8));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(3, 5, 4); S.add(key);
  const rim = new THREE.DirectionalLight(0xd8efff, 1.8); rim.position.set(-4, 3, -3); S.add(rim);
  // dark theme: an ember back-light picks out the bottle's silhouette against the navy
  if (document.documentElement.dataset.theme !== 'light'){ const ember = new THREE.DirectionalLight(0xff7a3d, 2.2); ember.position.set(-3.5, 1.2, -4); S.add(ember); }
  const cam = new THREE.PerspectiveCamera(30, 1, .05, 60); cam.position.copy(C.pos); cam.lookAt(C.target);

  const models = kind === 'duo' ? [buildCapBottle(), buildSteelBottle()] : [buildCapBottle()];
  if (kind === 'duo'){ models[0].grp.position.x = -1.05; models[1].grp.position.x = 1.05; }
  models.forEach(m => S.add(m.grp));

  const size = () => { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
    R.setSize(w, h, false); cam.aspect = w / h; cam.zoom = Math.min(1, cam.aspect / C.fit); cam.updateProjectionMatrix(); };
  new ResizeObserver(size).observe(el); size();

  // open / close on a timer, or on click
  let open = false, next = performance.now() + 1800;
  const setOpen = v => { open = v; models.forEach(m => m.comp.set(v)); next = performance.now() + (v ? 3200 : 3800); };
  el.addEventListener('click', e => { e.preventDefault(); setOpen(!open); });

  let visible = false, raf = 0;
  const t0 = performance.now();
  const loop = now => {
    raf = requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    const t = (now - t0) / 1000;
    if (!reduced && now > next) setOpen(!open);
    if (kind === 'duo'){
      const [a, b] = models;
      a.grp.position.y = .1 + Math.sin(t * 1.1) * .07; a.grp.rotation.y = reduced ? 0 : Math.sin(t * .4) * .35;
      b.grp.position.y = .1 + Math.sin(t * 1.1 + 1.6) * .07; b.grp.rotation.y = -.15 + (reduced ? 0 : Math.sin(t * .4 + 1) * .35);
    } else if (!reduced){
      models[0].grp.rotation.y = t * .35;
      models[0].grp.position.y = Math.sin(t * 1.1) * .04;
    }
    models.forEach(m => m.comp.update());
    R.render(S, cam);
    if (!el.classList.contains('ready')) el.classList.add('ready');
  };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(loop); }, { rootMargin: '120px' }).observe(el);
}
document.querySelectorAll('.bottle3d').forEach(mountBottles);
