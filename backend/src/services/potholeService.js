const { query, isPgConnected, memoryDb } = require('../db');
const { getHaversineDistance } = require('../utils/haversine');

// Radius batas deduplikasi spasial dalam meter
const DEDUPLICATION_RADIUS_METERS = 3.0;

/**
 * Memproses batch data upload dari ESP32 MicroSD dengan deduplikasi spasial
 */
async function processBatchUpload(syncTime, potholes) {
  const processedResults = [];

  for (const item of potholes) {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    const detectedAt = item.detected_at || syncTime || new Date().toISOString();

    if (isNaN(lat) || isNaN(lon)) {
      continue;
    }

    if (isPgConnected()) {
      // 1. Ambil seluruh data lubang di PostgreSQL
      const allPotholesRes = await query('SELECT * FROM potholes');
      const existingList = allPotholesRes.rows;

      let match = null;
      let minDistance = Infinity;

      for (const existing of existingList) {
        const dist = getHaversineDistance(lat, lon, existing.lat, existing.lon);
        if (dist <= DEDUPLICATION_RADIUS_METERS && dist < minDistance) {
          minDistance = dist;
          match = existing;
        }
      }

      if (match) {
        // Update koordinat terbobot rata-rata & report_count
        const oldCount = match.report_count || 1;
        const newCount = oldCount + 1;
        const newLat = (match.lat * oldCount + lat) / newCount;
        const newLon = (match.lon * oldCount + lon) / newCount;

        const updateQuery = `
          UPDATE potholes
          SET lat = $1, lon = $2, report_count = $3, last_detected_at = $4, updated_at = CURRENT_TIMESTAMP
          WHERE id = $5
          RETURNING *;
        `;
        const updateRes = await query(updateQuery, [newLat, newLon, newCount, detectedAt, match.id]);
        processedResults.push({ action: 'updated', pothole: updateRes.rows[0], distance: minDistance });
      } else {
        // Insert data baru
        const insertQuery = `
          INSERT INTO potholes (lat, lon, report_count, status, first_detected_at, last_detected_at, updated_at, validation_methods)
          VALUES ($1, $2, 1, 'active', $3, $3, CURRENT_TIMESTAMP, $4)
          RETURNING *;
        `;
        const insertRes = await query(insertQuery, [lat, lon, detectedAt, JSON.stringify(['camera', 'imu'])]);
        processedResults.push({ action: 'created', pothole: insertRes.rows[0] });
      }
    } else {
      // Mode In-Memory Fallback
      let match = null;
      let minDistance = Infinity;

      for (const existing of memoryDb.potholes) {
        const dist = getHaversineDistance(lat, lon, existing.lat, existing.lon);
        if (dist <= DEDUPLICATION_RADIUS_METERS && dist < minDistance) {
          minDistance = dist;
          match = existing;
        }
      }

      if (match) {
        const oldCount = match.report_count || 1;
        const newCount = oldCount + 1;
        match.lat = (match.lat * oldCount + lat) / newCount;
        match.lon = (match.lon * oldCount + lon) / newCount;
        match.report_count = newCount;
        match.last_detected_at = detectedAt;
        match.updated_at = new Date().toISOString();
        processedResults.push({ action: 'updated', pothole: match, distance: minDistance });
      } else {
        const newPothole = {
          id: memoryDb.nextId++,
          lat,
          lon,
          report_count: 1,
          status: 'active',
          first_detected_at: detectedAt,
          last_detected_at: detectedAt,
          updated_at: new Date().toISOString(),
          validation_methods: ['camera', 'imu'],
        };
        memoryDb.potholes.push(newPothole);
        processedResults.push({ action: 'created', pothole: newPothole });
      }
    }
  }

  return processedResults;
}

/**
 * Mendapatkan data titik lubang baru setelah timestamp last_sync
 */
async function getSyncData(lastSync) {
  if (isPgConnected()) {
    let sql = 'SELECT * FROM potholes';
    const params = [];

    if (lastSync) {
      sql += ' WHERE updated_at > $1';
      params.push(new Date(lastSync).toISOString());
    }
    sql += ' ORDER BY updated_at ASC';

    const res = await query(sql, params);
    return res.rows;
  } else {
    if (!lastSync) return memoryDb.potholes;
    const syncDate = new Date(lastSync);
    return memoryDb.potholes.filter((p) => new Date(p.updated_at) > syncDate);
  }
}

