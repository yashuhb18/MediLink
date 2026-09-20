"use client";
import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function SmartLabelModal({ isOpen, onClose, defaultItem }) {
  const [medicine, setMedicine] = useState(defaultItem?.medicine || 'Paracetamol 500mg');
  const [batch, setBatch] = useState(defaultItem?.batch || 'PA-902');
  const [weightKg, setWeightKg] = useState(defaultItem?.weightKg || defaultItem?.currentStockKg || 1.0);
  const [count, setCount] = useState(defaultItem?.packageCount || defaultItem?.count || 1);
  const [action, setAction] = useState('ADD');
  const [requestId, setRequestId] = useState(defaultItem?.requestId || defaultItem?.id || '');
  const [sourceHospital, setSourceHospital] = useState('H02');
  const [destHospital, setDestHospital] = useState('H01');

  const qrId = defaultItem?.qrId || (batch ? `QR-${batch}` : `QR-${Date.now()}`);

  // Register or sync QR code with backend whenever generated
  React.useEffect(() => {
    if (isOpen && batch) {
      fetch('http://localhost:5000/api/iot/qr-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrId,
          medicine,
          batch,
          count: parseInt(count) || 1,
          initialCount: parseInt(count) || 1,
          weightKg: parseFloat(weightKg) || 1.0,
          hospitalId: destHospital,
          action
        })
      }).catch(() => {});
    }
  }, [isOpen, batch, medicine, count, weightKg, action, destHospital, qrId]);

  if (!isOpen) return null;

  // Ultra-compact token: ML:ACTION:REQUEST_ID:BATCH:WEIGHT:MEDICINE:COUNT:QR_ID
  const compactPayload = `ML:${action}:${requestId || 'REQ-1001'}:${batch || 'PA-902'}:${weightKg || '1.0'}:${medicine || 'Paracetamol'}:${count}:${qrId}`;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        maxWidth: '560px',
        width: '100%',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          background: 'linear-gradient(135deg, #008b8b 0%, #005f5f 100%)',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.2rem' }}>🏷️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Smart Optical QR Label Generator</h3>
              <div style={{ fontSize: '0.74rem', opacity: 0.9 }}>Point ESP32-CAM at this screen (Header ADD increments, REMOVE decrements)</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#ffffff', fontSize: '1.2rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Default Action Workflow
              </label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}
              >
                <option value="ADD">📥 ADD (Restock / +1 Count)</option>
                <option value="REMOVE">💊 REMOVE (Dispense / -1 Count)</option>
                <option value="TRANSFER_DISPATCH">📦 Inter-Hospital Dispatch</option>
                <option value="TRANSFER_RECEIVE">✅ Inter-Hospital Receipt</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Medicine Name
              </label>
              <input
                type="text"
                value={medicine}
                onChange={(e) => setMedicine(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Batch Number
              </label>
              <input
                type="text"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Active Count Variable
              </label>
              <input
                type="number"
                min="0"
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value) || 0)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #008b8b', fontSize: '0.85rem', fontWeight: 800, color: '#008b8b' }}
              />
            </div>
          </div>

          {/* High-Contrast Printable QR Card */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '20px',
            backgroundColor: '#f8fafc',
            borderRadius: '16px',
            border: '2px dashed #94a3b8'
          }}>
            <div style={{
              padding: '16px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}>
              <QRCodeSVG
                value={compactPayload}
                size={220}
                level="L"
                includeMargin={true}
              />
              <div style={{ marginTop: '10px', textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{medicine}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                  Batch: {batch} | Weight: {weightKg} kg
                </div>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '6px' }}>
                  <div style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: '#e6f7f6',
                    color: '#008b8b',
                    fontSize: '0.72rem',
                    fontWeight: 800
                  }}>
                    Count: {count}
                  </div>
                  <div style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    fontSize: '0.7rem',
                    fontWeight: 700
                  }}>
                    {action}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '14px', fontSize: '0.78rem', color: '#475569', textAlign: 'center', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="pulse-dot-teal" style={{ width: '6px', height: '6px' }} />
              Ready for ESP32-CAM optical capture (Header ADD: Count+1, REMOVE: Count-1)
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              onClick={onClose}
              className="btn btn-ghost"
            >
              Close
            </button>
            <button
              onClick={() => window.print()}
              className="btn btn-primary"
            >
              <i className="fa-solid fa-print"></i> Print Label
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
