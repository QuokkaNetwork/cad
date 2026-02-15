const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { CriminalRecords } = require('../db/sqlite');
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
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Search failed', message: err.message });
  }
});

// Get a specific person by citizen ID
router.get('/persons/:citizenid', requireAuth, async (req, res) => {
  try {
    const person = await qbox.getCharacterById(req.params.citizenid);
    if (!person) return res.status(404).json({ error: 'Person not found' });
    res.json(person);
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

module.exports = router;
