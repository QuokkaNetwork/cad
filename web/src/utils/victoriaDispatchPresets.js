const LAW = 'law_enforcement';
const EMS = 'paramedics';
const FIRE = 'fire';
const ALL = 'all';

export const VICTORIA_JOB_CODE_SUGGESTIONS = [
  // Common / dispatch-wide
  { code: '000', label: 'Emergency Call', suggestedTitle: '000 Emergency Call', layouts: [ALL], category: 'Common', keywords: ['triple zero', 'dispatch', 'urgent'] },
  { code: 'MVA', label: 'Motor Vehicle Accident', suggestedTitle: 'Motor Vehicle Accident', layouts: [ALL], category: 'Common', keywords: ['crash', 'collision', 'car accident'] },
  { code: 'MVA-INJ', label: 'MVA With Injuries', suggestedTitle: 'MVA With Injuries', layouts: [ALL], category: 'Common', keywords: ['crash injuries', 'collision injury'] },
  { code: 'MVA-FATAL', label: 'Fatal Crash', suggestedTitle: 'Fatal Motor Vehicle Accident', layouts: [LAW, EMS, FIRE], category: 'Common', keywords: ['fatal collision', 'death crash'] },
  { code: 'HAZMAT', label: 'Hazardous Materials Incident', suggestedTitle: 'Hazmat Incident', layouts: [LAW, EMS, FIRE], category: 'Common', keywords: ['chemical', 'spill', 'gas'] },
  { code: 'MCI', label: 'Mass Casualty Incident', suggestedTitle: 'Mass Casualty Incident', layouts: [EMS, FIRE, LAW], category: 'Common', keywords: ['multi patient', 'mass casualty'] },
  { code: 'WELFARE', label: 'Welfare Check', suggestedTitle: 'Welfare Check', layouts: [LAW, EMS], category: 'Common', keywords: ['check wellbeing', 'welfare'] },
  { code: 'PUBLICASSIST', label: 'Public Assist', suggestedTitle: 'Public Assist Request', layouts: [LAW, EMS, FIRE], category: 'Common', keywords: ['assist public', 'help request'] },
  { code: 'SEARCH', label: 'Search Operation', suggestedTitle: 'Search Operation', layouts: [LAW, EMS, FIRE], category: 'Common', keywords: ['missing person', 'search'] },

  // Law enforcement
  { code: 'PURSUIT', label: 'Vehicle Pursuit', suggestedTitle: 'Police Pursuit', layouts: [LAW], category: 'Police', keywords: ['chase', 'evading', 'fail to stop'] },
  { code: 'TRAFFICSTOP', label: 'Traffic Stop / Vehicle Intercept', suggestedTitle: 'Traffic Stop', layouts: [LAW], category: 'Police', keywords: ['traffic', 'stop', 'vehicle intercept'] },
  { code: 'DUI', label: 'Suspected DUI / Impaired Driver', suggestedTitle: 'Suspected DUI Driver', layouts: [LAW], category: 'Police', keywords: ['drunk driver', 'impaired'] },
  { code: 'RECKLESS', label: 'Reckless Driving', suggestedTitle: 'Reckless Driving Complaint', layouts: [LAW], category: 'Police', keywords: ['dangerous driving', 'hoon'] },
  { code: 'SHOTS', label: 'Shots Fired', suggestedTitle: 'Shots Fired', layouts: [LAW], category: 'Police', keywords: ['gunfire', 'shooting'] },
  { code: 'SHOOTING', label: 'Shooting / GSW Incident', suggestedTitle: 'Shooting Incident', layouts: [LAW], category: 'Police', keywords: ['gsw', 'gunshot'] },
  { code: 'STABBING', label: 'Stabbing Incident', suggestedTitle: 'Stabbing Incident', layouts: [LAW], category: 'Police', keywords: ['knife', 'stab'] },
  { code: 'ASSAULT', label: 'Assault', suggestedTitle: 'Assault', layouts: [LAW], category: 'Police', keywords: ['fight', 'battery'] },
  { code: 'DOMESTIC', label: 'Domestic Disturbance', suggestedTitle: 'Domestic Disturbance', layouts: [LAW], category: 'Police', keywords: ['domestic violence', 'family violence'] },
  { code: 'FV', label: 'Family Violence', suggestedTitle: 'Family Violence Incident', layouts: [LAW], category: 'Police', keywords: ['domestic', 'family'] },
  { code: 'ROBBERY', label: 'Robbery In Progress', suggestedTitle: 'Robbery In Progress', layouts: [LAW], category: 'Police', keywords: ['hold up', 'armed robbery'] },
  { code: 'BURGLARY', label: 'Burglary / Break & Enter', suggestedTitle: 'Burglary', layouts: [LAW], category: 'Police', keywords: ['break in', 'b&e', 'house break'] },
  { code: 'THEFT', label: 'Theft / Stealing', suggestedTitle: 'Theft Report', layouts: [LAW], category: 'Police', keywords: ['steal', 'larceny'] },
  { code: 'STOLENVEH', label: 'Stolen Vehicle', suggestedTitle: 'Stolen Vehicle', layouts: [LAW], category: 'Police', keywords: ['stolen car', 'vehicle theft'] },
  { code: 'HITRUN', label: 'Hit and Run', suggestedTitle: 'Hit and Run', layouts: [LAW], category: 'Police', keywords: ['leave scene'] },
  { code: 'SUSP-PER', label: 'Suspicious Person', suggestedTitle: 'Suspicious Person', layouts: [LAW], category: 'Police', keywords: ['suspicious male', 'suspicious female'] },
  { code: 'SUSP-VEH', label: 'Suspicious Vehicle', suggestedTitle: 'Suspicious Vehicle', layouts: [LAW], category: 'Police', keywords: ['suspicious car'] },
  { code: 'TRESPASS', label: 'Trespass Complaint', suggestedTitle: 'Trespass Complaint', layouts: [LAW], category: 'Police', keywords: ['unwanted person'] },
  { code: 'DISTURB', label: 'Disturbance / Disorder', suggestedTitle: 'Public Disturbance', layouts: [LAW], category: 'Police', keywords: ['disorderly', 'fight', 'noise'] },
  { code: 'NOISE', label: 'Noise Complaint', suggestedTitle: 'Noise Complaint', layouts: [LAW], category: 'Police', keywords: ['loud music'] },
  { code: 'VANDAL', label: 'Vandalism / Property Damage', suggestedTitle: 'Vandalism Report', layouts: [LAW], category: 'Police', keywords: ['damage', 'graffiti'] },
  { code: 'HOSTAGE', label: 'Hostage Situation', suggestedTitle: 'Hostage Situation', layouts: [LAW], category: 'Police', keywords: ['kidnap', 'barricade'] },
  { code: 'WARRANT', label: 'Warrant Service', suggestedTitle: 'Warrant Service', layouts: [LAW], category: 'Police', keywords: ['serve warrant'] },
  { code: 'POI', label: 'POI Follow-Up', suggestedTitle: 'POI Follow-Up', layouts: [LAW], category: 'Police', keywords: ['poi', 'bolo', 'wanted vehicle'] },
  { code: 'OFFICERDOWN', label: 'Officer Down', suggestedTitle: 'Officer Down', layouts: [LAW, EMS], category: 'Police', keywords: ['10-13', 'assist officer'] },
  { code: 'SPIKES', label: 'Spike Strip Deployment', suggestedTitle: 'Spike Strip Deployment', layouts: [LAW], category: 'Police', keywords: ['spikes', 'tyre deflation'] },
  { code: 'ROADBLOCK', label: 'Roadblock / Containment', suggestedTitle: 'Roadblock / Containment', layouts: [LAW], category: 'Police', keywords: ['containment', 'block road'] },

  // EMS / paramedics
  { code: 'MED', label: 'Medical Assistance', suggestedTitle: 'Medical Assistance Required', layouts: [EMS], category: 'EMS', keywords: ['medical', 'ambulance'] },
  { code: 'CARDIAC', label: 'Cardiac / Chest Pain', suggestedTitle: 'Cardiac / Chest Pain', layouts: [EMS], category: 'EMS', keywords: ['heart', 'chest pain'] },
  { code: 'BREATH', label: 'Breathing Difficulty', suggestedTitle: 'Breathing Difficulty', layouts: [EMS], category: 'EMS', keywords: ['respiratory', 'asthma'] },
  { code: 'UNCON', label: 'Unconscious Person', suggestedTitle: 'Unconscious Person', layouts: [EMS], category: 'EMS', keywords: ['unresponsive'] },
  { code: 'OD', label: 'Overdose / Poisoning', suggestedTitle: 'Overdose / Poisoning', layouts: [EMS], category: 'EMS', keywords: ['overdose', 'poison'] },
  { code: 'SEIZURE', label: 'Seizure', suggestedTitle: 'Seizure', layouts: [EMS], category: 'EMS', keywords: ['convulsion'] },
  { code: 'FALL', label: 'Fall Injury', suggestedTitle: 'Fall Injury', layouts: [EMS], category: 'EMS', keywords: ['fallen person'] },
  { code: 'TRAUMA', label: 'Trauma', suggestedTitle: 'Trauma Incident', layouts: [EMS], category: 'EMS', keywords: ['injury', 'major trauma'] },
  { code: 'GSW', label: 'Gunshot Wound Patient', suggestedTitle: 'GSW Patient', layouts: [EMS], category: 'EMS', keywords: ['shooting patient'] },
  { code: 'STAB', label: 'Stab Wound Patient', suggestedTitle: 'Stab Wound Patient', layouts: [EMS], category: 'EMS', keywords: ['knife wound'] },
  { code: 'DOA', label: 'Deceased / DOA', suggestedTitle: 'Deceased Person', layouts: [EMS], category: 'EMS', keywords: ['deceased', 'dead on arrival'] },
  { code: 'CPR', label: 'CPR In Progress', suggestedTitle: 'CPR In Progress', layouts: [EMS], category: 'EMS', keywords: ['resuscitation'] },
  { code: 'PSYCH', label: 'Mental Health / Psych', suggestedTitle: 'Mental Health Crisis', layouts: [EMS, LAW], category: 'EMS', keywords: ['psych', 'mental health'] },
  { code: 'BIRTH', label: 'Labour / Birth', suggestedTitle: 'Labour / Childbirth', layouts: [EMS], category: 'EMS', keywords: ['childbirth'] },
  { code: 'ALLERGY', label: 'Allergic Reaction', suggestedTitle: 'Severe Allergic Reaction', layouts: [EMS], category: 'EMS', keywords: ['anaphylaxis'] },
  { code: 'BURN', label: 'Burn Injury', suggestedTitle: 'Burn Injury', layouts: [EMS, FIRE], category: 'EMS', keywords: ['burns'] },
  { code: 'TRANSFER', label: 'Patient Transport / Transfer', suggestedTitle: 'Patient Transport', layouts: [EMS], category: 'EMS', keywords: ['transport'] },

  // Fire
  { code: 'STRUCFIRE', label: 'Structure Fire', suggestedTitle: 'Structure Fire', layouts: [FIRE], category: 'Fire', keywords: ['building fire', 'house fire'] },
  { code: 'VEHFIRE', label: 'Vehicle Fire', suggestedTitle: 'Vehicle Fire', layouts: [FIRE], category: 'Fire', keywords: ['car fire'] },
  { code: 'BRUSHFIRE', label: 'Brush / Bush / Grass Fire', suggestedTitle: 'Brush Fire', layouts: [FIRE], category: 'Fire', keywords: ['grass fire', 'bush fire', 'wildfire'] },
  { code: 'SMOKE', label: 'Smoke Investigation', suggestedTitle: 'Smoke Investigation', layouts: [FIRE], category: 'Fire', keywords: ['smoke seen'] },
  { code: 'ALARM', label: 'Alarm Activation', suggestedTitle: 'Alarm Activation', layouts: [FIRE], category: 'Fire', keywords: ['fire alarm'] },
  { code: 'RESCUE', label: 'Rescue', suggestedTitle: 'Rescue Operation', layouts: [FIRE], category: 'Fire', keywords: ['technical rescue'] },
  { code: 'EXTRICATION', label: 'Vehicle Extrication', suggestedTitle: 'Vehicle Extrication', layouts: [FIRE, EMS], category: 'Fire', keywords: ['trapped occupant'] },
  { code: 'MVA_RESCUE', label: 'MVA Rescue / Extrication', suggestedTitle: 'MVA Rescue / Extrication', layouts: [FIRE, EMS], category: 'Fire', keywords: ['crash rescue'] },
  { code: 'WATERRESC', label: 'Water Rescue', suggestedTitle: 'Water Rescue', layouts: [FIRE, EMS], category: 'Fire', keywords: ['water incident', 'drowning'] },
  { code: 'GASLEAK', label: 'Gas Leak', suggestedTitle: 'Gas Leak', layouts: [FIRE], category: 'Fire', keywords: ['gas smell', 'gas odour'] },
  { code: 'DOWNPOWER', label: 'Downed Power Lines', suggestedTitle: 'Downed Power Lines', layouts: [FIRE], category: 'Fire', keywords: ['powerlines', 'electrical hazard'] },
  { code: 'ELEVATOR', label: 'Elevator Rescue', suggestedTitle: 'Elevator Rescue', layouts: [FIRE], category: 'Fire', keywords: ['lift rescue'] },
  { code: 'TRENCH', label: 'Trench / Confined Space Rescue', suggestedTitle: 'Trench / Confined Space Rescue', layouts: [FIRE], category: 'Fire', keywords: ['confined space'] },
  { code: 'FIREWATCH', label: 'Fire Watch / Standby', suggestedTitle: 'Fire Watch / Standby', layouts: [FIRE], category: 'Fire', keywords: ['standby'] },
];

