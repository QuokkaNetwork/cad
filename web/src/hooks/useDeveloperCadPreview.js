import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'cad:developer_ui_preview_enabled';
const CHANGE_EVENT = 'cad:developer-ui-preview-changed';
const ENV = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};

const DEV_PREVIEW_AVAILABLE = (
  ENV.DEV === true
  || String(ENV.VITE_ENABLE_DEVELOPER_UI_PREVIEW || '').trim().toLowerCase() === 'true'
);

function readEnabled() {
  if (!DEV_PREVIEW_AVAILABLE) return false;
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === '1' || raw === 'true';
  } catch {
    return false;
  }
}

function writeEnabled(nextValue) {
  if (!DEV_PREVIEW_AVAILABLE || typeof window === 'undefined') return;
  try {
    if (nextValue) {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures in restricted environments.
  }
}

function emitChange(nextValue) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { enabled: !!nextValue } }));
  } catch {
    // Ignore if CustomEvent is unavailable.
  }
}

export function useDeveloperCadPreview() {
  const [enabled, setEnabledState] = useState(readEnabled);

  useEffect(() => {
    if (!DEV_PREVIEW_AVAILABLE || typeof window === 'undefined') {
      setEnabledState(false);
      return undefined;
    }

    const sync = () => setEnabledState(readEnabled());
    const onStorage = (event) => {
      if (event?.key && event.key !== STORAGE_KEY) return;
      sync();
    };

    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setEnabled = useCallback((nextValue) => {
    const next = !!nextValue && DEV_PREVIEW_AVAILABLE;
    setEnabledState(next);
    writeEnabled(next);
    emitChange(next);
  }, []);

  const toggle = useCallback(() => {
    setEnabled(!enabled);
  }, [enabled, setEnabled]);

  return {
    available: DEV_PREVIEW_AVAILABLE,
    enabled: DEV_PREVIEW_AVAILABLE && enabled,
    setEnabled,
    toggle,
  };
}
