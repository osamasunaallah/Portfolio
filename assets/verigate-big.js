/* VeriGate spotlight, large device (25.11.2026): a verification terminal, big and cut off by the
   right edge of the screen. Osama asked for a richer box shape that keeps only the screen, so the
   body is modelled here: sloped face, RFID tap ring, status light, vents, weighing platform. As the section scrolls in, it slides in from the right with a
   roll and a tilt and settles turned three-quarters to face the title. Scrolling back up
   plays it backwards. The LCD shows the same live text as the other VeriGate models. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const host = document.querySelector('.vg-big');
if (host) (window.__q3d || ((e, f) => f(e)))(host, start);

function start(host){
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const dark = () => document.documentElement.dataset.theme !== 'light';

  /* live LCD text */
  const LW = 1024, LH = 220, lc = document.createElement('canvas'); lc.width = LW; lc.height = LH;
  const x = lc.getContext('2d');
  const STATES = [['VERIGATE', 'READY · SCAN', false], ['SCANNING', 'CARD DETECTED', false], ['APPROVED', 'WELCOME', true]];
  function drawLCD(ms){
    const [l1, l2, ok] = STATES[Math.floor(ms / 2600) % 3];
    const bg = x.createRadialGradient(LW * .5, LH * .35, 50, LW * .5, LH * .35, LW * .7);
    (ok ? ['#2DD279', '#1aa05a', '#0d6e3a', '#094a27'] : ['#2A52BE', '#1f3f9e', '#142a72', '#0c1e5a']).forEach((c, i) => bg.addColorStop([0, .3, .65, 1][i], c));
    x.shadowBlur = 0; x.fillStyle = bg; x.fillRect(0, 0, LW, LH);
    x.fillStyle = 'rgba(0,0,0,.1)'; for (let y = 0; y < LH; y += 8) x.fillRect(0, y, LW, 1); for (let xx = 0; xx < LW; xx += 8) x.fillRect(xx, 0, 1, LH);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '700 90px "IBM Plex Mono", Consolas, monospace'; x.shadowColor = ok ? 'rgba(170,255,200,.9)' : 'rgba(170,210,255,.9)'; x.shadowBlur = 26;
    x.fillStyle = ok ? '#E8FFEF' : '#E0EBFF'; x.fillText(l1 + (Math.floor(ms / 500) % 2 ? ' ' : '_'), LW / 2, LH * .36);
    x.font = '600 56px "IBM Plex Mono", Consolas, monospace'; x.shadowBlur = 18; x.fillStyle = ok ? '#C8F5DA' : '#B5CDFF'; x.fillText(l2, LW / 2, LH * .74);
    tex.needsUpdate = true;
    const gc = ok ? 0x2dd279 : 0x4f7cff; ledMat.color.setHex(gc); glowMat.color.setHex(gc); haloMat.color.setHex(gc);   // the lights follow the screen state
  }
  const tex = new THREE.CanvasTexture(lc); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;

  /* renderer, camera, light */
  const R = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  R.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));   // a big canvas: 1.25 keeps it sharp without the GPU cost of 1.5
  R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.3;
  host.appendChild(R.domElement);
  const S = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(R); S.environment = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose();
  S.add(new THREE.AmbientLight(0xffffff, .9));
  const key = new THREE.DirectionalLight(0xfff2dc, 2.6); key.position.set(-.5, .45, .55); S.add(key);   // from the title side, lighting the front
  const fill = new THREE.DirectionalLight(0xcbd3ff, .9); fill.position.set(.4, .1, .4); S.add(fill);
  const rim = new THREE.DirectionalLight(0x9fe8ff, 1.8); rim.position.set(.2, .4, -.6); S.add(rim);
  const warm = new THREE.DirectionalLight(0xe5d3b3, 1.6); warm.position.set(-.5, .12, -.35); S.add(warm);
  const cam = new THREE.PerspectiveCamera(26, 1, .001, 50);
  cam.position.set(0, .01, .285); cam.lookAt(0, -.009, 0);

  /* ---------- the terminal: modelled here; only the live LCD screen is kept from the device ---------- */
  const Wd = .1, BEV = .004;
  const body = new THREE.MeshPhysicalMaterial({ color: 0x1c1e24, roughness: .42, metalness: .35, clearcoat: .5, clearcoatRoughness: .3 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x07080b, roughness: .12, metalness: .2, clearcoat: 1, clearcoatRoughness: .05 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb9c0c9, roughness: .3, metalness: .95 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xd8c3a0, roughness: .35, metalness: .8 });   // the site's beige, as a thin inlay
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x4f7cff, toneMapped: false });
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x4f7cff, toneMapped: false });
  const haloMat = new THREE.MeshBasicMaterial({ color: 0x4f7cff, transparent: true, opacity: .2, toneMapped: false, depthWrite: false });
  const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  const model = new THREE.Group();
  // side profile (depth, height): deep at the bottom, a sloped face, a short flat top
  const fA = new THREE.Vector2(.036, -.036), fB = new THREE.Vector2(.008, .056);
  const prof = new THREE.Shape();
  prof.moveTo(-.03, -.058); prof.lineTo(fA.x, -.058); prof.lineTo(fA.x, fA.y);
  prof.lineTo(fB.x, fB.y); prof.lineTo(-.03, fB.y); prof.closePath();
  const shellGeo = new THREE.ExtrudeGeometry(prof, { depth: Wd, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 6, curveSegments: 12 });
  shellGeo.translate(0, 0, -Wd / 2);
  mesh(shellGeo, body, model).rotation.y = -Math.PI / 2;            // profile depth -> +z (front), extrusion -> width along x

  // the sloped face: everything on it lives in this group (x across, y up the slope, z out of it)
  const slope = Math.atan2(fA.x - fB.x, fB.y - fA.y), faceLen = fA.distanceTo(fB);
  const face = new THREE.Group();
  face.position.set(0, (fA.y + fB.y) / 2, (fA.x + fB.x) / 2 + BEV * Math.cos(slope));
  face.rotation.x = -slope; model.add(face);
  mesh(new RoundedBoxGeometry(Wd - .006, faceLen - .002, .0016, 4, .006), glass, face, 0, 0, .0008);
  // screen: a recessed bezel and the live LCD
  mesh(new RoundedBoxGeometry(.078, .024, .0012, 3, .003), new THREE.MeshStandardMaterial({ color: 0x0d0f14, roughness: .6 }), face, 0, .024, .0018);
  mesh(new THREE.PlaneGeometry(.07, .0158), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), face, 0, .024, .0025);
  // wordmark above the screen
  mesh(new THREE.PlaneGeometry(.04, .0056), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false,
    map: canvasTex(512, 72, (c, w, h) => { c.fillStyle = 'rgba(216,195,160,.92)'; c.font = '600 44px "IBM Plex Mono", Consolas, monospace';
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('V E R I G A T E', w / 2, h / 2); }) }), face, 0, .0425, .0018);
  // RFID tap pad: a glowing ring round a contactless mark
  const pad = new THREE.Group(); pad.position.set(0, -.012, .0017); face.add(pad);
  mesh(new THREE.TorusGeometry(.0145, .0011, 12, 64), glowMat, pad);
  mesh(new THREE.RingGeometry(.0128, .0195, 64), haloMat, pad, 0, 0, .0002);
  mesh(new THREE.CircleGeometry(.012, 48), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false,
    map: canvasTex(256, 256, (c, w, h) => { c.strokeStyle = 'rgba(200,214,255,.9)'; c.lineWidth = 11; c.lineCap = 'round';
      [30, 56, 82].forEach(r => { c.beginPath(); c.arc(84, 116, r, -Math.PI / 4, Math.PI / 4); c.stroke(); });
      c.fillStyle = 'rgba(200,214,255,.75)'; c.font = '600 30px "IBM Plex Mono", Consolas, monospace'; c.textAlign = 'center'; c.fillText('TAP', 128, 214); }) }), pad, 0, 0, .0003);
  // status light bar under the pad
  mesh(new RoundedBoxGeometry(.05, .0022, .0012, 2, .0009), ledMat, face, 0, -.036, .0018);

  // front kick panel below the slope: vent slots
  for (let i = 0; i < 6; i++) mesh(new RoundedBoxGeometry(.06, .0012, .0012, 2, .0005), glass, model, 0, -.0535 + i * .0027, fA.x + BEV + .0002);
  // beige inlay along both edges of the face, and grip grooves on the sides
  [-1, 1].forEach(sx => {
    const inlay = mesh(new THREE.BoxGeometry(.0012, faceLen - .006, .0012), trim, model, sx * (Wd / 2 - .0006), face.position.y, face.position.z + .0004);
    inlay.rotation.x = -slope;
    for (let i = 0; i < 3; i++) mesh(new RoundedBoxGeometry(.0014, .004, .044, 2, .0006), glass, model, sx * (Wd / 2 + BEV), -.02 + i * .009, -.004);
  });
  // the weighing platform it stands on, with a light line round its edge
  const base = mesh(new RoundedBoxGeometry(Wd + .03, .009, .1, 4, .003), metal, model, 0, -.058 - BEV - .0045, .004);
  mesh(new RoundedBoxGeometry(Wd + .0306, .0012, .1006, 2, .0005), glowMat, model, 0, base.position.y + .0012, .004);
  mesh(new RoundedBoxGeometry(Wd + .018, .004, .088, 3, .0015), new THREE.MeshStandardMaterial({ color: 0x0d0f14, roughness: .7 }), model, 0, base.position.y - .0065, .004);

  // centre it and set its size
  const bb = new THREE.Box3().setFromObject(model), ctr = bb.getCenter(new THREE.Vector3()), bsz = bb.getSize(new THREE.Vector3());
  const holder = new THREE.Group(); model.position.sub(ctr); holder.add(model); holder.scale.setScalar(.105 / Math.max(bsz.x, bsz.y, bsz.z));
  S.add(holder); drawLCD(0);
  let halfW = .1;
  (R.compileAsync ? R.compileAsync(S, cam).catch(() => {}) : Promise.resolve()).then(() => { pose(reduced ? 1 : 0, 0); R.render(S, cam); host.classList.add('ready'); });

  const size = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    halfW = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.position.z * cam.aspect; };
  new ResizeObserver(size).observe(host); size();

  /* p: 0 = off the screen to the right, 1 = resting, turned to face the title */
  function pose(p, t){
    const e = easeOut(p), narrow = host.clientWidth < 560;
    const restX = halfW - (narrow ? .05 : .052);                  // the right part of the device stays past the edge
    holder.position.x = lerp(halfW + .11, restX, e);
    holder.rotation.z = lerp(.95, 0, e);                          // the roll, settling as it arrives
    holder.rotation.x = lerp(.4, .06, e);                         // the tilt
    holder.rotation.y = lerp(1.15, -.5, e);                       // ends facing the title, on its left
  }

  // it only redraws when something on it changes (the slide-in, the screen text, the theme), not every frame
  let p = reduced ? 1 : 0, visible = false, raf = 0, lastKey = '', sized = 0;
  const lcdKey = ms => Math.floor(ms / 2600) % 3 + ':' + Math.floor(ms / 500) % 2;
  new ResizeObserver(() => { sized++; }).observe(host);
  const frame = ms => {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    if (!reduced){
      // follows the scroll: starts as the section enters, rests when its top is about a third of the way down
      const r = host.parentElement.getBoundingClientRect(), vh = innerHeight;
      const target = clamp01((vh - r.top) / (vh * .7));
      p += (target - p) * .12; if (Math.abs(target - p) < .0005) p = target;
    }
    const lk = lcdKey(ms), key = p.toFixed(4) + '|' + lk + '|' + dark() + '|' + sized;
    if (key === lastKey) return;
    if (!lastKey.includes('|' + lk + '|')) drawLCD(ms);
    lastKey = key;
    pose(p, ms / 1000);
    warm.intensity = dark() ? 1.6 : .6;
    R.render(S, cam);
  };
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame); }, { rootMargin: '160px' }).observe(host.parentElement);
}
