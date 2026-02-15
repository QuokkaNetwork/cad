const mysql = require('mysql2/promise');
const config = require('../config');
const { Settings } = require('./sqlite');

let pool = null;

function getDbConfig() {
  // Try settings table first (admin-configured), fall back to .env
  const host = Settings.get('qbox_host') || config.qbox.host;
  const port = parseInt(Settings.get('qbox_port') || config.qbox.port, 10);
  const user = Settings.get('qbox_user') || config.qbox.user;
  const password = Settings.get('qbox_password') || config.qbox.password;
  const database = Settings.get('qbox_database') || config.qbox.database;
  return { host, port, user, password, database };
}

async function initPool() {
  const dbConfig = getDbConfig();
  if (pool) {
    await pool.end().catch(() => {});
  }
  pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
  });
  return pool;
}

async function getPool() {
  if (!pool) await initPool();
  return pool;
}

async function testConnection() {
  try {
    const p = await initPool();
    const [rows] = await p.query('SELECT 1 as ok');
    return { success: true, message: 'Connected successfully' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

async function searchCharacters(term) {
  try {
    const p = await getPool();
    const tableName = Settings.get('qbox_players_table') || 'players';
    const citizenIdCol = Settings.get('qbox_citizenid_col') || 'citizenid';
    const charInfoCol = Settings.get('qbox_charinfo_col') || 'charinfo';

    const [rows] = await p.query(
      `SELECT ${citizenIdCol} as citizenid, ${charInfoCol} as charinfo
       FROM ${mysql.escapeId(tableName)}
       WHERE ${citizenIdCol} LIKE ? OR ${charInfoCol} LIKE ?
       LIMIT 25`,
      [`%${term}%`, `%${term}%`]
    );

    return rows.map(row => {
      let info = {};
      try {
        info = typeof row.charinfo === 'string' ? JSON.parse(row.charinfo) : row.charinfo || {};
      } catch { /* ignore parse errors */ }
      return {
        citizenid: row.citizenid,
        firstname: info.firstname || '',
        lastname: info.lastname || '',
        birthdate: info.birthdate || '',
        gender: info.gender !== undefined ? String(info.gender) : '',
        phone: info.phone || '',
        nationality: info.nationality || '',
      };
    });
  } catch (err) {
    console.error('QBox character search error:', err.message);
    return [];
  }
}

async function getCharacterById(citizenId) {
  try {
    const p = await getPool();
    const tableName = Settings.get('qbox_players_table') || 'players';
    const citizenIdCol = Settings.get('qbox_citizenid_col') || 'citizenid';
    const charInfoCol = Settings.get('qbox_charinfo_col') || 'charinfo';

    const [rows] = await p.query(
      `SELECT * FROM ${mysql.escapeId(tableName)} WHERE ${citizenIdCol} = ? LIMIT 1`,
      [citizenId]
    );

    if (rows.length === 0) return null;
    const row = rows[0];
    let info = {};
    try {
      info = typeof row[charInfoCol] === 'string' ? JSON.parse(row[charInfoCol]) : row[charInfoCol] || {};
    } catch { /* ignore */ }

    return {
      citizenid: row[citizenIdCol],
      firstname: info.firstname || '',
      lastname: info.lastname || '',
      birthdate: info.birthdate || '',
      gender: info.gender !== undefined ? String(info.gender) : '',
      phone: info.phone || '',
      nationality: info.nationality || '',
      raw: row,
    };
  } catch (err) {
    console.error('QBox get character error:', err.message);
    return null;
  }
}

async function searchVehicles(term) {
  try {
    const p = await getPool();
    const tableName = Settings.get('qbox_vehicles_table') || 'player_vehicles';

    const [rows] = await p.query(
      `SELECT * FROM ${mysql.escapeId(tableName)}
       WHERE plate LIKE ? OR vehicle LIKE ?
       LIMIT 25`,
      [`%${term}%`, `%${term}%`]
    );

    return rows.map(row => ({
      plate: row.plate || '',
      vehicle: row.vehicle || '',
      owner: row.citizenid || '',
      garage: row.garage || '',
      state: row.state !== undefined ? String(row.state) : '',
    }));
  } catch (err) {
    console.error('QBox vehicle search error:', err.message);
    return [];
  }
}

async function getVehiclesByOwner(citizenId) {
  try {
    const p = await getPool();
    const tableName = Settings.get('qbox_vehicles_table') || 'player_vehicles';

    const [rows] = await p.query(
      `SELECT * FROM ${mysql.escapeId(tableName)} WHERE citizenid = ?`,
      [citizenId]
    );

    return rows.map(row => ({
      plate: row.plate || '',
      vehicle: row.vehicle || '',
      owner: row.citizenid || '',
      garage: row.garage || '',
      state: row.state !== undefined ? String(row.state) : '',
    }));
  } catch (err) {
    console.error('QBox get vehicles error:', err.message);
    return [];
  }
}

module.exports = {
  initPool,
  testConnection,
  searchCharacters,
  getCharacterById,
  searchVehicles,
  getVehiclesByOwner,
};
