"use client";
import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import PortalHeader from '@/components/PortalHeader';
import StatusPipeline from '@/components/StatusPipeline';
import SmartLabelModal from '@/components/SmartLabelModal';
import TransitTrackerCard from '@/components/TransitTrackerCard';
import ProximityIndiaMap from '@/components/ProximityIndiaMap';
import KarmaGauge from '@/components/KarmaGauge';
import { inventoryApi, transferApi, karmaApi, aiApi } from '@/lib/api';

export default function UnifiedSourceSupervisorPortal() {
  const [user, setUser] = useState(null);
  const [section, setSection] = useState('queue');
  const [inventoryList, setInventoryList] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [karmaData, setKarmaData] = useState({ score: 78, history: [] });

  // ─── Emergency Sourcing Form State (Acting as Requester) ───
  const [manualMedicine, setManualMedicine] = useState('Paracetamol 500mg');
  const [dosageCategory, setDosageCategory] = useState('Tablets');
  const [packageCount, setPackageCount] = useState('20');
  const [dosageUnit, setDosageUnit] = useState('Strips');
  const [manualQty, setManualQty] = useState('1.0');
  const [manualUrgency, setManualUrgency] = useState('HIGH');
  const [manualNotes, setManualNotes] = useState('');
  
  // Proximity Node State
  const [availableNodes, setAvailableNodes] = useState([]);
  const [selectedSourceNode, setSelectedSourceNode] = useState(null);
  const [searchingNodes, setSearchingNodes] = useState(false);

  // Driver Logistics State
  const [driverMode, setDriverMode] = useState('SENDER_DRIVER_REQUIRED');
  const [driverName, setDriverName] = useState('Suresh Kumar (Ambulance Fleet)');
  const [driverPhone, setDriverPhone] = useState('+91 98455 12345');
  const [vehicleNumber, setVehicleNumber] = useState('KA-09-EA-4421');
  const [requesterContactPhone, setRequesterContactPhone] = useState('+91 98450 12345');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Incoming Request Queue State (Acting as Sender / Donor) ───
  const [assigningReq, setAssigningReq] = useState(null);
  const [assignedDriverName, setAssignedDriverName] = useState('Ramesh Gowda (Express Pilot)');
  const [assignedDriverPhone, setAssignedDriverPhone] = useState('+91 98800 67890');
  const [assignedVehicleNo, setAssignedVehicleNo] = useState('KA-01-MD-9901');

  const [rejectingReq, setRejectingReq] = useState(null);
  const [rejectReason, setRejectReason] = useState('Needed for upcoming local surgeries');
  const [customReason, setCustomReason] = useState('');

  // AI Explanations State
  const [aiExplanations, setAiExplanations] = useState({});
  const [explainingId, setExplainingId] = useState(null);

  // Label modal
  const [smartLabelOpen, setSmartLabelOpen] = useState(false);
  const [labelItem, setLabelItem] = useState(null);

  useEffect(() => {
    const userStr = localStorage.getItem('medilink_user');
    if (!userStr) { window.location.href = '/'; return; }
    const u = JSON.parse(userStr);
    setUser(u);
    loadData(u.hospitalId);

    const handleUpdate = () => {
      const refreshedUser = JSON.parse(localStorage.getItem('medilink_user') || '{}');
      if (refreshedUser.hospitalId) {
        setUser(refreshedUser);
        loadData(refreshedUser.hospitalId);
      }
    };
    window.addEventListener('medilink_data_updated', handleUpdate);

    // ⚡ Real-Time SSE Listener
    const es = new EventSource('http://localhost:5000/api/events');
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'EMERGENCY_TRANSFER_REQUESTED' || data.type === 'ESP32_SCAN_SUCCESS' || data.type === 'INVENTORY_UPDATED' || data.type === 'FACTORY_BATCH_CREATED' || data.type === 'TRANSIT_GPS_UPDATED' || data.type === 'DRIVER_ASSIGNED') {
          const currentU = JSON.parse(localStorage.getItem('medilink_user') || '{}');
          loadData(currentU.hospitalId || u.hospitalId);
        }
      } catch (e) {}
    };

    return () => {
      window.removeEventListener('medilink_data_updated', handleUpdate);
      es.close();
    };
  }, []);

  // Fetch candidate proximity nodes when medicine name changes
  useEffect(() => {
    if (!user?.hospitalId || !manualMedicine || manualMedicine.trim().length < 2) return;
    const fetchNodes = async () => {
      setSearchingNodes(true);
      try {
        const res = await transferApi.getAvailableNodes(manualMedicine, user.hospitalId);
        setAvailableNodes(res.availableNodes || []);
        if (res.availableNodes && res.availableNodes.length > 0) {
          setSelectedSourceNode(res.availableNodes[0]);
        } else {
          setSelectedSourceNode(null);
        }
      } catch (err) {
        console.warn('[Proximity Sourcing] Error searching nodes:', err);
      } finally {
        setSearchingNodes(false);
      }
    };

    const timer = setTimeout(fetchNodes, 300);
    return () => clearTimeout(timer);
  }, [manualMedicine, user]);

  const loadData = async (hId) => {
    if (!hId) return;
    try {
      const [inv, preds, outgoing, incoming, k] = await Promise.all([
        inventoryApi.getInventory(hId).catch(() => []),
        inventoryApi.getPredictions(hId).catch(() => []),
        transferApi.getTransfers(hId, 'REQUESTING_SUPERVISOR').catch(() => []),
        transferApi.getTransfers(hId, 'SOURCE_SUPERVISOR').catch(() => []),
        karmaApi.getScore(hId).catch(() => ({ score: 78, history: [] }))
      ]);

      setInventoryList(inv || []);
      setPredictions(preds || []);
      setOutgoingRequests(outgoing || []);
      setIncomingRequests(incoming || []);
      setKarmaData(k || { score: 78, history: [] });
    } catch (err) {
      console.error('[Supervisor Portal] Error loading data:', err);
    }
  };

  const handleApproveAi = async (pred) => {
    try {
      const aiResult = await transferApi.aiSuggest(pred.medicine, pred.deficitKg, user.hospitalId, pred.urgency);
      if (!aiResult.canFulfill) { alert(`No surplus available for ${pred.medicine}.`); return; }
      const sources = aiResult.sources.map(s => ({ hospitalId: s.hospitalId, allocatedKg: s.allocatedKg }));
      await transferApi.createTransfer({
        medicine: pred.medicine,
        sources,
        requestingHospitalId: user.hospitalId,
        urgency: pred.urgency,
        reason: `AI predicted zero stock in ${pred.hoursToZero}h.`,
        dosageUnit: pred.dosageUnit || 'Strips',
        packageCount: Math.round(pred.deficitKg * 20),
        driverMode: 'SENDER_DRIVER_REQUIRED'
      });
      alert(`Emergency sourcing request generated for ${pred.medicine}!`);
      loadData(user.hospitalId);
      setSection('tracker');
    } catch (err) { alert(err.message); }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        medicine: manualMedicine,
        quantityKg: parseFloat(manualQty) || 1.0,
        dosageUnit: dosageUnit,
        packageCount: parseInt(packageCount) || 20,
        requestingHospitalId: user.hospitalId,
        urgency: manualUrgency,
        driverMode: driverMode,
        driverName: driverMode === 'REQUESTER_DRIVER' ? driverName : null,
        driverPhone: driverMode === 'REQUESTER_DRIVER' ? driverPhone : null,
        vehicleNumber: driverMode === 'REQUESTER_DRIVER' ? vehicleNumber : null,
        requesterContactPhone: requesterContactPhone,
        reason: manualNotes || `Emergency clinical sourcing for ${manualMedicine}`,
        manual: !selectedSourceNode
      };

      if (selectedSourceNode) {
        payload.sources = [{ hospitalId: selectedSourceNode.hospitalId, allocatedKg: parseFloat(manualQty) || 1.0 }];
      }

      await transferApi.createTransfer(payload);
      alert(`🚨 Emergency request for ${packageCount} ${dosageUnit} of ${manualMedicine} sent to donor node!`);
      setManualNotes('');
      loadData(user.hospitalId);
      setSection('tracker');
    } catch (err) {
      alert(`Emergency Request Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptIncoming = async (req) => {
    if (req.driverMode === 'SENDER_DRIVER_REQUIRED' && !req.driverName) {
      setAssigningReq(req);
      return;
    }

    try {
      await transferApi.acceptTransfer(req.id);
      alert(`✅ Request ${req.id} accepted! Picklist queued for pharmacist dual-lock verification.`);
      loadData(user.hospitalId);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAssignDriverSubmit = async (e) => {
    e.preventDefault();
    if (!assigningReq) return;
    try {
      await transferApi.assignDriver(assigningReq.id, {
        driverName: assignedDriverName,
        driverPhone: assignedDriverPhone,
        vehicleNumber: assignedVehicleNo,
        senderContactName: user.name || 'Chief Pharmacist',
        senderContactPhone: '+91 98800 67890'
      });
      await transferApi.acceptTransfer(assigningReq.id);
      alert(`✅ Driver ${assignedDriverName} assigned & request ${assigningReq.id} accepted for dispatch!`);
      setAssigningReq(null);
      loadData(user.hospitalId);
      setSection('tracker');
    } catch (err) {
      alert(`Driver Assignment Error: ${err.message}`);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectingReq) return;
    const reason = rejectReason === 'Other' ? customReason : rejectReason;
    if (!reason) return;
    try {
      const res = await transferApi.rejectTransfer(rejectingReq.id, reason);
      alert(`Request ${rejectingReq.id} rejected. Karma penalty applied. Rerouted to ${res.nextHospital || 'next donor'}.`);
      setRejectingReq(null);
      loadData(user.hospitalId);
    } catch (err) { alert(err.message); }
  };

  if (!user) return null;

  const urgentIncomingPending = incomingRequests.filter(r => r.status === 'PENDING_SOURCE' && r.urgency === 'HIGH');
  const allActiveTransfers = [...outgoingRequests, ...incomingRequests.filter(r => !outgoingRequests.some(o => o.id === r.id))];

  return (
    <div className="layout-dashboard">
      <Sidebar user={user} activeSection={section} onSectionChange={setSection} />
      <div className="main-content">
        <PortalHeader user={user} subtitle={`Hospital Supervisor Node — ${user.hospitalId} (Bi-directional Sender & Receiver)`} />

        <div className="page-body">
          {/* 🚨 Emergency Alert Banner (Shown if there is an urgent incoming request targeting this node) */}
          {urgentIncomingPending.length > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
              border: '2px solid #ef4444',
              borderRadius: '16px',
              padding: '18px 24px',
              marginBottom: '20px',
              boxShadow: '0 10px 25px rgba(239, 68, 68, 0.15)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem'
                }}>
                  <i className="fa-solid fa-triangle-exclamation fa-beat"></i>
                </div>
                <div>
                  <div style={{ fontSize: '0.74rem', color: '#b91c1c', fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    🚨 HIGH URGENCY INCOMING EMERGENCY SOURCING REQUEST
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#991b1b', marginTop: '2px' }}>
                    {urgentIncomingPending[0].requestingHospitalId} requested {urgentIncomingPending[0].packageCount || (urgentIncomingPending[0].quantityKg * 20)} {urgentIncomingPending[0].dosageUnit || 'Strips'} of {urgentIncomingPending[0].medicine}!
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#7f1d1d', marginTop: '2px' }}>
                    {urgentIncomingPending[0].driverMode === 'SENDER_DRIVER_REQUIRED'
                      ? '⚠️ Requester has NO driver available — YOUR logistics ambulance is required!'
                      : `🚑 Requester driver is incoming: ${urgentIncomingPending[0].driverName || 'Ambulance Fleet'}`}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn btn-primary"
                  style={{ background: '#dc2626', borderColor: '#b91c1c', fontWeight: 900, padding: '10px 18px' }}
                  onClick={() => handleAcceptIncoming(urgentIncomingPending[0])}
                >
                  <i className="fa-solid fa-check"></i> Accept & Coordinate Dispatch
                </button>
              </div>
            </div>
          )}

          {/* Quick Metrics Bar */}
          <div className="metrics-grid" style={{ marginBottom: '20px' }}>
            <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setSection('inventory')}>
              <div>
                <div className="metric-lbl">Local Inventory</div>
                <div className="metric-val" style={{ color: '#008b8b' }}>{inventoryList.length}</div>
                <div style={{ fontSize: '0.72rem', color: '#008b8b', fontWeight: 700 }}>Active Medicine Lines</div>
              </div>
              <div className="metric-icon-box" style={{ background: '#e6f7f6', color: '#008b8b' }}>
                <i className="fa-solid fa-boxes-stacked"></i>
              </div>
            </div>

            <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setSection('queue')}>
              <div>
                <div className="metric-lbl">Incoming Queue</div>
                <div className="metric-val" style={{ color: '#f59e0b' }}>
                  {incomingRequests.filter(r => r.status === 'PENDING_SOURCE').length}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 700 }}>Awaiting Your Approval</div>
              </div>
              <div className="metric-icon-box" style={{ background: '#fffbeb', color: '#f59e0b' }}>
                <i className="fa-solid fa-inbox"></i>
              </div>
            </div>

            <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setSection('tracker')}>
              <div>
                <div className="metric-lbl">Live GPS Transits</div>
                <div className="metric-val" style={{ color: '#10b981' }}>{allActiveTransfers.length}</div>
                <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>Incoming & Outgoing Fleets</div>
              </div>
              <div className="metric-icon-box" style={{ background: '#ecfdf5', color: '#10b981' }}>
                <i className="fa-solid fa-satellite-dish"></i>
              </div>
            </div>

            <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setSection('karma')}>
              <div>
                <div className="metric-lbl">Facility Karma</div>
                <div className="metric-val" style={{ color: '#10b981' }}>{karmaData.score || 78}</div>
                <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>Good Samaritan Standing</div>
              </div>
              <div className="metric-icon-box" style={{ background: '#ecfdf5', color: '#10b981' }}>
                <i className="fa-solid fa-award"></i>
              </div>
            </div>
          </div>

          {/* Unified Tab Navigation */}
          <div className="tab-nav">
            <button className={`tab-btn ${section === 'inventory' ? 'active' : ''}`} onClick={() => setSection('inventory')}>
              <i className="fa-solid fa-boxes-stacked"></i> Hospital Inventory ({inventoryList.length})
            </button>
            <button className={`tab-btn ${section === 'predictions' ? 'active' : ''}`} onClick={() => setSection('predictions')}>
              <i className="fa-solid fa-brain"></i> AI Forecasts ({predictions.length})
            </button>
            <button className={`tab-btn ${section === 'manual' ? 'active' : ''}`} onClick={() => setSection('manual')}>
              <i className="fa-solid fa-truck-medical"></i> Emergency Sourcing & Map
            </button>
            <button className={`tab-btn ${section === 'queue' ? 'active' : ''}`} onClick={() => setSection('queue')}>
              <i className="fa-solid fa-inbox"></i> Incoming Requests ({incomingRequests.filter(r => r.status === 'PENDING_SOURCE').length})
            </button>
            <button className={`tab-btn ${section === 'tracker' ? 'active' : ''}`} onClick={() => setSection('tracker')}>
              <i className="fa-solid fa-satellite-dish"></i> Live GPS Fleet ({allActiveTransfers.length})
            </button>
            <button className={`tab-btn ${section === 'karma' ? 'active' : ''}`} onClick={() => setSection('karma')}>
              <i className="fa-solid fa-award"></i> Karma Leaderboard
            </button>
            <button className={`tab-btn ${section === 'audit' ? 'active' : ''}`} onClick={() => setSection('audit')}>
              <i className="fa-solid fa-clock-rotate-left"></i> Transfer History
            </button>
          </div>

          {/* ─── 1. Hospital Inventory Tab ─── */}
          {section === 'inventory' && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-header">
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                    <i className="fa-solid fa-boxes-stacked" style={{ color: '#008b8b' }}></i> Node {user.hospitalId} Live Medicine Stock
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                    Multi-unit clinical storage tracked via ESP32-CAM and real-time cloud synchronization.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ borderColor: '#008b8b', color: '#008b8b', fontWeight: 700 }}
                    onClick={() => { setLabelItem(null); setSmartLabelOpen(true); }}
                  >
                    <i className="fa-solid fa-qrcode"></i> Generate Smart Label
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => loadData(user.hospitalId)}>
                    <i className="fa-solid fa-rotate"></i> Refresh
                  </button>
                </div>
              </div>

              {inventoryList.length === 0 ? (
                <div className="empty-state">
                  <i className="fa-solid fa-box-open fa-2x" style={{ color: '#94a3b8' }}></i>
                  <p style={{ fontWeight: 600, marginTop: '8px' }}>No medicines found in node {user.hospitalId} inventory.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Medicine Name</th>
                        <th>Current Stock (Units & Gross)</th>
                        <th>Batch Number</th>
                        <th>Shelf Location</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryList.map(item => {
                        const isLow = item.currentStockKg < (item.minThresholdKg || 1.0);
                        const unitLabel = item.dosageUnit || 'Strips';
                        const count = item.packageCount || Math.round(item.currentStockKg * 20);

                        return (
                          <tr key={item.id || item._id}>
                            <td>
                              <div style={{ fontWeight: 800, color: '#0f172a' }}>{item.medicine}</div>
                              <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>ID: {item.id}</div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 900, fontSize: '0.95rem', color: isLow ? '#ef4444' : '#008b8b' }}>
                                {count} {unitLabel}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                                {parseFloat(item.currentStockKg).toFixed(2)} kg gross
                              </div>
                            </td>
                            <td>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                                {item.batch}
                              </span>
                            </td>
                            <td>{item.shelfPosition || 'Bay 1'}</td>
                            <td>
                              <span className={`badge ${isLow ? 'badge-warning' : 'badge-teal'}`}>
                                {isLow ? '● LOW STOCK' : '● IN STOCK'}
                              </span>
                            </td>
                            <td>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                onClick={() => { setLabelItem(item); setSmartLabelOpen(true); }}
                              >
                                <i className="fa-solid fa-qrcode"></i> Label
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ─── 2. AI Depletion Predictions Tab ─── */}
          {section === 'predictions' && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-header">
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                    <i className="fa-solid fa-brain" style={{ color: '#008b8b' }}></i> AI Stockout Depletion Forecasts ({user.hospitalId})
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                    Continuous machine learning monitoring of burn rates across ICU wards.
                  </div>
                </div>
              </div>

              {predictions.length === 0 ? (
                <div className="empty-state">
                  <i className="fa-solid fa-circle-check fa-2x" style={{ color: '#10b981' }}></i>
                  <p style={{ fontWeight: 500, marginTop: '8px' }}>No stockouts predicted for {user.hospitalId}. Consumption rates are stable.</p>
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
                        <div><div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Current Stock</div><strong>{pred.currentStockKg} kg</strong></div>
                        <div><div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Min Threshold</div><span>{pred.minThresholdKg} kg</span></div>
                        <div><div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Burn Rate</div><span style={{ color: '#008b8b', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{pred.consumptionRate} kg/hr</span></div>
                        <div><div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Deficit to Source</div><strong style={{ color: '#10b981' }}>{pred.deficitKg} kg</strong></div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ borderColor: '#008b8b', color: '#008b8b', fontWeight: 600 }}
                          onClick={async () => {
                            setExplainingId(pred.inventoryItemId);
                            try {
                              const res = await aiApi.explainPrediction(pred);
                              setAiExplanations(prev => ({
                                ...prev,
                                [pred.inventoryItemId]: {
                                  text: res.explanation || "Clinical analysis ready.",
                                  model: res.model || 'GLM-4 Local (Ollama)'
                                }
                              }));
                            } catch (e) {
                              setAiExplanations(prev => ({
                                ...prev,
                                [pred.inventoryItemId]: {
                                  text: `Clinical Assessment: ${pred.medicine} is depleting at a rate of ${pred.consumptionRate} kg/hr. Sourcing ${pred.deficitKg} kg from the nearest available hospital node is strongly recommended.`,
                                  model: 'Rule Engine Fallback'
                                }
                              }));
                            } finally {
                              setExplainingId(null);
                            }
                          }}
                        >
                          <i className="fa-solid fa-brain"></i> {explainingId === pred.inventoryItemId ? 'GLM-4 Analyzing...' : 'GLM-4 Deep Analysis'}
                        </button>
                        <button className="btn btn-primary" onClick={() => handleApproveAi(pred)}>
                          <i className="fa-solid fa-check"></i> Approve & Auto-Match Nearest Node
                        </button>
                      </div>

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
                          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', color: '#008b8b' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <i className="fa-solid fa-microchip"></i> Local GLM-4 Clinical Reasoning
                            </div>
                            <span style={{ fontSize: '0.72rem', padding: '2px 8px', background: '#ccfbf1', borderRadius: '999px', fontWeight: 600 }}>
                              {aiExplanations[pred.inventoryItemId].model || 'GLM-4 Local'}
                            </span>
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap' }}>
                            {aiExplanations[pred.inventoryItemId].text || aiExplanations[pred.inventoryItemId]}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── 3. Emergency Sourcing & Proximity Live Map (Acting as Requester) ─── */}
          {section === 'manual' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '20px', alignItems: 'start' }}>
              {/* Left Column: Form */}
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '18px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-truck-medical" style={{ color: '#dc2626' }}></i>
                    Emergency Inter-Hospital Sourcing
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0 0' }}>
                    Request immediate medical supplies from the nearest regional donor nodes for <strong>{user.hospitalId}</strong>.
                  </p>
                </div>

                <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Requested Medicine / Formulation</label>
                    <input
                      type="text"
                      className="form-input"
                      value={manualMedicine}
                      onChange={e => setManualMedicine(e.target.value)}
                      required
                      placeholder="e.g. Paracetamol 500mg, Cough Relief Syrup, Insulin"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 1.1fr)', gap: '10px' }}>
                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">Form</label>
                      <select
                        className="form-input"
                        value={dosageCategory}
                        onChange={e => {
                          const f = e.target.value;
                          setDosageCategory(f);
                          if (f === 'Syrups') setDosageUnit('Bottles (100ml)');
                          else if (f === 'Injections') setDosageUnit('Vials (10ml)');
                          else if (f === 'Ointments') setDosageUnit('Tubes (20g)');
                          else if (f === 'Bulk Powders') setDosageUnit('kg');
                          else setDosageUnit('Strips');
                        }}
                      >
                        <option value="Tablets">💊 Tablets</option>
                        <option value="Syrups">🧴 Syrups</option>
                        <option value="Injections">💉 Injections</option>
                        <option value="Ointments">🧴 Ointments</option>
                        <option value="Bulk Powders">📦 Powders</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">Quantity</label>
                      <input
                        type="number"
                        className="form-input mono"
                        value={packageCount}
                        onChange={e => setPackageCount(e.target.value)}
                        required
                        placeholder="20"
                      />
                    </div>

                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">Unit</label>
                      <select className="form-input" value={dosageUnit} onChange={e => setDosageUnit(e.target.value)}>
                        <option value="Strips">Strips</option>
                        <option value="Bottles (100ml)">Bottles (100ml)</option>
                        <option value="Bottles (200ml)">Bottles (200ml)</option>
                        <option value="Vials (10ml)">Vials (10ml)</option>
                        <option value="Ampoules">Ampoules</option>
                        <option value="Tubes (20g)">Tubes (20g)</option>
                        <option value="Boxes">Boxes</option>
                        <option value="kg">kg</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">Gross Weight Estimate (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-input mono"
                        value={manualQty}
                        onChange={e => setManualQty(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">Clinical Urgency</label>
                      <select className="form-input" value={manualUrgency} onChange={e => setManualUrgency(e.target.value)}>
                        <option value="HIGH">🚨 HIGH — Immediate (Life Threatening)</option>
                        <option value="MEDIUM">⚡ MEDIUM — Standard Urgent</option>
                        <option value="LOW">🔵 LOW — Precautionary Buffer</option>
                      </select>
                    </div>
                  </div>

                  {/* Driver Logistics Mode */}
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1.5px solid #cbd5e1' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>
                      <i className="fa-solid fa-van-shuttle" style={{ color: '#008b8b', marginRight: '6px' }}></i>
                      Logistics & Driver Dispatch Mode
                    </label>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', color: '#0f172a' }}>
                        <input
                          type="radio"
                          name="driverMode"
                          value="SENDER_DRIVER_REQUIRED"
                          checked={driverMode === 'SENDER_DRIVER_REQUIRED'}
                          onChange={() => setDriverMode('SENDER_DRIVER_REQUIRED')}
                        />
                        <span>🚨 We do NOT have a driver right now — <strong>Donor hospital must dispatch immediately!</strong></span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', color: '#0f172a' }}>
                        <input
                          type="radio"
                          name="driverMode"
                          value="REQUESTER_DRIVER"
                          checked={driverMode === 'REQUESTER_DRIVER'}
                          onChange={() => setDriverMode('REQUESTER_DRIVER')}
                        />
                        <span>🚑 We have our driver & ambulance ready right now to pick it up.</span>
                      </label>
                    </div>

                    {driverMode === 'REQUESTER_DRIVER' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr)', gap: '10px' }}>
                        <div className="form-group" style={{ minWidth: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.72rem' }}>Requester Driver Name</label>
                          <input type="text" className="form-input" value={driverName} onChange={e => setDriverName(e.target.value)} required />
                        </div>
                        <div className="form-group" style={{ minWidth: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.72rem' }}>Driver Phone</label>
                          <input type="text" className="form-input mono" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} required />
                        </div>
                        <div className="form-group" style={{ minWidth: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.72rem' }}>Ambulance Reg No</label>
                          <input type="text" className="form-input mono" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} required />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '10px' }}>
                        <div className="form-group" style={{ minWidth: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.72rem' }}>Requester Emergency Coordinator Phone</label>
                          <input type="text" className="form-input mono" value={requesterContactPhone} onChange={e => setRequesterContactPhone(e.target.value)} placeholder="+91 98450 12345" required />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Clinical Reason & Department</label>
                    <textarea className="form-input" rows={2} placeholder="e.g. ICU surgery emergency..." value={manualNotes} onChange={e => setManualNotes(e.target.value)} />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-danger"
                    style={{ width: '100%', padding: '14px', fontWeight: 900, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    disabled={isSubmitting}
                  >
                    <i className="fa-solid fa-paper-plane"></i>
                    {isSubmitting ? 'Dispatching Emergency Alert...' : `Broadcast Emergency Request (${packageCount} ${dosageUnit})`}
                  </button>
                </form>
              </div>

              {/* Right Column: Live GIS Map */}
              <div>
                <ProximityIndiaMap
                  availableNodes={availableNodes}
                  selectedSourceNode={selectedSourceNode}
                  onSelectNode={(node) => setSelectedSourceNode(node)}
                  requestingHospitalId={user.hospitalId}
                  medicineName={manualMedicine}
                />
              </div>
            </div>
          )}

          {/* ─── 4. Incoming Requests Queue (Acting as Sender / Donor) ─── */}
          {section === 'queue' && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
                    <i className="fa-solid fa-inbox" style={{ color: '#008b8b' }}></i> Incoming Transfer Requests for {user.hospitalId}
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Emergency requests where other hospitals are soliciting supplies from {user.hospitalId}.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => loadData(user.hospitalId)}>
                    <i className="fa-solid fa-rotate"></i> Refresh
                  </button>
                </div>
              </div>

              {incomingRequests.filter(r => r.status === 'PENDING_SOURCE').length === 0 ? (
                <div className="empty-state" style={{ padding: '40px' }}>
                  <i className="fa-solid fa-circle-check fa-2x" style={{ color: '#10b981' }}></i>
                  <p style={{ fontWeight: 700, marginTop: '8px', fontSize: '1.05rem', color: '#0f172a' }}>All incoming solicitations for {user.hospitalId} are fulfilled!</p>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Your hospital is ready to fulfill regional emergencies.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {incomingRequests.filter(r => r.status === 'PENDING_SOURCE').map(req => {
                    const isHigh = req.urgency === 'HIGH';
                    const unitCount = req.packageCount || (req.quantityKg * 20);
                    const unitLabel = req.dosageUnit || 'Strips';

                    return (
                      <div key={req.id} className={`priority-item ${isHigh ? 'urgency-high' : 'urgency-medium'}`} style={{ padding: '20px 24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className={`badge ${isHigh ? 'badge-danger' : 'badge-warning'}`}>{req.urgency} URGENCY</span>
                            <span style={{ fontFamily: 'var(--font-mono)', color: '#008b8b', fontSize: '0.85rem', fontWeight: 800 }}>{req.id}</span>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                            {new Date(req.createdAt).toLocaleTimeString()}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                          <div>
                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Requesting Facility: <strong style={{ color: '#0f172a' }}>{req.requestingHospitalId}</strong></div>
                            <h4 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: '4px 0 0 0' }}>
                              {req.medicine} · <span style={{ color: '#008b8b' }}>{unitCount} {unitLabel}</span>
                              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginLeft: '6px' }}>({req.quantityKg} kg gross)</span>
                            </h4>
                          </div>

                          <div style={{ background: req.driverMode === 'SENDER_DRIVER_REQUIRED' ? '#fef2f2' : '#ecfdf5', padding: '8px 12px', borderRadius: '8px', border: req.driverMode === 'SENDER_DRIVER_REQUIRED' ? '1px solid #fca5a5' : '1px solid #a7f3d0' }}>
                            <div style={{ fontSize: '0.7rem', color: req.driverMode === 'SENDER_DRIVER_REQUIRED' ? '#dc2626' : '#059669', fontWeight: 900, textTransform: 'uppercase' }}>
                              Logistics Coordination
                            </div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                              {req.driverMode === 'SENDER_DRIVER_REQUIRED' ? '🚨 Your Ambulance Required' : '🚑 Requester Driver Dispatched'}
                            </div>
                          </div>
                        </div>

                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem', color: '#475569', marginBottom: '16px' }}>
                          <strong>Clinical Reason:</strong> {req.reason || 'Urgent ICU depletion mitigation.'}
                          {req.requesterContactPhone && (
                            <span style={{ marginLeft: '12px', color: '#008b8b' }}>
                              <i className="fa-solid fa-phone" style={{ marginRight: '4px' }}></i> Requester Coordinator: {req.requesterContactPhone}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ borderColor: '#ef4444', color: '#dc2626', fontWeight: 700 }}
                            onClick={() => { setRejectingReq(req); setRejectReason('Needed for upcoming local surgeries'); setCustomReason(''); }}
                          >
                            <i className="fa-solid fa-xmark"></i> Reject (-15 Karma)
                          </button>

                          <button
                            className="btn btn-primary btn-sm"
                            style={{ fontWeight: 800, padding: '8px 18px' }}
                            onClick={() => handleAcceptIncoming(req)}
                          >
                            <i className="fa-solid fa-check"></i> {req.driverMode === 'SENDER_DRIVER_REQUIRED' ? 'Assign Ambulance & Accept' : 'Accept & Queue Dispatch'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── 5. Live GPS Fleet Tracking Tab (Both Incoming & Outgoing) ─── */}
          {section === 'tracker' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>
                    <i className="fa-solid fa-satellite-dish" style={{ color: '#008b8b' }}></i> Live Fleet & GPS Consignment Tracker ({user.hospitalId})
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Tracking both incoming consignments heading to {user.hospitalId} and outgoing dispatches sent by {user.hospitalId}.
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => loadData(user.hospitalId)}>
                  <i className="fa-solid fa-rotate"></i> Refresh Telemetry
                </button>
              </div>

              {allActiveTransfers.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px' }}>
                  <i className="fa-solid fa-truck-fast fa-2x" style={{ color: '#94a3b8' }}></i>
                  <p style={{ marginTop: '10px', fontWeight: 700, fontSize: '1.05rem', color: '#0f172a' }}>No active consignments in transit for {user.hospitalId}.</p>
                  <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    Send an emergency request or accept an incoming transfer to track live GPS movements.
                  </span>
                </div>
              ) : (
                <div>
                  {allActiveTransfers.map(req => (
                    <TransitTrackerCard
                      key={req.id}
                      transfer={req}
                      onUpdate={() => loadData(user.hospitalId)}
                      userRole={user.role}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── 6. Karma Leaderboard Tab ─── */}
          {section === 'karma' && (
            <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: '20px' }}>
              <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
                <KarmaGauge score={karmaData.score || 78} hospitalCode={user.hospitalId} />
                <div style={{ marginTop: '18px', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.6 }}>
                  Higher Karma scores grant <strong>{user.hospitalId}</strong> priority queue placement during regional emergency medicine shortages.
                </div>
              </div>

              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, marginBottom: '16px' }}>
                  <i className="fa-solid fa-clock-rotate-left" style={{ color: '#008b8b', marginRight: '8px' }}></i>
                  Karma Audit Ledger for {user.hospitalId}
                </h3>
                {(!karmaData.history || karmaData.history.length === 0) ? (
                  <div className="empty-state">
                    <p>Good Samaritan standing maintained.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {karmaData.history.map((h, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div>
                          <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{h.reason || h.ruleKey}</strong>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{new Date(h.timestamp).toLocaleString()}</div>
                        </div>
                        <span style={{ fontWeight: 900, color: h.points >= 0 ? '#10b981' : '#dc2626', fontFamily: 'var(--font-mono)' }}>
                          {h.points >= 0 ? `+${h.points}` : h.points} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── 7. Transfer History Tab ─── */}
          {section === 'audit' && (
            <div className="card">
              <div className="card-header">
                <h3><i className="fa-solid fa-clock-rotate-left" style={{ color: '#008b8b' }}></i> Complete Transfer Audit Ledger ({user.hospitalId})</h3>
              </div>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Request ID</th>
                      <th>Direction</th>
                      <th>Peer Node</th>
                      <th>Medicine & Units</th>
                      <th>Urgency</th>
                      <th>Status</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allActiveTransfers.map(req => {
                      const isOutgoing = req.requestingHospitalId === user.hospitalId;
                      return (
                        <tr key={req.id}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#008b8b' }}>{req.id}</td>
                          <td>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: isOutgoing ? '#e0f2fe' : '#fef3c7',
                              color: isOutgoing ? '#0369a1' : '#b45309'
                            }}>
                              {isOutgoing ? '📤 OUTGOING (Requested)' : '📥 INCOMING (Fulfilling)'}
                            </span>
                          </td>
                          <td><strong>{isOutgoing ? req.sourceHospitalId : req.requestingHospitalId}</strong></td>
                          <td>
                            <strong>{req.medicine}</strong>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              {req.packageCount || (req.quantityKg * 20)} {req.dosageUnit || 'Strips'} ({req.quantityKg} kg)
                            </div>
                          </td>
                          <td><span className={`badge ${req.urgency === 'HIGH' ? 'badge-danger' : 'badge-warning'}`}>{req.urgency}</span></td>
                          <td><span className="badge badge-teal">{req.status}</span></td>
                          <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(req.createdAt).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Assign Donor Driver Modal ─── */}
      {assigningReq && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '520px',
            width: '100%',
            padding: '28px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-van-shuttle" style={{ color: '#008b8b' }}></i>
                Assign Dispatch Ambulance & Driver
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setAssigningReq(null)}>✕</button>
            </div>

            <p style={{ fontSize: '0.84rem', color: '#475569', marginBottom: '18px' }}>
              Requesting hospital <strong>{assigningReq.requestingHospitalId}</strong> has requested emergency consignment dispatch for <strong>{assigningReq.packageCount || (assigningReq.quantityKg * 20)} {assigningReq.dosageUnit || 'Strips'} of {assigningReq.medicine}</strong>.
            </p>

            <form onSubmit={handleAssignDriverSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Assigned Driver Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={assignedDriverName}
                  onChange={e => setAssignedDriverName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Driver Contact Phone</label>
                <input
                  type="text"
                  className="form-input mono"
                  value={assignedDriverPhone}
                  onChange={e => setAssignedDriverPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Ambulance / Transport Vehicle Plate No</label>
                <input
                  type="text"
                  className="form-input mono"
                  value={assignedVehicleNo}
                  onChange={e => setAssignedVehicleNo(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setAssigningReq(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 800 }}>
                  <i className="fa-solid fa-paper-plane"></i> Confirm & Start Live GPS Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Reject Modal ─── */}
      {rejectingReq && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '480px', width: '100%', padding: '24px' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-triangle-exclamation"></i> Confirm Rejection & Reroute
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>
              Rejecting request {rejectingReq.id} will apply a <strong>-15 Karma penalty</strong> and automatically reroute the medicine request to the next nearest regional donor.
            </p>
            <form onSubmit={handleRejectSubmit}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Select Rejection Reason</label>
                <select className="form-input" value={rejectReason} onChange={e => setRejectReason(e.target.value)}>
                  <option>Needed for upcoming local surgeries</option>
                  <option>Critical emergency in local ICU</option>
                  <option>Stock reserved for scheduled procedures</option>
                  <option>Other</option>
                </select>
              </div>
              {rejectReason === 'Other' && (
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Custom Clinical Reason</label>
                  <input type="text" className="form-input" value={customReason} onChange={e => setCustomReason(e.target.value)} required />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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
