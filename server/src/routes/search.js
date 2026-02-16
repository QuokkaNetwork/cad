const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { CriminalRecords, Warrants, Bolos } = require('../db/sqlite');
const qbox = require('../db/qbox');

const router = express.Router();

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
        .filter(bolo => bolo.type === 'person' &&
          (bolo.title.toLowerCase().includes(`${person.firstname} ${person.lastname}`.toLowerCase()) ||
           String(bolo.details_json || '').includes(person.citizenid)));

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
      .filter(bolo => bolo.type === 'person' &&
        (bolo.title.toLowerCase().includes(`${person.firstname} ${person.lastname}`.toLowerCase()) ||
         String(bolo.details_json || '').includes(person.citizenid)));

    const enrichedPerson = {
      ...person,
      has_warrant: warrants.length > 0,
      has_bolo: personBolos.length > 0,
      warrant_count: warrants.length,
      bolo_count: personBolos.length,
      warrants,
      bolos: personBolos,
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
    res.json(vehicles);
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
    res.json(vehicle);
  } catch (err) {
    res.status(500).json({ error: 'Lookup failed', message: err.message });
  }
});

module.exports = router;
