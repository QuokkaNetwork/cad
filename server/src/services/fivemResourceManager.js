const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Settings } = require('../db/sqlite');

const RESOURCE_NAME = 'cad_bridge';
const TEMPLATE_DIR = path.resolve(__dirname, '../../fivem-resource');
const VERSION_FILE_NAME = '.cad_bridge_version';
let syncInterval = null;

function getSetting(key, fallback = '') {
  const value = Settings.get(key);
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function normalizePath(input) {
  return String(input || '').trim().replace(/^"(.*)"$/, '$1');
}

function getConfig() {
  return {
    enabled: getSetting('fivem_bridge_enabled', 'false').toLowerCase() === 'true',
    autoUpdate: getSetting('fivem_bridge_auto_update', 'true').toLowerCase() === 'true',
    installPath: normalizePath(getSetting('fivem_bridge_install_path', '')),
    syncIntervalMinutes: Math.max(1, parseInt(getSetting('fivem_bridge_sync_interval_minutes', '5'), 10) || 5),
  };
}

function ensureTemplateExists() {
  if (!fs.existsSync(TEMPLATE_DIR)) {
    throw new Error(`FiveM resource template not found at ${TEMPLATE_DIR}`);
  }
  if (!fs.existsSync(path.join(TEMPLATE_DIR, 'fxmanifest.lua'))) {
    throw new Error('Invalid FiveM resource template (missing fxmanifest.lua)');
  }
}

function listFilesRecursively(rootDir) {
  const files = [];
  function walk(current, prefix = '') {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const rel = prefix ? path.posix.join(prefix, entry.name) : entry.name;
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(abs, rel);
      } else if (entry.isFile()) {
        files.push({ rel, abs });
      }
    }
  }
  walk(rootDir);
  return files.sort((a, b) => a.rel.localeCompare(b.rel));
}

function buildTemplateHash() {
  const hash = crypto.createHash('sha256');
  for (const file of listFilesRecursively(TEMPLATE_DIR)) {
    hash.update(file.rel);
    hash.update(fs.readFileSync(file.abs));
  }
  return hash.digest('hex');
}

function resolveTargetDir() {
  const { installPath } = getConfig();
  if (!installPath) throw new Error('fivem_bridge_install_path is not configured');
  return path.join(path.resolve(installPath), RESOURCE_NAME);
}

function escapeLuaSingleQuoted(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

function applyRuntimeConfig(targetDir) {
  const configPath = path.join(targetDir, 'config.lua');
  if (!fs.existsSync(configPath)) return;

  const baseUrl = getSetting('fivem_bridge_base_url', 'http://127.0.0.1:3030');
  const token = getSetting('fivem_bridge_shared_token', '');
  const escapedBaseUrl = escapeLuaSingleQuoted(baseUrl);
  const escapedToken = escapeLuaSingleQuoted(token);

  let content = fs.readFileSync(configPath, 'utf8');
  content = content.replace(
    /^Config\.CadBaseUrl\s*=.*$/m,
    `Config.CadBaseUrl = GetConvar('cad_bridge_base_url', '${escapedBaseUrl}')`
  );
  content = content.replace(
    /^Config\.SharedToken\s*=.*$/m,
    `Config.SharedToken = GetConvar('cad_bridge_token', '${escapedToken}')`
  );
  content = content.replace(
    /^Config\.PublishAllPlayers\s*=.*$/m,
    "Config.PublishAllPlayers = GetConvar('cad_bridge_publish_all_players', 'true') == 'true'"
  );
  fs.writeFileSync(configPath, content, 'utf8');
}

function writeVersionFile(targetDir, version) {
  const content = JSON.stringify({ version, updated_at: new Date().toISOString() }, null, 2);
  fs.writeFileSync(path.join(targetDir, VERSION_FILE_NAME), content, 'utf8');
}

function readInstalledVersion(targetDir) {
  const versionFile = path.join(targetDir, VERSION_FILE_NAME);
  if (!fs.existsSync(versionFile)) return '';
  try {
    const parsed = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
    return String(parsed.version || '');
  } catch {
    return '';
  }
}

function installOrUpdateResource() {
  ensureTemplateExists();
  const targetDir = resolveTargetDir();
  const targetRoot = path.dirname(targetDir);
  const version = buildTemplateHash();

  fs.mkdirSync(targetRoot, { recursive: true });
  fs.mkdirSync(targetDir, { recursive: true });

  fs.cpSync(TEMPLATE_DIR, targetDir, { recursive: true, force: true });
  applyRuntimeConfig(targetDir);
  writeVersionFile(targetDir, version);

  return {
    resourceName: RESOURCE_NAME,
    targetDir,
    version,
  };
}

function getStatus() {
  const cfg = getConfig();
  let installed = false;
  let upToDate = false;
  let installedVersion = '';
  let templateVersion = '';
  let targetDir = '';
  let error = '';

  try {
    ensureTemplateExists();
    templateVersion = buildTemplateHash();
    if (cfg.installPath) {
      targetDir = resolveTargetDir();
      installed = fs.existsSync(path.join(targetDir, 'fxmanifest.lua'));
      if (installed) {
        installedVersion = readInstalledVersion(targetDir);
        upToDate = installedVersion && installedVersion === templateVersion;
      }
    }
  } catch (err) {
    error = err.message;
  }

  return {
    enabled: cfg.enabled,
    autoUpdate: cfg.autoUpdate,
    installPath: cfg.installPath,
    syncIntervalMinutes: cfg.syncIntervalMinutes,
    resourceName: RESOURCE_NAME,
    targetDir,
    installed,
    upToDate,
    installedVersion,
    templateVersion,
    error,
  };
}

function stopFiveMResourceAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

function startFiveMResourceAutoSync() {
  stopFiveMResourceAutoSync();
  const cfg = getConfig();
  if (!cfg.enabled || !cfg.autoUpdate || !cfg.installPath) return;

  const runSync = () => {
    try {
      const status = getStatus();
      if (!status.installed || !status.upToDate) {
        const result = installOrUpdateResource();
        console.log(`[FiveMBridge] Resource synced to ${result.targetDir}`);
      } else if (status.targetDir) {
        // Keep runtime token/base URL defaults in sync with CAD settings.
        applyRuntimeConfig(status.targetDir);
      }
    } catch (err) {
      console.error('[FiveMBridge] Auto-sync failed:', err.message);
    }
  };

  runSync();
  syncInterval = setInterval(runSync, cfg.syncIntervalMinutes * 60 * 1000);
  console.log(`[FiveMBridge] Auto-sync enabled (${cfg.syncIntervalMinutes} min)`);
}

module.exports = {
  RESOURCE_NAME,
  installOrUpdateResource,
  getStatus,
  startFiveMResourceAutoSync,
  stopFiveMResourceAutoSync,
};
