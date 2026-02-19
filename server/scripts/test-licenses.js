'use strict';
/**
 * Full end-to-end test for license creation and CAD search.
 * Run from the server/ directory:  node scripts/test-licenses.js
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const config = require('../src/config');

const BRIDGE_TOKEN = 'Ku3xaT6MVe+GgGC9qQu2bMbdqBEPY7cXCyRd3WISCjA=';
const AUTH_JWT = jwt.sign(
  { userId: 1, steamId: '76561198012345678', isAdmin: true },
  config.jwt.secret,
  { expiresIn: '1h' }
);

let passed = 0;
let failed = 0;

function pass(label, cond, extra) {
  if (cond) {
    console.log('  ✓ PASS', label);
    passed++;
  } else {
    console.log('  ✗ FAIL', label, extra !== undefined ? `(got: ${JSON.stringify(extra)})` : '');
    failed++;
    process.exitCode = 1;
  }
}

function request(method, path, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: '127.0.0.1',
      port: 3031,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...extraHeaders,
      },
    };
    const r = http.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function run() {
  const AH = { Authorization: `Bearer ${AUTH_JWT}` };
  const BH = { 'x-cad-bridge-token': BRIDGE_TOKEN };

  // ── Clean up any previous test records ──────────────────────────────────────
  // (idempotent — the upsert will just overwrite them)

  console.log('\n══ LICENSE CREATION TESTS ══════════════════════════════════════');

  // T1: Create a fresh license
  let r = await request('POST', '/api/integration/fivem/licenses', {
    citizenid: 'FINAL-001',
    full_name: 'John Final Test',
    date_of_birth: '1988-07-04',
    gender: 'male',
    license_classes: ['C', 'R'],
    expiry_days: 365,
    identifiers: [],
  }, BH);
  pass('T1  Create license → 201', r.status === 201, r.status);
  const lic1 = JSON.parse(r.body).license;
  pass('T1  Returns license object', !!lic1 && typeof lic1 === 'object');
  pass('T1  citizen_id correct', lic1?.citizen_id === 'FINAL-001', lic1?.citizen_id);
  pass('T1  full_name correct', lic1?.full_name === 'John Final Test', lic1?.full_name);
  pass('T1  status is valid', lic1?.status === 'valid', lic1?.status);
  pass('T1  classes correct', JSON.stringify(lic1?.license_classes) === '["C","R"]', lic1?.license_classes);
  pass('T1  expiry_at set (1yr)', !!lic1?.expiry_at);

  // T2: Upsert — update classes (should ALWAYS work regardless of expiry window)
  r = await request('POST', '/api/integration/fivem/licenses', {
    citizenid: 'FINAL-001',
    full_name: 'John Final Test',
    date_of_birth: '1988-07-04',
    gender: 'male',
    license_classes: ['C', 'R', 'MC', 'HT'],
    expiry_days: 365,
    identifiers: [],
  }, BH);
  pass('T2  Re-submit/upsert → 201', r.status === 201, r.status);
  const lic2 = JSON.parse(r.body).license;
  pass('T2  Classes updated to 4', lic2?.license_classes?.length === 4, lic2?.license_classes);
  pass('T2  Has MC class', lic2?.license_classes?.includes('MC'));
  pass('T2  Has HT class', lic2?.license_classes?.includes('HT'));

  // T3: GET license by citizenid via bridge
  r = await request('GET', '/api/integration/fivem/licenses/FINAL-001', null, BH);
  pass('T3  GET license by citizenid → 200', r.status === 200, r.status);
  const lic3 = JSON.parse(r.body).license;
  pass('T3  Has MC class from upsert', lic3?.license_classes?.includes('MC'));
  pass('T3  full_name persisted', lic3?.full_name === 'John Final Test', lic3?.full_name);

  // T4: Missing gender → 400
  r = await request('POST', '/api/integration/fivem/licenses', {
    citizenid: 'FINAL-002',
    full_name: 'Bob Test',
    date_of_birth: '1990-01-01',
    gender: '',
    license_classes: ['C'],
  }, BH);
  pass('T4  Missing gender → 400', r.status === 400, r.status);
  pass('T4  Error message meaningful', r.body.includes('gender'), r.body);

  // T5: Missing citizenid → 400
  r = await request('POST', '/api/integration/fivem/licenses', {
    full_name: 'Bob Test',
    date_of_birth: '1990-01-01',
    gender: 'male',
    license_classes: ['C'],
  }, BH);
  pass('T5  Missing citizenid → 400', r.status === 400, r.status);
  pass('T5  Error message mentions citizenid', r.body.includes('citizenid'), r.body);

  // T6: No auth token → 401
  r = await request('POST', '/api/integration/fivem/licenses', {
    citizenid: 'FINAL-003',
    full_name: 'Hacker',
    date_of_birth: '2000-01-01',
    gender: 'male',
    license_classes: ['C'],
  }, {});
  pass('T6  No auth token → 401', r.status === 401, r.status);

  // T7: GET nonexistent license → 404
  r = await request('GET', '/api/integration/fivem/licenses/DOESNOTEXIST-99999', null, BH);
  pass('T7  GET nonexistent → 404', r.status === 404, r.status);

  // T8: Second fresh citizen for cross-search tests
  r = await request('POST', '/api/integration/fivem/licenses', {
    citizenid: 'FINAL-002',
    full_name: 'Bob Findable',
    date_of_birth: '1995-03-15',
    gender: 'male',
    license_classes: ['C', 'HT'],
    expiry_days: 365,
    identifiers: [],
  }, BH);
  pass('T8  Create second license (FINAL-002) → 201', r.status === 201, r.status);

  console.log('\n══ SEARCH TESTS ════════════════════════════════════════════════');

  // T9: Search by full name → returns person with correct name and license
  r = await request('GET', '/api/search/cad/persons?q=John+Final+Test', null, AH);
  pass('T9  Search by name → 200', r.status === 200, r.status);
  const s9 = JSON.parse(r.body);
  pass('T9  Returns array', Array.isArray(s9));
  const m9 = s9.find((p) => p.citizenid === 'FINAL-001');
  pass('T9  Finds FINAL-001', !!m9, s9.map((p) => p.citizenid));
  pass('T9  full_name is real name (not citizenid)', m9?.full_name === 'John Final Test', m9?.full_name);
  pass('T9  License attached', !!m9?.cad_driver_license);
  pass('T9  License status valid', m9?.cad_driver_license?.status === 'valid', m9?.cad_driver_license?.status);
  pass('T9  License has 4 classes (post-upsert)', m9?.cad_driver_license?.license_classes?.length === 4, m9?.cad_driver_license?.license_classes);

  // T10: Search by citizenid
  r = await request('GET', '/api/search/cad/persons?q=FINAL-001', null, AH);
  const s10 = JSON.parse(r.body);
  const m10 = s10.find((p) => p.citizenid === 'FINAL-001');
  pass('T10 Search by citizenid finds match', !!m10);
  pass('T10 full_name from license (not citizenid)', m10?.full_name === 'John Final Test', m10?.full_name);

  // T11: Direct lookup by citizenid
  r = await request('GET', '/api/search/cad/persons/FINAL-001', null, AH);
  pass('T11 Direct lookup → 200', r.status === 200, r.status);
  const p11 = JSON.parse(r.body);
  pass('T11 citizenid correct', p11?.citizenid === 'FINAL-001', p11?.citizenid);
  pass('T11 full_name correct (not citizenid)', p11?.full_name === 'John Final Test', p11?.full_name);
  pass('T11 License attached', !!p11?.cad_driver_license);
  pass('T11 License has MC class', p11?.cad_driver_license?.license_classes?.includes('MC'));
  pass('T11 Birthdate set', p11?.birthdate === '1988-07-04', p11?.birthdate);
  pass('T11 Gender set', p11?.gender === 'male', p11?.gender);
  pass('T11 Vehicle registrations array present', Array.isArray(p11?.cad_vehicle_registrations));

  // T12: Partial name search
  r = await request('GET', '/api/search/cad/persons?q=Final+Test', null, AH);
  const s12 = JSON.parse(r.body);
  pass('T12 Partial name search finds FINAL-001', Array.isArray(s12) && s12.some((p) => p.citizenid === 'FINAL-001'));

  // T13: No auth on search → 401
  r = await request('GET', '/api/search/cad/persons?q=Final', null, {});
  pass('T13 No auth on search → 401', r.status === 401, r.status);

  // T14: Too-short query → 400
  r = await request('GET', '/api/search/cad/persons?q=F', null, AH);
  pass('T14 Too-short query → 400', r.status === 400, r.status);

  // T15: Direct lookup nonexistent → 404
  r = await request('GET', '/api/search/cad/persons/DOESNOTEXIST-99999', null, AH);
  pass('T15 Direct lookup nonexistent → 404', r.status === 404, r.status);

  // T16: Both citizens appear in a broad search
  r = await request('GET', '/api/search/cad/persons?q=FINAL', null, AH);
  const s16 = JSON.parse(r.body);
  pass('T16 Broad search returns multiple citizens', Array.isArray(s16) && s16.length >= 2, s16?.length);
  pass('T16 FINAL-001 in results', s16.some((p) => p.citizenid === 'FINAL-001'));
  pass('T16 FINAL-002 in results', s16.some((p) => p.citizenid === 'FINAL-002'));

  console.log('\n══ 3-DAY RENEWAL WINDOW TESTS ══════════════════════════════════');

  // These tests verify the GET /licenses/:citizenid endpoint returns the data
  // that server.lua uses to enforce the 3-day renewal window. The Lua code
  // reads expiry_at and checks daysUntilExpiry > 3 to block early renewal.

  // T17: License with 365 days expiry — GET should show expiry ~1 year away
  r = await request('GET', '/api/integration/fivem/licenses/FINAL-001', null, BH);
  pass('T17 GET returns valid license for renewal check', r.status === 200, r.status);
  const licRenew = JSON.parse(r.body).license;
  const expiryDate = new Date(licRenew?.expiry_at + 'T00:00:00Z');
  const daysLeft = Math.floor((expiryDate - Date.now()) / (1000 * 60 * 60 * 24));
  pass('T17 Expiry_at present', !!licRenew?.expiry_at, licRenew?.expiry_at);
  pass('T17 Days remaining > 3 (renewal should be blocked in-game)', daysLeft > 3, `${daysLeft} days`);

  // T18: Create a license with expiry_at = yesterday (already expired)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  r = await request('POST', '/api/integration/fivem/licenses', {
    citizenid: 'RENEW-EXPIRED',
    full_name: 'Expired Person',
    date_of_birth: '1990-01-01',
    gender: 'male',
    license_classes: ['C'],
    expiry_at: yesterday,
    identifiers: [],
  }, BH);
  pass('T18 Create expired license → 201', r.status === 201, r.status);
  const licExpired = JSON.parse(r.body).license;
  pass('T18 Status auto-set to expired', licExpired?.status === 'expired', licExpired?.status);

  // T18b: GET that expired license — days left should be <= 0, renewal allowed in-game
  r = await request('GET', '/api/integration/fivem/licenses/RENEW-EXPIRED', null, BH);
  const licExpiredGet = JSON.parse(r.body).license;
  const expiredDaysLeft = Math.floor((new Date(licExpiredGet?.expiry_at + 'T00:00:00Z') - Date.now()) / (1000 * 60 * 60 * 24));
  pass('T18b Expired license days remaining <= 0', expiredDaysLeft <= 0, `${expiredDaysLeft} days`);
  pass('T18b Lua renewal block would allow this (daysUntilExpiry <= 3)', expiredDaysLeft <= 3);

  // T19: Create a license expiring in 2 days — should be within renewal window
  const in2days = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  r = await request('POST', '/api/integration/fivem/licenses', {
    citizenid: 'RENEW-NEAR',
    full_name: 'Near Expiry Person',
    date_of_birth: '1990-01-01',
    gender: 'female',
    license_classes: ['C'],
    expiry_at: in2days,
    identifiers: [],
  }, BH);
  pass('T19 Create near-expiry license → 201', r.status === 201, r.status);
  const licNear = JSON.parse(r.body).license;
  pass('T19 Status is valid (2 days left)', licNear?.status === 'valid', licNear?.status);

  r = await request('GET', '/api/integration/fivem/licenses/RENEW-NEAR', null, BH);
  const licNearGet = JSON.parse(r.body).license;
  const nearDaysLeft = Math.floor((new Date(licNearGet?.expiry_at + 'T00:00:00Z') - Date.now()) / (1000 * 60 * 60 * 24));
  pass('T19b Near-expiry license days remaining <= 3', nearDaysLeft <= 3, `${nearDaysLeft} days`);
  pass('T19b Lua renewal block would allow this (daysUntilExpiry <= 3)', nearDaysLeft <= 3);

  // T20: Verify Lua flow for first-time license (citizen with no existing record)
  // Lua GET returns 404, so the renewal block is skipped — POST goes straight through
  r = await request('GET', '/api/integration/fivem/licenses/BRAND-NEW-999', null, BH);
  pass('T20 No existing license → 404 (Lua skips block, allows first issue)', r.status === 404, r.status);

  console.log(`\n${'─'.repeat(58)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('All tests passed! ✓');
  } else {
    console.log(`${failed} test(s) failed ✗`);
  }
}

run().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
