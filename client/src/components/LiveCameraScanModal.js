"use client";
import React, { useEffect, useState } from 'react';

export default function LiveCameraScanModal() {
  const [scanEvent, setScanEvent] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let eventSource;
    try {
      eventSource = new EventSource('http://localhost:5000/api/events/stream');

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ESP32_SCAN_SUCCESS') {
            setScanEvent(data);
            setVisible(true);

            // Play pleasant medical confirmation chime via Web Audio API
            playSuccessChime();

            // Dispatch global event for dashboard tables to auto-refresh
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('medilink_data_updated', { detail: data }));
            }
          }
        } catch (e) {
          console.error('[SSE] Parse error:', e);
        }
      };

      eventSource.onerror = (err) => {
        console.warn('[SSE] EventSource reconnecting...');
      };
    } catch (err) {
      console.warn('[SSE] Setup error:', err);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  const playSuccessChime = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (e) {}
  };

  if (!visible || !scanEvent) return null;

  const { result, payload } = scanEvent;

  return (
    <div style={{
      position: 'fixed',
      top: '24px',
      right: '24px',
      zIndex: 10000,
      maxWidth: '440px',
      width: 'calc(100vw - 32px)',
      backgroundColor: '#ffffff',
      borderRadius: '20px',
      boxShadow: '0 20px 50px rgba(0, 139, 139, 0.35), 0 0 0 2px #008b8b',
      overflow: 'hidden',
      animation: 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 18px',
        background: 'linear-gradient(135deg, #008b8b 0%, #006666 100%)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            color: '#008b8b',
            fontSize: '0.8rem'
          }}>
            <i className="fa-solid fa-camera"></i>
          </span>
          <strong style={{ fontSize: '0.9rem' }}>ESP32-CAM Optical Scan Verified!</strong>
        </div>
        <button
          onClick={() => setVisible(false)}
          style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '1rem' }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
              {result?.medicine || payload?.medicine}
            </h4>
            <div style={{ fontSize: '0.74rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
              Batch: {result?.batch || payload?.batch} | Weight: {result?.weightKg || payload?.weightKg} kg
            </div>
          </div>
          <span style={{
            padding: '4px 10px',
            borderRadius: '999px',
            backgroundColor: '#dcfce7',
            color: '#15803d',
            fontSize: '0.72rem',
            fontWeight: 800
          }}>
            {result?.action || payload?.action}
          </span>
        </div>

        {/* Message Status */}
        <div style={{
          padding: '10px 12px',
          backgroundColor: '#f8fafc',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          fontSize: '0.82rem',
          color: '#334155',
          fontWeight: 600
        }}>
          {result?.message}
        </div>

        {/* GLM-4 Verification Reasoning */}
        {result?.glmExplanation && (
          <div style={{
            padding: '10px 12px',
            background: 'linear-gradient(135deg, #f0fdfa 0%, #e6f7f6 100%)',
            borderRadius: '10px',
            border: '1px solid #99f6e4',
            color: '#134e4a',
            fontSize: '0.78rem',
            lineHeight: 1.5
          }}>
            <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', color: '#008b8b' }}>
              <i className="fa-solid fa-microchip"></i> Local GLM-4 Optical Reasoning
            </div>
            <div>{result.glmExplanation}</div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            onClick={() => setVisible(false)}
            className="btn btn-primary btn-sm"
            style={{ fontSize: '0.78rem', padding: '6px 14px' }}
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
}
