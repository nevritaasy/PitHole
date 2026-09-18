import React from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, MapPin, Clock, ExternalLink } from 'lucide-react';

function createCustomDetailIcon(id, status) {
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

export default function PotholeDetail({ pothole, onBack }) {
  if (!pothole) return null;

  const getStatusLabel = (status) => {
    switch (status) {
      case 'in_progress': return 'Lubang sedang diproses';
      case 'repaired': return 'Lubang dilaporkan selesai';
      case 'active':
      default: return 'Lubang aktif';
    }
  };

  const formattedDate = pothole.last_detected_at
    ? new Date(pothole.last_detected_at).toISOString().replace('T', ' ').substring(0, 19)
    : '2026-05-07 14:23:15';

  const gmapsUrl = `https://www.google.com/maps?q=${pothole.lat},${pothole.lon}`;

  return (
    <div className="detail-page-container">
      {/* Tombol Kembali (Pill Pink - Gambar Mockup 3) */}
      <button className="btn-back-pill" onClick={onBack}>
        <ArrowLeft size={18} />
        Kembali
      </button>

      {/* Header Info */}
      <div className="detail-header-bar">
        <div className="detail-title-group">
          <div className="detail-icon-circle">
            <MapPin size={24} color="#0F172A" />
          </div>
          <div>
            <h2 className="detail-title">Pothole #{pothole.id}</h2>
            <p className="detail-subtitle">Detail Informasi</p>
          </div>
        </div>

        <span className={`status-pill status-${pothole.status}`}>
          {getStatusLabel(pothole.status)}
        </span>
      </div>

      {/* Grid 2-Kolom (Gambar Mockup 3) */}
      <div className="detail-grid">
        {/* Kolom Kiri: Detail Lokasi Lubang */}
        <div className="dashboard-card detail-left-card">
          <h2 className="card-title-bar">Detail Lokasi Lubang</h2>

          <div className="mini-map-box">
            <MapContainer
              center={[pothole.lat, pothole.lon]}
              zoom={17}
              zoomControl={false}
              dragging={false}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker
                position={[pothole.lat, pothole.lon]}
                icon={createCustomDetailIcon(pothole.id, pothole.status)}
              />
            </MapContainer>
          </div>

          <div style={{ fontSize: '14px', color: '#0F172A', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <p><strong>Latitude:</strong> {pothole.lat}</p>
            <p><strong>Longitude:</strong> {pothole.lon}</p>
            <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
              Jumlah Konfirmasi Crowdsourcing: <strong>{pothole.report_count || 1} kali</strong>
            </p>
          </div>

          <a
            href={gmapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gmaps"
          >
            <ExternalLink size={18} />
            Buka di Google Maps
          </a>
        </div>

        {/* Kolom Kanan: Waktu Tervalidasi & Metode Validasi */}
        <div className="detail-right-stack">
          {/* Card 1: Waktu Tervalidasi */}
          <div className="dashboard-card">
            <h2 className="card-title-bar">Waktu Tervalidasi</h2>
            <div className="info-box-bordered">
              <Clock size={24} color="#EF4444" />
              <div>
                <p style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Divalidasi pada</p>
                <p style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
                  {formattedDate}
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Metode Validasi */}
          <div className="dashboard-card">
            <h2 className="card-title-bar">Metode Validasi</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <div className="info-box-pill">Deteksi Kamera (FOMO ML)</div>
              <div className="info-box-pill">Konfirmasi IMU (MPU6050 Shock Sensor)</div>
            </div>
            <p style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.5' }}>
              Titik lubang ini divalidasi melalui kombinasi deteksi visual kamera dan konfirmasi getaran sensor IMU.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
