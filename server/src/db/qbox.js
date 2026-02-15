const mysql = require('mysql2/promise');
const config = require('../config');
const { Settings } = require('./sqlite');

let pool = null;
let poolConfigSignature = '';
const IDENTIFIER_RE = /^[A-Za-z0-9_]+$/;

function getSetting(key, fallback) {
  const value = Settings.get(key);
  return value === undefined || value === null || value === '' ? fallback : value;
}

function escapeIdentifier(identifier, label) {
  if (!IDENTIFIER_RE.test(identifier)) {
    throw new Error(`${label} contains invalid characters`);
  }
  return mysql.escapeId(identifier);
}

function parseJsonSetting(key, fallbackValue = []) {
  let raw = Settings.get(key);
  if (!raw) {
    if (key === 'qbox_person_custom_fields') raw = process.env.QBOX_PERSON_CUSTOM_FIELDS || '';
    if (key === 'qbox_vehicle_custom_fields') raw = process.env.QBOX_VEHICLE_CUSTOM_FIELDS || '';
  }
  if (!raw) return fallbackValue;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`${key} must be a JSON array`);
    }
    return parsed;
  } catch (err) {
    throw new Error(`Invalid JSON in setting ${key}: ${err.message}`);
  }
}

function parseMaybeJson(value) {
  if (value === null || value === undefined) return {};
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function getPathValue(source, path) {
  if (!path) return source;
  const parts = String(path).split('.').filter(Boolean);
  let current = source;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

function normalizeCustomFields(customFields, allowedSources) {
  const normalized = [];
  for (const field of customFields) {
    if (!field || typeof field !== 'object') continue;
    const key = String(field.key || '').trim();
    if (!key) continue;
    const source = String(field.source || 'column').trim();
    if (!allowedSources.includes(source)) continue;
    normalized.push({
      key,
      source,
      column: field.column ? String(field.column).trim() : '',
      path: field.path ? String(field.path).trim() : '',
    });
  }
  return normalized;
}

function buildCustomFieldValues({ row, charinfo, mappings }) {
  const customFields = {};
  for (const mapping of mappings) {
    let value;

    if (mapping.source === 'charinfo') {
      value = getPathValue(charinfo, mapping.path || mapping.key);
    } else if (mapping.source === 'row') {
      value = getPathValue(row, mapping.path || mapping.key);
    } else {
      if (!mapping.column) continue;
      const raw = row[mapping.column];
      if (mapping.path) {
        value = getPathValue(parseMaybeJson(raw), mapping.path);
      } else {
        value = raw;
      }
    }

    if (value !== undefined) {
      customFields[mapping.key] = value;
    }
  }
  return customFields;
}

function getQboxTableConfig() {
  return {
    playersTable: getSetting('qbox_players_table', 'players'),
    vehiclesTable: getSetting('qbox_vehicles_table', 'player_vehicles'),
    citizenIdCol: getSetting('qbox_citizenid_col', 'citizenid'),
    charInfoCol: getSetting('qbox_charinfo_col', 'charinfo'),
  };
}

function getDbConfig() {
  // Try settings table first (admin-configured), fall back to .env
  const host = getSetting('qbox_host', config.qbox.host);
  const port = parseInt(getSetting('qbox_port', config.qbox.port), 10);
  const user = getSetting('qbox_user', config.qbox.user);
  const password = getSetting('qbox_password', config.qbox.password);
  const database = getSetting('qbox_database', config.qbox.database);
  return { host, port, user, password, database };
}

async function initPool() {
  const dbConfig = getDbConfig();
  poolConfigSignature = JSON.stringify(dbConfig);
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
  const currentSignature = JSON.stringify(getDbConfig());
  if (!pool || currentSignature !== poolConfigSignature) {
    await initPool();
  }
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

async function getTableColumns(tableName) {
  const p = await getPool();
  const [rows] = await p.query(
    `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ?
     ORDER BY ORDINAL_POSITION`,
    [tableName]
  );
  return rows.map(r => ({
    name: r.COLUMN_NAME,
    dataType: r.DATA_TYPE,
    columnType: r.COLUMN_TYPE,
    nullable: r.IS_NULLABLE === 'YES',
    isJson: String(r.DATA_TYPE).toLowerCase() === 'json',
  }));
}

function buildColumnsMap(columns) {
  return columns.reduce((acc, col) => {
    acc[col.name] = col;
    return acc;
  }, {});
}

async function inspectConfiguredSchema() {
  const report = {
    success: false,
    message: '',
    config: {},
    players: { exists: false, columns: [], warnings: [] },
    vehicles: { exists: false, columns: [], warnings: [] },
    errors: [],
  };

  try {
    await getPool();
    const cfg = getQboxTableConfig();
    report.config = cfg;

    if (!IDENTIFIER_RE.test(cfg.playersTable) || !IDENTIFIER_RE.test(cfg.vehiclesTable)) {
      report.errors.push('Configured table names contain invalid characters');
      report.message = 'Schema check failed';
      return report;
    }
    if (!IDENTIFIER_RE.test(cfg.citizenIdCol) || !IDENTIFIER_RE.test(cfg.charInfoCol)) {
      report.errors.push('Configured player column names contain invalid characters');
      report.message = 'Schema check failed';
      return report;
    }

    const playersColumns = await getTableColumns(cfg.playersTable);
    const vehiclesColumns = await getTableColumns(cfg.vehiclesTable);
    report.players.exists = playersColumns.length > 0;
    report.players.columns = playersColumns;
    report.vehicles.exists = vehiclesColumns.length > 0;
    report.vehicles.columns = vehiclesColumns;

    if (!report.players.exists) {
      report.errors.push(`Players table "${cfg.playersTable}" was not found`);
    }
    if (!report.vehicles.exists) {
      report.errors.push(`Vehicles table "${cfg.vehiclesTable}" was not found`);
    }

    const playersMap = buildColumnsMap(playersColumns);
    if (report.players.exists && !playersMap[cfg.citizenIdCol]) {
      report.errors.push(`Citizen ID column "${cfg.citizenIdCol}" was not found in "${cfg.playersTable}"`);
    }
    if (report.players.exists && !playersMap[cfg.charInfoCol]) {
      report.errors.push(`Charinfo column "${cfg.charInfoCol}" was not found in "${cfg.playersTable}"`);
    }
    if (playersMap[cfg.charInfoCol] && !playersMap[cfg.charInfoCol].isJson) {
      report.players.warnings.push(`"${cfg.charInfoCol}" is ${playersMap[cfg.charInfoCol].dataType}, not JSON. JSON parsing fallback will be used.`);
    }

    const personMappings = normalizeCustomFields(parseJsonSetting('qbox_person_custom_fields', []), ['column', 'charinfo', 'row']);
    const vehicleMappings = normalizeCustomFields(parseJsonSetting('qbox_vehicle_custom_fields', []), ['column', 'row']);
    const vehiclesMap = buildColumnsMap(vehiclesColumns);

    for (const mapping of personMappings.filter(m => m.source === 'column')) {
      if (!playersMap[mapping.column]) {
        report.players.warnings.push(`Person custom field "${mapping.key}" references missing column "${mapping.column}"`);
      }
    }
    for (const mapping of vehicleMappings.filter(m => m.source === 'column')) {
      if (!vehiclesMap[mapping.column]) {
        report.vehicles.warnings.push(`Vehicle custom field "${mapping.key}" references missing column "${mapping.column}"`);
      }
    }

    report.success = report.errors.length === 0;
    report.message = report.success ? 'Schema check completed' : 'Schema check failed';
    return report;
  } catch (err) {
    report.errors.push(err.message);
    report.message = 'Schema check failed';
    return report;
  }
}

async function searchCharacters(term) {
  try {
    const p = await getPool();
    const { playersTable, citizenIdCol, charInfoCol } = getQboxTableConfig();
    const tableNameSql = escapeIdentifier(playersTable, 'players table');
    const citizenIdColSql = escapeIdentifier(citizenIdCol, 'citizen ID column');
    const charInfoColSql = escapeIdentifier(charInfoCol, 'charinfo column');
    const personMappings = normalizeCustomFields(parseJsonSetting('qbox_person_custom_fields', []), ['column', 'charinfo', 'row']);

    const columnMappings = personMappings.filter(m => m.source === 'column' && m.column && IDENTIFIER_RE.test(m.column));
    const selectCustomColumns = columnMappings
      .map(m => `${escapeIdentifier(m.column, `person custom field column "${m.key}"`)} AS ${escapeIdentifier(`cf_${m.key}`, 'person custom field alias')}`)
      .join(', ');
    const selectCustomColumnsSql = selectCustomColumns ? `, ${selectCustomColumns}` : '';
    const normalizedTerm = `%${String(term).trim().toLowerCase()}%`;

    const [rows] = await p.query(
      `SELECT ${citizenIdColSql} as citizenid, ${charInfoColSql} as charinfo${selectCustomColumnsSql}
       FROM ${tableNameSql}
       WHERE ${citizenIdColSql} LIKE ?
         OR CAST(${charInfoColSql} AS CHAR) LIKE ?
         OR LOWER(CASE WHEN JSON_VALID(${charInfoColSql}) THEN JSON_UNQUOTE(JSON_EXTRACT(${charInfoColSql}, '$.firstname')) ELSE '' END) LIKE ?
         OR LOWER(CASE WHEN JSON_VALID(${charInfoColSql}) THEN JSON_UNQUOTE(JSON_EXTRACT(${charInfoColSql}, '$.lastname')) ELSE '' END) LIKE ?
         OR LOWER(CASE WHEN JSON_VALID(${charInfoColSql}) THEN CONCAT(
              COALESCE(JSON_UNQUOTE(JSON_EXTRACT(${charInfoColSql}, '$.firstname')), ''),
              ' ',
              COALESCE(JSON_UNQUOTE(JSON_EXTRACT(${charInfoColSql}, '$.lastname')), '')
            ) ELSE '' END) LIKE ?
       LIMIT 25`,
      [`%${term}%`, `%${term}%`, normalizedTerm, normalizedTerm, normalizedTerm]
    );

    return rows.map(row => {
      const info = parseMaybeJson(row.charinfo);
      const normalizedRow = { ...row };
      for (const mapping of columnMappings) {
        normalizedRow[mapping.column] = row[`cf_${mapping.key}`];
      }
      const customFields = buildCustomFieldValues({ row: normalizedRow, charinfo: info, mappings: personMappings });

      return {
        citizenid: row.citizenid,
        firstname: info.firstname || '',
        lastname: info.lastname || '',
        birthdate: info.birthdate || '',
        gender: info.gender !== undefined ? String(info.gender) : '',
        phone: info.phone || '',
        nationality: info.nationality || '',
        custom_fields: customFields,
      };
    });
  } catch (err) {
    console.error('QBox character search error:', err);
    throw new Error(`QBox character search error: ${err.message}`);
  }
}

async function getCharacterById(citizenId) {
  try {
    const p = await getPool();
    const { playersTable, citizenIdCol, charInfoCol } = getQboxTableConfig();
    const tableNameSql = escapeIdentifier(playersTable, 'players table');
    const citizenIdColSql = escapeIdentifier(citizenIdCol, 'citizen ID column');
    const charInfoColSql = escapeIdentifier(charInfoCol, 'charinfo column');
    const personMappings = normalizeCustomFields(parseJsonSetting('qbox_person_custom_fields', []), ['column', 'charinfo', 'row']);

    const [rows] = await p.query(
      `SELECT * FROM ${tableNameSql} WHERE ${citizenIdColSql} = ? LIMIT 1`,
      [citizenId]
    );

    if (rows.length === 0) return null;
    const row = rows[0];
    const info = parseMaybeJson(row[charInfoCol]);
    const customFields = buildCustomFieldValues({ row, charinfo: info, mappings: personMappings });

    return {
      citizenid: row[citizenIdCol],
      firstname: info.firstname || '',
      lastname: info.lastname || '',
      birthdate: info.birthdate || '',
      gender: info.gender !== undefined ? String(info.gender) : '',
      phone: info.phone || '',
      nationality: info.nationality || '',
      custom_fields: customFields,
      raw: row,
    };
  } catch (err) {
    console.error('QBox get character error:', err);
    throw new Error(`QBox character lookup error: ${err.message}`);
  }
}

async function searchVehicles(term) {
  try {
    const p = await getPool();
    const { vehiclesTable } = getQboxTableConfig();
    const tableNameSql = escapeIdentifier(vehiclesTable, 'vehicles table');
    const vehicleMappings = normalizeCustomFields(parseJsonSetting('qbox_vehicle_custom_fields', []), ['column', 'row']);

    const [rows] = await p.query(
      `SELECT * FROM ${tableNameSql}
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
      custom_fields: buildCustomFieldValues({ row, charinfo: {}, mappings: vehicleMappings }),
    }));
  } catch (err) {
    console.error('QBox vehicle search error:', err);
    throw new Error(`QBox vehicle search error: ${err.message}`);
  }
}

async function getVehiclesByOwner(citizenId) {
  try {
    const p = await getPool();
    const { vehiclesTable } = getQboxTableConfig();
    const tableNameSql = escapeIdentifier(vehiclesTable, 'vehicles table');
    const vehicleMappings = normalizeCustomFields(parseJsonSetting('qbox_vehicle_custom_fields', []), ['column', 'row']);

    const [rows] = await p.query(
      `SELECT * FROM ${tableNameSql} WHERE citizenid = ?`,
      [citizenId]
    );

    return rows.map(row => ({
      plate: row.plate || '',
      vehicle: row.vehicle || '',
      owner: row.citizenid || '',
      garage: row.garage || '',
      state: row.state !== undefined ? String(row.state) : '',
      custom_fields: buildCustomFieldValues({ row, charinfo: {}, mappings: vehicleMappings }),
    }));
  } catch (err) {
    console.error('QBox get vehicles error:', err);
    throw new Error(`QBox vehicle lookup error: ${err.message}`);
  }
}

module.exports = {
  initPool,
  testConnection,
  inspectConfiguredSchema,
  searchCharacters,
  getCharacterById,
  searchVehicles,
  getVehiclesByOwner,
};
