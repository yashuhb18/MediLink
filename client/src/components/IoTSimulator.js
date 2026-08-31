"use client";
import React, { useState } from 'react';

export default function IoTSimulator({ activeRequestId = 'REQ-1001', inventoryItemId = 'INV-201', onSimulatedUpdate }) {
  const [weightKg, setWeightKg] = useState('1.0');
  const [rfidUid, setRfidUid] = useState('A101-B');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const triggerWeightUpdate = async () => {
    setLoading(true);
    setStatus('Transmitting Barcode Laser Scanner telemetry...');
    try {
      const res = await fetch('http://localhost:5000/api/iot/weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryItemId, weightKg: parseFloat(weightKg) })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`🟢 Barcode verified: Batch code synced to ${inventoryItemId}`);
        if (onSimulatedUpdate) onSimulatedUpdate();
      } else {
        setStatus(`🔴 Telemetry Error: ${data.error}`);
      }
    } catch (err) {
      setStatus(`🔴 Transmission failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const triggerRfidTap = async () => {
    setLoading(true);
    setStatus('Transmitting MFRC522 RFID + Barcode Scanner payload...');
    try {
      const res = await fetch('http://localhost:5000/api/iot/verify-tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: activeRequestId, scannedRfidUid: rfidUid, measuredWeightKg: parseFloat(weightKg) })
      });
      const data = await res.json();
      if (res.ok) {
        const pass = data.trafficLightState === 'pass';
        setStatus(pass ? '🟢 RFID + Barcode Scanner Dual-Lock PASSED! Green Light Active.' : '🔴 Verification Mismatch! Box Locked.');
        if (onSimulatedUpdate) onSimulatedUpdate();
      } else {
        setStatus(`🔴 Hardware Error: ${data.error}`);
      }
    } catch (err) {
      setStatus(`🔴 Tap failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: '#070a0f',
      color: '#ffffff',
      borderRadius: 'var(--radius-xl)',
      padding: '1.5rem 1.75rem',
      border: '1px solid var(--border-glow)',
      boxShadow: 'var(--shadow-lg), var(--glow-cyan)',
      marginTop: '2rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fa-solid fa-microchip" style={{ color: 'var(--neon-cyan)', fontSize: '1.3rem' }}></i>
          <div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#ffffff' }}>Physical IoT Hardware Terminal (ESP32 Workstation Simulator)</h4>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>MFRC522 RFID SPI + Laser Barcode Scanner Dual Telemetry</div>
          </div>
        </div>
        <span className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="pulse-dot"></span> ESP32 Wi-Fi Ready
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>

        {/* Barcode Scanner Controls */}
        <div style={{ background: 'var(--bg-surface-1)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--neon-emerald)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            <i className="fa-solid fa-barcode" style={{ marginRight: '6px' }}></i> Laser Barcode Scanner Batch Code
          </label>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <input
              type="text"
              className="form-input mono"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.9rem' }}
              value={weightKg}
              onChange={e => setWeightKg(e.target.value)}
            />
            <button
              className="btn btn-success btn-sm"
              style={{ fontWeight: 800, whiteSpace: 'nowrap' }}
              onClick={triggerWeightUpdate}
              disabled={loading}
            >
              Scan Barcode
            </button>
          </div>
        </div>

        {/* RFID Reader Controls */}
        <div style={{ background: 'var(--bg-surface-1)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--neon-cyan)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            <i className="fa-solid fa-id-card" style={{ marginRight: '6px' }}></i> RC522 RFID Tag UID
          </label>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <input
              type="text"
              className="form-input mono"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.9rem' }}
              value={rfidUid}
              onChange={e => setRfidUid(e.target.value)}
            />
            <button
              className="btn btn-primary btn-sm"
              style={{ fontWeight: 800, whiteSpace: 'nowrap' }}
              onClick={triggerRfidTap}
              disabled={loading}
            >
              Tap RFID Card
            </button>
          </div>
        </div>

      </div>

      {status && (
        <div style={{
          fontSize: '0.85rem',
          fontWeight: 700,
          background: 'var(--bg-surface-1)',
          border: '1px solid var(--border-default)',
          padding: '8px 14px',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)'
        }}>
          {status}
        </div>
      )}
    </div>
  );
}
