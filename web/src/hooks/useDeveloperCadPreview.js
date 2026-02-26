import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const STORAGE_KEY = 'cad:developer_ui_preview_enabled';
const CHANGE_EVENT = 'cad:developer-ui-preview-changed';

function readEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === '1' || raw === 'true';
  } catch {
    return false;
  }
}

function writeEnabled(nextValue) {
  if (typeof window === 'undefined') return;
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
  const { isAdmin } = useAuth();
  const [enabled, setEnabledState] = useState(readEnabled);
  const previewAvailable = !!isAdmin;

  useEffect(() => {
    if (!previewAvailable || typeof window === 'undefined') {
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
  }, [previewAvailable]);

  const setEnabled = useCallback((nextValue) => {
    const next = !!nextValue && previewAvailable;
    setEnabledState(next);
    writeEnabled(next);
    emitChange(next);
  }, [previewAvailable]);

  const toggle = useCallback(() => {
    setEnabled(!enabled);
  }, [enabled, setEnabled]);

  return {
    available: previewAvailable,
    enabled: previewAvailable && enabled,
    setEnabled,
    toggle,
  };
}