/**
 * Mendapatkan seluruh daftar potholes untuk frontend React
 */
async function getAllPotholes() {
  if (isPgConnected()) {
    const res = await query('SELECT * FROM potholes ORDER BY id DESC');
    return res.rows;
  } else {
    return [...memoryDb.potholes].sort((a, b) => b.id - a.id);
  }
}

/**
 * Mendapatkan 1 pothole berdasarkan ID
 */
async function getPotholeById(id) {
  if (isPgConnected()) {
    const res = await query('SELECT * FROM potholes WHERE id = $1', [id]);
    return res.rows[0] || null;
  } else {
    return memoryDb.potholes.find((p) => p.id === parseInt(id, 10)) || null;
  }
}

/**
 * Mengubah status pothole oleh Admin
 */
async function updatePotholeStatus(id, status) {
  const validStatuses = ['active', 'in_progress', 'repaired'];
  if (!validStatuses.includes(status)) {
    throw new Error('Status tidak valid');
  }

  if (isPgConnected()) {
    const res = await query(
      'UPDATE potholes SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );
    return res.rows[0] || null;
  } else {
    const pothole = memoryDb.potholes.find((p) => p.id === parseInt(id, 10));
    if (pothole) {
      pothole.status = status;
      pothole.updated_at = new Date().toISOString();
      return pothole;
    }
    return null;
  }
}

/**
 * Seed data awal area UGM
 */
async function seedInitialPotholes() {
  const seedPotholes = [
    {
      id: 1,
      lat: -7.7715,
      lon: 110.3775,
      report_count: 3,
      status: 'repaired',
      first_detected_at: '2026-05-01T08:00:00Z',
      last_detected_at: '2026-05-01T08:00:00Z',
      validation_methods: ['camera', 'imu'],
    },
    {
      id: 2,
      lat: -7.7685,
      lon: 110.3792,
      report_count: 5,
      status: 'active',
      first_detected_at: '2026-05-07T14:23:15Z',
      last_detected_at: '2026-05-07T14:23:15Z',
      validation_methods: ['camera', 'imu'],
    },
    {
      id: 3,
      lat: -7.7702,
      lon: 110.3768,
      report_count: 2,
      status: 'active',
      first_detected_at: '2026-05-08T09:10:00Z',
      last_detected_at: '2026-05-08T09:10:00Z',
      validation_methods: ['camera', 'imu'],
    },
    {
      id: 4,
      lat: -7.7698,
      lon: 110.3745,
      report_count: 8,
      status: 'in_progress',
      first_detected_at: '2026-05-09T11:45:00Z',
      last_detected_at: '2026-05-09T11:45:00Z',
      validation_methods: ['camera', 'imu'],
    },
    {
      id: 5,
      lat: -7.7710,
      lon: 110.3760,
      report_count: 12,
      status: 'active',
      first_detected_at: '2026-05-10T16:00:00Z',
      last_detected_at: '2026-05-10T16:00:00Z',
      validation_methods: ['camera', 'imu'],
    },
  ];

  if (isPgConnected()) {
    // Clear & seed PostgreSQL table
    await query('TRUNCATE TABLE potholes RESTART IDENTITY');
    for (const p of seedPotholes) {
      await query(
        `INSERT INTO potholes (lat, lon, report_count, status, first_detected_at, last_detected_at, updated_at, validation_methods)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7)`,
        [p.lat, p.lon, p.report_count, p.status, p.first_detected_at, p.last_detected_at, JSON.stringify(p.validation_methods)]
      );
    }
  } else {
    memoryDb.potholes = seedPotholes.map((p) => ({
      ...p,
      updated_at: new Date().toISOString(),
    }));
    memoryDb.nextId = 6;
  }

  return seedPotholes;
}

module.exports = {
  processBatchUpload,
  getSyncData,
  getAllPotholes,
  getPotholeById,
  updatePotholeStatus,
  seedInitialPotholes,
};
