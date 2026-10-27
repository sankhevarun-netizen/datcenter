'use client';
import { useEffect, useRef } from 'react';

const STATUS_COLOR = {
  operational: 0x00a36c,
  unmonitored: 0x94a3b8,
  warning:     0xd4a017,
  critical:    0xdc2626,
};

const ZONES = [
  { id: 'power',    label: 'POWER',    x: -14, z: 0,    color: 0xf59e0b },
  { id: 'cooling',  label: 'COOLING',  x: 0,   z: -12,  color: 0x38bdf8 },
  { id: 'noc',      label: 'NOC',      x: 12,  z: 6,    color: 0xa78bfa },
  { id: 'soc',      label: 'SOC',      x: 12,  z: -6,   color: 0xf87171 },
  { id: 'security', label: 'SECURITY', x: 0,   z: 14,   color: 0x60a5fa },
  { id: 'racks',    label: 'RACKS',    x: 0,   z: 0,    color: 0x34d399 },
];

const ROW_LABELS = ['A', 'B', 'C', 'D'];

export default function InteriorModel3D({ dc, zoneHealth, onHotspotClick, onRackClick }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const onRackClickRef = useRef(onRackClick);
  onRackClickRef.current = onRackClick;

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    let animFrameId;
    let THREE_REF;
    let hotspotMeshes = [];
    let rackMeshes = [];

    const getUtilColor = (util) => {
      if (util > 85) return 0xdc2626;
      if (util > 70) return 0xd4a017;
      return 0x00a36c;
    };

    import('three').then((THREE) => {
      THREE_REF = THREE;
      const w = container.clientWidth;
      const h = container.clientHeight;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf0f4f8);
      scene.fog = new THREE.Fog(0xf0f4f8, 45, 130);

      // Camera
      const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
      const spherical = { radius: 36, theta: 0.7, phi: 0.85 };
      const updateCamera = () => {
        camera.position.set(
          spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta),
          spherical.radius * Math.cos(spherical.phi),
          spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta),
        );
        camera.lookAt(0, 1, 0);
      };
      updateCamera();

      // Lighting
      scene.add(new THREE.AmbientLight(0xffffff, 2.2));
      const sun = new THREE.DirectionalLight(0xffffff, 1.5);
      sun.position.set(15, 25, 10);
      sun.castShadow = true;
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0xc0d0e0, 0.4);
      fill.position.set(-10, 8, -10);
      scene.add(fill);

      // Floor
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 60),
        new THREE.MeshPhongMaterial({ color: 0xe2e8f0, shininess: 20 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);

      // Grid
      const grid = new THREE.GridHelper(60, 30, 0xb0bec5, 0xd0d8e0);
      scene.add(grid);

      // ─── RACK ZONE ───────────────────────────────────────────────────
      const utilPct = dc?.utilizationPercent ?? 70;
      const rows = 4, racksPerRow = 8;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < racksPerRow; col++) {
          const rackUtil = utilPct + (Math.random() - 0.5) * 20;
          const rackColor = getUtilColor(rackUtil);
          const rackId = `${dc?.id}-${ROW_LABELS[row]}${col + 1}`;

          // Rack body
          const rack = new THREE.Mesh(
            new THREE.BoxGeometry(0.9, 2.2, 0.7),
            new THREE.MeshPhongMaterial({ color: 0x1a2a3a, shininess: 40 }),
          );
          const rx = col * 1.2 - (racksPerRow * 1.2) / 2 + 0.6;
          const rz = row * 1.8 - (rows * 1.8) / 2;
          rack.position.set(rx, 1.1, rz);
          rack.castShadow = true;
          rack.userData = { rackId };
          rackMeshes.push(rack);
          scene.add(rack);

          // Wireframe
          const edges = new THREE.EdgesGeometry(rack.geometry);
          const wire = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x334466, transparent: true, opacity: 0.6 }));
          wire.position.copy(rack.position);
          scene.add(wire);

          // LED strips
          for (let u = 0; u < 5; u++) {
            const led = new THREE.Mesh(
              new THREE.BoxGeometry(0.85, 0.06, 0.05),
              new THREE.MeshBasicMaterial({ color: rackColor, transparent: true, opacity: 0.9 }),
            );
            led.position.set(rx, 0.2 + u * 0.4, rz + 0.38);
            scene.add(led);
          }
        }
      }

      // Cable trays above racks
      for (let row = 0; row < rows; row++) {
        const tray = new THREE.Mesh(
          new THREE.BoxGeometry(racksPerRow * 1.2 + 0.5, 0.08, 0.25),
          new THREE.MeshPhongMaterial({ color: 0x223344 }),
        );
        tray.position.set(0, 2.7, row * 1.8 - (rows * 1.8) / 2);
        scene.add(tray);
      }

      // ─── POWER ROOM (left side) ───────────────────────────────────────
      const powerStatus = zoneHealth?.power?.status || 'operational';
      const powerGlow = STATUS_COLOR[powerStatus] || STATUS_COLOR.operational;

      // UPS units (3 tall boxes)
      [-13.5, -14.5, -15.5].forEach((x, i) => {
        const ups = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 2.8, 1.2),
          new THREE.MeshPhongMaterial({ color: 0x1e3a1e, shininess: 60 }),
        );
        ups.position.set(x, 1.4, -2 + i * 2);
        ups.castShadow = true;
        scene.add(ups);
        // Status indicator stripe
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.05, 2.6, 0.08),
          new THREE.MeshBasicMaterial({ color: powerGlow }),
        );
        stripe.position.set(x + 0.38, 1.4, -2 + i * 2 - 0.58);
        scene.add(stripe);
      });

      // Generator cylinders (2)
      [-14, -15.2].forEach((x) => {
        const gen = new THREE.Mesh(
          new THREE.CylinderGeometry(0.5, 0.5, 1.8, 12),
          new THREE.MeshPhongMaterial({ color: 0x2a2a1a, shininess: 40 }),
        );
        gen.position.set(x, 0.9, 4);
        gen.castShadow = true;
        scene.add(gen);
      });

      // ─── COOLING ZONE (rear) ─────────────────────────────────────────
      const coolingStatus = zoneHealth?.cooling?.status || 'operational';
      const coolingGlow = STATUS_COLOR[coolingStatus] || STATUS_COLOR.operational;

      [-4, -1, 2, 5].forEach((x) => {
        // CRAH unit body
        const crah = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 2.0, 0.9),
          new THREE.MeshPhongMaterial({ color: 0x0d2035, shininess: 50 }),
        );
        crah.position.set(x, 1.0, -13);
        crah.castShadow = true;
        scene.add(crah);
        // Fan disc on top
        const fan = new THREE.Mesh(
          new THREE.CylinderGeometry(0.6, 0.6, 0.12, 16),
          new THREE.MeshBasicMaterial({ color: coolingGlow, transparent: true, opacity: 0.8 }),
        );
        fan.position.set(x, 2.12, -13);
        scene.add(fan);
        // Blue glow stripe
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(2.1, 0.06, 0.05),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 }),
        );
        stripe.position.set(x, 1.8, -12.56);
        scene.add(stripe);
      });

      // ─── NOC AREA (front-left) ────────────────────────────────────────
      const nocStatus = zoneHealth?.noc?.status || 'operational';
      const nocGlow = STATUS_COLOR[nocStatus] || STATUS_COLOR.operational;

      [10, 12, 14].forEach((x, i) => {
        // Desk
        const desk = new THREE.Mesh(
          new THREE.BoxGeometry(1.6, 0.1, 0.7),
          new THREE.MeshPhongMaterial({ color: 0x1a2a3a }),
        );
        desk.position.set(x, 0.75, 7);
        scene.add(desk);
        // Monitor
        const monitor = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 0.7, 0.05),
          new THREE.MeshBasicMaterial({ color: nocGlow, transparent: true, opacity: 0.85 }),
        );
        monitor.position.set(x, 1.35, 6.68);
        scene.add(monitor);
        // Monitor frame
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(1.25, 0.75, 0.04),
          new THREE.MeshPhongMaterial({ color: 0x0a1020 }),
        );
        frame.position.set(x, 1.35, 6.66);
        scene.add(frame);
      });

      // ─── SOC AREA (front-right) ───────────────────────────────────────
      const socStatus = zoneHealth?.soc?.status || 'operational';
      const socGlow = STATUS_COLOR[socStatus] || STATUS_COLOR.operational;

      [10, 12, 14].forEach((x) => {
        const desk = new THREE.Mesh(
          new THREE.BoxGeometry(1.6, 0.1, 0.7),
          new THREE.MeshPhongMaterial({ color: 0x1a2a3a }),
        );
        desk.position.set(x, 0.75, -5);
        scene.add(desk);
        const monitor = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 0.7, 0.05),
          new THREE.MeshBasicMaterial({ color: socGlow, transparent: true, opacity: 0.85 }),
        );
        monitor.position.set(x, 1.35, -5.32);
        scene.add(monitor);
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(1.25, 0.75, 0.04),
          new THREE.MeshPhongMaterial({ color: 0x0a1020 }),
        );
        frame.position.set(x, 1.35, -5.34);
        scene.add(frame);
      });

      // ─── SECURITY DESK (entrance) ─────────────────────────────────────
      const secStatus = zoneHealth?.security?.status || 'operational';
      const secGlow = STATUS_COLOR[secStatus] || STATUS_COLOR.operational;

      const secDesk = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 0.9, 0.8),
        new THREE.MeshPhongMaterial({ color: 0x1a2030 }),
      );
      secDesk.position.set(0, 0.45, 13.5);
      scene.add(secDesk);
      const secMonitor = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.55, 0.05),
        new THREE.MeshBasicMaterial({ color: secGlow, transparent: true, opacity: 0.85 }),
      );
      secMonitor.position.set(0, 1.15, 13.1);
      scene.add(secMonitor);
      // Camera dome above entrance
      const camDome = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshPhongMaterial({ color: 0x0a0a0a, shininess: 80 }),
      );
      camDome.position.set(0, 4.5, 12);
      scene.add(camDome);

      // ─── ZONE LABELS (canvas sprites) ────────────────────────────────
      const makeLabel = (text, color) => {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(10,18,32,0.0)';
        ctx.fillRect(0, 0, 256, 64);
        ctx.font = 'bold 22px "JetBrains Mono", monospace';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 32);
        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(5, 1.25, 1);
        return sprite;
      };

      const labelDefs = [
        { text: '⚡ POWER',    color: '#f59e0b', x: -14, y: 4.0, z: 0 },
        { text: '❄ COOLING',  color: '#38bdf8', x: 0,   y: 3.5, z: -13 },
        { text: '◉ NOC',      color: '#a78bfa', x: 12,  y: 3.5, z: 7 },
        { text: '◉ SOC',      color: '#f87171', x: 12,  y: 3.5, z: -5 },
        { text: '🔒 SECURITY', color: '#60a5fa', x: 0,   y: 3.5, z: 13.5 },
        { text: '▦ RACKS',    color: '#34d399', x: 0,   y: 5.5, z: 0 },
      ];
      labelDefs.forEach(({ text, color, x, y, z }) => {
        const s = makeLabel(text, color);
        s.position.set(x, y, z);
        scene.add(s);
      });

      // ─── HOTSPOT SPHERES ──────────────────────────────────────────────
      hotspotMeshes = ZONES.map((zone) => {
        const status = zoneHealth?.[zone.id]?.status || 'operational';
        const col = STATUS_COLOR[status] || STATUS_COLOR.operational;
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.35, 16, 12),
          new THREE.MeshBasicMaterial({ color: col }),
        );
        sphere.position.set(zone.x, 4.2, zone.z);
        sphere.userData = { zoneId: zone.id };
        scene.add(sphere);

        // Outer glow ring
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.5, 0.06, 8, 24),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.45 }),
        );
        ring.position.copy(sphere.position);
        ring.userData = { isRing: true };
        scene.add(ring);

        return { sphere, ring, col };
      });

      sceneRef.current = { renderer, scene, camera };

      // ─── RAYCASTER ────────────────────────────────────────────────────
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      const handleClick = (e) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        // Check hotspot spheres first
        const hotspotHits = raycaster.intersectObjects(hotspotMeshes.map((h) => h.sphere));
        if (hotspotHits.length > 0) {
          const { zoneId } = hotspotHits[0].object.userData;
          onHotspotClick?.(zoneId, { x: e.clientX - rect.left, y: e.clientY - rect.top });
          return;
        }

        // Then check rack bodies
        const rackHits = raycaster.intersectObjects(rackMeshes);
        if (rackHits.length > 0) {
          const { rackId } = rackHits[0].object.userData;
          if (rackId) onRackClickRef.current?.(rackId);
        }
      };
      renderer.domElement.addEventListener('click', handleClick);

      // ─── ORBIT CONTROLS ───────────────────────────────────────────────
      let dragging = false, autoRotate = true;
      let lastX = 0, lastY = 0;
      const onMouseDown = (e) => { dragging = true; autoRotate = false; lastX = e.clientX; lastY = e.clientY; };
      const onMouseUp = () => { dragging = false; };
      const onMouseMove = (e) => {
        if (!dragging) return;
        spherical.theta -= (e.clientX - lastX) * 0.008;
        spherical.phi = Math.max(0.2, Math.min(1.4, spherical.phi + (e.clientY - lastY) * 0.006));
        lastX = e.clientX; lastY = e.clientY;
        updateCamera();
      };
      const onWheel = (e) => {
        spherical.radius = Math.max(14, Math.min(55, spherical.radius + e.deltaY * 0.04));
        updateCamera();
        e.preventDefault();
      };
      renderer.domElement.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('mousemove', onMouseMove);
      renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

      // ─── ANIMATION LOOP ───────────────────────────────────────────────
      let t = 0;
      const animate = () => {
        animFrameId = requestAnimationFrame(animate);
        t += 0.02;
        if (autoRotate) { spherical.theta += 0.003; updateCamera(); }
        hotspotMeshes.forEach(({ sphere, ring }) => {
          const pulse = 1 + Math.sin(t * 2) * 0.12;
          sphere.scale.setScalar(pulse);
          ring.rotation.y = t * 0.5;
          ring.material.opacity = 0.3 + Math.sin(t * 2) * 0.2;
        });
        renderer.render(scene, camera);
      };
      animate();

      // ─── RESIZE ───────────────────────────────────────────────────────
      const onResize = () => {
        const nw = container.clientWidth, nh = container.clientHeight;
        renderer.setSize(nw, nh);
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', onResize);

      return () => {
        cancelAnimationFrame(animFrameId);
        renderer.domElement.removeEventListener('click', handleClick);
        renderer.domElement.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('mousemove', onMouseMove);
        renderer.domElement.removeEventListener('wheel', onWheel);
        window.removeEventListener('resize', onResize);
        renderer.dispose();
        if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      };
    });

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [dc?.id, dc?.utilizationPercent, zoneHealth]);

  return (
    <div ref={mountRef} className="w-full h-full relative">
      {/* Legend overlay */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1 pointer-events-none">
        {[
          { color: '#00B0A0', label: '< 70% utilisation' },
          { color: '#E87722', label: '70–85% utilisation' },
          { color: '#C8102E', label: '> 85% utilisation' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
            <span className="text-[10px] text-[#475569] font-mono">{label}</span>
          </div>
        ))}
      </div>
      <div className="absolute bottom-4 right-4 text-[10px] text-[#94a3b8] pointer-events-none font-mono">
        Drag to rotate · Scroll to zoom
      </div>
    </div>
  );
}
