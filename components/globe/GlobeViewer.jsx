'use client';
import React, { useRef, useMemo, Suspense, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { CameraControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import Link from 'next/link';
import { ArrowRight, Globe } from 'lucide-react';
import { getCountryColor } from '@/utils/helpers';

const RADIUS = 2;
const EARTH_TEXTURE = 'https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg';
const BUMP_TEXTURE  = 'https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png';

const DC_HUBS = [
  { city: 'Ashburn',        lat:  38.88, lng:  -77.09 },
  { city: 'Chicago',        lat:  41.88, lng:  -87.63 },
  { city: 'New York',       lat:  40.71, lng:  -74.01 },
  { city: 'Dallas',         lat:  32.78, lng:  -96.80 },
  { city: 'Silicon Valley', lat:  37.39, lng: -122.08 },
  { city: 'Seattle',        lat:  47.61, lng: -122.33 },
  { city: 'Toronto',        lat:  43.65, lng:  -79.38 },
  { city: 'São Paulo',      lat: -23.55, lng:  -46.63 },
  { city: 'London',         lat:  51.51, lng:   -0.13 },
  { city: 'Frankfurt',      lat:  50.11, lng:    8.68 },
  { city: 'Amsterdam',      lat:  52.37, lng:    4.90 },
  { city: 'Paris',          lat:  48.86, lng:    2.35 },
  { city: 'Stockholm',      lat:  59.33, lng:   18.07 },
  { city: 'Dubai',          lat:  25.20, lng:   55.27 },
  { city: 'Johannesburg',   lat: -26.20, lng:   28.05 },
  { city: 'Mumbai',         lat:  19.08, lng:   72.88 },
  { city: 'Chennai',        lat:  13.08, lng:   80.27 },
  { city: 'Singapore',      lat:   1.35, lng:  103.82 },
  { city: 'Tokyo',          lat:  35.68, lng:  139.65 },
  { city: 'Hong Kong',      lat:  22.32, lng:  114.17 },
  { city: 'Sydney',         lat: -33.87, lng:  151.21 },
  { city: 'Melbourne',      lat: -37.81, lng:  144.96 },
  { city: 'Seoul',          lat:  37.57, lng:  126.98 },
  { city: 'Beijing',        lat:  39.90, lng:  116.41 },
  { city: 'Shanghai',       lat:  31.23, lng:  121.47 },
];

function latLngToVector3(lat, lng, r) {
  const phi   = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(r * Math.sin(phi) * Math.cos(theta)),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta),
  );
}

