import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import AdminPageHeader from '../../components/AdminPageHeader';

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
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [installingBridge, setInstallingBridge] = useState(false);
  const [loadingBridgeStatus, setLoadingBridgeStatus] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [schemaResult, setSchemaResult] = useState(null);
  const [fineTargets, setFineTargets] = useState([]);
  const [loadingFineTargets, setLoadingFineTargets] = useState(false);
  const [selectedFineTarget, setSelectedFineTarget] = useState('');
  const [testFineAmount, setTestFineAmount] = useState('250');
  const [testFineReason, setTestFineReason] = useState('CAD admin test fine');
  const [queueingTestFine, setQueueingTestFine] = useState(false);
  const [testFineResult, setTestFineResult] = useState(null);

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
      const data = await api.get('/api/admin/fivem/links?active=true');
      const links = Array.isArray(data) ? data : [];
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

  useEffect(() => {
    fetchSettings();
    fetchFiveMStatus();
    fetchFineTargets();
  }, [locationKey]);

  function updateSetting(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
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

  async function testQboxConnection() {
    setTesting(true);
    setTestResult(null);
    setSchemaResult(null);
    // Save first, then test
    try {
      await api.put('/api/admin/settings', { settings });
      const connection = await api.get('/api/admin/qbox/test');
      setTestResult({ success: true, message: connection.message || 'Connection successful' });
      const schema = await api.get('/api/admin/qbox/schema');
      setSchemaResult(schema);
    } catch (err) {
      setTestResult({ success: false, message: formatErr(err) });
      if (err.details) setSchemaResult(err.details);
    } finally {
      setTesting(false);
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
      setTestFineResult({
        success: true,
        message: `Queued fine job #${result?.job?.id || '?'} for ${playerName}.`,
      });
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

      {/* QBox Database */}
      <div className="bg-cad-card border border-cad-border rounded-lg p-5 mb-4">
        <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-4">QBox MySQL Connection</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-cad-muted mb-1">Host</label>
            <input type="text" value={settings.qbox_host || ''} onChange={e => updateSetting('qbox_host', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent" placeholder="127.0.0.1" />
          </div>
          <div>
            <label className="block text-xs text-cad-muted mb-1">Port</label>
            <input type="text" value={settings.qbox_port || ''} onChange={e => updateSetting('qbox_port', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent" placeholder="3306" />
          </div>
          <div>
            <label className="block text-xs text-cad-muted mb-1">Username</label>
            <input type="text" value={settings.qbox_user || ''} onChange={e => updateSetting('qbox_user', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent" placeholder="root" />
          </div>
          <div>
            <label className="block text-xs text-cad-muted mb-1">Password</label>
            <input type="password" value={settings.qbox_password || ''} onChange={e => updateSetting('qbox_password', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-cad-muted mb-1">Database</label>
            <input type="text" value={settings.qbox_database || ''} onChange={e => updateSetting('qbox_database', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent" placeholder="qbox" />
          </div>
        </div>

        <div className="mt-3">
          <h4 className="text-xs text-cad-muted mb-2">Table / Column Configuration</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-cad-muted mb-1">Players Table</label>
              <input type="text" value={settings.qbox_players_table || ''} onChange={e => updateSetting('qbox_players_table', e.target.value)}
                className="w-full bg-cad-surface border border-cad-border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-cad-accent" placeholder="players" />
            </div>
            <div>
              <label className="block text-xs text-cad-muted mb-1">Vehicles Table</label>
              <input type="text" value={settings.qbox_vehicles_table || ''} onChange={e => updateSetting('qbox_vehicles_table', e.target.value)}
                className="w-full bg-cad-surface border border-cad-border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-cad-accent" placeholder="player_vehicles" />
            </div>
            <div>
              <label className="block text-xs text-cad-muted mb-1">Person Identifier Column</label>
              <input type="text" value={settings.qbox_citizenid_col || ''} onChange={e => updateSetting('qbox_citizenid_col', e.target.value)}
                className="w-full bg-cad-surface border border-cad-border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-cad-accent" placeholder="citizenid" />
            </div>
            <div>
              <label className="block text-xs text-cad-muted mb-1">Charinfo Column</label>
              <input type="text" value={settings.qbox_charinfo_col || ''} onChange={e => updateSetting('qbox_charinfo_col', e.target.value)}
                className="w-full bg-cad-surface border border-cad-border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-cad-accent" placeholder="charinfo" />
            </div>
          </div>
        </div>

        <div className="mt-3">
          <h4 className="text-xs text-cad-muted mb-2">Custom Field Mapping (JSON arrays)</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-cad-muted mb-1">Person Custom Fields (`qbox_person_custom_fields`)</label>
              <textarea
                value={settings.qbox_person_custom_fields || ''}
                onChange={e => updateSetting('qbox_person_custom_fields', e.target.value)}
                className="w-full h-28 bg-cad-surface border border-cad-border rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-cad-accent"
                placeholder={'[{"key":"job","source":"charinfo","path":"job.label"},{"key":"license_status","source":"column","column":"metadata","path":"licenses.driver"}]'}
              />
            </div>
            <div>
              <label className="block text-xs text-cad-muted mb-1">Vehicle Custom Fields (`qbox_vehicle_custom_fields`)</label>
              <textarea
                value={settings.qbox_vehicle_custom_fields || ''}
                onChange={e => updateSetting('qbox_vehicle_custom_fields', e.target.value)}
                className="w-full h-24 bg-cad-surface border border-cad-border rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-cad-accent"
                placeholder={'[{"key":"mods_class","source":"column","column":"mods","path":"class"},{"key":"impounded_at","source":"column","column":"impounded_at"}]'}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={testQboxConnection} disabled={testing}
            className="px-3 py-1.5 text-sm bg-cad-surface text-cad-muted hover:text-cad-ink rounded border border-cad-border transition-colors disabled:opacity-50">
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          {testResult && (
            <span className={`text-sm whitespace-pre-wrap ${testResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
              {testResult.message}
            </span>
          )}
        </div>

        {schemaResult && (
          <div className="mt-3 text-xs">
            {Array.isArray(schemaResult.errors) && schemaResult.errors.length > 0 && (
              <div className="text-red-400 whitespace-pre-wrap">
                {'Errors:\n- ' + schemaResult.errors.join('\n- ')}
              </div>
            )}
            {Array.isArray(schemaResult.players?.warnings) && schemaResult.players.warnings.length > 0 && (
              <div className="text-amber-300 whitespace-pre-wrap mt-2">
                {'Player Warnings:\n- ' + schemaResult.players.warnings.join('\n- ')}
              </div>
            )}
            {Array.isArray(schemaResult.vehicles?.warnings) && schemaResult.vehicles.warnings.length > 0 && (
              <div className="text-amber-300 whitespace-pre-wrap mt-2">
                {'Vehicle Warnings:\n- ' + schemaResult.vehicles.warnings.join('\n- ')}
              </div>
            )}
            {schemaResult.success && (
              <div className="text-emerald-400 mt-2">
                Schema check passed. Charinfo JSON column: {String(schemaResult.players?.columns?.find(c => c.name === (settings.qbox_charinfo_col || 'charinfo'))?.isJson || false)}
              </div>
            )}
          </div>
        )}
      </div>

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
            <label className="block text-xs text-cad-muted mb-1">Shared Bridge Token</label>
            <input
              type="text"
              value={settings.fivem_bridge_shared_token || ''}
              onChange={e => updateSetting('fivem_bridge_shared_token', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cad-accent"
              placeholder="Set a long random token"
            />
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
              value={settings.fivem_bridge_qbox_fines_enabled || 'false'}
              onChange={e => updateSetting('fivem_bridge_qbox_fines_enabled', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            >
              <option value="false">Disabled</option>
              <option value="true">Enabled</option>
            </select>
          </div>
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
