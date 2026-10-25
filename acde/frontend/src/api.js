const TOKEN_KEY = 'acde_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  register: (body) =>
    request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/api/auth/me'),
  dashboard: () => request('/api/dashboard'),
  listProjects: () => request('/api/projects'),
  createProject: (body) =>
    request('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
  getProject: (id) => request(`/api/projects/${id}`),
  deployProject: (id) =>
    request(`/api/projects/${id}/deploy`, { method: 'POST' }),
  stopProject: (id) =>
    request(`/api/projects/${id}/stop`, { method: 'POST' }),
  deleteProject: (id) =>
    request(`/api/projects/${id}`, { method: 'DELETE' }),
};
