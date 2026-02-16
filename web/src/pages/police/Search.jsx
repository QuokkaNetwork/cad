import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import SearchResults from '../../components/SearchResults';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import { DEPARTMENT_LAYOUT, getDepartmentLayoutType } from '../../utils/departmentLayout';
import { parseFireRecord, parseMedicalRecord } from '../../utils/incidentRecordFormat';
import { parseRecordOffenceItems } from '../../utils/offenceCatalog';
import { useDepartment } from '../../context/DepartmentContext';

function formatErr(err) {
  if (!err) return 'Unknown error';
  const base = err.message || 'Request failed';
  if (Array.isArray(err.details?.errors) && err.details.errors.length > 0) {
    return `${base}\n- ${err.details.errors.join('\n- ')}`;
  }
  return base;
}

function formatMappedValue(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return value.map(v => formatMappedValue(v)).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export default function Search() {
  const { activeDepartment } = useDepartment();
  const layoutType = getDepartmentLayoutType(activeDepartment);
  const isLaw = layoutType === DEPARTMENT_LAYOUT.LAW_ENFORCEMENT;
  const isParamedics = layoutType === DEPARTMENT_LAYOUT.PARAMEDICS;
  const [searchType, setSearchType] = useState('person');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personVehicles, setPersonVehicles] = useState([]);
  const [personRecords, setPersonRecords] = useState([]);

  useEffect(() => {
    if (isParamedics && searchType !== 'person') {
      setSearchType('person');
    }
  }, [isParamedics, searchType]);

  async function doSearch(e) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setResults([]);
    try {
      const endpoint = searchType === 'person' ? '/api/search/persons' : '/api/search/vehicles';
      const data = await api.get(`${endpoint}?q=${encodeURIComponent(query.trim())}`);
      setResults(data);
    } catch (err) {
      alert('Search failed:\n' + formatErr(err));
    } finally {
      setSearching(false);
    }
  }

  async function selectPerson(person) {
    setSelectedPerson(person);
    setPersonVehicles([]);
    setPersonRecords([]);
    try {
      const vehiclePromise = isParamedics
        ? Promise.resolve([])
        : api.get(`/api/search/persons/${person.citizenid}/vehicles`);
      const [personDetails, vehicles, records] = await Promise.all([
        api.get(`/api/search/persons/${person.citizenid}`),
        vehiclePromise,
        api.get(`/api/search/persons/${person.citizenid}/records`),
      ]);
      setSelectedPerson((current) => {
        if (!current || String(current.citizenid || '') !== String(person.citizenid || '')) {
          return current;
        }
        return personDetails && typeof personDetails === 'object' ? personDetails : person;
      });
      setPersonVehicles(Array.isArray(vehicles) ? vehicles : []);
      setPersonRecords(records);
    } catch (err) {
      alert('Failed to load person details:\n' + formatErr(err));
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">
        {isLaw ? 'Person & Vehicle Search' : isParamedics ? 'Patient Lookup' : 'Incident Lookup'}
      </h2>

      {/* Search form */}
      <div className="bg-cad-card border border-cad-border rounded-2xl p-4 mb-6">
        <form onSubmit={doSearch} className="flex flex-col md:flex-row gap-3">
          <div className="flex bg-cad-surface rounded-lg border border-cad-border overflow-hidden">
            <button
              type="button"
              onClick={() => setSearchType('person')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                searchType === 'person' ? 'bg-cad-accent text-white' : 'text-cad-muted hover:text-cad-ink'
              }`}
            >
              {isParamedics ? 'Patient' : 'Person'}
            </button>
            {!isParamedics && (
              <button
                type="button"
                onClick={() => setSearchType('vehicle')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  searchType === 'vehicle' ? 'bg-cad-accent text-white' : 'text-cad-muted hover:text-cad-ink'
                }`}
              >
                Vehicle
              </button>
            )}
          </div>
          <div className="flex-1 relative">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={searchType === 'person'
                ? (isParamedics ? 'Search patient by first or last name...' : 'Search by first or last name...')
                : 'Search by plate or vehicle model...'}
              className="w-full bg-cad-surface border border-cad-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            />
          </div>
          <button
            type="submit"
            disabled={searching || query.trim().length < 2}
            className="px-6 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-cad-card border border-cad-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-cad-border">
            <span className="text-sm text-cad-muted">{results.length} result(s)</span>
          </div>
          <SearchResults
            type={searchType}
            results={results}
            onSelect={searchType === 'person' ? selectPerson : undefined}
          />
        </div>
      )}

      {/* Person Detail Modal */}
      <Modal
        open={!!selectedPerson}
        onClose={() => { setSelectedPerson(null); setPersonVehicles([]); setPersonRecords([]); }}
        title={selectedPerson ? `${selectedPerson.firstname} ${selectedPerson.lastname}` : ''}
        wide
      >
        {selectedPerson && (
          <div className="space-y-4">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-cad-muted">DOB:</span>
                <span className="ml-2">{selectedPerson.birthdate}</span>
              </div>
              <div>
                <span className="text-cad-muted">Phone:</span>
                <span className="ml-2">{selectedPerson.phone}</span>
              </div>
              <div>
                <span className="text-cad-muted">Gender:</span>
                <span className="ml-2">{selectedPerson.gender === '0' ? 'Male' : selectedPerson.gender === '1' ? 'Female' : selectedPerson.gender}</span>
              </div>
              {selectedPerson.nationality && (
                <div>
                  <span className="text-cad-muted">Nationality:</span>
                  <span className="ml-2">{selectedPerson.nationality}</span>
                </div>
              )}
            </div>

            {!isParamedics && (
              <div>
                <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">
                  Registered Vehicles ({personVehicles.length})
                </h4>
                {personVehicles.length > 0 ? (
                  <div className="space-y-1">
                    {personVehicles.map((v, i) => (
                      <div key={i} className="bg-cad-surface rounded px-3 py-2 text-sm">
                        <div className="flex items-center gap-4">
                          <span className="font-mono font-bold text-cad-accent-light">{v.plate}</span>
                          <span>{v.vehicle}</span>
                          <span className="text-cad-muted">{v.garage}</span>
                        </div>
                        {v.custom_fields && Object.keys(v.custom_fields).length > 0 && (
                          <div className="mt-1 text-xs text-cad-muted">
                            {Object.entries(v.custom_fields).map(([key, value]) => (
                              <span key={key} className="mr-3">
                                {key}: {String(value)}
                              </span>
                            ))}
                          </div>
                        )}
                        {Array.isArray(v.mapped_categories) && v.mapped_categories.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {v.mapped_categories.map(category => {
                              const fields = Array.isArray(category.fields)
                                ? category.fields.filter(field => String(field.display_value || '').trim().length > 0)
                                : [];
                              if (fields.length === 0) return null;
                              return (
                                <div key={`${v.plate || i}-${category.id}`} className="text-[11px]">
                                  <p className="text-cad-muted uppercase tracking-wider mb-0.5">{category.name}</p>
                                  <div className="text-cad-muted">
                                    {fields.map(field => (
                                      <span key={field.id} className="mr-3">
                                        {field.label}: {formatMappedValue(field.value)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-cad-muted">No vehicles registered</p>
                )}
              </div>
            )}

            {selectedPerson.custom_fields && Object.keys(selectedPerson.custom_fields).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">
                  Custom Fields
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(selectedPerson.custom_fields).map(([key, value]) => (
                    <div key={key}>
                      <span className="text-cad-muted">{key}:</span>
                      <span className="ml-2">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(selectedPerson.mapped_categories) && selectedPerson.mapped_categories.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">
                  Database Mappings
                </h4>
                <div className="space-y-3">
                  {selectedPerson.mapped_categories.map(category => {
                    const fields = Array.isArray(category.fields)
                      ? category.fields.filter(field => String(field.display_value || '').trim().length > 0)
                      : [];
                    if (fields.length === 0) return null;
                    return (
                      <div key={category.id} className="bg-cad-surface rounded px-3 py-2">
                        <p className="text-xs text-cad-muted uppercase tracking-wider mb-1">{category.name}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-sm">
                          {fields.map(field => (
                            <div key={field.id}>
                              <span className="text-cad-muted">{field.label}:</span>
                              <span className="ml-2">{formatMappedValue(field.value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Criminal records */}
            <div>
              <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">
                {isLaw ? 'Criminal History' : isParamedics ? 'Patient Reports' : 'Incident Reports'} ({personRecords.length})
              </h4>
              {personRecords.length > 0 ? (
                <div className="space-y-2">
                  {personRecords.map(r => {
                    const medical = parseMedicalRecord(r);
                    const fire = parseFireRecord(r);
                    const offenceItems = parseRecordOffenceItems(r);
                    const offenceTotal = offenceItems.reduce(
                      (sum, item) => sum + (Number(item.line_total || (item.fine_amount * item.quantity)) || 0),
                      0
                    );
                    return (
                      <div key={r.id} className="bg-cad-surface rounded p-3">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <StatusBadge status={r.type} />
                          <span className="font-medium text-sm">{r.title}</span>
                          {medical && <span className="text-[11px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">Medical</span>}
                          {fire && <span className="text-[11px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300 border border-orange-500/30">Fire</span>}
                          {offenceItems.length > 0 && <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">Offences</span>}
                        </div>
                        {medical ? (
                          <div className="text-xs text-cad-muted space-y-1">
                            <p>Severity: {medical.severity} | Pain: {medical.pain}/10</p>
                            {medical.treatment && <p>Treatment: {medical.treatment}</p>}
                            {medical.transport_to && <p>Transport: {medical.transport_to}</p>}
                          </div>
                        ) : fire ? (
                          <div className="text-xs text-cad-muted space-y-1">
                            <p>Type: {fire.incident_type} | Severity: {fire.severity}</p>
                            {fire.action_taken && <p>Action: {fire.action_taken}</p>}
                            <p>Casualties: {Number(fire.casualties || 0)}</p>
                          </div>
                        ) : offenceItems.length > 0 ? (
                          <div className="text-xs text-cad-muted space-y-1">
                            {offenceItems.map((item, idx) => (
                              <p key={`${r.id}-offence-${idx}`}>
                                {item.quantity}x {item.code ? `${item.code} - ` : ''}{item.title}
                              </p>
                            ))}
                            <p className="text-amber-300">Total Fine: ${Number(offenceTotal || 0).toLocaleString()}</p>
                            {r.description && <p>Notes: {r.description}</p>}
                          </div>
                        ) : (
                          <>
                            {r.description && <p className="text-xs text-cad-muted">{r.description}</p>}
                            {r.type === 'fine' && r.fine_amount > 0 && (
                              <p className="text-xs text-amber-400 mt-1">${r.fine_amount.toLocaleString()}</p>
                            )}
                          </>
                        )}
                        <p className="text-xs text-cad-muted mt-1">
                          {r.officer_callsign} {r.officer_name} - {new Date(r.created_at + 'Z').toLocaleDateString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-cad-muted">
                  {isLaw ? 'No criminal history' : isParamedics ? 'No patient reports' : 'No incident reports'}
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
