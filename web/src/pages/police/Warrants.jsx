import { useState, useEffect, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useDepartment } from '../../context/DepartmentContext';
import { useEventSource } from '../../hooks/useEventSource';
import { api } from '../../api/client';
import Modal from '../../components/Modal';
import EvidencePanel from '../../components/EvidencePanel';
import { DEPARTMENT_LAYOUT, getDepartmentLayoutType } from '../../utils/departmentLayout';
import { formatDateTimeAU } from '../../utils/dateTime';
import { getOffenceCategoryLabel } from '../../utils/offenceCatalog';

function normalizePersonSearchOption(row) {
  const source = row && typeof row === 'object' ? row : {};
  const citizenId = String(source.citizenId || source.citizenid || source.citizen_id || '').trim();
  const fullName = String(
    source.name
    || source.full_name
    || `${String(source.firstname || '').trim()} ${String(source.lastname || '').trim()}`.trim()
    || ''
  ).trim();

  return {
    citizenId,
    name: fullName || citizenId,
  };
}

function normalizeOffenceCatalogItem(item) {
  const source = item && typeof item === 'object' ? item : {};
  const id = Number(source.id || 0);
  const title = String(source.title || '').trim();
  if (!Number.isInteger(id) || id <= 0 || !title) return null;
  return {
    id,
    code: String(source.code || '').trim(),
    title,
    description: String(source.description || '').trim(),
    category: String(source.category || '').trim(),
    is_active: Number(source.is_active ?? 1) !== 0,
  };
}

function buildWarrantChargeTitle(charges) {
  const items = Array.isArray(charges) ? charges : [];
  if (!items.length) return '';
  const names = items
    .map((item) => String(item?.title || '').trim())
    .filter(Boolean);
  if (!names.length) return '';
  const firstThree = names.slice(0, 3);
  const suffix = names.length > 3 ? ` +${names.length - 3} more` : '';
  return `Warrant - ${firstThree.join(', ')}${suffix}`;
}

function WarrantCard({ warrant, onServe, onCancel, departmentId }) {
  const createdAt = formatDateTimeAU(warrant.created_at ? `${warrant.created_at}Z` : '', '');
  const subjectName = String(warrant.subject_name || '').trim() || 'Unknown Person';
  const citizenId = String(warrant.citizen_id || '').trim();

  return (
    <div className="bg-cad-card border border-amber-500/30 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-amber-300 truncate">{warrant.title}</h3>
          <p className="text-xs text-cad-muted mt-1">Person: <span className="text-cad-ink">{subjectName}</span></p>
          {citizenId ? (
            <p className="text-xs text-cad-muted mt-1">
              Citizen ID: <span className="font-mono">{citizenId}</span>
            </p>
          ) : null}
        </div>
        <span className="px-2 py-1 rounded text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 whitespace-nowrap">
          Active
        </span>
      </div>

      {warrant.description && (
        <p className="text-sm text-cad-muted mb-3">{warrant.description}</p>
      )}

      <div className="text-xs text-cad-muted space-y-1 mb-3">
        <p>Created by: {warrant.creator_name || 'Unknown'}</p>
        <p>Created: {createdAt}</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onServe(warrant.id)}
          className="flex-1 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-xs font-medium transition-colors"
        >
          Mark Served
        </button>
        <button
          onClick={() => onCancel(warrant.id)}
          className="flex-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs font-medium transition-colors"
        >
          Cancel
        </button>
      </div>

      <div className="mt-3">
        <EvidencePanel
          entityType="warrant"
          entityId={warrant.id}
          departmentId={departmentId || warrant.department_id || null}
          title="Warrant Evidence"
          compact
        />
      </div>
    </div>
  );
}

