"use client";
import React from 'react';

export default function HeatmapGrid({ hospitals, heatmapData }) {
  if (!hospitals || hospitals.length === 0 || !heatmapData || heatmapData.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '36px', textAlign: 'center' }}>
        <i className="fa-solid fa-map fa-2x" style={{ color: '#008b8b', marginBottom: '8px' }}></i>
        <p style={{ color: '#64748b', fontWeight: 600 }}>Loading regional availability matrix...</p>
      </div>
    );
  }

  // Handle both array of rows or flat array
  const isRowBased = heatmapData[0] && heatmapData[0].medicine && !heatmapData[0].hospitalId;
  const medicines = isRowBased ? heatmapData.map(d => d.medicine) : [...new Set(heatmapData.map(d => d.medicine))];

  const getCellData = (hospitalId, medName) => {
    if (isRowBased) {
      const row = heatmapData.find(d => d.medicine === medName);
      return row ? row[hospitalId] : null;
    }
    return heatmapData.find(d => d.hospitalId === hospitalId && d.medicine === medName);
  };

  const getCellBadge = (cell) => {
    if (!cell || cell.status === 'NONE') {
      return <span style={{ color: '#94a3b8', background: '#f8fafc', padding: '4px 10px', borderRadius: '6px', fontSize: '0.76rem', border: '1px solid #e2e8f0' }}>— Out of Stock</span>;
    }

    const status = cell.status;
    const color = cell.color || cell.statusColor;
    const qty = cell.currentKg !== undefined ? `${cell.currentKg.toFixed(1)} kg` : cell.level || 'In Stock';

    if (status === 'EXPIRED' || color === 'black' || color === 'expired') {
      return (
        <span style={{ background: '#f1f5f9', color: '#64748b', padding: '4px 10px', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 700, border: '1px solid #cbd5e1' }}>
          <i className="fa-solid fa-ban" style={{ marginRight: '4px' }}></i> {qty} (Expired)
        </span>
      );
    }
    if (status === 'CRITICAL' || status === 'OUT' || color === 'red') {
      return (
        <span style={{ background: '#fef2f2', color: '#dc2626', padding: '4px 10px', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 800, border: '1px solid #fecaca' }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '4px' }}></i> {qty} (Critical)
        </span>
      );
    }
    if (status === 'LOW' || color === 'yellow') {
      return (
        <span style={{ background: '#fffbeb', color: '#d97706', padding: '4px 10px', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 700, border: '1px solid #fde68a' }}>
          <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '4px' }}></i> {qty} (Low)
        </span>
      );
    }
    return (
      <span style={{ background: '#ecfdf5', color: '#10b981', padding: '4px 10px', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 700, border: '1px solid #a7f3d0' }}>
        <i className="fa-solid fa-circle-check" style={{ marginRight: '4px' }}></i> {qty} (Healthy)
      </span>
    );
  };

  return (
    <div className="table-wrapper" style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ minWidth: '160px' }}>Hospital Node</th>
            {medicines.map(m => (
              <th key={m} style={{ minWidth: '150px' }}>{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hospitals.map(h => (
            <tr key={h.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: h.active !== false ? '#10b981' : '#ef4444' }} />
                  <strong style={{ fontFamily: 'var(--font-mono)', color: '#0f172a', fontSize: '0.88rem' }}>{h.code || h.id}</strong>
                </div>
              </td>
              {medicines.map(m => {
                const cell = getCellData(h.id, m);
                return (
                  <td key={m}>
                    {getCellBadge(cell)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
