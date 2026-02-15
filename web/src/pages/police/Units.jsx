import { useState, useEffect, useCallback } from 'react';
import { useDepartment } from '../../context/DepartmentContext';
import { useEventSource } from '../../hooks/useEventSource';
import { api } from '../../api/client';
import UnitCard from '../../components/UnitCard';

export default function Units() {
  const { activeDepartment } = useDepartment();
  const [units, setUnits] = useState([]);
  const [myUnit, setMyUnit] = useState(null);
  const [callsign, setCallsign] = useState('');
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const deptId = activeDepartment?.id;

  const fetchData = useCallback(async () => {
    if (!deptId) return;
    try {
      const [unitsData, myData] = await Promise.all([
        api.get(`/api/units?department_id=${deptId}`),
        api.get('/api/units/me').catch(() => null),
      ]);
      setUnits(unitsData);
      setMyUnit(myData);
      if (myData) {
        setLocation(myData.location || '');
        setNote(myData.note || '');
      }
    } catch (err) {
      console.error('Failed to load units:', err);
    }
  }, [deptId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEventSource({
    'unit:online': () => fetchData(),
    'unit:offline': () => fetchData(),
    'unit:update': () => fetchData(),
  });

  async function goOnDuty(e) {
    e.preventDefault();
    if (!callsign.trim()) return;
    setLoading(true);
    try {
      await api.post('/api/units/me', { callsign: callsign.trim(), department_id: deptId });
      setCallsign('');
      fetchData();
    } catch (err) {
      alert('Failed to go on duty: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function goOffDuty() {
    if (!confirm('Go off duty?')) return;
    try {
      await api.delete('/api/units/me');
      setMyUnit(null);
      fetchData();
    } catch (err) {
      alert('Failed to go off duty: ' + err.message);
    }
  }

  async function updateStatus(status) {
    try {
      await api.patch('/api/units/me', { status });
      fetchData();
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  }

  async function updateDetails() {
    try {
      await api.patch('/api/units/me', { location, note });
      fetchData();
    } catch (err) {
      alert('Failed to update: ' + err.message);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Unit Management</h2>

      {/* My unit / Go on duty */}
      {myUnit ? (
        <div className="bg-cad-card border border-cad-border rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Your Unit</h3>
            <button
              onClick={goOffDuty}
              className="px-3 py-1.5 text-sm bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors"
            >
              Go Off Duty
            </button>
          </div>

          <UnitCard unit={myUnit} onStatusChange={updateStatus} />

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <label className="block text-xs text-cad-muted mb-1">Location</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                onBlur={updateDetails}
                className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                placeholder="Current location"
              />
            </div>
            <div>
              <label className="block text-xs text-cad-muted mb-1">Note</label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                onBlur={updateDetails}
                className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                placeholder="Status note"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-cad-card border border-cad-border rounded-lg p-5 mb-6">
          <h3 className="font-semibold mb-3">Go On Duty</h3>
          <form onSubmit={goOnDuty} className="flex gap-3">
            <input
              type="text"
              value={callsign}
              onChange={e => setCallsign(e.target.value)}
              placeholder="Enter callsign (e.g. DP-41)"
              required
              className="flex-1 bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Going...' : 'Go On Duty'}
            </button>
          </form>
        </div>
      )}

      {/* All units */}
      <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-3">
        All On-Duty Units ({units.length})
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {units.map(unit => (
          <UnitCard key={unit.id} unit={unit} />
        ))}
        {units.length === 0 && (
          <p className="text-sm text-cad-muted col-span-full text-center py-8">No units on duty</p>
        )}
      </div>
    </div>
  );
}
