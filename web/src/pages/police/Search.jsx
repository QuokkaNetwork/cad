import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import SearchResults from '../../components/SearchResults';
import Modal from '../../components/Modal';
import PatientAnalysisPanel from '../../components/PatientAnalysisPanel';
import { DEPARTMENT_LAYOUT, getDepartmentLayoutType } from '../../utils/departmentLayout';
import { useDepartment } from '../../context/DepartmentContext';
import { useAuth } from '../../context/AuthContext';
import { formatDateAU, formatDateTimeAU } from '../../utils/dateTime';

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

function formatGenderLabel(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return '-';
  if (raw === '0' || raw === 'm' || raw === 'male' || raw === 'man') return 'Male';
  if (raw === '1' || raw === 'f' || raw === 'female' || raw === 'woman') return 'Female';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatDateForLicenseCard(value, fallback = '') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return text;
  const date = new Date(parsed);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${dd}-${mm}-${yyyy}`;
}

function listToLicenseCardText(value, fallback = 'None') {
  let source = [];
  if (Array.isArray(value)) {
    source = value;
  } else {
    const single = String(value || '').trim();
    if (single) source = [single];
  }
  const list = source
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
  if (list.length === 0) return fallback;
  return list.join(', ');
}

function sanitizeConditionsForLicenseCard(value) {
  const list = Array.isArray(value)
    ? value.map((entry) => String(entry || '').trim()).filter(Boolean)
    : (String(value || '').trim() ? [String(value || '').trim()] : []);
  const hadQuizPass = list.some((entry) => /quiz\s*pass/i.test(entry));
  const cleaned = list.filter((entry) => {
    if (/quiz\s*pass/i.test(entry)) return false;
    if (hadQuizPass && /^\d{1,3}%$/.test(entry)) return false;
    return true;
  });
  return cleaned;
}

function resolveLicenseAddress(person, license) {
  const direct = String(license?.address || person?.address || '').trim();
  if (direct) return direct;
  const line1 = String(person?.street || '').trim();
  const line2 = String(person?.suburb || '').trim();
  const state = String(person?.state || '').trim();
  const postcode = String(person?.postcode || person?.postal || '').trim();
  const secondLine = [line2, state, postcode].filter(Boolean).join(' ').trim();
  return [line1, secondLine].filter(Boolean).join('\n').trim();
}

const EMPTY_WARNING_FORM = {
  title: '',
  description: '',
};

function formatOfficerDisplay(item) {
  const callsign = String(item?.officer_callsign || '').trim();
  const name = String(item?.officer_name || '').trim();
  if (callsign && name) return `${callsign} - ${name}`;
  return callsign || name || 'Unknown Officer';
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
        className="w-36 h-36 object-cover object-top rounded border border-cad-border bg-transparent"
      />
    </div>
  );
}

function CadVictoriaLicenseCard({ person }) {
  const license = person?.cad_driver_license;
  if (!license) {
    return (
      <p className="text-sm text-cad-muted">No CAD driver licence record found.</p>
    );
  }

  const fullName = resolvePersonName(person);
  const licenceNumber = String(license.license_number || '').trim() || 'Auto';
  const dob = formatDateForLicenseCard(license.date_of_birth || person?.birthdate || '', 'Unknown');
  const expiry = formatDateForLicenseCard(license.expiry_at || '', 'None');
  const licenceType = listToLicenseCardText(license.license_classes, 'None');
  const conditions = listToLicenseCardText(sanitizeConditionsForLicenseCard(license.conditions), 'None');
  const mugshot = String(license.mugshot_url || '').trim();
  const address = resolveLicenseAddress(person, license) || 'Not recorded';

  return (
    <div className="cad-license-viewer">
      <section className="id-card" aria-label="Victorian Driver Licence">
        <img className="id-card-watermark" src="/vicroads-logo.png" alt="" aria-hidden="true" />

        <header className="id-card-header">
          <div className="id-card-banner">
            <div className="id-card-banner-line1">DRIVER LICENCE</div>
            <div className="id-card-banner-line2">VICTORIA AUSTRALIA</div>
          </div>
        </header>

        <h2 className="id-card-title">Victorian Driver Licence</h2>

        <div className="id-card-body">
          <div className="id-card-main">
            <div className="id-card-top">
              <div className="id-card-name-block">
                <span className="id-card-top-label">Name</span>
                <span className="id-card-name">{fullName || 'Unknown'}</span>
              </div>
              <div className="id-card-licence-block">
                <span className="id-card-top-label">Licence No.</span>
                <span className="id-card-licence-no">{licenceNumber}</span>
              </div>
            </div>

            <div className="id-card-address-block">
              <span className="id-label">Address</span>
              <span className="id-value id-card-address-value">{address}</span>
            </div>

            <div className="id-card-bottom-grid">
              <div className="id-card-field">
                <span className="id-label">Licence Expiry</span>
                <span className="id-value">{expiry}</span>
              </div>
              <div className="id-card-field">
                <span className="id-label">Date Of Birth</span>
                <span className="id-value">{dob}</span>
              </div>
              <div className="id-card-field">
                <span className="id-label">Licence Type</span>
                <span className="id-value">{licenceType}</span>
              </div>
              <div className="id-card-field">
                <span className="id-label">Conditions</span>
                <span className="id-value">{conditions}</span>
              </div>
            </div>
          </div>

          <div className="id-card-photo-panel">
            {mugshot ? (
              <img className="id-card-photo" alt="Licence photo" src={mugshot} />
            ) : (
              <div className="id-card-photo id-card-photo-placeholder" aria-hidden="true" />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function Search() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { activeDepartment } = useDepartment();
  const layoutType = getDepartmentLayoutType(activeDepartment);
  const isLaw = layoutType === DEPARTMENT_LAYOUT.LAW_ENFORCEMENT;
  const isParamedics = layoutType === DEPARTMENT_LAYOUT.PARAMEDICS;
  const isFire = layoutType === DEPARTMENT_LAYOUT.FIRE;

  const [searchType, setSearchType] = useState('person');
  const [personFirstName, setPersonFirstName] = useState('');
  const [personLastName, setPersonLastName] = useState('');
  const [vehicleQuery, setVehicleQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [selectedPerson, setSelectedPerson] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [vehicleOwner, setVehicleOwner] = useState(null);
  const [showPersonWarningsModal, setShowPersonWarningsModal] = useState(false);
  const [showVehicleWarningsModal, setShowVehicleWarningsModal] = useState(false);
  const [currentUnit, setCurrentUnit] = useState(null);

  const [personWarningForm, setPersonWarningForm] = useState(EMPTY_WARNING_FORM);
  const [vehicleWarningForm, setVehicleWarningForm] = useState(EMPTY_WARNING_FORM);
  const [personWarningSaving, setPersonWarningSaving] = useState(false);
  const [vehicleWarningSaving, setVehicleWarningSaving] = useState(false);
  const [warningStatusUpdatingId, setWarningStatusUpdatingId] = useState(null);
  const [warningPrintJobId, setWarningPrintJobId] = useState(null);

  const [licenseStatusDraft, setLicenseStatusDraft] = useState('valid');
  const [registrationStatusDraft, setRegistrationStatusDraft] = useState('valid');
  const [licenseStatusSaving, setLicenseStatusSaving] = useState(false);
  const [registrationStatusSaving, setRegistrationStatusSaving] = useState(false);
  const [registrationDeleteSaving, setRegistrationDeleteSaving] = useState(false);

  const personQuery = [
    String(personFirstName || '').trim(),
    String(personLastName || '').trim(),
  ].filter(Boolean).join(' ').trim();
  const activeQuery = searchType === 'person' ? personQuery : String(vehicleQuery || '').trim();
  const canSearch = activeQuery.length >= 2;
  const pageTitle = isLaw ? 'Licence & Registration Search' : isParamedics ? 'Patient Analysis' : 'Incident Lookup';
  const personTabLabel = isParamedics ? 'Patient Lookup' : isFire ? 'Individual Lookup' : 'Individual Lookup';
  const vehicleTabLabel = isFire ? 'Vehicle Lookup' : 'Vehicle Lookup';
  const personFirstLabel = isFire ? 'Occupant / Contact First Name' : 'First Name';
  const personLastLabel = isFire ? 'Occupant / Contact Last Name' : 'Last Name';
  const personFirstPlaceholder = isParamedics ? 'Patient first name' : isFire ? 'Occupant/contact first name' : 'Person first name';
  const personLastPlaceholder = isParamedics ? 'Patient last name' : isFire ? 'Occupant/contact last name' : 'Person last name';
  const vehicleSearchLabel = isFire ? 'Plate, Owner, Or Vehicle Model' : 'Plate, Owner, Or Model';
  const vehicleSearchPlaceholder = isFire
    ? 'Search incident vehicle by plate, owner, or model...'
    : 'Search by plate, owner name, or model...';
  const recordsButtonLabel = isFire ? 'Open Incident Reports' : 'Add / Manage Records';
  const filingOfficerLabel = `${String(currentUnit?.callsign || '').trim() ? `${String(currentUnit.callsign).trim()} - ` : ''}${String(user?.steam_name || user?.email || 'Unknown Officer').trim() || 'Unknown Officer'}`;

  useEffect(() => {
    if (!isLaw) return;
    let cancelled = false;
    api.get('/api/units/me')
      .then((unit) => {
        if (!cancelled) setCurrentUnit(unit && typeof unit === 'object' ? unit : null);
      })
      .catch(() => {
        if (!cancelled) setCurrentUnit(null);
      });
    return () => { cancelled = true; };
  }, [isLaw]);

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
      const query = searchType === 'person'
        ? [
            `first_name=${encodeURIComponent(String(personFirstName || '').trim())}`,
            `last_name=${encodeURIComponent(String(personLastName || '').trim())}`,
            `q=${encodeURIComponent(activeQuery)}`,
          ].join('&')
        : `q=${encodeURIComponent(activeQuery)}`;
      const data = await api.get(`${endpoint}?${query}`);
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
    setPersonWarningForm(EMPTY_WARNING_FORM);

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
    setVehicleWarningForm(EMPTY_WARNING_FORM);

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

  async function deleteVehicleRegistration() {
    const plate = String(selectedVehicle?.plate || '').trim();
    if (!plate || !selectedVehicle?.cad_registration) return;
    if (!window.confirm(`Delete CAD registration for ${plate}? This cannot be undone.`)) return;

    setRegistrationDeleteSaving(true);
    try {
      await api.delete(`/api/search/vehicles/${encodeURIComponent(plate)}/registration`);

      setSelectedVehicle((current) => {
        if (!current || String(current.plate || '').trim() !== plate) return current;
        return { ...current, cad_registration: null };
      });

      setResults((current) => (
        Array.isArray(current)
          ? current.map((item) => {
            if (String(item?.plate || '').trim().toUpperCase() !== plate.toUpperCase()) return item;
            const next = { ...item };
            delete next.cad_registration;
            next.status = 'unregistered';
            return next;
          })
          : current
      ));
    } catch (err) {
      alert('Failed to delete registration:\n' + formatErr(err));
    } finally {
      setRegistrationDeleteSaving(false);
    }
  }

  function upsertWarningList(current, updatedWarning) {
    const list = Array.isArray(current) ? [...current] : [];
    const idx = list.findIndex((item) => Number(item?.id || 0) === Number(updatedWarning?.id || 0));
    if (idx >= 0) {
      list[idx] = updatedWarning;
    } else {
      list.unshift(updatedWarning);
    }
    return list;
  }

  async function createPersonWarning() {
    const citizenId = String(selectedPerson?.citizenid || '').trim();
    if (!citizenId) return;
    const title = String(personWarningForm.title || '').trim();
    if (!title) {
      alert('Warning title is required');
      return;
    }
    setPersonWarningSaving(true);
    try {
      const created = await api.post(`/api/search/cad/persons/${encodeURIComponent(citizenId)}/warnings`, {
        title,
        description: personWarningForm.description,
        subject_display: resolvePersonName(selectedPerson),
      });
      setSelectedPerson((current) => {
        if (!current) return current;
        const activeWarnings = upsertWarningList(current.active_warnings, created).filter((item) => String(item?.status || 'active') === 'active');
        return {
          ...current,
          active_warnings: activeWarnings,
          warning_count: activeWarnings.length,
        };
      });
      setPersonWarningForm(EMPTY_WARNING_FORM);
    } catch (err) {
      alert('Failed to issue warning:\n' + formatErr(err));
    } finally {
      setPersonWarningSaving(false);
    }
  }

  async function createVehicleWarning() {
    const plate = String(selectedVehicle?.plate || '').trim();
    if (!plate) return;
    const title = String(vehicleWarningForm.title || '').trim();
    if (!title) {
      alert('Warning title is required');
      return;
    }
    setVehicleWarningSaving(true);
    try {
      const created = await api.post(`/api/search/cad/vehicles/${encodeURIComponent(plate)}/warnings`, {
        title,
        description: vehicleWarningForm.description,
        subject_display: plate,
      });
      setSelectedVehicle((current) => {
        if (!current) return current;
        const activeWarnings = upsertWarningList(current.active_warnings, created).filter((item) => String(item?.status || 'active') === 'active');
        return {
          ...current,
          active_warnings: activeWarnings,
          warning_count: activeWarnings.length,
        };
      });
      setVehicleWarningForm(EMPTY_WARNING_FORM);
    } catch (err) {
      alert('Failed to issue warning:\n' + formatErr(err));
    } finally {
      setVehicleWarningSaving(false);
    }
  }

  async function updateWarningStatus(warningId, status, subjectType) {
    setWarningStatusUpdatingId(Number(warningId || 0));
    try {
      const updated = await api.patch(`/api/search/warnings/${warningId}`, { status });
      if (subjectType === 'person') {
        setSelectedPerson((current) => {
          if (!current) return current;
          const activeWarnings = upsertWarningList(current.active_warnings, updated)
            .filter((item) => String(item?.status || 'active') === 'active');
          return { ...current, active_warnings: activeWarnings, warning_count: activeWarnings.length };
        });
      } else if (subjectType === 'vehicle') {
        setSelectedVehicle((current) => {
          if (!current) return current;
          const activeWarnings = upsertWarningList(current.active_warnings, updated)
            .filter((item) => String(item?.status || 'active') === 'active');
          return { ...current, active_warnings: activeWarnings, warning_count: activeWarnings.length };
        });
      }
    } catch (err) {
      alert('Failed to update warning:\n' + formatErr(err));
    } finally {
      setWarningStatusUpdatingId(null);
    }
  }

  async function printWarningInGame(warning, subjectType) {
    const warningId = Number(warning?.id || 0);
    if (!warningId) return;
    setWarningPrintJobId(warningId);
    try {
      const payload = {};
      if (subjectType === 'person' && selectedPerson?.citizenid) {
        payload.citizen_id = String(selectedPerson.citizenid).trim();
      }
      await api.post(`/api/search/warnings/${warningId}/print`, payload);
      alert('Warning sent to in-game printer queue.');
    } catch (err) {
      alert('Failed to send warning print job:\n' + formatErr(err));
    } finally {
      setWarningPrintJobId(null);
    }
  }

  const personRegistrations = Array.isArray(selectedPerson?.cad_vehicle_registrations)
    ? selectedPerson.cad_vehicle_registrations
    : [];
  const selectedPersonWarnings = Array.isArray(selectedPerson?.active_warnings) ? selectedPerson.active_warnings : [];
  const selectedVehicleWarnings = Array.isArray(selectedVehicle?.active_warnings) ? selectedVehicle.active_warnings : [];
  const selectedPersonRecordCount = Math.max(0, Number(selectedPerson?.criminal_record_count || 0));
  const selectedPersonMedicalCount = Math.max(0, Number(selectedPerson?.medical_analysis_count || 0));

  function openRecordsPageForSelectedPerson() {
    const citizenId = String(selectedPerson?.citizenid || '').trim();
    if (!citizenId) return;
    setSelectedPerson(null);
    setShowPersonWarningsModal(false);
    navigate(`/records?citizen_id=${encodeURIComponent(citizenId)}`);
  }

  function openArrestReportsPageForSelectedPerson() {
    const citizenId = String(selectedPerson?.citizenid || '').trim();
    if (!citizenId) return;
    setSelectedPerson(null);
    setShowPersonWarningsModal(false);
    navigate(`/arrest-reports?citizen_id=${encodeURIComponent(citizenId)}`);
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">
        {pageTitle}
      </h2>

      {isFire && (
        <div className="bg-cad-card border border-cad-border rounded-xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider">Fire Lookup Guidance</h3>
          <p className="text-sm text-cad-muted mt-2">
            Use this tab to identify occupants/contacts and incident vehicles. Open Incident Reports from a selected person to document the fire response report.
          </p>
        </div>
      )}

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
              {personTabLabel}
            </button>
            {!isParamedics && (
              <button
                type="button"
                onClick={() => setSearchType('vehicle')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  searchType === 'vehicle' ? 'bg-cad-accent text-white' : 'text-cad-muted hover:text-cad-ink'
                }`}
              >
                {vehicleTabLabel}
              </button>
            )}
          </div>

          {searchType === 'person' ? (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <div>
                <label className="block text-xs text-cad-muted mb-1">{personFirstLabel}</label>
                <input
                  type="text"
                  value={personFirstName}
                  onChange={(e) => setPersonFirstName(e.target.value)}
                  placeholder={personFirstPlaceholder}
                  className="w-full bg-cad-surface border border-cad-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-cad-muted mb-1">{personLastLabel}</label>
                <input
                  type="text"
                  value={personLastName}
                  onChange={(e) => setPersonLastName(e.target.value)}
                  placeholder={personLastPlaceholder}
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
                <label className="block text-xs text-cad-muted mb-1">{vehicleSearchLabel}</label>
                <input
                  type="text"
                  value={vehicleQuery}
                  onChange={(e) => setVehicleQuery(e.target.value)}
                  placeholder={vehicleSearchPlaceholder}
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
          setShowPersonWarningsModal(false);
          setLicenseStatusDraft('valid');
          setPersonWarningForm(EMPTY_WARNING_FORM);
        }}
        title={selectedPerson ? resolvePersonName(selectedPerson) : ''}
        wide
      >
        {selectedPerson && (
          isParamedics ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {selectedPersonMedicalCount > 0 ? (
                  <div className="px-3 py-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-sm text-cyan-200">
                    Medical History: {selectedPersonMedicalCount} analys{selectedPersonMedicalCount === 1 ? 'is' : 'es'}
                    {selectedPerson?.medical_last_analysis_at ? ` | Last: ${formatDateTimeAU(`${selectedPerson.medical_last_analysis_at}Z`, '-', false)}` : ''}
                  </div>
                ) : (
                  <div className="px-3 py-2 rounded-lg border border-cad-border bg-cad-surface text-sm text-cad-muted">
                    No recorded patient analyses yet.
                  </div>
                )}
              </div>
              <PatientAnalysisPanel
                person={selectedPerson}
                activeDepartmentId={activeDepartment?.id || null}
              />
            </div>
          ) : (
            <div className="space-y-4">
            {isFire && (
              <div className="bg-cad-surface border border-cad-border rounded-lg px-3 py-3">
                <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-1">
                  Incident Context
                </h4>
                <p className="text-sm text-cad-muted">
                  Use this person as an occupant, owner, or reporting contact, then open Incident Reports to document the fire response report.
                </p>
              </div>
            )}

            {isLaw && (selectedPerson.has_warrant || selectedPerson.has_bolo || selectedPerson.repeat_offender) ? (
              <div className="flex flex-wrap gap-2">
                {selectedPerson.has_warrant ? (
                  <div className="px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-sm text-red-200">
                    Active Warrant{Number(selectedPerson.warrant_count || 0) > 1 ? `s (${Number(selectedPerson.warrant_count)})` : ''}
                  </div>
                ) : null}
                {selectedPerson.has_bolo ? (
                  <div className="px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-sm text-amber-200">
                    Active POI{Number(selectedPerson.bolo_count || 0) > 1 ? `s (${Number(selectedPerson.bolo_count)})` : ''}
                  </div>
                ) : null}
                {selectedPerson.repeat_offender ? (
                  <div className="px-3 py-2 rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 text-sm text-fuchsia-200">
                    Repeat Offender Flag ({selectedPersonRecordCount} records)
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="bg-cad-surface border border-cad-border rounded-lg px-3 py-3">
              <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">
                {isFire ? 'Licence / Identity (CAD)' : 'Driver Licence (CAD)'}
              </h4>
              {selectedPerson.cad_driver_license ? (
                <div className="space-y-3">
                  <CadVictoriaLicenseCard person={selectedPerson} />
                  {isLaw ? (
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
                  ) : (
                    <p className="text-xs text-cad-muted">
                      Fire users can view licence/identity details here for incident context. Status changes are managed by police/admin workflows.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-cad-muted">No CAD driver licence record found.</p>
              )}
            </div>

            {!isParamedics && (
              <div className="bg-cad-surface border border-cad-border rounded-lg px-3 py-3">
                <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">
                  {isFire ? 'Known Vehicles / Registrations' : 'Registrations'} ({personRegistrations.length})
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
                          Status: {formatStatusLabel(reg.status)} | Expiry: {formatDateAU(reg.expiry_at || '', '-')}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-cad-muted">
                    No CAD registrations found for this {isFire ? 'person/contact' : 'person'}.
                  </p>
                )}
              </div>
            )}

            <div className="pt-1">
              {isLaw && (
                <div className="mb-2 bg-cad-surface border border-cad-border rounded-lg px-3 py-2">
                  <p className="text-xs text-cad-muted uppercase tracking-wider">Charge Filing</p>
                  <p className="text-sm text-cad-ink mt-1">{filingOfficerLabel}</p>
                  <p className="text-xs text-cad-muted mt-1">
                    Use Arrest Reports to draft charges without applying fines/jail until finalization.
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-2 flex-wrap">
                {isLaw && (
                  <button
                    type="button"
                    onClick={() => setShowPersonWarningsModal(true)}
                    className="px-4 py-2 bg-amber-600/90 hover:bg-amber-500 text-white rounded text-sm font-medium transition-colors"
                  >
                    Warnings{selectedPersonWarnings.length > 0 ? ` (${selectedPersonWarnings.length})` : ''}
                  </button>
                )}
                {isLaw && (
                  <button
                    type="button"
                    onClick={openArrestReportsPageForSelectedPerson}
                    className="px-4 py-2 bg-blue-600/90 hover:bg-blue-500 text-white rounded text-sm font-medium transition-colors"
                  >
                    Arrest Report
                  </button>
                )}
                <button
                  type="button"
                  onClick={openRecordsPageForSelectedPerson}
                  className="px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors"
                >
                  {recordsButtonLabel}
                </button>
              </div>
            </div>
            </div>
          )
        )}
      </Modal>

      <Modal
        open={!!selectedVehicle}
        onClose={() => {
          setSelectedVehicle(null);
          setVehicleOwner(null);
          setShowVehicleWarningsModal(false);
          setRegistrationStatusDraft('valid');
          setVehicleWarningForm(EMPTY_WARNING_FORM);
        }}
        title={selectedVehicle ? `Vehicle ${selectedVehicle.plate || ''}` : ''}
        wide
      >
        {selectedVehicle && (
          <div className="space-y-4">
            <div className="bg-cad-surface border border-cad-border rounded-lg px-3 py-3">
              <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">
                {isFire ? 'Vehicle / Asset Registration (CAD)' : 'Registration (CAD)'}
              </h4>
              {selectedVehicle.cad_registration ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <p>Plate: <span className="text-cad-ink">{selectedVehicle.cad_registration.plate || '-'}</span></p>
                    <p>Owner: <span className="text-cad-ink">{selectedVehicle.cad_registration.owner_name || '-'}</span></p>
                    <p>Model: <span className="text-cad-ink">{selectedVehicle.cad_registration.vehicle_model || '-'}</span></p>
                    <p>Colour: <span className="text-cad-ink">{selectedVehicle.cad_registration.vehicle_colour || '-'}</span></p>
                    <p>Expiry: <span className="text-cad-ink">{formatDateAU(selectedVehicle.cad_registration.expiry_at || '', '-')}</span></p>
                    <p>Status: <span className="text-cad-ink">{formatStatusLabel(selectedVehicle.cad_registration.status)}</span></p>
                  </div>
                  {isLaw ? (
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
                        disabled={registrationStatusSaving || registrationDeleteSaving}
                        className="px-3 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {registrationStatusSaving ? 'Saving...' : 'Update Registration Status'}
                      </button>
                      <button
                        type="button"
                        onClick={deleteVehicleRegistration}
                        disabled={registrationStatusSaving || registrationDeleteSaving}
                        className="px-3 py-2 bg-red-700/90 hover:bg-red-600 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {registrationDeleteSaving ? 'Deleting...' : 'Delete Registration'}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-cad-muted">
                      Registration data is shown as reference for fire incident context.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-cad-muted">No CAD registration record found.</p>
              )}
            </div>

            {vehicleOwner && (
              <div className="bg-cad-surface rounded px-3 py-3">
                <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">
                  {isFire ? 'Registered Owner / Linked Person' : 'Registered Owner'}
                </h4>
                <p className="text-sm">{resolvePersonName(vehicleOwner)}</p>
                <p className="text-xs text-cad-muted">Citizen ID: {vehicleOwner.citizenid || '-'}</p>
                <div className="mt-2">
                  <MugshotPreview url={vehicleOwner?.cad_driver_license?.mugshot_url} />
                </div>
              </div>
            )}

            {isLaw && (
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowVehicleWarningsModal(true)}
                  className="px-4 py-2 bg-amber-600/90 hover:bg-amber-500 text-white rounded text-sm font-medium transition-colors"
                >
                  Warnings{selectedVehicleWarnings.length > 0 ? ` (${selectedVehicleWarnings.length})` : ''}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={isLaw && showPersonWarningsModal && !!selectedPerson}
        onClose={() => setShowPersonWarningsModal(false)}
        title={selectedPerson ? `Warnings - ${resolvePersonName(selectedPerson)}` : 'Warnings'}
        wide
      >
        {isLaw && selectedPerson && (
          <div className="space-y-3">
            <div className="bg-cad-surface border border-cad-border rounded-lg px-3 py-2">
              <p className="text-xs text-cad-muted uppercase tracking-wider">Filing Officer</p>
              <p className="text-sm text-cad-ink font-medium mt-1">{filingOfficerLabel}</p>
            </div>
            <div>
              <label className="block text-sm text-cad-muted mb-1">Warning Title</label>
              <input
                type="text"
                value={personWarningForm.title}
                onChange={(e) => setPersonWarningForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Verbal warning - dangerous driving"
                className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
              />
            </div>
            <div>
              <label className="block text-sm text-cad-muted mb-1">Warning Notes</label>
              <textarea
                value={personWarningForm.description}
                onChange={(e) => setPersonWarningForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                placeholder="Context / notes"
                className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent resize-none"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={createPersonWarning}
                disabled={personWarningSaving}
                className="px-4 py-2 bg-amber-600/90 hover:bg-amber-500 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
              >
                {personWarningSaving ? 'Issuing...' : 'Issue Warning'}
              </button>
            </div>
            <div className="bg-cad-surface border border-cad-border rounded-lg px-3 py-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider">
                  Active Warnings ({selectedPersonWarnings.length})
                </h4>
              </div>
              {selectedPersonWarnings.length > 0 ? (
                <div className="space-y-2">
                  {selectedPersonWarnings.slice(0, 12).map((warning) => (
                    <div key={`person-warning-${warning.id}`} className="bg-cad-card border border-cad-border rounded px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm text-cad-ink">{warning.title || 'Warning'}</p>
                          {warning.description ? (
                            <p className="text-xs text-cad-muted mt-1 whitespace-pre-wrap">{warning.description}</p>
                          ) : null}
                          <p className="text-[11px] text-cad-muted mt-1">
                            {formatOfficerDisplay(warning)} | {formatDateTimeAU(`${warning.created_at}Z`, '-', false)}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => printWarningInGame(warning, 'person')}
                            disabled={warningPrintJobId === warning.id}
                            className="px-2 py-1 text-[11px] border border-indigo-500/30 text-indigo-300 bg-indigo-500/10 rounded hover:bg-indigo-500/20 disabled:opacity-50"
                          >
                            {warningPrintJobId === warning.id ? 'Printing...' : 'Print'}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateWarningStatus(warning.id, 'resolved', 'person')}
                            disabled={warningStatusUpdatingId === warning.id}
                            className="px-2 py-1 text-[11px] border border-emerald-500/30 text-emerald-300 bg-emerald-500/10 rounded hover:bg-emerald-500/20 disabled:opacity-50"
                          >
                            Resolve
                          </button>
                          <button
                            type="button"
                            onClick={() => updateWarningStatus(warning.id, 'cancelled', 'person')}
                            disabled={warningStatusUpdatingId === warning.id}
                            className="px-2 py-1 text-[11px] border border-gray-500/30 text-gray-300 bg-gray-500/10 rounded hover:bg-gray-500/20 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-cad-muted">No active warnings for this person.</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={isLaw && showVehicleWarningsModal && !!selectedVehicle}
        onClose={() => setShowVehicleWarningsModal(false)}
        title={selectedVehicle ? `Warnings - ${selectedVehicle.plate || ''}` : 'Warnings'}
        wide
      >
        {isLaw && selectedVehicle && (
          <div className="space-y-3">
            <div className="bg-cad-surface border border-cad-border rounded-lg px-3 py-2">
              <p className="text-xs text-cad-muted uppercase tracking-wider">Filing Officer</p>
              <p className="text-sm text-cad-ink font-medium mt-1">{filingOfficerLabel}</p>
            </div>
            <div>
              <label className="block text-sm text-cad-muted mb-1">Warning Title</label>
              <input
                type="text"
                value={vehicleWarningForm.title}
                onChange={(e) => setVehicleWarningForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Vehicle warning - repeated burnouts"
                className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
              />
            </div>
            <div>
              <label className="block text-sm text-cad-muted mb-1">Warning Notes</label>
              <textarea
                value={vehicleWarningForm.description}
                onChange={(e) => setVehicleWarningForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                placeholder="Context / notes"
                className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent resize-none"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={createVehicleWarning}
                disabled={vehicleWarningSaving}
                className="px-4 py-2 bg-amber-600/90 hover:bg-amber-500 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
              >
                {vehicleWarningSaving ? 'Issuing...' : 'Issue Warning'}
              </button>
            </div>
            <div className="bg-cad-surface border border-cad-border rounded-lg px-3 py-3">
              <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">
                Active Warnings ({selectedVehicleWarnings.length})
              </h4>
              {selectedVehicleWarnings.length > 0 ? (
                <div className="space-y-2">
                  {selectedVehicleWarnings.slice(0, 12).map((warning) => (
                    <div key={`vehicle-warning-${warning.id}`} className="bg-cad-card border border-cad-border rounded px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm text-cad-ink">{warning.title || 'Warning'}</p>
                          {warning.description ? (
                            <p className="text-xs text-cad-muted mt-1 whitespace-pre-wrap">{warning.description}</p>
                          ) : null}
                          <p className="text-[11px] text-cad-muted mt-1">
                            {formatOfficerDisplay(warning)} | {formatDateTimeAU(`${warning.created_at}Z`, '-', false)}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => printWarningInGame(warning, 'vehicle')}
                            disabled={warningPrintJobId === warning.id}
                            className="px-2 py-1 text-[11px] border border-indigo-500/30 text-indigo-300 bg-indigo-500/10 rounded hover:bg-indigo-500/20 disabled:opacity-50"
                          >
                            {warningPrintJobId === warning.id ? 'Printing...' : 'Print'}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateWarningStatus(warning.id, 'resolved', 'vehicle')}
                            disabled={warningStatusUpdatingId === warning.id}
                            className="px-2 py-1 text-[11px] border border-emerald-500/30 text-emerald-300 bg-emerald-500/10 rounded hover:bg-emerald-500/20 disabled:opacity-50"
                          >
                            Resolve
                          </button>
                          <button
                            type="button"
                            onClick={() => updateWarningStatus(warning.id, 'cancelled', 'vehicle')}
                            disabled={warningStatusUpdatingId === warning.id}
                            className="px-2 py-1 text-[11px] border border-gray-500/30 text-gray-300 bg-gray-500/10 rounded hover:bg-gray-500/20 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-cad-muted">No active warnings for this vehicle.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
