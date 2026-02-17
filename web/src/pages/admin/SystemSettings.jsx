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

function hasCitizenId(link) {
  return String(link?.citizen_id || '').trim().length > 0;
}

export default function AdminSystemSettings() {
  const { key: locationKey } = useLocation();
  const tileInputRef = useRef(null);
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [installingBridge, setInstallingBridge] = useState(false);
  const [loadingBridgeStatus, setLoadingBridgeStatus] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState(null);
  const [fineTargets, setFineTargets] = useState([]);
  const [loadingFineTargets, setLoadingFineTargets] = useState(false);
  const [selectedFineTarget, setSelectedFineTarget] = useState('');
  const [testFineAmount, setTestFineAmount] = useState('250');
  const [testFineReason, setTestFineReason] = useState('CAD admin test fine');
  const [queueingTestFine, setQueueingTestFine] = useState(false);
  const [testFineResult, setTestFineResult] = useState(null);
  const [fineJobs, setFineJobs] = useState([]);
  const [loadingFineJobs, setLoadingFineJobs] = useState(false);
  const [jobSyncJobs, setJobSyncJobs] = useState([]);
  const [loadingJobSyncJobs, setLoadingJobSyncJobs] = useState(false);
  const [mapTileFiles, setMapTileFiles] = useState(null);
  const [uploadingMapTiles, setUploadingMapTiles] = useState(false);
  const [mapTileUploadResult, setMapTileUploadResult] = useState(null);
  const [voiceChannels, setVoiceChannels] = useState([]);
  const [loadingVoiceChannels, setLoadingVoiceChannels] = useState(false);
  const [voiceChannelError, setVoiceChannelError] = useState('');
  const [editingChannelId, setEditingChannelId] = useState(null);
  const [editChannelForm, setEditChannelForm] = useState({ name: '', description: '' });
  const [savingChannelId, setSavingChannelId] = useState(null);
  const [newChannelForm, setNewChannelForm] = useState({ channel_number: '', name: '', description: '' });
  const [addingChannel, setAddingChannel] = useState(false);
  const [showAddChannel, setShowAddChannel] = useState(false);

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

  async function fetchFineTargets() {
    setLoadingFineTargets(true);
    try {
      const activeData = await api.get('/api/admin/fivem/links?active=true');
      let links = Array.isArray(activeData) ? activeData : [];
      if (links.length === 0) {
        const allData = await api.get('/api/admin/fivem/links');
        links = Array.isArray(allData) ? allData : [];
        if (links.length > 0) {
          setTestFineResult({
            success: false,
            message: 'Players were found in FiveM links, but none are currently active. Check bridge token/base URL and resource heartbeat.',
          });
        } else {
          setTestFineResult({
            success: false,
            message: 'No FiveM links found yet. Ensure cad_bridge is running and posting heartbeats to CAD.',
          });
        }
      } else {
        setTestFineResult(null);
      }
      setFineTargets(links);
      setSelectedFineTarget(prev => (
        links.some(link => link.steam_id === prev) ? prev : (links[0]?.steam_id || '')
      ));
    } catch (err) {
      setFineTargets([]);
      setSelectedFineTarget('');
      setTestFineResult({ success: false, message: 'Failed to load active players: ' + formatErr(err) });
    } finally {
      setLoadingFineTargets(false);
    }
  }

  async function fetchFineJobs() {
    setLoadingFineJobs(true);
    try {
      const data = await api.get('/api/admin/fivem/fine-jobs?limit=20');
      setFineJobs(Array.isArray(data) ? data : []);
    } catch {
      setFineJobs([]);
    } finally {
      setLoadingFineJobs(false);
    }
  }

  async function fetchJobSyncJobs() {
    setLoadingJobSyncJobs(true);
    try {
      const data = await api.get('/api/admin/fivem/job-sync-jobs?limit=20');
      setJobSyncJobs(Array.isArray(data) ? data : []);
    } catch {
      setJobSyncJobs([]);
    } finally {
      setLoadingJobSyncJobs(false);
    }
  }

  async function retryFineJob(jobId) {
    try {
      await api.post(`/api/admin/fivem/fine-jobs/${jobId}/retry`, {});
      setTestFineResult({ success: true, message: `Fine job #${jobId} re-queued.` });
      fetchFineJobs();
    } catch (err) {
      setTestFineResult({ success: false, message: formatErr(err) });
    }
  }

  async function cancelFineJob(jobId) {
    try {
      await api.post(`/api/admin/fivem/fine-jobs/${jobId}/cancel`, {});
      setTestFineResult({ success: true, message: `Fine job #${jobId} cancelled.` });
      fetchFineJobs();
    } catch (err) {
      setTestFineResult({ success: false, message: formatErr(err) });
    }
  }

  async function clearQueuedTestFines() {
    try {
      const result = await api.post('/api/admin/fivem/fine-jobs/clear-test', {});
      setTestFineResult({
        success: true,
        message: `Cleared ${Number(result?.cleared || 0)} queued test fine job(s).`,
      });
      fetchFineJobs();
    } catch (err) {
      setTestFineResult({ success: false, message: formatErr(err) });
    }
  }

  async function retryJobSyncJob(jobId) {
    try {
      await api.post(`/api/admin/fivem/job-sync-jobs/${jobId}/retry`, {});
      setTestFineResult({ success: true, message: `Job sync #${jobId} re-queued.` });
      fetchJobSyncJobs();
    } catch (err) {
      setTestFineResult({ success: false, message: formatErr(err) });
    }
  }

  async function fetchVoiceChannels() {
    setLoadingVoiceChannels(true);
    try {
      const data = await api.get('/api/voice/channels/admin');
      setVoiceChannels(Array.isArray(data) ? data : []);
    } catch (err) {
      setVoiceChannelError('Failed to load channels: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoadingVoiceChannels(false);
    }
  }

  function startEditChannel(channel) {
    setEditingChannelId(channel.id);
    setEditChannelForm({ name: channel.name, description: channel.description || '' });
  }

  async function saveChannelEdit(channelId) {
    const name = String(editChannelForm.name || '').trim();
    if (!name) return;
    setSavingChannelId(channelId);
    try {
      const updated = await api.put(`/api/voice/channels/${channelId}`, {
        name,
        description: String(editChannelForm.description || '').trim(),
      });
      setVoiceChannels(prev => prev.map(c => c.id === channelId ? updated : c));
      setEditingChannelId(null);
    } catch (err) {
      setVoiceChannelError('Failed to save: ' + (err?.message || 'Unknown error'));
    } finally {
      setSavingChannelId(null);
    }
  }

  async function toggleChannelActive(channel) {
    try {
      const updated = await api.put(`/api/voice/channels/${channel.id}`, {
        is_active: channel.is_active ? 0 : 1,
      });
      setVoiceChannels(prev => prev.map(c => c.id === channel.id ? updated : c));
    } catch (err) {
      setVoiceChannelError('Failed to update: ' + (err?.message || 'Unknown error'));
    }
  }

  async function createVoiceChannel(e) {
    e.preventDefault();
    const num = parseInt(newChannelForm.channel_number, 10);
    const name = String(newChannelForm.name || '').trim();
    if (!num || !name) return;
    setAddingChannel(true);
    try {
      const created = await api.post('/api/voice/channels', {
        channel_number: num,
        name,
        description: String(newChannelForm.description || '').trim(),
      });
      setVoiceChannels(prev => [...prev, created].sort((a, b) => a.channel_number - b.channel_number));
      setNewChannelForm({ channel_number: '', name: '', description: '' });
      setShowAddChannel(false);
    } catch (err) {
      setVoiceChannelError('Failed to create: ' + (err?.message || 'Unknown error'));
    } finally {
      setAddingChannel(false);
    }
  }

  useEffect(() => {
    fetchSettings();
    fetchFiveMStatus();
    fetchFineTargets();
    fetchFineJobs();
    fetchJobSyncJobs();
    fetchVoiceChannels();
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

  async function queueTestFine() {
    if (!selectedFineTarget) {
      alert('Select an active player first');
      return;
    }
    const target = fineTargets.find(link => link.steam_id === selectedFineTarget);
    if (!target) {
      alert('Selected player is no longer detected');
      return;
    }
    if (!hasCitizenId(target)) {
      alert('Selected player has no citizen ID yet. Check the FiveM bridge/QBox player lookup.');
      return;
    }
    const amount = Number(testFineAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Test fine amount must be greater than 0');
      return;
    }

    setQueueingTestFine(true);
    setTestFineResult(null);
    try {
      const result = await api.post('/api/admin/fivem/test-fine', {
        steam_id: selectedFineTarget,
        amount,
        reason: testFineReason,
      });
      const playerName = result?.player?.player_name || result?.player?.citizen_id || 'player';
      const deliveryMode = String(result?.delivery_mode || settings.fivem_bridge_qbox_fines_delivery_mode || 'bridge').toLowerCase();
      setTestFineResult({
        success: true,
        message: deliveryMode === 'direct_db'
          ? `Queued fine job #${result?.job?.id || '?'} for ${playerName}. Direct DB mode does not send in-game ox_lib notifications.`
          : `Queued fine job #${result?.job?.id || '?'} for ${playerName}.`,
      });
      fetchFineJobs();
    } catch (err) {
      setTestFineResult({ success: false, message: formatErr(err) });
    } finally {
      setQueueingTestFine(false);
    }
  }

  const selectedFineTargetEntry = fineTargets.find(link => link.steam_id === selectedFineTarget) || null;
  const selectedFineTargetHasCitizenId = hasCitizenId(selectedFineTargetEntry);

  return (
    <div className="max-w-2xl">
      <AdminPageHeader
        title="System Settings"
        subtitle="Configure CAD integrations and backend data sources."
      />

      {/* FiveM Bridge */}
      <div className="bg-cad-card border border-cad-border rounded-lg p-5 mb-4">
        <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-4">FiveM CAD Bridge</h3>
        <div className="grid grid-cols-2 gap-3">
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
          <div>
            <label className="block text-xs text-cad-muted mb-1">Discord Role Job Sync</label>
            <select
              value={settings.fivem_bridge_job_sync_enabled || 'true'}
              onChange={e => updateSetting('fivem_bridge_job_sync_enabled', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-cad-muted mb-1">Game Job To Discord Role Sync</label>
            <select
              value={settings.fivem_bridge_job_sync_reverse_enabled || 'true'}
              onChange={e => updateSetting('fivem_bridge_job_sync_reverse_enabled', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-cad-muted mb-1">Default Job (No CAD Mapping)</label>
            <input
              type="text"
              value={settings.fivem_bridge_job_sync_default_job || ''}
              onChange={e => updateSetting('fivem_bridge_job_sync_default_job', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cad-accent"
              placeholder="Leave blank to skip fallback (or set e.g. unemployed)"
            />
          </div>
          <div>
            <label className="block text-xs text-cad-muted mb-1">Default Job Grade</label>
            <input
              type="number"
              min="0"
              value={settings.fivem_bridge_job_sync_default_grade || '0'}
              onChange={e => updateSetting('fivem_bridge_job_sync_default_grade', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-cad-muted mb-1">Role Removed Job</label>
            <input
              type="text"
              value={settings.fivem_bridge_job_sync_removed_job || 'unemployed'}
              onChange={e => updateSetting('fivem_bridge_job_sync_removed_job', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cad-accent"
              placeholder="unemployed"
            />
          </div>
          <div>
            <label className="block text-xs text-cad-muted mb-1">Role Removed Grade</label>
            <input
              type="number"
              min="0"
              value={settings.fivem_bridge_job_sync_removed_grade || '0'}
              onChange={e => updateSetting('fivem_bridge_job_sync_removed_grade', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            />
          </div>
          <p className="col-span-2 text-xs text-cad-muted">
            Reverse sync requires a linked Discord account and a preferred citizen ID. Job role mappings must be configured in <span className="font-semibold">Admin &gt; Job Bindings</span>.
          </p>
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

      {/* Save button */}
      <div className="bg-cad-card border border-cad-border rounded-lg p-5 mb-4">
        <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-4">QBox Fine Test</h3>
        <p className="text-xs text-cad-muted mb-3">
          Queue a test fine for a player currently detected by the FiveM bridge.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-cad-muted mb-1">Detected Player</label>
            <select
              value={selectedFineTarget}
              onChange={e => setSelectedFineTarget(e.target.value)}
              disabled={loadingFineTargets || fineTargets.length === 0}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent disabled:opacity-60"
            >
              {fineTargets.length === 0 && <option value="">No active players detected</option>}
              {fineTargets.map(link => (
                <option key={link.steam_id} value={link.steam_id}>
                  #{link.game_id || '?'} {link.player_name || 'Unknown'} | CAD {link.cad_user_name || 'Unlinked'} | {hasCitizenId(link) ? `CID ${link.citizen_id}` : 'No CID'}
                </option>
              ))}
            </select>
            {selectedFineTargetEntry && !selectedFineTargetHasCitizenId && (
              <p className="text-xs text-amber-300 mt-1">
                Player is detected, but no citizen ID was received yet. Fine queueing is disabled for this player.
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs text-cad-muted mb-1">Amount</label>
            <input
              type="number"
              min="1"
              value={testFineAmount}
              onChange={e => setTestFineAmount(e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-cad-muted mb-1">Reason</label>
            <input
              type="text"
              value={testFineReason}
              onChange={e => setTestFineReason(e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={queueTestFine}
            disabled={queueingTestFine || fineTargets.length === 0 || !selectedFineTargetHasCitizenId}
            className="px-3 py-1.5 text-sm bg-cad-accent hover:bg-cad-accent-light text-white rounded border border-cad-accent/40 transition-colors disabled:opacity-50"
          >
            {queueingTestFine ? 'Queueing...' : 'Queue Test Fine'}
          </button>
          <button
            onClick={fetchFineTargets}
            disabled={loadingFineTargets}
            className="px-3 py-1.5 text-sm bg-cad-surface text-cad-muted hover:text-cad-ink rounded border border-cad-border transition-colors disabled:opacity-50"
          >
            {loadingFineTargets ? 'Refreshing...' : 'Refresh Players'}
          </button>
        </div>
        {testFineResult && (
          <p className={`text-xs mt-3 whitespace-pre-wrap ${testFineResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
            {testFineResult.message}
          </p>
        )}
      </div>

      <div className="bg-cad-card border border-cad-border rounded-lg p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider">Fine Job Status</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={clearQueuedTestFines}
              className="px-3 py-1.5 text-xs bg-red-500/10 text-red-300 hover:text-red-200 rounded border border-red-500/30 transition-colors"
            >
              Clear Queued Test Fines
            </button>
            <button
              onClick={fetchFineJobs}
              disabled={loadingFineJobs}
              className="px-3 py-1.5 text-xs bg-cad-surface text-cad-muted hover:text-cad-ink rounded border border-cad-border transition-colors disabled:opacity-50"
            >
              {loadingFineJobs ? 'Refreshing...' : 'Refresh Jobs'}
            </button>
          </div>
        </div>
        {fineJobs.length === 0 ? (
          <p className="text-xs text-cad-muted">No fine jobs recorded yet.</p>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {fineJobs.map(job => (
              <div key={job.id} className="bg-cad-surface border border-cad-border rounded px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-cad-ink">
                    #{job.id} | CID {job.citizen_id} | ${Number(job.amount || 0).toFixed(0)}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-semibold uppercase ${
                      job.status === 'sent'
                        ? 'text-emerald-400'
                        : job.status === 'failed'
                          ? 'text-red-400'
                          : 'text-amber-300'
                    }`}>
                      {job.status}
                    </span>
                    {job.status !== 'sent' && (
                      <>
                        <button
                          onClick={() => retryFineJob(job.id)}
                          className="px-2 py-0.5 text-[10px] bg-cad-card text-cad-muted hover:text-cad-ink rounded border border-cad-border"
                        >
                          Retry
                        </button>
                        <button
                          onClick={() => cancelFineJob(job.id)}
                          className="px-2 py-0.5 text-[10px] bg-red-500/10 text-red-300 hover:text-red-200 rounded border border-red-500/30"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-cad-muted mt-1">{job.reason || 'No reason'}</p>
                {!!job.error && <p className="text-[11px] text-red-300 mt-1 whitespace-pre-wrap">{job.error}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-cad-card border border-cad-border rounded-lg p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider">Job Sync Status</h3>
          <button
            onClick={fetchJobSyncJobs}
            disabled={loadingJobSyncJobs}
            className="px-3 py-1.5 text-xs bg-cad-surface text-cad-muted hover:text-cad-ink rounded border border-cad-border transition-colors disabled:opacity-50"
          >
            {loadingJobSyncJobs ? 'Refreshing...' : 'Refresh Jobs'}
          </button>
        </div>
        {jobSyncJobs.length === 0 ? (
          <p className="text-xs text-cad-muted">No job sync jobs recorded yet.</p>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {jobSyncJobs.map(job => (
              <div key={job.id} className="bg-cad-surface border border-cad-border rounded px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-cad-ink">
                    #{job.id} | {job.cad_user_name || `User ${job.user_id}`} | {job.job_name} ({Number(job.job_grade || 0)})
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-semibold uppercase ${
                      job.status === 'sent'
                        ? 'text-emerald-400'
                        : job.status === 'failed'
                          ? 'text-red-400'
                          : 'text-amber-300'
                    }`}>
                      {job.status}
                    </span>
                    {job.status !== 'sent' && (
                      <button
                        onClick={() => retryJobSyncJob(job.id)}
                        className="px-2 py-0.5 text-[10px] bg-cad-card text-cad-muted hover:text-cad-ink rounded border border-cad-border"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-cad-muted mt-1">
                  Source: {job.source_type || 'none'} {job.source_id ? `#${job.source_id}` : ''}
                </p>
                {!!job.error && <p className="text-[11px] text-red-300 mt-1 whitespace-pre-wrap">{job.error}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Voice Channels */}
      <div className="bg-cad-card border border-cad-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Voice Channels</h2>
            <p className="text-xs text-cad-muted mt-0.5">Rename channels and manage which are active. Channel numbers must match your in-game radio frequencies.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchVoiceChannels}
              disabled={loadingVoiceChannels}
              className="px-3 py-1.5 text-xs bg-cad-surface text-cad-muted hover:text-cad-ink rounded border border-cad-border transition-colors disabled:opacity-50"
            >
              {loadingVoiceChannels ? 'Loading...' : 'Refresh'}
            </button>
            <button
              onClick={() => { setShowAddChannel(v => !v); setVoiceChannelError(''); }}
              className="px-3 py-1.5 text-xs bg-cad-accent hover:bg-cad-accent-light text-white rounded transition-colors"
            >
              + Add Channel
            </button>
          </div>
        </div>

        {voiceChannelError && (
          <p className="text-xs text-red-400">{voiceChannelError}</p>
        )}

        {showAddChannel && (
          <form onSubmit={createVoiceChannel} className="bg-cad-surface border border-cad-border rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-cad-muted uppercase tracking-wider">New Channel</p>
            <div className="flex gap-3">
              <div className="w-28 flex-shrink-0">
                <label className="block text-xs text-cad-muted mb-1">Channel #</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newChannelForm.channel_number}
                  onChange={e => setNewChannelForm(f => ({ ...f, channel_number: e.target.value }))}
                  placeholder="e.g. 1"
                  className="w-full bg-cad-card border border-cad-border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-cad-accent"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-cad-muted mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={newChannelForm.name}
                  onChange={e => setNewChannelForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Police Primary"
                  className="w-full bg-cad-card border border-cad-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-cad-accent"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-cad-muted mb-1">Description</label>
                <input
                  type="text"
                  value={newChannelForm.description}
                  onChange={e => setNewChannelForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional"
                  className="w-full bg-cad-card border border-cad-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-cad-accent"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={addingChannel}
                className="px-4 py-1.5 text-xs bg-cad-accent hover:bg-cad-accent-light text-white rounded transition-colors disabled:opacity-50"
              >
                {addingChannel ? 'Creating...' : 'Create Channel'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddChannel(false); setNewChannelForm({ channel_number: '', name: '', description: '' }); }}
                className="px-4 py-1.5 text-xs bg-cad-surface text-cad-muted hover:text-cad-ink rounded border border-cad-border transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {voiceChannels.length === 0 && !loadingVoiceChannels ? (
          <p className="text-sm text-cad-muted py-2">No voice channels yet. Use the FiveM CAD bridge to auto-sync channels, or add them manually above.</p>
        ) : (
          <div className="space-y-2">
            {voiceChannels.map(channel => (
              <div
                key={channel.id}
                className={`bg-cad-surface border rounded-lg px-4 py-3 transition-colors ${channel.is_active ? 'border-cad-border' : 'border-cad-border opacity-50'}`}
              >
                {editingChannelId === channel.id ? (
                  <div className="flex gap-3 items-end">
                    <div className="w-12 flex-shrink-0 text-center">
                      <p className="text-xs text-cad-muted mb-1">CH</p>
                      <p className="text-sm font-mono font-semibold">{channel.channel_number}</p>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-cad-muted mb-1">Name *</label>
                      <input
                        type="text"
                        autoFocus
                        value={editChannelForm.name}
                        onChange={e => setEditChannelForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full bg-cad-card border border-cad-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-cad-accent"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-cad-muted mb-1">Description</label>
                      <input
                        type="text"
                        value={editChannelForm.description}
                        onChange={e => setEditChannelForm(f => ({ ...f, description: e.target.value }))}
                        className="w-full bg-cad-card border border-cad-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-cad-accent"
                      />
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => saveChannelEdit(channel.id)}
                        disabled={savingChannelId === channel.id || !editChannelForm.name.trim()}
                        className="px-3 py-1.5 text-xs bg-cad-accent hover:bg-cad-accent-light text-white rounded transition-colors disabled:opacity-50"
                      >
                        {savingChannelId === channel.id ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingChannelId(null)}
                        className="px-3 py-1.5 text-xs bg-cad-surface text-cad-muted hover:text-cad-ink rounded border border-cad-border transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-12 text-center flex-shrink-0">
                      <p className="text-xs text-cad-muted">CH</p>
                      <p className="text-sm font-mono font-semibold">{channel.channel_number}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{channel.name}</p>
                      {channel.description && (
                        <p className="text-xs text-cad-muted truncate">{channel.description}</p>
                      )}
                    </div>
                    {channel.department_name && (
                      <span className="text-xs text-cad-muted bg-cad-card border border-cad-border rounded px-2 py-0.5 flex-shrink-0">
                        {channel.department_short_name || channel.department_name}
                      </span>
                    )}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => startEditChannel(channel)}
                        className="px-3 py-1 text-xs text-cad-muted hover:text-cad-ink bg-cad-card border border-cad-border rounded transition-colors"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => toggleChannelActive(channel)}
                        className={`px-3 py-1 text-xs rounded border transition-colors ${
                          channel.is_active
                            ? 'text-amber-400 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20'
                            : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20'
                        }`}
                      >
                        {channel.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={saveSettings}
        disabled={saving}
        className="px-6 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
