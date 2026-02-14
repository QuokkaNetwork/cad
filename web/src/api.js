const TOKEN_KEY = 'cad_token';

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function login(username, password) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    throw new Error('Login failed');
  }

  return res.json();
}

async function authedFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(url, { ...options, headers });
}

export async function getMe() {
  const res = await authedFetch('/api/me');
  if (!res.ok) {
    throw new Error('Auth failed');
  }
  return res.json();
}

export async function searchCharacters(term) {
  const res = await authedFetch(`/api/characters?search=${encodeURIComponent(term)}`);
  if (!res.ok) {
    throw new Error('Search failed');
  }
  return res.json();
}

export async function searchVehicles(term) {
  const res = await authedFetch(`/api/vehicles?search=${encodeURIComponent(term)}`);
  if (!res.ok) {
    throw new Error('Vehicle search failed');
  }
  return res.json();
}

export async function getUnits() {
  const res = await authedFetch('/api/units');
  if (!res.ok) {
    throw new Error('Units fetch failed');
  }
  return res.json();
}

export async function getUnitPositions() {
  const res = await authedFetch('/api/units/positions');
  if (!res.ok) {
    throw new Error('Unit positions fetch failed');
  }
  return res.json();
}

export async function getMyUnit() {
  const res = await authedFetch('/api/units/me');
  if (!res.ok) {
    throw new Error('Unit fetch failed');
  }
  return res.json();
}

export async function setOnDuty(payload) {
  const res = await authedFetch('/api/units/me', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('On duty failed');
  }
  return res.json();
}

export async function updateMyUnit(payload) {
  const res = await authedFetch('/api/units/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Update failed');
  }
  return res.json();
}

export async function setOffDuty() {
  const res = await authedFetch('/api/units/me/offduty', { method: 'POST' });
  if (!res.ok) {
    throw new Error('Off duty failed');
  }
  return res.json();
}

export async function getCalls() {
  const res = await authedFetch('/api/calls');
  if (!res.ok) {
    throw new Error('Calls fetch failed');
  }
  return res.json();
}

export async function createCall(payload) {
  const res = await authedFetch('/api/calls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Create call failed');
  }
  return res.json();
}

export async function updateCall(callId, payload) {
  const res = await authedFetch(`/api/calls/${callId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Update call failed');
  }
  return res.json();
}

export async function assignUnit(callId, unitId) {
  const res = await authedFetch(`/api/calls/${callId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ unitId }),
  });
  if (!res.ok) {
    throw new Error('Assign failed');
  }
  return res.json();
}

