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

const LICENSE_STATUS_OPTIONS = ['valid', 'suspended', 'disqualified', 'expired'];
const REGISTRATION_STATUS_OPTIONS = ['valid', 'suspended', 'revoked', 'expired'];

function formatStatusLabel(value) {
  return String(value || '')
    .trim()
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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

function parsePreviewWidth(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(4, Math.trunc(parsed)));
}

function LookupFieldsSection({ title, fields }) {
  const normalized = normalizeLookupFields(fields);
  if (normalized.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">{title}</h4>
      <div className="grid grid-cols-4 gap-2">
        {normalized.map((field, idx) => {
          const width = parsePreviewWidth(field.preview_width || 1);
          const type = String(field?.field_type || 'text').toLowerCase();
          return (
            <div
              key={`${field?.key || field?.label || 'lookup'}-${idx}`}
              style={{ gridColumn: `span ${width} / span ${width}` }}
              className="bg-cad-surface border border-cad-border rounded px-3 py-2 min-h-[70px]"
            >
              <p className="text-[10px] uppercase tracking-wider text-cad-muted mb-0.5">
                {field.label || 'Field'}
              </p>
              {type === 'image' ? (
                <div className="mt-1 h-20 rounded border border-cad-border/70 bg-cad-card flex items-center justify-center">
                  <LookupFieldValue field={field} />
                </div>
              ) : (
                <div className="text-sm break-words mt-1">
                  <LookupFieldValue field={field} />
                </div>
              )}
            </div>
          );
        })}
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
  const [licenseStatusDraft, setLicenseStatusDraft] = useState('valid');
  const [registrationStatusDraft, setRegistrationStatusDraft] = useState('valid');
  const [licenseStatusSaving, setLicenseStatusSaving] = useState(false);
  const [registrationStatusSaving, setRegistrationStatusSaving] = useState(false);

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
    setLicenseStatusDraft('valid');
    try {
      const vehiclePromise = isParamedics
        ? Promise.resolve([])
        : api.get(`/api/search/persons/${person.citizenid}/vehicles`);
      const [personDetails, vehicles] = await Promise.all([
        api.get(`/api/search/persons/${person.citizenid}`),
        vehiclePromise,
      ]);
      const resolvedPerson = personDetails && typeof personDetails === 'object' ? personDetails : person;
      setSelectedPerson((current) => {
        if (!current || String(current.citizenid || '') !== String(person.citizenid || '')) {
          return current;
        }
        return resolvedPerson;
      });
      setPersonVehicles(Array.isArray(vehicles) ? vehicles : []);
      setLicenseStatusDraft(String(resolvedPerson?.cad_driver_license?.status || 'valid'));
    } catch (err) {
      alert('Failed to load person details:\n' + formatErr(err));
    }
  }

  async function selectVehicle(vehicle) {
    setSelectedPerson(null);
    setPersonVehicles([]);
    setVehicleOwner(null);
    setSelectedVehicle(vehicle);
    setRegistrationStatusDraft('valid');

    try {
      const plate = String(vehicle?.plate || '').trim();
      if (!plate) return;
      const details = await api.get(`/api/search/vehicles/${encodeURIComponent(plate)}`);
      const resolvedVehicle = details && typeof details === 'object' ? details : vehicle;
      setSelectedVehicle(resolvedVehicle);
      setRegistrationStatusDraft(String(resolvedVehicle?.cad_registration?.status || 'valid'));

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

  async function savePersonLicenseStatus() {
    if (!selectedPerson?.citizenid || !selectedPerson?.cad_driver_license) return;
    setLicenseStatusSaving(true);
    try {
      const updated = await api.patch(
        `/api/search/persons/${encodeURIComponent(selectedPerson.citizenid)}/license`,
        { status: licenseStatusDraft }
      );
      setSelectedPerson((current) => {
        if (!current || String(current.citizenid || '') !== String(selectedPerson.citizenid || '')) {
          return current;
        }
        return { ...current, cad_driver_license: updated };
      });
    } catch (err) {
      alert('Failed to update license status:\n' + formatErr(err));
    } finally {
      setLicenseStatusSaving(false);
    }
  }

  async function saveVehicleRegistrationStatus() {
    const plate = String(selectedVehicle?.plate || '').trim();
    if (!plate || !selectedVehicle?.cad_registration) return;
    setRegistrationStatusSaving(true);
    try {
      const updated = await api.patch(
        `/api/search/vehicles/${encodeURIComponent(plate)}/registration`,
        { status: registrationStatusDraft }
      );
      setSelectedVehicle((current) => {
        if (!current || String(current.plate || '').trim() !== plate) return current;
        return { ...current, cad_registration: updated };
      });
    } catch (err) {
      alert('Failed to update registration status:\n' + formatErr(err));
    } finally {
      setRegistrationStatusSaving(false);
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
          setLicenseStatusDraft('valid');
        }}
        title={selectedPerson ? `${selectedPerson.firstname} ${selectedPerson.lastname}` : ''}
        wide
      >
        {selectedPerson && (
          <div className="space-y-4">
            <LookupFieldsSection
              title="Character Information"
              fields={selectedPerson.lookup_fields}
            />

            <div className="bg-cad-surface border border-cad-border rounded-lg px-3 py-3">
              <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">
                Driver Licence (CAD)
              </h4>
              {selectedPerson.cad_driver_license ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <p>Licence No: <span className="text-cad-ink">{selectedPerson.cad_driver_license.license_number || '-'}</span></p>
                    <p>Expiry: <span className="text-cad-ink">{selectedPerson.cad_driver_license.expiry_at || '-'}</span></p>
                    <p>DOB: <span className="text-cad-ink">{selectedPerson.cad_driver_license.date_of_birth || '-'}</span></p>
                    <p>Classes: <span className="text-cad-ink">{Array.isArray(selectedPerson.cad_driver_license.license_classes) && selectedPerson.cad_driver_license.license_classes.length > 0 ? selectedPerson.cad_driver_license.license_classes.join(', ') : '-'}</span></p>
                  </div>
                  <div className="flex flex-col md:flex-row gap-2 md:items-center">
                    <select
                      value={licenseStatusDraft}
                      onChange={(e) => setLicenseStatusDraft(e.target.value)}
                      className="bg-cad-card border border-cad-border rounded px-3 py-2 text-sm"
                    >
                      {LICENSE_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {formatStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={savePersonLicenseStatus}
                      disabled={licenseStatusSaving}
                      className="px-3 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {licenseStatusSaving ? 'Saving...' : 'Update Licence Status'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-cad-muted">No CAD driver licence record found.</p>
              )}
            </div>

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
                          {v.cad_registration && (
                            <div className="mt-1 text-xs text-cad-muted">
                              CAD rego: {formatStatusLabel(v.cad_registration.status)} | Expiry: {v.cad_registration.expiry_at || '-'}
                            </div>
                          )}
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
                                          {field.label}: {String(field.display_value || formatMappedValue(field.value))}
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
          setRegistrationStatusDraft('valid');
        }}
        title={selectedVehicle ? `Vehicle ${selectedVehicle.plate || ''}` : ''}
        wide
      >
        {selectedVehicle && (
          <div className="space-y-4">
            <LookupFieldsSection
              title="Vehicle Information"
              fields={selectedVehicle.lookup_fields}
            />

            <div className="bg-cad-surface border border-cad-border rounded-lg px-3 py-3">
              <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">
                Registration (CAD)
              </h4>
              {selectedVehicle.cad_registration ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <p>Owner: <span className="text-cad-ink">{selectedVehicle.cad_registration.owner_name || '-'}</span></p>
                    <p>Expiry: <span className="text-cad-ink">{selectedVehicle.cad_registration.expiry_at || '-'}</span></p>
                    <p>Duration: <span className="text-cad-ink">{selectedVehicle.cad_registration.duration_days || '-'} day(s)</span></p>
                    <p>Status: <span className="text-cad-ink">{formatStatusLabel(selectedVehicle.cad_registration.status)}</span></p>
                  </div>
                  <div className="flex flex-col md:flex-row gap-2 md:items-center">
                    <select
                      value={registrationStatusDraft}
                      onChange={(e) => setRegistrationStatusDraft(e.target.value)}
                      className="bg-cad-card border border-cad-border rounded px-3 py-2 text-sm"
                    >
                      {REGISTRATION_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {formatStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={saveVehicleRegistrationStatus}
                      disabled={registrationStatusSaving}
                      className="px-3 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {registrationStatusSaving ? 'Saving...' : 'Update Registration Status'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-cad-muted">No CAD registration record found.</p>
              )}
            </div>

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
                              <span className="ml-2">{String(field.display_value || formatMappedValue(field.value))}</span>
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
