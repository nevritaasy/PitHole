import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import MapView from './components/MapView';
import PotholeList from './components/PotholeList';
import PotholeDetail from './components/PotholeDetail';
import Footer from './components/Footer';
import IoTTestModal from './components/IoTTestModal';
import './App.css';

const API_BASE_URL = 'http://localhost:5000/api/v1/potholes';

function App() {
  const [potholes, setPotholes] = useState([]);
  const [selectedPothole, setSelectedPothole] = useState(null);
  const [detailPothole, setDetailPothole] = useState(null);
  const [viewMode, setViewMode] = useState('home'); // 'home' | 'detail'
  const [activeFilter, setActiveFilter] = useState(null);
  const [lastSyncText, setLastSyncText] = useState('5 menit yang lalu');
  const [loading, setLoading] = useState(true);

  // Ambil data potholes dari Backend Express
  const fetchPotholes = async () => {
    try {
      setLoading(true);
      const res = await fetch(API_BASE_URL);
      const data = await res.json();
      if (res.ok && data.potholes) {
        setPotholes(data.potholes);
        setLastSyncText('Baru saja');
      }
    } catch (err) {
      console.error('Gagal mengambil data potholes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPotholes();

    // Auto-refresh setiap 30 detik untuk update crowdsourcing real-time
    const interval = setInterval(() => {
      fetchPotholes();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleSelectPothole = (item) => {
    setSelectedPothole(item);
  };

  const handleOpenDetail = (item) => {
    setDetailPothole(item);
    setViewMode('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToHome = () => {
    setViewMode('home');
    setDetailPothole(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAdminClick = () => {
    alert('PitHole Admin Dashboard: Anda dapat mengubah status laporan melalui sistem API / backend admin.');
  };

  return (
    <div className="app-container">
      {/* Header Navigation */}
      <Navbar onResetToHome={handleBackToHome} onAdminClick={handleAdminClick} />

      <main className="main-content">
        {viewMode === 'home' ? (
          <>
            {/* Page Header Title */}
            <h1 className="page-header-title">Peta Sebaran Lubang</h1>

            {/* Map Interactive Component (Gambar Mockup 1 & 2) */}
            <MapView
              potholes={potholes}
              selectedPothole={selectedPothole}
              onSelectPothole={handleSelectPothole}
              onOpenDetail={handleOpenDetail}
              onCloseSelection={() => setSelectedPothole(null)}
              lastSyncText={lastSyncText}
            />

            {/* Admin Legend & Latest Detections Dashboard */}
            <PotholeList
              potholes={potholes}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              onSelectPothole={(item) => {
                handleSelectPothole(item);
                handleOpenDetail(item);
              }}
            />
          </>
        ) : (
          /* Detail Page View (Gambar Mockup 3) */
          <PotholeDetail pothole={detailPothole} onBack={handleBackToHome} />
        )}
      </main>

      {/* IoT Floating Simulator Widget */}
      <IoTTestModal onRefreshData={fetchPotholes} />

      {/* Navy Dark Footer */}
      <Footer />
    </div>
  );
}

export default App;
