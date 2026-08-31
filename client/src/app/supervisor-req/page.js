"use client";
import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import PortalHeader from '@/components/PortalHeader';
import StatusPipeline from '@/components/StatusPipeline';
import { inventoryApi, transferApi, karmaApi } from '@/lib/api';

export default function RequestingSupervisorPortal() {
  const [user, setUser] = useState(null);
  const [section, setSection] = useState('predictions');
  const [predictions, setPredictions] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [karmaData, setKarmaData] = useState({ score: 50 });
  const [manualMedicine, setManualMedicine] = useState('Paracetamol');
  const [manualQty, setManualQty] = useState('1.0');
  const [manualUrgency, setManualUrgency] = useState('MEDIUM');
  const [manualNotes, setManualNotes] = useState('');
  const [aiExplanations, setAiExplanations] = useState({});
  const [explainingId, setExplainingId] = useState(null);

  useEffect(() => {
    const userStr = localStorage.getItem('medilink_user');
    if (!userStr) { window.location.href = '/'; return; }
    const u = JSON.parse(userStr);
    if (u.role !== 'REQUESTING_SUPERVISOR') { window.location.href = '/'; return; }
    setUser(u);
    loadData(u.hospitalId);
  }, []);

  const loadData = async (hId) => {
    try {
      const preds = await inventoryApi.getPredictions(hId); setPredictions(preds);
      const reqs = await transferApi.getTransfers(hId, 'REQUESTING_SUPERVISOR'); setOutgoingRequests(reqs);
      const k = await karmaApi.getScore(hId); setKarmaData(k);
    } catch (err) { console.error(err); }
  };

  const handleApproveAi = async (pred) => {
    try {
      const aiResult = await transferApi.aiSuggest(pred.medicine, pred.deficitKg, user.hospitalId, pred.urgency);
      if (!aiResult.canFulfill) { alert(`No surplus available for ${pred.medicine}.`); return; }
      const sources = aiResult.sources.map(s => ({ hospitalId: s.hospitalId, allocatedKg: s.allocatedKg }));
      await transferApi.createTransfer({ medicine: pred.medicine, sources, requestingHospitalId: user.hospitalId, urgency: pred.urgency, reason: `AI predicted zero stock in ${pred.hoursToZero}h.` });
      alert(`Request generated for ${pred.medicine}!`);
      loadData(user.hospitalId); setSection('tracker');
    } catch (err) { alert(err.message); }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    try {
      await transferApi.createTransfer({ medicine: manualMedicine, quantityKg: parseFloat(manualQty), requestingHospitalId: user.hospitalId, urgency: manualUrgency, reason: manualNotes || 'Manual emergency request', manual: true });
      alert(`Request sent for ${manualMedicine}!`); setManualNotes('');
      loadData(user.hospitalId); setSection('tracker');
    } catch (err) { alert(err.message); }
  };

  if (!user) return null;

  return (
    <div className="layout-dashboard">
      <Sidebar user={user} activeSection={section} onSectionChange={setSection} />
      <div className="main-content">
        <PortalHeader user={user} subtitle={`Requesting Supervisor — ${user.hospitalId}`} />

        <div className="page-body">
          {/* Metrics */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div>
                <div className="metric-lbl">Karma Score</div>
                <div className="metric-val" style={{ color: '#10b981' }}>{karmaData.score}</div>
                <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <i className="fa-solid fa-circle-check"></i> Good Standing
                </div>
              </div>
              <div className="metric-icon-box" style={{ background: '#ecfdf5', color: '#10b981' }}>
                <i className="fa-solid fa-award"></i>
              </div>
            </div>

            <div className="metric-card">
              <div>
                <div className="metric-lbl">Shortage Predictions</div>
                <div className="metric-val" style={{ color: '#f59e0b' }}>{predictions.length}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                  Active 5h Forecast
                </div>
              </div>
              <div className="metric-icon-box" style={{ background: '#fffbeb', color: '#f59e0b' }}>
                <i className="fa-solid fa-brain"></i>
              </div>
            </div>

            <div className="metric-card">
              <div>
                <div className="metric-lbl">Active Requests</div>
                <div className="metric-val" style={{ color: '#008b8b' }}>{outgoingRequests.length}</div>
                <div style={{ fontSize: '0.72rem', color: '#008b8b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="pulse-dot-teal" style={{ width: '5px', height: '5px' }}></span> In Flight
                </div>
              </div>
              <div className="metric-icon-box" style={{ background: '#e6f7f6', color: '#008b8b' }}>
                <i className="fa-solid fa-satellite-dish"></i>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="tab-nav">
            <button className={`tab-btn ${section === 'predictions' ? 'active' : ''}`} onClick={() => setSection('predictions')}>
              <i className="fa-solid fa-brain"></i> AI Predictions ({predictions.length})
            </button>
            <button className={`tab-btn ${section === 'manual' ? 'active' : ''}`} onClick={() => setSection('manual')}>
              <i className="fa-solid fa-paper-plane"></i> Manual Request
            </button>
            <button className={`tab-btn ${section === 'tracker' ? 'active' : ''}`} onClick={() => setSection('tracker')}>
              <i className="fa-solid fa-satellite-dish"></i> Tracker ({outgoingRequests.length})
            </button>
          </div>

          {/* Predictions (Shown on dashboard and predictions) */}
          {(section === 'dashboard' || section === 'predictions') && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-header">
                <h3><i className="fa-solid fa-brain" style={{ color: '#008b8b' }}></i> AI Time-Traveler Shortage Predictions</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => loadData(user.hospitalId)}><i className="fa-solid fa-rotate"></i> Refresh</button>
              </div>
              {predictions.length === 0 ? (
                <div className="empty-state">
                  <i className="fa-solid fa-circle-check fa-2x" style={{ color: '#10b981' }}></i>
                  <p style={{ fontWeight: 500, marginTop: '8px' }}>No stockouts predicted. Consumption rates are stable.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {predictions.map(pred => (
                    <div key={pred.inventoryItemId} className="priority-item urgency-high" style={{ paddingLeft: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <span className={`badge ${pred.urgency === 'HIGH' ? 'badge-danger' : 'badge-warning'}`}>{pred.urgency}</span>
                          <h4 style={{ fontSize: '1.1rem', marginTop: '6px', fontWeight: 700 }}>
                            {pred.medicine} <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 400 }}>(Batch: {pred.batch})</span>
                          </h4>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626' }}>{pred.hoursToZero}h left</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>Predicted Zero</div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--color-divider)', marginBottom: '14px' }}>
                        <div><div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Current</div><strong>{pred.currentStockKg} kg</strong></div>
                        <div><div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Threshold</div><span>{pred.minThresholdKg} kg</span></div>
                        <div><div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Rate</div><span style={{ color: '#008b8b', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{pred.consumptionRate} kg/hr</span></div>
                        <div><div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Deficit</div><strong style={{ color: '#10b981' }}>{pred.deficitKg} kg</strong></div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ borderColor: '#008b8b', color: '#008b8b', fontWeight: 600 }}
                          onClick={async () => {
                            setExplainingId(pred.inventoryItemId);
                            try {
                              const res = await aiApi.explainPrediction(pred);
                              setAiExplanations(prev => ({ ...prev, [pred.inventoryItemId]: res.explanation }));
                            } catch (e) {
                              setAiExplanations(prev => ({ ...prev, [pred.inventoryItemId]: "Failed to get GLM-4 explanation." }));
                            } finally {
                              setExplainingId(null);
                            }
                          }}
                        >
                          <i className="fa-solid fa-brain"></i> {explainingId === pred.inventoryItemId ? 'GLM-4 Analyzing...' : 'GLM-4 Deep Analysis'}
                        </button>
                        <button className="btn btn-primary" onClick={() => handleApproveAi(pred)}>
                          <i className="fa-solid fa-check"></i> Approve & Match Source
                        </button>
                      </div>

                      {/* Live GLM-4 Analysis Accordion */}
                      {aiExplanations[pred.inventoryItemId] && (
                        <div style={{
                          marginTop: '14px',
                          padding: '14px 16px',
                          background: 'linear-gradient(135deg, #f0fdfa 0%, #e6f7f6 100%)',
                          borderRadius: '10px',
                          border: '1px solid #99f6e4',
                          color: '#134e4a',
                          fontSize: '0.85rem',
                          lineHeight: 1.6
                        }}>
                          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: '#008b8b' }}>
                            <i className="fa-solid fa-microchip"></i> Local GLM-4 Clinical Reasoning
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap' }}>
                            {aiExplanations[pred.inventoryItemId]}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Manual */}
          {section === 'manual' && (
            <div className="card" style={{ maxWidth: '640px', marginBottom: '20px' }}>
              <div className="card-header"><h3><i className="fa-solid fa-paper-plane" style={{ color: '#d97706' }}></i> Manual Emergency Request</h3></div>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>Bypass automatic predictions for urgent needs.</p>
              <form onSubmit={handleManualSubmit}>
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Medicine</label>
                  <select className="form-input" value={manualMedicine} onChange={e => setManualMedicine(e.target.value)}>
                    <option>Paracetamol</option><option>Amoxicillin 500mg</option><option>Insulin Glargine</option><option>Azithromycin 250mg</option><option>Metformin 500mg</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Quantity (kg)</label>
                  <input type="number" className="form-input" step="0.1" min="0.1" max="5.0" value={manualQty} onChange={e => setManualQty(e.target.value)} required />
                </div>
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Urgency</label>
                  <select className="form-input" value={manualUrgency} onChange={e => setManualUrgency(e.target.value)}>
                    <option value="HIGH">HIGH — Immediate</option><option value="MEDIUM">MEDIUM — Standard</option><option value="LOW">LOW — Precautionary</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label">Reason</label>
                  <textarea className="form-input" rows={3} placeholder="Clinical reason..." value={manualNotes} onChange={e => setManualNotes(e.target.value)} style={{ resize: 'vertical' }} />
                </div>
                <button type="submit" className="btn btn-danger" style={{ width: '100%' }}><i className="fa-solid fa-paper-plane"></i> Submit Emergency Request</button>
              </form>
            </div>
          )}

          {/* Tracker (Shown on dashboard and tracker) */}
          {(section === 'dashboard' || section === 'tracker') && (
            <div className="card">
              <div className="card-header">
                <h3><i className="fa-solid fa-satellite-dish" style={{ color: '#008b8b' }}></i> Transfer Pipeline & Status Tracker</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => loadData(user.hospitalId)}><i className="fa-solid fa-rotate"></i> Refresh</button>
              </div>
              {outgoingRequests.length === 0 ? (
                <div className="empty-state"><i className="fa-solid fa-inbox fa-2x"></i><p style={{ marginTop: '8px' }}>No active requests from {user.hospitalId}.</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {outgoingRequests.map(req => (
                    <div key={req.id} style={{ padding: '18px', borderRadius: '12px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                        <div>
                          <span style={{ fontFamily: 'var(--font-mono)', color: '#008b8b', fontWeight: 700, fontSize: '0.88rem' }}>{req.id}</span>
                          <span style={{ margin: '0 8px', color: '#cbd5e1' }}>|</span>
                          <strong style={{ fontSize: '1rem' }}>{req.medicine} ({req.quantityKg} kg)</strong>
                        </div>
                        <StatusPipeline status={req.status} />
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.7 }}>
                        <div>Source: <strong style={{ color: '#0f172a' }}>{req.sourceHospitalId}</strong> · Urgency: <strong style={{ color: '#d97706' }}>{req.urgency}</strong></div>
                        <div>Reason: {req.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
