const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { CriminalRecords, Units } = require('../db/sqlite');
const { audit } = require('../utils/audit');

const router = express.Router();

// List records (with optional citizen_id filter)
router.get('/', requireAuth, (req, res) => {
  const { citizen_id, limit, offset } = req.query;
  if (citizen_id) {
    const records = CriminalRecords.findByCitizenId(citizen_id);
    return res.json(records);
  }
  const records = CriminalRecords.list(
    parseInt(limit, 10) || 50,
    parseInt(offset, 10) || 0
  );
  res.json(records);
});

// Get a single record
router.get('/:id', requireAuth, (req, res) => {
  const record = CriminalRecords.findById(parseInt(req.params.id, 10));
  if (!record) return res.status(404).json({ error: 'Record not found' });
  res.json(record);
});

// Create a record
router.post('/', requireAuth, (req, res) => {
  const { citizen_id, type, title, description, fine_amount, department_id } = req.body;
  if (!citizen_id || !type || !title) {
    return res.status(400).json({ error: 'citizen_id, type, and title are required' });
  }
  if (!['charge', 'fine', 'warning'].includes(type)) {
    return res.status(400).json({ error: 'type must be charge, fine, or warning' });
  }

  // Auto-fill officer info from current unit
  const unit = Units.findByUserId(req.user.id);
  const officerName = req.user.steam_name;
  const officerCallsign = unit ? unit.callsign : '';

  const record = CriminalRecords.create({
    citizen_id,
    type,
    title,
    description: description || '',
    fine_amount: type === 'fine' ? (fine_amount || 0) : 0,
    officer_name: officerName,
    officer_callsign: officerCallsign,
    department_id: department_id || (unit ? unit.department_id : null),
  });

  audit(req.user.id, 'record_created', { recordId: record.id, citizen_id, type, title });
  res.status(201).json(record);
});

module.exports = router;
