import { useState, useEffect } from 'react';
import { api } from '../../api/client';

export default function AdminSystemSettings() {
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

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
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function testQboxConnection() {
    setTesting(true);
    setTestResult(null);
    // Save first, then test
    try {
      await api.put('/api/admin/settings', { settings });
      // A dedicated test endpoint would be better; for now test via a dummy search
      const result = await api.get('/api/search/persons?q=__test__');
      setTestResult({ success: true, message: 'Connection successful' });
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold mb-6">System Settings</h2>

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

        <div className="flex gap-2 mt-4">
          <button onClick={testQboxConnection} disabled={testing}
            className="px-3 py-1.5 text-sm bg-cad-surface text-cad-muted hover:text-cad-ink rounded border border-cad-border transition-colors disabled:opacity-50">
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          {testResult && (
            <span className={`text-sm ${testResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
              {testResult.message}
            </span>
          )}
        </div>
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
