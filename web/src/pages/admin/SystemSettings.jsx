import { useState, useEffect } from 'react';
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

export default function AdminSystemSettings() {
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [schemaResult, setSchemaResult] = useState(null);

  async function fetchSettings() {
    try {
      const data = await api.get('/api/admin/settings');
      setSettings(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }

  useEffect(() => { fetchSettings(); }, []);

  function updateSetting(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  async function saveSettings() {
    setSaving(true);
    try {
      await api.put('/api/admin/settings', { settings });
      alert('Settings saved');
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
              <label className="block text-xs text-cad-muted mb-1">Citizen ID Column</label>
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

      {/* Save button */}
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