export async function unassignUnit(callId, unitId) {
  const res = await authedFetch(`/api/calls/${callId}/unassign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ unitId }),
  });
  if (!res.ok) {
    throw new Error('Unassign failed');
  }
  return res.json();
}

export async function getBolos() {
  const res = await authedFetch('/api/bolos');
  if (!res.ok) {
    throw new Error('BOLOs fetch failed');
  }
  return res.json();
}

export async function createBolo(payload) {
  const res = await authedFetch('/api/bolos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Create BOLO failed');
  }
  return res.json();
}

export async function cancelBolo(boloId) {
  const res = await authedFetch(`/api/bolos/${boloId}/cancel`, { method: 'POST' });
  if (!res.ok) {
    throw new Error('Cancel BOLO failed');
  }
  return res.json();
}

export async function radioJoin(payload) {
  const res = await authedFetch('/api/radio/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Radio join failed');
  }
  return res.json();
}

export async function radioLeave(payload) {
  const res = await authedFetch('/api/radio/leave', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Radio leave failed');
  }
  return res.json();
}

// ===== Emergency 000 Calls =====

export async function getEmergencyCalls() {
  const res = await authedFetch('/api/emergency-calls');
  if (!res.ok) throw new Error('Emergency calls fetch failed');
  return res.json();
}

export async function createEmergencyCall(payload) {
  const res = await authedFetch('/api/emergency-calls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Create emergency call failed');
  return res.json();
}

export async function acceptEmergencyCall(callId) {
  const res = await authedFetch(`/api/emergency-calls/${callId}/accept`, {
    method: 'PATCH',
  });
  if (!res.ok) throw new Error('Accept emergency call failed');
  return res.json();
}

export async function completeEmergencyCall(callId) {
  const res = await authedFetch(`/api/emergency-calls/${callId}/complete`, {
    method: 'PATCH',
  });
  if (!res.ok) throw new Error('Complete emergency call failed');
  return res.json();
}

// ===== Radio Activity & Voice Bridge =====

export async function getRadioActivity(since) {
  const url = since
    ? `/api/radio/activity?since=${encodeURIComponent(since)}`
    : '/api/radio/activity';
  const res = await authedFetch(url);
  if (!res.ok) throw new Error('Radio activity fetch failed');
  return res.json();
}

export async function getChannelPlayers(channelId) {
  const res = await authedFetch(`/api/radio/channels/${channelId}/players`);
  if (!res.ok) throw new Error('Channel players fetch failed');
  return res.json();
}

export async function getMumbleConfig() {
  const res = await authedFetch('/api/radio/mumble-config');
  if (!res.ok) throw new Error('Mumble config fetch failed');
  return res.json();
}

// ===== User Departments =====

export async function getMyDepartments() {
  const res = await authedFetch('/api/me/departments');
  if (!res.ok) throw new Error('Departments fetch failed');
  return res.json();
}

// ===== Admin =====

export async function getAdminUsers() {
  const res = await authedFetch('/api/admin/users');
  if (!res.ok) throw new Error('Admin users fetch failed');
  return res.json();
}

export async function createAdminUser(payload) {
  const res = await authedFetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Create user failed');
  return res.json();
}

export async function deleteAdminUser(userId) {
  const res = await authedFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete user failed');
  return res.json();
}

export async function updateAdminUserRole(userId, role) {
  const res = await authedFetch(`/api/admin/users/${userId}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error('Update role failed');
  return res.json();
}

export async function resetAdminUserPassword(userId, password) {
  const res = await authedFetch(`/api/admin/users/${userId}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error('Reset password failed');
  return res.json();
}

export async function setAdminUserDepartments(userId, departments) {
  const res = await authedFetch(`/api/admin/users/${userId}/departments`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ departments }),
  });
  if (!res.ok) throw new Error('Set departments failed');
  return res.json();
}

// ===== Job Sync =====

export async function getJobSyncMappings() {
  const res = await authedFetch('/api/admin/job-sync');
  if (!res.ok) throw new Error('Job sync fetch failed');
  return res.json();
}

export async function createJobSyncMapping(payload) {
  const res = await authedFetch('/api/admin/job-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Create job sync failed');
  return res.json();
}

export async function deleteJobSyncMapping(id) {
  const res = await authedFetch(`/api/admin/job-sync/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete job sync failed');
  return res.json();
}

// ===== Announcements =====

export async function getAnnouncements() {
  const res = await authedFetch('/api/announcements');
  if (!res.ok) throw new Error('Announcements fetch failed');
  return res.json();
}

export async function getAdminAnnouncements() {
  const res = await authedFetch('/api/admin/announcements');
  if (!res.ok) throw new Error('Admin announcements fetch failed');
  return res.json();
}

export async function createAnnouncement(payload) {
  const res = await authedFetch('/api/admin/announcements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Create announcement failed');
  return res.json();
}

export async function deleteAnnouncement(id) {
  const res = await authedFetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete announcement failed');
  return res.json();
}

// ===== Audit Log =====

export async function getAuditLog(limit = 200) {
  const res = await authedFetch(`/api/admin/audit-log?limit=${limit}`);
  if (!res.ok) throw new Error('Audit log fetch failed');
  return res.json();
}

// ===== Custom Job Codes =====

export async function getCustomJobCodes() {
  const res = await authedFetch('/api/job-codes');
  if (!res.ok) throw new Error('Job codes fetch failed');
  return res.json();
}

export async function createCustomJobCode(payload) {
  const res = await authedFetch('/api/admin/job-codes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Create job code failed');
  return res.json();
}

export async function updateCustomJobCode(id, payload) {
  const res = await authedFetch(`/api/admin/job-codes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Update job code failed');
  return res.json();
}

export async function deleteCustomJobCode(id) {
  const res = await authedFetch(`/api/admin/job-codes/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete job code failed');
  return res.json();
}

// ===== Custom Status Codes =====

export async function getCustomStatusCodes() {
  const res = await authedFetch('/api/status-codes');
  if (!res.ok) throw new Error('Status codes fetch failed');
  return res.json();
}

export async function createCustomStatusCode(payload) {
  const res = await authedFetch('/api/admin/status-codes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Create status code failed');
  return res.json();
}

export async function updateCustomStatusCode(id, payload) {
  const res = await authedFetch(`/api/admin/status-codes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Update status code failed');
  return res.json();
}

export async function deleteCustomStatusCode(id) {
  const res = await authedFetch(`/api/admin/status-codes/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete status code failed');
  return res.json();
}

// ===== CMS Settings =====

export async function getCmsSettings() {
  const res = await authedFetch('/api/cms/settings');
  if (!res.ok) throw new Error('CMS settings fetch failed');
  return res.json();
}

export async function updateCmsSettings(settings) {
  const res = await authedFetch('/api/admin/cms/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings }),
  });
  if (!res.ok) throw new Error('Update CMS settings failed');
  return res.json();
}

// ===== CMS Services =====

export async function getCmsServices() {
  const res = await authedFetch('/api/cms/services');
  if (!res.ok) throw new Error('CMS services fetch failed');
  return res.json();
}

export async function createCmsService(payload) {
  const res = await authedFetch('/api/admin/cms/services', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Create CMS service failed');
  return res.json();
}

export async function updateCmsService(serviceId, payload) {
  const res = await authedFetch(`/api/admin/cms/services/${serviceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Update CMS service failed');
  return res.json();
}

export async function deleteCmsService(serviceId) {
  const res = await authedFetch(`/api/admin/cms/services/${serviceId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete CMS service failed');
  return res.json();
}

// ===== CMS Departments =====

export async function addCmsDepartment(serviceId, payload) {
  const res = await authedFetch(`/api/admin/cms/services/${serviceId}/departments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Add CMS department failed');
  return res.json();
}

export async function updateCmsDepartment(deptId, payload) {
  const res = await authedFetch(`/api/admin/cms/departments/${deptId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Update CMS department failed');
  return res.json();
}

export async function deleteCmsDepartment(deptId) {
  const res = await authedFetch(`/api/admin/cms/departments/${deptId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete CMS department failed');
  return res.json();
}

// ===== Admin Unit Oversight =====

export async function adminSetUnitStatus(userId, status) {
  const res = await authedFetch(`/api/admin/units/${userId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Set unit status failed');
  return res.json();
}

export async function adminKickUnit(userId) {
  const res = await authedFetch(`/api/admin/units/${userId}/kick`, { method: 'POST' });
  if (!res.ok) throw new Error('Kick unit failed');
  return res.json();
}
