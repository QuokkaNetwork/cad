function expandShortHex(shortHex) {
  return shortHex
    .split('')
    .map((ch) => `${ch}${ch}`)
    .join('');
}

export function normalizeHexColor(value, fallback = '#64748b') {
  const text = String(value || '').trim();
  const longMatch = text.match(/^#([0-9a-fA-F]{6})$/);
  if (longMatch) return `#${longMatch[1].toLowerCase()}`;

  const shortMatch = text.match(/^#([0-9a-fA-F]{3})$/);
  if (shortMatch) return `#${expandShortHex(shortMatch[1].toLowerCase())}`;

  const fallbackMatch = String(fallback || '').trim().match(/^#([0-9a-fA-F]{6})$/);
  if (fallbackMatch) return `#${fallbackMatch[1].toLowerCase()}`;
  return '#64748b';
}

export function colorWithAlpha(value, alpha = 'ff') {
  const base = normalizeHexColor(value);
  const normalizedAlpha = String(alpha || '').trim();
  if (!/^[0-9a-fA-F]{2}$/.test(normalizedAlpha)) return `${base}ff`;
  return `${base}${normalizedAlpha.toLowerCase()}`;
}

function channelToLinear(channel) {
  const normalized = channel / 255;
  if (normalized <= 0.03928) return normalized / 12.92;
  return ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hexColor) {
  const hex = normalizeHexColor(hexColor).slice(1);
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);

  const r = channelToLinear(red);
  const g = channelToLinear(green);
  const b = channelToLinear(blue);

  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
}

export function getContrastTextColor(
  backgroundColor,
  {
    dark = '#0b1220',
    light = '#f8fafc',
    threshold = 0.56,
  } = {}
) {
  const luminance = relativeLuminance(backgroundColor);
  return luminance > threshold ? dark : light;
}

export function getHighContrastBadgeStyle(color, fallback = '#64748b') {
  const base = normalizeHexColor(color, fallback);
  return {
    backgroundColor: colorWithAlpha(base, 'd9'),
    color: getContrastTextColor(base),
    border: `1px solid ${colorWithAlpha(base, 'ff')}`,
    boxShadow: `0 0 0 1px ${colorWithAlpha(base, '66')}`,
  };
}
