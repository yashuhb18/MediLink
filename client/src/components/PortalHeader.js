"use client";
import React, { useState, useEffect, useRef } from 'react';

// Synthesize pleasant emergency alert chime using Web Audio API
function playNotificationChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    osc2.frequency.setValueAtTime(440, ctx.currentTime); // A4
    osc2.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15); // E5

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.5);
    osc2.stop(ctx.currentTime + 0.5);
  } catch (e) {
    // AudioContext blocked by browser policy until user gesture
  }
}

export default function PortalHeader({ user, title, subtitle, impersonating, onExitImpersonation }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [activeToast, setActiveToast] = useState(null);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Connect to SSE Stream for Live Notifications
  useEffect(() => {
    if (!user) return;

    // Fetch initial notification history
    fetch('http://localhost:5000/api/events/recent')
      .then(res => res.json())
      .then(history => {
        if (Array.isArray(history)) {
          setNotifications(history.map(item => ({ ...item, isRead: false })));
          setUnreadCount(history.length);
        }
      })
      .catch(() => {});

    // SSE Live Stream Listener
    const es = new EventSource('http://localhost:5000/api/events');

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'PING' || data.type === 'CONNECTED') return;

        let title = 'System Notification';
        let body = 'Update received from network.';
        let icon = 'fa-bell';
        let isRelevant = true;

        if (data.type === 'EMERGENCY_TRANSFER_REQUESTED') {
          title = `🚨 Emergency Transfer Request`;
          body = `${data.requestingHospitalId} requested ${data.packageCount || (data.quantityKg * 20)} ${data.dosageUnit || 'Strips'} of ${data.medicine}`;
          icon = 'fa-truck-medical';
          // Filter relevancy: relevant if user is the donor or requester or admin
          if (user.hospitalId && data.sourceHospitalId !== user.hospitalId && data.requestingHospitalId !== user.hospitalId && user.role !== 'NETWORK_ADMIN') {
            isRelevant = false;
          }
        } else if (data.type === 'DRIVER_ASSIGNED') {
          title = `🚑 Driver Dispatched`;
          body = `Driver ${data.driverName} assigned to transfer ${data.requestId}`;
          icon = 'fa-id-card';
        } else if (data.type === 'TRANSIT_GPS_UPDATED') {
          title = `📍 Live Transit Progress`;
          body = `Transfer ${data.requestId}: ${data.transitGps?.currentLocationName || 'En-route'} (${data.transitGps?.progressPercent || 0}%)`;
          icon = 'fa-location-arrow';
        } else if (data.type === 'ESP32_SCAN_SUCCESS' || data.type === 'FACTORY_BATCH_CREATED') {
          title = `📦 Inventory Restocked`;
          body = `Batch authenticated & stored in node ${data.hospitalId || data.destHospital || ''}`;
          icon = 'fa-boxes-stacked';
        }

        if (isRelevant) {
          const newNotif = {
            id: data.id || `NOTIF-${Date.now()}`,
            type: data.type,
            title,
            body,
            icon,
            timestamp: data.timestamp || new Date().toISOString(),
            isRead: false,
            raw: data
          };

          setNotifications(prev => [newNotif, ...prev.slice(0, 30)]);
          setUnreadCount(prev => prev + 1);

          // Trigger Sound & Pop-up Toast
          playNotificationChime();
          setActiveToast(newNotif);
          setTimeout(() => setActiveToast(null), 6500);
        }
      } catch (err) {
        console.warn('[Notification Error]:', err);
      }
    };

    return () => es.close();
  }, [user]);

  const handleToggleOpen = () => {
    setIsOpen(prev => !prev);
    if (!isOpen) {
      // Mark visible as read
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    }
  };

  const handleClearAll = () => {
    setNotifications([]);
    setUnreadCount(0);
    setIsOpen(false);
  };

  if (!user) return null;

  return (
    <>
      {/* ─── Floating Top-Right Toast Notification ─── */}
      {activeToast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 10000,
          background: '#0f172a',
          color: '#ffffff',
          borderRadius: '14px',
          padding: '16px 20px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
          border: '1.5px solid #008b8b',
          maxWidth: '380px',
          animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          gap: '14px',
          alignItems: 'flex-start'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #008b8b, #10b981)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            flexShrink: 0
          }}>
            <i className={`fa-solid ${activeToast.icon}`}></i>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#38bdf8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{activeToast.title}</span>
              <button
                onClick={() => setActiveToast(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem', padding: 0 }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#e2e8f0', marginTop: '4px', lineHeight: 1.4 }}>
              {activeToast.body}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '6px' }}>
              Just now · MediLink Real-Time Edge
            </div>
          </div>
        </div>
      )}

      {impersonating && (
        <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '8px 32px', color: '#ef4444', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <i className="fa-solid fa-user-ninja"></i> IMPERSONATING: <strong>{impersonating.supervisorName}</strong> ({impersonating.hospitalId})
          </div>
          <button className="btn btn-danger btn-sm" onClick={onExitImpersonation}>
            Exit Impersonation
          </button>
        </div>
      )}

      <header className="topbar">
        <div className="topbar-left">
          <h2>{title || `Welcome back, ${user.name || 'User'} 👋`}</h2>
          <p>{subtitle || "Here's what's happening across your hospital network today."}</p>
        </div>

        <div className="topbar-right" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '10px' }} ref={dropdownRef}>
          {/* Hospital Facility Identity Badge */}
          {user.hospitalId && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#f4f8f8',
              padding: '5px 12px',
              borderRadius: '999px',
              border: '1px solid #e2efee',
              fontSize: '0.78rem',
              fontWeight: 800,
              color: '#0f172a'
            }}>
              <i className="fa-solid fa-hospital" style={{ color: '#008b8b' }}></i>
              <span>{user.hospitalId === 'H01' ? 'Apollo Mysore (H01)' : user.hospitalId === 'H02' ? 'Bangalore Medical (H02)' : user.hospitalId === 'H03' ? 'Mangalore General (H03)' : `Node ${user.hospitalId}`}</span>
            </div>
          )}

          {/* Notification Bell Button */}
          <button
            onClick={handleToggleOpen}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: unreadCount > 0 ? '#e6f7f6' : '#f4f8f8',
              border: unreadCount > 0 ? '1.5px solid #008b8b' : '1px solid #e2efee',
              color: unreadCount > 0 ? '#008b8b' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.2s ease'
            }}
            title="Notifications & Alerts"
          >
            <i className={`fa-solid fa-bell ${unreadCount > 0 ? 'fa-beat' : ''}`} style={{ fontSize: '1rem' }}></i>

            {/* Unread Counter Badge */}
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#ef4444',
                color: '#ffffff',
                borderRadius: '999px',
                padding: '2px 6px',
                fontSize: '0.68rem',
                fontWeight: 900,
                border: '2px solid #ffffff',
                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)'
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Profile Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px 4px 4px', borderRadius: '9999px', background: '#f4f8f8', border: '1px solid #e2efee' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: '#008b8b', color: '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '0.75rem'
            }}>
              {user.initials || user.name?.substring(0,2).toUpperCase() || 'RK'}
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>{user.name}</div>
              <div style={{ fontSize: '0.68rem', color: '#008b8b', fontWeight: 600 }}>{user.hospitalId || 'Admin'}</div>
            </div>
          </div>

          {/* ─── Notification Dropdown Drawer ─── */}
          {isOpen && (
            <div style={{
              position: 'absolute',
              top: '52px',
              right: '0',
              width: '360px',
              maxHeight: '480px',
              background: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
              border: '1.5px solid #e2e8f0',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              {/* Dropdown Header */}
              <div style={{
                padding: '14px 18px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>Real-Time Alerts</strong>
                  <span style={{ fontSize: '0.7rem', background: '#e6f7f6', color: '#008b8b', padding: '2px 7px', borderRadius: '999px', fontWeight: 800 }}>
                    {notifications.length} Total
                  </span>
                </div>
                {notifications.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Notification List Body */}
              <div style={{ overflowY: 'auto', flex: 1, padding: '8px' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '36px 20px', textAlign: 'center', color: '#94a3b8' }}>
                    <i className="fa-solid fa-bell-slash fa-2x" style={{ opacity: 0.5, marginBottom: '8px' }}></i>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>No notifications yet</p>
                    <span style={{ fontSize: '0.72rem' }}>New alerts and requests will ring here live.</span>
                  </div>
                ) : (
                  notifications.map((n, idx) => (
                    <div
                      key={n.id || idx}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        marginBottom: '6px',
                        background: n.isRead ? '#ffffff' : '#f0fdfa',
                        border: n.isRead ? '1px solid #f1f5f9' : '1px solid #99f6e4',
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'flex-start'
                      }}
                    >
                      <div style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        background: '#e6f7f6',
                        color: '#008b8b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.82rem',
                        flexShrink: 0
                      }}>
                        <i className={`fa-solid ${n.icon || 'fa-bell'}`}></i>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '2px', lineHeight: 1.3 }}>
                          {n.body}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                          {new Date(n.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Dropdown Footer */}
              <div style={{ padding: '10px 16px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', textAlign: 'center', fontSize: '0.72rem', color: '#64748b' }}>
                <i className="fa-solid fa-circle-nodes" style={{ color: '#008b8b', marginRight: '4px' }}></i>
                Connected to MediLink Real-Time SSE Hub
              </div>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
