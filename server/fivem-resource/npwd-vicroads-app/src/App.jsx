import React, { useMemo, useState } from 'react';
import logo from './assets/vicroads-logo.png';
import { fetchCadBridgeNui } from './utils/fetchNui.js';

function StatusBanner({ status }) {
  if (!status?.message) return null;
  const isError = status.type === 'error';
  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${isError ? 'rgba(239,68,68,0.35)' : 'rgba(34,197,94,0.35)'}`,
        background: isError ? 'rgba(127,29,29,0.18)' : 'rgba(20,83,45,0.18)',
        color: isError ? '#fecaca' : '#bbf7d0',
        fontSize: 13,
        lineHeight: 1.35,
        padding: '10px 12px',
        whiteSpace: 'pre-wrap',
      }}
    >
      {status.message}
    </div>
  );
}

export default function App() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({
    type: 'info',
    message: 'Sit inside the vehicle you want to register, then tap "Open Registration".',
  });

  const timestamp = useMemo(() => new Date().toLocaleTimeString(), [busy]); // lightweight UI refresh marker

  async function handleOpenRegistration() {
    if (busy) return;
    setBusy(true);
    setStatus({ type: 'info', message: 'Checking your current vehicle...' });
    try {
      const res = await fetchCadBridgeNui('cadBridgeNpwdVicRoadsOpenRegistration', {});
      const ok = res?.ok === true || res?.success === true;
      if (ok) {
        setStatus({
          type: 'success',
          message: 'VicRoads registration form opened.\nReview and submit the registration in the CAD popup.',
        });
      } else {
        setStatus({
          type: 'error',
          message:
            String(res?.message || '').trim() ||
            'You need to be sitting in the vehicle you want to register before using this app.',
        });
      }
    } catch (err) {
      setStatus({
        type: 'error',
        message: `Unable to contact CAD bridge: ${String(err?.message || err || 'unknown error')}`,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        color: '#f8fbff',
        background:
          'radial-gradient(circle at 15% 10%, rgba(59,130,246,0.28), transparent 50%), linear-gradient(180deg, #071228 0%, #0a1936 55%, #081224 100%)',
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      }}
    >
      <div style={{ padding: '14px 14px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: '#ffffff',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 8px 18px rgba(0,0,0,0.25)',
          }}
        >
          <img src={logo} alt="VicRoads" style={{ width: 28, height: 28, objectFit: 'contain' }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.1 }}>VicRoads</div>
          <div style={{ color: '#b8cae6', fontSize: 12 }}>Vehicle Registration</div>
        </div>
      </div>

      <div style={{ padding: '0 14px 14px', display: 'grid', gap: 12, overflow: 'auto' }}>
        <div
          style={{
            borderRadius: 14,
            border: '1px solid rgba(148,163,184,0.22)',
            background: 'rgba(15,23,42,0.45)',
            padding: 12,
            display: 'grid',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 13, color: '#dbeafe', fontWeight: 600 }}>Register Current Vehicle</div>
          <div style={{ fontSize: 12.5, color: '#c2d2ea', lineHeight: 1.35 }}>
            This opens the CAD registration form for the vehicle you are currently sitting in.
            If you are not seated in a vehicle, the app will warn you.
          </div>
          <button
            type="button"
            onClick={handleOpenRegistration}
            disabled={busy}
            style={{
              marginTop: 4,
              border: '1px solid rgba(37,99,235,0.45)',
              background: busy
                ? 'linear-gradient(135deg, rgba(30,64,175,0.6), rgba(30,58,138,0.55))'
                : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#fff',
              borderRadius: 12,
              padding: '10px 12px',
              fontSize: 13,
              fontWeight: 700,
              cursor: busy ? 'default' : 'pointer',
              opacity: busy ? 0.85 : 1,
              textAlign: 'center',
            }}
          >
            {busy ? 'Opening...' : 'Open Registration'}
          </button>
        </div>

        <StatusBanner status={status} />

        <div
          style={{
            borderRadius: 12,
            border: '1px solid rgba(148,163,184,0.16)',
            background: 'rgba(15,23,42,0.32)',
            padding: 10,
            fontSize: 11.5,
            color: '#9fb4d1',
            lineHeight: 1.35,
          }}
        >
          Tip: Sit in the driver or passenger seat of the vehicle before opening the form so the plate, model, and colour are pre-filled.
          <div style={{ marginTop: 6, opacity: 0.8 }}>Last refresh: {timestamp}</div>
        </div>
      </div>
    </div>
  );
}

