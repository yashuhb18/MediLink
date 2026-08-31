"use client";
import React from 'react';

export default function KarmaGauge({ score, label }) {
  const clampedScore = Math.min(100, Math.max(0, score || 0));
  const tier = clampedScore >= 70 ? 'high' : clampedScore >= 40 ? 'mid' : 'low';
  const color = tier === 'high' ? '#10b981' : tier === 'mid' ? '#d97706' : '#dc2626';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px 0' }}>
      <div style={{
        width: '100px', height: '100px', borderRadius: '50%',
        border: `5px solid ${color}20`,
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="100" height="100" viewBox="0 0 100 100" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r="44" fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${(clampedScore / 100) * 276.46} 276.46`}
            strokeLinecap="round"
          />
        </svg>
        <span style={{ fontSize: '1.5rem', fontWeight: 800, color, zIndex: 1 }}>{clampedScore}</span>
      </div>
      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{label || 'Karma Points'}</span>
    </div>
  );
}
