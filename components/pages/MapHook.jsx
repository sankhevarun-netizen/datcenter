'use client';
/**
 * MapHook.jsx
 * Separated because useMap() must be called inside <MapContainer>.
 * Loaded via next/dynamic with ssr:false to avoid window errors.
 */
import { useEffect } from 'react';
import { useMap, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';

// Fix default Leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function createDCIcon(country, color, isSelected = false) {
  const size = isSelected ? 42 : 34;
  const id = Math.random().toString(36).slice(2, 8);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 42" width="${size}" height="${size * 1.17}">
    <defs><filter id="s${id}"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="${color}" flood-opacity="0.4"/></filter></defs>
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 24 18 24S36 31.5 36 18C36 8.06 27.94 0 18 0z" fill="${color}" filter="url(#s${id})"/>
    <circle cx="18" cy="18" r="9" fill="white" opacity="0.9"/>
    <circle cx="18" cy="18" r="5" fill="${color}"/>
    ${isSelected ? `<circle cx="18" cy="18" r="12" fill="none" stroke="white" stroke-width="2" opacity="0.5"/>` : ''}
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [size, size * 1.17], iconAnchor: [size / 2, size * 1.17], popupAnchor: [0, -size * 1.17] });
}

// Small grey dot for non-curated PeeringDB facilities
const peeringIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="12" height="12">
    <circle cx="6" cy="6" r="5" fill="#64748b" stroke="white" stroke-width="1.5" opacity="0.75"/>
  </svg>`,
  className: '',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

function MapController({ selectedCountry, selectedDC, dcData }) {
  const map = useMap();
  useEffect(() => {
    if (!dcData) return;
    if (selectedDC) {
      const lat = selectedDC.coordinates?.lat;
      const lng = selectedDC.coordinates?.lng;
      if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return;
      map.flyTo([lat, lng], 12, { duration: 1.2 });
    } else if (selectedCountry && selectedCountry !== 'All') {
      const summary = dcData.country_summary[selectedCountry];
      if (summary) map.flyTo(summary.map_center, summary.map_zoom, { duration: 1.2 });
    } else {
      map.flyTo([20, 5], 2, { duration: 1.2 });
    }
  }, [selectedCountry, selectedDC, map, dcData]);
  return null;
}

export default function MapHook({
  selectedCountry, selectedDC, dcData, filteredDCs, peeringFacilities,
  setSelectedDatacenter, onPeeringClick, setShowAIPanel, getPUEColor, getCountryColor,
}) {
  const map = useMap();

  const validCurated = filteredDCs.filter(dc => {
    const lat = dc.coordinates?.lat;
    const lng = dc.coordinates?.lng;
    return lat != null && lng != null && !isNaN(lat) && !isNaN(lng);
  });

  return (
    <>
      <MapController selectedCountry={selectedCountry} selectedDC={selectedDC} dcData={dcData} />

      <MarkerClusterGroup chunkedLoading disableClusteringAtZoom={14}>
        {/* Curated KPMG facilities — full detail on click */}
        {validCurated.map(dc => (
          <Marker
            key={`curated-${dc.id}`}
            position={[dc.coordinates.lat, dc.coordinates.lng]}
            icon={createDCIcon(dc.country, getCountryColor(dc.country), selectedDC?.id === dc.id)}
          >
            <Popup>
              <div className="p-3 min-w-[200px]">
                <div className="text-white font-bold text-sm mb-1" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{dc.name}</div>
                <div className="text-white/50 text-xs mb-3">{dc.operator}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center">
                    <div className="text-[#005EB8] font-bold font-mono">{dc.capacity_mw}MW</div>
                    <div className="text-white/40 text-xs">Capacity</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold font-mono" style={{ color: getPUEColor(dc.pue) }}>{dc.pue}</div>
                    <div className="text-white/40 text-xs">PUE</div>
                  </div>
                </div>
                <button
                  onClick={() => { map.closePopup(); setSelectedDatacenter(dc); setShowAIPanel(false); }}
                  className="w-full mt-3 text-xs px-3 py-1.5 bg-[#00338D] text-white rounded-lg hover:bg-[#002A73] transition-colors font-semibold"
                >
                  View Details →
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Non-curated PeeringDB facilities — AI intelligence on click */}
        {(peeringFacilities ?? []).map(f => (
          <Marker
            key={`peering-${f.id}`}
            position={[f.latitude, f.longitude]}
            icon={peeringIcon}
            eventHandlers={{ click: () => onPeeringClick(f) }}
          />
        ))}
      </MarkerClusterGroup>
    </>
  );
}
