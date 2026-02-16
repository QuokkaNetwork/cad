import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import SearchResults from '../../components/SearchResults';
import Modal from '../../components/Modal';
import { DEPARTMENT_LAYOUT, getDepartmentLayoutType } from '../../utils/departmentLayout';
import Records from './Records';
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

function normalizeLookupFields(lookupFields) {
  const fields = Array.isArray(lookupFields) ? lookupFields : [];
  return [...fields]
    .filter((field) => String(field?.display_value || '').trim().length > 0)
    .sort((a, b) => {
      const aSort = Number(a?.sort_order || 0);
      const bSort = Number(b?.sort_order || 0);
      if (aSort !== bSort) return aSort - bSort;
      return String(a?.label || '').localeCompare(String(b?.label || ''));
    });
}

function toBooleanText(value) {
  const text = String(value || '').trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(text)) return 'Yes';
  if (['false', '0', 'no', 'n', 'off'].includes(text)) return 'No';
  return String(value || '');
}

function LookupFieldValue({ field }) {
  const type = String(field?.field_type || 'text').toLowerCase();
  const value = String(field?.display_value || '').trim();
  if (!value) return null;

  if (type === 'image') {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="text-cad-accent-light underline break-all"
      >
        Open image
      </a>
    );
  }

  if (type === 'badge') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded border border-cad-accent/40 bg-cad-accent/15 text-cad-accent-light text-xs">
        {value}
      </span>
    );
  }

  if (type === 'boolean') {
    return <span>{toBooleanText(value)}</span>;
  }

  return <span>{value}</span>;
}

