import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import SearchResults from '../../components/SearchResults';
import Modal from '../../components/Modal';
import { DEPARTMENT_LAYOUT, getDepartmentLayoutType } from '../../utils/departmentLayout';
import { useDepartment } from '../../context/DepartmentContext';

const LICENSE_STATUS_OPTIONS = ['valid', 'suspended', 'disqualified', 'expired'];
const REGISTRATION_STATUS_OPTIONS = ['valid', 'suspended', 'revoked', 'expired'];

function formatErr(err) {
  if (!err) return 'Unknown error';
  const base = err.message || 'Request failed';
  if (Array.isArray(err.details?.errors) && err.details.errors.length > 0) {
    return `${base}\n- ${err.details.errors.join('\n- ')}`;
  }
  return base;
}

function formatStatusLabel(value) {
  return String(value || '')
    .trim()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function resolvePersonName(person) {
  const fullName = String(person?.full_name || '').trim();
  if (fullName) return fullName;
  const fallback = `${String(person?.firstname || '').trim()} ${String(person?.lastname || '').trim()}`.trim();
  if (fallback) return fallback;
  return String(person?.citizenid || 'Unknown Person');
}

function MugshotPreview({ url }) {
  const value = String(url || '').trim();
  if (!value) return null;
  return (
    <div className="bg-cad-card border border-cad-border rounded-lg p-2">
      <p className="text-[10px] uppercase tracking-wider text-cad-muted mb-1">Mugshot</p>
      <img
        src={value}
        alt="Character mugshot"
        className="w-32 h-40 object-cover rounded border border-cad-border"
      />
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
      const endpoint = searchType === 'person' ? '/api/search/cad/persons' : '/api/search/cad/vehicles';
      const data = await api.get(`${endpoint}?q=${encodeURIComponent(activeQuery)}`);
      setResults(Array.isArray(data) ? data : []);
    } catch (err) {
      alert('Search failed:\n' + formatErr(err));
    } finally {
      setSearching(false);
    }
  }

  async function selectPerson(person) {
    setSelectedVehicle(null);
    setVehicleOwner(null);

    const citizenId = String(person?.citizenid || '').trim();
    if (!citizenId) return;

    try {
      const details = await api.get(`/api/search/cad/persons/${encodeURIComponent(citizenId)}`);
      const resolved = details && typeof details === 'object' ? details : person;
      setSelectedPerson(resolved);
      setLicenseStatusDraft(String(resolved?.cad_driver_license?.status || 'valid'));
    } catch (err) {
      alert('Failed to load person details:\n' + formatErr(err));
    }
  }

  async function selectVehicle(vehicle) {
    setSelectedPerson(null);
    setVehicleOwner(null);

    const plate = String(vehicle?.plate || '').trim();
    if (!plate) return;

    try {
      const details = await api.get(`/api/search/cad/vehicles/${encodeURIComponent(plate)}`);
      const resolved = details && typeof details === 'object' ? details : vehicle;
      setSelectedVehicle(resolved);
      setRegistrationStatusDraft(String(resolved?.cad_registration?.status || 'valid'));

      const ownerCitizenId = String(resolved?.owner || '').trim();
      if (ownerCitizenId) {
        try {
          const owner = await api.get(`/api/search/cad/persons/${encodeURIComponent(ownerCitizenId)}`);
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
    const citizenId = String(selectedPerson?.citizenid || '').trim();
    if (!citizenId || !selectedPerson?.cad_driver_license) return;

    setLicenseStatusSaving(true);
    try {
      const updated = await api.patch(
        `/api/search/persons/${encodeURIComponent(citizenId)}/license`,
        { status: licenseStatusDraft }
      );
      setSelectedPerson((current) => {
        if (!current || String(current.citizenid || '').trim() !== citizenId) return current;
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

  const personRegistrations = Array.isArray(selectedPerson?.cad_vehicle_registrations)
    ? selectedPerson.cad_vehicle_registrations
    : [];

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">
        {isLaw ? 'Licence & Registration Search' : isParamedics ? 'Patient Lookup' : 'Incident Lookup'}
      </h2>

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
                <label className="block text-xs text-cad-muted mb-1">Plate, Owner, Or Model</label>
                <input
                  type="text"
                  value={vehicleQuery}
                  onChange={(e) => setVehicleQuery(e.target.value)}
                  placeholder="Search by plate, owner name, or model..."
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

      <Modal
        open={!!selectedPerson}
        onClose={() => {
          setSelectedPerson(null);
          setLicenseStatusDraft('valid');
        }}
        title={selectedPerson ? resolvePersonName(selectedPerson) : ''}
        wide
      >
        {selectedPerson && (
          <div className="space-y-4">
            <div className="bg-cad-surface border border-cad-border rounded-lg px-3 py-3 text-sm">
              <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">
                Person
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <p>Citizen ID: <span className="text-cad-ink">{selectedPerson.citizenid || '-'}</span></p>
                <p>Name: <span className="text-cad-ink">{resolvePersonName(selectedPerson)}</span></p>
                <p>DOB: <span className="text-cad-ink">{selectedPerson.cad_driver_license?.date_of_birth || '-'}</span></p>
                <p>Gender: <span className="text-cad-ink">{selectedPerson.cad_driver_license?.gender || '-'}</span></p>
              </div>
            </div>

            <div className="bg-cad-surface border border-cad-border rounded-lg px-3 py-3">
              <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">
                Driver Licence (CAD)
              </h4>
              {selectedPerson.cad_driver_license ? (
                <div className="space-y-3">
                  <div className="flex flex-col md:flex-row gap-4">
                    <MugshotPreview url={selectedPerson.cad_driver_license.mugshot_url} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm flex-1">
                      <p>Licence No: <span className="text-cad-ink">{selectedPerson.cad_driver_license.license_number || '-'}</span></p>
                      <p>Expiry: <span className="text-cad-ink">{selectedPerson.cad_driver_license.expiry_at || '-'}</span></p>
                      <p>Status: <span className="text-cad-ink">{formatStatusLabel(selectedPerson.cad_driver_license.status)}</span></p>
                      <p>Classes: <span className="text-cad-ink">{Array.isArray(selectedPerson.cad_driver_license.license_classes) && selectedPerson.cad_driver_license.license_classes.length > 0 ? selectedPerson.cad_driver_license.license_classes.join(', ') : '-'}</span></p>
                    </div>
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
              <div className="bg-cad-surface border border-cad-border rounded-lg px-3 py-3">
                <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">
                  Registrations ({personRegistrations.length})
                </h4>
                {personRegistrations.length > 0 ? (
                  <div className="space-y-2">
                    {personRegistrations.map((reg) => (
                      <button
                        key={`${reg.plate_normalized || reg.plate}`}
                        type="button"
                        onClick={() => selectVehicle({ plate: reg.plate })}
                        className="w-full text-left bg-cad-card rounded px-3 py-2 text-sm hover:bg-cad-surface border border-cad-border/40"
                      >
                        <div className="flex flex-wrap items-center gap-4">
                          <span className="font-mono font-bold text-cad-accent-light">{reg.plate}</span>
                          <span>{reg.vehicle_model || '-'}</span>
                          <span className="text-cad-muted">{reg.vehicle_colour || '-'}</span>
                        </div>
                        <div className="mt-1 text-xs text-cad-muted">
                          Status: {formatStatusLabel(reg.status)} | Expiry: {reg.expiry_at || '-'}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-cad-muted">No CAD registrations found for this person.</p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

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
            <div className="bg-cad-surface border border-cad-border rounded-lg px-3 py-3">
              <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">
                Registration (CAD)
              </h4>
              {selectedVehicle.cad_registration ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <p>Plate: <span className="text-cad-ink">{selectedVehicle.cad_registration.plate || '-'}</span></p>
                    <p>Owner: <span className="text-cad-ink">{selectedVehicle.cad_registration.owner_name || '-'}</span></p>
                    <p>Model: <span className="text-cad-ink">{selectedVehicle.cad_registration.vehicle_model || '-'}</span></p>
                    <p>Colour: <span className="text-cad-ink">{selectedVehicle.cad_registration.vehicle_colour || '-'}</span></p>
                    <p>Expiry: <span className="text-cad-ink">{selectedVehicle.cad_registration.expiry_at || '-'}</span></p>
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
              <div className="bg-cad-surface rounded px-3 py-3">
                <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">Registered Owner</h4>
                <p className="text-sm">{resolvePersonName(vehicleOwner)}</p>
                <p className="text-xs text-cad-muted">Citizen ID: {vehicleOwner.citizenid || '-'}</p>
                <div className="mt-2">
                  <MugshotPreview url={vehicleOwner?.cad_driver_license?.mugshot_url} />
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
