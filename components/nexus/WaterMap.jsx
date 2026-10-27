'use client';
// Water-stress map: one marker per facility, area proportional to the
// freshwater it drew this year, shaded by basin stress index (one hue, light
// to dark). Sites not yet drawing water are hollow.
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Sequential ramp for stress index 0–100 (validated single-hue, light → dark).
const RAMP = ['#EBA36C', '#E0864A', '#CF6530', '#B04A1E', '#843412'];
export const stressColor = (idx) => RAMP[Math.min(RAMP.length - 1, Math.floor(idx / 20))];

export default function WaterMap({ sites, selected, onSelect }) {
  const maxFresh = Math.max(...sites.filter((s) => s.ytd).map((s) => s.ytd.freshLitres));
  const lats = sites.map((s) => s.lat);
  const lons = sites.map((s) => s.lon);
  const bounds = [[Math.min(...lats) - 1.5, Math.min(...lons) - 2], [Math.max(...lats) + 1.5, Math.max(...lons) + 2]];
  return (
    <MapContainer bounds={bounds} minZoom={4} maxZoom={9} scrollWheelZoom={false}
      style={{ height: '100%', width: '100%', background: '#F0F2F5' }} attributionControl>
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri" />
      {sites.map((s) => {
        const live = Boolean(s.ytd);
        const r = live ? 8 + 18 * Math.sqrt(s.ytd.freshLitres / maxFresh) : 9;
        const color = live ? stressColor(s.stress.index) : '#64748B';
        return (
          <CircleMarker key={s.id} center={[s.lat, s.lon]} radius={r}
            pathOptions={{ color: selected === s.id ? '#1A1F36' : '#FFFFFF', weight: selected === s.id ? 3 : 2, fillColor: color, fillOpacity: live ? 0.9 : 0, dashArray: live ? null : '3 3' }}
            eventHandlers={{ click: () => onSelect?.(s.id) }}>
            <Tooltip direction="top" offset={[0, -r]}>
              <div style={{ fontSize: 11 }}>
                <strong>{s.name}</strong><br />
                {live
                  ? <>WUE {s.latest.wue} L/kWh · {s.stress.label} stress ({s.stress.index})<br />{(s.ytd.freshLitres / 1e6).toFixed(1)} ML fresh this year · {s.ytd.treatedSharePct}% treated</>
                  : <>Not yet drawing water · design WUE {s.targetWue}</>}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
