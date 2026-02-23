export const VICTORIA_JOB_CODE_SUGGESTIONS = [
  { code: '000', label: 'Emergency Triple Zero', suggestedTitle: '000 Emergency Call', layouts: ['all'] },
  { code: 'PURSUIT', label: 'Police Pursuit', suggestedTitle: 'Police Pursuit', layouts: ['law_enforcement'] },
  { code: 'FV', label: 'Family Violence', suggestedTitle: 'Family Violence Incident', layouts: ['law_enforcement'] },
  { code: 'ASSAULT', label: 'Assault', suggestedTitle: 'Assault', layouts: ['law_enforcement'] },
  { code: 'ROBBERY', label: 'Robbery', suggestedTitle: 'Robbery In Progress', layouts: ['law_enforcement'] },
  { code: 'BURGLARY', label: 'Burglary', suggestedTitle: 'Burglary', layouts: ['law_enforcement'] },
  { code: 'THEFT', label: 'Theft / Stealing', suggestedTitle: 'Theft Report', layouts: ['law_enforcement'] },
  { code: 'SUSP', label: 'Suspicious Person / Vehicle', suggestedTitle: 'Suspicious Person / Vehicle', layouts: ['law_enforcement'] },
  { code: 'TRESPASS', label: 'Trespass', suggestedTitle: 'Trespass Complaint', layouts: ['law_enforcement'] },
  { code: 'DISORDER', label: 'Disorder / Disturbance', suggestedTitle: 'Public Disturbance', layouts: ['law_enforcement'] },
  { code: 'TRAFFIC', label: 'Traffic Incident', suggestedTitle: 'Traffic Incident', layouts: ['law_enforcement'] },
  { code: 'MVA', label: 'Motor Vehicle Accident', suggestedTitle: 'Motor Vehicle Accident', layouts: ['all'] },
  { code: 'WELFARE', label: 'Welfare Check', suggestedTitle: 'Welfare Check', layouts: ['law_enforcement', 'paramedics'] },
  { code: 'WARRANT', label: 'Warrant Service', suggestedTitle: 'Warrant Service', layouts: ['law_enforcement'] },
  { code: 'MED', label: 'Medical Assistance', suggestedTitle: 'Medical Assistance Required', layouts: ['paramedics'] },
  { code: 'CARDIAC', label: 'Cardiac / Chest Pain', suggestedTitle: 'Cardiac / Chest Pain', layouts: ['paramedics'] },
  { code: 'BREATHING', label: 'Breathing Difficulty', suggestedTitle: 'Breathing Difficulty', layouts: ['paramedics'] },
  { code: 'UNCON', label: 'Unconscious Person', suggestedTitle: 'Unconscious Person', layouts: ['paramedics'] },
  { code: 'OD', label: 'Overdose / Poisoning', suggestedTitle: 'Overdose / Poisoning', layouts: ['paramedics'] },
  { code: 'TRAUMA', label: 'Trauma', suggestedTitle: 'Trauma Incident', layouts: ['paramedics'] },
  { code: 'MCI', label: 'Mass Casualty Incident', suggestedTitle: 'Mass Casualty Incident', layouts: ['paramedics', 'fire'] },
  { code: 'STRUCFIRE', label: 'Structure Fire', suggestedTitle: 'Structure Fire', layouts: ['fire'] },
  { code: 'VEHFIRE', label: 'Vehicle Fire', suggestedTitle: 'Vehicle Fire', layouts: ['fire'] },
  { code: 'GRASSFIRE', label: 'Grass / Bush Fire', suggestedTitle: 'Grass / Bush Fire', layouts: ['fire'] },
  { code: 'ALARM', label: 'Alarm Activation', suggestedTitle: 'Alarm Activation', layouts: ['fire'] },
  { code: 'RESCUE', label: 'Rescue', suggestedTitle: 'Rescue Operation', layouts: ['fire'] },
  { code: 'MVA_RESCUE', label: 'MVA Rescue / Extrication', suggestedTitle: 'MVA Rescue / Extrication', layouts: ['fire', 'paramedics'] },
  { code: 'HAZMAT', label: 'Hazardous Materials', suggestedTitle: 'Hazmat Incident', layouts: ['fire', 'law_enforcement', 'paramedics'] },
  { code: 'SMOKE', label: 'Smoke Investigation', suggestedTitle: 'Smoke Investigation', layouts: ['fire'] },
];

export const VICTORIA_LOCATION_SUGGESTIONS = [
  'Melbourne CBD',
  'Docklands',
  'Southbank',
  'South Melbourne',
  'Port Melbourne',
  'St Kilda',
  'Prahran',
  'South Yarra',
  'Richmond',
  'Collingwood',
  'Fitzroy',
  'Carlton',
  'Brunswick',
  'Coburg',
  'Northcote',
  'Preston',
  'Reservoir',
  'Footscray',
  'Sunshine',
  'Williamstown',
  'Altona',
  'Werribee',
  'Point Cook',
  'Dandenong',
  'Narre Warren',
  'Cranbourne',
  'Frankston',
  'Mornington',
  'Ringwood',
  'Box Hill',
  'Doncaster',
  'Glen Waverley',
  'Clayton',
  'Monash',
  'Geelong',
  'Ballarat',
  'Bendigo',
  'Shepparton',
  'Mildura',
  'Warrnambool',
  'Traralgon',
  'Morwell',
  'Sale',
  'Latrobe Valley',
  'Melbourne Airport',
  'Tullamarine',
  'Avalon Airport',
  'Southern Cross Station',
  'Flinders Street Station',
  'Parliament Station',
  'Crown Casino',
  'MCG',
  'Marvel Stadium',
  'Chadstone Shopping Centre',
  'Monash Medical Centre',
  'The Alfred Hospital',
  'Royal Melbourne Hospital',
  'Royal Children\'s Hospital',
  'Austin Hospital',
  'Sunshine Hospital',
  'West Gate Freeway',
  'Monash Freeway',
  'Tullamarine Freeway',
  'Eastern Freeway',
  'Calder Freeway',
  'Hume Freeway',
  'Princes Highway',
  'M80 Ring Road',
  'EastLink',
  'Great Ocean Road',
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

export function filterVictoriaJobCodeSuggestions(query, { layoutTypes = [], limit = 10 } = {}) {
  const normalizedLayoutTypes = Array.isArray(layoutTypes)
    ? Array.from(new Set(layoutTypes.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)))
    : [];
  const q = String(query || '').trim();
  const qLower = q.toLowerCase();

  const filtered = VICTORIA_JOB_CODE_SUGGESTIONS
    .filter((entry) => {
      const layouts = Array.isArray(entry.layouts) ? entry.layouts : ['all'];
      if (normalizedLayoutTypes.length === 0) return true;
      if (layouts.includes('all')) return true;
      return normalizedLayoutTypes.some((layout) => layouts.includes(layout));
    })
    .map((entry) => {
      const codeScore = scoreTextMatch(entry.code, qLower);
      const labelScore = scoreTextMatch(entry.label, qLower);
      const titleScore = scoreTextMatch(entry.suggestedTitle, qLower);
      const bestScore = q ? [codeScore, labelScore, titleScore].filter((score) => score >= 0).sort((a, b) => a - b)[0] : 1000;
      return { ...entry, _score: Number.isFinite(bestScore) ? bestScore : -1 };
    })
    .filter((entry) => (q ? entry._score >= 0 : true))
    .sort((a, b) => {
      if (a._score !== b._score) return a._score - b._score;
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
