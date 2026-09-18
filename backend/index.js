const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initDb } = require('./src/db');
const potholeService = require('./src/services/potholeService');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Inisialisasi Database saat Server Mulai
initDb().then(() => {
  // Auto-seed data UGM jika database masih kosong
  potholeService.getAllPotholes().then((list) => {
    if (list.length === 0) {
      console.log('[Init] Mengisi data seed awal area UGM...');
      potholeService.seedInitialPotholes();
    }
  });
});

// Endpoint Health Check
app.get('/api/hello', (req, res) => {
  res.json({
    message: 'Backend Express & Database PitHole UGM Berhasil Jalan!',
    timestamp: new Date().toISOString(),
  });
});

/**
 * 1. Endpoint Upload Batch dari MicroSD ESP32
 * POST /api/v1/potholes/batch-upload
 */
app.post('/api/v1/potholes/batch-upload', async (req, res) => {
  try {
    const { sync_time, potholes } = req.body;

    if (!Array.isArray(potholes)) {
      return res.status(400).json({
        status: 'error',
        message: 'Format data tidak valid. "potholes" harus berupa array.',
      });
    }

    const results = await potholeService.processBatchUpload(sync_time, potholes);

    res.status(200).json({
      status: 'success',
      message: `Berhasil memproses ${results.length} log data titik lubang.`,
      sync_time: sync_time || new Date().toISOString(),
      details: results,
    });
  } catch (error) {
    console.error('Error batch-upload:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * 2. Endpoint Download/Sync untuk ESP32
 * GET /api/v1/potholes/sync?last_sync={timestamp}
 */
app.get('/api/v1/potholes/sync', async (req, res) => {
  try {
    const { last_sync } = req.query;
    const syncData = await potholeService.getSyncData(last_sync);

    res.status(200).json({
      status: 'success',
      sync_time: new Date().toISOString(),
      count: syncData.length,
      potholes: syncData,
    });
  } catch (error) {
    console.error('Error sync:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * 3. Endpoint Ambil Seluruh Data Pothole untuk React Frontend
 * GET /api/v1/potholes
 */
app.get('/api/v1/potholes', async (req, res) => {
  try {
    const list = await potholeService.getAllPotholes();

    // Hitung ringkasan statistik
    const stats = {
      total: list.length,
      active: list.filter((p) => p.status === 'active').length,
      in_progress: list.filter((p) => p.status === 'in_progress').length,
      repaired: list.filter((p) => p.status === 'repaired').length,
    };

    res.status(200).json({
      status: 'success',
      stats,
      potholes: list,
    });
  } catch (error) {
    console.error('Error get all potholes:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * 4. Endpoint Ambil 1 Detail Pothole
 * GET /api/v1/potholes/:id
 */
app.get('/api/v1/potholes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const item = await potholeService.getPotholeById(id);

    if (!item) {
      return res.status(404).json({ status: 'error', message: 'Titik lubang tidak ditemukan' });
    }

    res.status(200).json({ status: 'success', pothole: item });
  } catch (error) {
    console.error('Error get pothole by id:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * 5. Endpoint Update Status Pothole (Admin)
 * PATCH /api/v1/potholes/:id/status
 */
app.patch('/api/v1/potholes/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await potholeService.updatePotholeStatus(id, status);

    if (!updated) {
      return res.status(404).json({ status: 'error', message: 'Titik lubang tidak ditemukan' });
    }

    res.status(200).json({
      status: 'success',
      message: `Status lubang #${id} berhasil diperbarui menjadi '${status}'`,
      pothole: updated,
    });
  } catch (error) {
    console.error('Error update status:', error);
    res.status(400).json({ status: 'error', message: error.message });
  }
});

/**
 * 6. Endpoint Seed Data Dummy Area UGM (Untuk Testing)
 * POST /api/v1/potholes/seed
 */
app.post('/api/v1/potholes/seed', async (req, res) => {
  try {
    const seeded = await potholeService.seedInitialPotholes();
    res.status(200).json({
      status: 'success',
      message: 'Berhasil mengisikan data awal (seed) jalan berlubang di area UGM.',
      count: seeded.length,
      potholes: seeded,
    });
  } catch (error) {
    console.error('Error seed:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`[PitHole Backend Server] Berjalan di http://localhost:${PORT}`);
});