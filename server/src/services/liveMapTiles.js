const fs = require('fs');
const path = require('path');

const LIVE_MAP_TILE_NAMES = Object.freeze([
  'minimap_sea_0_0',
  'minimap_sea_0_1',
  'minimap_sea_1_0',
  'minimap_sea_1_1',
  'minimap_sea_2_0',
  'minimap_sea_2_1',
]);

const LIVE_MAP_TILE_EXTENSION = '.webp';
const LIVE_MAP_TILE_URL_TEMPLATE = '/tiles/minimap_sea_{y}_{x}.webp';
const LIVE_MAP_TILE_SIZE = 1024;
const LIVE_MAP_TILE_COLUMNS = 2;
const LIVE_MAP_TILE_ROWS = 3;
const LIVE_MAP_TILE_NAME_RE = /^minimap_sea_(\d+)_(\d+)$/i;

const LIVE_MAP_MIN_ZOOM = -2;
const LIVE_MAP_MAX_ZOOM = 4;
const LIVE_MAP_MIN_NATIVE_ZOOM = 0;
const LIVE_MAP_MAX_NATIVE_ZOOM = 0;

const liveMapTilesDir = path.resolve(__dirname, '../../data/uploads/live-map-tiles');

function ensureLiveMapTilesDir() {
  fs.mkdirSync(liveMapTilesDir, { recursive: true });
  return liveMapTilesDir;
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function hasAllTilesInDir(dirPath) {
  if (!dirPath) return false;
  const base = path.resolve(String(dirPath));
  return LIVE_MAP_TILE_NAMES.every((tileName) => {
    const tilePath = path.join(base, `${tileName}${LIVE_MAP_TILE_EXTENSION}`);
    return fileExists(tilePath);
  });
}

function getFallbackLiveMapTilesDir() {
  const envDir = String(process.env.LIVE_MAP_FALLBACK_TILES_DIR || '').trim();
  const candidates = [
    envDir,
    path.resolve(process.cwd(), '../snailycad/snaily-cadv4-1.80.2/apps/client/public/tiles'),
    path.resolve(process.cwd(), '../../snailycad/snaily-cadv4-1.80.2/apps/client/public/tiles'),
    path.resolve(__dirname, '../../../../snailycad/snaily-cadv4-1.80.2/apps/client/public/tiles'),
  ].filter(Boolean);

  const seen = new Set();
  for (const raw of candidates) {
    const resolved = path.resolve(raw);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    if (hasAllTilesInDir(resolved)) {
      return resolved;
    }
  }
  return '';
}

function normalizeTileBaseName(fileName) {
  const parsed = path.parse(String(fileName || '').trim());
  if (parsed.name) return parsed.name;
  return String(fileName || '').trim();
}

function getLiveMapTilePath(tileName) {
  return path.join(ensureLiveMapTilesDir(), `${tileName}${LIVE_MAP_TILE_EXTENSION}`);
}

function parseLiveMapTileName(tileName) {
  const name = String(tileName || '').trim().toLowerCase();
  const match = name.match(LIVE_MAP_TILE_NAME_RE);
  if (!match) return null;
  const row = Number.parseInt(match[1], 10);
  const column = Number.parseInt(match[2], 10);
  if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || column < 0) {
    return null;
  }
  return { name, row, column };
}

function listTileBaseNamesInDir(dirPath) {
  if (!dirPath) return [];
  try {
    const base = path.resolve(String(dirPath));
    if (!fs.existsSync(base)) return [];
    const entries = fs.readdirSync(base, { withFileTypes: true });
    return entries
      .filter((entry) => entry && entry.isFile && entry.isFile())
      .map((entry) => normalizeTileBaseName(entry.name))
      .filter((name) => String(name || '').trim() !== '');
  } catch {
    return [];
  }
}