export default function Warrants() {
  const { activeDepartment } = useDepartment();
  const location = useLocation();
  const { key: locationKey } = location;
  const [searchParams, setSearchParams] = useSearchParams();
  const [warrants, setWarrants] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ subject_name: '', citizen_id: '', title: '', description: '' });
  const [personMatches, setPersonMatches] = useState([]);
  const [personSearching, setPersonSearching] = useState(false);
  const [offenceCatalog, setOffenceCatalog] = useState([]);
  const [offenceCatalogLoading, setOffenceCatalogLoading] = useState(false);
  const [offenceQuery, setOffenceQuery] = useState('');
  const [selectedCharges, setSelectedCharges] = useState([]);

  const deptId = activeDepartment?.id;
  const layoutType = getDepartmentLayoutType(activeDepartment);
  const isLaw = layoutType === DEPARTMENT_LAYOUT.LAW_ENFORCEMENT;

  function resetCreateForm() {
    setForm({ subject_name: '', citizen_id: '', title: '', description: '' });
    setPersonMatches([]);
    setPersonSearching(false);
    setOffenceQuery('');
    setSelectedCharges([]);
  }

  function openCreateModal() {
    resetCreateForm();
    setShowNew(true);
  }

  function closeCreateModal() {
    setShowNew(false);
    setPersonMatches([]);
    setPersonSearching(false);
  }

  const fetchData = useCallback(async () => {
    if (!deptId || !isLaw) {
      setWarrants([]);
      return;
    }
    try {
      const data = await api.get(`/api/warrants?department_id=${deptId}`);
      setWarrants(data);
    } catch (err) {
      console.error('Failed to load warrants:', err);
    }
  }, [deptId, isLaw]);

  useEffect(() => { fetchData(); }, [fetchData, locationKey]);

  useEffect(() => {
    if (!showNew) {
      setPersonMatches([]);
      setPersonSearching(false);
      return;
    }

    const query = String(form.subject_name || '').trim();
    if (query.length < 2) {
      setPersonMatches([]);
      setPersonSearching(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setPersonSearching(true);
      try {
        const payload = await api.get(`/api/search/cad/persons?q=${encodeURIComponent(query)}`);
        if (cancelled) return;
        const matches = Array.isArray(payload)
          ? payload
            .map(normalizePersonSearchOption)
            .filter((entry) => entry.name)
            .slice(0, 8)
          : [];
        setPersonMatches(matches);
      } catch {
        if (!cancelled) setPersonMatches([]);
      } finally {
        if (!cancelled) setPersonSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [showNew, form.subject_name]);

  useEffect(() => {
    if (!isLaw || !showNew) return;
    if (offenceCatalogLoading || offenceCatalog.length > 0) return;

    let cancelled = false;
    setOffenceCatalogLoading(true);
    api.get('/api/records/offence-catalog')
      .then((rows) => {
        if (cancelled) return;
        const normalized = Array.isArray(rows)
          ? rows
            .map(normalizeOffenceCatalogItem)
            .filter((row) => row && row.is_active)
            .sort((a, b) => {
              const codeA = String(a.code || '').toLowerCase();
              const codeB = String(b.code || '').toLowerCase();
              if (codeA && codeB && codeA !== codeB) return codeA.localeCompare(codeB);
              if (codeA && !codeB) return -1;
              if (!codeA && codeB) return 1;
              return a.title.localeCompare(b.title);
            })
          : [];
        setOffenceCatalog(normalized);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load offence catalog for warrants:', err);
          setOffenceCatalog([]);
        }
      })
      .finally(() => {
        if (!cancelled) setOffenceCatalogLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLaw, showNew, offenceCatalog.length, offenceCatalogLoading]);

  useEffect(() => {
    if (!isLaw) return;
    if (searchParams.get('new') !== '1') return;
    openCreateModal();
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('new');
    setSearchParams(nextParams, { replace: true });
  }, [isLaw, searchParams, setSearchParams]);

  useEventSource({
    'warrant:create': () => fetchData(),
    'warrant:serve': () => fetchData(),
    'warrant:cancel': () => fetchData(),
  });

  function selectPersonMatch(match) {
    const normalized = normalizePersonSearchOption(match);
    setForm((current) => ({
      ...current,
      subject_name: normalized.name || current.subject_name,
      citizen_id: normalized.citizenId || current.citizen_id,
    }));
    setPersonMatches([]);
  }

  function toggleCharge(offence) {
    if (!offence || !offence.id) return;
    setSelectedCharges((current) => {
      const exists = current.some((row) => Number(row.offence_id) === Number(offence.id));
      if (exists) {
        return current.filter((row) => Number(row.offence_id) !== Number(offence.id));
      }
      return [
        ...current,
        {
          offence_id: Number(offence.id),
          code: String(offence.code || '').trim(),
          title: String(offence.title || '').trim(),
          category: String(offence.category || '').trim(),
        },
      ];
    });
  }

  function removeCharge(offenceId) {
    const id = Number(offenceId);
    setSelectedCharges((current) => current.filter((row) => Number(row.offence_id) !== id));
  }

  function applyChargesToTitle() {
    const suggested = buildWarrantChargeTitle(selectedCharges);
    if (!suggested) {
      alert('Select at least one charge first.');
      return;
    }
    setForm((current) => ({ ...current, title: suggested }));
  }

  async function createWarrant(e) {
    e.preventDefault();
    try {
      await api.post('/api/warrants', {
        department_id: deptId,
        subject_name: form.subject_name,
        citizen_id: form.citizen_id,
        title: form.title,
        description: form.description,
        details: {
          charges: selectedCharges.map((charge) => ({
            offence_id: Number(charge.offence_id || 0),
            code: String(charge.code || '').trim(),
            title: String(charge.title || '').trim(),
            category: String(charge.category || '').trim(),
          })).filter((charge) => charge.offence_id > 0 && charge.title),
        },
      });
      closeCreateModal();
      resetCreateForm();
      fetchData();
    } catch (err) {
      alert('Failed to create warrant: ' + err.message);
    }
  }

  async function serveWarrant(id) {
    try {
      await api.patch(`/api/warrants/${id}/serve`);
      fetchData();
    } catch (err) {
      alert('Failed to serve warrant: ' + err.message);
    }
  }

  async function cancelWarrant(id) {
    if (!confirm('Cancel this warrant?')) return;
    try {
      await api.patch(`/api/warrants/${id}/cancel`);
      fetchData();
    } catch (err) {
      alert('Failed to cancel warrant: ' + err.message);
    }
  }

  return (
    <div>
      {isLaw ? (
        <>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Warrants</h2>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              + New Warrant
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {warrants.map(warrant => (
              <WarrantCard
                key={warrant.id}
                warrant={warrant}
                onServe={serveWarrant}
                onCancel={cancelWarrant}
                departmentId={deptId}
              />
            ))}
            {warrants.length === 0 && (
              <p className="text-sm text-cad-muted col-span-full text-center py-8">No active warrants</p>
            )}
          </div>

          <Modal open={showNew} onClose={closeCreateModal} title="Create Warrant">
            <form onSubmit={createWarrant} className="space-y-3">
              <div>
                <label className="block text-sm text-cad-muted mb-1">Person Name *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={form.subject_name}
                    onChange={e => setForm(f => ({ ...f, subject_name: e.target.value }))}
                    className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                    placeholder="Start typing a name to search..."
                  />
                  {personSearching ? (
                    <p className="mt-1 text-[11px] text-cad-muted">Searching people...</p>
                  ) : null}
                  {personMatches.length > 0 ? (
                    <div className="mt-1 rounded border border-cad-border bg-cad-surface max-h-44 overflow-y-auto">
                      {personMatches.map((match) => (
                        <button
                          key={`${match.citizenId || 'unknown'}-${match.name}`}
                          type="button"
                          onClick={() => selectPersonMatch(match)}
                          className="w-full text-left px-2 py-1.5 text-xs hover:bg-cad-card transition-colors"
                        >
                          <div className="text-cad-ink truncate">{match.name}</div>
                          <div className="text-[11px] text-cad-muted font-mono truncate">{match.citizenId || '-'}</div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div>
                <label className="block text-sm text-cad-muted mb-1">Citizen ID (optional)</label>
                <input
                  type="text"
                  value={form.citizen_id}
                  onChange={e => setForm(f => ({ ...f, citizen_id: e.target.value }))}
                  className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cad-accent"
                  placeholder="e.g. VLM1B4NQ"
                />
              </div>

              <div>
                <label className="block text-sm text-cad-muted mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                  placeholder="e.g. Warrant for arrest - Armed robbery"
                />
                {selectedCharges.length > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={applyChargesToTitle}
                      className="px-2.5 py-1 text-xs rounded border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-colors"
                    >
                      Use Selected Charges as Title
                    </button>
                    <p className="text-[11px] text-cad-muted">
                      Suggested: {buildWarrantChargeTitle(selectedCharges)}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="border border-cad-border rounded-lg p-3 bg-cad-card/40">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="block text-sm text-cad-muted">Charges (optional)</label>
                  {selectedCharges.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setSelectedCharges([])}
                      className="text-xs text-cad-muted hover:text-cad-ink transition-colors"
                    >
                      Clear all
                    </button>
                  ) : null}
                </div>

                {selectedCharges.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {selectedCharges.map((charge) => (
                      <button
                        key={`selected-charge-${charge.offence_id}`}
                        type="button"
                        onClick={() => removeCharge(charge.offence_id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs"
                        title="Remove charge"
                      >
                        <span className="font-mono text-[10px]">{charge.code || '#'}</span>
                        <span>{charge.title}</span>
                        <span className="text-cad-muted">×</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mb-3 text-xs text-cad-muted">Select charges to attach them to the warrant and quickly build the title.</p>
                )}

                <input
                  type="text"
                  value={offenceQuery}
                  onChange={(e) => setOffenceQuery(e.target.value)}
                  placeholder="Search charges by code, title, description..."
                  className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                />

                <div className="mt-2 rounded border border-cad-border bg-cad-surface max-h-52 overflow-y-auto">
                  {offenceCatalogLoading ? (
                    <p className="px-3 py-2 text-xs text-cad-muted">Loading offence catalog...</p>
                  ) : (() => {
                    const query = String(offenceQuery || '').trim().toLowerCase();
                    const filtered = offenceCatalog
                      .filter((offence) => {
                        if (!query) return true;
                        return (
                          String(offence.code || '').toLowerCase().includes(query)
                          || String(offence.title || '').toLowerCase().includes(query)
                          || String(offence.description || '').toLowerCase().includes(query)
                          || String(offence.category || '').toLowerCase().includes(query)
                        );
                      })
                      .slice(0, 24);

                    if (filtered.length === 0) {
                      return <p className="px-3 py-2 text-xs text-cad-muted">No charges match your search.</p>;
                    }

                    return filtered.map((offence) => {
                      const selected = selectedCharges.some((row) => Number(row.offence_id) === Number(offence.id));
                      return (
                        <button
                          key={`offence-${offence.id}`}
                          type="button"
                          onClick={() => toggleCharge(offence)}
                          className={`w-full text-left px-3 py-2 border-b border-cad-border last:border-b-0 transition-colors ${
                            selected ? 'bg-amber-500/10' : 'hover:bg-cad-card'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm text-cad-ink truncate">
                                {offence.code ? <span className="font-mono text-cad-muted">{offence.code} </span> : null}
                                {offence.title}
                              </p>
                              <p className="text-[11px] text-cad-muted truncate">
                                {getOffenceCategoryLabel(offence.category)}
                                {offence.description ? ` • ${offence.description}` : ''}
                              </p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded border whitespace-nowrap ${
                              selected
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : 'bg-cad-card text-cad-muted border-cad-border'
                            }`}>
                              {selected ? 'Selected' : 'Add'}
                            </span>
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              <div>
                <label className="block text-sm text-cad-muted mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded text-sm font-medium transition-colors"
                >
                  Create Warrant
                </button>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="px-4 py-2 bg-cad-card hover:bg-cad-border text-cad-muted rounded text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        </>
      ) : (
        <div className="bg-cad-card border border-cad-border rounded-lg p-5">
          <h2 className="text-xl font-bold mb-2">Warrants</h2>
          <p className="text-sm text-cad-muted">
            Warrant management is available for law enforcement departments only.
          </p>
        </div>
      )}
    </div>
  );
}