// GTA V / Los Santos + Blaine County roads, highways, and common response areas.
export const VICTORIA_LOCATION_SUGGESTIONS = [
  'Abattoir Ave',
  'Abe Milton Pkwy',
  'Ace Jones Dr',
  'Adam\'s Apple Blvd',
  'Aguja St',
  'Alta Pl',
  'Alta St',
  'Amarillo Vista',
  'Atlee St',
  'Banham Canyon Dr',
  'Barbareno Rd',
  'Bay City Ave',
  'Baytree Canyon Rd',
  'Boulevard Del Perro',
  'Bridge St',
  'Brouge Ave',
  'Buen Vino Rd',
  'Caesars Place',
  'Calafia Rd',
  'Capital Blvd',
  'Carcer Way',
  'Cascabel Ave',
  'Cassidy Trail',
  'Cat-Claw Ave',
  'Chianski Passage',
  'Cholla Rd',
  'Chum St',
  'Clinton Ave',
  'Cockingend Dr',
  'Conquistador St',
  'Cortes St',
  'Cougar Ave',
  'Covenant Ave',
  'Cox Way',
  'Crusade Rd',
  'Davis Ave',
  'Didion Dr',
  'Dorset Dr',
  'Duluoz Ave',
  'East Galileo Ave',
  'East Joshua Rd',
  'East Mirror Dr',
  'Eastbourne Way',
  'El Burro Blvd',
  'El Rancho Blvd',
  'Equality Way',
  'Exceptionalists Way',
  'Fantastic Pl',
  'Forum Dr',
  'Fudge Ln',
  'Galileo Rd',
  'Gentry Lane',
  'Ginger St',
  'Glory Way',
  'Goma St',
  'Grapeseed Ave',
  'Grapeseed Main St',
  'Great Ocean Hwy',
  'Greenwich Pkwy',
  'Greenwich Pl',
  'Hangman Ave',
  'Hardy Way',
  'Hawick Ave',
  'Heritage Way',
  'Hillcrest Ave',
  'Imagination Ct',
  'Ineseno Road',
  'Innocence Blvd',
  'Jamestown St',
  'Joad Ln',
  'Joshua Rd',
  'Labor Pl',
  'Laguna Pl',
  'Las Lagunas Blvd',
  'Liberty St',
  'Lindsay Circus',
  'Little Bighorn Ave',
  'Low Power St',
  'Macdonald St',
  'Mad Wayne Thunder Dr',
  'Magellan Ave',
  'Marathon Ave',
  'Marlowe Dr',
  'Melanoma St',
  'Meteor St',
  'Milton Rd',
  'Mirror Park Blvd',
  'Mission Row',
  'Mt Haan Dr',
  'Mt Vinewood Dr',
  'Mutiny Rd',
  'New Empire Way',
  'Nikola Ave',
  'Niland Ave',
  'North Archer Ave',
  'North Calafia Way',
  'North Conker Ave',
  'North Rockford Dr',
  'Nowhere Rd',
  'Occupation Ave',
  'Orchardville Ave',
  'Paleto Blvd',
  'Palomino Ave',
  'Panorama Dr',
  'Perth St',
  'Perishing St',
  'Picture Perfect Dr',
  'Plaice Pl',
  'Popular St',
  'Portola Dr',
  'Power St',
  'Procopio Dr',
  'Prosperity St',
  'Pyrite Ave',
  'Red Desert Ave',
  'Richman St',
  'Rockford Dr',
  'Route 1',
  'Route 11',
  'Route 13',
  'Route 14',
  'Route 15',
  'Route 16',
  'Route 17',
  'Route 18',
  'Route 19',
  'Route 20',
  'Route 22',
  'Route 23',
  'Route 24',
  'Route 68',
  'Roy Lowenstein Blvd',
  'Rub St',
  'Sam Austin Dr',
  'San Andreas Ave',
  'Sandcastle Way',
  'Seaview Rd',
  'Senora Fwy',
  'Senora Rd',
  'Shank St',
  'Signal St',
  'Sinner St',
  'South Arsenal St',
  'South Boulevard Del Perro',
  'South Mo Milton Dr',
  'South Rockford Dr',
  'Spanish Ave',
  'Steele Way',
  'Strangeways Dr',
  'Strawberry Ave',
  'Supply St',
  'Sustancia Rd',
  'Swiss St',
  'Tackle St',
  'Tangerine St',
  'Tongva Dr',
  'Tug St',
  'Utopia Gardens',
  'Vespucci Blvd',
  'Vinewood Blvd',
  'Vinewood Park Dr',
  'West Eclipse Blvd',
  'West Mirror Drive',
  'Wild Oats Dr',
  'Zancudo Ave',
  'Zancudo Barranca',
  'Zancudo Grande Valley',
  'Airport - Los Santos International',
  'Alta',
  'Banham Canyon',
  'Burton',
  'Chamberlain Hills',
  'Cypress Flats',
  'Davis',
  'Del Perro',
  'Downtown Vinewood',
  'East Vinewood',
  'Elysian Island',
  'Grapeseed',
  'Harmony',
  'Hawick',
  'La Mesa',
  'La Puerta',
  'Legion Square',
  'Little Seoul',
  'Mirror Park',
  'Mission Row',
  'Paleto Bay',
  'Pillbox Hill',
  'Rancho',
  'Richman',
  'Rockford Hills',
  'Sandy Shores',
  'Senora Desert',
  'Textile City',
  'Vespucci Beach',
  'West Vinewood',
  'Del Perro Fwy',
  'Elysian Fields Fwy',
  'La Puerta Fwy',
  'Los Santos Fwy',
  'Olympic Fwy',
  'Palomino Fwy',
  'Calafia Bridge',
  'Marlowe Vineyards',
  'Pacific Bluffs',
  'NOOSE HQ',
  'Bolingbroke Penitentiary',
  'Sandy Shores Airfield',
  'Fort Zancudo Gate',
  'Fort Zancudo Hangars',
  'Humane Labs',
  'Merryweather Dock',
  'Port of Los Santos',
  'Pillbox Medical Center',
  'Central LS Medical Center',
  'Mount Zonah Medical Center',
  'St Fiacre Hospital',
];

