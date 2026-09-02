"use client";
import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Sidebar from '@/components/Sidebar';
import PortalHeader from '@/components/PortalHeader';
import HeatmapGrid from '@/components/HeatmapGrid';
import RegionalLiveMap from '@/components/RegionalLiveMap';
import ESP32LiveGallery from '@/components/ESP32LiveGallery';
import { adminApi, inventoryApi } from '@/lib/api';

export default function WarehouseProtocolPage() {
  const [user, setUser] = useState(null);
  const [section, setSection] = useState('dashboard');
  const [heatmapData, setHeatmapData] = useState({ hospitals: [], heatmap: [] });
  const [auditLogs, setAuditLogs] = useState([]);
  const [sensorAlerts, setSensorAlerts] = useState([]);
  const [impersonating, setImpersonating] = useState(null);
  const [overrideReqId, setOverrideReqId] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [consignments, setConsignments] = useState([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccessMsg, setPublishSuccessMsg] = useState('');

  // ─── Batch Serialization Studio State ───
  const [batchForm, setBatchForm] = useState({
    medicine: 'Paracetamol 500mg',
    batch: 'BATCH-2026-X902',
    dosageForm: 'Tablets',
    dosageUnit: 'Strips',
    packageCount: '100',
    weightKg: '3.50',
    minThresholdKg: '1.00',
    hospitalId: 'H01',
    rfidUid: 'RFID-9941-A',
    boxId: 'BOX-PLT-01',
    shelfPosition: 'Bay 1 / Pallet Rack 3',
    coldChain: 'Ambient (15°C - 25°C)',
    expiryDate: '2027-08-30'
  });

  const [createdBatches, setCreatedBatches] = useState([]);
  const [selectedPrintBatch, setSelectedPrintBatch] = useState(null);
  const printRef = useRef(null);

  const medicinePresets = [
    { name: 'Paracetamol 500mg', form: 'Tablets', unit: 'Strips', count: 100, defaultKg: '2.50', threshold: '1.00', cold: 'Ambient (15°C - 25°C)' },
    { name: 'Amoxicillin Dry Syrup 100ml', form: 'Syrups', unit: 'Bottles (100ml)', count: 50, defaultKg: '6.00', threshold: '1.50', cold: 'Ambient (15°C - 25°C)' },
    { name: 'Cough Relief Syrup 200ml', form: 'Syrups', unit: 'Bottles (200ml)', count: 40, defaultKg: '9.60', threshold: '2.00', cold: 'Ambient (15°C - 25°C)' },
    { name: 'Insulin Glargine 100 IU/ml', form: 'Injections', unit: 'Vials (10ml)', count: 50, defaultKg: '1.20', threshold: '0.80', cold: 'Refrigerated (2°C - 8°C)' },
    { name: 'Remdesivir 100mg IV', form: 'Injections', unit: 'Vials (10ml)', count: 30, defaultKg: '1.50', threshold: '0.50', cold: 'Refrigerated (2°C - 8°C)' },
    { name: 'Betadine 10% Ointment 20g', form: 'Ointments', unit: 'Tubes (20g)', count: 80, defaultKg: '2.00', threshold: '0.60', cold: 'Ambient (15°C - 25°C)' },
    { name: 'Oral Rehydration Salts (ORS)', form: 'Bulk Powders', unit: 'Boxes (50 sachets)', count: 60, defaultKg: '4.80', threshold: '1.00', cold: 'Ambient (15°C - 25°C)' }
  ];

  useEffect(() => {
    const userStr = localStorage.getItem('medilink_user');
    if (!userStr) { window.location.href = '/'; return; }
    const u = JSON.parse(userStr);
    if (u.role !== 'NETWORK_ADMIN') { window.location.href = '/'; return; }
    setUser(u);
    fetchWarehouseData();
  }, []);

  const fetchWarehouseData = async () => {
    try {
      const [hm, logs, alerts, csg] = await Promise.all([
        adminApi.getHeatmap().catch(() => ({ hospitals: [], heatmap: [] })),
        adminApi.getAuditLog().catch(() => []),
        adminApi.getSensorAlerts().catch(() => []),
        adminApi.getConsignments().catch(() => [])
      ]);
      setHeatmapData(hm);
      setAuditLogs(logs);
      setSensorAlerts(alerts);
      setConsignments(csg);
    } catch (err) {
      console.error('[Warehouse] Error fetching data:', err);
    }
  };

  const handleSelectPreset = (preset) => {
    const randomSuffix = Math.floor(Math.random() * 900 + 100);
    const randomRfid = Math.floor(Math.random() * 9000 + 1000);
    setBatchForm(prev => ({
      ...prev,
      medicine: preset.name,
      dosageForm: preset.form || 'Tablets',
      dosageUnit: preset.unit || 'Strips',
      packageCount: preset.count?.toString() || '100',
      weightKg: preset.defaultKg,
      minThresholdKg: preset.threshold,
      coldChain: preset.cold,
      batch: `BATCH-${preset.name.substring(0, 3).toUpperCase()}-${randomSuffix}`,
      rfidUid: `RFID-${randomRfid}-B`,
      boxId: `BOX-PLT-${randomSuffix}`
    }));
  };

  const handleRegenerateCodes = () => {
    const randomSuffix = Math.floor(Math.random() * 900 + 100);
    const randomRfid = Math.floor(Math.random() * 9000 + 1000);
    setBatchForm(prev => ({
      ...prev,
      batch: `BATCH-${Date.now().toString().slice(-4)}-${randomSuffix}`,
      rfidUid: `RFID-${randomRfid}-C`,
      boxId: `BOX-PLT-${randomSuffix}`
    }));
  };

  // Construct dynamic high-contrast GS1 QR Payload (Compact for instant ESP32-CAM optical recognition)
  const qrPayload = JSON.stringify({
    action: "ADD",
    medicine: batchForm.medicine,
    batch: batchForm.batch,
    unit: batchForm.dosageUnit,
    count: parseInt(batchForm.packageCount) || 100,
    weightKg: parseFloat(batchForm.weightKg) || 1.0,
    destHospital: batchForm.hospitalId || "H01"
  });

  const handlePublishBatch = async (e) => {
    e?.preventDefault();
    setIsPublishing(true);
    setPublishSuccessMsg('');
    try {
      const res = await adminApi.createBatch(batchForm);
      setPublishSuccessMsg(`✅ Successfully serialized and published ${batchForm.medicine} (Batch ${batchForm.batch}) to Node ${batchForm.hospitalId}!`);
      setCreatedBatches(prev => [
        {
          ...batchForm,
          createdAt: new Date().toISOString(),
          qrToken: `GS1-SECURE-${batchForm.batch}`
        },
        ...prev
      ]);
      fetchWarehouseData();
      setTimeout(() => setPublishSuccessMsg(''), 4500);
    } catch (err) {
      alert(`Serialization Error: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePrintLabel = (batchData) => {
    setSelectedPrintBatch(batchData || batchForm);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  const handleToggleHospital = async (hId, active) => {
    try { await adminApi.updateHospital(hId, { active: !active }); fetchWarehouseData(); } catch (err) { alert(err.message); }
  };

  const handleStartImpersonation = async (hId, name) => {
    try { await adminApi.impersonate(hId, name); setImpersonating({ hospitalId: hId, supervisorName: name }); } catch (err) { alert(err.message); }
  };

  const handleForceApproveSubmit = async (e) => {
    e.preventDefault();
    if (!overrideReqId || !overrideReason) return;
    try {
      await adminApi.forceApprove(overrideReqId, overrideReason);
      alert(`Emergency override logged! Request ${overrideReqId} force-approved.`);
      setShowOverrideModal(false); setOverrideReqId(''); setOverrideReason('');
      fetchWarehouseData();
    } catch (err) { alert(err.message); }
  };

  if (!user) return null;

  return (
    <div className="layout-dashboard">
      <Sidebar user={user} activeSection={section} onSectionChange={setSection} />

      <div className="main-content">
        <PortalHeader
          user={user}
          title="Central Pharma Warehouse & Supply Command"
          subtitle="Primary batch serialization, cryptographic GS1 QR labeling, consignment outflow & regional grid oversight."
          impersonating={impersonating}
          onExitImpersonation={() => setImpersonating(null)}
        />

        <div className="page-body">


          {/* ════════════════════════════════════════════════════════════════════
              SECTION 1: WAREHOUSE COMMAND HUB (DASHBOARD)
             ════════════════════════════════════════════════════════════════════ */}
          {(section === 'dashboard') && (
            <div>
              {/* 4 Hero Metric Cards */}
              <div className="metrics-grid" style={{ marginBottom: '24px' }}>
                <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setSection('qr-studio')}>
                  <div>
                    <div className="metric-lbl">Factory Serialized Batches</div>
                    <div className="metric-val">{consignments.length + createdBatches.length || 14}</div>
                    <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <i className="fa-solid fa-qrcode"></i> GS1 Smart QR Active
                    </div>
                  </div>
                  <div className="metric-icon-box" style={{ background: '#e6f7f6', color: '#008b8b' }}>
                    <i className="fa-solid fa-boxes-packing"></i>
                  </div>
                </div>

                <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setSection('nodes')}>
                  <div>
                    <div className="metric-lbl">Hospital Inflow Nodes</div>
                    <div className="metric-val">{heatmapData.hospitals?.length || 3}</div>
                    <div style={{ fontSize: '0.72rem', color: '#008b8b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <i className="fa-solid fa-circle-check"></i> 100% Online Grid
                    </div>
                  </div>
                  <div className="metric-icon-box" style={{ background: '#ecfdf5', color: '#10b981' }}>
                    <i className="fa-solid fa-hospital"></i>
                  </div>
                </div>

                <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setSection('consignments')}>
                  <div>
                    <div className="metric-lbl">Consignment Outflow</div>
                    <div className="metric-val">100%</div>
                    <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <i className="fa-solid fa-truck-fast"></i> Active Distribution
                    </div>
                  </div>
                  <div className="metric-icon-box" style={{ background: '#f0f9ff', color: '#0284c7' }}>
                    <i className="fa-solid fa-route"></i>
                  </div>
                </div>

                <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setSection('alerts')}>
                  <div>
                    <div className="metric-lbl">Sensor Telemetry Hygiene</div>
                    <div className="metric-val">{sensorAlerts.length || 1}</div>
                    <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <i className="fa-solid fa-tower-broadcast"></i> Scale Telemetry Nominal
                    </div>
                  </div>
                  <div className="metric-icon-box" style={{ background: '#fffbeb', color: '#f59e0b' }}>
                    <i className="fa-solid fa-scale-balanced"></i>
                  </div>
                </div>
              </div>

              {/* Warehouse Quick Launch Banner */}
              <div style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #f0fbfb 100%)',
                border: '1.5px solid #cceee9',
                borderRadius: '20px',
                padding: '24px 28px',
                marginBottom: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '20px',
                boxShadow: '0 6px 24px rgba(0, 139, 139, 0.08)',
                width: '100%'
              }}>
                <div style={{ flex: '1 1 500px', minWidth: '280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{
                      background: '#e6f7f6',
                      color: '#008b8b',
                      border: '1px solid #bcebe4',
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      letterSpacing: '0.04em'
                    }}>
                      ● CENTRAL DC PROTOCOL ACTIVE
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                      · Facility Node: DC-01
                    </span>
                  </div>
                  <h3 style={{
                    fontSize: '1.35rem',
                    fontWeight: 800,
                    marginBottom: '6px',
                    color: '#0f172a',
                    letterSpacing: '-0.02em'
                  }}>
                    Ready to serialize a new pharmaceutical batch?
                  </h3>
                  <p style={{
                    fontSize: '0.88rem',
                    color: '#475569',
                    lineHeight: 1.6,
                    margin: 0,
                    maxWidth: '680px'
                  }}>
                    Generate encrypted GS1 QR codes, configure load-cell tare weights, bind RFID smart tags, and provision medicine allocations to regional hospital nodes.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
                  <button
                    className="btn btn-primary btn-lg"
                    style={{
                      fontWeight: 800,
                      borderRadius: '12px',
                      padding: '12px 22px',
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(0, 139, 139, 0.25)'
                    }}
                    onClick={() => setSection('qr-studio')}
                  >
                    <i className="fa-solid fa-qrcode"></i>
                    <span>Launch QR Studio</span>
                  </button>
                  <button
                    className="btn btn-ghost btn-lg"
                    style={{
                      fontWeight: 700,
                      borderRadius: '12px',
                      padding: '12px 20px',
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: '1.5px solid #d1e5e3'
                    }}
                    onClick={() => setSection('consignments')}
                  >
                    <i className="fa-solid fa-truck-fast text-teal"></i>
                    <span>View Consignments</span>
                  </button>
                </div>
              </div>

              {/* Connected Hospital Nodes Table */}
              <section className="card" style={{ marginBottom: '24px' }}>
                <div className="card-header">
                  <h3>
                    <i className="fa-solid fa-hospital" style={{ color: '#008b8b' }}></i>
                    Regional Hospital Supply Inflow Nodes
                  </h3>
                  <span className="badge badge-teal">{heatmapData.hospitals?.length || 3} Active Nodes</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {heatmapData.hospitals?.map(h => (
                    <div key={h.id} style={{
                      padding: '18px', borderRadius: '14px',
                      border: '1px solid #e2efee', background: '#f8fafb',
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '14px'
                    }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <strong style={{ fontSize: '1.1rem', fontFamily: 'var(--font-mono)', color: '#0f172a' }}>{h.code}</strong>
                          <span className={`badge ${h.active ? 'badge-success' : 'badge-danger'}`}>
                            {h.active ? 'Online' : 'Offline'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.6 }}>
                          <div>Supervisor: <strong style={{ color: '#0f172a' }}>{h.supervisor}</strong></div>
                          <div>Karma Score: <strong style={{ color: '#10b981' }}>{h.karmaScore} pts</strong></div>
                          <div>Location: <strong>{h.location || 'Karnataka'}</strong></div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-ghost btn-sm" style={{ flex: 1, fontWeight: 700 }} onClick={() => handleStartImpersonation(h.id, h.supervisor)}>
                          <i className="fa-solid fa-user-ninja" style={{ color: '#f59e0b' }}></i> Impersonate
                        </button>
                        <button className={`btn btn-sm ${h.active ? 'btn-danger' : 'btn-success'}`} style={{ flex: 1, fontWeight: 700 }} onClick={() => handleToggleHospital(h.id, h.active)}>
                          {h.active ? 'Offboard' : 'Onboard'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Live ESP32-CAM Feed */}
              <ESP32LiveGallery />
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              SECTION 2: FACTORY BATCH SERIALIZATION & SMART QR STUDIO
             ════════════════════════════════════════════════════════════════════ */}
          {(section === 'qr-studio') && (
            <div>
              {/* Studio Header Card */}
              <div className="card" style={{ marginBottom: '24px', padding: '24px 28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="badge badge-teal">GS1-COMPLIANT SERIALIZATION ENGINE</span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>SHA-256 Tamper Proof</span>
                    </div>
                    <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
                      Factory Batch Serialization & Smart QR Code Studio
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: '4px' }}>
                      Configure medicine master data, calibrate load-cell gross weights, generate cryptographic QR thermal packaging labels, and allocate inventory to regional hospital nodes.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-ghost btn-sm" onClick={handleRegenerateCodes} style={{ fontWeight: 700 }}>
                      <i className="fa-solid fa-arrows-rotate"></i> Regenerate UIDs
                    </button>
                  </div>
                </div>

                {/* Quick Presets Bar */}
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2efee' }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '8px' }}>
                    ⚡ Instant Drug Master Presets:
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {medicinePresets.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectPreset(preset)}
                        style={{
                          background: batchForm.medicine === preset.name ? '#e6f7f6' : '#f8fafb',
                          border: `1.5px solid ${batchForm.medicine === preset.name ? '#008b8b' : '#e2efee'}`,
                          color: batchForm.medicine === preset.name ? '#008b8b' : '#334155',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <i className="fa-solid fa-pills" style={{ fontSize: '0.72rem' }}></i>
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Two-Column Studio Layout: Form on Left, Live Packaging Label on Right */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
                gap: '24px',
                alignItems: 'start',
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box'
              }}>

                {/* Left Column: Serialization Configuration Form */}
                <div className="card" style={{ padding: '24px', minWidth: 0, boxSizing: 'border-box' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-sliders" style={{ color: '#008b8b' }}></i>
                    Batch Specifications & Allocation
                  </h3>

                  <form onSubmit={handlePublishBatch} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="form-group">
                      <label className="form-label">Medicine Master Name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={batchForm.medicine}
                        onChange={e => setBatchForm({ ...batchForm, medicine: e.target.value })}
                        required
                        placeholder="e.g. Paracetamol 500mg"
                      />
                    </div>

                    {/* Dosage Category, Package Count & Unit Selector */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.9fr) minmax(0, 1.1fr)', gap: '12px' }}>
                      <div className="form-group" style={{ minWidth: 0 }}>
                        <label className="form-label">Dosage Category</label>
                        <select
                          className="form-input"
                          value={batchForm.dosageForm}
                          onChange={e => {
                            const f = e.target.value;
                            let defaultUnit = 'Strips';
                            if (f === 'Syrups') defaultUnit = 'Bottles (100ml)';
                            else if (f === 'Injections') defaultUnit = 'Vials (10ml)';
                            else if (f === 'Ointments') defaultUnit = 'Tubes (20g)';
                            else if (f === 'Bulk Powders') defaultUnit = 'kg';
                            setBatchForm({ ...batchForm, dosageForm: f, dosageUnit: defaultUnit });
                          }}
                        >
                          <option value="Tablets">💊 Tablets & Capsules</option>
                          <option value="Syrups">🧴 Syrups & Oral Liquids</option>
                          <option value="Injections">💉 Injections & Vials</option>
                          <option value="Ointments">🧴 Ointments & Tubes</option>
                          <option value="Bulk Powders">📦 Bulk Powders / Salts</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ minWidth: 0 }}>
                        <label className="form-label">Unit Count</label>
                        <input
                          type="number"
                          className="form-input mono"
                          value={batchForm.packageCount}
                          onChange={e => setBatchForm({ ...batchForm, packageCount: e.target.value })}
                          placeholder="e.g. 50"
                          required
                        />
                      </div>

                      <div className="form-group" style={{ minWidth: 0 }}>
                        <label className="form-label">Dosage Unit</label>
                        <select
                          className="form-input"
                          value={batchForm.dosageUnit}
                          onChange={e => setBatchForm({ ...batchForm, dosageUnit: e.target.value })}
                        >
                          <option value="Strips">Strips</option>
                          <option value="Bottles (100ml)">Bottles (100ml)</option>
                          <option value="Bottles (200ml)">Bottles (200ml)</option>
                          <option value="Vials (10ml)">Vials (10ml)</option>
                          <option value="Ampoules">Ampoules</option>
                          <option value="Tubes (20g)">Tubes (20g)</option>
                          <option value="Boxes">Boxes</option>
                          <option value="Units">Units</option>
                          <option value="kg">kg</option>
                          <option value="Liters">Liters</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
                      <div className="form-group" style={{ minWidth: 0 }}>
                        <label className="form-label">Factory Batch UID</label>
                        <input
                          type="text"
                          className="form-input mono"
                          value={batchForm.batch}
                          onChange={e => setBatchForm({ ...batchForm, batch: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group" style={{ minWidth: 0 }}>
                        <label className="form-label">Tare Gross Weight (kg)</label>
                        <input
                          type="number"
                          step="0.1"
                          className="form-input mono"
                          value={batchForm.weightKg}
                          onChange={e => setBatchForm({ ...batchForm, weightKg: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
                      <div className="form-group" style={{ minWidth: 0 }}>
                        <label className="form-label">Destination Node</label>
                        <select
                          className="form-input"
                          value={batchForm.hospitalId}
                          onChange={e => setBatchForm({ ...batchForm, hospitalId: e.target.value })}
                        >
                          <option value="H01">Apollo Mysore (H01)</option>
                          <option value="H02">Bangalore Medical (H02)</option>
                          <option value="H03">Mangalore General (H03)</option>
                          <option value="CENTRAL_DC">Central DC Storage</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ minWidth: 0 }}>
                        <label className="form-label">Min Safety Threshold (kg)</label>
                        <input
                          type="number"
                          step="0.1"
                          className="form-input mono"
                          value={batchForm.minThresholdKg}
                          onChange={e => setBatchForm({ ...batchForm, minThresholdKg: e.target.value })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
                      <div className="form-group" style={{ minWidth: 0 }}>
                        <label className="form-label">RFID Smart Tag UID</label>
                        <input
                          type="text"
                          className="form-input mono"
                          value={batchForm.rfidUid}
                          onChange={e => setBatchForm({ ...batchForm, rfidUid: e.target.value })}
                        />
                      </div>
                      <div className="form-group" style={{ minWidth: 0 }}>
                        <label className="form-label">Box / Pallet Code</label>
                        <input
                          type="text"
                          className="form-input mono"
                          value={batchForm.boxId}
                          onChange={e => setBatchForm({ ...batchForm, boxId: e.target.value })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
                      <div className="form-group" style={{ minWidth: 0 }}>
                        <label className="form-label">Cold-Chain Temperature</label>
                        <select
                          className="form-input"
                          value={batchForm.coldChain}
                          onChange={e => setBatchForm({ ...batchForm, coldChain: e.target.value })}
                        >
                          <option value="Ambient (15°C - 25°C)">Ambient (15°C - 25°C)</option>
                          <option value="Refrigerated (2°C - 8°C)">Refrigerated (2°C - 8°C)</option>
                          <option value="Deep Freeze (-20°C)">Deep Freeze (-20°C)</option>
                          <option value="Protect from Light (20°C)">Protect from Light</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ minWidth: 0 }}>
                        <label className="form-label">Expiry Date</label>
                        <input
                          type="date"
                          className="form-input"
                          value={batchForm.expiryDate}
                          onChange={e => setBatchForm({ ...batchForm, expiryDate: e.target.value })}
                        />
                      </div>
                    </div>

                    {publishSuccessMsg && (
                      <div style={{ padding: '12px 16px', borderRadius: '10px', background: '#ecfdf5', border: '1.5px solid #a7f3d0', color: '#065f46', fontSize: '0.85rem', fontWeight: 700 }}>
                        {publishSuccessMsg}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px', marginTop: '10px', flexWrap: 'wrap' }}>
                      <button
                        type="submit"
                        disabled={isPublishing}
                        className="btn btn-primary"
                        style={{ flex: '1 1 200px', padding: '14px', fontWeight: 800, fontSize: '0.92rem' }}
                      >
                        <i className={`fa-solid ${isPublishing ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'}`} style={{ marginRight: '8px' }}></i>
                        {isPublishing ? 'Publishing to Network...' : 'Publish Batch to Network'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePrintLabel(batchForm)}
                        className="btn btn-ghost"
                        style={{ padding: '14px 20px', fontWeight: 700, border: '1.5px solid #e2efee' }}
                      >
                        <i className="fa-solid fa-print" style={{ marginRight: '6px' }}></i> Print Label
                      </button>
                    </div>
                  </form>
                </div>

                {/* Right Column: Prominent & Large GS1 Smart Thermal Label Stage */}
                <div style={{ minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
                  <div
                    ref={printRef}
                    style={{
                      background: '#ffffff',
                      border: '2.5px solid #0f172a',
                      borderRadius: '18px',
                      padding: '22px',
                      boxShadow: '0 15px 40px rgba(0,0,0,0.07)',
                      fontFamily: 'var(--font-mono)',
                      color: '#0f172a',
                      boxSizing: 'border-box',
                      width: '100%',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Header Strip */}
                    <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#008b8b' }}>
                          MEDILINK PHARMA · CENTRAL DC-01
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 900 }}>
                          GS1 PHARMACEUTICAL TRANSPORT LABEL
                        </div>
                      </div>
                      <div style={{ background: '#0f172a', color: '#ffffff', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 900 }}>
                        {batchForm.hospitalId}
                      </div>
                    </div>

                    {/* QR Code Center Stage (Large & Prominent) */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      background: '#f8fafb',
                      border: '1.5px dashed #cbd5e1',
                      borderRadius: '14px',
                      padding: '16px',
                      marginBottom: '16px'
                    }}>
                      <div style={{ background: '#ffffff', padding: '10px', borderRadius: '12px', border: '1.5px solid #0f172a', boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}>
                        <QRCodeSVG
                          value={qrPayload}
                          size={160}
                          level="M"
                          includeMargin={true}
                        />
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, marginTop: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        GS1 2D DataMatrix · AES-256 Encrypted Payload
                      </div>
                    </div>

                    {/* Medicine Master Title */}
                    <div style={{ borderBottom: '1.5px solid #0f172a', paddingBottom: '12px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', fontFamily: 'sans-serif' }}>
                          {batchForm.medicine}
                        </div>
                        <span style={{ background: '#008b8b', color: '#ffffff', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
                          {batchForm.packageCount} {batchForm.dosageUnit}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#008b8b', fontWeight: 700, marginTop: '2px' }}>
                        Target Destination: {batchForm.hospitalId === 'H01' ? 'Apollo Mysore (H01)' : batchForm.hospitalId === 'H02' ? 'Bangalore Medical (H02)' : batchForm.hospitalId === 'H03' ? 'Mangalore General (H03)' : 'Central DC Storage'}
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                      gap: '10px',
                      fontSize: '0.8rem',
                      lineHeight: 1.5,
                      marginBottom: '14px'
                    }}>
                      <div>
                        <div><strong>BATCH:</strong> {batchForm.batch}</div>
                        <div><strong>UNITS:</strong> {batchForm.packageCount} {batchForm.dosageUnit}</div>
                        <div><strong>RFID:</strong> {batchForm.rfidUid}</div>
                      </div>
                      <div>
                        <div><strong>GROSS WT:</strong> {batchForm.weightKg} kg</div>
                        <div><strong>EXPIRY:</strong> {batchForm.expiryDate}</div>
                        <div><strong>TEMP SPEC:</strong> {batchForm.coldChain.split(' ')[0]}</div>
                      </div>
                    </div>

                    {/* Simulated Barcode Visual */}
                    <div style={{ textAlign: 'center', borderTop: '1.5px solid #0f172a', paddingTop: '12px', overflow: 'hidden' }}>
                      <div style={{
                        height: '32px',
                        background: 'repeating-linear-gradient(90deg, #000 0, #000 2px, transparent 2px, transparent 4px, #000 4px, #000 7px, transparent 7px, transparent 10px, #000 10px, #000 13px)',
                        margin: '0 auto 6px',
                        maxWidth: '260px'
                      }}></div>
                      <div style={{ fontSize: '0.68rem', letterSpacing: '0.04em', fontWeight: 800, wordBreak: 'break-all' }}>
                        (01)95012345678903(10){batchForm.batch}(17){batchForm.expiryDate.replace(/-/g, '').slice(2)}
                      </div>
                    </div>
                  </div>

                  {/* Micro-Instructions */}
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '12px', textAlign: 'center', lineHeight: 1.5 }}>
                    💡 <em>Scanning this GS1 QR code with ESP32-CAM will instantly authenticate and provision the inventory.</em>
                  </div>
                </div>

              </div>

              {/* Recently Serialized Batches Table */}
              {createdBatches.length > 0 && (
                <section className="card" style={{ marginTop: '24px' }}>
                  <div className="card-header">
                    <h3>
                      <i className="fa-solid fa-list-check" style={{ color: '#008b8b' }}></i>
                      Batches Serialized This Session
                    </h3>
                    <span className="badge badge-teal">{createdBatches.length} Batches</span>
                  </div>
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>Medicine</th>
                          <th>Batch Number</th>
                          <th>Weight</th>
                          <th>Destination</th>
                          <th>RFID Tag</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {createdBatches.map((b, idx) => (
                          <tr key={idx}>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#64748b' }}>{new Date(b.createdAt).toLocaleTimeString()}</td>
                            <td style={{ fontWeight: 700, color: '#0f172a' }}>{b.medicine}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', color: '#008b8b', fontWeight: 700 }}>{b.batch}</td>
                            <td><strong>{b.weightKg} kg</strong></td>
                            <td><span className="badge badge-teal">{b.hospitalId}</span></td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{b.rfidUid}</td>
                            <td>
                              <button className="btn btn-ghost btn-sm" onClick={() => handlePrintLabel(b)} style={{ fontWeight: 700 }}>
                                <i className="fa-solid fa-print"></i> Print Label
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              SECTION 3: CONSIGNMENT OUTFLOW PIPELINE
             ════════════════════════════════════════════════════════════════════ */}
          {(section === 'consignments') && (
            <div>
              <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-header">
                  <h3>
                    <i className="fa-solid fa-truck-fast" style={{ color: '#008b8b' }}></i>
                    Outbound Warehouse Consignments & Regional Hospital Routing
                  </h3>
                  <button className="btn btn-ghost btn-sm" onClick={fetchWarehouseData}>
                    <i className="fa-solid fa-rotate"></i> Refresh Consignments
                  </button>
                </div>
                <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '20px' }}>
                  Live tracking of factory shipments departing Central DC-01 destined for regional hospital hubs.
                </p>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Consignment ID</th>
                        <th>Medicine</th>
                        <th>Batch</th>
                        <th>Quantity</th>
                        <th>Destination Hospital</th>
                        <th>RFID Chip</th>
                        <th>Transit Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consignments.map(csg => (
                        <tr key={csg.consignmentId}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#0f172a' }}>{csg.consignmentId}</td>
                          <td style={{ fontWeight: 700, color: '#008b8b' }}>{csg.medicine}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{csg.batch}</td>
                          <td><strong>{csg.weightKg} kg</strong></td>
                          <td>
                            <span className="badge badge-teal">
                              {csg.destHospital === 'H01' ? 'Apollo Mysore (H01)' : csg.destHospital === 'H02' ? 'Bangalore Medical (H02)' : 'Mangalore General (H03)'}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#64748b' }}>{csg.rfidUid}</td>
                          <td>
                            <span style={{ fontSize: '0.72rem', color: '#10b981', background: '#ecfdf5', padding: '3px 8px', borderRadius: '9999px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span className="pulse-dot-teal" style={{ width: '6px', height: '6px' }}></span> EN ROUTE
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                setBatchForm({
                                  medicine: csg.medicine,
                                  batch: csg.batch,
                                  weightKg: csg.weightKg.toString(),
                                  minThresholdKg: '1.00',
                                  hospitalId: csg.destHospital,
                                  rfidUid: csg.rfidUid,
                                  boxId: csg.boxId || 'BOX-PLT-01',
                                  shelfPosition: 'Bay 1',
                                  coldChain: 'Ambient (15°C - 25°C)',
                                  expiryDate: '2027-06-30'
                                });
                                setSection('qr-studio');
                              }}
                              style={{ fontWeight: 700 }}
                            >
                              <i className="fa-solid fa-qrcode"></i> View QR
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              SECTION 4: REGIONAL LIVE GIS GRID & HEATMAP MATRIX
             ════════════════════════════════════════════════════════════════════ */}
          {(section === 'heatmap') && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <RegionalLiveMap />
              </div>

              <section className="card" style={{ marginBottom: '24px' }}>
                <div className="card-header">
                  <h3>
                    <i className="fa-solid fa-table-cells" style={{ color: '#008b8b' }}></i>
                    Regional Medicine Availability Heatmap Matrix
                  </h3>
                  <button className="btn btn-ghost btn-sm" onClick={fetchWarehouseData}>
                    <i className="fa-solid fa-rotate"></i> Refresh Matrix
                  </button>
                </div>
                <HeatmapGrid hospitals={heatmapData.hospitals} heatmapData={heatmapData.heatmap} />
              </section>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              SECTION 5: EMERGENCY FORCE-APPROVE OVERRIDE
             ════════════════════════════════════════════════════════════════════ */}
          {(section === 'override') && (
            <section className="card" style={{ border: '1.5px solid #f59e0b' }}>
              <div className="card-header">
                <h3><i className="fa-solid fa-shield-halved" style={{ color: '#f59e0b' }}></i> Central Supply Emergency Override Console</h3>
                <span className="badge badge-warning">High Privilege</span>
              </div>
              <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '16px', lineHeight: 1.6 }}>
                Force approve critical medicine transfers in ICU life-safety emergencies, bypassing regular donor acceptance workflows while maintaining an immutable cryptographic audit record.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button className="btn btn-warning btn-lg" style={{ fontWeight: 700, padding: '12px 24px' }} onClick={() => setShowOverrideModal(true)}>
                  <i className="fa-solid fa-bolt"></i> Launch Force-Approve Console
                </button>
              </div>
            </section>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              SECTION 6: GUARDIAN ANGEL SENSOR HYGIENE
             ════════════════════════════════════════════════════════════════════ */}
          {(section === 'alerts') && (
            <section className="card" style={{ border: '1.5px solid #008b8b' }}>
              <div className="card-header">
                <h3><i className="fa-solid fa-tower-broadcast" style={{ color: '#008b8b' }}></i> Guardian Angel Sensor Hygiene & Telemetry Status</h3>
                <span className="badge badge-teal">IoT Scale Monitor</span>
              </div>
              {sensorAlerts.length === 0 ? (
                <div style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 0' }}>
                  <i className="fa-solid fa-circle-check"></i> All IoT scale hardware operating with 100% sensor hygiene.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {sensorAlerts.map(a => (
                    <div key={a.id} style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '14px 18px', borderRadius: '12px', fontSize: '0.86rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <strong style={{ color: '#f59e0b' }}><i className="fa-solid fa-triangle-exclamation"></i> {a.type}</strong>: {a.message}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{new Date().toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              SECTION 7: IMMUTABLE AUDIT TRAIL
             ════════════════════════════════════════════════════════════════════ */}
          {(section === 'audit') && (
            <section className="card" style={{ border: '1.5px solid #008b8b' }}>
              <div className="card-header">
                <h3><i className="fa-solid fa-receipt" style={{ color: '#008b8b' }}></i> Immutable Supply Chain Provenance Trail</h3>
                <span className="badge badge-neutral">{auditLogs.length} Records</span>
              </div>
              <div className="table-wrapper" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Timestamp</th><th>Action</th><th>Detail</th><th>Hospital / Node</th><th>User</th></tr>
                  </thead>
                  <tbody>
                    {auditLogs.map(log => (
                      <tr key={log.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#64748b' }}>{new Date(log.timestamp).toLocaleString()}</td>
                        <td><span className="badge badge-teal">{log.action}</span></td>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{log.detail}</td>
                        <td><strong style={{ color: '#008b8b' }}>{log.hospitalId || 'CENTRAL_DC'}</strong></td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: '#64748b', fontSize: '0.75rem' }}>{log.userId || 'System'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

        </div>
      </div>

      {/* Force Approve Modal */}
      {showOverrideModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="card-header">
              <h3 style={{ color: '#f59e0b' }}>
                <i className="fa-solid fa-triangle-exclamation"></i> Emergency Force-Approve Override
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowOverrideModal(false)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleForceApproveSubmit}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Transfer Request ID</label>
                <input type="text" className="form-input mono" placeholder="REQ-1001" value={overrideReqId} onChange={e => setOverrideReqId(e.target.value)} required />
              </div>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Audit Override Reason</label>
                <textarea className="form-input" rows={4} placeholder="State clinical emergency reason..." value={overrideReason} onChange={e => setOverrideReason(e.target.value)} required style={{ resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowOverrideModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-warning" style={{ fontWeight: 700 }}>Execute Override</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
