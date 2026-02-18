import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const PRESET_STORAGE_PREFIX = 'cad_go_on_duty_presets_v1';

function buildStorageKey(user) {
  const userKey = String(user?.id || user?.steam_id || user?.discord_id || 'anon').trim() || 'anon';
  return `${PRESET_STORAGE_PREFIX}:${userKey}`;
}

function normalizePresetEntry(entry) {
  const callsign = String(entry?.callsign || '').trim();
  if (!callsign) return null;
  const subDepartmentId = String(entry?.subDepartmentId || '').trim();
  const updatedAtRaw = Number(entry?.updatedAt || Date.now());
  const updatedAt = Number.isFinite(updatedAtRaw) ? updatedAtRaw : Date.now();
  return { callsign, subDepartmentId, updatedAt };
}

function presetKey(entry) {
  const callsign = String(entry?.callsign || '').trim().toLowerCase();
  const subDepartmentId = String(entry?.subDepartmentId || '').trim();
  return `${callsign}::${subDepartmentId}`;
}

function dedupePresets(items) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(items) ? items : []) {
    const normalized = normalizePresetEntry(raw);
    if (!normalized) continue;
    const key = presetKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function readPresets(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return { lastByDepartment: {}, favoritesByDepartment: {} };
    }
    const parsed = JSON.parse(raw);
    return {
      lastByDepartment: parsed?.lastByDepartment && typeof parsed.lastByDepartment === 'object' ? parsed.lastByDepartment : {},
      favoritesByDepartment: parsed?.favoritesByDepartment && typeof parsed.favoritesByDepartment === 'object'
        ? parsed.favoritesByDepartment
        : {},
    };
  } catch {
    return { lastByDepartment: {}, favoritesByDepartment: {} };
  }
}

function writePresets(storageKey, nextValue) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(nextValue));
  } catch {
    // Ignore storage errors (private mode/quota); modal still works without persistence.
  }
}