function LookupFieldsSection({ title, fields }) {
  const normalized = normalizeLookupFields(fields);
  if (normalized.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {normalized.map((field, idx) => (
          <div
            key={`${field?.key || field?.label || 'lookup'}-${idx}`}
            className="bg-cad-surface border border-cad-border rounded px-3 py-2"
          >
            <p className="text-xs text-cad-muted mb-0.5">{field.label || 'Field'}</p>
            <div className="text-sm break-words">
              <LookupFieldValue field={field} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Search() {
  const { activeDepartment } = useDepartment();
  const layoutType = getDepartmentLayoutType(activeDepartment);
  const isLaw = layoutType === DEPARTMENT_LAYOUT.LAW_ENFORCEMENT;
  const isParamedics = layoutType === DEPARTMENT_LAYOUT.PARAMEDICS;
  const [searchType, setSearchType] = useState('person');
  const [personFirstName, setPersonFirstName] = useState('');
  const [personLastName, setPersonLastName] = useState('');
  const [vehicleQuery, setVehicleQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [personVehicles, setPersonVehicles] = useState([]);
  const [vehicleOwner, setVehicleOwner] = useState(null);

  const personQuery = `${String(personFirstName || '').trim()} ${String(personLastName || '').trim()}`.trim();
  const activeQuery = searchType === 'person' ? personQuery : String(vehicleQuery || '').trim();
  const canSearch = activeQuery.length >= 2;

  useEffect(() => {
    if (isParamedics && searchType !== 'person') {
      setSearchType('person');
    }
  }, [isParamedics, searchType]);

  async function doSearch(e) {
    e.preventDefault();
    if (!canSearch) return;
    setSearching(true);
    setResults([]);
    try {
      const endpoint = searchType === 'person' ? '/api/search/persons' : '/api/search/vehicles';
      const data = await api.get(`${endpoint}?q=${encodeURIComponent(activeQuery)}`);
      setResults(data);
    } catch (err) {
      alert('Search failed:\n' + formatErr(err));
    } finally {
      setSearching(false);
    }
  }

  async function selectPerson(person) {
    setSelectedVehicle(null);
    setSelectedPerson(person);
    setPersonVehicles([]);
    try {
      const vehiclePromise = isParamedics
        ? Promise.resolve([])
        : api.get(`/api/search/persons/${person.citizenid}/vehicles`);
      const [personDetails, vehicles] = await Promise.all([
        api.get(`/api/search/persons/${person.citizenid}`),
        vehiclePromise,
      ]);
      setSelectedPerson((current) => {
        if (!current || String(current.citizenid || '') !== String(person.citizenid || '')) {
          return current;
        }
        return personDetails && typeof personDetails === 'object' ? personDetails : person;
      });
      setPersonVehicles(Array.isArray(vehicles) ? vehicles : []);
    } catch (err) {
      alert('Failed to load person details:\n' + formatErr(err));
    }
  }

  async function selectVehicle(vehicle) {
    setSelectedPerson(null);
    setPersonVehicles([]);
    setVehicleOwner(null);
    setSelectedVehicle(vehicle);

    try {
      const plate = String(vehicle?.plate || '').trim();
      if (!plate) return;
      const details = await api.get(`/api/search/vehicles/${encodeURIComponent(plate)}`);
      setSelectedVehicle(details && typeof details === 'object' ? details : vehicle);

      const ownerCitizenId = String((details && details.owner) || vehicle?.owner || '').trim();
      if (ownerCitizenId) {
        try {
          const owner = await api.get(`/api/search/persons/${encodeURIComponent(ownerCitizenId)}`);
          setVehicleOwner(owner && typeof owner === 'object' ? owner : null);
        } catch {
          setVehicleOwner(null);
        }
      }
    } catch (err) {
      alert('Failed to load vehicle details:\n' + formatErr(err));
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">
        {isLaw ? 'Person & Vehicle Search' : isParamedics ? 'Patient Lookup' : 'Incident Lookup'}
      </h2>

      {/* Search form */}
      <div className="bg-cad-card border border-cad-border rounded-2xl p-4 mb-6">
        <form onSubmit={doSearch} className="flex flex-col gap-3">
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

          {searchType === 'person' ? (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <div>
                <label className="block text-xs text-cad-muted mb-1">First Name</label>
                <input
                  type="text"
                  value={personFirstName}
                  onChange={(e) => setPersonFirstName(e.target.value)}
                  placeholder={isParamedics ? 'Patient first name' : 'Person first name'}
                  className="w-full bg-cad-surface border border-cad-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-cad-muted mb-1">Last Name</label>
                <input
                  type="text"
                  value={personLastName}
                  onChange={(e) => setPersonLastName(e.target.value)}
                  placeholder={isParamedics ? 'Patient last name' : 'Person last name'}
                  className="w-full bg-cad-surface border border-cad-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                />
              </div>
              <button
                type="submit"
                disabled={searching || !canSearch}
                className="px-6 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <label className="block text-xs text-cad-muted mb-1">Plate Or Model</label>
                <input
                  type="text"
                  value={vehicleQuery}
                  onChange={(e) => setVehicleQuery(e.target.value)}
                  placeholder="Search by plate or vehicle model..."
                  className="w-full bg-cad-surface border border-cad-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                />
              </div>
              <button
                type="submit"
                disabled={searching || !canSearch}
                className="px-6 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>
          )}
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
            onSelect={searchType === 'person' ? selectPerson : selectVehicle}
          />
        </div>
      )}

      {/* Person Detail Modal */}
      <Modal
        open={!!selectedPerson}
        onClose={() => {
          setSelectedPerson(null);
          setPersonVehicles([]);
          setVehicleOwner(null);
        }}
        title={selectedPerson ? `${selectedPerson.firstname} ${selectedPerson.lastname}` : ''}
        wide
      >
        {selectedPerson && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">
                Character Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="bg-cad-surface border border-cad-border rounded px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-cad-muted">DOB</p>
                  <p className="text-sm mt-1">{selectedPerson.birthdate || '-'}</p>
                </div>
                <div className="bg-cad-surface border border-cad-border rounded px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-cad-muted">Phone</p>
                  <p className="text-sm mt-1">{selectedPerson.phone || '-'}</p>
                </div>
                <div className="bg-cad-surface border border-cad-border rounded px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-cad-muted">Gender</p>
                  <p className="text-sm mt-1">
                    {selectedPerson.gender === '0'
                      ? 'Male'
                      : selectedPerson.gender === '1'
                        ? 'Female'
                        : (selectedPerson.gender || '-')}
                  </p>
                </div>
                <div className="bg-cad-surface border border-cad-border rounded px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-cad-muted">Nationality</p>
                  <p className="text-sm mt-1">{selectedPerson.nationality || '-'}</p>
                </div>
              </div>
            </div>

            <LookupFieldsSection
              title="Additional Information"
              fields={selectedPerson.lookup_fields}
            />

            {!isParamedics && (
              <details className="bg-cad-surface border border-cad-border rounded-lg">
                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-cad-muted uppercase tracking-wider">
                  Registered Vehicles ({personVehicles.length})
                </summary>
                <div className="px-3 pb-3 pt-2 border-t border-cad-border/60">
                  {personVehicles.length > 0 ? (
                    <div className="space-y-1">
                      {personVehicles.map((v, i) => (
                        <div key={i} className="bg-cad-card rounded px-3 py-2 text-sm">
                          <div className="flex flex-wrap items-center gap-4">
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
              </details>
            )}

            <div className="border-t border-cad-border pt-3">
              <Records
                embeddedPerson={selectedPerson}
                embeddedDepartmentId={activeDepartment?.id}
                hideHeader
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Vehicle Detail Modal */}
      <Modal
        open={!!selectedVehicle}
        onClose={() => {
          setSelectedVehicle(null);
          setVehicleOwner(null);
        }}
        title={selectedVehicle ? `Vehicle ${selectedVehicle.plate || ''}` : ''}
        wide
      >
        {selectedVehicle && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-cad-muted">Plate:</span>
                <span className="ml-2 font-mono font-semibold text-cad-accent-light">{selectedVehicle.plate || '-'}</span>
              </div>
              <div>
                <span className="text-cad-muted">Model:</span>
                <span className="ml-2">{selectedVehicle.vehicle || '-'}</span>
              </div>
              <div>
                <span className="text-cad-muted">Garage:</span>
                <span className="ml-2">{selectedVehicle.garage || '-'}</span>
              </div>
              <div>
                <span className="text-cad-muted">State:</span>
                <span className="ml-2">{selectedVehicle.state || '-'}</span>
              </div>
              <div>
                <span className="text-cad-muted">Owner Citizen ID:</span>
                <span className="ml-2">{selectedVehicle.owner || '-'}</span>
              </div>
            </div>

            <LookupFieldsSection
              title="Additional Information"
              fields={selectedVehicle.lookup_fields}
            />

            {vehicleOwner && (
              <div className="bg-cad-surface rounded px-3 py-2">
                <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-1">Registered Owner</h4>
                <p className="text-sm">
                  {vehicleOwner.firstname} {vehicleOwner.lastname}
                </p>
                <p className="text-xs text-cad-muted">
                  DOB: {vehicleOwner.birthdate || '-'} | Phone: {vehicleOwner.phone || '-'}
                </p>
              </div>
            )}

            {selectedVehicle.custom_fields && Object.keys(selectedVehicle.custom_fields).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">
                  Custom Fields
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(selectedVehicle.custom_fields).map(([key, value]) => (
                    <div key={key}>
                      <span className="text-cad-muted">{key}:</span>
                      <span className="ml-2">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(selectedVehicle.mapped_categories) && selectedVehicle.mapped_categories.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">
                  Database Mappings
                </h4>
                <div className="space-y-3">
                  {selectedVehicle.mapped_categories.map(category => {
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
          </div>
        )}
      </Modal>
    </div>
  );
}
