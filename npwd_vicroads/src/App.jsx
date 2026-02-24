import React, { useMemo, useState } from 'react';
import logo from './assets/vicroads-logo.png';
import { fetchCadBridgeNui } from './utils/fetchNui.js';

const EMPTY_FORM = {
  plate: '',
  vehicle_model: '',
  vehicle_colour: '',
  owner_name: '',
  duration_days: 35,
};

function StatusBanner({ status }) {
  if (!status?.message) return null;
  const isError = status.type === 'error';
  const isSuccess = status.type === 'success';
  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${
          isError ? 'rgba(239,68,68,0.35)' : isSuccess ? 'rgba(34,197,94,0.35)' : 'rgba(148,163,184,0.22)'
        }`,
        background: isError
          ? 'rgba(127,29,29,0.18)'
          : isSuccess
            ? 'rgba(20,83,45,0.18)'
            : 'rgba(15,23,42,0.32)',
        color: isError ? '#fecaca' : isSuccess ? '#bbf7d0' : '#dbeafe',
        fontSize: 12.5,
        lineHeight: 1.35,
        padding: '10px 12px',
        whiteSpace: 'pre-wrap',
      }}
    >
      {status.message}
    </div>
  );
}

function normalizePrefill(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const duration = Number(source.duration_days || 35);
  return {
    plate: String(source.plate || '').trim(),
    vehicle_model: String(source.vehicle_model || source.model || '').trim(),
    vehicle_colour: String(source.vehicle_colour || source.colour || source.color || '').trim(),
    owner_name: String(source.owner_name || source.character_name || '').trim(),
    duration_days: Number.isFinite(duration) && duration > 0 ? Math.floor(duration) : 35,
  };
}

function FieldLabel({ children }) {
  return <div style={{ fontSize: 11, color: '#b8cae6', marginBottom: 4 }}>{children}</div>;
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: '100%',
        borderRadius: 10,
        border: '1px solid rgba(148,163,184,0.22)',
        background: 'rgba(2,6,23,0.38)',
        color: '#f8fbff',
        padding: '9px 10px',
        fontSize: 12.5,
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  );
}

export default function App() {
  const [loadingVehicle, setLoadingVehicle] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [status, setStatus] = useState({
    type: 'info',
    message: 'Sit inside the vehicle you want to register, then tap "Load Current Vehicle".',
  });
  const [lastLoadedAt, setLastLoadedAt] = useState('');

  const busy = loadingVehicle || submitting;
  const timestamp = useMemo(() => {
    if (lastLoadedAt) return lastLoadedAt;
    return new Date().toLocaleTimeString();
  }, [lastLoadedAt]);

  function setFormField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleLoadVehicle() {
    if (busy) return;
    setLoadingVehicle(true);
    setStatus({ type: 'info', message: 'Checking the vehicle you are currently sitting in...' });
    try {
      const res = await fetchCadBridgeNui('cadBridgeNpwdVicRoadsGetPrefill', {});
      const ok = res?.ok === true || res?.success === true;
      if (!ok) {
        setStatus({
          type: 'error',
          message:
            String(res?.message || '').trim()
            || 'You need to be sitting in the vehicle you want to register before using this app.',
        });
        return;
      }

      const prefill = normalizePrefill(res?.payload);
      setForm((current) => ({
        ...current,
        ...prefill,
        owner_name: current.owner_name || prefill.owner_name || '',
      }));
      setLastLoadedAt(new Date().toLocaleTimeString());
      setStatus({
        type: 'success',
        message: 'Vehicle detected. Review the details below and submit the registration in this app.',
      });
    } catch (err) {
      setStatus({
        type: 'error',
        message: `Unable to contact CAD bridge: ${String(err?.message || err || 'unknown error')}`,
      });
    } finally {
      setLoadingVehicle(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;

    const plate = String(form.plate || '').trim();
    const vehicleModel = String(form.vehicle_model || '').trim();
    const ownerName = String(form.owner_name || '').trim();
    const durationDays = Math.max(1, Math.floor(Number(form.duration_days || 35) || 35));
    if (!plate || !vehicleModel) {
      setStatus({
        type: 'error',
        message: 'Plate and vehicle model are required before submitting.',
      });
      return;
    }

    setSubmitting(true);
    setStatus({ type: 'info', message: 'Submitting registration to CAD...' });
    try {
      const res = await fetchCadBridgeNui('cadBridgeNpwdVicRoadsSubmitRegistration', {
        plate,
        vehicle_model: vehicleModel,
        vehicle_colour: String(form.vehicle_colour || '').trim(),
        owner_name: ownerName,
        duration_days: durationDays,
      });
      const ok = res?.ok === true || res?.success === true;
      if (ok) {
        setStatus({
          type: 'success',
          message: String(res?.message || '').trim() || 'Vehicle registration submitted successfully.',
        });
      } else {
        setStatus({
          type: 'error',
          message: String(res?.message || '').trim() || 'Vehicle registration failed.',
        });
      }
    } catch (err) {
      setStatus({
        type: 'error',
        message: `Unable to submit registration: ${String(err?.message || err || 'unknown error')}`,
      });
    } finally {
      setSubmitting(false);
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

      <div style={{ padding: '0 14px 14px', display: 'grid', gap: 10, overflow: 'auto' }}>
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
          <div style={{ fontSize: 13, color: '#dbeafe', fontWeight: 700 }}>Register Current Vehicle</div>
          <div style={{ fontSize: 12, color: '#c2d2ea', lineHeight: 1.35 }}>
            You must be sitting in the vehicle you want to register. Load the vehicle details, confirm the owner name, then submit.
          </div>
          <button
            type="button"
            onClick={handleLoadVehicle}
            disabled={busy}
            style={{
              border: '1px solid rgba(37,99,235,0.45)',
              background: loadingVehicle
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
            {loadingVehicle ? 'Loading Vehicle...' : 'Load Current Vehicle'}
          </button>
        </div>

        <StatusBanner status={status} />

        <form
          onSubmit={handleSubmit}
          style={{
            borderRadius: 14,
            border: '1px solid rgba(148,163,184,0.2)',
            background: 'rgba(15,23,42,0.42)',
            padding: 12,
            display: 'grid',
            gap: 10,
          }}
        >
          <div>
            <FieldLabel>Plate</FieldLabel>
            <TextInput
              value={form.plate}
              onChange={(e) => setFormField('plate', String(e.target.value || '').toUpperCase())}
              placeholder="ABC123"
            />
          </div>

          <div>
            <FieldLabel>Vehicle Model</FieldLabel>
            <TextInput
              value={form.vehicle_model}
              onChange={(e) => setFormField('vehicle_model', e.target.value)}
              placeholder="Adder"
            />
          </div>

          <div>
            <FieldLabel>Vehicle Colour</FieldLabel>
            <TextInput
              value={form.vehicle_colour}
              onChange={(e) => setFormField('vehicle_colour', e.target.value)}
              placeholder="Blue / White"
            />
          </div>

          <div>
            <FieldLabel>Owner Name</FieldLabel>
            <TextInput
              value={form.owner_name}
              onChange={(e) => setFormField('owner_name', e.target.value)}
              placeholder="Optional (uses your current character if blank)"
            />
          </div>

          <div>
            <FieldLabel>Registration Period (Days)</FieldLabel>
            <input
              type="number"
              min="1"
              step="1"
              value={form.duration_days}
              onChange={(e) => setFormField('duration_days', Math.max(1, Math.floor(Number(e.target.value || 1) || 1)))}
              style={{
                width: '100%',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.22)',
                background: 'rgba(2,6,23,0.38)',
                color: '#f8fbff',
                padding: '9px 10px',
                fontSize: 12.5,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 4,
              border: '1px solid rgba(16,185,129,0.35)',
              background: submitting
                ? 'linear-gradient(135deg, rgba(4,120,87,0.6), rgba(6,95,70,0.55))'
                : 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff',
              borderRadius: 12,
              padding: '10px 12px',
              fontSize: 13,
              fontWeight: 700,
              cursor: busy ? 'default' : 'pointer',
              opacity: busy ? 0.85 : 1,
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Registration'}
          </button>
        </form>

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
          If owner name is left blank, CAD will use your current character name automatically.
          <div style={{ marginTop: 6, opacity: 0.8 }}>Last vehicle load: {timestamp}</div>
        </div>
      </div>
    </div>
  );
}
