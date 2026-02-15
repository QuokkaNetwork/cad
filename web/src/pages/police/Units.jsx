import { useState, useEffect, useCallback } from 'react';
import { useDepartment } from '../../context/DepartmentContext';
import { useEventSource } from '../../hooks/useEventSource';
import { api } from '../../api/client';
import UnitCard from '../../components/UnitCard';

export default function Units() {
  const { activeDepartment } = useDepartment();
  const [units, setUnits] = useState([]);
  const [myUnit, setMyUnit] = useState(null);
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');

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
          <h3 className="font-semibold mb-1">Not On Duty</h3>
          <p className="text-sm text-cad-muted">
            Use the <span className="text-cad-ink font-medium">Go On Duty</span> button in the header to set your callsign and start your shift.
          </p>
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
