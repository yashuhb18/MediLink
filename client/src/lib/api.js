const API_BASE = 'http://localhost:5000/api';

export async function apiFetch(endpoint, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('medilink_token') : null;

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const config = {
    ...options,
    headers
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined' && !endpoint.includes('/auth/login')) {
      localStorage.removeItem('medilink_token');
      localStorage.removeItem('medilink_user');
      if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    throw new Error(data.error || 'API Request Failed');
  }

  return data;
}

export const authApi = {
  login: (email, password) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getMe: () => apiFetch('/auth/me')
};

export const inventoryApi = {
  getInventory: (hospitalId) => apiFetch(`/inventory${hospitalId ? `?hospitalId=${hospitalId}` : ''}`),
  search: (query, viewerHospitalId) => apiFetch(`/inventory/search?medicine=${encodeURIComponent(query || '')}&viewerHospitalId=${viewerHospitalId || ''}`),
  getPredictions: (hospitalId) => apiFetch(`/inventory/predictions/${hospitalId}`),
  updateWeight: (id, weightKg) => apiFetch(`/inventory/${id}/weight`, { method: 'PUT', body: JSON.stringify({ weightKg }) })
};

export const transferApi = {
  getTransfers: (hospitalId, role, status) => {
    const params = new URLSearchParams();
    if (hospitalId) params.append('hospitalId', hospitalId);
    if (role) params.append('role', role);
    if (status) params.append('status', status);
    return apiFetch(`/transfers?${params.toString()}`);
  },
  aiSuggest: (medicine, requiredKg, requestingHospitalId, urgency) =>
    apiFetch('/transfers/ai-suggest', { method: 'POST', body: JSON.stringify({ medicine, requiredKg, requestingHospitalId, urgency }) }),
  createTransfer: (data) => apiFetch('/transfers', { method: 'POST', body: JSON.stringify(data) }),
  acceptTransfer: (id) => apiFetch(`/transfers/${id}/accept`, { method: 'PUT' }),
  rejectTransfer: (id, reason) => apiFetch(`/transfers/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason }) }),
  verifyTransfer: (id, scannedRfidUid, measuredWeightKg) =>
    apiFetch(`/transfers/${id}/verify`, { method: 'PUT', body: JSON.stringify({ scannedRfidUid, measuredWeightKg }) }),
  dispatchTransfer: (id) => apiFetch(`/transfers/${id}/dispatch`, { method: 'PUT' })
};

export const karmaApi = {
  getScore: (hospitalId) => apiFetch(`/karma/${hospitalId}`),
  getRankings: () => apiFetch('/karma')
};

export const adminApi = {
  getHeatmap: () => apiFetch('/admin/heatmap'),
  forceApprove: (requestId, reason) => apiFetch(`/admin/force-approve/${requestId}`, { method: 'POST', body: JSON.stringify({ reason }) }),
  impersonate: (hospitalId, supervisorName) => apiFetch('/admin/impersonate', { method: 'POST', body: JSON.stringify({ hospitalId, supervisorName }) }),
  getAuditLog: () => apiFetch('/admin/audit-log'),
  getSensorAlerts: () => apiFetch('/admin/sensor-alerts'),
  updateHospital: (id, updates) => apiFetch(`/hospitals/${id}`, { method: 'PUT', body: JSON.stringify(updates) })
};

export const aiApi = {
  getStatus: () => apiFetch('/ai/status'),
  chat: (message, hospitalId, role) => apiFetch('/ai/chat', { method: 'POST', body: JSON.stringify({ message, hospitalId, role }) }),
  explainPrediction: (prediction) => apiFetch('/ai/explain', { method: 'POST', body: JSON.stringify({ prediction }) })
};

export const cameraApi = {
  getLatestImages: () => apiFetch('/upload/latest')
};


