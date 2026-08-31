"use client";
import React from 'react';

export default function PortalHeader({ user, title, subtitle, impersonating, onExitImpersonation }) {
  if (!user) return null;

  return (
    <>
      {impersonating && (
        <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '8px 32px', color: '#ef4444', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <i className="fa-solid fa-user-ninja"></i> IMPERSONATING: <strong>{impersonating.supervisorName}</strong> ({impersonating.hospitalId})
          </div>
          <button className="btn btn-danger btn-sm" onClick={onExitImpersonation}>
            Exit Impersonation
          </button>
        </div>
      )}

      <header className="topbar">
        <div className="topbar-left">
          <h2>{title || `Welcome back, ${user.name || 'User'} 👋`}</h2>
          <p>{subtitle || "Here's what's happening across your hospital network today."}</p>
        </div>

        <div className="topbar-right">
          <button style={{
            width: '38px', height: '38px', borderRadius: '50%',
            background: '#f4f8f8', border: '1px solid #e2efee',
            color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer'
          }}>
            <i className="fa-solid fa-bell" style={{ fontSize: '0.88rem' }}></i>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px 4px 4px', borderRadius: '9999px', background: '#f4f8f8', border: '1px solid #e2efee' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: '#008b8b', color: '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '0.75rem'
            }}>
              {user.initials || user.name?.substring(0,2).toUpperCase() || 'RK'}
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>{user.name}</div>
              <div style={{ fontSize: '0.68rem', color: '#008b8b', fontWeight: 600 }}>{user.hospitalId || 'Admin'}</div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
