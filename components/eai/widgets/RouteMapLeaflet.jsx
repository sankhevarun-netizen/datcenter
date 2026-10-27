'use client';
import { Fragment, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, ZoomControl, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Quadratic Bezier curve for curved route lines on the map
function curvePath(lat1, lng1, lat2, lng2, points = 40) {
  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;
  const dLat   = lat2 - lat1;
  const dLng   = lng2 - lng1;
  // Control point: perpendicular offset creates the arc
  const ctrlLat = midLat - dLng * 0.25;
  const ctrlLng = midLng + dLat * 0.25;
  return Array.from({ length: points + 1 }, (_, i) => {
    const t = i / points;
    return [
      (1-t)**2 * lat1 + 2*(1-t)*t * ctrlLat + t**2 * lat2,
      (1-t)**2 * lng1 + 2*(1-t)*t * ctrlLng + t**2 * lng2,
    ];
  });
}

const STATUS_LINE_COLOR = {
  'In Transit': '#0077C8',
  'Delivered':  '#00A36C',
};

export default function RouteMapLeaflet({ shipments = [], animated = false, showTooltips = false, interactive = false }) {
  useEffect(() => {
    // Prevent the default Leaflet icon path errors in Next.js
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({ iconUrl: '', shadowUrl: '' });
  }, []);

  // Track which destination coords have already had a marker rendered
  const renderedDests = new Set();

  return (
    <MapContainer
      center={[20, 100]}
      zoom={2}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
      attributionControl={false}
      scrollWheelZoom={interactive}
      dragging={interactive}
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />
      {interactive && <ZoomControl position="topleft" />}

      {shipments.map(s => {
        const [oLat, oLng] = s.originCoords;
        const [dLat, dLng] = s.destinationCoords;
        const curve   = curvePath(oLat, oLng, dLat, dLng);
        const color   = STATUS_LINE_COLOR[s.status] ?? '#6B7280';
        const destKey = `${dLat},${dLng}`;
        const showDest = !renderedDests.has(destKey);
        renderedDests.add(destKey);
        return (
          <Fragment key={s.shipmentId}>
            <Polyline
              positions={curve}
              pathOptions={{ color, weight: 2, opacity: 0.80, dashArray: '6 4', className: animated ? 'route-line-flow' : undefined }}
            >
              {showTooltips && (
                <Tooltip sticky direction="top" opacity={0.95}>
                  <div style={{ fontSize: 11, lineHeight: 1.5 }}>
                    <strong>{s.origin} → {s.destination}</strong><br />
                    Status: {s.status}{s.status === 'In Transit' ? ` (${s.progressPct}% complete)` : ''}<br />
                    Carrier: {s.carrier}<br />
                    Distance: {s.distanceKm?.toLocaleString()} km · Avg speed: {s.avgSpeedKmh} km/h<br />
                    ETA: {s.eta}
                  </div>
                </Tooltip>
              )}
            </Polyline>
            <CircleMarker center={[oLat, oLng]} radius={5} pathOptions={{ color: '#F59E0B', fillColor: '#F59E0B', fillOpacity: 1, weight: 1 }}>
              {showTooltips && <Tooltip direction="top" opacity={0.95}>{s.origin}</Tooltip>}
            </CircleMarker>
            {showDest && (
              <CircleMarker center={[dLat, dLng]} radius={6} pathOptions={{ color: '#fff', fillColor: '#00A36C', fillOpacity: 0.9, weight: 2 }}>
                {showTooltips && <Tooltip direction="top" opacity={0.95}>{s.destination}</Tooltip>}
              </CircleMarker>
            )}
          </Fragment>
        );
      })}
    </MapContainer>
  );
}
