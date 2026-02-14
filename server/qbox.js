const mysql = require('mysql2/promise');
const config = require('../shared/config');

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.qbox.host,
      user: config.qbox.user,
      password: config.qbox.password,
      database: config.qbox.database,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    });
  }
  return pool;
}

function mapCharacter(row) {
  const charinfo = typeof row.charinfo === 'string'
    ? JSON.parse(row.charinfo)
    : row.charinfo || {};

  return {
    citizenid: row.citizenid,
    firstname: charinfo.firstname || '',
    lastname: charinfo.lastname || '',
    birthdate: charinfo.birthdate || '',
    phone: charinfo.phone || '',
  };
}

async function getCoordsByCitizenId(citizenid) {
  const resource = config.qbox.exportResource;
  const exportName = config.qbox.exportName;
  if (!resource || !exportName || typeof global.exports === 'undefined') {
    return null;
  }

  const resourceExports = global.exports[resource];
  if (!resourceExports || typeof resourceExports[exportName] !== 'function') {
    return null;
  }

  try {
    const result = resourceExports[exportName](citizenid);
    return await Promise.resolve(result);
  } catch (err) {
    return null;
  }
}

async function getSourceByCitizenId(citizenid) {
  const resource = config.qbox.exportResource;
  const exportName = config.qbox.exportSourceName;
  if (!resource || !exportName || typeof global.exports === 'undefined') {
    return null;
  }

  const resourceExports = global.exports[resource];
  if (!resourceExports || typeof resourceExports[exportName] !== 'function') {
    return null;
  }

  try {
    const result = resourceExports[exportName](citizenid);
    return await Promise.resolve(result);
  } catch (err) {
    return null;
  }
}

async function searchCharacters(term) {
  const pool = getPool();
  const search = `%${term.toLowerCase()}%`;

  const [rows] = await pool.query(
    `
    SELECT citizenid, charinfo
    FROM players
    WHERE LOWER(JSON_UNQUOTE(JSON_EXTRACT(charinfo, '$.firstname'))) LIKE ?
       OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(charinfo, '$.lastname'))) LIKE ?
       OR LOWER(citizenid) LIKE ?
    LIMIT 25
    `,
    [search, search, search]
  );

  return rows.map(mapCharacter);
}

async function searchVehicles(term) {
  const p = getPool();
  const search = `%${term.toLowerCase()}%`;

  const [rows] = await p.query(
    `
    SELECT plate, vehicle, citizenid
    FROM player_vehicles
    WHERE LOWER(plate) LIKE ?
       OR LOWER(vehicle) LIKE ?
       OR LOWER(citizenid) LIKE ?
    LIMIT 25
    `,
    [search, search, search]
  );

  return rows.map((row) => ({
    plate: row.plate || '',
    vehicle: row.vehicle || '',
    citizenid: row.citizenid || '',
  }));
}

module.exports = {
  searchCharacters,
  getCoordsByCitizenId,
  getSourceByCitizenId,
  searchVehicles,
};
