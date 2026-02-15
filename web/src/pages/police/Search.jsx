import { useState } from 'react';
import { api } from '../../api/client';
import SearchResults from '../../components/SearchResults';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';

export default function Search() {
  const [searchType, setSearchType] = useState('person');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personVehicles, setPersonVehicles] = useState([]);
  const [personRecords, setPersonRecords] = useState([]);

  async function doSearch(e) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setResults([]);
    try {
      const endpoint = searchType === 'person' ? '/api/search/persons' : '/api/search/vehicles';
      const data = await api.get(`${endpoint}?q=${encodeURIComponent(query.trim())}`);
      setResults(data);
    } catch (err) {
      alert('Search failed: ' + err.message);
    } finally {
      setSearching(false);
    }
  }

  async function selectPerson(person) {
    setSelectedPerson(person);
    try {
      const [vehicles, records] = await Promise.all([
        api.get(`/api/search/persons/${person.citizenid}/vehicles`),
        api.get(`/api/search/persons/${person.citizenid}/records`),
      ]);
      setPersonVehicles(vehicles);
      setPersonRecords(records);
    } catch (err) {
      console.error('Failed to load person details:', err);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Person & Vehicle Search</h2>

      {/* Search form */}
      <div className="bg-cad-card border border-cad-border rounded-lg p-4 mb-6">
        <form onSubmit={doSearch} className="flex gap-3">
          <div className="flex bg-cad-surface rounded border border-cad-border overflow-hidden">
            <button
              type="button"
              onClick={() => setSearchType('person')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                searchType === 'person' ? 'bg-cad-accent text-white' : 'text-cad-muted hover:text-cad-ink'
              }`}
            >
              Person
            </button>
            <button
              type="button"
              onClick={() => setSearchType('vehicle')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                searchType === 'vehicle' ? 'bg-cad-accent text-white' : 'text-cad-muted hover:text-cad-ink'
              }`}
            >
              Vehicle
            </button>
          </div>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={searchType === 'person' ? 'Search by name or citizen ID...' : 'Search by plate or model...'}
            className="flex-1 bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
          />
          <button
            type="submit"
            disabled={searching || query.trim().length < 2}
            className="px-6 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-cad-card border border-cad-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-cad-border">
            <span className="text-sm text-cad-muted">{results.length} result(s)</span>
          </div>
          <SearchResults
            type={searchType}
            results={results}
            onSelect={searchType === 'person' ? selectPerson : undefined}
          />
        </div>
      )}

      {/* Person Detail Modal */}
      <Modal
        open={!!selectedPerson}
        onClose={() => { setSelectedPerson(null); setPersonVehicles([]); setPersonRecords([]); }}
        title={selectedPerson ? `${selectedPerson.firstname} ${selectedPerson.lastname}` : ''}
        wide
      >
        {selectedPerson && (
          <div className="space-y-4">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-cad-muted">Citizen ID:</span>
                <span className="ml-2 font-mono text-cad-accent-light">{selectedPerson.citizenid}</span>
              </div>
              <div>
                <span className="text-cad-muted">DOB:</span>
                <span className="ml-2">{selectedPerson.birthdate}</span>
              </div>
              <div>
                <span className="text-cad-muted">Phone:</span>
                <span className="ml-2">{selectedPerson.phone}</span>
              </div>
              <div>
                <span className="text-cad-muted">Gender:</span>
                <span className="ml-2">{selectedPerson.gender === '0' ? 'Male' : selectedPerson.gender === '1' ? 'Female' : selectedPerson.gender}</span>
              </div>
              {selectedPerson.nationality && (
                <div>
                  <span className="text-cad-muted">Nationality:</span>
                  <span className="ml-2">{selectedPerson.nationality}</span>
                </div>
              )}
            </div>

            {/* Vehicles */}
            <div>
              <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">
                Registered Vehicles ({personVehicles.length})
              </h4>
              {personVehicles.length > 0 ? (
                <div className="space-y-1">
                  {personVehicles.map((v, i) => (
                    <div key={i} className="flex items-center gap-4 bg-cad-surface rounded px-3 py-2 text-sm">
                      <span className="font-mono font-bold text-cad-accent-light">{v.plate}</span>
                      <span>{v.vehicle}</span>
                      <span className="text-cad-muted">{v.garage}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-cad-muted">No vehicles registered</p>
              )}
            </div>

            {/* Criminal records */}
            <div>
              <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">
                Criminal History ({personRecords.length})
              </h4>
              {personRecords.length > 0 ? (
                <div className="space-y-2">
                  {personRecords.map(r => (
                    <div key={r.id} className="bg-cad-surface rounded p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={r.type} />
                        <span className="font-medium text-sm">{r.title}</span>
                      </div>
                      {r.description && <p className="text-xs text-cad-muted">{r.description}</p>}
                      {r.type === 'fine' && r.fine_amount > 0 && (
                        <p className="text-xs text-amber-400 mt-1">${r.fine_amount.toLocaleString()}</p>
                      )}
                      <p className="text-xs text-cad-muted mt-1">
                        {r.officer_callsign} {r.officer_name} - {new Date(r.created_at + 'Z').toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-cad-muted">No criminal history</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
