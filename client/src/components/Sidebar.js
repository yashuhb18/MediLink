"use client";
import React from 'react';

const navConfig = {
  NETWORK_ADMIN: [
    { label: 'Warehouse Hub', icon: 'fa-warehouse', id: 'dashboard' },
    { label: 'QR & Batch Studio', icon: 'fa-qrcode', id: 'qr-studio' },
    { label: 'Consignment Outflow', icon: 'fa-truck-fast', id: 'consignments' },
    { label: 'Regional Grid', icon: 'fa-map-location-dot', id: 'heatmap' },
    { label: 'Hospital Nodes', icon: 'fa-hospital-user', id: 'nodes' },
    { label: 'Emergency Override', icon: 'fa-shield-halved', id: 'override' },
    { label: 'Sensor Hygiene', icon: 'fa-tower-broadcast', id: 'alerts' },
    { label: 'Audit Trail', icon: 'fa-receipt', id: 'audit' },
  ],
  CLINICAL_VIEWER: [
    { label: 'Dashboard', icon: 'fa-house', id: 'dashboard' },
    { label: 'Medicine Search', icon: 'fa-magnifying-glass', id: 'search' },
    { label: 'Inventory Directory', icon: 'fa-pills', id: 'inventory' },
  ],
  REQUESTING_SUPERVISOR: [
    { label: 'Hospital Inventory', icon: 'fa-boxes-stacked', id: 'inventory' },
    { label: 'AI Shortage Predictions', icon: 'fa-brain', id: 'predictions' },
    { label: 'Emergency Sourcing', icon: 'fa-truck-medical', id: 'manual' },
    { label: 'Incoming Requests', icon: 'fa-inbox', id: 'queue' },
    { label: 'Live GPS Fleet', icon: 'fa-satellite-dish', id: 'tracker' },
    { label: 'Karma Leaderboard', icon: 'fa-award', id: 'karma' },
    { label: 'Audit History', icon: 'fa-clock-rotate-left', id: 'audit' },
  ],
  SOURCE_SUPERVISOR: [
    { label: 'Hospital Inventory', icon: 'fa-boxes-stacked', id: 'inventory' },
    { label: 'AI Shortage Predictions', icon: 'fa-brain', id: 'predictions' },
    { label: 'Emergency Sourcing', icon: 'fa-truck-medical', id: 'manual' },
    { label: 'Incoming Requests', icon: 'fa-inbox', id: 'queue' },
    { label: 'Live GPS Fleet', icon: 'fa-satellite-dish', id: 'tracker' },
    { label: 'Karma Leaderboard', icon: 'fa-award', id: 'karma' },
    { label: 'Audit History', icon: 'fa-clock-rotate-left', id: 'audit' },
  ],
  DISPATCH_PHARMACIST: [
    { label: 'Dashboard', icon: 'fa-house', id: 'dashboard' },
    { label: 'Dispatch Workstation', icon: 'fa-truck-ramp-box', id: 'picklist' },
    { label: 'Dual Verification', icon: 'fa-shield-check', id: 'verify' },
    { label: 'IoT Terminal', icon: 'fa-microchip', id: 'iot' },
  ],
};

export default function Sidebar({ user, activeSection, onSectionChange }) {
  if (!user) return null;

  const items = navConfig[user.role] || [];

  const handleLogout = () => {
    localStorage.removeItem('medilink_token');
    localStorage.removeItem('medilink_user');
    window.location.href = '/';
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <a href="/" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/medilink-logo-transparent.png" alt="MediLink" />
        </a>
      </div>

      <nav className="sidebar-nav">
        {items.map(item => (
          <button
            key={item.id}
            className={`sidebar-item ${activeSection === item.id ? 'active' : ''}`}
            onClick={() => onSectionChange?.(item.id)}
          >
            <i className={`fa-solid ${item.icon}`} style={{ color: activeSection === item.id ? '#008b8b' : '#94a3b8' }}></i>
            <span>{item.label}</span>
          </button>
        ))}

        <div style={{ flex: 1 }}></div>

        <div className="sidebar-help-card">
          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#ffffff', color: '#008b8b', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', fontSize: '0.85rem' }}>
            <i className="fa-solid fa-headset"></i>
          </div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>Need Help?</div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '6px' }}>Contact Grid Support</div>
          <a href="#contact" style={{ fontSize: '0.7rem', fontWeight: 700, color: '#008b8b', background: '#ffffff', padding: '3px 10px', borderRadius: '9999px', display: 'inline-block', border: '1px solid #d1e5e3' }}>
            Contact Support
          </a>
        </div>

        <button className="sidebar-item" onClick={handleLogout} style={{ color: '#ef4444' }}>
          <i className="fa-solid fa-arrow-right-from-bracket" style={{ color: '#ef4444' }}></i>
          <span>Log Out</span>
        </button>
      </nav>
    </aside>
  );
}
