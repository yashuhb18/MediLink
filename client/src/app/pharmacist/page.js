"use client";
import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import PortalHeader from '@/components/PortalHeader';
import TrafficLight from '@/components/TrafficLight';
import IoTSimulator from '@/components/IoTSimulator';
import SmartLabelModal from '@/components/SmartLabelModal';
import ESP32LiveGallery from '@/components/ESP32LiveGallery';
import { transferApi } from '@/lib/api';

export default function PharmacistPortal() {
  const [user, setUser] = useState(null);
  const [section, setSection] = useState('picklist');
  const [activeReq, setActiveReq] = useState(null);
  const [trafficState, setTrafficState] = useState('idle');
  const [rfidOk, setRfidOk] = useState(false);
  const [weightOk, setWeightOk] = useState(false);
  const [statusMsg, setStatusMsg] = useState('AWAITING TASK');
  const [detailMsg, setDetailMsg] = useState('No active picklist assigned.');
  const [verifying, setVerifying] = useState(false);
  const [smartLabelOpen, setSmartLabelOpen] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem('medilink_user');
    if (!userStr) { window.location.href = '/'; return; }
    const u = JSON.parse(userStr);
    if (u.role !== 'DISPATCH_PHARMACIST') { window.location.href = '/'; return; }
    setUser(u);
    loadTask(u.hospitalId);
  }, []);

  const loadTask = async (hId) => {
    try {
      const reqs = await transferApi.getTransfers(hId, 'DISPATCH_PHARMACIST', 'ACCEPTED');
      if (Array.isArray(reqs) && reqs.length > 0) {
        setActiveReq(reqs[0]); setTrafficState('idle'); setRfidOk(false); setWeightOk(false);
        setStatusMsg('READY TO SCAN'); setDetailMsg('Bring medicine box to scanning station.');
      } else {
        setActiveReq(null); setTrafficState('idle'); setStatusMsg('AWAITING TASK'); setDetailMsg('No active picklists.');
      }
    } catch (err) { console.error(err); }
  };

  const handleScanRfid = async () => {
    if (!activeReq) return;
    setVerifying(true); setTrafficState('scanning'); setStatusMsg('SCANNING RFID...');
    setTimeout(async () => {
      try {
        const uid = activeReq.targetRfidUid || 'A101-B';
        const res = await transferApi.verifyTransfer(activeReq.id, uid, activeReq.quantityKg);
        setRfidOk(res.rfidOk);
        if (res.rfidOk && (weightOk || res.weightOk)) {
          setWeightOk(true); setTrafficState('pass'); setStatusMsg('VERIFIED — CLEAR TO DISPATCH'); setDetailMsg('Both RFID and Weight verified.');
        } else if (!res.rfidOk) {
          setTrafficState('fail'); setStatusMsg('LOCKED — RFID MISMATCH'); setDetailMsg(`UID mismatch for ${uid}.`);
        } else {
          setTrafficState('idle'); setStatusMsg('RFID OK — PLACE ON SCALE'); setDetailMsg('RFID verified. Now weigh the medicine.');
        }
      } catch (err) { alert(err.message); } finally { setVerifying(false); }
    }, 1000);
  };

  const handlePlaceScale = async () => {
    if (!activeReq) return;
    setVerifying(true); setTrafficState('scanning'); setStatusMsg('WEIGHING...');
    setTimeout(async () => {
      try {
        const uid = activeReq.targetRfidUid || 'A101-B';
        const res = await transferApi.verifyTransfer(activeReq.id, uid, activeReq.quantityKg);
        setWeightOk(res.weightOk);
        if (res.weightOk && (rfidOk || res.rfidOk)) {
          setRfidOk(true); setTrafficState('pass'); setStatusMsg('VERIFIED — CLEAR TO DISPATCH'); setDetailMsg('Both verified.');
        } else if (!res.weightOk) {
          setTrafficState('fail'); setStatusMsg('LOCKED — WEIGHT MISMATCH'); setDetailMsg('Scale weight does not match expected.');
        } else {
          setTrafficState('idle'); setStatusMsg('WEIGHT OK — SCAN RFID'); setDetailMsg('Weight verified. Scan the RFID tag.');
        }
      } catch (err) { alert(err.message); } finally { setVerifying(false); }
    }, 800);
  };

  const handleConfirmDispatch = async () => {
    if (!activeReq || trafficState !== 'pass') return;
    try { await transferApi.dispatchTransfer(activeReq.id); alert('Dispatch confirmed!'); loadTask(user.hospitalId); }
    catch (err) { alert(err.message); }
  };

  if (!user) return null;

  return (
    <div className="layout-dashboard">
      <Sidebar user={user} activeSection={section} onSectionChange={setSection} />
      <div className="main-content">
        <PortalHeader user={user} title="Dispatch Workstation" subtitle="Physical verification and dispatch operations." />

        <div className="page-body" style={{ maxWidth: '900px' }}>

          {/* Quick Tabs Bar on Dashboard */}
          {section === 'dashboard' && (
            <div className="metrics-grid" style={{ marginBottom: '20px' }}>
              <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setSection('picklist')}>
                <div>
                  <div className="metric-lbl">Active Picklist</div>
                  <div className="metric-val" style={{ color: activeReq ? '#008b8b' : '#64748b' }}>
                    {activeReq ? activeReq.id : 'Idle'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: activeReq ? '#10b981' : '#64748b', fontWeight: 700 }}>
                    {activeReq ? 'Ready for retrieval' : 'No pending tasks'}
                  </div>
                </div>
                <div className="metric-icon-box" style={{ background: '#e6f7f6', color: '#008b8b' }}>
                  <i className="fa-solid fa-clipboard-list"></i>
                </div>
              </div>

              <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setSection('verify')}>
                <div>
                  <div className="metric-lbl">Verification Station</div>
                  <div className="metric-val" style={{ color: trafficState === 'pass' ? '#10b981' : trafficState === 'fail' ? '#dc2626' : '#f59e0b' }}>
                    {trafficState.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                    Dual RFID + Weight
                  </div>
                </div>
                <div className="metric-icon-box" style={{ background: trafficState === 'pass' ? '#ecfdf5' : '#fffbeb', color: trafficState === 'pass' ? '#10b981' : '#f59e0b' }}>
                  <i className="fa-solid fa-shield-halved"></i>
                </div>
              </div>

              <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setSection('iot')}>
                <div>
                  <div className="metric-lbl">IoT Microcontroller</div>
                  <div className="metric-val" style={{ color: '#10b981' }}>Online</div>
                  <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>ESP32 + HX711 Scale</div>
                </div>
                <div className="metric-icon-box" style={{ background: '#ecfdf5', color: '#10b981' }}>
                  <i className="fa-solid fa-microchip"></i>
                </div>
              </div>
            </div>
          )}

          {/* Live Camera Feed & Optical Scan Gallery */}
          <ESP32LiveGallery />

          {/* Active Picklist (Shown on dashboard and picklist) */}
          {(section === 'dashboard' || section === 'picklist') && (
            <div>
              {activeReq ? (
                <div className="card" style={{ borderColor: '#008b8b', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-divider)', paddingBottom: '14px', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge badge-warning" style={{ fontSize: '0.78rem', padding: '5px 14px' }}>
                        <i className="fa-solid fa-clipboard-list"></i> Active Picklist — {activeReq.id}
                      </span>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ borderColor: '#008b8b', color: '#008b8b', fontWeight: 700 }}
                        onClick={() => setSmartLabelOpen(true)}
                      >
                        <i className="fa-solid fa-qrcode"></i> Generate Smart Label (ESP32-CAM)
                      </button>
                    </div>
                    <span style={{ fontSize: '0.82rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                      Destination: <strong style={{ color: '#0f172a' }}>{activeReq.requestingHospitalId}</strong>
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2efee' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>Medicine</div>
                      <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{activeReq.medicine}</strong>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2efee' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>Target Quantity</div>
                      <strong style={{ fontSize: '1.1rem', color: '#008b8b' }}>{activeReq.quantityKg} kg</strong>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2efee' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>RFID Tag Match</div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#d97706' }}>{activeReq.targetRfidUid || 'A101-B'}</span>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2efee' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>Shelf Location</div>
                      <strong style={{ color: '#10b981' }}>{activeReq.shelfPosition || 'Bay 4 / Shelf 2'}</strong>
                    </div>
                  </div>

                  <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', padding: '14px 18px', borderRadius: '12px', fontSize: '0.86rem', color: '#008b8b' }}>
                    <i className="fa-solid fa-shoe-prints" style={{ marginRight: '8px' }}></i>
                    <strong>Retrieval Instructions:</strong> Walk to <strong>{activeReq.shelfPosition || 'Bay 4 / Shelf 2'}</strong> → Retrieve Container <strong>{activeReq.boxId || 'BOX01'}</strong> → Place on verification scale.
                  </div>
                </div>
              ) : (
                <div className="card empty-state" style={{ marginBottom: '20px' }}>
                  <i className="fa-solid fa-inbox fa-2x"></i>
                  <h3 style={{ marginTop: '12px', fontWeight: 600, color: '#64748b' }}>No Active Picklist</h3>
                  <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: '0.85rem' }}>Waiting for a Source Supervisor to accept a transfer request.</p>
                </div>
              )}
            </div>
          )}

          {/* Traffic Light & Dual Verification (Shown on dashboard and verify) */}
          {(section === 'dashboard' || section === 'verify') && (
            <div className="card" style={{ textAlign: 'center', padding: '32px', marginBottom: '20px' }}>
              <div className="card-header" style={{ justifyContent: 'center', marginBottom: '20px' }}>
                <h3><i className="fa-solid fa-shield-halved" style={{ color: '#008b8b' }}></i> Dual-Lock Physical Verification Station</h3>
              </div>
              <TrafficLight state={trafficState} statusText={statusMsg} detailText={detailMsg} />

              {activeReq && (
                <>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px', flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost" style={{ minWidth: '180px', borderColor: '#008b8b', color: '#008b8b', fontWeight: 700 }} onClick={handleScanRfid} disabled={verifying}>
                      <i className="fa-solid fa-id-card"></i> Scan RFID Card
                    </button>
                    <button className="btn btn-ghost" style={{ minWidth: '180px', borderColor: '#008b8b', color: '#008b8b', fontWeight: 700 }} onClick={handlePlaceScale} disabled={verifying}>
                      <i className="fa-solid fa-weight-scale"></i> Weigh on Scale
                    </button>
                  </div>

                  <div style={{ marginTop: '24px' }}>
                    <button className="btn btn-success btn-lg" style={{ width: '100%', maxWidth: '400px', fontWeight: 800, fontSize: '1.05rem', padding: '14px 28px' }} onClick={handleConfirmDispatch} disabled={trafficState !== 'pass' || verifying}>
                      <i className="fa-solid fa-truck-fast"></i> Confirm & Authorize Dispatch
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* IoT Terminal (Shown on dashboard and iot) */}
          {(section === 'dashboard' || section === 'iot') && (
            <div className="card">
              <div className="card-header">
                <h3><i className="fa-solid fa-microchip" style={{ color: '#008b8b' }}></i> IoT Telemetry & ESP32 Hardware Simulator</h3>
                <span className="badge badge-teal">Live Bridge</span>
              </div>
              {activeReq ? (
                <IoTSimulator activeRequestId={activeReq.id} inventoryItemId={activeReq.inventoryItemId || 'INV-201'} onSimulatedUpdate={() => loadTask(user.hospitalId)} />
              ) : (
                <IoTSimulator activeRequestId="REQ-1001" inventoryItemId="INV-201" onSimulatedUpdate={() => loadTask(user.hospitalId)} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Smart Optical QR Generator Modal */}
      <SmartLabelModal
        isOpen={smartLabelOpen}
        onClose={() => setSmartLabelOpen(false)}
        defaultItem={activeReq}
      />
    </div>
  );
}
