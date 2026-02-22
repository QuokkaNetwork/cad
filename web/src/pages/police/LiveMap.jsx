import { useState, useEffect } from 'react';
import { api } from '../../api/client';

export default function LiveMap() {
  const [urls, setUrls] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const config = await api.get('/api/units/live-map-config');
        setUrls(config?.urls || []);
      } catch (err) {
        setError(err.message || 'Failed to load live map configuration');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-cad-muted">
        Loading live map...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400">
        {error}
      </div>
    );
  }

  if (urls.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-cad-muted">
        No live map servers configured. Ask an admin to set up live map settings.
      </div>
    );
  }

  const selected = urls[selectedIndex] || urls[0];
  const iframeSrc = `${selected.url}?cad_embed=1&t=${Date.now()}`;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] -m-6">
      {urls.length > 1 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-cad-surface border-b border-cad-border">
          <span className="text-xs text-cad-muted mr-2">Server:</span>
          {urls.map((url, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedIndex(idx)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                idx === selectedIndex
                  ? 'bg-cad-accent text-white'
                  : 'bg-cad-card text-cad-muted hover:text-cad-ink border border-cad-border'
              }`}
            >
              {url.name}
            </button>
          ))}
        </div>
      )}
      <iframe
        key={selectedIndex}
        src={iframeSrc}
        className="flex-1 w-full border-0"
        title="Live Map"
        allow="fullscreen"
      />
    </div>
  );
}
