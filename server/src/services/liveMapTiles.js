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

const LIVE_MAP_MIN_ZOOM = -2;
const LIVE_MAP_MAX_ZOOM = 4;
const LIVE_MAP_MIN_NATIVE_ZOOM = 0;
const LIVE_MAP_MAX_NATIVE_ZOOM = 0;

const liveMapTilesDir = path.resolve(__dirname, '../../data/uploads/live-map-tiles');

function ensureLiveMapTilesDir() {
  fs.mkdirSync(liveMapTilesDir, { recursive: true });
  return liveMapTilesDir;
}

function normalizeTileBaseName(fileName) {
  const parsed = path.parse(String(fileName || '').trim());
  if (parsed.name) return parsed.name;
  return String(fileName || '').trim();
}

function getLiveMapTilePath(tileName) {
  return path.join(ensureLiveMapTilesDir(), `${tileName}${LIVE_MAP_TILE_EXTENSION}`);
}

function listMissingLiveMapTiles() {
  return LIVE_MAP_TILE_NAMES.filter((tileName) => !fs.existsSync(getLiveMapTilePath(tileName)));
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
  normalizeTileBaseName,
  getLiveMapTilePath,
  listMissingLiveMapTiles,
  hasCompleteLiveMapTiles,
};
