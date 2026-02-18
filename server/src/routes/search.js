const express = require('express');
const { requireAuth } = require('../auth/middleware');
const {
  CriminalRecords,
  Warrants,
  Bolos,
  DriverLicenses,
  VehicleRegistrations,
} = require('../db/sqlite');
const { audit } = require('../utils/audit');
const qbox = require('../db/qbox');

const router = express.Router();
const DRIVER_LICENSE_STATUSES = new Set(['valid', 'suspended', 'disqualified', 'expired']);
const VEHICLE_REGISTRATION_STATUSES = new Set(['valid', 'suspended', 'revoked', 'expired']);

function normalizeDateOnly(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return '';
  return new Date(parsed).toISOString().slice(0, 10);
}

function normalizeStatus(value, allowedStatuses) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!allowedStatuses.has(normalized)) return '';
  return normalized;
}

function shouldForceExpired(expiryAt) {
  const normalized = normalizeDateOnly(expiryAt);
  if (!normalized) return false;
  const today = new Date().toISOString().slice(0, 10);
  return normalized <= today;
}

function splitFullName(fullName) {
  const normalized = String(fullName || '').trim();
  if (!normalized) return { firstname: '', lastname: '' };
  const parts = normalized.split(/\s+/);
  if (parts.length === 1) return { firstname: parts[0], lastname: '' };
  return {
    firstname: parts[0],
    lastname: parts.slice(1).join(' '),
  };
}

function findActivePersonBolos(req, citizenId, fullName) {
  const departmentId = req.user?.departments?.[0]?.id || 0;
  if (!departmentId) return [];
  const needleCitizen = String(citizenId || '').trim();
  const needleName = String(fullName || '').trim().toLowerCase();
  return Bolos.listByDepartment(departmentId, 'active')
    .filter((bolo) => {
      if (bolo.type !== 'person') return false;
      const hayTitle = String(bolo.title || '').toLowerCase();
      const hayDetails = String(bolo.details_json || '').toLowerCase();
      if (needleCitizen && hayDetails.includes(needleCitizen.toLowerCase())) return true;
      if (needleName && hayTitle.includes(needleName)) return true;
      return false;
    });
}

function buildCadPersonResponse(req, citizenId, license, fallbackName = '') {
  const cid = String(citizenId || '').trim();
  const fullName = String(license?.full_name || fallbackName || cid).trim();
  const names = splitFullName(fullName);
  const warrants = cid ? Warrants.findByCitizenId(cid, 'active') : [];
  const bolos = findActivePersonBolos(req, cid, fullName);
  return {
    citizenid: cid,
    firstname: names.firstname,
    lastname: names.lastname,
    full_name: fullName,
    birthdate: String(license?.date_of_birth || '').trim(),
    gender: String(license?.gender || '').trim(),
    has_warrant: warrants.length > 0,
    has_bolo: bolos.length > 0,
    warrant_count: warrants.length,
    bolo_count: bolos.length,
    warrants,
    bolos,
  };
}

function buildCadVehicleResponse(registration) {
  const reg = registration || {};
  return {
    plate: String(reg.plate || '').trim(),
    owner: String(reg.citizen_id || '').trim(),
    owner_name: String(reg.owner_name || '').trim(),
    vehicle: String(reg.vehicle_model || '').trim(),
    vehicle_model: String(reg.vehicle_model || '').trim(),
    vehicle_colour: String(reg.vehicle_colour || '').trim(),
    cad_registration: reg,
  };
}

// Search persons in QBox
router.get('/persons', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }
  try {
    const results = await qbox.searchCharacters(q.trim());

    // Add warrant and BOLO flags to each result
    const enrichedResults = results.map(person => {
      const warrants = Warrants.findByCitizenId(person.citizenid, 'active');
      const personBolos = Bolos.listByDepartment(req.user.departments[0]?.id || 0, 'active')
        .filter(bolo => bolo.type === 'person'
          && (bolo.title.toLowerCase().includes(`${person.firstname} ${person.lastname}`.toLowerCase())
            || String(bolo.details_json || '').includes(person.citizenid)));

      return {
        ...person,
        has_warrant: warrants.length > 0,
        has_bolo: personBolos.length > 0,
        warrant_count: warrants.length,
        bolo_count: personBolos.length,
      };
    });

    res.json(enrichedResults);
  } catch (err) {
    res.status(500).json({ error: 'Search failed', message: err.message });
  }
});

