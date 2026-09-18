import React, { useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation } from 'lucide-react';

// UGM Coordinates Center
const UGM_CENTER = [-7.7702, 110.3778];
const DEFAULT_ZOOM = 16;

// Helper untuk membuat Custom HTML Marker Icon Leaflet (seperti di Mockup)
function createCustomMarkerIcon(id, status) {
  const statusClass = status === 'active' ? 'pin-active' : status === 'in_progress' ? 'pin-in_progress' : 'pin-repaired';
  const html = `
    <div class="custom-pin-marker">
      <div class="pin-head ${statusClass}">
        <span class="pin-number">${id}</span>
      </div>
    </div>
  `;
  return L.divIcon({
    html: html,
    className: '',
    iconSize: [36, 48],
    iconAnchor: [18, 48],
  });
}

// Controller untuk fitur Pusatkan Kembali
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom, { duration: 1 });
    }
  }, [center, zoom, map]);
  return null;
}

export default function MapView({
  potholes,
  selectedPothole,
  onSelectPothole,
  onOpenDetail,
  onCloseSelection,
  lastSyncText,
}) {
  const mapRef = useRef(null);

  const handleRecenter = () => {
    if (mapRef.current) {
      mapRef.current.flyTo(UGM_CENTER, DEFAULT_ZOOM, { duration: 1 });
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'in_progress': return 'Lubang sedang diproses';
      case 'repaired': return 'Lubang dilaporkan selesai';
      case 'active':
      default: return 'Lubang aktif';
    }
  };

  return (
    <div className="map-card-container">
      {/* Map Top Floating Bar */}
      <div className="map-top-bar">
        <div className="sync-badge">
          <span>Data lubang terakhir tersinkronisasi {lastSyncText || '5 menit yang lalu'}</span>
        </div>
        <button className="btn-recenter" onClick={handleRecenter}>
          <Navigation size={16} />
          Pusatkan Kembali
        </button>
      </div>

      {/* Leaflet Map */}
      <div className="leaflet-map-wrapper">
        <MapContainer
          center={UGM_CENTER}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {potholes.map((item) => (
            <Marker
              key={item.id}
              position={[item.lat, item.lon]}
              icon={createCustomMarkerIcon(item.id, item.status)}
              eventHandlers={{
                click: () => onSelectPothole(item),
              }}
            />
          ))}
        </MapContainer>
      </div>

      {/* Bottom Selection Banner (Gambar Mockup 2) */}
      {selectedPothole && (
        <div className="map-selection-banner">
          <div className="selection-left">
            <div className="selection-id-badge">{selectedPothole.id}</div>
            <div className="selection-info">
              <span className="selection-title">Pothole #{selectedPothole.id}</span>
              <span className="selection-coords">
                {selectedPothole.lat.toFixed(14)}, {selectedPothole.lon.toFixed(14)}
              </span>
            </div>
          </div>

          <div className="selection-actions">
            <span className={`status-pill status-${selectedPothole.status}`}>
              {getStatusLabel(selectedPothole.status)}
            </span>
            <button className="btn-detail" onClick={() => onOpenDetail(selectedPothole)}>
              Lihat detail
            </button>
            <button className="btn-close-banner" onClick={onCloseSelection}>
              X
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
