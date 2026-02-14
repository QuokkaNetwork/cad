import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  assignUnit,
  cancelBolo,
  clearToken,
  createBolo,
  createCall,
  createEmergencyCall,
  getBolos,
  getCalls,
  getMe,
  getMyUnit,
  getToken,
  getUnitPositions,
  getUnits,
  login,
  radioJoin,
  radioLeave,
  searchCharacters,
  searchVehicles,
  setOffDuty,
  setOnDuty,
  setToken,
  unassignUnit,
  updateCall,
  updateMyUnit,
  getEmergencyCalls,
  acceptEmergencyCall,
  completeEmergencyCall,
  getRadioActivity,
  getChannelPlayers,
  getMumbleConfig,
  getMyDepartments,
  getAdminUsers,
  createAdminUser,
  deleteAdminUser,
  updateAdminUserRole,
  resetAdminUserPassword,
  setAdminUserDepartments,
  getJobSyncMappings,
  createJobSyncMapping,
  deleteJobSyncMapping,
  getAnnouncements,
  getAdminAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  getAuditLog,
  getCustomJobCodes,
  createCustomJobCode,
  updateCustomJobCode,
  deleteCustomJobCode,
  getCustomStatusCodes,
  createCustomStatusCode,
  updateCustomStatusCode,
  deleteCustomStatusCode,
  adminSetUnitStatus,
  adminKickUnit,
  getCmsSettings,
  updateCmsSettings,
  getExternalDbConfig,
  updateExternalDbConfig,
  testExternalDbConfig,
  getCmsServices,
  createCmsService,
  updateCmsService,
  deleteCmsService,
  addCmsDepartment,
  updateCmsDepartment,
  deleteCmsDepartment,
} from './api.js';
import mapConfig from './mapConfig.js';

// ===== DEFAULT STATUS & PRIORITY LABELS (fallbacks when no custom codes) =====
const DEFAULT_STATUS_LABELS = {
  '1': 'Status 1 - On Patrol',
  '2': 'Status 2 - At Station',
  '3': 'Status 3 - Meal Break',
  '4': 'Status 4 - Traffic Stop',
  '5': 'Status 5 - At Job',
  '7': 'Status 7 - En-Route',
  '9': 'Status 9 - Urgent Assistance',
  '10': 'Status 10 - Domestic Violence',
  '11': 'Status 11 - Unavailable',
};

const PRIORITY_LABELS = {
  '1': 'P1 - Imminent Threat to Life',
  '2': 'P2 - Urgent Emergency',
  '3': 'P3 - Attend ASAP',
  '3a': 'P3A - Routine',
  '4': 'P4 - Less Urgent',
};

const DEFAULT_JOB_CODES = [
  { value: '', label: 'Select job code...' },
  { value: '101', label: '101 - Homicide' },
  { value: '103', label: '103 - Assault (Serious)' },
  { value: '104', label: '104 - Assault (Common)' },
  { value: '105', label: '105 - Domestic Violence' },
  { value: '121', label: '121 - Armed Holdup (In Progress)' },
  { value: '122', label: '122 - Armed Holdup (Occurred)' },
  { value: '123', label: '123 - Unarmed Robbery' },
  { value: '124', label: '124 - Shoplifting' },
  { value: '126', label: '126 - Stealing' },
  { value: '127', label: '127 - Car Theft' },
  { value: '131', label: '131 - Burglary (In Progress)' },
  { value: '132', label: '132 - Burglary (Occurred)' },
  { value: '133', label: '133 - Wilful Damage' },
  { value: '134', label: '134 - Arson' },
  { value: '136', label: '136 - Trespassing' },
  { value: '201', label: '201 - Fatal MVA' },
  { value: '202', label: '202 - Serious Injury MVA' },
  { value: '203', label: '203 - Minor MVA' },
  { value: '204', label: '204 - Hit and Run' },
  { value: '205', label: '205 - Pursuit' },
  { value: '210', label: '210 - Drink Driving' },
  { value: '213', label: '213 - Dangerous Driving' },
  { value: '225', label: '225 - Suspect Vehicle' },
  { value: '301', label: '301 - Armed Person(s)' },
  { value: '302', label: '302 - Siege' },
  { value: '303', label: '303 - Bomb Threat' },
  { value: '304', label: '304 - Mental Health Crisis' },
  { value: '305', label: '305 - Hostage Situation' },
  { value: '311', label: '311 - Noise Complaint' },
  { value: '312', label: '312 - Street Disturbance' },
  { value: '313', label: '313 - Licensed Premises Disturbance' },
  { value: '314', label: '314 - Party Complaint' },
  { value: '401', label: '401 - Building Fire' },
  { value: '402', label: '402 - Vehicle Fire' },
  { value: '403', label: '403 - Bushfire' },
  { value: '501', label: '501 - Sudden Death' },
  { value: '502', label: '502 - Attempted Suicide' },
  { value: '503', label: '503 - Missing Person' },
  { value: '504', label: '504 - Injured Person' },
  { value: '512', label: '512 - Assist Ambulance' },
  { value: '513', label: '513 - Assist Fire' },
  { value: '601', label: '601 - Animal Related' },
  { value: '602', label: '602 - Abandoned Vehicle' },
  { value: '701', label: '701 - Officer Requires Urgent Assistance' },
  { value: '819', label: '819 - GOA (Gone on Arrival)' },
];

// ===== VICTORIAN EMERGENCY SERVICES =====
const SERVICES = [
  {
    id: 'vicpol',
    name: 'Victoria Police',
    short: 'VicPol',
    color: '#032261',
    departments: ['General Duties', 'Highway Patrol', 'CIU', 'SOG', 'Dog Squad', 'PolAir', 'Water Police', 'TMU', 'CIRT', 'PSO', 'Forensic', 'Counter Terrorism'],
  },
  {
    id: 'av',
    name: 'Ambulance Victoria',
    short: 'AV',
    color: '#006838',
    departments: ['Paramedic', 'MICA', 'Air Ambulance', 'Clinical Support', 'Emergency Dispatch'],
  },
  {
    id: 'frv',
    name: 'Fire Rescue Victoria',
    short: 'FRV',
    color: '#C41E3A',
    departments: ['Firefighter', 'Station Officer', 'Hazmat', 'Technical Rescue', 'Fire Investigation'],
  },
  {
    id: 'cfa',
    name: 'Country Fire Authority',
    short: 'CFA',
    color: '#D4A017',
    departments: ['Volunteer Brigade', 'Career Staff', 'District Operations', 'Community Safety'],
  },
  {
    id: 'ses',
    name: 'Victoria SES',
    short: 'VicSES',
    color: '#F37021',
    departments: ['Storm Response', 'Flood Response', 'Road Rescue', 'Search & Rescue', 'Community Resilience'],
  },
  {
    id: 'parks',
    name: 'Parks Victoria',
    short: 'Parks',
    color: '#2E8B57',
    departments: ['Park Ranger', 'Wildlife Officer', 'Marine & Coastal', 'Fire Management'],
  },
  {
    id: 'epa',
    name: 'EPA Victoria',
    short: 'EPA',
    color: '#4B8BBE',
    departments: ['Environmental Officer', 'Pollution Response', 'Compliance', 'Investigation'],
  },
  {
    id: 'comms',
    name: 'Emergency Communications',
    short: 'ESTA',
    color: '#6B4C9A',
    departments: ['Communications'],
  },
];

// Flat list of all departments from all services
const ALL_DEPARTMENTS = SERVICES.flatMap((s) => s.departments);

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'dispatch', label: 'Dispatch' },
  { id: 'calls', label: 'Jobs' },
  { id: 'map', label: 'Map' },
  { id: 'search', label: 'LEAP Database' },
  { id: 'bolos', label: 'BOLOs' },
  { id: 'admin', label: 'Admin', adminOnly: true },
  { id: 'test', label: 'Test Panel' },
];

const ADMIN_TABS = [
  { id: 'users', label: 'Users' },
  { id: 'units', label: 'Active Units' },
  { id: 'services', label: 'Services' },
  { id: 'jobcodes', label: 'Job Codes' },
  { id: 'statuscodes', label: 'Status Codes' },
  { id: 'jobsync', label: 'Job Sync' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'auditlog', label: 'Audit Log' },
];

function priorityClass(p) {
  if (p === '1' || p === '2') return 'priority-urgent';
  if (p === '3') return 'priority-medium';
  return 'priority-low';
}

function responseCode(p) {
  return p === '1' || p === '2' ? 'CODE RED' : 'CODE BLUE';
}

/* Southern Cross SVG constellation */
function SouthernCross({ size = 60, color = '#D8B46C' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill={color}>
      <circle cx="50" cy="88" r="5" />
      <circle cx="22" cy="50" r="4.5" />
      <circle cx="50" cy="12" r="4.5" />
      <circle cx="78" cy="50" r="3.5" />
      <circle cx="40" cy="62" r="2.5" />
    </svg>
  );
}

/* ===== SERVICE LOGO PATHS =====
   Replace the SVG files in /public/assets/logos/ with real logos.
   Supported formats: SVG, PNG, JPG, WebP.
*/
const SERVICE_LOGO_PATHS = {
  vicpol: '/assets/logos/vicpol.svg',
  av: '/assets/logos/av.svg',
  frv: '/assets/logos/frv.svg',
  cfa: '/assets/logos/cfa.svg',
  ses: '/assets/logos/ses.svg',
  parks: '/assets/logos/parks.svg',
  epa: '/assets/logos/epa.svg',
  comms: '/assets/logos/comms.svg',
};

function ServiceLogo({ serviceId, size = 48, alt = '', logoPath }) {
  const src = logoPath || SERVICE_LOGO_PATHS[serviceId];
  if (!src) return null;
  return <img src={src} width={size} height={size} alt={alt || serviceId} style={{ objectFit: 'contain' }} draggable={false} />;
}

function getServiceForDepartment(dept, servicesList) {
  const list = servicesList || SERVICES;
  return list.find((s) => s.departments.includes(dept)) || list[0];
}