// Get a specific person by citizen ID
router.get('/persons/:citizenid', requireAuth, async (req, res) => {
  try {
    const person = await qbox.getCharacterById(req.params.citizenid);
    if (!person) return res.status(404).json({ error: 'Person not found' });

    // Add warrant and BOLO flags
    const warrants = Warrants.findByCitizenId(person.citizenid, 'active');
    const personBolos = Bolos.listByDepartment(req.user.departments[0]?.id || 0, 'active')
      .filter(bolo => bolo.type === 'person'
        && (bolo.title.toLowerCase().includes(`${person.firstname} ${person.lastname}`.toLowerCase())
          || String(bolo.details_json || '').includes(person.citizenid)));

    const enrichedPerson = {
      ...person,
      has_warrant: warrants.length > 0,
      has_bolo: personBolos.length > 0,
      warrant_count: warrants.length,
      bolo_count: personBolos.length,
      warrants,
      bolos: personBolos,
      cad_driver_license: DriverLicenses.findByCitizenId(person.citizenid),
      cad_vehicle_registrations: VehicleRegistrations.listByCitizenId(person.citizenid),
    };

    res.json(enrichedPerson);
  } catch (err) {
    res.status(500).json({ error: 'Lookup failed', message: err.message });
  }
});

// Get vehicles owned by a person
router.get('/persons/:citizenid/vehicles', requireAuth, async (req, res) => {
  try {
    const vehicles = await qbox.getVehiclesByOwner(req.params.citizenid);
    const enriched = Array.isArray(vehicles)
      ? vehicles.map((vehicle) => ({
          ...vehicle,
          cad_registration: VehicleRegistrations.findByPlate(vehicle?.plate || ''),
        }))
      : [];
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Lookup failed', message: err.message });
  }
});

// Get criminal records for a person
router.get('/persons/:citizenid/records', requireAuth, (req, res) => {
  const records = CriminalRecords.findByCitizenId(req.params.citizenid);
  res.json(records);
});

// Search vehicles in QBox
router.get('/vehicles', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }
  try {
    const results = await qbox.searchVehicles(q.trim());
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Search failed', message: err.message });
  }
});

// Get a specific vehicle by plate
router.get('/vehicles/:plate', requireAuth, async (req, res) => {
  const plate = String(req.params.plate || '').trim();
  if (!plate) return res.status(400).json({ error: 'plate is required' });
  try {
    const vehicle = await qbox.getVehicleByPlate(plate);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    res.json({
      ...vehicle,
      cad_registration: VehicleRegistrations.findByPlate(plate),
    });
  } catch (err) {
    res.status(500).json({ error: 'Lookup failed', message: err.message });
  }
});

// ============================================================================
// CAD-native search (driver_licenses + vehicle_registrations only)
// ============================================================================

router.get('/cad/persons', requireAuth, (req, res) => {
  const q = String(req.query?.q || '').trim();
  if (q.length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }

  try {
    const byCitizen = new Map();

    for (const license of DriverLicenses.search(q, 100)) {
      const citizenId = String(license?.citizen_id || '').trim();
      if (!citizenId) continue;
      byCitizen.set(citizenId, {
        ...buildCadPersonResponse(req, citizenId, license),
        cad_driver_license: license,
      });
    }

    // Include owners from registration records even when no license exists yet.
    for (const reg of VehicleRegistrations.search(q, 100)) {
      const citizenId = String(reg?.citizen_id || '').trim();
      if (!citizenId || byCitizen.has(citizenId)) continue;
      byCitizen.set(citizenId, {
        ...buildCadPersonResponse(req, citizenId, null, reg.owner_name || citizenId),
        cad_driver_license: null,
      });
    }

    res.json(Array.from(byCitizen.values()).slice(0, 100));
  } catch (err) {
    res.status(500).json({ error: 'Search failed', message: err.message });
  }
});

router.get('/cad/persons/:citizenid', requireAuth, (req, res) => {
  const citizenId = String(req.params.citizenid || '').trim();
  if (!citizenId) return res.status(400).json({ error: 'citizenid is required' });

  try {
    const license = DriverLicenses.findByCitizenId(citizenId);
    const registrations = VehicleRegistrations.listByCitizenId(citizenId);
    if (!license && registrations.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }

    const fallbackName = registrations[0]?.owner_name || citizenId;
    const person = buildCadPersonResponse(req, citizenId, license, fallbackName);
    res.json({
      ...person,
      cad_driver_license: license || null,
      cad_vehicle_registrations: registrations,
    });
  } catch (err) {
    res.status(500).json({ error: 'Lookup failed', message: err.message });
  }
});

