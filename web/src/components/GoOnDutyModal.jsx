import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

export default function GoOnDutyModal({ open, onClose, department, onSuccess }) {
  const overlayRef = useRef(null);
  const [callsign, setCallsign] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      setError('');
      setCallsign('');
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && open) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function submit(e) {
    e.preventDefault();
    const trimmed = callsign.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/units/me', {
        callsign: trimmed,
        department_id: department?.id,
      });
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
