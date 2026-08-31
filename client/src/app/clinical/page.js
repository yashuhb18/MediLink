"use client";
import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import PortalHeader from '@/components/PortalHeader';
import { inventoryApi } from '@/lib/api';

export default function ClinicalPortal() {
  const [user, setUser] = useState(null);
  const [section, setSection] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem('medilink_user');
    if (!userStr) { window.location.href = '/'; return; }
    const u = JSON.parse(userStr);
    if (u.role !== 'CLINICAL_VIEWER') { window.location.href = '/'; return; }
    setUser(u);
    handleSearch('', u.hospitalId);
  }, []);

  const handleSearch = async (query, hospitalId) => {
    setLoading(true);
    try { const r = await inventoryApi.search(query, hospitalId || user?.hospitalId); setSearchResults(r); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (!user) return null;

  return (
    <div className="layout-dashboard">
      <Sidebar user={user} activeSection={section} onSectionChange={setSection} />
      <div className="main-content">
        <PortalHeader user={user} title="Medicine Directory" subtitle="Search real-time stock across your hospital and regional network." />

        <div className="page-body">
          {/* Quick Metrics Bar on Dashboard */}
          {section === 'dashboard' && (
            <div className="metrics-grid" style={{ marginBottom: '20px' }}>
              <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setSection('inventory')}>
                <div>
                  <div className="metric-lbl">Total Medicines</div>
                  <div className="metric-val">{searchResults.length || 13}</div>
                  <div style={{ fontSize: '0.72rem', color: '#008b8b', fontWeight: 700 }}>Hospital Node {user.hospitalId}</div>
                </div>
                <div className="metric-icon-box" style={{ background: '#e6f7f6', color: '#008b8b' }}>
                  <i className="fa-solid fa-pills"></i>
                </div>
              </div>
              <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setSection('search')}>
                <div>
                  <div className="metric-lbl">Isolated Search</div>
                  <div className="metric-val" style={{ color: '#10b981' }}>Active</div>
                  <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>Regional Stock Inquiry</div>
                </div>
                <div className="metric-icon-box" style={{ background: '#ecfdf5', color: '#10b981' }}>
                  <i className="fa-solid fa-magnifying-glass"></i>
                </div>
              </div>
            </div>
          )}

          {/* Search Bar (Shown on dashboard and search sections) */}
          {(section === 'dashboard' || section === 'search') && (
            <div className="card" style={{ padding: '32px', textAlign: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '6px', color: '#0f172a' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ color: '#008b8b', marginRight: '8px' }}></i>
                Clinical Medicine Availability Search
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.86rem', marginBottom: '20px', maxWidth: '520px', margin: '0 auto 20px' }}>
                Search real-time stock across your hospital ({user.hospitalId}) and regional network nodes.
              </p>
              <form onSubmit={e => { e.preventDefault(); handleSearch(searchQuery, user.hospitalId); }} style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '8px' }}>
                <input
                  type="text" className="form-input"
                  placeholder="Search medicine (e.g. Paracetamol, Amoxicillin, Insulin)..."
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); handleSearch(e.target.value, user.hospitalId); }}
                  style={{ fontSize: '0.95rem', padding: '12px 16px' }}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '0 24px', whiteSpace: 'nowrap', fontWeight: 700 }}>
                  <i className="fa-solid fa-magnifying-glass"></i> Search
                </button>
              </form>
            </div>
          )}

          {/* Results / Directory View */}
          <div className="card">
            <div className="card-header">
              <h3>
                <i className={`fa-solid ${section === 'inventory' ? 'fa-boxes-stacked' : 'fa-pills'}`} style={{ color: '#008b8b' }}></i>
                {section === 'inventory' ? 'Regional Inventory Directory' : 'Inventory Availability Results'}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="badge badge-teal">{searchResults.length} items</span>
                <button className="btn btn-ghost btn-sm" onClick={() => handleSearch(searchQuery, user.hospitalId)}>
                  <i className="fa-solid fa-rotate"></i> Refresh
                </button>
              </div>
            </div>

            {loading ? (
              <div className="empty-state"><i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color: '#008b8b' }}></i></div>
            ) : searchResults.length === 0 ? (
              <div className="empty-state">
                <i className="fa-solid fa-box-open fa-2x"></i>
                <p style={{ fontWeight: 500, marginTop: '8px' }}>No medicines matched your query.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {searchResults.map(item => {
                  const isOwn = item.hospitalId === user.hospitalId;
                  let badgeCls = 'badge-success', label = 'In Stock';
                  if (item.statusColor === 'expired') { badgeCls = 'badge-neutral'; label = 'Expired'; }
                  else if (item.statusColor === 'red') { badgeCls = 'badge-danger'; label = 'Critical'; }
                  else if (item.statusColor === 'yellow') { badgeCls = 'badge-warning'; label = 'Low Stock'; }

                  return (
                    <div key={item.id} style={{
                      padding: '16px 20px', borderRadius: '14px', border: '1.5px solid #e2efee',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
                      background: isOwn ? '#ffffff' : '#f8fafb',
                      transition: 'border-color 0.15s ease'
                    }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#008b8b'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#e2efee'}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{item.medicine}</span>
                          <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: '#008b8b', background: '#e6f7f6', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                            Batch: {item.batch}
                          </span>
                          <span className={`badge ${badgeCls}`}>{label}</span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                          <span><i className="fa-solid fa-hospital" style={{ color: '#008b8b', marginRight: '4px' }}></i> Hospital: <strong style={{ color: '#0f172a' }}>{item.hospitalId}</strong></span>
                          <span><i className="fa-solid fa-location-dot" style={{ color: '#008b8b', marginRight: '4px' }}></i> {item.shelfPosition}</span>
                          <span>Expiry: {item.expiryDate}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {isOwn ? (
                          <>
                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#008b8b' }}>{item.availability.exactKg} kg</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>Exact Local Stock</div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#008b8b' }}>{item.availability.level}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}><i className="fa-solid fa-shield-halved"></i> Isolated Peer</div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
