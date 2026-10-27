'use client';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';
import { createFacilityIcon } from './Marker';
import { createClusterIcon } from './Cluster';
import { createRegionIcon } from './RegionMarker';

// Esri's free, no-API-key "Canvas" basemaps: a base layer plus a transparent
// reference layer that carries the place labels, stacked to match the old
// CARTO light/dark styles (CARTO now requires a paid API key for basemap tiles).
const TILE_URLS = {
  dark: {
    base: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    reference: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
  },
  light: {
    base: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    reference: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
  },
};
const TILE_ATTRIBUTION = 'Tiles &copy; Esri — Esri, HERE, Garmin, FAO, NOAA, USGS';
const TILE_MAX_ZOOM = 16;

function FlyToController({ flyToTarget }) {
  const map = useMap();
  useEffect(() => {
    if (!flyToTarget) return;
    map.flyTo([flyToTarget.latitude, flyToTarget.longitude], flyToTarget.zoom ?? 6, { duration: 1.1 });
  }, [flyToTarget, map]);
  return null;
}

/**
 * The single shared map for both the global portfolio view and every
 * regional view. Regional pages pass only their own facilities (so the map
 * is naturally zoomed/focused) and never pass regionMarkers/onRegionClick.
 * The global page passes the full facility set plus region centroid pins;
 * clicking one drives the dim-and-zoom transition before navigating into
 * /global-infrastructure/[region].
 */
export default function WorldMap({
  facilities = [],
  selectedFacilityId = null,
  highlightedFacilityIds = [],
  dimmedFacilityIds = [],
  regionMarkers = [],
  activeRegion = null,
  onMarkerClick,
  onRegionMarkerClick,
  flyToTarget = null,
  mode = 'dark',
}) {
  const wrapperClass = mode === 'dark' ? 'gii-map-dark' : 'gii-map-light';

  return (
    <div className={`w-full h-full rounded-2xl overflow-hidden border border-[#D8DCE3] ${wrapperClass}`}>
      <MapContainer
        center={[20, 10]}
        zoom={2}
        minZoom={2}
        maxZoom={14}
        worldCopyJump
        zoomAnimation
        style={{ width: '100%', height: '100%' }}
        attributionControl
      >
        <TileLayer url={TILE_URLS[mode].base} attribution={TILE_ATTRIBUTION} maxZoom={TILE_MAX_ZOOM} />
        <TileLayer url={TILE_URLS[mode].reference} maxZoom={TILE_MAX_ZOOM} />

        <FlyToController flyToTarget={flyToTarget} />

        {regionMarkers.map(rm => (
          <Marker
            key={`region-${rm.region}`}
            position={[rm.latitude, rm.longitude]}
            icon={createRegionIcon(rm.label, rm.count, rm.region === activeRegion)}
            keyboard
            alt={`${rm.label} region — ${rm.count} facilities`}
            eventHandlers={{ click: () => onRegionMarkerClick?.(rm.region) }}
          />
        ))}

        <MarkerClusterGroup
          chunkedLoading
          disableClusteringAtZoom={9}
          iconCreateFunction={createClusterIcon}
          spiderfyOnMaxZoom
          showCoverageOnHover={false}
        >
          {facilities.map(facility => (
            <Marker
              key={facility.id}
              position={[facility.latitude, facility.longitude]}
              icon={createFacilityIcon(facility, {
                isSelected: facility.id === selectedFacilityId || highlightedFacilityIds.includes(facility.id),
                isDimmed: dimmedFacilityIds.includes(facility.id),
              })}
              keyboard
              alt={`${facility.name}, ${facility.city}, ${facility.country}`}
              eventHandlers={{ click: () => onMarkerClick?.(facility) }}
            />
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
