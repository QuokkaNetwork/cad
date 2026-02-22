import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import AdminPageHeader from '../../components/AdminPageHeader';

const TILE_NAMES = [
  'minimap_sea_0_0', 'minimap_sea_0_1',
  'minimap_sea_1_0', 'minimap_sea_1_1',
  'minimap_sea_2_0', 'minimap_sea_2_1',
];

export default function AdminLiveMap() {
  const [urls, setUrls] = useState([]);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tileResult, setTileResult] = useState(null);

  useEffect(() => {
    fetchUrls();
  }, []);

  async function fetchUrls() {
    try {
      const data = await api.get('/api/admin/live-map');
      setUrls(data?.urls || []);
    } catch (err) {
      console.error('Failed to load live map URLs:', err);
    }
  }

  async function saveUrls(urlsToSave) {
    setSaving(true);
    try {
      const data = await api.put('/api/admin/live-map', { urls: urlsToSave });
      setUrls(data?.urls || urlsToSave);
    } catch (err) {
      alert('Failed to save: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  }

  function handleAdd() {
    setEditingIndex(-1);
    setFormName('');
    setFormUrl('');
  }

  function handleEdit(index) {
    setEditingIndex(index);
    setFormName(urls[index].name);
    setFormUrl(urls[index].url);
  }

  function handleCancel() {
    setEditingIndex(null);
    setFormName('');
    setFormUrl('');
  }

  function handleSaveUrl() {
    const name = formName.trim();
    const url = formUrl.trim();
    if (!name || !url) return;

    let updated;
    if (editingIndex === -1) {
      updated = [...urls, { name, url }];
    } else {
      updated = urls.map((u, i) => (i === editingIndex ? { name, url } : u));
    }
    setEditingIndex(null);
    setFormName('');
    setFormUrl('');
    saveUrls(updated);
  }

  function handleDelete(index) {
    const updated = urls.filter((_, i) => i !== index);
    saveUrls(updated);
  }

  async function handleTileUpload(e) {
    e.preventDefault();
    const input = e.target.querySelector('input[type="file"]');
    const files = input?.files;
    if (!files || files.length === 0) return;

    const fileNames = Array.from(files).map(f => f.name.split('.')[0]);
    const missing = TILE_NAMES.filter(name => !fileNames.includes(name));
    if (missing.length > 0) {
      setTileResult({ success: false, message: `Missing tiles: ${missing.join(', ')}` });
      return;
    }

    const formData = new FormData();
    for (const file of files) {
      const baseName = file.name.split('.')[0];
      formData.append('tiles', file, baseName);
    }

    setUploading(true);
    setTileResult(null);
    try {
      const result = await api.post('/api/admin/live-map/tiles', formData);
      setTileResult({ success: true, message: `Uploaded ${result.uploaded?.length || 0} tile(s) successfully.` });
      input.value = '';
    } catch (err) {
      setTileResult({ success: false, message: err.message || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <AdminPageHeader
        title="Live Map"
        subtitle="Configure live map server URLs and map tile images."
      />

      {/* URL Management */}
      <div className="bg-cad-card border border-cad-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider">Live Map Servers</h3>
          {editingIndex === null && (
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 text-sm bg-cad-accent hover:bg-cad-accent-light text-white rounded border border-cad-accent/40 transition-colors"
            >
              Add URL
            </button>
          )}
        </div>

        {editingIndex !== null && (
          <div className="mb-4 p-4 bg-cad-surface border border-cad-border rounded-lg space-y-3">
            <h4 className="text-sm font-medium">{editingIndex === -1 ? 'Add Server' : 'Edit Server'}</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-cad-muted mb-1">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Main Server"
                  className="w-full bg-cad-bg border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-cad-muted mb-1">URL</label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={e => setFormUrl(e.target.value)}
                  placeholder="http://my-host:my-port"
                  className="w-full bg-cad-bg border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveUrl}
                disabled={!formName.trim() || !formUrl.trim() || saving}
                className="px-3 py-1.5 text-sm bg-cad-accent hover:bg-cad-accent-light text-white rounded border border-cad-accent/40 transition-colors disabled:opacity-50"
              >
                {editingIndex === -1 ? 'Add' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-sm bg-cad-surface text-cad-muted hover:text-cad-ink rounded border border-cad-border transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {urls.length === 0 ? (
          <p className="text-sm text-cad-muted">No live map servers configured.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-cad-muted uppercase tracking-wider">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">URL</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {urls.map((entry, idx) => (
                <tr key={idx} className="border-t border-cad-border/40">
                  <td className="py-2.5 pr-4">{entry.name}</td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-cad-muted">{entry.url}</td>
                  <td className="py-2.5 text-right space-x-2">
                    <button
                      onClick={() => handleEdit(idx)}
                      disabled={editingIndex !== null}
                      className="px-2 py-1 text-xs bg-cad-surface text-cad-muted hover:text-cad-ink rounded border border-cad-border transition-colors disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(idx)}
                      disabled={saving}
                      className="px-2 py-1 text-xs bg-red-500/15 text-red-200 hover:bg-red-500/25 rounded border border-red-500/40 transition-colors disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Tile Upload */}
      <div className="bg-cad-card border border-cad-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-3">Map Tiles</h3>
        <p className="text-xs text-cad-muted mb-1">
          Upload 6 PNG tile images for the map background. Required files:
        </p>
        <p className="text-xs text-cad-muted mb-4 font-mono">
          {TILE_NAMES.map(n => `${n}.png`).join(', ')}
        </p>
        <form onSubmit={handleTileUpload} className="flex items-center gap-3">
          <input
            type="file"
            accept=".png"
            multiple
            className="text-sm text-cad-muted file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-cad-border file:text-sm file:bg-cad-surface file:text-cad-muted hover:file:text-cad-ink file:transition-colors"
          />
          <button
            type="submit"
            disabled={uploading}
            className="px-3 py-1.5 text-sm bg-cad-accent hover:bg-cad-accent-light text-white rounded border border-cad-accent/40 transition-colors disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload Tiles'}
          </button>
        </form>
        {tileResult && (
          <p className={`text-xs mt-3 ${tileResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
            {tileResult.message}
          </p>
        )}
      </div>
    </div>
  );
}