function scoreTextMatch(candidateText, queryText) {
  if (!queryText) return 1000;
  const candidate = String(candidateText || '').toLowerCase();
  const query = String(queryText || '').toLowerCase();
  if (!candidate || !query) return -1;
  if (candidate === query) return 0;
  if (candidate.startsWith(query)) return 1;
  const index = candidate.indexOf(query);
  if (index >= 0) return 10 + index;
  return -1;
}

function bestPositiveScore(scores = []) {
  const valid = scores.filter((score) => Number.isFinite(score) && score >= 0);
  if (!valid.length) return -1;
  valid.sort((a, b) => a - b);
  return valid[0];
}

export function filterVictoriaJobCodeSuggestions(query, { layoutTypes = [], limit = 10 } = {}) {
  const normalizedLayoutTypes = Array.isArray(layoutTypes)
    ? Array.from(new Set(layoutTypes.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)))
    : [];
  const q = String(query || '').trim();
  const qLower = q.toLowerCase();

  const filtered = VICTORIA_JOB_CODE_SUGGESTIONS
    .filter((entry) => {
      const layouts = Array.isArray(entry.layouts) ? entry.layouts : [ALL];
      if (normalizedLayoutTypes.length === 0) return true;
      if (layouts.includes(ALL)) return true;
      return normalizedLayoutTypes.some((layout) => layouts.includes(layout));
    })
    .map((entry) => {
      const aliasScores = (Array.isArray(entry.keywords) ? entry.keywords : [])
        .map((value) => scoreTextMatch(value, qLower));
      const bestScore = q
        ? bestPositiveScore([
          scoreTextMatch(entry.code, qLower),
          scoreTextMatch(entry.label, qLower),
          scoreTextMatch(entry.suggestedTitle, qLower),
          scoreTextMatch(entry.category, qLower),
          ...aliasScores,
        ])
        : 1000;
      return { ...entry, _score: Number.isFinite(bestScore) ? bestScore : -1 };
    })
    .filter((entry) => (q ? entry._score >= 0 : true))
    .sort((a, b) => {
      if (a._score !== b._score) return a._score - b._score;
      const aCategory = String(a.category || '');
      const bCategory = String(b.category || '');
      if (aCategory !== bCategory) return aCategory.localeCompare(bCategory, undefined, { sensitivity: 'base' });
      return String(a.code || '').localeCompare(String(b.code || ''), undefined, { sensitivity: 'base' });
    })
    .slice(0, Math.max(1, Number(limit || 10)));

  return filtered.map(({ _score, ...entry }) => entry);
}

export function filterVictoriaLocationSuggestions(query, { recentLocations = [], limit = 10 } = {}) {
  const q = String(query || '').trim();
  const recent = Array.isArray(recentLocations)
    ? recentLocations.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  const candidates = [];
  const seen = new Set();
  for (const value of [...recent, ...VICTORIA_LOCATION_SUGGESTIONS]) {
    const normalized = String(value || '').trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(normalized);
  }

  const ranked = candidates
    .map((value) => ({
      value,
      score: q ? scoreTextMatch(value, q) : 1000,
      recentBoost: recent.some((item) => String(item).toLowerCase() === value.toLowerCase()) ? -0.5 : 0,
    }))
    .filter((entry) => (q ? entry.score >= 0 : true))
    .sort((a, b) => {
      const aScore = a.score + a.recentBoost;
      const bScore = b.score + b.recentBoost;
      if (aScore !== bScore) return aScore - bScore;
      return a.value.localeCompare(b.value, undefined, { sensitivity: 'base' });
    })
    .slice(0, Math.max(1, Number(limit || 10)));

  return ranked.map((entry) => entry.value);
}
