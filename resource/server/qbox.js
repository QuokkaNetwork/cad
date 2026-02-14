const mysql = require('mysql2/promise');
const config = require('../shared/config');
const { getExternalDbConfig } = require('./db');

let pool;
let externalPool;
let externalPoolKey;

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

function isSafeIdentifier(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_]+$/.test(value);
}

function isSafeJsonPath(value) {
  return typeof value === 'string' && value.startsWith('$.') && /^[A-Za-z0-9_.$\[\]"]+$/.test(value);
}

function qi(value) {
  if (!isSafeIdentifier(value)) {
    throw new Error(`Invalid database identifier: ${value}`);
  }
  return `\`${value}\``;
}

function makeExpr(column, jsonPath) {
  if (column && isSafeIdentifier(column)) {
    return { sql: qi(column), params: [] };
  }

  return null;
}

function makeJsonExpr(jsonColumn, jsonPath) {
  if (!isSafeIdentifier(jsonColumn) || !isSafeJsonPath(jsonPath)) {
    return null;
  }
  return {
    sql: `JSON_UNQUOTE(JSON_EXTRACT(${qi(jsonColumn)}, ?))`,
    params: [jsonPath],
  };
}

function getExternalPool(cfg) {
  const key = JSON.stringify({
    host: cfg.host,
    port: Number(cfg.port) || 3306,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
  });

  if (!externalPool || externalPoolKey !== key) {
    if (externalPool) {
      externalPool.end().catch(() => {});
    }
    externalPool = mysql.createPool({
      host: cfg.host,
      port: Number(cfg.port) || 3306,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    });
    externalPoolKey = key;
  }

  return externalPool;
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

function shouldUseExternalDb(cfg) {
  return Boolean(
    cfg.enabled &&
    cfg.host &&
    cfg.user &&
    cfg.database
  );
}

async function searchCharactersExternal(term, cfg) {
  if (!isSafeIdentifier(cfg.character_table) || !isSafeIdentifier(cfg.character_id_field)) {
    throw new Error('External DB character table/id field is invalid');
  }

  const firstExpr = makeExpr(cfg.character_firstname_field) || makeJsonExpr(cfg.character_json_field, cfg.character_json_firstname_path);
  const lastExpr = makeExpr(cfg.character_lastname_field) || makeJsonExpr(cfg.character_json_field, cfg.character_json_lastname_path);
  const birthExpr = makeExpr(cfg.character_birthdate_field) || makeJsonExpr(cfg.character_json_field, cfg.character_json_birthdate_path);
  const phoneExpr = makeExpr(cfg.character_phone_field) || makeJsonExpr(cfg.character_json_field, cfg.character_json_phone_path);

  if (!firstExpr || !lastExpr) {
    throw new Error('External DB character field mapping is incomplete');
  }

  const idExpr = { sql: qi(cfg.character_id_field), params: [] };
  const tableExpr = qi(cfg.character_table);

  const selectParams = [
    ...idExpr.params,
    ...firstExpr.params,
    ...lastExpr.params,
    ...birthExpr.params,
    ...phoneExpr.params,
  ];
  const whereParams = [
    ...firstExpr.params,
    ...lastExpr.params,
    ...idExpr.params,
  ];

  const search = `%${term.toLowerCase()}%`;

  const sql = `
    SELECT
      ${idExpr.sql} AS citizenid,
      ${firstExpr.sql} AS firstname,
      ${lastExpr.sql} AS lastname,
      ${birthExpr.sql} AS birthdate,
      ${phoneExpr.sql} AS phone
    FROM ${tableExpr}
    WHERE LOWER(CAST(${firstExpr.sql} AS CHAR)) LIKE ?
       OR LOWER(CAST(${lastExpr.sql} AS CHAR)) LIKE ?
       OR LOWER(CAST(${idExpr.sql} AS CHAR)) LIKE ?
    LIMIT 25
  `;

  const params = [
    ...selectParams,
    ...whereParams,
    search,
    search,
    search,
  ];

  const p = getExternalPool(cfg);
  const [rows] = await p.query(sql, params);
  return rows.map((row) => ({
    citizenid: row.citizenid || '',
    firstname: row.firstname || '',
    lastname: row.lastname || '',
    birthdate: row.birthdate || '',
    phone: row.phone || '',
  }));
}

async function searchVehiclesExternal(term, cfg) {
  const required = [cfg.vehicle_table, cfg.vehicle_plate_field, cfg.vehicle_model_field, cfg.vehicle_owner_field];
  if (!required.every(isSafeIdentifier)) {
    throw new Error('External DB vehicle field mapping is invalid');
  }

  const search = `%${term.toLowerCase()}%`;
  const p = getExternalPool(cfg);
  const [rows] = await p.query(
    `
    SELECT
      ${qi(cfg.vehicle_plate_field)} AS plate,
      ${qi(cfg.vehicle_model_field)} AS vehicle,
      ${qi(cfg.vehicle_owner_field)} AS citizenid
    FROM ${qi(cfg.vehicle_table)}
    WHERE LOWER(CAST(${qi(cfg.vehicle_plate_field)} AS CHAR)) LIKE ?
       OR LOWER(CAST(${qi(cfg.vehicle_model_field)} AS CHAR)) LIKE ?
       OR LOWER(CAST(${qi(cfg.vehicle_owner_field)} AS CHAR)) LIKE ?
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

async function searchCharacters(term) {
  const externalCfg = getExternalDbConfig();
  if (shouldUseExternalDb(externalCfg)) {
    return searchCharactersExternal(term, externalCfg);
  }

  const p = getPool();
  const search = `%${term.toLowerCase()}%`;
  const [rows] = await p.query(
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
  const externalCfg = getExternalDbConfig();
  if (shouldUseExternalDb(externalCfg)) {
    return searchVehiclesExternal(term, externalCfg);
  }

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

async function testExternalDbConfig() {
  const externalCfg = getExternalDbConfig();
  if (!shouldUseExternalDb(externalCfg)) {
    return {
      ok: false,
      error: 'External DB is disabled or incomplete',
    };
  }

  try {
    const p = getExternalPool(externalCfg);
    await p.query('SELECT 1');

    const details = {
      characters: false,
      vehicles: false,
    };

    if (isSafeIdentifier(externalCfg.character_table)) {
      await p.query(`SELECT 1 FROM ${qi(externalCfg.character_table)} LIMIT 1`);
      details.characters = true;
    }
    if (isSafeIdentifier(externalCfg.vehicle_table)) {
      await p.query(`SELECT 1 FROM ${qi(externalCfg.vehicle_table)} LIMIT 1`);
      details.vehicles = true;
    }

    return { ok: true, details };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  searchCharacters,
  getCoordsByCitizenId,
  getSourceByCitizenId,
  searchVehicles,
  testExternalDbConfig,
};
