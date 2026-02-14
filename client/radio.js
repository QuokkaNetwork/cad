onNet('cad:radio:join', (channel) => {
  try {
    const radio = exports?.mm_radio;
    if (radio && typeof radio.JoinRadio === 'function') {
      radio.JoinRadio(Number(channel));
    }
  } catch (err) {
    // Swallow errors so radio control does not crash the resource.
  }
});

onNet('cad:radio:leave', () => {
  try {
    const radio = exports?.mm_radio;
    if (radio && typeof radio.LeaveRadio === 'function') {
      radio.LeaveRadio();
    }
  } catch (err) {
    // Swallow errors so radio control does not crash the resource.
  }
});

// ===== Radio Activity Reporter =====
// Best-effort state bag listener for pma-voice radioActive state.
// Reports transmissions to the server so the web CAD can show a live feed.
try {
  if (typeof AddStateBagChangeHandler === 'function') {
    AddStateBagChangeHandler('radioActive', null, (bagName, _key, value) => {
      try {
        // bagName is "player:serverId"
        const match = bagName.match(/^player:(\d+)$/);
        if (!match) return;
        const source = parseInt(match[1], 10);
        if (source !== GetPlayerServerId(PlayerId())) return; // only report own state

        if (typeof emitNet === 'function') {
          emitNet('cad:radio:activity', {
            action: value ? 'transmit_start' : 'transmit_end',
            source,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (_) {
        // Swallow errors
      }
    });
  }
} catch (_) {
  // State bag API not available, skip radio activity reporting.
}

// ===== Job Sync Reporter =====
// Listens for QBCore job change events and reports to CAD server.
try {
  if (typeof onNet === 'function') {
    // QBCore job update event
    onNet('QBCore:Client:OnJobUpdate', (job) => {
      try {
        if (typeof emitNet === 'function' && job && job.name) {
          emitNet('cad:jobsync', {
            job_name: job.name,
            citizenid: null, // Server will resolve via source
          });
        }
      } catch (_) {
        // Swallow errors
      }
    });
  }
} catch (_) {
  // Job sync event not available
}
