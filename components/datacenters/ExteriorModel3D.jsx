'use client';
import { useEffect, useRef } from 'react';

const STATUS_COLOR = {
  operational: 0x00a36c,
  unmonitored: 0x94a3b8,
  warning:     0xd4a017,
  critical:    0xdc2626,
};

// Security hotspot positions around the building exterior
const SECURITY_POINTS = [
  { id: 'security', label: 'Main Entrance',      x: 0,   y: 3.5, z: 12,   camPos: [3, 4, 11.5] },
  { id: 'security', label: 'Perimeter NW',        x: -14, y: 4.5, z: -10,  camPos: [-13.5, 5, -10] },
  { id: 'security', label: 'Perimeter NE',        x: 14,  y: 4.5, z: -10,  camPos: [13.5, 5, -10] },
  { id: 'security', label: 'Perimeter South',     x: 0,   y: 4.5, z: -14,  camPos: [0.5, 5, -13.5] },
  { id: 'security', label: 'Loading Dock',        x: -12, y: 3.0, z: 10,   camPos: [-11.5, 3.5, 9.5] },
];

export default function ExteriorModel3D({ dc, zoneHealth, onHotspotClick }) {
  const mountRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    let animFrameId;
    let hotspotMeshes = [];

    import('three').then((THREE) => {
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
      scene.background = new THREE.Color(0xdce8f5);
      scene.fog = new THREE.Fog(0xdce8f5, 55, 140);

      // Camera
      const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 200);
      const spherical = { radius: 50, theta: 0.5, phi: 0.75 };
      const updateCamera = () => {
        camera.position.set(
          spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta),
          spherical.radius * Math.cos(spherical.phi),
          spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta),
        );
        camera.lookAt(0, 3, 0);
      };
      updateCamera();

      // Lighting
      scene.add(new THREE.AmbientLight(0xffffff, 2.0));
      const sun = new THREE.DirectionalLight(0xffffff, 1.0);
      sun.position.set(20, 30, 15);
      sun.castShadow = true;
      sun.shadow.mapSize.width = 1024;
      sun.shadow.mapSize.height = 1024;
      scene.add(sun);
      // Soft neutral fill light (daytime)
      const accent = new THREE.DirectionalLight(0xe8f0f8, 0.3);
      accent.position.set(-15, 10, -5);
      scene.add(accent);
      // Soft warm light near entrance
      const secLight = new THREE.PointLight(0xffdddd, 0.4, 20);
      secLight.position.set(0, 8, 12);
      scene.add(secLight);

      // Ground / Compound
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100),
        new THREE.MeshPhongMaterial({ color: 0xc8d4dc, shininess: 5 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      // Tarmac apron around building
      const apron = new THREE.Mesh(
        new THREE.PlaneGeometry(42, 36),
        new THREE.MeshPhongMaterial({ color: 0xb8c8d4 }),
      );
      apron.rotation.x = -Math.PI / 2;
      apron.position.y = 0.01;
      scene.add(apron);

      // ─── MAIN BUILDING ────────────────────────────────────────────────
      // Base structure (concrete grey)
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(28, 10, 22),
        new THREE.MeshPhongMaterial({ color: 0x1a2535, shininess: 30 }),
      );
      building.position.set(0, 5, 0);
      building.castShadow = true;
      building.receiveShadow = true;
      scene.add(building);

      // Raised roof section (mechanical penthouse)
      const roofPenthouse = new THREE.Mesh(
        new THREE.BoxGeometry(20, 3, 14),
        new THREE.MeshPhongMaterial({ color: 0x141e2e }),
      );
      roofPenthouse.position.set(0, 11.5, -1);
      roofPenthouse.castShadow = true;
      scene.add(roofPenthouse);

      // Glass facade panels (front face, semi-transparent)
      const glassMat = new THREE.MeshPhongMaterial({
        color: 0x0066aa,
        transparent: true,
        opacity: 0.35,
        shininess: 120,
        specular: new THREE.Color(0x88ccff),
      });
      [-8, -2, 4, 10].forEach((x) => {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(4.5, 5, 0.08), glassMat);
        panel.position.set(x, 5.5, 11.04);
        scene.add(panel);
      });

      // Blue accent LED strip along building base
      const ledStrip = new THREE.Mesh(
        new THREE.BoxGeometry(28, 0.08, 0.06),
        new THREE.MeshBasicMaterial({ color: 0x0077cc }),
      );
      ledStrip.position.set(0, 0.15, 11.05);
      scene.add(ledStrip);

      // Blue accent LED strip along top
      const ledTop = new THREE.Mesh(
        new THREE.BoxGeometry(28.4, 0.08, 0.06),
        new THREE.MeshBasicMaterial({ color: 0x0055aa }),
      );
      ledTop.position.set(0, 10.05, 11.05);
      scene.add(ledTop);

      // ─── COOLING TOWERS on roof ────────────────────────────────────────
      [[-8, -2], [-8, 4], [8, -2], [8, 4]].forEach(([x, z]) => {
        const tower = new THREE.Mesh(
          new THREE.CylinderGeometry(1.2, 1.4, 3.5, 12),
          new THREE.MeshPhongMaterial({ color: 0x0f1d2d }),
        );
        tower.position.set(x, 13.75, z);
        tower.castShadow = true;
        scene.add(tower);
        // Fan disc on tower
        const fan = new THREE.Mesh(
          new THREE.CylinderGeometry(0.9, 0.9, 0.12, 12),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 }),
        );
        fan.position.set(x, 15.56, z);
        scene.add(fan);
      });

      // ─── PERIMETER FENCE ──────────────────────────────────────────────
      const fenceMat = new THREE.LineBasicMaterial({ color: 0x8ca0b0, transparent: true, opacity: 0.8 });
      const fenceCorners = [[-22, -18], [22, -18], [22, 18], [-22, 18], [-22, -18]];
      for (let i = 0; i < fenceCorners.length - 1; i++) {
        const [x1, z1] = fenceCorners[i];
        const [x2, z2] = fenceCorners[i + 1];
        // Fence posts (small boxes)
        const steps = Math.ceil(Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2) / 3);
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const post = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 3, 0.1),
            new THREE.MeshPhongMaterial({ color: 0x1a3050 }),
          );
          post.position.set(x1 + (x2 - x1) * t, 1.5, z1 + (z2 - z1) * t);
          scene.add(post);
        }
      }

      // ─── GUARD BOOTH (near entrance) ─────────────────────────────────
      const booth = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 3, 2.5),
        new THREE.MeshPhongMaterial({ color: 0x0d1a28 }),
      );
      booth.position.set(-6, 1.5, 16);
      booth.castShadow = true;
      scene.add(booth);
      // Booth window
      const boothWindow = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 1.2, 0.06),
        new THREE.MeshBasicMaterial({ color: 0x003366, transparent: true, opacity: 0.5 }),
      );
      boothWindow.position.set(-6, 1.8, 17.28);
      scene.add(boothWindow);

      // Entrance barrier (horizontal pole)
      const barrier = new THREE.Mesh(
        new THREE.BoxGeometry(4, 0.1, 0.1),
        new THREE.MeshBasicMaterial({ color: 0xcc2200 }),
      );
      barrier.position.set(-3.5, 1.5, 18);
      scene.add(barrier);

      // ─── CCTV CAMERAS at corners ─────────────────────────────────────
      const cameraMat = new THREE.MeshPhongMaterial({ color: 0x0a0a0a, shininess: 80 });
      [[-14, -11], [14, -11], [-14, 11], [14, 11]].forEach(([x, z]) => {
        // Pole
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 6), cameraMat);
        pole.position.set(x, 2.5, z);
        scene.add(pole);
        // Camera head
        const cam = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 8), cameraMat);
        cam.rotation.z = Math.PI / 2;
        cam.position.set(x + 0.35, 5.1, z);
        scene.add(cam);
        // Camera red indicator
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.07, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xff0000 }),
        );
        dot.position.set(x + 0.55, 5.1, z);
        scene.add(dot);
      });

      // ─── ENTRANCE SIGNAGE (KPMG blue glow) ────────────────────────────
      const signGlow = new THREE.PointLight(0x0055cc, 1.2, 10);
      signGlow.position.set(0, 9, 12);
      scene.add(signGlow);

      // ─── HOTSPOT SPHERES (security zone) ─────────────────────────────
      const secStatus = zoneHealth?.security?.status || 'operational';
      const secCol = STATUS_COLOR[secStatus] || STATUS_COLOR.operational;

      hotspotMeshes = SECURITY_POINTS.map((pt) => {
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.4, 14, 10),
          new THREE.MeshBasicMaterial({ color: secCol }),
        );
        sphere.position.set(pt.x, pt.y, pt.z);
        sphere.userData = { zoneId: pt.id, label: pt.label };
        scene.add(sphere);

        // Pulsing ring
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.62, 0.07, 8, 20),
          new THREE.MeshBasicMaterial({ color: secCol, transparent: true, opacity: 0.4 }),
        );
        ring.position.copy(sphere.position);
        scene.add(ring);

        // Vertical light beam
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 3, 6),
          new THREE.MeshBasicMaterial({ color: secCol, transparent: true, opacity: 0.25 }),
        );
        beam.position.set(pt.x, pt.y - 1.5, pt.z);
        scene.add(beam);

        return { sphere, ring };
      });

      // ─── RAYCASTER ────────────────────────────────────────────────────
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      const handleClick = (e) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(hotspotMeshes.map((h) => h.sphere));
        if (hits.length > 0) {
          const { zoneId } = hits[0].object.userData;
          onHotspotClick?.(zoneId, { x: e.clientX - rect.left, y: e.clientY - rect.top });
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
        spherical.theta -= (e.clientX - lastX) * 0.007;
        spherical.phi = Math.max(0.3, Math.min(1.3, spherical.phi + (e.clientY - lastY) * 0.005));
        lastX = e.clientX; lastY = e.clientY;
        updateCamera();
      };
      const onWheel = (e) => {
        spherical.radius = Math.max(25, Math.min(80, spherical.radius + e.deltaY * 0.06));
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
        t += 0.015;
        if (autoRotate) { spherical.theta += 0.002; updateCamera(); }
        hotspotMeshes.forEach(({ sphere, ring }) => {
          const pulse = 1 + Math.sin(t * 2.5) * 0.15;
          sphere.scale.setScalar(pulse);
          ring.rotation.y = t * 0.4;
          ring.material.opacity = 0.25 + Math.sin(t * 2.5) * 0.2;
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
  }, [dc?.id, zoneHealth]);

  return (
    <div ref={mountRef} className="w-full h-full relative">
      <div className="absolute bottom-4 left-4 flex flex-col gap-1 pointer-events-none">
        <div className="text-[10px] text-[#005EB8] font-mono font-semibold mb-1">SECURITY STATUS</div>
        {[
          { color: '#00B0A0', label: 'All systems operational' },
          { color: '#E87722', label: 'Warning — review required' },
          { color: '#C8102E', label: 'Critical — action needed' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-[10px] text-[#475569] font-mono">{label}</span>
          </div>
        ))}
      </div>
      <div className="absolute bottom-4 right-4 text-[10px] text-[#94a3b8] pointer-events-none font-mono">
        Drag to rotate · Scroll to zoom · Click markers for details
      </div>
    </div>
  );
}