export default function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('dashboard');

  // Unit state
  const [units, setUnits] = useState([]);
  const [myUnit, setMyUnit] = useState(null);
  const [callsign, setCallsign] = useState('');
  const [unitName, setUnitName] = useState('');
  const [department, setDepartment] = useState('General Duties');
  const [unitStatus, setUnitStatus] = useState('1');
  const [unitLocation, setUnitLocation] = useState('');
  const [unitNote, setUnitNote] = useState('');
  const [citizenid, setCitizenid] = useState('');
  const [unitPositions, setUnitPositions] = useState([]);

  // Call state
  const [calls, setCalls] = useState([]);
  const [callJobCode, setCallJobCode] = useState('');
  const [callTitle, setCallTitle] = useState('');
  const [callDescription, setCallDescription] = useState('');
  const [callLocation, setCallLocation] = useState('');
  const [callPriority, setCallPriority] = useState('3');

  // Search state
  const [searchType, setSearchType] = useState('person');
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [vehicleResults, setVehicleResults] = useState([]);

  // BOLO state
  const [bolos, setBolos] = useState([]);
  const [boloType, setBoloType] = useState('person');
  const [boloTitle, setBoloTitle] = useState('');
  const [boloDescription, setBoloDescription] = useState('');

  // Radio control
  const [radioUnitId, setRadioUnitId] = useState('');
  const [radioServerId, setRadioServerId] = useState('');
  const [radioChannel, setRadioChannel] = useState('');

  // Emergency 000 call state
  const [emergencyCalls, setEmergencyCalls] = useState([]);
  const [activeEmergencyCall, setActiveEmergencyCall] = useState(null);

  // Radio activity state
  const [radioActivityFeed, setRadioActivityFeed] = useState([]);
  const [channelPlayers, setChannelPlayers] = useState([]);
  const [viewChannel, setViewChannel] = useState('');
  const [mumbleConfig, setMumbleConfig] = useState({ enabled: false, url: '' });

  // Floating radio panel
  const [radioPopupOpen, setRadioPopupOpen] = useState(false);
  const [radioPopupPos, setRadioPopupPos] = useState({ x: 60, y: 60 });
  const radioDragRef = useRef(null);

  // Department / service selection state (after login)
  const [userDepartments, setUserDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [deptLoading, setDeptLoading] = useState(false);

  // Admin panel state
  const [adminTab, setAdminTab] = useState('users');
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminNewUsername, setAdminNewUsername] = useState('');
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminNewRole, setAdminNewRole] = useState('dispatcher');
  const [adminEditDepts, setAdminEditDepts] = useState({});
  const [adminResetPwUserId, setAdminResetPwUserId] = useState(null);
  const [adminResetPwValue, setAdminResetPwValue] = useState('');
  const [jobSyncMappings, setJobSyncMappings] = useState([]);
  const [jobSyncNewJob, setJobSyncNewJob] = useState('');
  const [jobSyncNewDept, setJobSyncNewDept] = useState('');

  // Announcements
  const [announcements, setAnnouncements] = useState([]);
  const [adminAnnouncements, setAdminAnnouncements] = useState([]);
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');

  // Audit log
  const [auditLog, setAuditLog] = useState([]);

  // Custom job codes
  const [customJobCodes, setCustomJobCodes] = useState([]);
  const [newJCCode, setNewJCCode] = useState('');
  const [newJCLabel, setNewJCLabel] = useState('');

  // Custom status codes
  const [customStatusCodes, setCustomStatusCodes] = useState([]);
  const [newSCCode, setNewSCCode] = useState('');
  const [newSCLabel, setNewSCLabel] = useState('');

  // CMS state
  const [cmsServices, setCmsServices] = useState([]);
  const [cmsSettings, setCmsSettings] = useState({});
  const [cmsEditService, setCmsEditService] = useState(null);
  const [cmsNewService, setCmsNewService] = useState({ service_id: '', name: '', short_name: '', color: '#444444', logo_path: '' });
  const [cmsNewDeptName, setCmsNewDeptName] = useState('');
  const [cmsSettingKey, setCmsSettingKey] = useState('');
  const [cmsSettingValue, setCmsSettingValue] = useState('');
  const [externalDbConfig, setExternalDbConfig] = useState({
    enabled: false,
    host: '',
    port: '3306',
    user: '',
    password: '',
    database: '',
    character_table: 'players',
    character_id_field: 'citizenid',
    character_firstname_field: '',
    character_lastname_field: '',
    character_birthdate_field: '',
    character_phone_field: '',
    character_json_field: 'charinfo',
    character_json_firstname_path: '$.firstname',
    character_json_lastname_path: '$.lastname',
    character_json_birthdate_path: '$.birthdate',
    character_json_phone_path: '$.phone',
    vehicle_table: 'player_vehicles',
    vehicle_plate_field: 'plate',
    vehicle_model_field: 'vehicle',
    vehicle_owner_field: 'citizenid',
  });

  // VHF Radio state
  const [radioFreqInput, setRadioFreqInput] = useState('');
  const [radioVolume, setRadioVolume] = useState(75);
  const [radioPowerOn, setRadioPowerOn] = useState(true);

  // Test page state
  const [testLog, setTestLog] = useState([]);
  const [testEmCallerName, setTestEmCallerName] = useState('Test Caller');
  const [testEmLocation, setTestEmLocation] = useState('Bourke St Mall');
  const [testEmCallId, setTestEmCallId] = useState('');
  const [testSearchTerm, setTestSearchTerm] = useState('');
  const [testBoloTitle, setTestBoloTitle] = useState('Test BOLO');
  const [testBoloDesc, setTestBoloDesc] = useState('Test description');
  const [testCallTitle, setTestCallTitle] = useState('Test Job');
  const [testCallLoc, setTestCallLoc] = useState('Test Location');
  const [testRadioCh, setTestRadioCh] = useState('');

  const isAuthenticated = useMemo(() => Boolean(user), [user]);
  const isLoggedIn = useMemo(() => Boolean(user) && Boolean(selectedDepartment), [user, selectedDepartment]);
  const isAdmin = useMemo(() => user && user.role === 'admin', [user]);

  // Derive services from CMS data when available, else use hardcoded SERVICES
  const activeServices = useMemo(() => {
    if (cmsServices.length > 0) {
      return cmsServices
        .filter((s) => s.enabled)
        .map((s) => ({
          id: s.service_id,
          name: s.name,
          short: s.short_name,
          color: s.color,
          departments: (s.departments || []).filter((d) => d.enabled).map((d) => d.name),
          logo_path: s.logo_path,
        }));
    }
    return SERVICES;
  }, [cmsServices]);

  // Flat list of all departments from active services
  const allDepartments = useMemo(() => activeServices.flatMap((s) => s.departments), [activeServices]);

  // Build effective status labels (custom overrides default)
  const STATUS_LABELS = useMemo(() => {
    if (customStatusCodes.length > 0) {
      const custom = {};
      customStatusCodes.forEach((sc) => { custom[sc.code] = `Status ${sc.code} - ${sc.label}`; });
      return custom;
    }
    return DEFAULT_STATUS_LABELS;
  }, [customStatusCodes]);

  // Build effective job codes (custom overrides default)
  const JOB_CODES = useMemo(() => {
    if (customJobCodes.length > 0) {
      return [
        { value: '', label: 'Select job code...' },
        ...customJobCodes.map((jc) => ({ value: jc.code, label: `${jc.code} - ${jc.label}` })),
      ];
    }
    return DEFAULT_JOB_CODES;
  }, [customJobCodes]);

  function statusShort(s) {
    return STATUS_LABELS[s] || `Status ${s}`;
  }

  // Derive which service the user is logged into
  const activeService = useMemo(() => {
    if (!selectedDepartment) return activeServices[0];
    return getServiceForDepartment(selectedDepartment, activeServices);
  }, [selectedDepartment, activeServices]);

  useEffect(() => {
    if (!getToken()) return;
    getMe()
      .then((data) => setUser(data.user))
      .catch(() => clearToken());
  }, []);

  // Load departments and CMS services after authentication
  useEffect(() => {
    if (!isAuthenticated) return;
    setDeptLoading(true);
    // Load CMS services early so department selection uses dynamic data
    getCmsServices().then(setCmsServices).catch(() => {});
    getMyDepartments()
      .then((depts) => {
        setUserDepartments(depts || []);
        if (user.role === 'admin' && (!depts || depts.length === 0)) {
          setSelectedDepartment('General Duties');
        } else if (depts && depts.length === 1) {
          setSelectedDepartment(depts[0]);
        }
      })
      .catch(() => setUserDepartments([]))
      .finally(() => setDeptLoading(false));
  }, [isAuthenticated]);

  // Load custom codes & CMS data after login
  useEffect(() => {
    if (!isLoggedIn) return;
    getCustomJobCodes().then(setCustomJobCodes).catch(() => {});
    getCustomStatusCodes().then(setCustomStatusCodes).catch(() => {});
    getAnnouncements().then(setAnnouncements).catch(() => {});
    getCmsServices().then(setCmsServices).catch(() => {});
    getCmsSettings().then(setCmsSettings).catch(() => {});
    if (user && user.role === 'admin') {
      getExternalDbConfig().then(setExternalDbConfig).catch(() => {});
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return undefined;
    let isActive = true;
    let prevPendingCount = 0;

    async function refresh() {
      try {
        const [unitData, listData, positionData, callsData, boloData, emergencyData] = await Promise.all([
          getMyUnit(),
          getUnits(),
          getUnitPositions(),
          getCalls(),
          getBolos(),
          getEmergencyCalls(),
        ]);
        if (!isActive) return;
        setMyUnit(unitData);
        setUnits(listData);
        setUnitPositions(positionData);
        setCalls(callsData);
        setBolos(boloData);

        const pendingNew = (emergencyData || []).filter((c) => c.status === 'pending');
        if (pendingNew.length > prevPendingCount) {
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
          } catch { /* no audio support */ }
        }
        prevPendingCount = pendingNew.length;
        setEmergencyCalls(emergencyData || []);
        setActiveEmergencyCall((emergencyData || []).find((c) => c.status === 'accepted') || null);

        if (unitData) {
          setUnitStatus(unitData.status || '1');
          setUnitLocation(unitData.location || '');
          setUnitNote(unitData.note || '');
          setCallsign(unitData.callsign || '');
          setUnitName(unitData.name || '');
          setDepartment(unitData.department || 'General Duties');
          setCitizenid(unitData.citizenid || '');
        }
      } catch (err) {
        if (isActive) setError('Failed to refresh data');
      }
    }

    refresh();
    const timer = setInterval(refresh, 5000);
    return () => { isActive = false; clearInterval(timer); };
  }, [isLoggedIn]);

  // Radio activity polling
  useEffect(() => {
    if (!isLoggedIn || !radioPopupOpen) return undefined;
    let active = true;

    async function pollRadio() {
      try {
        const activity = await getRadioActivity();
        if (active) setRadioActivityFeed(activity || []);
      } catch { /* swallow */ }
    }

    async function loadMumble() {
      try {
        const cfg = await getMumbleConfig();
        if (active) setMumbleConfig(cfg || { enabled: false, url: '' });
      } catch { /* swallow */ }
    }

    pollRadio();
    loadMumble();
    const timer = setInterval(pollRadio, 3000);
    return () => { active = false; clearInterval(timer); };
  }, [isLoggedIn, radioPopupOpen]);

  async function handleLogin(e) {
    e.preventDefault();
    setError(''); setStatus('');
    try {
      const data = await login(username, password);
      setToken(data.token);
      setUser(data.user);
      setSelectedDepartment(null);
      setSelectedService(null);
      setStatus(`Logged in as ${data.user.username}`);
    } catch { setError('Invalid username or password'); }
  }

  function handleLogout() {
    clearToken();
    setUser(null); setUnits([]); setMyUnit(null);
    setResults([]); setVehicleResults([]); setTerm('');
    setUnitPositions([]); setCalls([]); setBolos([]);
    setRadioUnitId(''); setRadioServerId(''); setRadioChannel('');
    setEmergencyCalls([]); setActiveEmergencyCall(null);
    setRadioActivityFeed([]); setChannelPlayers([]);
    setSelectedDepartment(null); setSelectedService(null); setUserDepartments([]);
    setAdminUsers([]); setAnnouncements([]);
    setCustomJobCodes([]); setCustomStatusCodes([]);
    setStatus('Logged out');
  }

  async function handleOnDuty(e) {
    e.preventDefault();
    setError(''); setStatus('');
    try {
      const unit = await setOnDuty({ callsign, name: unitName, department, citizenid });
      setMyUnit(unit);
      setStatus('Unit signed on duty');
    } catch { setError('Failed to sign on duty'); }
  }

  async function handleUpdateUnit(e) {
    e.preventDefault();
    setError(''); setStatus('');
    try {
      const unit = await updateMyUnit({ status: unitStatus, location: unitLocation, note: unitNote, citizenid });
      setMyUnit(unit);
      setStatus('Status updated');
    } catch { setError('Failed to update unit'); }
  }

  async function handleOffDuty() {
    setError(''); setStatus('');
    try {
      await setOffDuty();
      setMyUnit(null);
      setStatus('Unit signed off duty (Status 8)');
    } catch { setError('Failed to sign off duty'); }
  }

  async function handleDuress() {
    setError(''); setStatus('');
    try {
      const unit = await updateMyUnit({ status: '9' });
      setMyUnit(unit);
      setUnitStatus('9');
      setStatus('DURESS ACTIVATED - Status 9');
    } catch { setError('Failed to activate duress'); }
  }

  async function handleSearch(e) {
    e.preventDefault();
    setError(''); setStatus('');
    if (!term.trim()) { setResults([]); setVehicleResults([]); return; }
    try {
      if (searchType === 'person') {
        const data = await searchCharacters(term.trim());
        setResults(data); setVehicleResults([]);
        if (!data.length) setStatus('No results');
      } else {
        const data = await searchVehicles(term.trim());
        setVehicleResults(data); setResults([]);
        if (!data.length) setStatus('No results');
      }
    } catch { setError('Search failed'); }
  }

  async function handleCreateCall(e) {
    e.preventDefault();
    setError(''); setStatus('');
    try {
      const call = await createCall({ job_code: callJobCode, title: callTitle, description: callDescription, location: callLocation, priority: callPriority });
      setCalls((prev) => [call, ...prev]);
      setCallJobCode(''); setCallTitle(''); setCallDescription(''); setCallLocation(''); setCallPriority('3');
      setStatus('Job created');
    } catch { setError('Failed to create job'); }
  }

  async function handleAssign(callId, unitId) {
    if (!unitId) return;
    setError(''); setStatus('');
    try {
      await assignUnit(callId, Number(unitId));
      const refreshed = await getCalls();
      setCalls(refreshed);
      setStatus('Unit assigned');
    } catch { setError('Assignment failed'); }
  }

  async function handleUnassign(callId, unitId) {
    setError(''); setStatus('');
    try {
      await unassignUnit(callId, unitId);
      const refreshed = await getCalls();
      setCalls(refreshed);
      setStatus('Unit unassigned');
    } catch { setError('Unassign failed'); }
  }

  async function handleUpdateCallStatus(callId, nextStatus) {
    setError(''); setStatus('');
    try {
      await updateCall(callId, { status: nextStatus });
      const refreshed = await getCalls();
      setCalls(refreshed);
      setStatus('Job updated');
    } catch { setError('Failed to update job'); }
  }

  async function handleCreateBolo(e) {
    e.preventDefault();
    setError(''); setStatus('');
    try {
      const bolo = await createBolo({ type: boloType, title: boloTitle, description: boloDescription });
      setBolos((prev) => [bolo, ...prev]);
      setBoloTitle(''); setBoloDescription(''); setBoloType('person');
      setStatus('BOLO created');
    } catch { setError('Failed to create BOLO'); }
  }

  async function handleCancelBolo(boloId) {
    setError(''); setStatus('');
    try {
      await cancelBolo(boloId);
      const refreshed = await getBolos();
      setBolos(refreshed);
      setStatus('BOLO cancelled');
    } catch { setError('Failed to cancel BOLO'); }
  }

  async function handleRadioJoin(e) {
    e.preventDefault();
    setError(''); setStatus('');
    const unit = units.find((u) => String(u.user_id) === String(radioUnitId));
    const citizen = unit?.citizenid?.trim();
    const channel = radioChannel ? Number(radioChannel) : null;
    if (!channel || Number.isNaN(channel)) { setError('Enter a valid channel'); return; }
    try {
      await radioJoin({ citizenid: citizen || undefined, serverId: radioServerId || undefined, channel });
      setStatus('Radio channel sent');
    } catch { setError('Failed to set radio channel'); }
  }

  async function handleRadioLeave() {
    setError(''); setStatus('');
    const unit = units.find((u) => String(u.user_id) === String(radioUnitId));
    const citizen = unit?.citizenid?.trim();
    try {
      await radioLeave({ citizenid: citizen || undefined, serverId: radioServerId || undefined });
      setStatus('Radio leave sent');
    } catch { setError('Failed to leave radio'); }
  }

  async function handleAcceptEmergency(callId) {
    setError(''); setStatus('');
    try {
      const call = await acceptEmergencyCall(callId);
      setActiveEmergencyCall(call);
      setStatus(`000 call accepted - Channel ${call.channel}`);
      const refreshed = await getEmergencyCalls();
      setEmergencyCalls(refreshed || []);
    } catch { setError('Failed to accept 000 call'); }
  }

  async function handleCompleteEmergency(callId) {
    setError(''); setStatus('');
    try {
      await completeEmergencyCall(callId);
      setActiveEmergencyCall(null);
      setStatus('000 call completed');
      const refreshed = await getEmergencyCalls();
      setEmergencyCalls(refreshed || []);
    } catch { setError('Failed to complete 000 call'); }
  }

  async function handleViewChannelPlayers(e) {
    e.preventDefault();
    if (!viewChannel) return;
    setError(''); setStatus('');
    try {
      const data = await getChannelPlayers(Number(viewChannel));
      setChannelPlayers(data.players || []);
      if (!data.players?.length) setStatus(`No players on channel ${viewChannel}`);
    } catch { setError('Failed to fetch channel players'); }
  }

  // ===== Admin panel helpers =====
  async function loadAdminUsers() {
    try {
      const users = await getAdminUsers();
      setAdminUsers(users || []);
      const deptState = {};
      (users || []).forEach((u) => { deptState[u.id] = u.departments || []; });
      setAdminEditDepts(deptState);
    } catch { setError('Failed to load admin users'); }
  }

  async function loadJobSyncMappings() {
    try {
      const mappings = await getJobSyncMappings();
      setJobSyncMappings(mappings || []);
    } catch { setError('Failed to load job sync mappings'); }
  }

  async function loadAdminAnnouncements() {
    try {
      const anns = await getAdminAnnouncements();
      setAdminAnnouncements(anns || []);
    } catch { setError('Failed to load announcements'); }
  }

  async function loadAuditLog() {
    try {
      const log = await getAuditLog(200);
      setAuditLog(log || []);
    } catch { setError('Failed to load audit log'); }
  }

  async function loadCustomJobCodes() {
    try {
      const jcs = await getCustomJobCodes();
      setCustomJobCodes(jcs || []);
    } catch { setError('Failed to load job codes'); }
  }

  async function loadCustomStatusCodes() {
    try {
      const scs = await getCustomStatusCodes();
      setCustomStatusCodes(scs || []);
    } catch { setError('Failed to load status codes'); }
  }

  useEffect(() => {
    if (isLoggedIn && isAdmin && tab === 'admin') {
      if (adminTab === 'users') loadAdminUsers();
      if (adminTab === 'jobsync') loadJobSyncMappings();
      if (adminTab === 'announcements') loadAdminAnnouncements();
      if (adminTab === 'auditlog') loadAuditLog();
      if (adminTab === 'jobcodes') loadCustomJobCodes();
      if (adminTab === 'statuscodes') loadCustomStatusCodes();
      if (adminTab === 'services') getExternalDbConfig().then(setExternalDbConfig).catch(() => {});
    }
  }, [isLoggedIn, isAdmin, tab, adminTab]);

  async function handleAdminCreateUser(e) {
    e.preventDefault();
    setError(''); setStatus('');
    try {
      await createAdminUser({ username: adminNewUsername, password: adminNewPassword, role: adminNewRole });
      setAdminNewUsername(''); setAdminNewPassword(''); setAdminNewRole('dispatcher');
      loadAdminUsers();
      setStatus('User created');
    } catch { setError('Failed to create user (username may already exist)'); }
  }

  async function handleAdminDeleteUser(userId) {
    setError(''); setStatus('');
    try {
      await deleteAdminUser(userId);
      loadAdminUsers();
      setStatus('User deleted');
    } catch { setError('Failed to delete user'); }
  }

  async function handleAdminUpdateRole(userId, role) {
    setError(''); setStatus('');
    try {
      await updateAdminUserRole(userId, role);
      loadAdminUsers();
      setStatus('Role updated');
    } catch { setError('Failed to update role'); }
  }

  async function handleAdminResetPassword(userId) {
    if (!adminResetPwValue) return;
    setError(''); setStatus('');
    try {
      await resetAdminUserPassword(userId, adminResetPwValue);
      setAdminResetPwUserId(null); setAdminResetPwValue('');
      setStatus('Password reset');
    } catch { setError('Failed to reset password'); }
  }

  async function handleAdminSaveDepts(userId) {
    setError(''); setStatus('');
    try {
      await setAdminUserDepartments(userId, adminEditDepts[userId] || []);
      loadAdminUsers();
      setStatus('Departments updated');
    } catch { setError('Failed to update departments'); }
  }

  function toggleAdminDept(userId, dept) {
    setAdminEditDepts((prev) => {
      const current = prev[userId] || [];
      const next = current.includes(dept) ? current.filter((d) => d !== dept) : [...current, dept];
      return { ...prev, [userId]: next };
    });
  }

  async function handleSaveExternalDbConfig(e) {
    e.preventDefault();
    setError(''); setStatus('');
    try {
      const saved = await updateExternalDbConfig(externalDbConfig);
      setExternalDbConfig(saved);
      setStatus('External DB configuration saved');
    } catch (err) {
      setError(err.message || 'Failed to save external DB config');
    }
  }

  async function handleTestExternalDbConfig() {
    setError(''); setStatus('');
    try {
      const result = await testExternalDbConfig();
      setStatus(`External DB connected (characters: ${result.details?.characters ? 'ok' : 'n/a'}, vehicles: ${result.details?.vehicles ? 'ok' : 'n/a'})`);
    } catch (err) {
      setError(err.message || 'External DB test failed');
    }
  }

  async function handleCreateJobSync(e) {
    e.preventDefault();
    if (!jobSyncNewJob || !jobSyncNewDept) return;
    setError(''); setStatus('');
    try {
      await createJobSyncMapping({ job_name: jobSyncNewJob, department: jobSyncNewDept });
      setJobSyncNewJob(''); setJobSyncNewDept('');
      loadJobSyncMappings();
      setStatus('Job sync mapping created');
    } catch { setError('Failed to create job sync mapping'); }
  }

  async function handleDeleteJobSync(id) {
    setError(''); setStatus('');
    try {
      await deleteJobSyncMapping(id);
      loadJobSyncMappings();
      setStatus('Job sync mapping deleted');
    } catch { setError('Failed to delete job sync mapping'); }
  }

  async function handleCreateAnnouncement(e) {
    e.preventDefault();
    if (!annTitle) return;
    setError(''); setStatus('');
    try {
      await createAnnouncement({ title: annTitle, body: annBody });
      setAnnTitle(''); setAnnBody('');
      loadAdminAnnouncements();
      getAnnouncements().then(setAnnouncements).catch(() => {});
      setStatus('Announcement created');
    } catch { setError('Failed to create announcement'); }
  }

  async function handleDeleteAnnouncement(id) {
    setError(''); setStatus('');
    try {
      await deleteAnnouncement(id);
      loadAdminAnnouncements();
      getAnnouncements().then(setAnnouncements).catch(() => {});
      setStatus('Announcement deleted');
    } catch { setError('Failed to delete announcement'); }
  }

  async function handleCreateJobCode(e) {
    e.preventDefault();
    if (!newJCCode || !newJCLabel) return;
    setError(''); setStatus('');
    try {
      await createCustomJobCode({ code: newJCCode, label: newJCLabel });
      setNewJCCode(''); setNewJCLabel('');
      loadCustomJobCodes();
      setStatus('Job code created');
    } catch { setError('Failed to create job code (may already exist)'); }
  }

  async function handleDeleteJobCode(id) {
    setError(''); setStatus('');
    try {
      await deleteCustomJobCode(id);
      loadCustomJobCodes();
      setStatus('Job code deleted');
    } catch { setError('Failed to delete job code'); }
  }

  async function handleCreateStatusCode(e) {
    e.preventDefault();
    if (!newSCCode || !newSCLabel) return;
    setError(''); setStatus('');
    try {
      await createCustomStatusCode({ code: newSCCode, label: newSCLabel });
      setNewSCCode(''); setNewSCLabel('');
      loadCustomStatusCodes();
      setStatus('Status code created');
    } catch { setError('Failed to create status code (may already exist)'); }
  }

  async function handleDeleteStatusCode(id) {
    setError(''); setStatus('');
    try {
      await deleteCustomStatusCode(id);
      loadCustomStatusCodes();
      setStatus('Status code deleted');
    } catch { setError('Failed to delete status code'); }
  }

  async function handleAdminKickUnit(userId) {
    setError(''); setStatus('');
    try {
      await adminKickUnit(userId);
      setStatus('Unit kicked off duty');
    } catch { setError('Failed to kick unit'); }
  }

  async function handleAdminSetUnitStatus(userId, newStatus) {
    setError(''); setStatus('');
    try {
      await adminSetUnitStatus(userId, newStatus);
      setStatus('Unit status updated');
    } catch { setError('Failed to update unit status'); }
  }

  // VHF Radio keypad handler
  function handleRadioKeypad(digit) {
    if (digit === 'CLR') {
      setRadioFreqInput('');
    } else if (digit === 'ENT') {
      if (radioFreqInput) setRadioChannel(radioFreqInput);
    } else {
      setRadioFreqInput((prev) => {
        if (prev.length >= 7) return prev;
        if (digit === '.' && prev.includes('.')) return prev;
        return prev + digit;
      });
    }
  }

  // Test page helper
  const testRun = useCallback(async (label, fn) => {
    const ts = new Date().toLocaleTimeString();
    setTestLog((prev) => [...prev, { ts, label, status: 'running', result: null }]);
    try {
      const result = await fn();
      setTestLog((prev) =>
        prev.map((e) =>
          e.ts === ts && e.label === label ? { ...e, status: 'ok', result: JSON.stringify(result, null, 2) } : e
        )
      );
    } catch (err) {
      setTestLog((prev) =>
        prev.map((e) =>
          e.ts === ts && e.label === label ? { ...e, status: 'error', result: err.message } : e
        )
      );
    }
  }, []);

  // Radio popup drag
  const handleRadioDragStart = useCallback((e) => {
    const startX = e.clientX - radioPopupPos.x;
    const startY = e.clientY - radioPopupPos.y;
    const onMove = (ev) => setRadioPopupPos({ x: ev.clientX - startX, y: ev.clientY - startY });
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [radioPopupPos]);

  function toMapPosition(coords) {
    if (!coords) return null;
    let x = null, y = null;
    if (Array.isArray(coords)) { [x, y] = coords; }
    else { x = coords.x ?? coords[0]; y = coords.y ?? coords[1]; }
    if (typeof x !== 'number' || typeof y !== 'number') return null;
    const { minX, maxX, minY, maxY } = mapConfig.bounds;
    const percentX = ((x - minX) / (maxX - minX)) * 100;
    const percentY = (1 - (y - minY) / (maxY - minY)) * 100;
    return {
      left: `${Math.max(0, Math.min(100, percentX))}%`,
      top: `${Math.max(0, Math.min(100, percentY))}%`,
    };
  }

  const pendingEmergencies = emergencyCalls.filter((c) => c.status === 'pending');

  // Get the departments available for the current service selection
  const serviceDepartments = useMemo(() => {
    if (!selectedService) return [];
    const svc = activeServices.find((s) => s.id === selectedService);
    return svc ? svc.departments : [];
  }, [selectedService, activeServices]);

  // ===== LOGIN SCREEN =====
  if (!isAuthenticated) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <div className="login-badge">
              <SouthernCross size={60} />
            </div>
            <h1>EMERGENCY SERVICES</h1>
            <p>Computer Aided Dispatch</p>
          </div>
          <form onSubmit={handleLogin} className="form">
            <label>
              Username
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <button type="submit">Sign In</button>
          </form>
          {error && <div className="toast error">{error}</div>}
        </div>
      </div>
    );
  }

  // ===== SERVICE / DEPARTMENT SELECTION SCREEN =====
  if (!selectedDepartment) {
    // If user has no service selected yet, show service grid
    if (!selectedService) {
      // Admin can see all services, regular users see services that contain their departments
      const availableServices = isAdmin
        ? activeServices
        : activeServices.filter((s) => s.departments.some((d) => userDepartments.includes(d)));

      // Also add Admin as a pseudo-service for admin users
      const showAdminOption = isAdmin;

      return (
        <div className="login-page">
          <div className="login-card service-select-card">
            <div className="login-header">
              <div className="login-badge">
                <SouthernCross size={50} />
              </div>
              <h1>SELECT SERVICE</h1>
              <p>Logged in as {user.username}</p>
            </div>
            {deptLoading ? (
              <div className="empty" style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>
            ) : availableServices.length === 0 && !showAdminOption ? (
              <div className="dept-no-access">
                <p>No departments assigned to your account.</p>
                <p>Contact an administrator to get department access.</p>
                <button className="ghost" onClick={handleLogout} style={{ marginTop: '16px' }}>Sign Out</button>
              </div>
            ) : (
              <div className="service-grid">
                {showAdminOption && (
                  <button
                    className="service-card"
                    style={{ '--svc-color': '#D8B46C' }}
                    onClick={() => { setSelectedDepartment('Admin'); setSelectedService('vicpol'); }}
                  >
                    <div className="service-logo">
                      <SouthernCross size={48} color="#D8B46C" />
                    </div>
                    <div className="service-name">Admin Panel</div>
                    <div className="service-short">CAD Admin</div>
                  </button>
                )}
                {availableServices.map((svc) => (
                    <button
                      key={svc.id}
                      className="service-card"
                      style={{ '--svc-color': svc.color }}
                      onClick={() => {
                        if (svc.departments.length === 1) {
                          setSelectedService(svc.id);
                          setSelectedDepartment(svc.departments[0]);
                          setDepartment(svc.departments[0]);
                        } else {
                          setSelectedService(svc.id);
                        }
                      }}
                    >
                      <div className="service-logo">
                        <ServiceLogo serviceId={svc.id} size={48} alt={svc.name} logoPath={svc.logo_path} />
                      </div>
                      <div className="service-name">{svc.name}</div>
                      <div className="service-short">{svc.short}</div>
                    </button>
                ))}
              </div>
            )}
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button className="ghost btn-sm" onClick={handleLogout}>Sign Out</button>
            </div>
            {error && <div className="toast error">{error}</div>}
          </div>
        </div>
      );
    }

    // Service is selected, now choose department within it
    const svc = activeServices.find((s) => s.id === selectedService);
    const availableDepts = isAdmin
      ? svc.departments
      : svc.departments.filter((d) => userDepartments.includes(d));

    return (
      <div className="login-page">
        <div className="login-card dept-select-card">
          <div className="login-header">
            <div className="login-badge">
              <ServiceLogo serviceId={svc.id} size={56} alt={svc.name} logoPath={svc.logo_path} />
            </div>
            <h1>{svc.name.toUpperCase()}</h1>
            <p>Select your department</p>
          </div>
          {availableDepts.length === 0 ? (
            <div className="dept-no-access">
              <p>No departments available in this service.</p>
              <button className="ghost" onClick={() => setSelectedService(null)} style={{ marginTop: '12px' }}>Back</button>
            </div>
          ) : (
            <div className="dept-grid">
              {availableDepts.map((dept) => (
                <button
                  key={dept}
                  className="dept-btn"
                  style={{ '--svc-color': svc.color }}
                  onClick={() => {
                    setSelectedDepartment(dept);
                    setDepartment(dept);
                  }}
                >
                  {dept}
                </button>
              ))}
            </div>
          )}
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button className="ghost btn-sm" onClick={() => setSelectedService(null)}>Back to Services</button>
            <button className="ghost btn-sm" onClick={handleLogout} style={{ marginLeft: '8px' }}>Sign Out</button>
          </div>
          {error && <div className="toast error">{error}</div>}
        </div>
      </div>
    );
  }

  // ===== MAIN MDT LAYOUT =====
  return (
    <div className="mdt">
      <aside className="sidebar" style={{ '--svc-accent': activeService.color }}>
        <div className="sidebar-brand">
          <ServiceLogo serviceId={activeService.id} size={28} alt={activeService.name} logoPath={activeService.logo_path} />
          <h1>{activeService.short}</h1>
          <span className="badge">{activeService.name.split(' ').pop()}</span>
        </div>
        <div className="sillitoe-tartan sillitoe-bar" style={{ backgroundColor: activeService.color, backgroundImage: 'none', height: '3px' }} />
        <div className="sidebar-dept-label">{selectedDepartment}</div>
        <nav className="sidebar-nav">
          {TABS.filter((t) => !t.adminOnly || isAdmin).map((t) => (
            <button
              key={t.id}
              className={`nav-btn${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === 'bolos' && bolos.length > 0 && (
                <span className="nav-badge">{bolos.length}</span>
              )}
              {t.id === 'dashboard' && pendingEmergencies.length > 0 && (
                <span className="nav-badge">{pendingEmergencies.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-watermark">{activeService.short} CAD v3.0</div>
        <div className="sidebar-radio-toggle">
          <button
            className={`btn-sm ${radioPopupOpen ? 'btn-danger' : 'ghost'} radio-toggle-btn`}
            onClick={() => setRadioPopupOpen((o) => !o)}
            title="Toggle Radio Panel"
          >
            {radioPopupOpen ? 'Close Radio' : 'Open Radio'}
          </button>
        </div>
        <div className="sidebar-footer">
          <span className="user-label">{user.username}</span>
          <button className="btn-sm ghost" onClick={handleLogout}>Sign Out</button>
        </div>
      </aside>

      <main className="content">
        {/* Announcements banner */}
        {announcements.length > 0 && tab === 'dashboard' && (
          <div className="announcement-bar">
            <span className="announcement-icon">MOTD</span>
            <div className="announcement-text">
              <strong>{announcements[0].title}</strong>
              {announcements[0].body && <span> &mdash; {announcements[0].body}</span>}
            </div>
          </div>
        )}

        {pendingEmergencies.length > 0 && (
          <div className="emergency-bar">
            <div className="emergency-pulse" />
            <span className="emergency-label">000 EMERGENCY</span>
            <span className="emergency-count">{pendingEmergencies.length} pending call(s)</span>
            <div className="emergency-calls-list">
              {pendingEmergencies.map((call) => (
                <div key={call.id} className="emergency-call-item">
                  <span>{call.caller_name || 'Unknown'}</span>
                  <span className="emergency-location">{call.location || 'Unknown Location'}</span>
                  <button className="btn-sm btn-emergency" onClick={() => handleAcceptEmergency(call.id)}>Accept</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeEmergencyCall && (
          <div className="emergency-active">
            <div className="emergency-active-info">
              <span className="emergency-label">ACTIVE 000 CALL</span>
              <span>Caller: {activeEmergencyCall.caller_name || 'Unknown'}</span>
              <span>Channel: {activeEmergencyCall.channel}</span>
              <span>Location: {activeEmergencyCall.location || 'Unknown'}</span>
            </div>
            <button className="btn-sm btn-danger" onClick={() => handleCompleteEmergency(activeEmergencyCall.id)}>End Call</button>
          </div>
        )}

        {(error || status) && (
          <div className={`toast ${error ? 'error' : 'ok'}`}>{error || status}</div>
        )}

        {/* ===== DASHBOARD ===== */}
        {tab === 'dashboard' && (
          <div className="tab-content">
            <div className="grid-2">
              <section className="card">
                <h2>My Unit</h2>
                {!myUnit ? (
                  <form onSubmit={handleOnDuty} className="form">
                    <label>Callsign<input value={callsign} onChange={(e) => setCallsign(e.target.value)} placeholder="Golf-401" /></label>
                    <label>Citizen ID<input value={citizenid} onChange={(e) => setCitizenid(e.target.value)} placeholder="CID12345" /></label>
                    <label>Display Name<input value={unitName} onChange={(e) => setUnitName(e.target.value)} placeholder="J. Smith" /></label>
                    <label>
                      Department
                      <select value={department} onChange={(e) => setDepartment(e.target.value)}>
                        {activeService.departments.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </label>
                    <button type="submit">Go On Duty</button>
                  </form>
                ) : (
                  <form onSubmit={handleUpdateUnit} className="form">
                    <div className="pill">{myUnit.callsign} - {myUnit.department}</div>
                    <label>Citizen ID<input value={citizenid} onChange={(e) => setCitizenid(e.target.value)} /></label>
                    <label>
                      Status
                      <select value={unitStatus} onChange={(e) => setUnitStatus(e.target.value)}>
                        {Object.entries(STATUS_LABELS).map(([val, lbl]) => (
                          <option key={val} value={val}>{lbl}</option>
                        ))}
                      </select>
                    </label>
                    <label>Location<input value={unitLocation} onChange={(e) => setUnitLocation(e.target.value)} placeholder="Bourke St" /></label>
                    <label>Notes<input value={unitNote} onChange={(e) => setUnitNote(e.target.value)} placeholder="Traffic stop" /></label>
                    <div className="actions">
                      <button type="submit">Update</button>
                      <button type="button" className="btn-danger" onClick={handleDuress}>DURESS</button>
                      <button type="button" className="ghost" onClick={handleOffDuty}>Off Duty</button>
                    </div>
                  </form>
                )}
              </section>

              <section className="card">
                <h2>Active Units ({units.length})</h2>
                <div className="unit-list">
                  {units.map((unit) => (
                    <div key={unit.user_id} className={`unit-row${unit.status === '9' ? ' urgent' : ''}`}>
                      <div className="unit-callsign">{unit.callsign}</div>
                      <div className="unit-info">
                        <span className="unit-name">{unit.name}</span>
                        <span className="unit-dept">{unit.department || 'N/A'}</span>
                      </div>
                      <div className="unit-meta">
                        <span className={`status-badge status-${unit.status}`}>{statusShort(unit.status)}</span>
                        <span className="unit-location">{unit.location || ''}</span>
                      </div>
                    </div>
                  ))}
                  {!units.length && <div className="empty">No active units</div>}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ===== DISPATCH ===== */}
        {tab === 'dispatch' && (
          <div className="tab-content">
            <section className="card">
              <h2>Dispatch Console</h2>
              <p className="hint">Manage active jobs, assign units, and monitor all services from the dispatch console.</p>
            </section>

            <div className="dispatch-grid">
              {/* Pending Jobs Column */}
              <section className="card dispatch-col">
                <h2>Pending Jobs ({calls.filter((c) => c.status === 'open' || c.status === 'dispatched').length})</h2>
                <div className="dispatch-job-list">
                  {calls.filter((c) => c.status === 'open' || c.status === 'dispatched').map((call) => (
                    <div key={call.id} className={`dispatch-job-card ${priorityClass(call.priority)}`}>
                      <div className="dispatch-job-header">
                        <span className="call-id">#{call.id}</span>
                        {call.job_code && <span className="call-code">{call.job_code}</span>}
                        <span className={`priority-badge ${priorityClass(call.priority)}`}>{PRIORITY_LABELS[call.priority] || call.priority}</span>
                      </div>
                      <div className="dispatch-job-title">{call.title || 'Untitled'}</div>
                      <div className="dispatch-job-loc">{call.location || 'No location'}</div>
                      {call.description && <div className="dispatch-job-desc">{call.description}</div>}
                      <div className="dispatch-job-actions">
                        <select defaultValue="" onChange={(e) => { handleAssign(call.id, e.target.value); e.target.selectedIndex = 0; }}>
                          <option value="">Assign unit...</option>
                          {units.map((u) => <option key={u.id} value={u.id}>{u.callsign} - {u.name}</option>)}
                        </select>
                        <div className="assigned-units">
                          {call.units.map((u) => (
                            <button key={u.id} type="button" className="tag" onClick={() => handleUnassign(call.id, u.id)}>{u.callsign}</button>
                          ))}
                        </div>
                      </div>
                      <div className="dispatch-job-btns">
                        <button type="button" className="btn-sm ghost" onClick={() => handleUpdateCallStatus(call.id, 'dispatched')}>Dispatch</button>
                        <button type="button" className="btn-sm ghost" onClick={() => handleUpdateCallStatus(call.id, 'enroute')}>En-Route</button>
                        <button type="button" className="btn-sm ghost" onClick={() => handleUpdateCallStatus(call.id, 'on-scene')}>On Scene</button>
                        <button type="button" className="btn-sm ghost" onClick={() => handleUpdateCallStatus(call.id, 'closed')}>Close</button>
                      </div>
                    </div>
                  ))}
                  {calls.filter((c) => c.status === 'open' || c.status === 'dispatched').length === 0 && <div className="empty">No pending jobs</div>}
                </div>
              </section>

              {/* Available Units Column */}
              <section className="card dispatch-col">
                <h2>Available Units ({units.length})</h2>
                <div className="dispatch-unit-list">
                  {units.map((unit) => (
                    <div key={unit.user_id} className={`dispatch-unit-row${unit.status === '9' ? ' urgent' : ''}`}>
                      <div className="dispatch-unit-cs">{unit.callsign}</div>
                      <div className="dispatch-unit-info">
                        <span className="unit-name">{unit.name}</span>
                        <span className="unit-dept">{unit.department || 'N/A'}</span>
                      </div>
                      <span className={`status-badge status-${unit.status}`}>{statusShort(unit.status)}</span>
                      <span className="unit-location">{unit.location || ''}</span>
                    </div>
                  ))}
                  {!units.length && <div className="empty">No units on duty</div>}
                </div>
              </section>
            </div>

            {/* Quick Create Job */}
            <section className="card">
              <h2>Quick Dispatch</h2>
              <form onSubmit={handleCreateCall} className="form form-row">
                <label>
                  Job Code
                  <select value={callJobCode} onChange={(e) => setCallJobCode(e.target.value)}>
                    {JOB_CODES.map((jc) => <option key={jc.value} value={jc.value}>{jc.label}</option>)}
                  </select>
                </label>
                <label>Title<input value={callTitle} onChange={(e) => setCallTitle(e.target.value)} placeholder="Armed holdup at servo" /></label>
                <label>
                  Priority
                  <select value={callPriority} onChange={(e) => setCallPriority(e.target.value)}>
                    {Object.entries(PRIORITY_LABELS).map(([val, lbl]) => (<option key={val} value={val}>{lbl}</option>))}
                  </select>
                </label>
                <label>Location<input value={callLocation} onChange={(e) => setCallLocation(e.target.value)} placeholder="Bourke St Mall" /></label>
                <label className="span-2">Description<input value={callDescription} onChange={(e) => setCallDescription(e.target.value)} placeholder="Caller reports..." /></label>
                <button type="submit">Create & Dispatch</button>
              </form>
            </section>
          </div>
        )}

        {/* ===== JOBS ===== */}
        {tab === 'calls' && (
          <div className="tab-content">
            <section className="card">
              <h2>Create Job</h2>
              <form onSubmit={handleCreateCall} className="form form-row">
                <label>
                  Job Code
                  <select value={callJobCode} onChange={(e) => setCallJobCode(e.target.value)}>
                    {JOB_CODES.map((jc) => <option key={jc.value} value={jc.value}>{jc.label}</option>)}
                  </select>
                </label>
                <label>Title<input value={callTitle} onChange={(e) => setCallTitle(e.target.value)} placeholder="Armed holdup at servo" /></label>
                <label>
                  Priority
                  <select value={callPriority} onChange={(e) => setCallPriority(e.target.value)}>
                    {Object.entries(PRIORITY_LABELS).map(([val, lbl]) => (<option key={val} value={val}>{lbl}</option>))}
                  </select>
                </label>
                <label>Location<input value={callLocation} onChange={(e) => setCallLocation(e.target.value)} placeholder="Bourke St Mall" /></label>
                <label className="span-2">Description<input value={callDescription} onChange={(e) => setCallDescription(e.target.value)} placeholder="Caller reports..." /></label>
                <button type="submit">Create Job</button>
              </form>
            </section>

            <section className="card">
              <h2>Active Jobs</h2>
              <div className="call-list">
                {calls.map((call) => (
                  <div key={call.id} className={`call-card ${priorityClass(call.priority)}`}>
                    <div className="call-header">
                      <div>
                        <span className="call-id">#{call.id}</span>
                        {call.job_code && <span className="call-code">{call.job_code}</span>}
                        <span className="call-title">{call.title}</span>
                      </div>
                      <div className="call-badges">
                        <span className={`priority-badge ${priorityClass(call.priority)}`}>{PRIORITY_LABELS[call.priority] || call.priority}</span>
                        <span className={`response-badge ${call.priority === '1' || call.priority === '2' ? 'code-red' : 'code-blue'}`}>{responseCode(call.priority)}</span>
                      </div>
                    </div>
                    <div className="call-meta">
                      <span>Status: {call.status}</span>
                      <span>Location: {call.location || 'N/A'}</span>
                    </div>
                    {call.description && <div className="call-desc">{call.description}</div>}
                    <div className="call-assign">
                      <select defaultValue="" onChange={(e) => { handleAssign(call.id, e.target.value); e.target.selectedIndex = 0; }}>
                        <option value="">Assign unit...</option>
                        {units.map((u) => <option key={u.id} value={u.id}>{u.callsign} - {u.name}</option>)}
                      </select>
                      <div className="assigned-units">
                        {call.units.map((u) => (
                          <button key={u.id} type="button" className="tag" onClick={() => handleUnassign(call.id, u.id)}>{u.callsign}</button>
                        ))}
                        {!call.units.length && <span className="empty-sm">No units</span>}
                      </div>
                    </div>
                    <div className="call-actions">
                      <button type="button" className="btn-sm ghost" onClick={() => handleUpdateCallStatus(call.id, 'dispatched')}>Dispatched</button>
                      <button type="button" className="btn-sm ghost" onClick={() => handleUpdateCallStatus(call.id, 'enroute')}>En-Route</button>
                      <button type="button" className="btn-sm ghost" onClick={() => handleUpdateCallStatus(call.id, 'on-scene')}>On Scene</button>
                      <button type="button" className="btn-sm ghost" onClick={() => handleUpdateCallStatus(call.id, 'finalised')}>Finalised</button>
                      <button type="button" className="btn-sm ghost" onClick={() => handleUpdateCallStatus(call.id, 'closed')}>Closed</button>
                    </div>
                  </div>
                ))}
                {!calls.length && <div className="empty">No active jobs</div>}
              </div>
            </section>
          </div>
        )}

        {/* ===== ADMIN PANEL ===== */}
        {tab === 'admin' && isAdmin && (
          <div className="tab-content">
            <div className="admin-tabs">
              {ADMIN_TABS.map((at) => (
                <button
                  key={at.id}
                  className={`admin-tab-btn${adminTab === at.id ? ' active' : ''}`}
                  onClick={() => setAdminTab(at.id)}
                >
                  {at.label}
                </button>
              ))}
            </div>

            {/* Users */}
            {adminTab === 'users' && (
              <>
                <section className="card">
                  <h2>Create User</h2>
                  <form onSubmit={handleAdminCreateUser} className="form form-row">
                    <label>Username<input value={adminNewUsername} onChange={(e) => setAdminNewUsername(e.target.value)} placeholder="new_user" /></label>
                    <label>Password<input value={adminNewPassword} onChange={(e) => setAdminNewPassword(e.target.value)} placeholder="password" /></label>
                    <label>
                      Role
                      <select value={adminNewRole} onChange={(e) => setAdminNewRole(e.target.value)}>
                        <option value="dispatcher">Dispatcher</option>
                        <option value="admin">Admin</option>
                      </select>
                    </label>
                    <button type="submit">Create User</button>
                  </form>
                </section>

                <section className="card">
                  <h2>Users & Departments</h2>
                  <div className="admin-user-list">
                    {adminUsers.map((au) => (
                      <div key={au.id} className="admin-user-card">
                        <div className="admin-user-header">
                          <span className="admin-user-name">{au.username}</span>
                          <span className={`badge ${au.role === 'admin' ? 'badge-admin' : ''}`}>{au.role}</span>
                          <div className="admin-user-actions">
                            <select value={au.role} onChange={(e) => handleAdminUpdateRole(au.id, e.target.value)} className="admin-role-select">
                              <option value="dispatcher">dispatcher</option>
                              <option value="admin">admin</option>
                            </select>
                            {adminResetPwUserId === au.id ? (
                              <div className="admin-reset-pw">
                                <input value={adminResetPwValue} onChange={(e) => setAdminResetPwValue(e.target.value)} placeholder="New password" className="admin-pw-input" />
                                <button className="btn-sm" onClick={() => handleAdminResetPassword(au.id)}>Set</button>
                                <button className="btn-sm ghost" onClick={() => setAdminResetPwUserId(null)}>Cancel</button>
                              </div>
                            ) : (
                              <button className="btn-sm ghost" onClick={() => setAdminResetPwUserId(au.id)}>Reset PW</button>
                            )}
                            <button className="btn-sm btn-danger" onClick={() => handleAdminDeleteUser(au.id)}>Delete</button>
                          </div>
                        </div>
                        <div className="admin-dept-section">
                          <span className="admin-dept-label">Departments:</span>
                          <div className="admin-dept-chips">
                            {activeServices.map((svc) => (
                              <div key={svc.id} className="admin-dept-service-group">
                                <span className="admin-dept-service-name" style={{ color: svc.color }}>{svc.short}</span>
                                {svc.departments.map((dept) => (
                                  <button
                                    key={dept}
                                    type="button"
                                    className={`dept-chip ${(adminEditDepts[au.id] || []).includes(dept) ? 'dept-chip-active' : ''}`}
                                    onClick={() => toggleAdminDept(au.id, dept)}
                                  >
                                    {dept}
                                  </button>
                                ))}
                              </div>
                            ))}
                          </div>
                          <button className="btn-sm" onClick={() => handleAdminSaveDepts(au.id)} style={{ marginTop: '6px' }}>Save Departments</button>
                        </div>
                      </div>
                    ))}
                    {!adminUsers.length && <div className="empty">No users found</div>}
                  </div>
                </section>
              </>
            )}

            {/* Active Units Oversight */}
            {adminTab === 'units' && (
              <section className="card">
                <h2>Active Units ({units.length})</h2>
                <p className="hint">View and manage all active units. Force status changes or kick units off duty.</p>
                <div className="admin-unit-list">
                  {units.map((unit) => (
                    <div key={unit.user_id} className={`admin-unit-row${unit.status === '9' ? ' urgent' : ''}`}>
                      <div className="admin-unit-info">
                        <span className="unit-callsign">{unit.callsign}</span>
                        <span className="unit-name">{unit.name}</span>
                        <span className="unit-dept">{unit.department}</span>
                      </div>
                      <div className="admin-unit-meta">
                        <span className={`status-badge status-${unit.status}`}>{statusShort(unit.status)}</span>
                        <span className="unit-location">{unit.location || ''}</span>
                      </div>
                      <div className="admin-unit-actions">
                        <select
                          value={unit.status}
                          onChange={(e) => handleAdminSetUnitStatus(unit.user_id, e.target.value)}
                          className="admin-role-select"
                        >
                          {Object.entries(STATUS_LABELS).map(([val, lbl]) => (
                            <option key={val} value={val}>{lbl}</option>
                          ))}
                        </select>
                        <button className="btn-sm btn-danger" onClick={() => handleAdminKickUnit(unit.user_id)}>Kick</button>
                      </div>
                    </div>
                  ))}
                  {!units.length && <div className="empty">No active units</div>}
                </div>
              </section>
            )}

            {/* Services CMS - Full Management */}
            {adminTab === 'services' && (
              <section className="card">
                <h2>Community Management — Services</h2>
                <p className="hint">Manage services, departments, logos, and colours. Changes apply immediately across the CAD.</p>

                {/* Add New Service Form */}
                <details className="cms-add-section">
                  <summary className="cms-add-summary">+ Add New Service</summary>
                  <form className="form cms-add-form" onSubmit={async (e) => {
                    e.preventDefault();
                    if (!cmsNewService.service_id || !cmsNewService.name) return;
                    try {
                      await createCmsService(cmsNewService);
                      setCmsNewService({ service_id: '', name: '', short_name: '', color: '#444444', logo_path: '' });
                      const updated = await getCmsServices();
                      setCmsServices(updated);
                    } catch (err) {
                      setError(err.message);
                    }
                  }}>
                    <div className="cms-form-grid">
                      <label>Service ID<input value={cmsNewService.service_id} onChange={(e) => setCmsNewService({ ...cmsNewService, service_id: e.target.value })} placeholder="e.g. vicpol" required /></label>
                      <label>Full Name<input value={cmsNewService.name} onChange={(e) => setCmsNewService({ ...cmsNewService, name: e.target.value })} placeholder="e.g. Victoria Police" required /></label>
                      <label>Short Name<input value={cmsNewService.short_name} onChange={(e) => setCmsNewService({ ...cmsNewService, short_name: e.target.value })} placeholder="e.g. VicPol" /></label>
                      <label>Colour<div className="cms-color-input"><input type="color" value={cmsNewService.color} onChange={(e) => setCmsNewService({ ...cmsNewService, color: e.target.value })} /><span>{cmsNewService.color}</span></div></label>
                      <label>Logo Path<input value={cmsNewService.logo_path} onChange={(e) => setCmsNewService({ ...cmsNewService, logo_path: e.target.value })} placeholder="/assets/logos/example.svg" /></label>
                    </div>
                    <button type="submit">Create Service</button>
                  </form>
                </details>

                {/* CMS Settings */}
                <details className="cms-add-section" style={{ marginTop: '12px' }}>
                  <summary className="cms-add-summary">⚙ CAD Settings</summary>
                  <div className="cms-settings-panel">
                    <form className="form cms-add-form" onSubmit={async (e) => {
                      e.preventDefault();
                      if (!cmsSettingKey) return;
                      try {
                        await updateCmsSettings({ [cmsSettingKey]: cmsSettingValue });
                        setCmsSettingKey('');
                        setCmsSettingValue('');
                        const updated = await getCmsSettings();
                        setCmsSettings(updated);
                      } catch (err) {
                        setError(err.message);
                      }
                    }}>
                      <div className="cms-form-grid">
                        <label>Key<input value={cmsSettingKey} onChange={(e) => setCmsSettingKey(e.target.value)} placeholder="server_name" /></label>
                        <label>Value<input value={cmsSettingValue} onChange={(e) => setCmsSettingValue(e.target.value)} placeholder="My CAD Server" /></label>
                      </div>
                      <button type="submit">Save Setting</button>
                    </form>
                    {Object.keys(cmsSettings).length > 0 && (
                      <div className="cms-settings-list">
                        {Object.entries(cmsSettings).map(([k, v]) => (
                          <div key={k} className="cms-setting-row">
                            <code className="cms-setting-key">{k}</code>
                            <span className="cms-setting-val">{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>

                {/* External DB Mapping */}
                <details className="cms-add-section" style={{ marginTop: '12px' }}>
                  <summary className="cms-add-summary">External DB Mapping</summary>
                  <div className="cms-settings-panel">
                    <form className="form cms-add-form" onSubmit={handleSaveExternalDbConfig}>
                      <div className="cms-form-grid">
                        <label>
                          Enabled
                          <select
                            value={externalDbConfig.enabled ? 'true' : 'false'}
                            onChange={(e) => setExternalDbConfig((prev) => ({ ...prev, enabled: e.target.value === 'true' }))}
                          >
                            <option value="false">Disabled</option>
                            <option value="true">Enabled</option>
                          </select>
                        </label>
                        <label>DB Host<input value={externalDbConfig.host} onChange={(e) => setExternalDbConfig((prev) => ({ ...prev, host: e.target.value }))} placeholder="127.0.0.1" /></label>
                        <label>DB Port<input value={externalDbConfig.port} onChange={(e) => setExternalDbConfig((prev) => ({ ...prev, port: e.target.value }))} placeholder="3306" /></label>
                        <label>DB Name<input value={externalDbConfig.database} onChange={(e) => setExternalDbConfig((prev) => ({ ...prev, database: e.target.value }))} placeholder="qbox" /></label>
                        <label>DB User<input value={externalDbConfig.user} onChange={(e) => setExternalDbConfig((prev) => ({ ...prev, user: e.target.value }))} placeholder="root" /></label>
                        <label>DB Password<input type="password" value={externalDbConfig.password} onChange={(e) => setExternalDbConfig((prev) => ({ ...prev, password: e.target.value }))} placeholder="password" /></label>
                      </div>

                      <h3 style={{ marginTop: '10px' }}>Character Bindings</h3>
                      <div className="cms-form-grid">
                        <label>Table<input value={externalDbConfig.character_table} onChange={(e) => setExternalDbConfig((prev) => ({ ...prev, character_table: e.target.value }))} placeholder="players" /></label>
                        <label>ID Field<input value={externalDbConfig.character_id_field} onChange={(e) => setExternalDbConfig((prev) => ({ ...prev, character_id_field: e.target.value }))} placeholder="citizenid" /></label>
                        <label>First Name Field<input value={externalDbConfig.character_firstname_field} onChange={(e) => setExternalDbConfig((prev) => ({ ...prev, character_firstname_field: e.target.value }))} placeholder="firstname (leave blank to use JSON)" /></label>
                        <label>Last Name Field<input value={externalDbConfig.character_lastname_field} onChange={(e) => setExternalDbConfig((prev) => ({ ...prev, character_lastname_field: e.target.value }))} placeholder="lastname (leave blank to use JSON)" /></label>
                        <label>Birthdate Field<input value={externalDbConfig.character_birthdate_field} onChange={(e) => setExternalDbConfig((prev) => ({ ...prev, character_birthdate_field: e.target.value }))} placeholder="birthdate (optional)" /></label>
                        <label>Phone Field<input value={externalDbConfig.character_phone_field} onChange={(e) => setExternalDbConfig((prev) => ({ ...prev, character_phone_field: e.target.value }))} placeholder="phone (optional)" /></label>
                        <label>JSON Field<input value={externalDbConfig.character_json_field} onChange={(e) => setExternalDbConfig((prev) => ({ ...prev, character_json_field: e.target.value }))} placeholder="charinfo" /></label>
                        <label>JSON First Name Path<input value={externalDbConfig.character_json_firstname_path} onChange={(e) => setExternalDbConfig((prev) => ({ ...prev, character_json_firstname_path: e.target.value }))} placeholder="$.firstname" /></label>
                        <label>JSON Last Name Path<input value={externalDbConfig.character_json_lastname_path} onChange={(e) => setExternalDbConfig((prev) => ({ ...prev, character_json_lastname_path: e.target.value }))} placeholder="$.lastname" /></label>
                        <label>JSON Birthdate Path<input value={externalDbConfig.character_json_birthdate_path} onChange={(e) => setExternalDbConfig((prev) => ({ ...prev, character_json_birthdate_path: e.target.value }))} placeholder="$.birthdate" /></label>
                        <label>JSON Phone Path<input value={externalDbConfig.character_json_phone_path} onChange={(e) => setExternalDbConfig((prev) => ({ ...prev, character_json_phone_path: e.target.value }))} placeholder="$.phone" /></label>
                      </div>

                      <h3 style={{ marginTop: '10px' }}>Vehicle Bindings</h3>
                      <div className="cms-form-grid">
                        <label>Table<input value={externalDbConfig.vehicle_table} onChange={(e) => setExternalDbConfig((prev) => ({ ...prev, vehicle_table: e.target.value }))} placeholder="player_vehicles" /></label>
                        <label>Plate Field<input value={externalDbConfig.vehicle_plate_field} onChange={(e) => setExternalDbConfig((prev) => ({ ...prev, vehicle_plate_field: e.target.value }))} placeholder="plate" /></label>
                        <label>Model Field<input value={externalDbConfig.vehicle_model_field} onChange={(e) => setExternalDbConfig((prev) => ({ ...prev, vehicle_model_field: e.target.value }))} placeholder="vehicle" /></label>
                        <label>Owner Field<input value={externalDbConfig.vehicle_owner_field} onChange={(e) => setExternalDbConfig((prev) => ({ ...prev, vehicle_owner_field: e.target.value }))} placeholder="citizenid" /></label>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        <button type="submit">Save External DB Config</button>
                        <button type="button" className="ghost" onClick={handleTestExternalDbConfig}>Test Connection</button>
                      </div>
                    </form>
                  </div>
                </details>

                {/* Service List */}
                <div className="cms-services-list" style={{ marginTop: '16px' }}>
                  {cmsServices.map((svc) => (
                    <div key={svc.service_id} className={`cms-service-card ${!svc.enabled ? 'cms-service-disabled' : ''}`} style={{ '--svc-color': svc.color }}>
                      <div className="cms-service-header">
                        <div className="cms-service-logo">
                          <ServiceLogo serviceId={svc.service_id} size={40} alt={svc.name} />
                        </div>
                        <div className="cms-service-info">
                          {cmsEditService === svc.service_id ? (
                            <>
                              <input className="cms-inline-input" value={svc.name} onChange={(e) => setCmsServices((prev) => prev.map((s) => s.service_id === svc.service_id ? { ...s, name: e.target.value } : s))} />
                              <input className="cms-inline-input cms-inline-sm" value={svc.short_name} onChange={(e) => setCmsServices((prev) => prev.map((s) => s.service_id === svc.service_id ? { ...s, short_name: e.target.value } : s))} placeholder="Short" />
                            </>
                          ) : (
                            <>
                              <span className="cms-service-name">{svc.name}</span>
                              <span className="cms-service-short">{svc.short_name}</span>
                            </>
                          )}
                          <span className="cms-service-id">ID: {svc.service_id}</span>
                        </div>
                        {cmsEditService === svc.service_id ? (
                          <input type="color" value={svc.color} onChange={(e) => setCmsServices((prev) => prev.map((s) => s.service_id === svc.service_id ? { ...s, color: e.target.value } : s))} />
                        ) : (
                          <div className="cms-service-color" style={{ background: svc.color }} title={svc.color} />
                        )}
                      </div>

                      {cmsEditService === svc.service_id && (
                        <div className="cms-service-logo-path">
                          <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px' }}>
                            Logo Path:
                            <input className="cms-inline-input" value={svc.logo_path} onChange={(e) => setCmsServices((prev) => prev.map((s) => s.service_id === svc.service_id ? { ...s, logo_path: e.target.value } : s))} placeholder="/assets/logos/example.svg" />
                          </label>
                        </div>
                      )}

                      <div className="cms-service-depts">
                        <span className="cms-dept-heading">Departments ({(svc.departments || []).length}):</span>
                        <div className="cms-dept-chips">
                          {(svc.departments || []).map((d) => (
                            <span key={d.id} className={`cms-dept-chip ${!d.enabled ? 'cms-dept-disabled' : ''}`}>
                              {d.name}
                              {cmsEditService === svc.service_id && (
                                <button className="cms-dept-remove" title="Remove" onClick={async () => {
                                  try {
                                    await deleteCmsDepartment(d.id);
                                    const updated = await getCmsServices();
                                    setCmsServices(updated);
                                  } catch (err) { setError(err.message); }
                                }}>×</button>
                              )}
                            </span>
                          ))}
                        </div>
                        {cmsEditService === svc.service_id && (
                          <form className="cms-add-dept-form" onSubmit={async (e) => {
                            e.preventDefault();
                            if (!cmsNewDeptName.trim()) return;
                            try {
                              await addCmsDepartment(svc.service_id, { name: cmsNewDeptName.trim() });
                              setCmsNewDeptName('');
                              const updated = await getCmsServices();
                              setCmsServices(updated);
                            } catch (err) { setError(err.message); }
                          }}>
                            <input value={cmsNewDeptName} onChange={(e) => setCmsNewDeptName(e.target.value)} placeholder="New department name" />
                            <button type="submit" className="btn-sm">Add</button>
                          </form>
                        )}
                      </div>

                      <div className="cms-service-actions">
                        {cmsEditService === svc.service_id ? (
                          <>
                            <button className="btn-sm" onClick={async () => {
                              try {
                                await updateCmsService(svc.service_id, {
                                  name: svc.name,
                                  short_name: svc.short_name,
                                  color: svc.color,
                                  logo_path: svc.logo_path,
                                  enabled: svc.enabled,
                                });
                                setCmsEditService(null);
                                const updated = await getCmsServices();
                                setCmsServices(updated);
                              } catch (err) { setError(err.message); }
                            }}>Save</button>
                            <button className="btn-sm ghost" onClick={() => { setCmsEditService(null); getCmsServices().then(setCmsServices); }}>Cancel</button>
                            <button className="btn-sm" style={{ marginLeft: 'auto' }} onClick={async () => {
                              try {
                                await updateCmsService(svc.service_id, { enabled: !svc.enabled });
                                const updated = await getCmsServices();
                                setCmsServices(updated);
                              } catch (err) { setError(err.message); }
                            }}>{svc.enabled ? 'Disable' : 'Enable'}</button>
                            <button className="btn-sm btn-danger" onClick={async () => {
                              if (!confirm(`Delete "${svc.name}" and all its departments?`)) return;
                              try {
                                await deleteCmsService(svc.service_id);
                                setCmsEditService(null);
                                const updated = await getCmsServices();
                                setCmsServices(updated);
                              } catch (err) { setError(err.message); }
                            }}>Delete</button>
                          </>
                        ) : (
                          <button className="btn-sm" onClick={() => setCmsEditService(svc.service_id)}>Edit</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {cmsServices.length === 0 && <div className="empty">No services configured. Add one above.</div>}
                </div>
              </section>
            )}

            {/* Job Codes Management */}
            {adminTab === 'jobcodes' && (
              <section className="card">
                <h2>Custom Job Codes</h2>
                <p className="hint">Add custom job codes. When custom codes exist they replace the defaults.</p>
                <form onSubmit={handleCreateJobCode} className="form form-row">
                  <label>Code<input value={newJCCode} onChange={(e) => setNewJCCode(e.target.value)} placeholder="101" /></label>
                  <label>Label<input value={newJCLabel} onChange={(e) => setNewJCLabel(e.target.value)} placeholder="Homicide" /></label>
                  <button type="submit">Add Job Code</button>
                </form>
                <div className="admin-code-list">
                  {customJobCodes.map((jc) => (
                    <div key={jc.id} className="admin-code-row">
                      <span className="admin-code-code">{jc.code}</span>
                      <span className="admin-code-label">{jc.label}</span>
                      <button className="btn-sm btn-danger" onClick={() => handleDeleteJobCode(jc.id)}>Delete</button>
                    </div>
                  ))}
                  {!customJobCodes.length && <div className="empty">No custom job codes. Default codes are in use.</div>}
                </div>
              </section>
            )}

            {/* Status Codes Management */}
            {adminTab === 'statuscodes' && (
              <section className="card">
                <h2>Custom Status Codes</h2>
                <p className="hint">Add custom status codes. When custom codes exist they replace the defaults.</p>
                <form onSubmit={handleCreateStatusCode} className="form form-row">
                  <label>Code<input value={newSCCode} onChange={(e) => setNewSCCode(e.target.value)} placeholder="1" /></label>
                  <label>Label<input value={newSCLabel} onChange={(e) => setNewSCLabel(e.target.value)} placeholder="On Patrol" /></label>
                  <button type="submit">Add Status Code</button>
                </form>
                <div className="admin-code-list">
                  {customStatusCodes.map((sc) => (
                    <div key={sc.id} className="admin-code-row">
                      <span className="admin-code-code">{sc.code}</span>
                      <span className="admin-code-label">{sc.label}</span>
                      <button className="btn-sm btn-danger" onClick={() => handleDeleteStatusCode(sc.id)}>Delete</button>
                    </div>
                  ))}
                  {!customStatusCodes.length && <div className="empty">No custom status codes. Default codes are in use.</div>}
                </div>
              </section>
            )}

            {/* Job Sync */}
            {adminTab === 'jobsync' && (
              <section className="card">
                <h2>Job Sync Mappings</h2>
                <p className="hint">Map FiveM job names to CAD departments. When a player's job changes in-game, their CAD department will auto-update.</p>
                <form onSubmit={handleCreateJobSync} className="form form-row">
                  <label>FiveM Job Name<input value={jobSyncNewJob} onChange={(e) => setJobSyncNewJob(e.target.value)} placeholder="police" /></label>
                  <label>
                    CAD Department
                    <select value={jobSyncNewDept} onChange={(e) => setJobSyncNewDept(e.target.value)}>
                      <option value="">Select...</option>
                      {activeServices.map((svc) => (
                        <optgroup key={svc.id} label={svc.name}>
                          {svc.departments.map((d) => <option key={d} value={d}>{d}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <button type="submit">Add Mapping</button>
                </form>
                <div className="job-sync-list">
                  {jobSyncMappings.map((m) => (
                    <div key={m.id} className="job-sync-row">
                      <span className="job-sync-name">{m.job_name}</span>
                      <span className="job-sync-arrow">-&gt;</span>
                      <span className="job-sync-dept">{m.department}</span>
                      <button className="btn-sm ghost" onClick={() => handleDeleteJobSync(m.id)}>Remove</button>
                    </div>
                  ))}
                  {!jobSyncMappings.length && <div className="empty">No job sync mappings configured</div>}
                </div>
              </section>
            )}

            {/* Announcements */}
            {adminTab === 'announcements' && (
              <section className="card">
                <h2>Announcements / MOTD</h2>
                <p className="hint">Create announcements that appear on the dashboard. The most recent active announcement shows as a banner.</p>
                <form onSubmit={handleCreateAnnouncement} className="form form-row">
                  <label>Title<input value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} placeholder="Server maintenance" /></label>
                  <label className="span-2">Body<input value={annBody} onChange={(e) => setAnnBody(e.target.value)} placeholder="Details..." /></label>
                  <button type="submit">Create</button>
                </form>
                <div className="admin-code-list">
                  {adminAnnouncements.map((ann) => (
                    <div key={ann.id} className={`admin-code-row ${ann.active ? '' : 'admin-code-inactive'}`}>
                      <div className="admin-ann-content">
                        <span className="admin-ann-title">{ann.title}</span>
                        {ann.body && <span className="admin-ann-body">{ann.body}</span>}
                        <span className="admin-ann-meta">By {ann.created_by} &middot; {ann.created_at}</span>
                      </div>
                      {ann.active ? (
                        <button className="btn-sm btn-danger" onClick={() => handleDeleteAnnouncement(ann.id)}>Remove</button>
                      ) : (
                        <span className="badge">Removed</span>
                      )}
                    </div>
                  ))}
                  {!adminAnnouncements.length && <div className="empty">No announcements</div>}
                </div>
              </section>
            )}

            {/* Audit Log */}
            {adminTab === 'auditlog' && (
              <section className="card">
                <h2>Audit Log</h2>
                <p className="hint">Recent admin actions are logged here.</p>
                <div className="audit-log-list">
                  {auditLog.map((entry) => (
                    <div key={entry.id} className="audit-log-row">
                      <span className="audit-log-time">{entry.created_at}</span>
                      <span className="audit-log-user">{entry.username}</span>
                      <span className="audit-log-action">{entry.action}</span>
                      <span className="audit-log-detail">{entry.detail}</span>
                    </div>
                  ))}
                  {!auditLog.length && <div className="empty">No audit log entries</div>}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ===== MAP ===== */}
        {tab === 'map' && (
          <div className="tab-content">
            <section className="card map-card">
              <h2>Live Map</h2>
              <div className="map" style={{ backgroundImage: `url(${mapConfig.imageUrl})` }}>
                {unitPositions.map((unit) => {
                  const pos = toMapPosition(unit.coords);
                  if (!pos) return null;
                  return (<div key={unit.user_id} className="map-marker" style={pos}><span>{unit.callsign}</span></div>);
                })}
                {!unitPositions.some((u) => toMapPosition(u.coords)) && (<div className="map-empty">No live positions</div>)}
              </div>
            </section>
          </div>
        )}

        {/* ===== SEARCH ===== */}
        {tab === 'search' && (
          <div className="tab-content">
            <section className="card">
              <h2>LEAP Database Search</h2>
              <form onSubmit={handleSearch} className="form form-row">
                <label>
                  Search Type
                  <select value={searchType} onChange={(e) => setSearchType(e.target.value)}>
                    <option value="person">Person / LEAP</option>
                    <option value="vehicle">Vehicle / Plate</option>
                  </select>
                </label>
                <label className="span-2">
                  {searchType === 'person' ? 'Name or Citizen ID' : 'Plate, Vehicle, or Owner CID'}
                  <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={searchType === 'person' ? 'John Smith' : 'ABC123'} />
                </label>
                <button type="submit">Search</button>
              </form>
              {results.length > 0 && (
                <div className="search-results">
                  <h3>Person Results</h3>
                  {results.map((item) => (
                    <div key={item.citizenid} className="result-row">
                      <div className="result-name">{item.firstname} {item.lastname}</div>
                      <div className="result-meta">
                        <span>CID: {item.citizenid}</span>
                        <span>DOB: {item.birthdate || 'N/A'}</span>
                        <span>Phone: {item.phone || 'N/A'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {vehicleResults.length > 0 && (
                <div className="search-results">
                  <h3>Vehicle Results</h3>
                  {vehicleResults.map((item, i) => (
                    <div key={i} className="result-row">
                      <div className="result-name">{item.plate}</div>
                      <div className="result-meta">
                        <span>Vehicle: {item.vehicle}</span>
                        <span>Owner CID: {item.citizenid}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ===== BOLOs ===== */}
        {tab === 'bolos' && (
          <div className="tab-content">
            <section className="card">
              <h2>Create BOLO</h2>
              <form onSubmit={handleCreateBolo} className="form form-row">
                <label>
                  Type
                  <select value={boloType} onChange={(e) => setBoloType(e.target.value)}>
                    <option value="person">Person</option>
                    <option value="vehicle">Vehicle</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="span-2">Title<input value={boloTitle} onChange={(e) => setBoloTitle(e.target.value)} placeholder="Suspect description or plate" /></label>
                <label className="span-3">Description<input value={boloDescription} onChange={(e) => setBoloDescription(e.target.value)} placeholder="Details..." /></label>
                <button type="submit">Create BOLO</button>
              </form>
            </section>
            <section className="card">
              <h2>Active BOLOs ({bolos.length})</h2>
              <div className="bolo-list">
                {bolos.map((bolo) => (
                  <div key={bolo.id} className="bolo-card">
                    <div className="bolo-header">
                      <span className="bolo-type">{bolo.type}</span>
                      <span className="bolo-title">{bolo.title}</span>
                    </div>
                    {bolo.description && <div className="bolo-desc">{bolo.description}</div>}
                    <div className="bolo-footer">
                      <span>By: {bolo.created_by}</span>
                      <button type="button" className="btn-sm ghost" onClick={() => handleCancelBolo(bolo.id)}>Cancel</button>
                    </div>
                  </div>
                ))}
                {!bolos.length && <div className="empty">No active BOLOs</div>}
              </div>
            </section>
          </div>
        )}

        {/* ===== TEST PAGE ===== */}
        {tab === 'test' && (
          <div className="tab-content">
            <section className="card">
              <h2>Test Panel</h2>
              <p className="hint">Test all API functions without affecting live operations. Results appear in the log below.</p>
            </section>
            <div className="grid-2">
              <section className="card test-card">
                <h2>000 Emergency Calls</h2>
                <div className="form">
                  <label>Caller Name<input value={testEmCallerName} onChange={(e) => setTestEmCallerName(e.target.value)} /></label>
                  <label>Location<input value={testEmLocation} onChange={(e) => setTestEmLocation(e.target.value)} /></label>
                  <div className="actions">
                    <button type="button" onClick={() => testRun('Create 000 Call', () => createEmergencyCall({ caller_name: testEmCallerName, location: testEmLocation }))}>Create 000 Call</button>
                    <button type="button" className="ghost" onClick={() => testRun('List 000 Calls', getEmergencyCalls)}>List Calls</button>
                  </div>
                  <label>Call ID (for accept/complete)<input value={testEmCallId} onChange={(e) => setTestEmCallId(e.target.value)} placeholder="1" /></label>
                  <div className="actions">
                    <button type="button" className="ghost" onClick={() => testRun('Accept 000 Call #' + testEmCallId, () => acceptEmergencyCall(Number(testEmCallId)))}>Accept</button>
                    <button type="button" className="ghost" onClick={() => testRun('Complete 000 Call #' + testEmCallId, () => completeEmergencyCall(Number(testEmCallId)))}>Complete</button>
                  </div>
                </div>
              </section>
              <section className="card test-card">
                <h2>Units</h2>
                <div className="form">
                  <div className="actions">
                    <button type="button" className="ghost" onClick={() => testRun('Get My Unit', getMyUnit)}>My Unit</button>
                    <button type="button" className="ghost" onClick={() => testRun('List Units', getUnits)}>List All</button>
                    <button type="button" className="ghost" onClick={() => testRun('Unit Positions', getUnitPositions)}>Positions</button>
                  </div>
                  <button type="button" onClick={() => testRun('Sign On Duty (TestUnit)', () => setOnDuty({ callsign: 'TEST-1', name: 'Test User', department: 'General Duties' }))}>Sign On Duty (TEST-1)</button>
                  <button type="button" className="btn-danger" onClick={() => testRun('Sign Off Duty', setOffDuty)}>Sign Off Duty</button>
                </div>
              </section>
              <section className="card test-card">
                <h2>Jobs / Calls</h2>
                <div className="form">
                  <label>Title<input value={testCallTitle} onChange={(e) => setTestCallTitle(e.target.value)} /></label>
                  <label>Location<input value={testCallLoc} onChange={(e) => setTestCallLoc(e.target.value)} /></label>
                  <div className="actions">
                    <button type="button" onClick={() => testRun('Create Job', () => createCall({ title: testCallTitle, location: testCallLoc, priority: '3', description: 'Test job from test panel' }))}>Create Job</button>
                    <button type="button" className="ghost" onClick={() => testRun('List Jobs', getCalls)}>List All</button>
                  </div>
                </div>
              </section>
              <section className="card test-card">
                <h2>BOLOs</h2>
                <div className="form">
                  <label>Title<input value={testBoloTitle} onChange={(e) => setTestBoloTitle(e.target.value)} /></label>
                  <label>Description<input value={testBoloDesc} onChange={(e) => setTestBoloDesc(e.target.value)} /></label>
                  <div className="actions">
                    <button type="button" onClick={() => testRun('Create BOLO', () => createBolo({ type: 'person', title: testBoloTitle, description: testBoloDesc }))}>Create BOLO</button>
                    <button type="button" className="ghost" onClick={() => testRun('List BOLOs', getBolos)}>List All</button>
                  </div>
                </div>
              </section>
              <section className="card test-card">
                <h2>LEAP Search</h2>
                <div className="form">
                  <label>Search Term<input value={testSearchTerm} onChange={(e) => setTestSearchTerm(e.target.value)} placeholder="John" /></label>
                  <div className="actions">
                    <button type="button" onClick={() => testRun('Search Person', () => searchCharacters(testSearchTerm))}>Search Person</button>
                    <button type="button" className="ghost" onClick={() => testRun('Search Vehicle', () => searchVehicles(testSearchTerm))}>Search Vehicle</button>
                  </div>
                </div>
              </section>
              <section className="card test-card">
                <h2>Radio & Activity</h2>
                <div className="form">
                  <label>Channel<input value={testRadioCh} onChange={(e) => setTestRadioCh(e.target.value)} placeholder="1" inputMode="decimal" /></label>
                  <div className="actions">
                    <button type="button" className="ghost" onClick={() => testRun('Get Radio Activity', () => getRadioActivity())}>Activity Feed</button>
                    <button type="button" className="ghost" onClick={() => testRun('Channel ' + testRadioCh + ' Players', () => getChannelPlayers(Number(testRadioCh)))}>Channel Players</button>
                    <button type="button" className="ghost" onClick={() => testRun('Mumble Config', getMumbleConfig)}>Mumble Config</button>
                  </div>
                </div>
              </section>
            </div>
            <section className="card">
              <div className="test-log-header">
                <h2>Test Log</h2>
                <button type="button" className="btn-sm ghost" onClick={() => setTestLog([])}>Clear</button>
              </div>
              <div className="test-log">
                {testLog.length === 0 && <div className="empty">Run a test to see results here</div>}
                {testLog.slice().reverse().map((entry, i) => (
                  <div key={i} className={`test-log-entry test-${entry.status}`}>
                    <div className="test-log-meta">
                      <span className="test-log-time">{entry.ts}</span>
                      <span className={`test-log-status test-status-${entry.status}`}>
                        {entry.status === 'running' ? '\u23F3' : entry.status === 'ok' ? '\u2705' : '\u274C'}
                      </span>
                      <span className="test-log-label">{entry.label}</span>
                    </div>
                    {entry.result && (<pre className="test-log-result">{entry.result}</pre>)}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* ===== VHF RADIO POPUP ===== */}
      {radioPopupOpen && (
        <div className="vhf-radio" style={{ left: radioPopupPos.x, top: radioPopupPos.y }} ref={radioDragRef}>
          <div className="vhf-antenna" />
          <div className="vhf-top-housing" onMouseDown={handleRadioDragStart}>
            <div className="vhf-power-indicator">
              <div className={`vhf-power-led ${radioPowerOn ? 'led-on' : ''}`} />
            </div>
            <button className="vhf-close" onClick={() => setRadioPopupOpen(false)}>X</button>
          </div>
          <div className="vhf-screen">
            <div className="vhf-screen-inner">
              <div className="vhf-screen-row">
                <span className="vhf-screen-label">CH</span>
                <span className="vhf-screen-freq">{radioChannel || '---'}</span>
                <span className="vhf-screen-mhz">MHz</span>
              </div>
              <div className="vhf-screen-row vhf-screen-status">{radioChannel ? 'ON FREQ' : 'NO CHANNEL'}</div>
              <div className="vhf-screen-row vhf-screen-unit">
                {(() => {
                  const unit = units.find((u) => String(u.user_id) === String(radioUnitId));
                  return unit ? `${unit.callsign}` : 'NO UNIT';
                })()}
              </div>
            </div>
          </div>
          <div className="vhf-selector-section">
            <select value={radioUnitId} onChange={(e) => setRadioUnitId(e.target.value)} className="vhf-select">
              <option value="">Select unit...</option>
              {units.map((unit) => (<option key={unit.user_id} value={unit.user_id}>{unit.callsign} - {unit.name}</option>))}
            </select>
          </div>
          <div className="vhf-keypad">
            <div className="vhf-freq-display">
              <span className="vhf-freq-input-text">{radioFreqInput || '_'}</span>
            </div>
            {['1','2','3','4','5','6','7','8','9','.','0','CLR'].map((key) => (
              <button key={key} className={`vhf-key ${key === 'CLR' ? 'vhf-key-clr' : ''}`} onClick={() => handleRadioKeypad(key)}>{key}</button>
            ))}
          </div>
          <div className="vhf-actions">
            <button className="vhf-btn-join" onClick={(e) => { e.preventDefault(); if (radioFreqInput) setRadioChannel(radioFreqInput); handleRadioJoin(e); }}>JOIN</button>
            <button className="vhf-btn-leave" onClick={() => handleRadioLeave()}>LEAVE</button>
          </div>
          <div className="vhf-volume-section">
            <span className="vhf-vol-label">VOL</span>
            <input type="range" min="0" max="100" value={radioVolume} onChange={(e) => setRadioVolume(Number(e.target.value))} className="vhf-volume-slider" />
            <span className="vhf-vol-value">{radioVolume}</span>
          </div>
          <div className="vhf-activity">
            <div className="vhf-activity-header">ACTIVITY LOG</div>
            <div className="vhf-activity-feed">
              {radioActivityFeed.length === 0 && <div className="vhf-activity-empty">NO TRAFFIC</div>}
              {radioActivityFeed.slice(-10).reverse().map((entry, i) => (
                <div key={i} className="vhf-activity-entry">
                  <span className="vhf-activity-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  <span className="vhf-activity-cs">{entry.callsign}</span>
                  <span className="vhf-activity-action">{entry.action === 'transmit_start' ? 'TX' : entry.action === 'transmit_end' ? 'END' : entry.action}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="vhf-grip">
            <div className="vhf-grip-line" />
            <div className="vhf-grip-line" />
            <div className="vhf-grip-line" />
          </div>
        </div>
      )}
    </div>
  );
}
