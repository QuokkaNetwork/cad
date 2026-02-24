const CAD_BRIDGE_RESOURCE = 'cad_bridge';

export async function fetchCadBridgeNui(eventName, data) {
  const resp = await fetch(`https://${CAD_BRIDGE_RESOURCE}/${eventName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(data || {}),
  });

  const text = await resp.text();
  try {
    return JSON.parse(text || '{}');
  } catch {
    return { ok: false, error: 'invalid_json', message: text || 'Invalid response from CAD bridge' };
  }
}
