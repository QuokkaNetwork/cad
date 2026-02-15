const TOKEN_KEY = 'cad_token_legacy';

class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status || 0;
    this.error = options.error || '';
    this.details = options.details;
  }
}

export function setToken(token) {
  if (token) {
    // Legacy no-op: auth is cookie-based now.
  }
}

export function getToken() {
  return null;
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, { ...options, headers, credentials: 'include' });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const pieces = [];
    if (err.error) pieces.push(err.error);
    if (err.message) pieces.push(err.message);
    const message = pieces.join(': ') || 'Request failed';
    throw new ApiError(message, {
      status: res.status,
      error: err.error,
      details: err.details,
    });
  }

  return res.json();
}

export const api = {
  get: (url) => request(url),
  post: (url, data) => request(url, { method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data) }),
  patch: (url, data) => request(url, { method: 'PATCH', body: data instanceof FormData ? data : JSON.stringify(data) }),
  put: (url, data) => request(url, { method: 'PUT', body: data instanceof FormData ? data : JSON.stringify(data) }),
  delete: (url) => request(url, { method: 'DELETE' }),
};

export { ApiError };
