'use client';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function getPctColor(pct) {
  if (pct >= 76) return '#00A36C';
  if (pct >= 71) return '#0077C8';
  if (pct >= 66) return '#F59E0B';
  return '#EF4444';
}

function regionBadgeIcon(label, pct) {
  const color = getPctColor(pct);
  const html = `
    <div style="
      display:flex; align-items:center; gap:5px;
      background:rgba(255,255,255,0.85);
      border:1px solid ${color}50;
      border-radius:8px;
      padding:4px 8px;
      backdrop-filter:blur(8px);
      white-space:nowrap;
    ">
      <span style="
        width:7px; height:7px; border-radius:50%;
        background:${color};
        box-shadow:0 0 5px ${color}90;
        flex-shrink:0;
        display:inline-block;
      "></span>
      <span style="font-size:10px; font-weight:600; color:#1A1F36; font-family:system-ui,sans-serif; letter-spacing:-0.01em;">
        ${label}
      </span>
      <span style="font-size:10px; font-weight:800; color:${color}; font-family:ui-monospace,monospace;">
        ${pct}%
      </span>
    </div>
  `;
  return L.divIcon({
    html,
    className: '',
    iconSize:   [160, 26],
    iconAnchor: [80, 13],
  });
}

export default function RegionUtilizationMapLeaflet({ regions = [] }) {
  useEffect(() => {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: '/leaflet/marker-icon-2x.png',
      iconUrl:       '/leaflet/marker-icon.png',
      shadowUrl:     '/leaflet/marker-shadow.png',
    });
  }, []);

  return (
    <MapContainer
      center={[20, 15]}
      zoom={1}
      minZoom={1}
      maxZoom={5}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
      attributionControl={false}
      scrollWheelZoom={false}
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />
      {regions.map(r => (
        <Marker
          key={r.key}
          position={[r.lat, r.lon]}
          icon={regionBadgeIcon(r.label, r.utilizationPct)}
        />
      ))}
    </MapContainer>
  );
}