router.get('/cad/persons/:citizenid/vehicles', requireAuth, (req, res) => {
  const citizenId = String(req.params.citizenid || '').trim();
  if (!citizenId) return res.status(400).json({ error: 'citizenid is required' });
  try {
    const registrations = VehicleRegistrations.listByCitizenId(citizenId);
    res.json(registrations.map((reg) => ({
      ...buildCadVehicleResponse(reg),
      cad_registration: reg,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Lookup failed', message: err.message });
  }
});

router.get('/cad/vehicles', requireAuth, (req, res) => {
  const q = String(req.query?.q || '').trim();
  if (q.length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }
  try {
    const results = VehicleRegistrations.search(q, 100).map((reg) => buildCadVehicleResponse(reg));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Search failed', message: err.message });
  }
});

router.get('/cad/vehicles/:plate', requireAuth, (req, res) => {
  const plate = String(req.params.plate || '').trim();
  if (!plate) return res.status(400).json({ error: 'plate is required' });
  try {
    const reg = VehicleRegistrations.findByPlate(plate);
    if (!reg) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(buildCadVehicleResponse(reg));
  } catch (err) {
    res.status(500).json({ error: 'Lookup failed', message: err.message });
  }
});

// Update CAD driver license status/expiry.
router.patch('/persons/:citizenid/license', requireAuth, (req, res) => {
  const citizenId = String(req.params.citizenid || '').trim();
  if (!citizenId) return res.status(400).json({ error: 'citizenid is required' });

  const existing = DriverLicenses.findByCitizenId(citizenId);
  if (!existing) return res.status(404).json({ error: 'Driver license not found' });

  const updates = {};
  if (req.body?.status !== undefined) {
    const status = normalizeStatus(req.body.status, DRIVER_LICENSE_STATUSES);
    if (!status) {
      return res.status(400).json({ error: 'status must be valid, suspended, disqualified, or expired' });
    }
    updates.status = status;
  }
  if (req.body?.expiry_at !== undefined) {
    const expiryAt = normalizeDateOnly(req.body.expiry_at);
    if (!expiryAt && String(req.body.expiry_at || '').trim() !== '') {
      return res.status(400).json({ error: 'expiry_at must be a valid date' });
    }
    updates.expiry_at = expiryAt || null;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid update fields supplied' });
  }

  updates.updated_by_user_id = req.user.id;
  let updated = DriverLicenses.update(existing.id, updates);
  if (updated && shouldForceExpired(updated.expiry_at)) {
    updated = DriverLicenses.update(existing.id, {
      status: 'expired',
      updated_by_user_id: req.user.id,
    });
  }

  audit(req.user.id, 'driver_license_updated', {
    citizen_id: citizenId,
    license_id: existing.id,
    updates,
  });

  res.json(updated);
});

// Update CAD vehicle registration status/expiry.
router.patch('/vehicles/:plate/registration', requireAuth, (req, res) => {
  const plate = String(req.params.plate || '').trim();
  if (!plate) return res.status(400).json({ error: 'plate is required' });

  const existing = VehicleRegistrations.findByPlate(plate);
  if (!existing) return res.status(404).json({ error: 'Vehicle registration not found' });

  const updates = {};
  if (req.body?.status !== undefined) {
    const status = normalizeStatus(req.body.status, VEHICLE_REGISTRATION_STATUSES);
    if (!status) {
      return res.status(400).json({ error: 'status must be valid, suspended, revoked, or expired' });
    }
    updates.status = status;
  }
  if (req.body?.expiry_at !== undefined) {
    const expiryAt = normalizeDateOnly(req.body.expiry_at);
    if (!expiryAt && String(req.body.expiry_at || '').trim() !== '') {
      return res.status(400).json({ error: 'expiry_at must be a valid date' });
    }
    updates.expiry_at = expiryAt || null;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid update fields supplied' });
  }

  updates.updated_by_user_id = req.user.id;
  let updated = VehicleRegistrations.update(existing.id, updates);
  if (updated && shouldForceExpired(updated.expiry_at)) {
    updated = VehicleRegistrations.update(existing.id, {
      status: 'expired',
      updated_by_user_id: req.user.id,
    });
  }

  audit(req.user.id, 'vehicle_registration_updated', {
    plate: existing.plate,
    registration_id: existing.id,
    updates,
  });

  res.json(updated);
});

module.exports = router;