export default function GoOnDutyModal({ open, onClose, department, onSuccess }) {
  const { user } = useAuth();
  const overlayRef = useRef(null);
  const [callsign, setCallsign] = useState('');
  const [subDepartments, setSubDepartments] = useState([]);
  const [subDepartmentId, setSubDepartmentId] = useState('');
  const [lastUsed, setLastUsed] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isDispatchDepartment = !!department?.is_dispatch;
  const departmentKey = String(department?.id || '').trim();
  const storageKey = useMemo(() => buildStorageKey(user), [user]);

  const getSubDepartmentLabel = useCallback((id) => {
    const target = String(id || '').trim();
    if (!target) return 'No sub-department';
    const match = subDepartments.find((sd) => String(sd.id) === target);
    if (!match) return `Sub-department #${target}`;
    const short = String(match.short_name || '').trim();
    return short ? `${match.name} (${short})` : match.name;
  }, [subDepartments]);

  const persistDepartmentPresets = useCallback((nextLast, nextFavorites) => {
    if (!departmentKey || isDispatchDepartment) return;
    const current = readPresets(storageKey);
    const updated = {
      ...current,
      lastByDepartment: { ...(current.lastByDepartment || {}) },
      favoritesByDepartment: { ...(current.favoritesByDepartment || {}) },
    };
    if (nextLast) {
      updated.lastByDepartment[departmentKey] = nextLast;
    } else {
      delete updated.lastByDepartment[departmentKey];
    }
    updated.favoritesByDepartment[departmentKey] = dedupePresets(nextFavorites || []);
    writePresets(storageKey, updated);
  }, [departmentKey, isDispatchDepartment, storageKey]);

  const loadDepartmentPresets = useCallback(() => {
    if (!departmentKey || isDispatchDepartment) {
      setLastUsed(null);
      setFavorites([]);
      setCallsign(isDispatchDepartment ? 'DISPATCH' : '');
      setSubDepartmentId('');
      return;
    }
    const stored = readPresets(storageKey);
    const storedLast = normalizePresetEntry(stored.lastByDepartment?.[departmentKey]);
    const storedFavorites = dedupePresets(stored.favoritesByDepartment?.[departmentKey] || []);
    setLastUsed(storedLast);
    setFavorites(storedFavorites);
    setCallsign(storedLast?.callsign || '');
    setSubDepartmentId(storedLast?.subDepartmentId || '');
  }, [departmentKey, isDispatchDepartment, storageKey]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      setError('');
      loadDepartmentPresets();
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open, loadDepartmentPresets]);

  useEffect(() => {
    async function fetchSubDepartments() {
      if (!open || !department?.id) {
        setSubDepartments([]);
        return;
      }
      try {
        const data = await api.get(`/api/units/sub-departments?department_id=${department.id}`);
        setSubDepartments(Array.isArray(data) ? data : []);
      } catch {
        setSubDepartments([]);
      }
    }
    fetchSubDepartments();
  }, [open, department?.id]);

  useEffect(() => {
    if (!open || isDispatchDepartment) return;
    if (!subDepartmentId || subDepartments.length === 0) return;
    const exists = subDepartments.some((sd) => String(sd.id) === String(subDepartmentId));
    if (!exists) {
      setSubDepartmentId('');
    }
  }, [open, isDispatchDepartment, subDepartments, subDepartmentId]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && open) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function applyPreset(entry) {
    const normalized = normalizePresetEntry(entry);
    if (!normalized) return;
    setCallsign(normalized.callsign);
    setSubDepartmentId(normalized.subDepartmentId || '');
    setError('');
  }

  function removeFavorite(entry) {
    const key = presetKey(entry);
    const nextFavorites = favorites.filter((item) => presetKey(item) !== key);
    setFavorites(nextFavorites);
    persistDepartmentPresets(lastUsed, nextFavorites);
  }

  function addCurrentToFavorites() {
    if (isDispatchDepartment) return;
    const nextCallsign = String(callsign || '').trim();
    if (!nextCallsign) {
      setError('Enter a callsign before adding a favorite');
      return;
    }
    if (subDepartments.length > 0 && !subDepartmentId) {
      setError('Select a sub-department before adding a favorite');
      return;
    }
    const nextEntry = normalizePresetEntry({
      callsign: nextCallsign,
      subDepartmentId: subDepartmentId ? String(subDepartmentId) : '',
      updatedAt: Date.now(),
    });
    const withoutDuplicate = favorites.filter((item) => presetKey(item) !== presetKey(nextEntry));
    const nextFavorites = [nextEntry, ...withoutDuplicate].slice(0, 12);
    setFavorites(nextFavorites);
    persistDepartmentPresets(lastUsed, nextFavorites);
    setError('');
  }

  async function submit(e) {
    e.preventDefault();
    const trimmed = callsign.trim();
    const normalizedCallsign = isDispatchDepartment ? 'DISPATCH' : trimmed;
    if (!normalizedCallsign) return;
    if (!isDispatchDepartment && subDepartments.length > 0 && !subDepartmentId) {
      setError('Please select a sub-department');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/units/me', {
        callsign: normalizedCallsign,
        department_id: department?.id,
        sub_department_id: subDepartmentId || null,
      });
      if (!isDispatchDepartment && departmentKey) {
        const nextLast = normalizePresetEntry({
          callsign: normalizedCallsign,
          subDepartmentId: subDepartmentId ? String(subDepartmentId) : '',
          updatedAt: Date.now(),
        });
        setLastUsed(nextLast);
        persistDepartmentPresets(nextLast, favorites);
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to go on duty');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm modal-fade-in"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="w-full max-w-md bg-cad-surface border border-cad-border rounded-xl shadow-2xl modal-pop-in">
        <div className="px-5 py-4 border-b border-cad-border flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Go On Duty</h3>
            {department?.short_name && (
              <p className="text-xs text-cad-muted mt-0.5">{department.short_name}</p>
            )}
          </div>
          <button onClick={onClose} className="text-cad-muted hover:text-cad-ink text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={submit} className="px-5 py-4">
          {!isDispatchDepartment ? (
            <>
              <label className="block text-sm text-cad-muted mb-2">Callsign</label>
              <input
                type="text"
                value={callsign}
                onChange={e => setCallsign(e.target.value)}
                placeholder="e.g. DP-41"
                required
                autoFocus
                className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
              />
            </>
          ) : (
            <p className="text-sm text-cad-muted mb-2">
              Dispatcher units are automatically assigned callsign <span className="font-mono text-cad-ink">DISPATCH</span>.
            </p>
          )}
          {!isDispatchDepartment && subDepartments.length > 0 && (
            <>
              <label className="block text-sm text-cad-muted mb-2 mt-3">Sub-Department</label>
              <select
                value={subDepartmentId}
                onChange={e => setSubDepartmentId(e.target.value)}
                required
                className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
              >
                <option value="">Select sub-department...</option>
                {subDepartments.map(sd => (
                  <option key={sd.id} value={sd.id}>
                    {sd.name} ({sd.short_name})
                  </option>
                ))}
              </select>
            </>
          )}
          {!isDispatchDepartment && (
            <div className="mt-3 space-y-2">
              {lastUsed && (
                <button
                  type="button"
                  onClick={() => applyPreset(lastUsed)}
                  className="w-full text-left text-xs bg-cad-card border border-cad-border rounded px-3 py-2 hover:border-cad-accent/60 transition-colors"
                >
                  <span className="text-cad-muted">Last used:</span>{' '}
                  <span className="font-mono text-cad-ink">{lastUsed.callsign}</span>
                  {lastUsed.subDepartmentId && (
                    <span className="text-cad-muted"> - {getSubDepartmentLabel(lastUsed.subDepartmentId)}</span>
                  )}
                </button>
              )}
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-cad-muted uppercase tracking-wider">Favorites</p>
                <button
                  type="button"
                  onClick={addCurrentToFavorites}
                  disabled={!callsign.trim() || (subDepartments.length > 0 && !subDepartmentId)}
                  className="px-2.5 py-1 text-[11px] bg-cad-card border border-cad-border rounded text-cad-muted hover:text-cad-ink hover:border-cad-accent/50 transition-colors disabled:opacity-50"
                >
                  Save Current
                </button>
              </div>
              {favorites.length === 0 ? (
                <p className="text-xs text-cad-muted">No saved favorites for this department yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                  {favorites.map((favorite) => (
                    <div key={presetKey(favorite)} className="flex items-center gap-2 bg-cad-card border border-cad-border rounded px-2.5 py-1.5">
                      <button
                        type="button"
                        onClick={() => applyPreset(favorite)}
                        className="flex-1 text-left min-w-0"
                      >
                        <p className="text-sm font-mono truncate">{favorite.callsign}</p>
                        {favorite.subDepartmentId && (
                          <p className="text-[11px] text-cad-muted truncate">
                            {getSubDepartmentLabel(favorite.subDepartmentId)}
                          </p>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFavorite(favorite)}
                        className="px-2 py-0.5 text-[11px] rounded border border-red-500/30 text-red-300 hover:text-red-200 hover:bg-red-500/10 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {error ? <p className="text-xs text-red-400 mt-2">{error}</p> : null}

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
            >
              {submitting ? 'Going On Duty...' : 'Go On Duty'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-cad-card hover:bg-cad-border text-cad-muted rounded text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
