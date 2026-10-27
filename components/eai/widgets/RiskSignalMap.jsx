'use client';
// RiskSignalMap – satellite/street basemap toggle + risk-scored facility pins
// + toggleable hazard-signal overlay markers, for the Risk Signals module.
// Follows the same react-leaflet conventions as EAIMapLeaflet.jsx.

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker, Tooltip, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const BAND_COLOR = { low: '#10B981', elevated: '#F59E0B', high: '#EF4444', critical: '#991B1B' };

const BASEMAPS = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics',
    subdomains: 'abc',
  },
  street: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri — Esri, HERE, Garmin, FAO, NOAA, USGS',
    subdomains: 'abc',
  },
};

const SEVERITY_RADIUS = { critical: 11, warning: 8, watch: 6, info: 4 };

function riskIcon(site, isSelected, hasCriticalSignal) {
  const color = BAND_COLOR[site.band] ?? '#6B7280';
  const size = 16 + Math.round((site.riskScore / 100) * 22);
  const ring = isSelected ? `0 0 0 4px ${color}55, 0 0 0 7px ${color}` : `0 0 0 3px ${color}30`;
  const pulse = hasCriticalSignal
    ? `<div style="position:absolute;inset:-7px;border-radius:50%;border:2px solid ${color};animation:eaiRiskPulse 1.6s ease-out infinite;"></div>`
    : '';
  return L.divIcon({
    html: `<div style="position:relative;width:${size}px;height:${size}px;">
      ${pulse}
      <div style="
        width:100%;height:100%;border-radius:50%;
        background:${color};border:2px solid rgba(255,255,255,0.85);
        box-shadow:${ring};
        display:flex;align-items:center;justify-content:center;
        color:#fff;font-weight:700;font-size:${size > 28 ? 10 : 8}px;font-family:monospace;
        cursor:pointer;
      ">${site.riskScore}</div>
    </div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function RiskSignalMap({
  sites = [],
  signals = [],
  activeLayers = [],
  layerColors = {},
  selectedFacilityId,
  basemap = 'satellite',
  onSiteClick,
  onSiteDoubleClick,
}) {
  useEffect(() => {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: '/leaflet/marker-icon-2x.png',
      iconUrl: '/leaflet/marker-icon.png',
      shadowUrl: '/leaflet/marker-shadow.png',
    });
    if (!document.getElementById('eai-risk-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'eai-risk-pulse-style';
      style.textContent = '@keyframes eaiRiskPulse { 0% { opacity:0.9; transform:scale(1); } 100% { opacity:0; transform:scale(1.9); } }';
      document.head.appendChild(style);
    }
  }, []);

  const criticalFacilityIds = new Set(signals.filter(s => s.severity === 'critical').map(s => s.facilityId));
  const tiles = BASEMAPS[basemap] ?? BASEMAPS.satellite;

  return (
    <MapContainer
      center={[15, 20]}
      zoom={2}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
      attributionControl={false}
      scrollWheelZoom={false}
    >
      <TileLayer url={tiles.url} attribution={tiles.attribution} subdomains={tiles.subdomains} maxZoom={19} />
      <ZoomControl position="topleft" />

      {/* Hazard overlay markers — one small ring per active-layer signal */}
      {activeLayers.map(layerKey => (
        signals.filter(s => s.type === layerKey).map(s => (
          <CircleMarker
            key={`overlay-${s.id}`}
            center={[s.lat, s.lon]}
            radius={SEVERITY_RADIUS[s.severity] ?? 5}
            pathOptions={{
              color: layerColors[layerKey] ?? '#6B7280',
              weight: 1.5,
              fillColor: layerColors[layerKey] ?? '#6B7280',
              fillOpacity: 0.18,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
              <span style={{ fontSize: 10 }}>{s.title}</span>
            </Tooltip>
          </CircleMarker>
        ))
      ))}

      {/* Facility risk pins */}
      {sites.map(site => (
        <Marker
          key={site.facilityId}
          position={[site.lat, site.lon]}
          icon={riskIcon(site, site.facilityId === selectedFacilityId, criticalFacilityIds.has(site.facilityId))}
          eventHandlers={{
            click: () => onSiteClick?.(site),
            dblclick: () => onSiteDoubleClick?.(site),
          }}
        >
          <Tooltip direction="top" offset={[0, -18]} opacity={0.95}>
            <span style={{ fontSize: 11 }}>{site.name} — {site.riskScore}/100 ({site.band})</span>
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
