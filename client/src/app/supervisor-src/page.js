"use client";
import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import PortalHeader from '@/components/PortalHeader';
import KarmaGauge from '@/components/KarmaGauge';
import SmartLabelModal from '@/components/SmartLabelModal';
import { transferApi, karmaApi } from '@/lib/api';

export default function SourceSupervisorPortal() {
  const [user, setUser] = useState(null);
  const [section, setSection] = useState('queue');
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [karmaData, setKarmaData] = useState({ score: 50, history: [] });
  const [rejectingReq, setRejectingReq] = useState(null);
  const [rejectReason, setRejectReason] = useState('Needed for upcoming local surgeries');
  const [customReason, setCustomReason] = useState('');
  const [smartLabelOpen, setSmartLabelOpen] = useState(false);
  const [labelItem, setLabelItem] = useState(null);

  useEffect(() => {
    const userStr = localStorage.getItem('medilink_user');
    if (!userStr) { window.location.href = '/'; return; }
    const u = JSON.parse(userStr);
    if (u.role !== 'SOURCE_SUPERVISOR') { window.location.href = '/'; return; }
    setUser(u);
    loadData(u.hospitalId);
  }, []);

  const loadData = async (hId) => {
    try {
      const reqs = await transferApi.getTransfers(hId, 'SOURCE_SUPERVISOR'); setIncomingRequests(reqs);
      const k = await karmaApi.getScore(hId); setKarmaData(k);
    } catch (err) { console.error(err); }
  };

  const handleAccept = async (reqId) => {
    try { await transferApi.acceptTransfer(reqId); alert(`Request ${reqId} accepted! Picklist sent to pharmacist.`); loadData(user.hospitalId); }
    catch (err) { alert(err.message); }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectingReq) return;
    const reason = rejectReason === 'Other' ? customReason : rejectReason;
    if (!reason) return;
    try {
      const res = await transferApi.rejectTransfer(rejectingReq.id, reason);
      alert(`Request ${rejectingReq.id} rejected. Karma penalty applied. Rerouted to ${res.nextHospital || 'next donor'}.`);
      setRejectingReq(null); loadData(user.hospitalId);
    } catch (err) { alert(err.message); }
  };

  if (!user) return null;

  return (
    <div className="layout-dashboard">
      <Sidebar user={user} activeSection={section} onSectionChange={setSection} />
      <div className="main-content">
        <PortalHeader user={user} subtitle={`Source Supervisor — ${user.hospitalId}`} />

        <div className="page-body">
          {/* Quick Metrics Bar on Dashboard */}
          {section === 'dashboard' && (
            <div className="metrics-grid" style={{ marginBottom: '20px' }}>
              <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setSection('queue')}>
                <div>
                  <div className="metric-lbl">Pending Requests</div>
                  <div className="metric-val">{incomingRequests.filter(r => r.status === 'PENDING_SOURCE').length}</div>
                  <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 700 }}>Awaiting Approval</div>
                </div>
                <div className="metric-icon-box" style={{ background: '#fffbeb', color: '#f59e0b' }}>
                  <i className="fa-solid fa-inbox"></i>
                </div>
              </div>

              <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setSection('karma')}>
                <div>
                  <div className="metric-lbl">Facility Karma</div>
                  <div className="metric-val" style={{ color: '#10b981' }}>{karmaData.score || 78} pts</div>
                  <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>Good Samaritan Rank #1</div>
                </div>
                <div className="metric-icon-box" style={{ background: '#ecfdf5', color: '#10b981' }}>
                  <i className="fa-solid fa-award"></i>
                </div>
              </div>

              <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setSection('audit')}>
                <div>
                  <div className="metric-lbl">Dispatched Transfers</div>
                  <div className="metric-val" style={{ color: '#008b8b' }}>{incomingRequests.filter(r => r.status === 'DISPATCHED' || r.status === 'ACCEPTED').length}</div>
                  <div style={{ fontSize: '0.72rem', color: '#008b8b', fontWeight: 700 }}>Active & Fulfilled</div>
                </div>
                <div className="metric-icon-box" style={{ background: '#e6f7f6', color: '#008b8b' }}>
                  <i className="fa-solid fa-truck-fast"></i>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: (section === 'queue' || section === 'audit') ? '1fr' : '1fr 340px', gap: '20px' }}>

            {/* Incoming Queue (Shown on dashboard and queue) */}
            {(section === 'dashboard' || section === 'queue') && (
              <div className="card">
                <div className="card-header">
                  <h3><i className="fa-solid fa-inbox" style={{ color: '#008b8b' }}></i> Incoming Request Queue</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="badge badge-teal">{incomingRequests.length} Total</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ borderColor: '#008b8b', color: '#008b8b', fontWeight: 700 }}
                      onClick={() => { setLabelItem(null); setSmartLabelOpen(true); }}
                    >
                      <i className="fa-solid fa-qrcode"></i> Generate Smart Label (ESP32-CAM)
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => loadData(user.hospitalId)}>
                      <i className="fa-solid fa-rotate"></i> Refresh
                    </button>
                  </div>
                </div>

                {incomingRequests.length === 0 ? (
                  <div className="empty-state">
                    <i className="fa-solid fa-circle-check fa-2x" style={{ color: '#10b981' }}></i>
                    <p style={{ fontWeight: 500, marginTop: '8px' }}>No pending requests for {user.hospitalId}.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {incomingRequests.map(req => {
                      const isHigh = req.urgency === 'HIGH';
                      const isPending = req.status === 'PENDING_SOURCE';
                      return (
                        <div key={req.id} className={`priority-item ${isHigh ? 'urgency-high' : req.urgency === 'MEDIUM' ? 'urgency-medium' : 'urgency-low'}`} style={{ paddingLeft: '24px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className={`badge ${isHigh ? 'badge-danger' : 'badge-warning'}`}>{req.urgency}</span>
                              <span style={{ fontFamily: 'var(--font-mono)', color: '#008b8b', fontSize: '0.78rem', fontWeight: 700 }}>{req.id}</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{new Date(req.createdAt).toLocaleTimeString()}</span>
                          </div>

                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ fontSize: '0.88rem', color: '#64748b' }}>Requesting Node: <strong style={{ color: '#0f172a' }}>{req.requestingHospitalId}</strong></div>
                            <div style={{ fontSize: '1rem', fontWeight: 800, marginTop: '4px', color: '#0f172a' }}>
                              {req.medicine} · <span style={{ color: '#008b8b' }}>{req.quantityKg} kg</span>
                            </div>
                          </div>

                          <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '14px' }}>Reason: {req.reason}</p>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <span className="badge badge-teal">{req.status}</span>
                            {isPending && (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => { setRejectingReq(req); setRejectReason('Needed for upcoming local surgeries'); setCustomReason(''); }}>
                                  <i className="fa-solid fa-xmark" style={{ color: '#dc2626' }}></i> Reject
                                </button>
                                <button className="btn btn-primary btn-sm" onClick={() => handleAccept(req.id)}>
                                  <i className="fa-solid fa-check"></i> Accept & Queue Dispatch
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Karma Panel (Shown on dashboard, karma, and audit) */}
            {(section === 'dashboard' || section === 'karma') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="card" style={{ textAlign: 'center' }}>
                  <div className="card-header" style={{ justifyContent: 'center' }}>
                    <h3><i className="fa-solid fa-award" style={{ color: '#d97706' }}></i> Facility Karma Standing</h3>
                  </div>
                  <KarmaGauge score={karmaData.score || 78} label="Facility Reputation" />
                </div>

                <div className="card">
                  <h4 style={{ fontSize: '0.74rem', fontWeight: 800, color: '#008b8b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px' }}>
                    <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: '6px' }}></i>
                    Score Ledger & History
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                    {karmaData.history?.map((h, i) => (
                      <div key={i} style={{ fontSize: '0.82rem', padding: '10px 12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2efee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#334155', fontWeight: 600 }}>{h.reason}</span>
                        <strong style={{ color: h.change > 0 ? '#10b981' : '#dc2626', fontFamily: 'var(--font-mono)' }}>
                          {h.change > 0 ? `+${h.change}` : h.change}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Audit Section */}
            {section === 'audit' && (
              <div className="card">
                <div className="card-header">
                  <h3><i className="fa-solid fa-receipt" style={{ color: '#008b8b' }}></i> Donor Audit Log</h3>
                  <span className="badge badge-teal">Node {user.hospitalId}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {incomingRequests.map(r => (
                    <div key={r.id} style={{ padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2efee', background: '#f8fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{r.id} — {r.medicine} ({r.quantityKg} kg)</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>Requesting Node: {r.requestingHospitalId} · Created: {new Date(r.createdAt).toLocaleString()}</div>
                      </div>
                      <span className="badge badge-teal">{r.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectingReq && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="card-header">
              <h3><i className="fa-solid fa-triangle-exclamation" style={{ color: '#dc2626' }}></i> Rejection Reason</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setRejectingReq(null)}><i className="fa-solid fa-xmark"></i></button>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>Rejecting will deduct karma points (-5 for High Urgency).</p>
            <form onSubmit={handleRejectSubmit}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Reason</label>
                <select className="form-input" value={rejectReason} onChange={e => setRejectReason(e.target.value)}>
                  <option value="Needed for upcoming local surgeries">Needed for local surgeries</option>
                  <option value="Current stock at minimum threshold safety buffer">Stock at minimum threshold</option>
                  <option value="Pharmacy dispatch staff unavailable">Dispatch staff unavailable</option>
                  <option value="Other">Other (specify)</option>
                </select>
              </div>
              {rejectReason === 'Other' && (
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Specific Reason</label>
                  <input type="text" className="form-input" placeholder="Enter reason..." value={customReason} onChange={e => setCustomReason(e.target.value)} required />
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setRejectingReq(null)}>Cancel</button>
                <button type="submit" className="btn btn-danger">Confirm Rejection</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Smart Optical QR Generator Modal */}
      <SmartLabelModal
        isOpen={smartLabelOpen}
        onClose={() => setSmartLabelOpen(false)}
        defaultItem={labelItem}
      />
    </div>
  );
}
