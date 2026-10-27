'use client';
// Data-driven digital twin of a Nexus facility. Every rack and component is
// placed from data/nexus coordinates; the component draws whatever `view`
// (lib/nexus/twin-model.js) describes: per-object state, ripple timing, flow
// lines, labels and camera focus.
//
// Look: dark navy environment, light hall floors, glass hall walls with edge
// lines, dark metal racks with an emissive strip on each face that carries the
// rack's state, bloom on the emissives only, and an optional heatmap diffused
// across the floor (lib/nexus/twin-overlay.js). `variant="site"` adds the
// campus (shells, roads, landscaping) for the outer view.
//
// Performance rules: state changes go through instance colours and cached
// textures, never a geometry rebuild; the heatmap is rebuilt only when its
// values change; ?lowfx=1 turns off bloom and shadows.
import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { racksOf, componentsOf, getComponent, getRack } from '@/lib/nexus/data';
import { orientationLabels } from '@/lib/nexus/twin-model';
import { rampRgb, overlayT } from '@/lib/nexus/twin-overlay';
import { describeObject } from '@/lib/nexus/twin-site';
import { STATE_STYLE, COMPONENT_BASE, LABEL_TONE, RACK_BODY, STRIP_COLOR, STRIP_GAIN, SCENE } from './palette';

const MS_PER_HOP = 120;
const FOV = 38;
// ~42° elevation, ~38° off the long axis: steep enough to see down the aisles.
const HOME_DIRECTION = [0.461, 0.669, 0.59];
const MAX_CALLOUTS = 6;
const LEADER_PX = 44;
const STRIP_BASE_GAIN = 2.1;

const SHAPES = {
  pdu: { kind: 'box', size: [0.5, 1.6, 0.9] },
  crah: { kind: 'box', size: [0.9, 1.9, 1.1] },
  busway: { kind: 'box', size: [12, 0.25, 0.35], hanging: true },
  rpp: { kind: 'box', size: [0.9, 1.8, 0.7] },
  ups: { kind: 'box', size: [1.4, 2.0, 1.0] },
  switchgear: { kind: 'box', size: [1.3, 2.2, 3.2] },
  transformer: { kind: 'box', size: [2.4, 2.4, 2.4] },
  utility_feed: { kind: 'cyl', size: [0.5, 4.5, 0.5] },
  generator: { kind: 'box', size: [4, 2.4, 1.8] },
  chiller: { kind: 'box', size: [5, 2.6, 2.4] },
  cooling_tower: { kind: 'cyl', size: [2.0, 4.2, 2.0] },
  chw_loop: { kind: 'box', size: [6, 0.5, 0.5] },
};
const RACK_SIZE = [0.56, 2.0, 1.15];
const STRIP_SIZE = [0.46, 1.75, 0.02];

const STATUS_TONE = {
  Normal: '#22D3A7', Free: '#8FA8C8', Blocked: '#8FA8C8', Warning: '#F5A623', Exceeded: '#FF4D4D', Critical: '#FF4D4D',
};

const lowFx = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('lowfx') === '1';

// Diffuse per-rack values into a floor texture: a Gaussian-weighted mean of
// nearby rack values (so density does not read as heat), faded where there
// are no racks, then mapped through the ramp.
function buildHeatCanvas(racks, overlay, bounds) {
  const CELL = 0.2, SIGMA = 1.5, CUT = 3 * SIGMA;
  const W = Math.ceil((bounds.x1 - bounds.x0) / CELL), H = Math.ceil((bounds.z1 - bounds.z0) / CELL);
  const num = new Float32Array(W * H), den = new Float32Array(W * H);
  const r2 = Math.ceil(CUT / CELL);
  for (const r of racks) {
    const v = overlay.values[r.rack_id];
    if (v == null) continue;
    const cx = (r.x_m - bounds.x0) / CELL, cz = (r.z_m - bounds.z0) / CELL;
    for (let dz = -r2; dz <= r2; dz++) {
      const z = Math.round(cz) + dz;
      if (z < 0 || z >= H) continue;
      for (let dx = -r2; dx <= r2; dx++) {
        const x = Math.round(cx) + dx;
        if (x < 0 || x >= W) continue;
        const d2 = ((x - cx) ** 2 + (z - cz) ** 2) * CELL * CELL;
        const w = Math.exp(-d2 / (2 * SIGMA * SIGMA));
        num[z * W + x] += w * v;
        den[z * W + x] += w;
      }
    }
  }
  const small = document.createElement('canvas');
  small.width = W; small.height = H;
  const sctx = small.getContext('2d');
  const img = sctx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    if (den[i] < 1e-3) continue;
    const [rr, gg, bb] = rampRgb(overlayT(overlay, num[i] / den[i]));
    img.data.set([rr, gg, bb, Math.round(255 * Math.min(1, den[i] * 1.1))], i * 4);
  }
  sctx.putImageData(img, 0, 0);
  const out = document.createElement('canvas');
  out.width = 1024; out.height = Math.max(8, Math.round((1024 * H) / W));
  const octx = out.getContext('2d');
  octx.filter = 'blur(10px)';
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(small, 0, 0, out.width, out.height);
  return out;
}

function backdropTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(256, 150, 20, 256, 200, 420);
  grad.addColorStop(0, '#163a6c');
  grad.addColorStop(0.45, '#0b1d3a');
  grad.addColorStop(1, '#040912');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function NexusTwin({
  facilityId, view, runKey = 0, insetLeft = 0, insetRight = 0, onRackClick, onComponentClick,
  variant = 'interior', overlay = null, focus = null, infoCards = true, fullscreenTarget = null, showFullscreen = true, fullscreenAt = 'bottom-right',
  callouts: externalCallouts = [], isolate = null,
}) {
  const rootRef = useRef(null);
  const mountRef = useRef(null);
  const overlayRef = useRef(null);
  const sceneRef = useRef(null);
  const propsRef = useRef({});
  const [hover, setHover] = useState(null);
  const [labels, setLabels] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isFull, setIsFull] = useState(false);
  propsRef.current = { ...propsRef.current, insetLeft, insetRight, onRackClick, onComponentClick, infoCards, selected, isolate };

  // ─── Build the scene once per facility and variant ───────────────────────
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return undefined;
    let disposed = false;
    let cleanup = () => {};
    const fx = !lowFx();

    Promise.all([
      import('three'),
      import('three/examples/jsm/controls/OrbitControls.js'),
      import('three/examples/jsm/postprocessing/EffectComposer.js'),
      import('three/examples/jsm/postprocessing/RenderPass.js'),
      import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
      import('three/examples/jsm/postprocessing/OutputPass.js'),
    ]).then(([THREE, { OrbitControls }, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }]) => {
      if (disposed) return;
      const site = variant === 'site';
      const racks = racksOf(facilityId);
      const comps = componentsOf(facilityId).filter((c) => c.component_type !== 'rack_row' && SHAPES[c.component_type]);

      // ── Renderer ──
      const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = fx;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = backdropTexture(THREE);
      const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 900);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.maxPolarAngle = (80 * Math.PI) / 180;
      controls.minDistance = 6;
      controls.maxDistance = site ? 320 : 220;

      // ── Extents ──
      const allPoints = [...racks.map((r) => [r.x_m, r.z_m]), ...comps.map((c) => [c.position.x, c.position.z])];
      const minX = Math.min(...allPoints.map((p) => p[0])) - 4, maxX = Math.max(...allPoints.map((p) => p[0])) + 4;
      const minZ = Math.min(...allPoints.map((p) => p[1])) - 4, maxZ = Math.max(...allPoints.map((p) => p[1])) + 4;
      const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
      const span = Math.max(maxX - minX, maxZ - minZ);

      // ── Lighting rig ──
      scene.add(new THREE.HemisphereLight(0x9fb8d8, 0x0a1020, 0.8));
      const key = new THREE.DirectionalLight(0xffffff, 1.9);
      key.position.set(cx - 40, 60, cz + 35);
      key.target.position.set(cx, 0, cz);
      key.castShadow = fx;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.near = 10;
      key.shadow.camera.far = 220;
      const sh = span * (site ? 0.95 : 0.75);
      Object.assign(key.shadow.camera, { left: -sh, right: sh, top: sh, bottom: -sh });
      key.shadow.bias = -0.0005;
      key.shadow.normalBias = 0.02;
      scene.add(key, key.target);
      const rim = new THREE.DirectionalLight(0x4a90e2, 0.7);
      rim.position.set(cx + 30, 25, cz - 40);
      scene.add(rim);

      // ── Materials ──
      const mat = {
        ground: new THREE.MeshStandardMaterial({ color: SCENE.ground, roughness: 0.95 }),
        site: new THREE.MeshStandardMaterial({ color: SCENE.site, roughness: 0.9 }),
        road: new THREE.MeshStandardMaterial({ color: SCENE.road, roughness: 0.85 }),
        hall: new THREE.MeshStandardMaterial({ color: SCENE.hallFloor, roughness: 0.65, metalness: 0.1 }),
        plantFloor: new THREE.MeshStandardMaterial({ color: SCENE.plantFloor, roughness: 0.8 }),
        yard: new THREE.MeshStandardMaterial({ color: SCENE.yardFloor, roughness: 0.85 }),
        wall: new THREE.MeshStandardMaterial({ color: SCENE.wall, roughness: 0.85 }),
        glass: new THREE.MeshStandardMaterial({ color: 0x6fa8dc, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
        edge: new THREE.LineBasicMaterial({ color: SCENE.edge, transparent: true, opacity: 0.55 }),
      };
      let parent = scene;
      const add = (o) => parent.add(o);
      const edgesOf = (mesh) => {
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 25), mat.edge);
        e.position.copy(mesh.position); e.rotation.copy(mesh.rotation);
        add(e);
      };
      const slab = (x0, x1, z0, z1, material, y, userData) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), material);
        m.rotation.x = -Math.PI / 2;
        m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
        m.receiveShadow = fx;
        if (userData) m.userData = userData;
        add(m);
        return m;
      };
      const pickables = [];
      // Four walls around a rectangle; glass inside, solid on the site view.
      const shell = (x0, x1, z0, z1, height, material) => {
        const T = 0.2;
        const parts = [
          [x1 - x0 + T, (x0 + x1) / 2, z0, 'x'], [x1 - x0 + T, (x0 + x1) / 2, z1, 'x'],
          [z1 - z0 + T, x0, (z0 + z1) / 2, 'z'], [z1 - z0 + T, x1, (z0 + z1) / 2, 'z'],
        ];
        for (const [len, px, pz, axis] of parts) {
          const g = axis === 'x' ? new THREE.BoxGeometry(len, height, T) : new THREE.BoxGeometry(T, height, len);
          const m = new THREE.Mesh(g, material);
          m.position.set(px, height / 2, pz);
          m.castShadow = fx && material !== mat.glass;
          m.receiveShadow = fx;
          add(m);
          edgesOf(m);
        }
      };

      // ── Ground and campus ──
      const pad = site ? 16 : 6;
      slab(cx - span * (site ? 2.2 : 1.2), cx + span * (site ? 2.2 : 1.2), cz - span * (site ? 2.2 : 1.2), cz + span * (site ? 2.2 : 1.2), mat.ground, -0.02);
      slab(minX - pad, maxX + pad, minZ - pad, maxZ + pad, mat.site, -0.01);
      if (site) {
        // Perimeter road and landscaping: scenery, not data.
        const R = 7, o = pad + R / 2;
        slab(minX - o - R / 2, maxX + o + R / 2, minZ - o - R / 2, minZ - o + R / 2, mat.road, -0.005);
        slab(minX - o - R / 2, maxX + o + R / 2, maxZ + o - R / 2, maxZ + o + R / 2, mat.road, -0.005);
        slab(minX - o - R / 2, minX - o + R / 2, minZ - o, maxZ + o, mat.road, -0.005);
        slab(maxX + o - R / 2, maxX + o + R / 2, minZ - o, maxZ + o, mat.road, -0.005);
        const fence = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(minX - pad, 0.05, minZ - pad), new THREE.Vector3(maxX + pad, 0.05, minZ - pad),
          new THREE.Vector3(maxX + pad, 0.05, maxZ + pad), new THREE.Vector3(minX - pad, 0.05, maxZ + pad),
        ]), new THREE.LineBasicMaterial({ color: 0x6fa8dc, transparent: true, opacity: 0.45 }));
        scene.add(fence);
        // Trees on a fixed pattern outside the road ring.
        const treeSpots = [];
        const ring = pad + R + 5;
        for (let x = minX - ring; x <= maxX + ring; x += 8) treeSpots.push([x, minZ - ring], [x, maxZ + ring]);
        for (let z = minZ - ring + 8; z <= maxZ + ring - 8; z += 8) treeSpots.push([minX - ring, z], [maxX + ring, z]);
        const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 3.6, 7), new THREE.MeshStandardMaterial({ color: 0x1e5a4c, roughness: 0.9 }), treeSpots.length);
        const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.22, 1.2, 6), new THREE.MeshStandardMaterial({ color: 0x3b3326, roughness: 1 }), treeSpots.length);
        const t = new THREE.Object3D();
        treeSpots.forEach(([x, z], i) => {
          const s = 0.85 + ((i * 37) % 10) / 30;
          t.position.set(x, 1.2 + 1.8 * s, z); t.scale.set(s, s, s); t.updateMatrix(); crowns.setMatrixAt(i, t.matrix);
          t.position.set(x, 0.6, z); t.scale.set(1, 1, 1); t.updateMatrix(); trunks.setMatrixAt(i, t.matrix);
        });
        crowns.castShadow = fx;
        scene.add(crowns, trunks);
      }

      // ── Halls: light floor, walls, edges ──
      const extent = (items, getX, getZ, p) => [Math.min(...items.map(getX)) - p, Math.max(...items.map(getX)) + p, Math.min(...items.map(getZ)) - p, Math.max(...items.map(getZ)) + p];
      const hallFloors = [];
      const hallGroups = new Map();
      const hallBox = new Map();
      for (const hallId of [...new Set(racks.map((r) => r.hall_id))]) {
        const [x0, x1, z0, z1] = extent(racks.filter((r) => r.hall_id === hallId), (r) => r.x_m, (r) => r.z_m, 1.8);
        parent = new THREE.Group();
        scene.add(parent);
        hallGroups.set(hallId, parent);
        hallBox.set(hallId, { x0, x1, z0, z1 });
        const floor = slab(x0, x1, z0, z1, mat.hall, 0.01, { kind: 'hall', id: hallId });
        pickables.push(floor);
        hallFloors.push([x0, x1, z0, z1]);
        shell(x0, x1, z0, z1, site ? 3.4 : 2.7, site ? mat.wall : mat.glass);
      }
      const plantGroup = new THREE.Group();
      scene.add(plantGroup);
      parent = plantGroup;
      for (const zone of ['plant room', 'outdoor yard']) {
        const zc = comps.filter((c) => c.zone === zone);
        if (!zc.length) continue;
        const [x0, x1, z0, z1] = extent(zc, (c) => c.position.x, (c) => c.position.z, 3);
        slab(x0, x1, z0, z1, zone === 'plant room' ? mat.plantFloor : mat.yard, 0.01);
        if (zone === 'plant room') shell(x0, x1, z0, z1, site ? 4.6 : 3, site ? mat.wall : mat.glass);
      }

      const floorLabels = new THREE.Group();
      scene.add(floorLabels);
      parent = floorLabels;
      // Floor-painted orientation labels (hall names, zones).
      if (!site) {
        for (const l of orientationLabels(facilityId)) {
          const c = document.createElement('canvas');
          c.width = 512; c.height = 128;
          const ctx = c.getContext('2d');
          ctx.font = '700 64px "Plus Jakarta Sans", system-ui, sans-serif';
          ctx.fillStyle = 'rgba(120, 150, 190, 0.75)';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(l.text.toUpperCase(), 256, 64);
          const tex = new THREE.CanvasTexture(c);
          tex.colorSpace = THREE.SRGBColorSpace;
          const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
          m.rotation.x = -Math.PI / 2;
          const offset = l.id.startsWith('hall-') ? 8.6 : 0;
          m.position.set(l.position.x, 0.04, l.position.z + offset);
          add(m);
        }
      }

      parent = scene;

      // ── Heatmap plane (texture swapped per overlay, never rebuilt per frame) ──
      const hb = { x0: Math.min(...hallFloors.map((h) => h[0])), x1: Math.max(...hallFloors.map((h) => h[1])), z0: Math.min(...hallFloors.map((h) => h[2])), z1: Math.max(...hallFloors.map((h) => h[3])) };
      // Slightly dimmed so warm colours on the floor do not bloom; only the strips should.
      const heatMat = new THREE.MeshBasicMaterial({ color: 0xb8b8b8, transparent: true, opacity: 0.78, depthWrite: false, toneMapped: false });
      const heat = new THREE.Mesh(new THREE.PlaneGeometry(hb.x1 - hb.x0, hb.z1 - hb.z0), heatMat);
      heat.rotation.x = -Math.PI / 2;
      heat.position.set((hb.x0 + hb.x1) / 2, 0.03, (hb.z0 + hb.z1) / 2);
      heat.renderOrder = 1;
      heat.visible = false;
      scene.add(heat);
      const heatCache = new Map();

      // ── Racks: bodies and emissive strips, instanced ──
      const dummy = new THREE.Object3D();
      const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(...RACK_SIZE), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.45 }), racks.length);
      // Rack fronts read as stacked server units: bright bands with dark gaps.
      const unitCanvas = document.createElement('canvas');
      unitCanvas.width = 32; unitCanvas.height = 256;
      const uctx = unitCanvas.getContext('2d');
      uctx.fillStyle = '#ffffff'; uctx.fillRect(0, 0, 32, 256);
      uctx.fillStyle = '#1b2433';
      for (let y = 0; y < 256; y += 16) uctx.fillRect(0, y, 32, 3);
      uctx.fillStyle = '#7d8aa0';
      for (let y = 6; y < 256; y += 16) uctx.fillRect(24, y, 4, 4);
      const unitTex = new THREE.CanvasTexture(unitCanvas);
      unitTex.colorSpace = THREE.SRGBColorSpace;
      const strips = new THREE.InstancedMesh(new THREE.BoxGeometry(...STRIP_SIZE), new THREE.MeshBasicMaterial({ color: 0xffffff, map: unitTex, toneMapped: false }), racks.length * 2);
      bodies.castShadow = fx; bodies.receiveShadow = fx;
      const n = racks.length;
      racks.forEach((r, i) => {
        dummy.position.set(r.x_m, r.y_m + RACK_SIZE[1] / 2, r.z_m);
        dummy.updateMatrix();
        bodies.setMatrixAt(i, dummy.matrix);
        bodies.setColorAt(i, new THREE.Color(RACK_BODY));
        for (const [k, side] of [[0, 1], [1, -1]]) {
          dummy.position.set(r.x_m, r.y_m + 1.05, r.z_m + side * (RACK_SIZE[2] / 2 + 0.012));
          dummy.updateMatrix();
          strips.setMatrixAt(i + k * n, dummy.matrix);
          strips.setColorAt(i + k * n, new THREE.Color(STRIP_COLOR.neutral));
        }
      });
      const zero = new THREE.Matrix4().makeScale(0, 0, 0);
      const rackBase = racks.map((_, i) => { const m = new THREE.Matrix4(); bodies.getMatrixAt(i, m); return m; });
      const stripBase = Array.from({ length: n * 2 }, (_, i) => { const m = new THREE.Matrix4(); strips.getMatrixAt(i, m); return m; });
      bodies.userData = { ids: racks.map((r) => r.rack_id), kind: 'rack' };
      strips.userData = { ids: [...racks, ...racks].map((r) => r.rack_id), kind: 'rack' };
      scene.add(bodies, strips);

      // ── Components: one instanced mesh per type ──
      const compMeshes = [];
      const compSlot = new Map();
      const byType = new Map();
      for (const c of comps) {
        if (!byType.has(c.component_type)) byType.set(c.component_type, []);
        byType.get(c.component_type).push(c);
      }
      for (const [type, list] of byType) {
        const shape = SHAPES[type];
        const [w, h, d] = shape.size;
        const geom = shape.kind === 'cyl' ? new THREE.CylinderGeometry(w * 0.85, w, h, 24) : new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.InstancedMesh(geom, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.3 }), list.length);
        mesh.castShadow = fx; mesh.receiveShadow = fx;
        list.forEach((c, i) => {
          dummy.position.set(c.position.x, shape.hanging ? c.position.y : c.position.y + h / 2, c.position.z);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          mesh.setColorAt(i, new THREE.Color(COMPONENT_BASE[c.chain] ?? COMPONENT_BASE.electrical));
          compSlot.set(c.component_id, { mesh, index: i, shape, component: c });
        });
        mesh.userData = { ids: list.map((c) => c.component_id), kind: 'component', base: list.map((_, i) => { const m = new THREE.Matrix4(); mesh.getMatrixAt(i, m); return m; }) };
        scene.add(mesh);
        compMeshes.push(mesh);
      }

      // Per-instance colour animation state: body and strip per rack.
      const neutralBody = new THREE.Color(RACK_BODY);
      const rackSlots = racks.map(() => ({
        body: neutralBody.clone(), bodyTarget: neutralBody.clone(),
        strip: new THREE.Color(STRIP_COLOR.neutral).multiplyScalar(STRIP_BASE_GAIN), stripTarget: new THREE.Color(STRIP_COLOR.neutral).multiplyScalar(STRIP_BASE_GAIN),
        revealAt: 0, pulse: null,
      }));
      const compSlots = new Map(comps.map((c) => [c.component_id, { cur: new THREE.Color(COMPONENT_BASE[c.chain]), target: new THREE.Color(COMPONENT_BASE[c.chain]), revealAt: 0, pulse: null }]));

      const outlineGroup = new THREE.Group();
      const flowGroup = new THREE.Group();
      const leaderGroup = new THREE.Group();
      scene.add(outlineGroup, flowGroup, leaderGroup);

      // ── Post-processing: bloom on emissives only ──
      let composer = null;
      let bloom = null;
      if (fx) {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.45, 0.82);
        composer.addPass(bloom);
        composer.addPass(new OutputPass());
      }

      // ── Camera framing ──
      const size = { w: 0, h: 0 };
      const tween = { active: false, start: 0, fromPos: new THREE.Vector3(), toPos: new THREE.Vector3(), fromTarget: new THREE.Vector3(), toTarget: new THREE.Vector3() };
      const testCam = new THREE.PerspectiveCamera();
      const corner = new THREE.Vector3();
      const framingFor = (points) => {
        const box = new THREE.Box3();
        points.forEach((p) => box.expandByPoint(new THREE.Vector3(p.x, p.y ?? 0, p.z)));
        box.expandByScalar(points.length === 1 ? 9 : 1.5);
        box.max.y = Math.max(box.max.y, 3);
        const center = box.getCenter(new THREE.Vector3());
        const dir = camera.position.clone().sub(controls.target);
        if (dir.lengthSq() < 1e-6) dir.set(...HOME_DIRECTION);
        dir.normalize();
        const { insetLeft: il, insetRight: ir } = propsRef.current;
        // Fill roughly 75–85% of the visible area.
        const xMin = -1 + (2 * il) / size.w + 0.1, xMax = 1 - (2 * ir) / size.w - 0.1;
        testCam.copy(camera);
        const fits = (dist) => {
          testCam.position.copy(center).addScaledVector(dir, dist);
          testCam.lookAt(center);
          testCam.updateMatrixWorld();
          for (let i = 0; i < 8; i++) {
            corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(testCam);
            if (corner.z > 1 || corner.x < xMin || corner.x > xMax || corner.y < -0.84 || corner.y > 0.78) return false;
          }
          return true;
        };
        let lo = 2, hi = 800;
        for (let i = 0; i < 30; i++) {
          const mid = (lo + hi) / 2;
          if (fits(mid)) hi = mid; else lo = mid;
        }
        return { target: center, position: center.clone().addScaledVector(dir, hi) };
      };
      const homePoints = site
        ? [{ x: minX + 2, y: 0, z: minZ + 2 }, { x: maxX - 2, y: 5, z: maxZ - 2 }]
        : [...racks.map((r) => ({ x: r.x_m, y: 0, z: r.z_m })), ...comps.map((c) => c.position)];
      const easeTo = (points, immediate = false) => {
        const f = framingFor(points);
        if (immediate) {
          controls.target.copy(f.target);
          camera.position.copy(f.position);
          controls.update();
          return;
        }
        tween.fromPos.copy(camera.position);
        tween.toPos.copy(f.position);
        tween.fromTarget.copy(controls.target);
        tween.toTarget.copy(f.target);
        tween.start = performance.now();
        tween.active = true;
      };

      const resize = () => {
        const w = container.clientWidth, h = container.clientHeight;
        if (!w || !h) return;
        size.w = w; size.h = h;
        renderer.setSize(w, h);
        if (composer) {
          composer.setSize(w, h);
          // Half-resolution bloom: visually the same, about a quarter of the cost.
          bloom.setSize(Math.round(w / 2), Math.round(h / 2));
        }
        camera.aspect = w / h;
        const { insetLeft: il, insetRight: ir } = propsRef.current;
        camera.setViewOffset(w, h, -(il - ir) / 2, 0, w, h);
        camera.updateProjectionMatrix();
      };
      camera.position.set(...HOME_DIRECTION);
      resize();
      easeTo(homePoints, true);
      const ro = new ResizeObserver(resize);
      ro.observe(container);

      // ── Picking: hover tooltip and click card ──
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const pick = (e) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects([bodies, strips, ...compMeshes, ...pickables.filter((o) => o.parent?.visible !== false)], false)[0];
        if (!hit) return null;
        const ud = hit.object.userData;
        if (ud.kind === 'hall') return { kind: 'hall', id: ud.id, x: e.clientX - rect.left, y: e.clientY - rect.top, point: hit.point };
        if (hit.instanceId == null) return null;
        return { kind: ud.kind, id: ud.ids[hit.instanceId], x: e.clientX - rect.left, y: e.clientY - rect.top, point: hit.point };
      };
      let hoverKey = null;
      let downAt = null;
      const onMove = (e) => {
        const hit = pick(e);
        const k = hit ? `${hit.kind}:${hit.id}` : null;
        if (k !== hoverKey) {
          hoverKey = k;
          renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
        }
        setHover(hit && hit.kind !== 'hall' ? hit : null);
      };
      const anchorOf = (hit) => {
        if (hit.kind === 'rack') { const r = getRack(hit.id); return { x: r.x_m, y: RACK_SIZE[1] + 0.2, z: r.z_m }; }
        if (hit.kind === 'component') { const s = compSlot.get(hit.id); const c = s.component; return { x: c.position.x, y: (s.shape.hanging ? c.position.y : c.position.y + s.shape.size[1]) + 0.3, z: c.position.z }; }
        return { x: hit.point.x, y: 0.2, z: hit.point.z };
      };
      const onDown = (e) => { downAt = { x: e.clientX, y: e.clientY }; };
      const onUp = (e) => {
        if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4) return;
        downAt = null;
        const hit = pick(e);
        if (!hit) { setSelected(null); return; }
        if (hit.kind === 'rack') propsRef.current.onRackClick?.(getRack(hit.id));
        else if (hit.kind === 'component') propsRef.current.onComponentClick?.(getComponent(hit.id));
        if (propsRef.current.infoCards) setSelected({ kind: hit.kind, id: hit.id, anchor: anchorOf(hit) });
      };
      const onLeave = () => setHover(null);
      renderer.domElement.addEventListener('pointermove', onMove);
      renderer.domElement.addEventListener('pointerdown', onDown);
      renderer.domElement.addEventListener('pointerup', onUp);
      renderer.domElement.addEventListener('pointerleave', onLeave);
      controls.addEventListener('start', () => { tween.active = false; });

      // ── Applying a view ──
      const styleOf = (state) => STATE_STYLE[state] ?? STATE_STYLE.neutral;
      let overlayState = null;
      let lastFramedKey = null;
      let isolated = null;
      const applyOverlay = (ov) => {
        overlayState = ov;
        if (!ov) { heat.visible = false; return; }
        const k = `${ov.key}:${isolated ?? 'all'}`;
        if (!heatCache.has(k)) {
          const subset = isolated ? racks.filter((r) => r.hall_id === isolated) : racks;
          const tex = new THREE.CanvasTexture(buildHeatCanvas(subset, ov, hb));
          tex.colorSpace = THREE.SRGBColorSpace;
          heatCache.set(k, tex);
        }
        heatMat.map = heatCache.get(k);
        heatMat.needsUpdate = true;
        heat.visible = true;
      };
      // One hall on its own: other halls, the plant and their equipment are
      // hidden (zero-scale instances, no rebuild) and the heatmap is redrawn
      // from that hall's racks.
      let home = homePoints;
      const applyIsolation = (hallId) => {
        isolated = hallId && hallGroups.has(hallId) ? hallId : null;
        for (const [id, g] of hallGroups) g.visible = !isolated || id === isolated;
        plantGroup.visible = !isolated;
        floorLabels.visible = !isolated;
        racks.forEach((r, i) => {
          const show = !isolated || r.hall_id === isolated;
          bodies.setMatrixAt(i, show ? rackBase[i] : zero);
          strips.setMatrixAt(i, show ? stripBase[i] : zero);
          strips.setMatrixAt(i + n, show ? stripBase[i + n] : zero);
        });
        bodies.instanceMatrix.needsUpdate = true;
        strips.instanceMatrix.needsUpdate = true;
        bodies.computeBoundingSphere(); strips.computeBoundingSphere();
        const box = isolated ? hallBox.get(isolated) : null;
        for (const m of compMeshes) {
          m.userData.ids.forEach((id, i) => {
            const c = compSlot.get(id).component;
            const show = !box || (c.position.x >= box.x0 - 2.5 && c.position.x <= box.x1 + 2.5 && c.position.z >= box.z0 - 2.5 && c.position.z <= box.z1 + 2.5);
            m.setMatrixAt(i, show ? m.userData.base[i] : zero);
          });
          m.instanceMatrix.needsUpdate = true;
          m.computeBoundingSphere();
        }
        home = box ? [{ x: box.x0, y: 0, z: box.z0 }, { x: box.x1, y: 2, z: box.z1 }] : homePoints;
        if (overlayState) applyOverlay(overlayState);
      };

      const applyView = (v, key, ov) => {
        const now = performance.now();
        applyOverlay(ov);
        racks.forEach((r, i) => {
          const s = v?.rackStates?.[r.rack_id] ?? { state: r.status === 'free' ? 'free' : r.status === 'blocked' ? 'blocked' : 'neutral' };
          const slot = rackSlots[i];
          const ovValue = ov?.values?.[r.rack_id];
          if (ov && ovValue != null && r.status !== 'free') {
            const [rr, gg, bb] = rampRgb(overlayT(ov, ovValue));
            const c = new THREE.Color(`rgb(${rr},${gg},${bb})`);
            slot.bodyTarget = neutralBody.clone().lerp(c, 0.8);
            slot.stripTarget = c.clone().multiplyScalar(1.35);
          } else {
            const state = ov ? (r.status === 'free' ? 'free' : 'dimmed') : s.state;
            const style = styleOf(state);
            const stripHex = STRIP_COLOR[state] ?? style.color;
            const gain = STRIP_GAIN[state] ?? STRIP_BASE_GAIN;
            slot.stripTarget = new THREE.Color(stripHex).multiplyScalar(gain);
            const tintable = !['neutral', 'free', 'dimmed', 'blocked'].includes(state);
            slot.bodyTarget = state === 'dimmed' ? neutralBody.clone().multiplyScalar(0.55) : tintable ? neutralBody.clone().lerp(new THREE.Color(stripHex), 0.55) : neutralBody.clone();
          }
          slot.pulse = ov ? null : styleOf(s.state).pulse ?? null;
          slot.revealAt = now + (s.hop ?? 0) * MS_PER_HOP;
        });
        outlineGroup.clear();
        for (const c of comps) {
          const s = v?.componentStates?.[c.component_id] ?? { state: 'neutral' };
          const slot = compSlots.get(c.component_id);
          const base = new THREE.Color(COMPONENT_BASE[c.chain] ?? COMPONENT_BASE.electrical);
          const style = styleOf(s.state);
          slot.target = style.dim ? base.clone().multiplyScalar(0.45) : s.state === 'neutral' ? base : new THREE.Color(STRIP_COLOR[s.state] ?? style.color);
          slot.pulse = style.pulse ?? null;
          slot.revealAt = now + (s.hop ?? 0) * MS_PER_HOP;
          if (style.outline) {
            const { shape } = compSlot.get(c.component_id);
            const [w, h, d] = shape.size;
            const edges = new THREE.LineSegments(
              new THREE.EdgesGeometry(new THREE.BoxGeometry(w * 1.3 + 0.4, h * 1.25 + 0.3, d * 1.3 + 0.4)),
              new THREE.LineBasicMaterial({ color: s.state === 'redundancy_lost' ? 0xc084fc : 0xff4d4d, transparent: true, opacity: 0.95, toneMapped: false }),
            );
            edges.position.set(c.position.x, shape.hanging ? c.position.y : c.position.y + h / 2, c.position.z);
            edges.userData.revealAt = slot.revealAt;
            edges.visible = false;
            outlineGroup.add(edges);
          }
        }
        flowGroup.clear();
        for (const line of v?.flowLines ?? []) {
          const lift = line.chain === 'thermal' ? 1.0 : 2.8;
          const geom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(line.from.x, Math.max(line.from.y, 0) + lift, line.from.z),
            new THREE.Vector3(line.to.x, Math.max(line.to.y, 0) + lift, line.to.z),
          ]);
          const mesh = new THREE.Line(geom, new THREE.LineDashedMaterial({ color: line.chain === 'thermal' ? 0x22d3ee : 0x60a5fa, dashSize: 0.9, gapSize: 0.5, transparent: true, opacity: 0.95, toneMapped: false }));
          mesh.computeLineDistances();
          mesh.userData.revealAt = now + (line.hop - 1) * MS_PER_HOP;
          mesh.visible = false;
          flowGroup.add(mesh);
        }
        setLabels((v?.labels ?? []).map((l, i) => ({
          id: `label:${l.id ?? i}`, kind: 'label', priority: l.priority ?? 100, revealAt: now + (l.hop ?? 0) * MS_PER_HOP,
          anchor: { x: l.position.x, y: (l.position.y ?? 0) + 2.4, z: l.position.z }, text: l.text, tone: LABEL_TONE[l.tone] ?? '#E8EEF6',
        })));
        if (key !== lastFramedKey) {
          lastFramedKey = key;
          resize();
          easeTo(v?.focusPoints?.length ? v.focusPoints : home);
        }
      };

      // ── DOM callouts with leader lines: projected each frame, culled by priority ──
      const projected = new THREE.Vector3();
      const layoutCallouts = (now) => {
        const layer = overlayRef.current;
        if (!layer) return;
        // On-screen controls the caller marks with data-twin-reserved are kept clear.
        const origin = container.getBoundingClientRect();
        const placed = [...(rootRef.current?.parentElement?.querySelectorAll('[data-twin-reserved]') ?? [])].map((el) => {
          const r = el.getBoundingClientRect();
          return { x0: r.left - origin.left, x1: r.right - origin.left, y0: r.top - origin.top, y1: r.bottom - origin.top };
        });
        const items = [...layer.querySelectorAll('[data-callout]')].map((el) => ({
          el, priority: Number(el.dataset.priority), revealAt: Number(el.dataset.reveal || 0), pinned: el.dataset.pinned === '1',
          anchor: { x: Number(el.dataset.ax), y: Number(el.dataset.ay), z: Number(el.dataset.az) },
        })).sort((a, b) => (b.pinned - a.pinned) || (b.priority - a.priority));
        let shown = 0;
        for (const it of items) {
          projected.set(it.anchor.x, it.anchor.y, it.anchor.z).project(camera);
          const onScreen = projected.z < 1 && Math.abs(projected.x) < 1.05 && Math.abs(projected.y) < 1.05;
          const sx = ((projected.x + 1) / 2) * size.w;
          const sy = ((1 - projected.y) / 2) * size.h;
          const card = it.el.firstElementChild;
          const w = card.offsetWidth, h = card.offsetHeight;
          const rect = { x0: sx - w / 2 - 4, x1: sx + w / 2 + 4, y0: sy - LEADER_PX - h - 4, y1: sy - LEADER_PX + 4 };
          const free = !placed.some((p) => !(rect.x1 < p.x0 || rect.x0 > p.x1 || rect.y1 < p.y0 || rect.y0 > p.y1));
          const visible = onScreen && now >= it.revealAt && (it.pinned || (free && shown < MAX_CALLOUTS && rect.y0 > 0));
          it.el.style.visibility = visible ? 'visible' : 'hidden';
          if (!visible) continue;
          if (!it.pinned) shown += 1;
          placed.push(rect);
          it.el.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px)`;
        }
      };

      // ── Render loop ──
      let last = performance.now();
      let frames = 0, fpsWindowStart = last, raf = 0;
      const tmp = new THREE.Color();
      const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      const loop = () => {
        raf = requestAnimationFrame(loop);
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;

        if (tween.active) {
          const t = Math.min(1, (now - tween.start) / 800);
          const e = easeInOut(t);
          camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
          controls.target.lerpVectors(tween.fromTarget, tween.toTarget, e);
          if (t >= 1) tween.active = false;
        }
        controls.update();

        const alpha = 1 - Math.exp(-dt / 0.2);
        const pulseOf = (p) => (p === 'strong' ? 0.72 + Math.sin(now / 160) * 0.28 : p === 'soft' ? 0.85 + Math.sin(now / 320) * 0.15 : 1);
        rackSlots.forEach((slot, i) => {
          if (now < slot.revealAt) return;
          slot.body.lerp(slot.bodyTarget, alpha);
          slot.strip.lerp(slot.stripTarget, alpha);
          bodies.setColorAt(i, slot.body);
          tmp.copy(slot.strip).multiplyScalar(pulseOf(slot.pulse));
          strips.setColorAt(i, tmp);
          strips.setColorAt(i + n, tmp);
        });
        bodies.instanceColor.needsUpdate = true;
        strips.instanceColor.needsUpdate = true;
        for (const [id, slot] of compSlots) {
          if (now < slot.revealAt) continue;
          slot.cur.lerp(slot.target, alpha);
          tmp.copy(slot.cur).multiplyScalar(pulseOf(slot.pulse));
          const { mesh, index } = compSlot.get(id);
          mesh.setColorAt(index, tmp);
        }
        compMeshes.forEach((m) => { m.instanceColor.needsUpdate = true; });
        for (const o of outlineGroup.children) o.visible = now >= o.userData.revealAt;
        for (const l of flowGroup.children) {
          l.visible = now >= l.userData.revealAt;
          l.material.dashOffset -= dt * 2.2;
        }
        layoutCallouts(now);
        if (composer) composer.render(); else renderer.render(scene, camera);

        frames += 1;
        if (now - fpsWindowStart >= 1000) {
          container.dataset.fps = String(Math.round((frames * 1000) / (now - fpsWindowStart)));
          container.dataset.calls = String(renderer.info.render.calls);
          frames = 0;
          fpsWindowStart = now;
        }
      };
      loop();

      sceneRef.current = { applyView, applyOverlay, applyIsolation, resize, easeTo, get homePoints() { return home; } };
      const pending = propsRef.current;
      applyIsolation(pending.isolate ?? null);
      if (pending.pendingView !== undefined) applyView(pending.pendingView, pending.pendingKey, pending.pendingOverlay);
      else applyView(null, 'home', pending.pendingOverlay);

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        renderer.domElement.removeEventListener('pointermove', onMove);
        renderer.domElement.removeEventListener('pointerdown', onDown);
        renderer.domElement.removeEventListener('pointerup', onUp);
        renderer.domElement.removeEventListener('pointerleave', onLeave);
        controls.dispose();
        heatCache.forEach((t) => t.dispose());
        composer?.dispose?.();
        scene.traverse((o) => { o.geometry?.dispose?.(); });
        renderer.dispose();
        if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      };
    });

    return () => {
      disposed = true;
      cleanup();
      sceneRef.current = null;
    };
  }, [facilityId, variant]);

  // Isolation first, so the view and focus below frame the right area.
  useEffect(() => { propsRef.current.isolate = isolate; sceneRef.current?.applyIsolation(isolate); setSelected(null); }, [isolate]);

  // Apply each new view (or re-run), and overlay changes.
  useEffect(() => {
    propsRef.current.pendingView = view;
    propsRef.current.pendingKey = runKey;
    propsRef.current.pendingOverlay = overlay;
    sceneRef.current?.applyView(view, runKey, overlay);
  }, [view, runKey, overlay]);

  // Frame a requested area (a hall, a row) when its key changes.
  useEffect(() => {
    if (focus?.points?.length) sceneRef.current?.easeTo(focus.points);
    else if (focus) sceneRef.current?.easeTo(sceneRef.current.homePoints);
  }, [focus?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { sceneRef.current?.resize(); }, [insetLeft, insetRight]);
  useEffect(() => { setSelected(null); }, [facilityId, variant]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Full screen on this twin, or on a wrapper the caller names.
  useEffect(() => {
    const onChange = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFull = () => {
    const target = fullscreenTarget?.current ?? rootRef.current;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else target?.requestFullscreen?.();
  };

  const card = selected ? describeObject(facilityId, selected.kind, selected.id) : null;
  const hoverInfo = hover && !selected ? describeObject(facilityId, hover.kind, hover.id) : null;
  const callouts = [...externalCallouts, ...labels];

  return (
    <div ref={rootRef} className="absolute inset-0 overflow-hidden" data-testid="nexus-twin" style={{ background: SCENE.backdrop }}>
      <div ref={mountRef} className="absolute inset-0" />

      {/* Anchored callouts; positioned every frame by the render loop. */}
      <div ref={overlayRef} className="absolute inset-0 pointer-events-none" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        {callouts.map((c) => (
          <div key={c.id} data-callout data-priority={c.priority} data-reveal={c.revealAt ?? 0} data-ax={c.anchor.x} data-ay={c.anchor.y} data-az={c.anchor.z}
            className="absolute left-0 top-0" style={{ visibility: 'hidden', willChange: 'transform' }}>
            <div className="absolute -translate-x-1/2" style={{ bottom: LEADER_PX, left: 0 }}>
              {c.kind === 'label' ? (
                <div className="whitespace-nowrap rounded-md px-2.5 py-1" style={{ background: 'rgba(10,22,40,0.92)', border: `1px solid ${c.tone}66`, color: c.tone, fontSize: 12, fontWeight: 600, boxShadow: '0 4px 18px rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}>{c.text}</div>
              ) : (
                <button type="button" onClick={() => setSelected({ kind: c.kind, id: c.ref, anchor: c.anchor })}
                  className="pointer-events-auto text-left whitespace-nowrap rounded-lg px-3 py-2 hover:brightness-125 transition"
                  style={{ background: 'rgba(10,22,40,0.92)', border: '1px solid rgba(63,169,245,0.45)', boxShadow: '0 4px 24px rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}>
                  <span className="flex items-center justify-between gap-3">
                    <span style={{ color: '#E8EEF6', fontSize: 13, fontWeight: 700 }}>{c.title}</span>
                    <span className="flex items-center gap-1.5" style={{ color: STATUS_TONE[c.status], fontSize: 11.5, fontWeight: 600 }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: STATUS_TONE[c.status], boxShadow: `0 0 6px ${STATUS_TONE[c.status]}` }} />{c.status}
                    </span>
                  </span>
                  {c.lines.map((l) => <span key={l} className="block" style={{ color: '#9FB4CF', fontSize: 11.5, lineHeight: 1.35 }}>{l}</span>)}
                </button>
              )}
            </div>
            <div className="absolute" style={{ left: -0.5, bottom: 0, width: 1, height: LEADER_PX, background: 'linear-gradient(to top, rgba(63,169,245,0.9), rgba(63,169,245,0.25))' }} />
            <div className="absolute rounded-full" style={{ left: -3, bottom: -3, width: 6, height: 6, background: '#3FA9F5', boxShadow: '0 0 8px #3FA9F5' }} />
          </div>
        ))}

        {/* Click card: pinned to the clicked object. */}
        {card && (
          <div key={`${selected.kind}:${selected.id}`} data-callout data-pinned="1" data-priority={9999} data-ax={selected.anchor.x} data-ay={selected.anchor.y} data-az={selected.anchor.z}
            className="absolute left-0 top-0" style={{ visibility: 'hidden', willChange: 'transform' }}>
            <div className="absolute -translate-x-1/2 pointer-events-auto rounded-xl" role="dialog" aria-label={card.title}
              style={{ bottom: LEADER_PX, left: 0, width: 280, background: 'rgba(10,22,40,0.94)', border: `1px solid ${STATUS_TONE[card.status] ?? '#3FA9F5'}88`, boxShadow: '0 10px 40px rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', padding: '14px 16px' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{card.title}</p>
                  <p className="truncate" style={{ color: '#8FA8C8', fontSize: 11.5, marginTop: 2 }}>{card.subtitle}</p>
                </div>
                <span className="flex items-center gap-1.5 flex-shrink-0" style={{ color: STATUS_TONE[card.status] ?? '#E8EEF6', fontSize: 12, fontWeight: 700 }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: STATUS_TONE[card.status] ?? '#E8EEF6' }} />{card.status}
                </span>
              </div>
              <dl className="mt-3 space-y-1.5">
                {card.rows.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3" style={{ fontSize: 12.5 }}>
                    <dt style={{ color: '#9FB4CF' }}>{k}</dt>
                    <dd className="text-right" style={{ color: '#E8EEF6', fontWeight: 600 }}>{v}</dd>
                  </div>
                ))}
              </dl>
              {card.bar && (
                <div className="mt-3 h-1.5 rounded-full" style={{ background: 'rgba(143,168,200,0.2)' }} aria-label={`${card.bar.label} ${card.bar.pct}%`}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, card.bar.pct)}%`, background: card.bar.pct > 100 ? '#FF4D4D' : card.bar.pct >= 85 ? '#F5A623' : '#3FA9F5' }} />
                </div>
              )}
            </div>
            <div className="absolute" style={{ left: -0.5, bottom: 0, width: 1, height: LEADER_PX, background: STATUS_TONE[card.status] ?? '#3FA9F5' }} />
            <div className="absolute rounded-full" style={{ left: -4, bottom: -4, width: 8, height: 8, background: STATUS_TONE[card.status] ?? '#3FA9F5', boxShadow: `0 0 10px ${STATUS_TONE[card.status] ?? '#3FA9F5'}` }} />
          </div>
        )}
      </div>

      {hoverInfo && (
        <div className="absolute z-10 pointer-events-none rounded-lg px-2.5 py-1.5 shadow-xl max-w-[260px]" style={{ left: hover.x + 14, top: hover.y + 14, background: 'rgba(10,22,40,0.92)', border: '1px solid rgba(63,169,245,0.35)' }}>
          <p className="text-[11.5px] font-semibold text-white">{hoverInfo.title}</p>
          <p className="text-[10.5px]" style={{ color: '#9FB4CF' }}>{hoverInfo.subtitle}</p>
        </div>
      )}

      {showFullscreen && (
        <button type="button" onClick={toggleFull} aria-label={isFull ? 'Exit full screen' : 'Full screen'} title={isFull ? 'Exit full screen' : 'Full screen'}
          className={`absolute ${fullscreenAt === 'top-right' ? 'top-4' : 'bottom-4'} right-4 z-20 w-10 h-10 rounded-lg flex items-center justify-center transition hover:brightness-125`}
          style={{ background: 'rgba(10,22,40,0.85)', border: '1px solid rgba(63,169,245,0.45)', color: '#E8EEF6' }}>
          {isFull ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
      )}
    </div>
  );
}
