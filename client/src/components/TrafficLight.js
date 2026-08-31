"use client";
import React from 'react';

export default function TrafficLight({ state, statusText, detailText }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      <div className={`traffic-housing ${state === 'pass' ? 'state-pass' : state === 'fail' ? 'state-fail' : ''}`}>
        <div className={`traffic-bulb bulb-green`}>
          <i className="fa-solid fa-check"></i>
        </div>
        <div className={`traffic-bulb bulb-red`}>
          <i className="fa-solid fa-xmark"></i>
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.95rem',
          color: state === 'pass' ? '#10b981' : state === 'fail' ? '#dc2626' : state === 'scanning' ? '#0d9488' : '#64748b',
          marginBottom: '4px',
        }}>
          {state === 'scanning' && <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }}></i>}
          {statusText}
        </div>
        <div style={{ fontSize: '0.82rem', color: '#94a3b8', maxWidth: '400px' }}>{detailText}</div>
      </div>
    </div>
  );
}
