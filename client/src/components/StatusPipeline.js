"use client";
import React from 'react';

const STEPS = ['PENDING_SOURCE', 'ACCEPTED', 'VERIFIED', 'DISPATCHED'];
const LABELS = ['Pending', 'Accepted', 'Verified', 'Dispatched'];

export default function StatusPipeline({ status }) {
  const currentIdx = STEPS.indexOf(status);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {STEPS.map((step, i) => {
        const done = i <= currentIdx;
        return (
          <React.Fragment key={step}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: done ? '#0d9488' : '#e2e8f0',
                color: done ? '#fff' : '#94a3b8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.65rem', fontWeight: 700,
              }}>
                {done ? <i className="fa-solid fa-check" style={{ fontSize: '0.6rem' }}></i> : i + 1}
              </div>
              <span style={{ fontSize: '0.6rem', fontWeight: 600, color: done ? '#0d9488' : '#94a3b8' }}>{LABELS[i]}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ width: '20px', height: '2px', background: i < currentIdx ? '#0d9488' : '#e2e8f0', borderRadius: '2px', marginBottom: '14px' }}></div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
