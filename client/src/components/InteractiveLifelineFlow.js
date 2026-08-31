"use client";
import React, { useState, useEffect } from 'react';

export default function InteractiveLifelineFlow() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [interactiveActionTriggered, setInteractiveActionTriggered] = useState(false);
  const [actionFeedback, setActionFeedback] = useState('');

  const steps = [
    {
      id: 1,
      badge: 'STAGE 01 · PREDICTIVE ML',
      shortTitle: 'AI Shortage Forecast',
      title: 'AI Time-Traveler Depletion Predictor',
      subtitle: 'Predicts exact stockouts 5 hours in advance',
      desc: 'At Mysore Hospital (H01), an HX711 smart scale detects Paracetamol dropping at 0.22 kg/hr. The predictive ML engine forecasts zero-stock in 4.5 hours and automatically triggers an alert before ICU doctors run out.',
      icon: 'fa-brain',
      actionText: '⚡ Trigger Predictive ML Scan',
      actionSuccessText: '✓ ML Rate: -0.22 kg/hr · Auto-Alert Generated for Mysore H01!',
      tiles: [
        { label: 'Current Stock', val: '1.00 kg (Critical)', icon: 'fa-scale-unbalanced', color: '#dc2626' },
        { label: 'Burn Rate', val: '-0.22 kg / hr', icon: 'fa-fire-flame-curved', color: '#008b8b' },
        { label: 'Safety Threshold', val: '2.00 kg Buffer', icon: 'fa-shield-halved', color: '#d97706' },
        { label: 'Time to Zero', val: '4.5 Hours Left', icon: 'fa-hourglass-half', color: '#dc2626' }
      ]
    },
    {
      id: 2,
      badge: 'STAGE 02 · GAME THEORY',
      shortTitle: 'Karma Donor Matching',
      title: 'Nash Equilibrium Multi-Node Matcher',
      subtitle: 'Ranks regional donor hospitals by proximity & trust',
      desc: 'The Karma Engine evaluates 3 connected regional nodes based on road distance, available surplus, and historical reliability. Bangalore Central (H02) is selected as the optimal donor with a Karma Score of 78/100.',
      icon: 'fa-award',
      actionText: '🎯 Run Nash Equilibrium Matching',
      actionSuccessText: '✓ Optimal Match Found: Bangalore H02 (+78 Karma, 14.5kg Surplus)',
      tiles: [
        { label: 'Selected Donor', val: 'Bangalore BMC (H02)', icon: 'fa-hospital', color: '#008b8b' },
        { label: 'Donor Karma', val: '78 / 100 (Tier A)', icon: 'fa-award', color: '#10b981' },
        { label: 'Surplus Stock', val: '14.50 kg Available', icon: 'fa-boxes-stacked', color: '#10b981' },
        { label: 'Transit Corridor', val: '140 km (NH-275)', icon: 'fa-route', color: '#0f172a' }
      ]
    },
    {
      id: 3,
      badge: 'STAGE 03 · DIGITAL AUTHORIZATION',
      shortTitle: 'Clinical 1-Click Seal',
      title: '1-Click Cryptographic Supervisor Approval',
      subtitle: 'Encrypted clinical workflow with digital signature',
      desc: 'Emergency requisition REQ-1001 is routed directly to Clinical Supervisor Dr. Sarah Chen. She reviews the AI depletion rationale and authorizes the transfer with a single encrypted click.',
      icon: 'fa-signature',
      actionText: '✍️ Stamp 1-Click Clinical Seal',
      actionSuccessText: '✓ Cryptographic Seal Applied: SHA-256 Hash e8f92a10 Verified!',
      tiles: [
        { label: 'Protocol ID', val: 'REQ-1001 (Priority)', icon: 'fa-hashtag', color: '#008b8b' },
        { label: 'Authorizer', val: 'Dr. Sarah Chen, MD', icon: 'fa-user-doctor', color: '#0f172a' },
        { label: 'Approved Quantity', val: '1.00 kg Paracetamol', icon: 'fa-pills', color: '#10b981' },
        { label: 'Response Latency', val: '< 30s Fast Track', icon: 'fa-bolt', color: '#008b8b' }
      ]
    },
    {
      id: 4,
      badge: 'STAGE 04 · PHYSICAL DUAL-LOCK',
      shortTitle: 'Laser Barcode + RFID',
      title: 'Hardware Dual-Lock Verification Station',
      subtitle: 'Zero wrong medication errors via physical dual-checks',
      desc: 'At Bangalore Pharmacy, the Dispatch Pharmacist scans the package using the laser Barcode Scanner and verifies the RC522 RFID tag. The ESP32 smart vault solenoid unlocks only when both match 100%.',
      icon: 'fa-barcode',
      actionText: '🔓 Scan Barcode & Disengage Smart Vault',
      actionSuccessText: '✓ 100% Dual-Lock Match · ESP32 Solenoid Vault Opened!',
      tiles: [
        { label: 'Laser Barcode UID', val: 'BATCH-PCM-2026-X9', icon: 'fa-barcode', color: '#0f172a' },
        { label: 'RFID Tag UID', val: 'E280116060000204', icon: 'fa-id-card', color: '#d97706' },
        { label: 'ESP32 Solenoid', val: 'DISENGAGED (OPEN)', icon: 'fa-lock-open', color: '#10b981' },
        { label: 'Verification Check', val: '100% Match Passed', icon: 'fa-circle-check', color: '#10b981' }
      ]
    },
    {
      id: 5,
      badge: 'STAGE 05 · TRANSIT & REPUTATION',
      shortTitle: 'GPS Transit & Karma Reward',
      title: 'GPS Transit & Good Samaritan Karma Credit',
      subtitle: 'Live cold-chain tracking & instant karma reward',
      desc: 'The medicine dispatch travels along NH-275 under live GPS tracking. Upon receipt at Mysore Hospital, staff confirm the delivery. Donor Bangalore H02 is immediately credited with +15 Karma points!',
      icon: 'fa-truck-fast',
      actionText: '🏆 Confirm Delivery & Credit Karma Points',
      actionSuccessText: '✓ Stock Replenished at Mysore H01 · +15 Karma Credited to Donor H02!',
      tiles: [
        { label: 'Transit Vehicle', val: 'MED-EXPRESS-04 (GPS)', icon: 'fa-truck-fast', color: '#008b8b' },
        { label: 'Receiving Node', val: 'Mysore District (H01)', icon: 'fa-location-dot', color: '#0f172a' },
        { label: 'Karma Awarded', val: '+15 Points to H02', icon: 'fa-star', color: '#10b981' },
        { label: 'Zero-Stockout Result', val: 'ICU Crisis Averted', icon: 'fa-shield-heart', color: '#10b981' }
      ]
    }
  ];

  const current = steps[activeStep];

  // Auto-play loop
  useEffect(() => {
    let timer;
    if (isPlaying) {
      timer = setInterval(() => {
        setActiveStep(prev => (prev >= steps.length - 1 ? 0 : prev + 1));
      }, 3500);
    }
    return () => clearInterval(timer);
  }, [isPlaying]);

  const handleTriggerAction = () => {
    setInteractiveActionTriggered(true);
    setActionFeedback(current.actionSuccessText);
    setTimeout(() => {
      setInteractiveActionTriggered(false);
    }, 2800);
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto' }}>

      {/* ── Top Scenario Control Deck ── */}
      <div style={{
        background: '#ffffff',
        border: '1.5px solid #d8ece9',
        borderRadius: '24px',
        padding: '20px 24px',
        marginBottom: '28px',
        boxShadow: '0 8px 30px rgba(0, 139, 139, 0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: '#e6f7f6', color: '#008b8b',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
            border: '1.5px solid #cceee9',
          }}>
            <i className="fa-solid fa-route"></i>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#008b8b', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>
              LIVE CLINICAL SCENARIO · MYSORE HOSPITAL ICU
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
              Paracetamol 500mg Depletion Emergency (1.00 kg Deficit)
            </div>
          </div>
        </div>

        {/* Auto-Play Toggle & Step Jump Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              background: isPlaying ? '#008b8b' : '#ffffff',
              color: isPlaying ? '#ffffff' : '#008b8b',
              border: '1.5px solid #008b8b',
              padding: '8px 18px',
              borderRadius: '9999px',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px',
              transition: 'all 0.2s ease',
            }}
          >
            <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
            <span>{isPlaying ? 'Pause Auto-Play' : '▶ Auto-Play Lifeline'}</span>
          </button>
        </div>
      </div>

      {/* ── Interconnected 5-Milestone Visual Track ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px',
        marginBottom: '28px',
      }}>
        {steps.map((s, idx) => {
          const isActive = activeStep === idx;
          const isDone = idx < activeStep;

          return (
            <div
              key={s.id}
              onClick={() => { setActiveStep(idx); setActionFeedback(''); }}
              style={{
                background: isActive ? 'linear-gradient(135deg, #008b8b 0%, #0d9488 100%)' : isDone ? '#ecfdf5' : '#ffffff',
                color: isActive ? '#ffffff' : '#0f172a',
                border: isActive ? '2px solid #008b8b' : isDone ? '1.5px solid #a7f3d0' : '1.5px solid #e2efee',
                borderRadius: '20px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: isActive ? '0 12px 28px rgba(0, 139, 139, 0.22)' : '0 4px 12px rgba(0,0,0,0.02)',
                transform: isActive ? 'translateY(-3px)' : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '10px',
                  background: isActive ? 'rgba(255, 255, 255, 0.25)' : isDone ? '#10b981' : '#f1f5f9',
                  color: isActive ? '#ffffff' : isDone ? '#ffffff' : '#64748b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.85rem', fontWeight: 800,
                }}>
                  {isDone ? <i className="fa-solid fa-check"></i> : `0${s.id}`}
                </div>

                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background: isActive ? 'rgba(255, 255, 255, 0.2)' : isDone ? '#d1fae5' : '#f1f5f9',
                  color: isActive ? '#ffffff' : isDone ? '#065f46' : '#64748b',
                }}>
                  {isActive ? 'ACTIVE' : isDone ? 'DONE' : `STAGE 0${s.id}`}
                </span>
              </div>

              <div style={{ fontSize: '0.88rem', fontWeight: 800, lineHeight: 1.3 }}>
                {s.shortTitle}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Main Interactive Lifeline Cockpit Stage (Light Clean Bento Grid) ── */}
      <div style={{
        background: '#ffffff',
        border: '2px solid #d8ece9',
        borderRadius: '28px',
        padding: '36px',
        boxShadow: '0 20px 60px rgba(0, 139, 139, 0.08)',
        display: 'grid',
        gridTemplateColumns: '1.1fr 0.9fr',
        gap: '36px',
        alignItems: 'stretch',
      }}>

        {/* Left Column: Interactive Action Console & Diagnostic Parameter Tiles */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            {/* Top Stage Badges */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px' }}>
              <span className="badge" style={{ background: '#e6f7f6', color: '#008b8b', fontWeight: 800, padding: '5px 14px', borderRadius: '9999px', fontSize: '0.78rem' }}>
                {current.badge}
              </span>
              <span className="badge" style={{ background: '#ecfdf5', color: '#047857', fontWeight: 700, padding: '5px 14px', borderRadius: '9999px', fontSize: '0.78rem' }}>
                <span className="pulse-dot" style={{ width: '6px', height: '6px', marginRight: '6px' }}></span>
                Zero-Stockout Lifeline
              </span>
            </div>

            <h3 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px', lineHeight: 1.25 }}>
              {current.title}
            </h3>
            <div style={{ fontSize: '1.02rem', fontWeight: 700, color: '#008b8b', marginBottom: '16px' }}>
              {current.subtitle}
            </div>

            <p style={{ fontSize: '0.94rem', color: '#475569', lineHeight: 1.75, marginBottom: '22px' }}>
              {current.desc}
            </p>

            {/* Interactive Tactile Trigger Action Button */}
            <div style={{ marginBottom: '24px' }}>
              <button
                onClick={handleTriggerAction}
                style={{
                  width: '100%',
                  background: interactiveActionTriggered ? '#10b981' : 'linear-gradient(135deg, #008b8b 0%, #0d9488 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '14px 20px',
                  borderRadius: '16px',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(0, 139, 139, 0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  transition: 'all 0.2s ease',
                  transform: interactiveActionTriggered ? 'scale(0.99)' : 'none',
                }}
              >
                <span>{current.actionText}</span>
                <i className="fa-solid fa-arrow-right"></i>
              </button>

              {actionFeedback && (
                <div style={{
                  marginTop: '10px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: '#ecfdf5',
                  border: '1.5px solid #a7f3d0',
                  color: '#047857',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  animation: 'fadeIn 0.3s ease',
                }}>
                  {actionFeedback}
                </div>
              )}
            </div>

            {/* 4 Telemetry Parameter Metric Tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {current.tiles.map((t, i) => (
                <div
                  key={i}
                  style={{
                    background: '#f8fafb',
                    border: '1.5px solid #e2efee',
                    borderRadius: '16px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    <i className={`fa-solid ${t.icon}`} style={{ color: t.color }}></i>
                    <span>{t.label}</span>
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: t.color }}>
                    {t.val}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Navigation Bar */}
          <div style={{
            marginTop: '24px',
            paddingTop: '18px',
            borderTop: '1.5px solid #e2efee',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
              Stage <strong>{activeStep + 1}</strong> of <strong>{steps.length}</strong>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => { setActiveStep((activeStep - 1 + steps.length) % steps.length); setActionFeedback(''); }}
                style={{
                  background: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: '#0f172a',
                }}
              >
                <i className="fa-solid fa-chevron-left" style={{ marginRight: '6px' }}></i> Prev
              </button>
              <button
                onClick={() => { setActiveStep((activeStep + 1) % steps.length); setActionFeedback(''); }}
                style={{
                  background: '#008b8b',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: '#ffffff',
                }}
              >
                {activeStep === steps.length - 1 ? 'Restart Flow' : 'Next Stage'} <i className="fa-solid fa-chevron-right" style={{ marginLeft: '6px' }}></i>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Creative Light Interactive Visualizer Widget */}
        <div style={{
          background: 'linear-gradient(145deg, #f0fdfa 0%, #e6f7f6 100%)',
          border: '2px solid #cceee9',
          borderRadius: '24px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
        }}>

          {/* STAGE 1 VISUALIZER: Live Stock Curve & Sensor Stream */}
          {activeStep === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="pulse-dot" style={{ background: '#008b8b' }}></span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#008b8b', fontFamily: 'var(--font-mono)' }}>
                      LIVE DECAY WAVEFORM
                    </span>
                  </div>
                  <span className="badge badge-teal" style={{ fontSize: '0.7rem' }}>Node H01 Telemetry</span>
                </div>

                <div style={{ background: '#ffffff', border: '1.5px solid #d8ece9', borderRadius: '18px', padding: '16px', marginBottom: '14px', boxShadow: '0 4px 14px rgba(0, 139, 139, 0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', marginBottom: '8px', color: '#475569' }}>
                    <span>Paracetamol 500mg Stock Curve</span>
                    <span style={{ color: '#dc2626', fontWeight: 800 }}>Zero-Stock: 18:30 (4.5h)</span>
                  </div>

                  <svg width="100%" height="110" viewBox="0 0 360 110">
                    <line x1="0" y1="35" x2="360" y2="35" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.6" />
                    <text x="5" y="30" fill="#d97706" fontSize="9" fontWeight="700" fontFamily="var(--font-mono)">Threshold: 2.0 kg</text>
                    <line x1="0" y1="95" x2="360" y2="95" stroke="#dc2626" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.6" />
                    <text x="5" y="90" fill="#dc2626" fontSize="9" fontWeight="700" fontFamily="var(--font-mono)">Zero Line: 0.0 kg</text>
                    <path d="M 10 15 Q 120 40, 200 68 T 340 95" fill="none" stroke="#008b8b" strokeWidth="4" strokeLinecap="round" />
                    <circle cx="200" cy="68" r="6" fill="#008b8b" stroke="#ffffff" strokeWidth="2" />
                    <text x="215" y="65" fill="#008b8b" fontSize="10" fontWeight="800" fontFamily="var(--font-mono)">NOW: 1.00 kg</text>
                    <circle cx="340" cy="95" r="5" fill="#dc2626" />
                    <text x="260" y="108" fill="#dc2626" fontSize="9" fontWeight="800" fontFamily="var(--font-mono)">0.00 kg (Critical)</text>
                  </svg>
                </div>

                <div style={{ background: '#ffffff', borderRadius: '14px', padding: '14px', border: '1.5px solid #e2efee', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', lineHeight: 1.6 }}>
                  <div style={{ color: '#047857', fontWeight: 700 }}>✓ [14:00:02] HX711 Load Cell reading: 1.002 kg</div>
                  <div style={{ color: '#008b8b', fontWeight: 700 }}>⚡ [14:00:04] ML Engine: Burn rate -0.22 kg/hr</div>
                  <div style={{ color: '#d97706', fontWeight: 700 }}>⚠ [14:00:05] Auto-Alert: REQ-1001 generated for Donor H02</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', fontSize: '0.78rem', color: '#64748b' }}>
                <span>Forecast Window: <strong>5.0h</strong></span>
                <span style={{ color: '#047857', fontWeight: 800 }}>Accuracy: 99.4%</span>
              </div>
            </div>
          )}

          {/* STAGE 2 VISUALIZER: Nash Equilibrium Matching */}
          {activeStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-satellite-dish" style={{ color: '#008b8b' }}></i>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#008b8b', fontFamily: 'var(--font-mono)' }}>
                      DONOR MATCHING MATRIX
                    </span>
                  </div>
                  <span className="badge badge-teal" style={{ fontSize: '0.7rem' }}>Ranked & Selected</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ background: '#ffffff', border: '2px solid #008b8b', borderRadius: '16px', padding: '14px', boxShadow: '0 4px 14px rgba(0, 139, 139, 0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ color: '#0f172a', fontSize: '0.92rem' }}>1. Bangalore BMC (H02)</strong>
                      <span style={{ background: '#10b981', color: '#ffffff', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px' }}>OPTIMAL MATCH</span>
                    </div>
                    <div style={{ display: 'flex', gap: '14px', fontSize: '0.74rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                      <span>Karma: <strong style={{ color: '#008b8b' }}>78/100</strong></span>
                      <span>Surplus: <strong style={{ color: '#10b981' }}>14.5 kg</strong></span>
                      <span>Distance: <strong>140 km</strong></span>
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', border: '1px solid #e2efee', borderRadius: '14px', padding: '12px 14px', opacity: 0.85 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 700, color: '#475569' }}>
                      <span>2. Mandya Node H03</span>
                      <span style={{ color: '#d97706', fontSize: '0.68rem' }}>Low Surplus (0.4kg)</span>
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', border: '1px solid #e2efee', borderRadius: '14px', padding: '12px 14px', opacity: 0.75 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 700, color: '#64748b' }}>
                      <span>3. Hassan Node H04</span>
                      <span style={{ color: '#94a3b8', fontSize: '0.68rem' }}>Standby</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: '#ffffff', borderRadius: '12px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#64748b', border: '1px solid #e2efee' }}>
                <span>Nash Optimization Score: <strong style={{ color: '#0f172a' }}>0.942</strong></span>
                <span style={{ color: '#008b8b', fontWeight: 800 }}>Auto-Dispatched</span>
              </div>
            </div>
          )}

          {/* STAGE 3 VISUALIZER: Clinical 1-Click Seal */}
          {activeStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-signature" style={{ color: '#10b981' }}></i>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#047857', fontFamily: 'var(--font-mono)' }}>
                      ENCRYPTED DISPATCH SEAL
                    </span>
                  </div>
                  <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>✓ Authorized</span>
                </div>

                <div style={{ background: '#ffffff', border: '1.5px solid #d8ece9', borderRadius: '18px', padding: '16px', marginBottom: '14px', boxShadow: '0 4px 14px rgba(0, 139, 139, 0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Supervisor</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Dr. Sarah Chen, MD</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Protocol ID</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#008b8b', fontFamily: 'var(--font-mono)' }}>REQ-1001</div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.76rem', color: '#475569', fontFamily: 'var(--font-mono)', lineHeight: 1.8 }}>
                    <div>Item: <strong>Paracetamol 500mg (1.00 kg)</strong></div>
                    <div>Route: <strong>Bangalore H02 ➔ Mysore H01</strong></div>
                    <div style={{ color: '#94a3b8', fontSize: '0.68rem', marginTop: '4px', background: '#f8fafc', padding: '4px 6px', borderRadius: '6px' }}>
                      SHA-256: <code style={{ color: '#008b8b' }}>e8f92a10b48c901e8271a009d18f43b2</code>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#ecfdf5', border: '1.5px solid #a7f3d0', borderRadius: '14px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#10b981', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>
                    <i className="fa-solid fa-check-double"></i>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#065f46' }}>1-Click Approval Signed</div>
                    <div style={{ fontSize: '0.7rem', color: '#047857' }}>Dispatched to Bangalore H02 Pharmacist Station</div>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.72rem', color: '#64748b', textAlign: 'center', fontFamily: 'var(--font-mono)', marginTop: '10px' }}>
                Signature Timestamp: 14:01:12 UTC+5:30
              </div>
            </div>
          )}

          {/* STAGE 4 VISUALIZER: Physical Dual-Lock Station */}
          {activeStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
              <div style={{ borderRadius: '18px', overflow: 'hidden', border: '2px solid #cceee9', position: 'relative', height: '240px' }}>
                <img src="/flow-step-barcode.png" alt="Dual-Lock Scanner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,23,42,0.05) 0%, rgba(15,23,42,0.8) 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '14px', color: '#ffffff' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#38bdf8' }}>HARDWARE DUAL-LOCK VERIFIED</div>
                  <div style={{ fontSize: '0.72rem', color: '#e2e8f0' }}>Handheld Laser Barcode + RC522 RFID Tag Match</div>
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1.5px solid #d8ece9', borderRadius: '14px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', marginTop: '12px' }}>
                <span style={{ color: '#475569', fontWeight: 600 }}>ESP32 Vault Solenoid:</span>
                <span style={{ color: '#047857', fontWeight: 800, background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '3px 10px', borderRadius: '6px' }}>
                  <i className="fa-solid fa-lock-open" style={{ marginRight: '4px' }}></i> DISENGAGED (OPEN)
                </span>
              </div>
            </div>
          )}

          {/* STAGE 5 VISUALIZER: GPS Transit & Karma */}
          {activeStep === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-truck-fast" style={{ color: '#008b8b' }}></i>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#008b8b', fontFamily: 'var(--font-mono)' }}>
                      LIVE TRANSIT & REPUTATION
                    </span>
                  </div>
                  <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Replenished</span>
                </div>

                <div style={{ background: '#ffffff', border: '1.5px solid #d8ece9', borderRadius: '18px', padding: '16px', marginBottom: '14px', boxShadow: '0 4px 14px rgba(0, 139, 139, 0.06)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>
                    Route: Bangalore (H02) ➔ Mysore (H01)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
                    <span>Node H02</span>
                    <div style={{ flex: 1, height: '3px', background: 'linear-gradient(90deg, #008b8b, #10b981)', margin: '0 12px', position: 'relative' }}>
                      <i className="fa-solid fa-truck-fast" style={{ position: 'absolute', top: '-8px', right: '40%', color: '#008b8b', fontSize: '0.9rem' }}></i>
                    </div>
                    <span>Node H01</span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                    Vehicle: <strong>MED-EXPRESS-04</strong> • Speed: 68 km/h
                  </div>
                </div>

                <div style={{ background: '#ecfdf5', border: '1.5px solid #a7f3d0', borderRadius: '16px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#047857', textTransform: 'uppercase', fontWeight: 800 }}>Karma Reward Settled</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#065f46' }}>Donor Bangalore H02</div>
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#047857', fontFamily: 'var(--font-mono)' }}>
                    +15 PTS
                  </div>
                </div>
              </div>

              <div style={{ background: '#ffffff', borderRadius: '12px', padding: '10px 14px', textAlign: 'center', fontSize: '0.76rem', color: '#047857', fontWeight: 800, border: '1.5px solid #a7f3d0', marginTop: '10px' }}>
                <i className="fa-solid fa-circle-check" style={{ marginRight: '6px' }}></i> ZERO STOCKOUT AVERTED · AUDIT LOGGED
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