function GlobeMesh() {
  const [earthTex, bumpTex] = useTexture([EARTH_TEXTURE, BUMP_TEXTURE]);

  useMemo(() => {
    if (earthTex) { earthTex.colorSpace = THREE.SRGBColorSpace; earthTex.anisotropy = 16; }
    if (bumpTex)  { bumpTex.anisotropy = 8; }
  }, [earthTex, bumpTex]);

  const sphereGeo = useMemo(() => new THREE.SphereGeometry(RADIUS, 64, 64), []);
  const wfGeo     = useMemo(() => new THREE.SphereGeometry(RADIUS * 1.002, 32, 16), []);

  return (
    <group>
      <mesh geometry={sphereGeo}>
        <meshStandardMaterial map={earthTex} bumpMap={bumpTex} bumpScale={0.05} roughness={0.7} metalness={0} />
      </mesh>
      <mesh geometry={wfGeo}>
        <meshBasicMaterial color="#4a9eff" wireframe transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

function LabelOverlay({ labelCanvasRef, hubs, selectedId }) {
  const { camera, size } = useThree();

  useFrame(() => {
    const canvas = labelCanvasRef.current;
    if (!canvas) return;

    const dpr  = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = size.width;
    const cssH = size.height;

    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width        = Math.round(cssW * dpr);
      canvas.height       = Math.round(cssH * dpr);
      canvas.style.width  = cssW + 'px';
      canvas.style.height = cssH + 'px';
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    const hubsToUse = hubs || DC_HUBS;
    const camNorm = camera.position.clone().normalize();

    const visible = hubsToUse
      .map(hub => {
        const lat = hub.lat ?? hub.latitude;
        const lng = hub.lng ?? hub.longitude;
        if (lat == null || lng == null) return null;

        const worldPos = latLngToVector3(lat, lng, RADIUS);
        const normal   = worldPos.clone().normalize();
        const dot      = normal.dot(camNorm);
        if (dot < 0.1) return null;

        const projected = worldPos.clone().project(camera);
        if (projected.z >= 1) return null;

        const sx = (projected.x * 0.5 + 0.5) * cssW;
        const sy = (-projected.y * 0.5 + 0.5) * cssH;
        return { sx, sy, z: dot, hub };
      })
      .filter(Boolean);

    // Selected hub always wins placement; otherwise prefer whichever faces the camera most.
    visible.sort((a, b) => {
      const aSel = selectedId && a.hub.id === selectedId ? 1 : 0;
      const bSel = selectedId && b.hub.id === selectedId ? 1 : 0;
      if (aSel !== bSel) return bSel - aSel;
      return b.z - a.z;
    });

    // Suppress labels whose anchor points are too close on-screen to one
    // already placed, so dense clusters (e.g. nearby facilities) don't
    // render overlapping text.
    const MIN_LABEL_DIST = 46;
    const placed = [];
    const toShow = [];
    for (const v of visible) {
      const tooClose = placed.some(p => {
        const ddx = p.sx - v.sx;
        const ddy = p.sy - v.sy;
        return Math.sqrt(ddx * ddx + ddy * ddy) < MIN_LABEL_DIST;
      });
      if (tooClose) continue;
      placed.push(v);
      toShow.push(v);
      if (toShow.length >= 12) break;
    }

    const cx = cssW / 2;
    const cy = cssH / 2;

    toShow.forEach(({ sx, sy, hub }) => {
      const dxRaw = sx - cx;
      const dyRaw = sy - cy;
      const len   = Math.sqrt(dxRaw * dxRaw + dyRaw * dyRaw) || 1;
      const dx    = dxRaw / len;
      const dy    = dyRaw / len;
      const ex    = sx + dx * 22;
      const ey    = sy + dy * 22;

      const isSelected = selectedId && hub.id === selectedId;

      ctx.beginPath();
      ctx.strokeStyle = isSelected ? 'rgba(0, 119, 200, 0.9)' : 'rgba(0, 119, 200, 0.55)';
      ctx.lineWidth   = isSelected ? 1.2 : 0.8;
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      ctx.font         = `${isSelected ? 'bold' : 'bold'} ${isSelected ? 10 : 9}px "DM Sans", system-ui, sans-serif`;
      ctx.textAlign    = dx >= 0 ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      ctx.shadowColor  = 'rgba(1, 13, 32, 0.95)';
      ctx.shadowBlur   = 5;
      ctx.fillStyle    = isSelected ? 'rgba(0, 185, 255, 1.0)' : 'rgba(255, 255, 255, 0.90)';
      ctx.fillText(hub.city || hub.name, ex + dx * 3, ey);
      ctx.shadowBlur   = 0;
    });

    ctx.restore();
  });

  return null;
}

// Curated DC markers — individual meshes for click/hover
function DCMarkers({ datacenters, selectedId, onMarkerClick, setHoveredDC, setHoverPos, getMarkerColor }) {
  const curatedGeo = useMemo(() => new THREE.SphereGeometry(0.038, 10, 10), []);
  const glowGeo    = useMemo(() => new THREE.SphereGeometry(0.038, 10, 10), []);

  if (!datacenters?.length) return null;

  return (
    <group>
      {datacenters.map((dc) => {
        if (!dc.coordinates?.latitude || !dc.coordinates?.longitude) return null;
        const pos = latLngToVector3(dc.coordinates.latitude, dc.coordinates.longitude, RADIUS + 0.045);
        const color = getMarkerColor ? getMarkerColor(dc) : getCountryColor(dc.country);
        const isSelected = selectedId === dc.id;

        return (
          <group key={dc.id} position={[pos.x, pos.y, pos.z]}>
            <mesh
              geometry={curatedGeo}
              scale={isSelected ? [1.5, 1.5, 1.5] : [1, 1, 1]}
              onClick={(e) => { e.stopPropagation(); onMarkerClick?.(dc); }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredDC(dc);
                setHoverPos({ x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
                if (typeof document !== 'undefined') document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                setHoveredDC(null);
                if (typeof document !== 'undefined') document.body.style.cursor = 'default';
              }}
              onPointerMove={(e) => {
                setHoverPos({ x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
              }}
            >
              <meshStandardMaterial color={color} roughness={0.25} metalness={0.3} />
            </mesh>
            {isSelected && (
              <mesh geometry={glowGeo} scale={[2.5, 2.5, 2.5]}>
                <meshBasicMaterial color="#ffffff" transparent opacity={0.18} />
              </mesh>
            )}
            {isSelected && (
              <mesh geometry={glowGeo} scale={[1.9, 1.9, 1.9]}>
                <meshBasicMaterial color={color} transparent opacity={0.3} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

// PeeringDB dots — instanced for performance
function PeeringMarkers({ facilities, onMarkerClick }) {
  const meshRef = useRef(null);

  const valid = useMemo(() =>
    facilities?.filter(f => f.latitude && f.longitude) ?? []
  , [facilities]);

  const peeringGeo = useMemo(() => new THREE.SphereGeometry(0.013, 5, 5), []);
  const peeringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#475569' }), []);

  useEffect(() => {
    if (!meshRef.current || !valid.length) return;
    const dummy = new THREE.Object3D();
    valid.forEach((f, i) => {
      const lat = parseFloat(f.latitude);
      const lng = parseFloat(f.longitude);
      if (isNaN(lat) || isNaN(lng)) return;
      const pos = latLngToVector3(lat, lng, RADIUS + 0.022);
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [valid]);

  if (!valid.length) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[peeringGeo, peeringMat, valid.length]}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId != null && valid[e.instanceId]) {
          onMarkerClick?.({ ...valid[e.instanceId], _isPeering: true });
        }
      }}
    />
  );
}

// Camera fly-to and auto-rotate controller
function SceneController({ cameraControlsRef, selectedId, selectedCountry, datacenters }) {
  const initialized = useRef(false);
  const lastSelectedId = useRef(null);
  const lastCountry = useRef(null);

  useFrame(() => {
    const controls = cameraControlsRef.current;
    if (!controls) return;

    if (!initialized.current) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.4;
      try {
        controls.mouseButtons.right = 0;
        controls.mouseButtons.middle = 0;
      } catch {}

      let resumeTimeout;
      controls.addEventListener('controlstart', () => {
        controls.autoRotate = false;
        clearTimeout(resumeTimeout);
      });
      controls.addEventListener('controlend', () => {
        resumeTimeout = setTimeout(() => {
          if (cameraControlsRef.current) cameraControlsRef.current.autoRotate = true;
        }, 2500);
      });

      initialized.current = true;
    }

    // Fly to selected DC
    if (selectedId !== lastSelectedId.current) {
      lastSelectedId.current = selectedId;
      if (selectedId && datacenters) {
        const dc = datacenters.find(d => d.id === selectedId);
        if (dc?.coordinates?.latitude) {
          const pos = latLngToVector3(dc.coordinates.latitude, dc.coordinates.longitude, RADIUS * 3);
          controls.setLookAt(pos.x, pos.y, pos.z, 0, 0, 0, true);
        }
      }
    }

    // Fly to selected country
    if (selectedCountry !== lastCountry.current) {
      lastCountry.current = selectedCountry;
      if (selectedCountry && selectedCountry !== 'All' && datacenters) {
        const dc = datacenters.find(d => d.country === selectedCountry);
        if (dc?.coordinates?.latitude) {
          const pos = latLngToVector3(dc.coordinates.latitude, dc.coordinates.longitude, RADIUS * 3.2);
          controls.setLookAt(pos.x, pos.y, pos.z, 0, 0, 0, true);
        }
      }
    }
  });

  return null;
}

function Scene({ labelCanvasRef, datacenters, peeringFacilities, selectedId, selectedCountry, onMarkerClick, setHoveredDC, setHoverPos, getMarkerColor }) {
  const { camera } = useThree();
  const cameraControlsRef = useRef(null);

  const hubs = useMemo(() => {
    if (!datacenters) return null;
    return datacenters
      .filter(dc => dc.coordinates?.latitude && dc.coordinates?.longitude)
      .map(dc => ({
        city: dc.city || dc.name,
        lat: dc.coordinates.latitude,
        lng: dc.coordinates.longitude,
        id: dc.id,
      }));
  }, [datacenters]);

  useEffect(() => {
    camera.position.set(0, 0, RADIUS * 3.5);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[RADIUS * 5, RADIUS * 2, RADIUS * 5]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[-RADIUS * 3, RADIUS, -RADIUS * 2]} intensity={0.45} color="#88ccff" />

      <Suspense fallback={null}>
        <GlobeMesh />
      </Suspense>

      <LabelOverlay labelCanvasRef={labelCanvasRef} hubs={hubs} selectedId={selectedId} />

      {datacenters && (
        <DCMarkers
          datacenters={datacenters}
          selectedId={selectedId}
          onMarkerClick={onMarkerClick}
          setHoveredDC={setHoveredDC}
          setHoverPos={setHoverPos}
          getMarkerColor={getMarkerColor}
        />
      )}

      {peeringFacilities && (
        <PeeringMarkers facilities={peeringFacilities} onMarkerClick={onMarkerClick} />
      )}

      <SceneController
        cameraControlsRef={cameraControlsRef}
        selectedId={selectedId}
        selectedCountry={selectedCountry}
        datacenters={datacenters}
      />

      <CameraControls
        ref={cameraControlsRef}
        minDistance={RADIUS * 2.5}
        maxDistance={RADIUS * 5}
      />
    </>
  );
}

export default function GlobeViewer({
  className = '',
  datacenters = null,
  peeringFacilities = null,
  selectedId = null,
  selectedCountry = null,
  dcData = null,
  onMarkerClick = null,
  showLink = true,
  getMarkerColor = null,
}) {
  const labelCanvasRef = useRef(null);
  const [hoveredDC, setHoveredDC] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  const containerStyle = showLink
    ? { height: '420px', position: 'relative' }
    : { position: 'relative', flex: 1, minHeight: 0 };

  return (
    <div
      className={`flex flex-col items-center select-none ${className}`}
      style={showLink ? {} : { height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div className="w-full" style={containerStyle}>
        <Canvas
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          dpr={[1, 2]}
          camera={{ fov: 45, near: 0.1, far: 1000, position: [0, 0, RADIUS * 3.5] }}
          style={{ background: 'transparent', width: '100%', height: '100%' }}
        >
          <Scene
            labelCanvasRef={labelCanvasRef}
            datacenters={datacenters}
            getMarkerColor={getMarkerColor}
            peeringFacilities={peeringFacilities}
            selectedId={selectedId}
            selectedCountry={selectedCountry}
            onMarkerClick={onMarkerClick}
            setHoveredDC={setHoveredDC}
            setHoverPos={setHoverPos}
          />
        </Canvas>

        <canvas
          ref={labelCanvasRef}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 2 }}
        />

        {hoveredDC && (
          <div
            style={{
              position: 'fixed',
              left: hoverPos.x + 14,
              top: hoverPos.y - 16,
              zIndex: 9999,
              pointerEvents: 'none',
            }}
          >
            <div className="bg-[#0A1628]/95 border border-[#005EB8]/40 rounded-xl px-3 py-2 shadow-2xl backdrop-blur-sm">
              <div className="text-white/90 text-xs font-bold leading-tight" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
                {hoveredDC.name}
              </div>
              <div className="text-white/50 text-[10px] mt-0.5">{hoveredDC.city} · {hoveredDC.country}</div>
              {hoveredDC.capacity_mw && (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[#005EB8] text-[10px] font-mono font-bold">{hoveredDC.capacity_mw} MW</span>
                  <span className="text-white/25">·</span>
                  <span className="text-white/50 text-[10px]">{hoveredDC.tier_rating}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showLink && (
        <>
          <Link
            href="/dashboard"
            className="mt-3 inline-flex items-center gap-2.5 px-8 py-3.5 text-white font-bold text-sm rounded-xl transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, #00338D 0%, #005EB8 100%)',
              boxShadow: '0 4px 22px rgba(0,51,141,0.38), 0 0 0 1px rgba(0,119,200,0.18)',
            }}
          >
            <Globe size={16} />
            Explore Global Dashboard
            <ArrowRight size={15} />
          </Link>
          <p className="text-[#6B8CB8] text-[10px] mt-2.5 tracking-wider uppercase font-medium">
            Live intelligence
          </p>
        </>
      )}
    </div>
  );
}
