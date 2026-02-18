import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import AdminPageHeader from '../../components/AdminPageHeader';

const LIVE_MAP_TILE_NAMES = [
  'minimap_sea_0_0',
  'minimap_sea_0_1',
  'minimap_sea_1_0',
  'minimap_sea_1_1',
  'minimap_sea_2_0',
  'minimap_sea_2_1',
];

function formatErr(err) {
  if (!err) return 'Unknown error';
  const base = err.message || 'Request failed';
  if (!err.details) return base;
  if (Array.isArray(err.details?.errors) && err.details.errors.length > 0) {
    return `${base}\n- ${err.details.errors.join('\n- ')}`;
  }
  return base;
}

export default function AdminSystemSettings() {
  const { key: locationKey } = useLocation();
  const tileInputRef = useRef(null);
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [installingBridge, setInstallingBridge] = useState(false);
  const [loadingBridgeStatus, setLoadingBridgeStatus] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState(null);
  const [mapTileFiles, setMapTileFiles] = useState(null);
  const [uploadingMapTiles, setUploadingMapTiles] = useState(false);
  const [mapTileUploadResult, setMapTileUploadResult] = useState(null);
  const [purgingLicenses, setPurgingLicenses] = useState(false);
  const [purgingRegistrations, setPurgingRegistrations] = useState(false);
  const [purgeResult, setPurgeResult] = useState(null);

  async function fetchSettings() {
    try {
      const data = await api.get('/api/admin/settings');
      setSettings(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }

  async function fetchFiveMStatus() {
    setLoadingBridgeStatus(true);
    try {
      const status = await api.get('/api/admin/fivem-resource/status');
      setBridgeStatus(status);
    } catch (err) {
      setBridgeStatus({ error: err.message });
    } finally {
      setLoadingBridgeStatus(false);
    }
  }

  useEffect(() => {
    fetchSettings();
    fetchFiveMStatus();
  }, [locationKey]);

  function updateSetting(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  function parseTileBaseName(fileName) {
    const text = String(fileName || '').trim();
    if (!text) return '';
    const dot = text.lastIndexOf('.');
    if (dot <= 0) return text.toLowerCase();
    return text.slice(0, dot).toLowerCase();
  }

  async function uploadLiveMapTiles() {
    const files = Array.isArray(mapTileFiles) ? mapTileFiles : Array.from(mapTileFiles || []);
    if (files.length === 0) {
      setMapTileUploadResult({ success: false, message: 'Select all 6 tile files before uploading.' });
      return;
    }

    const expectedSet = new Set(LIVE_MAP_TILE_NAMES);
    const byName = new Map();
    const invalid = [];
    const duplicate = [];

    for (const file of files) {
      const baseName = parseTileBaseName(file?.name);
      if (!expectedSet.has(baseName)) {
        invalid.push(String(file?.name || '').trim());
        continue;
      }
      if (byName.has(baseName)) {
        duplicate.push(baseName);
        continue;
      }
      byName.set(baseName, file);
    }

    const missing = LIVE_MAP_TILE_NAMES.filter((name) => !byName.has(name));
    if (invalid.length > 0 || duplicate.length > 0 || missing.length > 0) {
      const messages = [];
      if (missing.length > 0) messages.push(`Missing: ${missing.join(', ')}`);
      if (invalid.length > 0) messages.push(`Invalid names: ${invalid.join(', ')}`);
      if (duplicate.length > 0) messages.push(`Duplicates: ${duplicate.join(', ')}`);
      setMapTileUploadResult({
        success: false,
        message: messages.join('\n'),
      });
      return;
    }

    const formData = new FormData();
    for (const tileName of LIVE_MAP_TILE_NAMES) {
      const tileFile = byName.get(tileName);
      if (!tileFile) continue;
      formData.append('tiles', tileFile, tileName);
    }

    setUploadingMapTiles(true);
    setMapTileUploadResult(null);
    try {
      const result = await api.post('/api/admin/live-map/tiles', formData);
      setMapTileUploadResult({
        success: true,
        message: `Uploaded ${Number(result?.uploaded || LIVE_MAP_TILE_NAMES.length)} live map tiles.`,
      });
      setMapTileFiles(null);
      if (tileInputRef.current) tileInputRef.current.value = '';
    } catch (err) {
      setMapTileUploadResult({
        success: false,
        message: formatErr(err),
      });
    } finally {
      setUploadingMapTiles(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      await api.put('/api/admin/settings', { settings });
      alert('Settings saved');
      fetchFiveMStatus();
    } catch (err) {
      alert('Failed to save:\n' + formatErr(err));
    } finally {
      setSaving(false);
    }
  }

  async function installOrUpdateFiveMResource() {
    setInstallingBridge(true);
    try {
      await api.put('/api/admin/settings', { settings });
      const result = await api.post('/api/admin/fivem-resource/install', {});
      alert(`FiveM resource synced to:\n${result.targetDir}`);
      fetchFiveMStatus();
    } catch (err) {
      alert('Failed to sync FiveM resource:\n' + formatErr(err));
    } finally {
      setInstallingBridge(false);
    }
  }

  async function purgeLicenses() {
    const confirmed = window.confirm(
      'This will permanently delete ALL CAD driver licence records. Continue?'
    );
    if (!confirmed) return;
    setPurgingLicenses(true);
    setPurgeResult(null);
    try {
      const result = await api.delete('/api/admin/cad-records/licenses');
      setPurgeResult({
        success: true,
        message: `Purged ${Number(result?.cleared || 0)} driver licence record(s).`,
      });
    } catch (err) {
      setPurgeResult({ success: false, message: formatErr(err) });
    } finally {
      setPurgingLicenses(false);
    }
  }

  async function purgeRegistrations() {
    const confirmed = window.confirm(
      'This will permanently delete ALL CAD vehicle registration (rego) records. Continue?'
    );
    if (!confirmed) return;
    setPurgingRegistrations(true);
    setPurgeResult(null);
    try {
      const result = await api.delete('/api/admin/cad-records/registrations');
      setPurgeResult({
        success: true,
        message: `Purged ${Number(result?.cleared || 0)} registration record(s).`,
      });
    } catch (err) {
      setPurgeResult({ success: false, message: formatErr(err) });
    } finally {
      setPurgingRegistrations(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <AdminPageHeader
        title="System Settings"
        subtitle="Configure CAD integrations and backend data sources."
      />

      {/* FiveM Bridge */}
      <div className="bg-cad-card border border-cad-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-5">FiveM CAD Bridge</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs text-cad-muted mb-1">FiveM Resources Directory</label>
            <input
              type="text"
              value={settings.fivem_bridge_install_path || ''}
              onChange={e => updateSetting('fivem_bridge_install_path', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
              placeholder="e.g. C:\\txData\\YourServer\\resources\\[cad]"
            />
            <p className="text-xs text-cad-muted mt-1">
              CAD will install/update a resource folder named <span className="font-mono">cad_bridge</span> in this directory.
            </p>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-cad-muted mb-1">CAD API Base URL</label>
            <input
              type="text"
              value={settings.fivem_bridge_base_url || ''}
              onChange={e => updateSetting('fivem_bridge_base_url', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cad-accent"
              placeholder="http://127.0.0.1:3031"
            />
            <p className="text-xs text-cad-muted mt-1">
              Used as the default CAD endpoint inside the installed <span className="font-mono">cad_bridge</span> resource. Port 3031 is the plain HTTP bridge port (FiveM cannot use HTTPS with self-signed certs).
            </p>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-cad-muted mb-1">Shared Bridge Token</label>
            <input
              type="text"
              value={settings.fivem_bridge_shared_token || ''}
              onChange={e => updateSetting('fivem_bridge_shared_token', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cad-accent"
              placeholder="Set a long random token"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-cad-muted mb-1">Legacy External LiveMap Socket URL</label>
            <input
              type="text"
              value={settings.live_map_socket_url || ''}
              onChange={e => updateSetting('live_map_socket_url', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cad-accent"
              placeholder="ws://127.0.0.1:30121 or wss://your-proxy.example"
            />
            <p className="text-xs text-cad-muted mt-1">
              Optional legacy field for external integrations. CAD's built-in Live Map now uses <span className="font-mono">cad_bridge</span> heartbeat data directly.
            </p>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-cad-muted mb-1">Legacy External LiveMap URL</label>
            <input
              type="text"
              value={settings.live_map_url || ''}
              onChange={e => updateSetting('live_map_url', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cad-accent"
              placeholder="http://127.0.0.1:30121"
            />
            <p className="text-xs text-cad-muted mt-1">
              Optional legacy field for opening third-party map UIs. Not required for CAD's built-in live map view.
            </p>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-cad-muted mb-1">Live Map Tiles (Snaily Format)</label>
            <input
              ref={tileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={e => setMapTileFiles(e.target.files)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-xs text-cad-muted file:mr-3 file:rounded file:border file:border-cad-border file:bg-cad-card file:px-2 file:py-1 file:text-xs file:text-cad-ink"
            />
            <p className="text-xs text-cad-muted mt-1">
              Required file names: <span className="font-mono">{LIVE_MAP_TILE_NAMES.join(', ')}</span>
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={uploadLiveMapTiles}
                disabled={uploadingMapTiles}
                className="px-3 py-1.5 text-xs bg-cad-accent hover:bg-cad-accent-light text-white rounded border border-cad-accent/40 transition-colors disabled:opacity-50"
              >
                {uploadingMapTiles ? 'Uploading Tiles...' : 'Upload Map Tiles'}
              </button>
              {mapTileUploadResult && (
                <span className={`text-xs whitespace-pre-wrap ${mapTileUploadResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                  {mapTileUploadResult.message}
                </span>
              )}
            </div>
          </div>
          <div className="col-span-2">
            <h4 className="text-xs font-semibold text-cad-muted uppercase tracking-wider mb-2">Live Map Calibration</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-cad-muted mb-1">Scale X</label>
                <input
                  type="number"
                  step="0.0001"
                  value={settings.live_map_scale_x || '1'}
                  onChange={e => updateSetting('live_map_scale_x', e.target.value)}
                  className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-cad-muted mb-1">Scale Y</label>
                <input
                  type="number"
                  step="0.0001"
                  value={settings.live_map_scale_y || '1'}
                  onChange={e => updateSetting('live_map_scale_y', e.target.value)}
                  className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-cad-muted mb-1">Offset X</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.live_map_offset_x || '0'}
                  onChange={e => updateSetting('live_map_offset_x', e.target.value)}
                  className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-cad-muted mb-1">Offset Y</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.live_map_offset_y || '0'}
                  onChange={e => updateSetting('live_map_offset_y', e.target.value)}
                  className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-cad-muted mb-1">Admin Nudge Increment</label>
                <input
                  type="number"
                  min="0.001"
                  step="0.1"
                  value={settings.live_map_calibration_increment || '0.1'}
                  onChange={e => updateSetting('live_map_calibration_increment', e.target.value)}
                  className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-cad-muted mb-1">Show Admin Calibration Panel</label>
                <select
                  value={settings.live_map_admin_calibration_visible || 'true'}
                  onChange={e => updateSetting('live_map_admin_calibration_visible', e.target.value)}
                  className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                >
                  <option value="true">Visible</option>
                  <option value="false">Hidden</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-cad-muted mt-1">
              Use these if blips are close but slightly shifted on the map. The nudge increment controls how much each
              Up/Down/Left/Right calibration press moves the map offset.
            </p>
          </div>
          <div className="col-span-2">
            <h4 className="text-xs font-semibold text-cad-muted uppercase tracking-wider mb-2">Live Map Game Bounds</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-cad-muted mb-1">X1</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.live_map_game_x1 || '-4230'}
                  onChange={e => updateSetting('live_map_game_x1', e.target.value)}
                  className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-cad-muted mb-1">Y1</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.live_map_game_y1 || '8420'}
                  onChange={e => updateSetting('live_map_game_y1', e.target.value)}
                  className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-cad-muted mb-1">X2</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.live_map_game_x2 || '370'}
                  onChange={e => updateSetting('live_map_game_x2', e.target.value)}
                  className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-cad-muted mb-1">Y2</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.live_map_game_y2 || '-640'}
                  onChange={e => updateSetting('live_map_game_y2', e.target.value)}
                  className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                />
              </div>
            </div>
            <p className="text-xs text-cad-muted mt-1">
              Use these if blips are consistently stretched/rotated relative to roads. Save settings, then refresh Live Map.
            </p>
          </div>
          <div>
            <label className="block text-xs text-cad-muted mb-1">Enable Bridge</label>
            <select
              value={settings.fivem_bridge_enabled || 'false'}
              onChange={e => updateSetting('fivem_bridge_enabled', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            >
              <option value="false">Disabled</option>
              <option value="true">Enabled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-cad-muted mb-1">Auto Update Resource</label>
            <select
              value={settings.fivem_bridge_auto_update || 'true'}
              onChange={e => updateSetting('fivem_bridge_auto_update', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-cad-muted mb-1">Auto Sync Interval (minutes)</label>
            <input
              type="number"
              min="1"
              value={settings.fivem_bridge_sync_interval_minutes || '5'}
              onChange={e => updateSetting('fivem_bridge_sync_interval_minutes', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-cad-muted mb-1">Queue QBox Fines From CAD</label>
            <select
              value={settings.fivem_bridge_qbox_fines_enabled || 'true'}
              onChange={e => updateSetting('fivem_bridge_qbox_fines_enabled', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            >
              <option value="false">Disabled</option>
              <option value="true">Enabled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-cad-muted mb-1">Fine Delivery Mode</label>
            <select
              value={settings.fivem_bridge_qbox_fines_delivery_mode || 'bridge'}
              onChange={e => updateSetting('fivem_bridge_qbox_fines_delivery_mode', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            >
              <option value="direct_db">Direct QBX DB</option>
              <option value="bridge">FiveM Bridge (In-Game)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-cad-muted mb-1">Fine Account Key</label>
            <input
              type="text"
              value={settings.qbox_fine_account_key || 'bank'}
              onChange={e => updateSetting('qbox_fine_account_key', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
              placeholder="bank"
            />
          </div>
          {String(settings.fivem_bridge_qbox_fines_delivery_mode || 'bridge') === 'direct_db' && (
            <p className="col-span-2 text-xs text-amber-300">
              Direct QBX DB mode updates database money only. Live in-game fines and ox_lib notifications require
              <span className="font-semibold"> FiveM Bridge (In-Game)</span>.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={installOrUpdateFiveMResource}
            disabled={installingBridge}
            className="px-3 py-1.5 text-sm bg-cad-accent hover:bg-cad-accent-light text-white rounded border border-cad-accent/40 transition-colors disabled:opacity-50"
          >
            {installingBridge ? 'Syncing...' : 'Install / Update Resource'}
          </button>
          <button
            onClick={fetchFiveMStatus}
            disabled={loadingBridgeStatus}
            className="px-3 py-1.5 text-sm bg-cad-surface text-cad-muted hover:text-cad-ink rounded border border-cad-border transition-colors disabled:opacity-50"
          >
            {loadingBridgeStatus ? 'Refreshing...' : 'Refresh Status'}
          </button>
        </div>

        {bridgeStatus && (
          <div className="mt-3 text-xs space-y-1">
            {bridgeStatus.error ? (
              <div className="text-red-400 whitespace-pre-wrap">{bridgeStatus.error}</div>
            ) : (
              <>
                <div className="text-cad-muted">
                  Resource: <span className="font-mono">{bridgeStatus.resourceName || 'cad_bridge'}</span>
                </div>
                <div className="text-cad-muted">
                  Installed: <span className={bridgeStatus.installed ? 'text-emerald-400' : 'text-red-400'}>{String(!!bridgeStatus.installed)}</span>
                </div>
                <div className="text-cad-muted">
                  Up To Date: <span className={bridgeStatus.upToDate ? 'text-emerald-400' : 'text-amber-300'}>{String(!!bridgeStatus.upToDate)}</span>
                </div>
                {bridgeStatus.targetDir && (
                  <div className="text-cad-muted whitespace-pre-wrap">Target: {bridgeStatus.targetDir}</div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="bg-cad-card border border-red-500/30 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-red-300 uppercase tracking-wider mb-2">CAD Record Purge</h3>
        <p className="text-xs text-cad-muted mb-3">
          Dangerous actions. This permanently removes CAD licence/rego records from the CAD database.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={purgeLicenses}
            disabled={purgingLicenses || purgingRegistrations}
            className="px-3 py-1.5 text-xs bg-red-500/15 text-red-200 hover:bg-red-500/25 rounded border border-red-500/40 transition-colors disabled:opacity-50"
          >
            {purgingLicenses ? 'Purging Licences...' : 'Purge Licences'}
          </button>
          <button
            type="button"
            onClick={purgeRegistrations}
            disabled={purgingRegistrations || purgingLicenses}
            className="px-3 py-1.5 text-xs bg-red-500/15 text-red-200 hover:bg-red-500/25 rounded border border-red-500/40 transition-colors disabled:opacity-50"
          >
            {purgingRegistrations ? 'Purging Rego...' : 'Purge Registrations (Rego)'}
          </button>
        </div>
        {purgeResult && (
          <p className={`text-xs mt-3 whitespace-pre-wrap ${purgeResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
            {purgeResult.message}
          </p>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="px-6 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
