"use client";
import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import PortalHeader from '@/components/PortalHeader';
import HeatmapGrid from '@/components/HeatmapGrid';
import RegionalLiveMap from '@/components/RegionalLiveMap';
import { adminApi } from '@/lib/api';

export default function AdminPortal() {
  const [user, setUser] = useState(null);
  const [section, setSection] = useState('dashboard');
  const [heatmapData, setHeatmapData] = useState({ hospitals: [], heatmap: [] });
  const [auditLogs, setAuditLogs] = useState([]);
  const [sensorAlerts, setSensorAlerts] = useState([]);
  const [impersonating, setImpersonating] = useState(null);
  const [overrideReqId, setOverrideReqId] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverrideModal, setShowOverrideModal] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem('medilink_user');
    if (!userStr) { window.location.href = '/'; return; }
    const u = JSON.parse(userStr);
    if (u.role !== 'NETWORK_ADMIN') { window.location.href = '/'; return; }
    setUser(u);
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const hm = await adminApi.getHeatmap(); setHeatmapData(hm);
      const logs = await adminApi.getAuditLog(); setAuditLogs(logs);
      const alerts = await adminApi.getSensorAlerts(); setSensorAlerts(alerts);
    } catch (err) { console.error(err); }
  };

  const handleToggleHospital = async (hId, active) => {
    try { await adminApi.updateHospital(hId, { active: !active }); fetchAdminData(); } catch (err) { alert(err.message); }
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
      fetchAdminData();
    } catch (err) { alert(err.message); }
  };

  if (!user) return null;

  return (
    <div className="layout-dashboard">
      <Sidebar user={user} activeSection={section} onSectionChange={setSection} />

      <div className="main-content">
        <PortalHeader
          user={user}
          title={`Welcome back, ${user.name || 'Admin'} 👋`}
          subtitle="Here's what's happening across your hospital network today."
          impersonating={impersonating}
          onExitImpersonation={() => setImpersonating(null)}
        />

        <div className="page-body">

          {/* Metric Cards Row (Always shown on Dashboard or when applicable) */}
          {(section === 'dashboard' || section === 'heatmap') && (
            <div className="metrics-grid">
              <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setSection('nodes')}>
                <div>
                  <div className="metric-lbl">Connected Nodes</div>
                  <div className="metric-val">{heatmapData.hospitals?.length || 3}</div>
                  <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <i className="fa-solid fa-circle-check"></i> 100% Grid Online
                  </div>
                </div>
                <div className="metric-icon-box" style={{ background: '#e6f7f6', color: '#008b8b' }}>
                  <i className="fa-solid fa-hospital"></i>
                </div>
              </div>

              <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setSection('audit')}>
                <div>
                  <div className="metric-lbl">Audit Entries</div>
                  <div className="metric-val">{auditLogs.length || 6}</div>
                  <div style={{ fontSize: '0.72rem', color: '#008b8b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <i className="fa-solid fa-receipt"></i> Immutable Logs
                  </div>
                </div>
                <div className="metric-icon-box" style={{ background: '#f5f3ff', color: '#8b5cf6' }}>
                  <i className="fa-solid fa-receipt"></i>
                </div>
              </div>

              <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setSection('alerts')}>
                <div>
                  <div className="metric-lbl">Sensor Hygiene</div>
                  <div className="metric-val">{sensorAlerts.length || 1}</div>
                  <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <i className="fa-solid fa-triangle-exclamation"></i> Telemetry Status
                  </div>
                </div>
                <div className="metric-icon-box" style={{ background: '#fffbeb', color: '#f59e0b' }}>
                  <i className="fa-solid fa-tower-broadcast"></i>
                </div>
              </div>

              <div className="metric-card">
                <div>
                  <div className="metric-lbl">Karma Average</div>
                  <div className="metric-val">62 <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>/ 100</span></div>
                  <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <i className="fa-solid fa-award"></i> Good Samaritan
                  </div>
                </div>
                <div className="metric-icon-box" style={{ background: '#ecfdf5', color: '#10b981' }}>
                  <i className="fa-solid fa-award"></i>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: Regional GPS Live Map (Only shown under Regional Grid tab) */}
          {section === 'heatmap' && (
            <div style={{ marginBottom: '24px' }}>
              <RegionalLiveMap />
            </div>
          )}

          {/* SECTION: Regional Matrix (Only shown under Regional Grid tab) */}
          {section === 'heatmap' && (
            <section className="card" style={{ marginBottom: '24px' }}>
              <div className="card-header">
                <h3>
                  <i className="fa-solid fa-table-cells" style={{ color: '#008b8b' }}></i>
                  Regional Medicine Availability Matrix
                </h3>
                <button className="btn btn-ghost btn-sm" onClick={fetchAdminData}>
                  <i className="fa-solid fa-rotate"></i> Refresh Matrix
                </button>
              </div>
              <HeatmapGrid hospitals={heatmapData.hospitals} heatmapData={heatmapData.heatmap} />
            </section>
          )}

          {/* SECTION: Connected Hospital Nodes */}
          {(section === 'dashboard' || section === 'nodes') && (
            <section className="card">
              <div className="card-header">
                <h3>
                  <i className="fa-solid fa-hospital" style={{ color: '#008b8b' }}></i>
                  Connected Hospital Nodes & Access Controls
                </h3>
                {section === 'nodes' && (
                  <span className="badge badge-teal">{heatmapData.hospitals?.length || 3} Active Nodes</span>
                )}
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
                        <div>Karma: <strong style={{ color: '#10b981' }}>{h.karmaScore} pts</strong></div>
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
          )}

          {/* SECTION: Emergency Override */}
          {(section === 'dashboard' || section === 'override') && (
            <section className="card" style={{ border: section === 'override' ? '1.5px solid #f59e0b' : '1px solid var(--color-border)' }}>
              <div className="card-header">
                <h3><i className="fa-solid fa-shield-halved" style={{ color: '#f59e0b' }}></i> Emergency Override Console</h3>
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

          {/* SECTION: Sensor Alerts / Sensor Hygiene */}
          {(section === 'dashboard' || section === 'alerts') && (
            <section className="card" style={{ border: section === 'alerts' ? '1.5px solid #008b8b' : '1px solid var(--color-border)' }}>
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

          {/* SECTION: Audit Trail */}
          {(section === 'dashboard' || section === 'audit') && (
            <section className="card" style={{ border: section === 'audit' ? '1.5px solid #008b8b' : '1px solid var(--color-border)' }}>
              <div className="card-header">
                <h3><i className="fa-solid fa-receipt" style={{ color: '#008b8b' }}></i> Immutable Audit Trail</h3>
                <span className="badge badge-neutral">{auditLogs.length} Records</span>
              </div>
              <div className="table-wrapper" style={{ maxHeight: section === 'audit' ? '600px' : '360px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Timestamp</th><th>Action</th><th>Detail</th><th>Hospital</th><th>User</th></tr>
                  </thead>
                  <tbody>
                    {auditLogs.map(log => (
                      <tr key={log.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#64748b' }}>{new Date(log.timestamp).toLocaleString()}</td>
                        <td><span className="badge badge-teal">{log.action}</span></td>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{log.detail}</td>
                        <td><strong style={{ color: '#008b8b' }}>{log.hospitalId || '—'}</strong></td>
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
