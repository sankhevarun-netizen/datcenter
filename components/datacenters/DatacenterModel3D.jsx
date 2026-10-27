'use client';
import { useEffect, useRef } from 'react';

export default function DatacenterModel3D({ dc, infraData }) {
  const mountRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) return;
    let animFrameId;
    let autoRotate = true;

    // Dynamically import Three.js only on client
    import('three').then(THREE => {
      const { WebGLRenderer, Scene, PerspectiveCamera, BoxGeometry, MeshPhongMaterial, Mesh,
        DirectionalLight, AmbientLight, GridHelper, Group, Color, Fog, PlaneGeometry,
        MeshBasicMaterial, EdgesGeometry, LineBasicMaterial, LineSegments } = THREE;

      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;

      const renderer = new WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled = true;
      mountRef.current.appendChild(renderer.domElement);

      const scene = new Scene();
      scene.fog = new Fog(0x0d1428, 40, 120);

      const camera = new PerspectiveCamera(45, w / h, 0.1, 200);
      camera.position.set(18, 14, 22);
      camera.lookAt(0, 0, 0);

      // Lights
      scene.add(new AmbientLight(0x304060, 1.2));
      const dirLight = new DirectionalLight(0xffffff, 1.4);
      dirLight.position.set(10, 20, 10);
      dirLight.castShadow = true;
      scene.add(dirLight);
      const dirLight2 = new DirectionalLight(0x0077c8, 0.6);
      dirLight2.position.set(-10, 8, -5);
      scene.add(dirLight2);

      // Floor
      const floorGeo = new PlaneGeometry(40, 40);
      const floorMat = new MeshBasicMaterial({ color: 0x0a1525, transparent: true, opacity: 0.8 });
      const floor = new Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.05;
      scene.add(floor);

      const grid = new GridHelper(40, 20, 0x1a3a5c, 0x1a3a5c);
      grid.position.y = 0;
      scene.add(grid);

      // Rack rows
      const utilPct = dc?.utilizationPercent || 75;
      const rows = 4;
      const racksPerRow = 8;
      const rackGroup = new Group();

      const getColor = (util) => {
        if (util > 85) return 0xdc2626;
        if (util > 70) return 0xd4a017;
        return 0x00a36c;
      };

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < racksPerRow; col++) {
          // Vary utilization slightly per rack
          const rackUtil = utilPct + (Math.random() - 0.5) * 20;
          const color = getColor(rackUtil);

          // Rack body
          const rackGeo = new BoxGeometry(0.9, 2.2, 0.7);
          const rackMat = new MeshPhongMaterial({ color: 0x1a2a3a, specular: 0x334466, shininess: 60 });
          const rack = new Mesh(rackGeo, rackMat);
          rack.position.set(col * 1.2 - (racksPerRow * 1.2) / 2 + 0.6, 1.1, row * 1.8 - rows * 1.8 / 2);
          rack.castShadow = true;
          rackGroup.add(rack);

          // LED strip on front
          const ledGeo = new BoxGeometry(0.85, 0.06, 0.05);
          const ledMat = new MeshBasicMaterial({ color });
          for (let u = 0; u < 5; u++) {
            const led = new Mesh(ledGeo, ledMat.clone());
            led.material.color.setHex(color);
            led.material.transparent = true;
            led.material.opacity = 0.9;
            led.position.set(
              col * 1.2 - (racksPerRow * 1.2) / 2 + 0.6,
              0.2 + u * 0.4,
              row * 1.8 - rows * 1.8 / 2 + 0.38
            );
            rackGroup.add(led);
          }

          // Edge wireframe
          const edges = new EdgesGeometry(rackGeo);
          const edgeMat = new LineBasicMaterial({ color: 0x334466, transparent: true, opacity: 0.4 });
          const wireframe = new LineSegments(edges, edgeMat);
          wireframe.position.copy(rack.position);
          rackGroup.add(wireframe);
        }
      }
      scene.add(rackGroup);

      // Ceiling cable trays (simple bars above racks)
      for (let row = 0; row < rows; row++) {
        const trayGeo = new BoxGeometry(racksPerRow * 1.2, 0.08, 0.12);
        const trayMat = new MeshPhongMaterial({ color: 0x334466 });
        const tray = new Mesh(trayGeo, trayMat);
        tray.position.set(0, 3.2, row * 1.8 - rows * 1.8 / 2);
        scene.add(tray);
      }

      // Mouse orbit
      let isDragging = false;
      let prevMouse = { x: 0, y: 0 };
      let spherical = { theta: 0.8, phi: 0.9, radius: 30 };

      const onMouseDown = (e) => { isDragging = true; autoRotate = false; prevMouse = { x: e.clientX, y: e.clientY }; };
      const onMouseUp = () => { isDragging = false; };
      const onMouseMove = (e) => {
        if (!isDragging) return;
        const dx = (e.clientX - prevMouse.x) * 0.008;
        const dy = (e.clientY - prevMouse.y) * 0.006;
        spherical.theta -= dx;
        spherical.phi = Math.max(0.2, Math.min(1.4, spherical.phi + dy));
        prevMouse = { x: e.clientX, y: e.clientY };
      };
      const onWheel = (e) => {
        spherical.radius = Math.max(12, Math.min(50, spherical.radius + e.deltaY * 0.04));
        autoRotate = false;
      };

      renderer.domElement.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mouseup', onMouseUp);
      renderer.domElement.addEventListener('mousemove', onMouseMove);
      renderer.domElement.addEventListener('wheel', onWheel);

      const updateCamera = () => {
        const x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
        const y = spherical.radius * Math.cos(spherical.phi);
        const z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
        camera.position.set(x, y, z);
        camera.lookAt(0, 1, 0);
      };

      const animate = () => {
        animFrameId = requestAnimationFrame(animate);
        if (autoRotate) spherical.theta += 0.003;
        updateCamera();
        renderer.render(scene, camera);
      };
      animate();

      // Resize
      const handleResize = () => {
        if (!mountRef.current) return;
        const nw = mountRef.current.clientWidth;
        const nh = mountRef.current.clientHeight;
        renderer.setSize(nw, nh);
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', handleResize);

      return () => {
        cancelAnimationFrame(animFrameId);
        renderer.domElement.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mouseup', onMouseUp);
        renderer.domElement.removeEventListener('mousemove', onMouseMove);
        renderer.domElement.removeEventListener('wheel', onWheel);
        window.removeEventListener('resize', handleResize);
        renderer.dispose();
        if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
          mountRef.current.removeChild(renderer.domElement);
        }
      };
    });

    return () => cancelAnimationFrame(animFrameId);
  }, [dc?.id]);

  return (
    <div ref={mountRef} className="w-full h-full" style={{ background: 'linear-gradient(135deg, #0d1428 0%, #0a1e38 100%)' }}>
      <div className="absolute bottom-3 left-3 z-10 text-white/40 text-[10px]">
        Drag to rotate · Scroll to zoom
      </div>
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-[10px] text-white/60"><span className="w-2 h-2 rounded-sm bg-[#00B0A0] inline-block" /> &lt;70%</div>
        <div className="flex items-center gap-1.5 text-[10px] text-white/60"><span className="w-2 h-2 rounded-sm bg-[#E87722] inline-block" /> 70–85%</div>
        <div className="flex items-center gap-1.5 text-[10px] text-white/60"><span className="w-2 h-2 rounded-sm bg-[#C8102E] inline-block" /> &gt;85%</div>
      </div>
    </div>
  );
}