function listDetectedLiveMapTiles() {
  const detected = new Map();
  const fallbackDir = getFallbackLiveMapTilesDir();
  const baseDirs = [fallbackDir, ensureLiveMapTilesDir()].filter(Boolean);

  for (const dirPath of baseDirs) {
    const names = listTileBaseNamesInDir(dirPath);
    for (const rawName of names) {
      const parsed = parseLiveMapTileName(rawName);
      if (!parsed) continue;
      detected.set(parsed.name, parsed);
    }
  }

  if (detected.size === 0) {
    for (const name of LIVE_MAP_TILE_NAMES) {
      const parsed = parseLiveMapTileName(name);
      if (parsed) detected.set(parsed.name, parsed);
    }
  }

  return Array.from(detected.values()).sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row;
    return a.column - b.column;
  });
}

function getLiveMapTileGrid() {
  const detected = listDetectedLiveMapTiles();
  if (!detected.length) {
    return {
      tileRows: LIVE_MAP_TILE_ROWS,
      tileColumns: LIVE_MAP_TILE_COLUMNS,
      rowMin: 0,
      rowMax: LIVE_MAP_TILE_ROWS - 1,
      columnMin: 0,
      columnMax: LIVE_MAP_TILE_COLUMNS - 1,
      tileNames: [...LIVE_MAP_TILE_NAMES],
    };
  }

  let rowMin = Number.POSITIVE_INFINITY;
  let rowMax = Number.NEGATIVE_INFINITY;
  let columnMin = Number.POSITIVE_INFINITY;
  let columnMax = Number.NEGATIVE_INFINITY;

  for (const tile of detected) {
    if (tile.row < rowMin) rowMin = tile.row;
    if (tile.row > rowMax) rowMax = tile.row;
    if (tile.column < columnMin) columnMin = tile.column;
    if (tile.column > columnMax) columnMax = tile.column;
  }

  const tileRows = Number.isFinite(rowMin) && Number.isFinite(rowMax)
    ? Math.max(1, (rowMax - rowMin) + 1)
    : LIVE_MAP_TILE_ROWS;
  const tileColumns = Number.isFinite(columnMin) && Number.isFinite(columnMax)
    ? Math.max(1, (columnMax - columnMin) + 1)
    : LIVE_MAP_TILE_COLUMNS;

  return {
    tileRows,
    tileColumns,
    rowMin: Number.isFinite(rowMin) ? rowMin : 0,
    rowMax: Number.isFinite(rowMax) ? rowMax : (tileRows - 1),
    columnMin: Number.isFinite(columnMin) ? columnMin : 0,
    columnMax: Number.isFinite(columnMax) ? columnMax : (tileColumns - 1),
    tileNames: detected.map((tile) => tile.name),
  };
}

function listMissingLiveMapTiles() {
  const fallbackDir = getFallbackLiveMapTilesDir();
  return LIVE_MAP_TILE_NAMES.filter((tileName) => {
    if (fileExists(getLiveMapTilePath(tileName))) return false;
    if (!fallbackDir) return true;
    const fallbackPath = path.join(fallbackDir, `${tileName}${LIVE_MAP_TILE_EXTENSION}`);
    return !fileExists(fallbackPath);
  });
}

function hasCompleteLiveMapTiles() {
  return listMissingLiveMapTiles().length === 0;
}

module.exports = {
  LIVE_MAP_TILE_NAMES,
  LIVE_MAP_TILE_EXTENSION,
  LIVE_MAP_TILE_URL_TEMPLATE,
  LIVE_MAP_TILE_SIZE,
  LIVE_MAP_TILE_COLUMNS,
  LIVE_MAP_TILE_ROWS,
  LIVE_MAP_MIN_ZOOM,
  LIVE_MAP_MAX_ZOOM,
  LIVE_MAP_MIN_NATIVE_ZOOM,
  LIVE_MAP_MAX_NATIVE_ZOOM,
  liveMapTilesDir,
  ensureLiveMapTilesDir,
  getFallbackLiveMapTilesDir,
  normalizeTileBaseName,
  parseLiveMapTileName,
  getLiveMapTilePath,
  listDetectedLiveMapTiles,
  getLiveMapTileGrid,
  listMissingLiveMapTiles,
  hasCompleteLiveMapTiles,
};
