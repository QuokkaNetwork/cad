export default function SearchResults({ type, results, onSelect }) {
  if (results.length === 0) {
    return <p className="text-sm text-cad-muted py-4 text-center">No results found</p>;
  }

  if (type === 'person') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cad-border text-left text-xs text-cad-muted uppercase tracking-wider">
              <th className="px-3 py-2">Citizen ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">DOB</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Gender</th>
            </tr>
          </thead>
          <tbody>
            {results.map((person, i) => (
              <tr
                key={person.citizenid || i}
                onClick={() => onSelect?.(person)}
                className="border-b border-cad-border/50 hover:bg-cad-card cursor-pointer transition-colors"
              >
                <td className="px-3 py-2 font-mono text-cad-accent-light">{person.citizenid}</td>
                <td className="px-3 py-2 font-medium">{person.firstname} {person.lastname}</td>
                <td className="px-3 py-2 text-cad-muted">{person.birthdate}</td>
                <td className="px-3 py-2 text-cad-muted">{person.phone}</td>
                <td className="px-3 py-2 text-cad-muted">{person.gender === '0' ? 'Male' : person.gender === '1' ? 'Female' : person.gender}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Vehicle results
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-cad-border text-left text-xs text-cad-muted uppercase tracking-wider">
            <th className="px-3 py-2">Plate</th>
            <th className="px-3 py-2">Vehicle</th>
            <th className="px-3 py-2">Owner</th>
            <th className="px-3 py-2">Garage</th>
            <th className="px-3 py-2">State</th>
          </tr>
        </thead>
        <tbody>
          {results.map((vehicle, i) => (
            <tr
              key={vehicle.plate || i}
              onClick={() => onSelect?.(vehicle)}
              className="border-b border-cad-border/50 hover:bg-cad-card cursor-pointer transition-colors"
            >
              <td className="px-3 py-2 font-mono font-bold text-cad-accent-light">{vehicle.plate}</td>
              <td className="px-3 py-2">{vehicle.vehicle}</td>
              <td className="px-3 py-2 font-mono text-cad-muted">{vehicle.owner}</td>
              <td className="px-3 py-2 text-cad-muted">{vehicle.garage}</td>
              <td className="px-3 py-2 text-cad-muted">{vehicle.state}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
