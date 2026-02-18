function pad2(value) {
  return String(value).padStart(2, '0');
}

function parseDateOnlyString(text) {
  const value = String(text || '').trim();
  if (!value) return '';

  const auMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (auMatch) {
    return `${auMatch[1]}/${auMatch[2]}/${auMatch[3]}`;
  }

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  return '';
}

function parseDateTimeValue(value) {
  if (!value && value !== 0) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const text = String(value || '').trim();
  if (!text) return null;

  const sqliteMatch = text.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/);
  if (sqliteMatch) {
    const parsed = new Date(`${sqliteMatch[1]}T${sqliteMatch[2]}Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatDateAU(value, fallback = '-') {
  const dateOnly = parseDateOnlyString(value);
  if (dateOnly) return dateOnly;

  const parsed = parseDateTimeValue(value);
  if (!parsed) return fallback;
  const day = pad2(parsed.getDate());
  const month = pad2(parsed.getMonth() + 1);
  const year = String(parsed.getFullYear());
  return `${day}/${month}/${year}`;
}

export function formatTimeAU(value, fallback = '-', includeSeconds = true) {
  const parsed = parseDateTimeValue(value);
  if (!parsed) return fallback;
  return parsed.toLocaleTimeString('en-AU', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
  });
}

export function formatDateTimeAU(value, fallback = '-', includeSeconds = true) {
  const parsed = parseDateTimeValue(value);
  if (!parsed) return fallback;
  const date = formatDateAU(parsed, '');
  const time = formatTimeAU(parsed, '', includeSeconds);
  if (!date && !time) return fallback;
  if (!date) return time || fallback;
  if (!time) return date || fallback;
  return `${date} ${time}`;
}
