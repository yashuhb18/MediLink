export const API_BASE = (() => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Localhost, loopback, or any IPv4 LAN address (e.g. 192.168.x.x, 10.x.x.x, 172.x.x.x)
    if (host === 'localhost' || host === '127.0.0.1' || /^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
      return `${window.location.protocol}//${host}:5000/api`;
    }
    // Cloudflare tunnel, ngrok, localtunnel, etc.
    if (host.includes('trycloudflare.com') || host.includes('ngrok') || host.includes('loca.lt')) {
      return `${window.location.origin}/api`;
    }
  }
  return 'https://medilink-i8km.onrender.com/api';
})();

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
  getAvailableNodes: (medicine, requestingHospitalId) =>
    apiFetch(`/transfers/available-nodes?medicine=${encodeURIComponent(medicine || '')}&requestingHospitalId=${requestingHospitalId || 'H01'}`),
  aiSuggest: (medicine, requiredKg, requestingHospitalId, urgency) =>
    apiFetch('/transfers/ai-suggest', { method: 'POST', body: JSON.stringify({ medicine, requiredKg, requestingHospitalId, urgency }) }),
  createTransfer: (data) => apiFetch('/transfers', { method: 'POST', body: JSON.stringify(data) }),
  acceptTransfer: (id) => apiFetch(`/transfers/${id}/accept`, { method: 'PUT' }),
  rejectTransfer: (id, reason) => apiFetch(`/transfers/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason }) }),
  assignDriver: (id, driverData) => apiFetch(`/transfers/${id}/assign-driver`, { method: 'PUT', body: JSON.stringify(driverData) }),
  updateTransit: (id, transitData) => apiFetch(`/transfers/${id}/update-transit`, { method: 'PUT', body: JSON.stringify(transitData) }),
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
  updateHospital: (id, updates) => apiFetch(`/hospitals/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  createBatch: (data) => apiFetch('/admin/create-batch', { method: 'POST', body: JSON.stringify(data) }),
  getConsignments: () => apiFetch('/admin/consignments')
};

export const aiApi = {
  getStatus: () => apiFetch('/ai/status'),
  chat: (message, hospitalId, role) => apiFetch('/ai/chat', { method: 'POST', body: JSON.stringify({ message, hospitalId, role }) }),
  explainPrediction: (prediction) => apiFetch('/ai/explain', { method: 'POST', body: JSON.stringify({ prediction }) })
};

export const cameraApi = {
  getLatestImages: () => apiFetch('/upload/latest'),
  executeAction: (data) => apiFetch('/iot/execute-action', { method: 'POST', body: JSON.stringify(data) })
};

export function getCleanItemUnit(item) {
  if (!item) return 'Strips';
  const unit = item.dosageUnit;
  if (unit && unit !== 'Strips' && unit !== 'Units') return unit;
  const m = (item.medicine || '').toLowerCase();
  if (m.includes('syr') || m.includes('cough') || m.includes('cug') || m.includes('liquid') || m.includes('suspension') || m.includes('solution') || m.includes('oral')) {
    return 'Bottles';
  }
  if (m.includes('inj') || m.includes('vial') || m.includes('vaccine') || m.includes('ampoule') || m.includes('infusion')) {
    return 'Vials';
  }
  if (m.includes('cream') || m.includes('gel') || m.includes('ointment') || m.includes('tube')) {
    return 'Tubes';
  }
  if (m.includes('drop') || m.includes('eye') || m.includes('ear')) {
    return 'Dropper Bottles';
  }
  if (m.includes('powder') || m.includes('ors') || m.includes('sachet')) {
    return 'Sachets';
  }
  return unit || 'Strips';
}

export function getCleanItemForm(item) {
  if (!item) return 'Tablets';
  const form = item.dosageForm;
  if (form && form !== 'Tablets') return form;
  const m = (item.medicine || '').toLowerCase();
  if (m.includes('syr') || m.includes('cough') || m.includes('cug') || m.includes('liquid') || m.includes('suspension')) {
    return 'Syrups';
  }
  if (m.includes('inj') || m.includes('vial') || m.includes('vaccine') || m.includes('infusion')) {
    return 'Injections';
  }
  if (m.includes('cream') || m.includes('gel') || m.includes('ointment')) {
    return 'Ointments';
  }
  if (m.includes('powder') || m.includes('ors')) {
    return 'Bulk Powders';
  }
  return form || 'Tablets';
}


