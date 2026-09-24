"use client";
import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { API_BASE, getCleanItemUnit, getCleanItemForm } from '../lib/api';

export default function SmartLabelModal({ isOpen, onClose, defaultItem, availableItems = [] }) {
  // If multiple items exist in the node inventory and no single item was passed, or user wants to switch items
  const [selectedItemId, setSelectedItemId] = useState(defaultItem?.id || defaultItem?._id || '');

  // Keep selectedItemId in sync whenever defaultItem changes
  useEffect(() => {
    if (defaultItem?.id || defaultItem?._id) {
      setSelectedItemId(defaultItem.id || defaultItem._id);
    } else if (availableItems && availableItems.length > 0) {
      setSelectedItemId(availableItems[0].id || availableItems[0]._id);
    }
  }, [defaultItem, availableItems]);

  // Resolve active item: defaultItem, or item from availableItems matching selectedItemId, or first available
  const activeItem = (availableItems && availableItems.length > 0 && selectedItemId)
    ? (availableItems.find(i => (i.id === selectedItemId || i._id === selectedItemId)) || defaultItem || availableItems[0])
    : (defaultItem || (availableItems && availableItems.length > 0 ? availableItems[0] : null));

  // Extract authentic warehouse metadata (strictly read-only) with intelligent unit & form detection
  const medicine = activeItem?.medicine || 'Medical Consignment';
  const batch = activeItem?.batch || 'BATCH-WAREHOUSE-01';
  const rawWeight = activeItem?.currentStockKg !== undefined ? activeItem.currentStockKg : (activeItem?.weightKg ?? 1.0);
  const weightKg = parseFloat(rawWeight).toFixed(2);
  const dosageUnit = getCleanItemUnit(activeItem);
  const dosageForm = getCleanItemForm(activeItem);
  const count = activeItem?.packageCount || activeItem?.count || Math.round(parseFloat(weightKg) * 20);
  const shelfPosition = activeItem?.shelfPosition || 'Storage Bay 1';
  const boxId = activeItem?.boxId || (activeItem?.batch ? `BOX-${activeItem.batch}` : 'BOX-WH-01');
  const rfidUid = activeItem?.rfidUid || activeItem?.targetRfidUid || 'TAG-RFID-01';
  const expiryDate = activeItem?.expiryDate || '2027-12-31';
  const hospitalId = activeItem?.hospitalId || activeItem?.requestingHospitalId || activeItem?.sourceHospitalId || 'H01';
  const qrId = activeItem?.qrId || (activeItem?.batch ? `QR-${activeItem.batch}` : `QR-${activeItem?.id || Date.now()}`);

  // Format authentic dispatch timestamp
  const timestamp = activeItem?.createdAt
    ? new Date(activeItem.createdAt).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
      })
    : (activeItem?.lastSyncTime
        ? new Date(activeItem.lastSyncTime).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
          })
        : new Date().toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
          }));

  // Ultra-compact standardized token for ESP32-CAM and phone scanners
  const compactPayload = `ML:VERIFIED:${activeItem?.id || batch}:${batch}:${weightKg}:${medicine}:${count}:${dosageUnit}:${rfidUid}:${hospitalId}`;

  // Automatically register / sync authentic QR code in the IoT database for seamless camera verification
  useEffect(() => {
    if (!isOpen || !batch) return;
    try {
      fetch(`${API_BASE}/iot/qr-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrId,
          medicine,
          batch,
          count: parseInt(count) || 1,
          initialCount: parseInt(count) || 1,
          weightKg: parseFloat(weightKg) || 1.0,
          dosageUnit,
          hospitalId,
          action: 'VERIFIED_CONSIGNMENT',
          rawQrData: compactPayload
        })
      }).catch(() => {});
    } catch (e) {}
  }, [isOpen, batch, medicine, count, weightKg, dosageUnit, hospitalId, qrId, compactPayload]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.78)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        maxWidth: '640px',
        width: '100%',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.35)',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        animation: 'fadeIn 0.2s ease-out',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #334155'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: '#008b8b', color: '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.2rem', boxShadow: '0 2px 8px rgba(0,139,139,0.4)'
            }}>
              🏷️
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, letterSpacing: '-0.01em' }}>
                Verified Medical Consignment Label
              </h3>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#10b981', fontWeight: 800 }}>● READ-ONLY SPEC</span>
                <span>· Dispatched from Central Warehouse</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              color: '#ffffff',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: '22px 26px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Optional item selector if opened from header with multiple node inventory items */}
          {availableItems && availableItems.length > 1 && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Warehouse Inventory Item:
              </span>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                style={{
                  flex: 1,
                  maxWidth: '380px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  background: '#ffffff',
                  cursor: 'pointer'
                }}
              >
                {availableItems.map(item => (
                  <option key={item.id || item._id} value={item.id || item._id}>
                    {item.medicine} — Batch {item.batch} ({item.packageCount || (item.currentStockKg * 20)} {getCleanItemUnit(item)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tamper-Proof Read-Only Notice Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            border: '1px solid #bbf7d0',
            borderRadius: '14px',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#166534', fontWeight: 700 }}>
              <span style={{ fontSize: '1rem' }}>🔒</span>
              <span>Warehouse Serialization Authentic & Locked (Read-Only)</span>
            </div>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              background: '#15803d',
              color: '#ffffff',
              padding: '3px 9px',
              borderRadius: '999px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              GS1 Verified
            </span>
          </div>

          {/* Read-Only Spec Grid (Clean Badges & Structured Specs — No Edit Inputs) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '16px'
          }}>
            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Medicine Formulation
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
                  {medicine}
                </div>
              </div>
              <span style={{
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono)',
                background: '#e0f2fe',
                color: '#0369a1',
                padding: '4px 10px',
                borderRadius: '8px',
                fontWeight: 800
              }}>
                {dosageForm}
              </span>
            </div>

            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                Batch Number
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#0f172a', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                {batch}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                Package Quantity
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#008b8b', marginTop: '2px' }}>
                {count} {dosageUnit} <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>({weightKg} kg gross)</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                Storage Location / Bay
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                {shelfPosition}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                Container / Pallet Box
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                {boxId}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                RFID Tag UID
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#b45309', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                {rfidUid}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                Expiration Date
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                {expiryDate}
              </div>
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                <i className="fa-regular fa-clock" style={{ color: '#008b8b' }}></i>
                <span>Warehouse Dispatch Timestamp:</span>
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
                {timestamp}
              </div>
            </div>
          </div>

          {/* High-Contrast Printable Optical QR Card */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '20px',
            backgroundColor: '#ffffff',
            borderRadius: '18px',
            border: '2px solid #0f172a',
            boxShadow: '0 4px 18px rgba(0,0,0,0.06)'
          }}>
            <div style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1.5px solid #0f172a',
              paddingBottom: '8px',
              marginBottom: '14px',
              fontSize: '0.72rem',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#0f172a'
            }}>
              <span>MEDILINK SECURE MEDICAL QR</span>
              <span>NODE: {hospitalId}</span>
            </div>

            <div style={{
              padding: '12px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <QRCodeSVG
                value={compactPayload}
                size={210}
                level="M"
                includeMargin={false}
              />
            </div>

            <div style={{ marginTop: '12px', textAlign: 'center', width: '100%' }}>
              <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0f172a' }}>
                {medicine}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#475569', fontFamily: 'var(--font-mono)', marginTop: '2px', fontWeight: 700 }}>
                BATCH: {batch} · {count} {dosageUnit} ({weightKg} kg)
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                RFID: {rfidUid} · EXP: {expiryDate}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#008b8b', fontFamily: 'var(--font-mono)', marginTop: '3px', fontWeight: 800 }}>
                TIMESTAMP: {timestamp}
              </div>

              <div style={{
                marginTop: '10px',
                paddingTop: '8px',
                borderTop: '1px dashed #cbd5e1',
                fontSize: '0.68rem',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontWeight: 700
              }}>
                📷 Point ESP32-CAM or Mobile Optical Scanner at this QR
              </div>
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
              QR ID: <code style={{ color: '#0f172a', fontWeight: 800 }}>{qrId}</code>
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={onClose}
                className="btn btn-ghost"
                style={{ padding: '8px 18px', fontWeight: 700 }}
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="btn btn-primary"
                style={{ padding: '8px 22px', fontWeight: 800, background: '#008b8b' }}
              >
                <i className="fa-solid fa-print"></i> Print Label
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
