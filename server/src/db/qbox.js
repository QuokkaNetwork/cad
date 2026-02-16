const mysql = require('mysql2/promise');
const config = require('../config');
const { Settings, FieldMappingCategories, FieldMappings } = require('./sqlite');

let pool = null;
let poolConfigSignature = '';
const IDENTIFIER_RE = /^[A-Za-z0-9_]+$/;
const FIELD_MAPPING_TYPES = new Set(['text', 'number', 'date', 'image', 'phone', 'email', 'boolean', 'select', 'badge']);

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

function isMeaningfulValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(v => isMeaningfulValue(v));
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function valueToSignature(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function valueToDisplay(value) {
  if (!isMeaningfulValue(value)) return '';
  if (Array.isArray(value)) {
    return value.map(v => valueToDisplay(v)).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function normalizeFriendlyValuesMap(value) {
  if (!value) return { map: {}, json: '' };

  let parsed = null;
  if (typeof value === 'string') {
    const text = String(value || '').trim();
    if (!text) return { map: {}, json: '' };
    parsed = parseMaybeJson(text);
  } else if (typeof value === 'object' && !Array.isArray(value)) {
    parsed = value;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { map: {}, json: '' };
  }

  const normalized = {};
  for (const [rawKey, rawLabel] of Object.entries(parsed)) {
    const key = String(rawKey || '').trim();
    if (!key) continue;
    normalized[key] = rawLabel === null || rawLabel === undefined
      ? ''
      : String(rawLabel);
  }

  if (Object.keys(normalized).length === 0) {
    return { map: {}, json: '' };
  }

  return { map: normalized, json: JSON.stringify(normalized) };
}

function applyFriendlyValueMap(value, friendlyValuesMap) {
  if (!friendlyValuesMap || typeof friendlyValuesMap !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(item => applyFriendlyValueMap(item, friendlyValuesMap));
  }
  if (value === null || value === undefined) return value;
  if (typeof value === 'object') return value;

  const directKey = typeof value === 'string' ? value.trim() : String(value);
  if (Object.prototype.hasOwnProperty.call(friendlyValuesMap, directKey)) {
    return friendlyValuesMap[directKey];
  }

  const lowerKey = directKey.toLowerCase();
  if (lowerKey !== directKey && Object.prototype.hasOwnProperty.call(friendlyValuesMap, lowerKey)) {
    return friendlyValuesMap[lowerKey];
  }

  return value;
}

function normalizeFieldKey(value, fallbackLabel = '') {
  let key = String(value || '').trim().toLowerCase();
  if (!key && fallbackLabel) {
    key = String(fallbackLabel || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }
  return key;
}

function normalizeFieldType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return FIELD_MAPPING_TYPES.has(normalized) ? normalized : 'text';
}

function normalizePreviewWidth(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(4, Math.trunc(parsed)));
}

function getBaseRowsForTable(baseRowsByTable, tableName) {
  if (!baseRowsByTable || typeof baseRowsByTable !== 'object') return null;
  if (Array.isArray(baseRowsByTable[tableName])) return baseRowsByTable[tableName];

  const target = String(tableName || '').toLowerCase();
  for (const [key, rows] of Object.entries(baseRowsByTable)) {
    if (String(key || '').toLowerCase() === target && Array.isArray(rows)) {
      return rows;
    }
  }
  return null;
}

function normalizeDatabaseFieldMappings(entityType = 'person') {
  const normalizedType = String(entityType || '').trim().toLowerCase() === 'vehicle' ? 'vehicle' : 'person';
  let categories = [];
  let rows = [];
  try {
    categories = FieldMappingCategories.list(normalizedType);
    rows = FieldMappings.listAll(normalizedType);
  } catch (err) {
    if (String(err?.message || '').toLowerCase().includes('no such table')) {
      return { categories: [], mappings: [] };
    }
    throw err;
  }
  const categoryMap = new Map(categories.map(category => [category.id, category]));
  const mappings = [];

  for (const row of rows) {
    const category = categoryMap.get(row.category_id);
    if (!category) continue;

    const label = String(row.label || '').trim();
    const tableName = String(row.table_name || '').trim();
    const columnName = String(row.column_name || '').trim();
    const joinColumn = String(row.character_join_column || '').trim();
    const jsonKey = String(row.json_key || '').trim();
    const fieldKey = normalizeFieldKey(row.field_key, label);
    const fieldType = normalizeFieldType(row.field_type);
    const previewWidth = normalizePreviewWidth(row.preview_width);
    const friendlyValues = normalizeFriendlyValuesMap(row.friendly_values_json);

    if (!label || !tableName || !columnName || !joinColumn) continue;
    if (!IDENTIFIER_RE.test(tableName) || !IDENTIFIER_RE.test(columnName) || !IDENTIFIER_RE.test(joinColumn)) continue;

    mappings.push({
      id: row.id,
      category_id: row.category_id,
      category_name: String(category.name || '').trim() || String(row.category_name || '').trim() || 'Uncategorized',
      category_sort_order: Number.isFinite(Number(category.sort_order)) ? Number(category.sort_order) : 0,
      label,
      table_name: tableName,
      column_name: columnName,
      character_join_column: joinColumn,
      is_json: !!row.is_json,
      json_key: jsonKey,
      is_search_column: !!row.is_search_column,
      field_key: fieldKey,
      field_type: fieldType,
      preview_width: previewWidth,
      friendly_values_map: friendlyValues.map,
      friendly_values_json: friendlyValues.json,
      sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
      entity_type: normalizedType,
    });
  }

  return { categories, mappings };
}

function flattenLookupFields(categories = []) {
  const lookupFields = [];
  for (const category of Array.isArray(categories) ? categories : []) {
    const fields = Array.isArray(category?.fields) ? category.fields : [];
    for (const field of fields) {
      const displayValue = String(field?.display_value || '').trim();
      if (!displayValue) continue;
      lookupFields.push({
        id: field.id,
        key: String(field.field_key || '').trim() || normalizeFieldKey(field.label, field.label),
        label: String(field.label || '').trim() || 'Field',
        value: field.value,
        display_value: displayValue,
        field_type: normalizeFieldType(field.field_type),
        preview_width: normalizePreviewWidth(field.preview_width),
        sort_order: Number.isFinite(Number(field.sort_order)) ? Number(field.sort_order) : 0,
        category_id: Number(field.category_id || 0),
        category_name: String(category?.name || '').trim() || 'Uncategorized',
      });
    }
  }
  return lookupFields;
}

async function queryRowsByMappingSource({ poolRef, tableName, joinColumn, joinValue }) {
  const tableNameSql = escapeIdentifier(tableName, `mapping table "${tableName}"`);
  const joinColSql = escapeIdentifier(joinColumn, `mapping join column "${joinColumn}"`);
  const [rows] = await poolRef.query(
    `SELECT * FROM ${tableNameSql} WHERE ${joinColSql} = ? LIMIT 100`,
    [joinValue]
  );
  return Array.isArray(rows) ? rows : [];
}

function extractValueFromMappingRow(row, mapping) {
  const raw = row?.[mapping.column_name];
  if (mapping.is_json) {
    const parsed = parseMaybeJson(raw);
    if (!mapping.json_key) return parsed;
    return getPathValue(parsed, mapping.json_key);
  }
  return raw;
}

function collectMappingValues(rows, mapping) {
  const values = [];
  const seen = new Set();
  for (const row of rows) {
    const value = extractValueFromMappingRow(row, mapping);
    if (!isMeaningfulValue(value)) continue;
    const signature = valueToSignature(value);
    if (seen.has(signature)) continue;
    seen.add(signature);
    values.push(value);
  }
  return values;
}

async function resolveMappedFieldData({
  entityType = 'person',
  joinValue,
  baseRowsByTable = {},
  includeSearchOnly = false, // DEPRECATED: All fields are now always included
}) {
  const normalizedJoinValue = String(joinValue || '').trim();
  if (!normalizedJoinValue) {
    return { categories: [], custom_fields: {} };
  }

  const { categories, mappings } = normalizeDatabaseFieldMappings(entityType);
  // Always include all mappings - the includeSearchOnly parameter is deprecated
  const activeMappings = mappings;

  if (activeMappings.length === 0) {
    return { categories: [], custom_fields: {} };
  }

  const activeCategoryIds = new Set(activeMappings.map(mapping => mapping.category_id));
  const resolvedCategories = categories
    .filter(category => activeCategoryIds.has(category.id))
    .map(category => ({
      id: category.id,
      name: String(category.name || '').trim() || 'Uncategorized',
      entity_type: category.entity_type,
      sort_order: Number.isFinite(Number(category.sort_order)) ? Number(category.sort_order) : 0,
      fields: [],
    }));

  const categoryMap = new Map(resolvedCategories.map(category => [category.id, category]));
  const rowsCache = new Map();
  const customFields = {};
  const poolRef = await getPool();

  for (const mapping of activeMappings) {
    const sourceKey = `${mapping.table_name}::${mapping.character_join_column}`;
    let sourceRows = rowsCache.get(sourceKey);

    if (!sourceRows) {
      const seededRows = getBaseRowsForTable(baseRowsByTable, mapping.table_name);
      if (Array.isArray(seededRows) && seededRows.length > 0) {
        const filteredRows = seededRows.filter((row) => {
          const joinCandidate = String(row?.[mapping.character_join_column] || '').trim();
          return joinCandidate === normalizedJoinValue;
        });
        if (filteredRows.length > 0) {
          sourceRows = filteredRows;
        }
      }

      if (!sourceRows) {
        try {
          sourceRows = await queryRowsByMappingSource({
            poolRef,
            tableName: mapping.table_name,
            joinColumn: mapping.character_join_column,
            joinValue: normalizedJoinValue,
          });
        } catch (err) {
          console.warn('[QBox] Failed to resolve mapped field source:', {
            table: mapping.table_name,
            join_column: mapping.character_join_column,
            label: mapping.label,
            error: err?.message || String(err),
          });
          sourceRows = [];
        }
      }

      rowsCache.set(sourceKey, sourceRows);
    }

    const values = collectMappingValues(sourceRows, mapping);
    const rawFieldValue = values.length === 0 ? null : (values.length === 1 ? values[0] : values);
    const fieldValue = applyFriendlyValueMap(rawFieldValue, mapping.friendly_values_map);
    const displayValue = valueToDisplay(fieldValue);

    const category = categoryMap.get(mapping.category_id);
    if (category) {
      category.fields.push({
        id: mapping.id,
        key: mapping.field_key,
        label: mapping.label,
        value: fieldValue,
        raw_value: rawFieldValue,
        display_value: displayValue,
        is_empty: !isMeaningfulValue(fieldValue),
        field_key: mapping.field_key,
        field_type: mapping.field_type,
        preview_width: mapping.preview_width,
        category_id: mapping.category_id,
        table_name: mapping.table_name,
        column_name: mapping.column_name,
        character_join_column: mapping.character_join_column,
        is_json: mapping.is_json,
        json_key: mapping.json_key,
        sort_order: mapping.sort_order,
        is_search_column: mapping.is_search_column,
        friendly_values_json: mapping.friendly_values_json,
      });
    }

    if (displayValue) {
      customFields[mapping.label] = displayValue;
    }
  }

  return {
    categories: resolvedCategories,
    custom_fields: customFields,
  };
}

function normalizeJobName(value) {
  return String(value || '').trim();
}

function normalizeJobGrade(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

function parseJobContainer(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseMaybeJson(trimmed);
  if (parsed && typeof parsed === 'object') return parsed;
  return { name: trimmed };
}

function extractJobFromCharacterRow(row, charinfo, configuredJobColumn) {
  const candidateContainers = [];
  if (configuredJobColumn && row && Object.prototype.hasOwnProperty.call(row, configuredJobColumn)) {
    candidateContainers.push(parseJobContainer(row[configuredJobColumn]));
  }
  if ((!configuredJobColumn || configuredJobColumn !== 'job') && row && Object.prototype.hasOwnProperty.call(row, 'job')) {
    candidateContainers.push(parseJobContainer(row.job));
  }
  if (charinfo && typeof charinfo === 'object' && Object.prototype.hasOwnProperty.call(charinfo, 'job')) {
    candidateContainers.push(parseJobContainer(charinfo.job));
  }

  let jobName = '';
  let jobGrade = null;
  for (const container of candidateContainers) {
    if (!container || typeof container !== 'object') continue;

    if (!jobName) {
      const candidateName = (
        container.name
        || container.job
        || container.id
        || container.label
      );
      jobName = normalizeJobName(candidateName);
    }

    if (jobGrade === null) {
      if (container.grade && typeof container.grade === 'object') {
        jobGrade = normalizeJobGrade(
          container.grade.level
          ?? container.grade.grade
          ?? container.grade.value
          ?? container.grade.rank
        );
      } else if (container.grade !== undefined) {
        jobGrade = normalizeJobGrade(container.grade);
      } else if (container.grade_level !== undefined) {
        jobGrade = normalizeJobGrade(container.grade_level);
      } else if (container.rank !== undefined) {
        jobGrade = normalizeJobGrade(container.rank);
      }
    }
  }

  if (!jobName && row && typeof row === 'object') {
    if (row.job_name !== undefined) {
      jobName = normalizeJobName(row.job_name);
    }
    if (jobGrade === null && row.job_grade !== undefined) {
      jobGrade = normalizeJobGrade(row.job_grade);
    }
  }

  if (!jobName) return null;
  return {
    name: jobName,
    grade: jobGrade === null ? 0 : normalizeJobGrade(jobGrade),
  };
}

function getQboxTableConfig() {
  return {
    playersTable: getSetting('qbox_players_table', 'players'),
    vehiclesTable: getSetting('qbox_vehicles_table', 'player_vehicles'),
    citizenIdCol: getSetting('qbox_citizenid_col', 'citizenid'),
    charInfoCol: getSetting('qbox_charinfo_col', 'charinfo'),
    moneyCol: getSetting('qbox_money_col', 'money'),
    jobCol: getSetting('qbox_job_col', 'job'),
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

async function listTableColumns(tableName) {
  const normalized = String(tableName || '').trim();
  if (!normalized) throw new Error('table_name is required');
  if (!IDENTIFIER_RE.test(normalized)) throw new Error('table_name contains invalid characters');
  return getTableColumns(normalized);
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
    if (!IDENTIFIER_RE.test(cfg.citizenIdCol) || !IDENTIFIER_RE.test(cfg.charInfoCol) || !IDENTIFIER_RE.test(cfg.moneyCol) || !IDENTIFIER_RE.test(cfg.jobCol)) {
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
    if (report.players.exists && !playersMap[cfg.moneyCol]) {
      report.players.warnings.push(`Money column "${cfg.moneyCol}" was not found in "${cfg.playersTable}"`);
    }
    if (report.players.exists && !playersMap[cfg.jobCol]) {
      report.players.warnings.push(`Job column "${cfg.jobCol}" was not found in "${cfg.playersTable}"`);
    }
    if (playersMap[cfg.charInfoCol] && !playersMap[cfg.charInfoCol].isJson) {
      report.players.warnings.push(`"${cfg.charInfoCol}" is ${playersMap[cfg.charInfoCol].dataType}, not JSON. JSON parsing fallback will be used.`);
    }

    const legacyPersonMappings = normalizeCustomFields(parseJsonSetting('qbox_person_custom_fields', []), ['column', 'charinfo', 'row']);
    const legacyVehicleMappings = normalizeCustomFields(parseJsonSetting('qbox_vehicle_custom_fields', []), ['column', 'row']);
    const vehiclesMap = buildColumnsMap(vehiclesColumns);

    for (const mapping of legacyPersonMappings.filter(m => m.source === 'column')) {
      if (!playersMap[mapping.column]) {
        report.players.warnings.push(`Person custom field "${mapping.key}" references missing column "${mapping.column}"`);
      }
    }
    for (const mapping of legacyVehicleMappings.filter(m => m.source === 'column')) {
      if (!vehiclesMap[mapping.column]) {
        report.vehicles.warnings.push(`Vehicle custom field "${mapping.key}" references missing column "${mapping.column}"`);
      }
    }

    const dbPersonMappings = normalizeDatabaseFieldMappings('person').mappings;
    const dbVehicleMappings = normalizeDatabaseFieldMappings('vehicle').mappings;
    const tableColumnsCache = new Map([
      [cfg.playersTable, playersColumns],
      [cfg.vehiclesTable, vehiclesColumns],
    ]);

    for (const mapping of [...dbPersonMappings, ...dbVehicleMappings]) {
      const warningBucket = mapping.entity_type === 'vehicle' ? report.vehicles.warnings : report.players.warnings;

      let columns = tableColumnsCache.get(mapping.table_name);
      if (!columns) {
        try {
          columns = await getTableColumns(mapping.table_name);
        } catch {
          columns = [];
        }
        tableColumnsCache.set(mapping.table_name, columns);
      }

      if (!columns.length) {
        warningBucket.push(`Field mapping "${mapping.label}" references missing table "${mapping.table_name}"`);
        continue;
      }

      const cols = buildColumnsMap(columns);
      if (!cols[mapping.column_name]) {
        warningBucket.push(`Field mapping "${mapping.label}" references missing column "${mapping.column_name}" in "${mapping.table_name}"`);
      }
      if (!cols[mapping.character_join_column]) {
        warningBucket.push(`Field mapping "${mapping.label}" references missing join column "${mapping.character_join_column}" in "${mapping.table_name}"`);
      }
      if (mapping.is_json && !mapping.json_key) {
        warningBucket.push(`Field mapping "${mapping.label}" has JSON mode enabled but JSON key is blank`);
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
    const normalizedTerm = `%${String(term).trim().toLowerCase()}%`;

    const [rows] = await p.query(
      `SELECT *
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

    return Promise.all(rows.map(async (row) => {
      const citizenId = String(row[citizenIdCol] || '').trim();
      const info = parseMaybeJson(row[charInfoCol]);
      const legacyCustomFields = buildCustomFieldValues({ row, charinfo: info, mappings: personMappings });
      const mapped = await resolveMappedFieldData({
        entityType: 'person',
        joinValue: citizenId,
        baseRowsByTable: { [playersTable]: [row] },
        includeSearchOnly: true,
      });
      const mappedLookupFields = flattenLookupFields(mapped.categories);
      const fallbackLookupFields = [
        { key: 'first_name', label: 'First Name', display_value: String(info.firstname || '').trim(), field_type: 'text', preview_width: 1, sort_order: 0, category_name: 'Identity' },
        { key: 'last_name', label: 'Last Name', display_value: String(info.lastname || '').trim(), field_type: 'text', preview_width: 1, sort_order: 1, category_name: 'Identity' },
        { key: 'dob', label: 'DOB', display_value: String(info.birthdate || '').trim(), field_type: 'date', preview_width: 1, sort_order: 2, category_name: 'Identity' },
        { key: 'phone', label: 'Phone', display_value: String(info.phone || '').trim(), field_type: 'phone', preview_width: 1, sort_order: 3, category_name: 'Contact' },
      ].filter((field) => String(field.display_value || '').trim().length > 0);
      const lookupFields = mappedLookupFields.length > 0 ? mappedLookupFields : fallbackLookupFields;

      return {
        citizenid: citizenId,
        firstname: info.firstname || '',
        lastname: info.lastname || '',
        birthdate: info.birthdate || '',
        gender: info.gender !== undefined ? String(info.gender) : '',
        phone: info.phone || '',
        nationality: info.nationality || '',
        custom_fields: {
          ...legacyCustomFields,
          ...mapped.custom_fields,
        },
        lookup_fields: lookupFields,
      };
    }));
  } catch (err) {
    console.error('QBox character search error:', err);
    throw new Error(`QBox character search error: ${err.message}`);
  }
}

async function getCharacterById(citizenId) {
  try {
    const p = await getPool();
    const {
      playersTable,
      citizenIdCol,
      charInfoCol,
      jobCol,
    } = getQboxTableConfig();
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
    const normalizedCitizenId = String(row[citizenIdCol] || '').trim();
    const legacyCustomFields = buildCustomFieldValues({ row, charinfo: info, mappings: personMappings });
    const mapped = await resolveMappedFieldData({
      entityType: 'person',
      joinValue: normalizedCitizenId,
      baseRowsByTable: { [playersTable]: [row] },
    });
    const mappedLookup = await resolveMappedFieldData({
      entityType: 'person',
      joinValue: normalizedCitizenId,
      baseRowsByTable: { [playersTable]: [row] },
      includeSearchOnly: true,
    });
    const extractedJob = extractJobFromCharacterRow(row, info, jobCol);

    return {
      citizenid: normalizedCitizenId,
      firstname: info.firstname || '',
      lastname: info.lastname || '',
      birthdate: info.birthdate || '',
      gender: info.gender !== undefined ? String(info.gender) : '',
      phone: info.phone || '',
      nationality: info.nationality || '',
      job: extractedJob,
      custom_fields: {
        ...legacyCustomFields,
        ...mapped.custom_fields,
      },
      mapped_categories: mapped.categories,
      lookup_fields: flattenLookupFields(mappedLookup.categories),
      raw: row,
    };
  } catch (err) {
    console.error('QBox get character error:', err);
    throw new Error(`QBox character lookup error: ${err.message}`);
  }
}

async function getCharacterJobById(citizenId) {
  const character = await getCharacterById(citizenId);
  if (!character || !character.job || !character.job.name) {
    return null;
  }
  return {
    citizenid: String(character.citizenid || '').trim(),
    name: normalizeJobName(character.job.name),
    grade: normalizeJobGrade(character.job.grade),
  };
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

    return Promise.all(rows.map(async (row) => {
      const ownerCitizenId = String(row.citizenid || row.owner || '').trim();
      const legacyCustomFields = buildCustomFieldValues({ row, charinfo: {}, mappings: vehicleMappings });
      const mapped = ownerCitizenId
        ? await resolveMappedFieldData({
          entityType: 'vehicle',
          joinValue: ownerCitizenId,
          baseRowsByTable: { [vehiclesTable]: [row] },
          includeSearchOnly: true,
        })
        : { custom_fields: {} };
      const mappedLookupFields = flattenLookupFields(mapped.categories || []);
      const fallbackLookupFields = [
        { key: 'plate', label: 'Plate', display_value: String(row.plate || '').trim(), field_type: 'text', preview_width: 1, sort_order: 0, category_name: 'Vehicle' },
        { key: 'model', label: 'Model', display_value: String(row.vehicle || '').trim(), field_type: 'text', preview_width: 1, sort_order: 1, category_name: 'Vehicle' },
        { key: 'state', label: 'State', display_value: row.state !== undefined ? String(row.state) : '', field_type: 'text', preview_width: 1, sort_order: 2, category_name: 'Vehicle' },
      ].filter((field) => String(field.display_value || '').trim().length > 0);
      const lookupFields = mappedLookupFields.length > 0 ? mappedLookupFields : fallbackLookupFields;

      return {
        plate: row.plate || '',
        vehicle: row.vehicle || '',
        owner: ownerCitizenId,
        garage: row.garage || '',
        state: row.state !== undefined ? String(row.state) : '',
        custom_fields: {
          ...legacyCustomFields,
          ...mapped.custom_fields,
        },
        lookup_fields: lookupFields,
      };
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

    return Promise.all(rows.map(async (row) => {
      const ownerCitizenId = String(row.citizenid || row.owner || citizenId || '').trim();
      const legacyCustomFields = buildCustomFieldValues({ row, charinfo: {}, mappings: vehicleMappings });
      const mapped = ownerCitizenId
        ? await resolveMappedFieldData({
          entityType: 'vehicle',
          joinValue: ownerCitizenId,
          baseRowsByTable: { [vehiclesTable]: [row] },
        })
        : { categories: [], custom_fields: {} };
      const mappedLookup = ownerCitizenId
        ? await resolveMappedFieldData({
          entityType: 'vehicle',
          joinValue: ownerCitizenId,
          baseRowsByTable: { [vehiclesTable]: [row] },
          includeSearchOnly: true,
        })
        : { categories: [] };

      return {
        plate: row.plate || '',
        vehicle: row.vehicle || '',
        owner: ownerCitizenId,
        garage: row.garage || '',
        state: row.state !== undefined ? String(row.state) : '',
        custom_fields: {
          ...legacyCustomFields,
          ...mapped.custom_fields,
        },
        mapped_categories: mapped.categories,
        lookup_fields: flattenLookupFields(mappedLookup.categories),
      };
    }));
  } catch (err) {
    console.error('QBox get vehicles error:', err);
    throw new Error(`QBox vehicle lookup error: ${err.message}`);
  }
}

async function getVehicleByPlate(plate) {
  try {
    const normalizedPlate = String(plate || '').trim();
    if (!normalizedPlate) return null;

    const p = await getPool();
    const { vehiclesTable } = getQboxTableConfig();
    const tableNameSql = escapeIdentifier(vehiclesTable, 'vehicles table');
    const vehicleMappings = normalizeCustomFields(parseJsonSetting('qbox_vehicle_custom_fields', []), ['column', 'row']);

    let rows = [];
    [rows] = await p.query(
      `SELECT * FROM ${tableNameSql} WHERE plate = ? LIMIT 1`,
      [normalizedPlate]
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      [rows] = await p.query(
        `SELECT * FROM ${tableNameSql} WHERE REPLACE(plate, ' ', '') = REPLACE(?, ' ', '') LIMIT 1`,
        [normalizedPlate]
      );
    }
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const row = rows[0];
    const ownerCitizenId = String(row.citizenid || row.owner || '').trim();
    const legacyCustomFields = buildCustomFieldValues({ row, charinfo: {}, mappings: vehicleMappings });
    const mapped = ownerCitizenId
      ? await resolveMappedFieldData({
        entityType: 'vehicle',
        joinValue: ownerCitizenId,
        baseRowsByTable: { [vehiclesTable]: [row] },
      })
      : { categories: [], custom_fields: {} };
    const mappedLookup = ownerCitizenId
      ? await resolveMappedFieldData({
        entityType: 'vehicle',
        joinValue: ownerCitizenId,
        baseRowsByTable: { [vehiclesTable]: [row] },
        includeSearchOnly: true,
      })
      : { categories: [] };

    return {
      plate: row.plate || '',
      vehicle: row.vehicle || '',
      owner: ownerCitizenId,
      garage: row.garage || '',
      state: row.state !== undefined ? String(row.state) : '',
      custom_fields: {
        ...legacyCustomFields,
        ...mapped.custom_fields,
      },
      mapped_categories: mapped.categories,
      lookup_fields: flattenLookupFields(mappedLookup.categories),
      raw: row,
    };
  } catch (err) {
    console.error('QBox get vehicle by plate error:', err);
    throw new Error(`QBox vehicle lookup error: ${err.message}`);
  }
}

async function applyFineByCitizenId({ citizenId, amount, account = 'bank' }) {
  const normalizedCitizenId = String(citizenId || '').trim();
  const fineAmount = Number(amount || 0);
  const accountKey = String(account || 'bank').trim();

  if (!normalizedCitizenId) {
    throw new Error('citizenId is required');
  }
  if (!Number.isFinite(fineAmount) || fineAmount <= 0) {
    throw new Error('amount must be a positive number');
  }
  if (!IDENTIFIER_RE.test(accountKey)) {
    throw new Error('account contains invalid characters');
  }

  const p = await getPool();
  const { playersTable, citizenIdCol, moneyCol } = getQboxTableConfig();
  const tableNameSql = escapeIdentifier(playersTable, 'players table');
  const citizenIdColSql = escapeIdentifier(citizenIdCol, 'citizen ID column');
  const moneyColSql = escapeIdentifier(moneyCol, 'money column');

  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT ${moneyColSql} as money FROM ${tableNameSql} WHERE ${citizenIdColSql} = ? LIMIT 1 FOR UPDATE`,
      [normalizedCitizenId]
    );
    if (!rows.length) {
      throw new Error(`Citizen ${normalizedCitizenId} not found in ${playersTable}`);
    }

    const money = parseMaybeJson(rows[0].money);
    const currentBalance = Number(money?.[accountKey] || 0);
    const safeCurrent = Number.isFinite(currentBalance) ? currentBalance : 0;
    const nextBalance = Number((safeCurrent - fineAmount).toFixed(2));
    const nextMoney = { ...money, [accountKey]: nextBalance };

    await conn.query(
      `UPDATE ${tableNameSql} SET ${moneyColSql} = ? WHERE ${citizenIdColSql} = ?`,
      [JSON.stringify(nextMoney), normalizedCitizenId]
    );

    await conn.commit();
    return {
      citizenId: normalizedCitizenId,
      account: accountKey,
      amount: fineAmount,
      before: safeCurrent,
      after: nextBalance,
    };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  initPool,
  testConnection,
  inspectConfiguredSchema,
  listTableColumns,
  searchCharacters,
  getCharacterById,
  getCharacterJobById,
  searchVehicles,
  getVehicleByPlate,
  getVehiclesByOwner,
  applyFineByCitizenId,
};
