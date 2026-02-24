export const UNIT_DUTY_CHANGED_EVENT = 'cad:unit-duty-changed';

export function emitUnitDutyChanged(detail = {}) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    window.dispatchEvent(new CustomEvent(UNIT_DUTY_CHANGED_EVENT, {
      detail: {
        ...detail,
        emitted_at: Date.now(),
      },
    }));
  } catch {
    // Ignore environments without CustomEvent support.
  }
}

