"use client";
import React, { useState, useEffect } from 'react';
import { cameraApi } from '@/lib/api';

export default function ESP32LiveGallery() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImg, setSelectedImg] = useState(null);
  const [activeActionId, setActiveActionId] = useState(null);
  const [selectedMed, setSelectedMed] = useState('Paracetamol');
  const [selectedQty, setSelectedQty] = useState('1.0');
  const [executing, setExecuting] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  const loadImages = async () => {
    setLoading(true);
    try {
      const data = await cameraApi.getLatestImages();
      if (Array.isArray(data)) {
        setImages(data);
      }
    } catch (err) {
      console.warn('Failed to load camera images:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImages();
    const handleUpdate = () => loadImages();
    window.addEventListener('medilink_data_updated', handleUpdate);
    return () => window.removeEventListener('medilink_data_updated', handleUpdate);
  }, []);

  const handleExecute = async (actionType, imageId) => {
    setExecuting(true);
    try {
      const res = await cameraApi.executeAction({
        action: actionType,
        medicine: selectedMed,
        weightKg: parseFloat(selectedQty) || 1.0,
        batch: 'BATCH-ESP32',
        hospitalId: 'H01',
        imageId
      });

      if (res.success) {
        setToastMsg(`✅ Success: ${res.result.message}`);
        setActiveActionId(null);
        // Trigger global data refresh
        window.dispatchEvent(new CustomEvent('medilink_data_updated'));
        setTimeout(() => setToastMsg(null), 5000);
      }
    } catch (err) {
      setToastMsg(`⚠️ Action failed: ${err.message}`);
      setTimeout(() => setToastMsg(null), 5000);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: '24px', border: '1.5px solid #008b8b' }}>
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          marginBottom: '16px',
          padding: '12px 18px',
          background: 'linear-gradient(135deg, #008b8b 0%, #006666 100%)',
          color: '#ffffff',
          borderRadius: '12px',
          fontWeight: 700,
          fontSize: '0.88rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 8px 20px rgba(0, 139, 139, 0.3)'
        }}>
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Header */}
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #008b8b 0%, #006666 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem'
          }}>
            <i className="fa-solid fa-camera"></i>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
              ESP32-CAM Hardware Live Capture Feed & Action Console
            </h3>
            <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="pulse-dot-teal" style={{ width: '6px', height: '6px' }}></span>
              <span>Optical Vision Terminal · Select Add / Remove Options on Live Frames</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-teal" style={{ fontSize: '0.72rem' }}>
            {images.length} Captures Stored
          </span>
          <button
            onClick={loadImages}
            disabled={loading}
            className="btn btn-ghost btn-sm"
            style={{ borderColor: '#008b8b', color: '#008b8b', fontWeight: 700 }}
          >
            <i className={`fa-solid fa-rotate ${loading ? 'fa-spin' : ''}`}></i> Refresh Feed
          </button>
        </div>
      </div>

      {/* Grid of Images */}
      {images.length === 0 ? (
        <div className="empty-state" style={{ padding: '30px' }}>
          <i className="fa-solid fa-camera-retro fa-2x" style={{ color: '#94a3b8' }}></i>
          <p style={{ marginTop: '8px', color: '#64748b', fontWeight: 600 }}>No captures found in database.</p>
          <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Have your friend press the ESP32-CAM button to send live frames.</span>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '16px',
          padding: '4px'
        }}>
          {images.map((img, idx) => {
            const isBase64Jpeg = img.image_data?.startsWith('/9j/') || img.image_data?.startsWith('data:image');
            const imgSrc = img.image_data?.startsWith('data:')
              ? img.image_data
              : `data:image/jpeg;base64,${img.image_data}`;

            const isActionOpen = activeActionId === img._id;

            return (
              <div
                key={img._id || idx}
                style={{
                  borderRadius: '16px',
                  backgroundColor: '#ffffff',
                  border: idx === 0 ? '2px solid #008b8b' : '1px solid #e2e8f0',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: idx === 0 ? '0 10px 25px rgba(0, 139, 139, 0.15)' : '0 2px 8px rgba(0,0,0,0.04)',
                  position: 'relative'
                }}
              >
                {idx === 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    zIndex: 2,
                    padding: '3px 10px',
                    borderRadius: '999px',
                    backgroundColor: '#008b8b',
                    color: '#ffffff',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    letterSpacing: '0.04em'
                  }}>
                    LATEST CAPTURE
                  </div>
                )}

                {/* Photo Viewer */}
                <div
                  onClick={() => setSelectedImg(imgSrc)}
                  style={{
                    height: '160px',
                    backgroundColor: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  {isBase64Jpeg ? (
                    <img
                      src={imgSrc}
                      alt="ESP32-CAM Capture"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', textAlign: 'center', padding: '10px' }}>
                      <i className="fa-solid fa-image" style={{ fontSize: '1.5rem', marginBottom: '6px' }}></i>
                      <div>Binary Frame</div>
                    </div>
                  )}
                  <div style={{
                    position: 'absolute',
                    bottom: '6px',
                    right: '6px',
                    padding: '2px 6px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    color: '#ffffff',
                    fontSize: '0.65rem',
                    fontFamily: 'var(--font-mono)'
                  }}>
                    <i className="fa-solid fa-magnifying-glass-plus"></i> View Full
                  </div>
                </div>

                {/* Metadata Details */}
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{img.source || 'ESP32-CAM'}</span>
                    <span style={{ color: '#10b981', fontWeight: 800, fontSize: '0.72rem', background: '#ecfdf5', padding: '2px 8px', borderRadius: '999px' }}>
                      ● RECEIVED
                    </span>
                  </div>

                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                    {new Date(img.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {new Date(img.createdAt).toLocaleDateString()}
                  </div>

                  {/* Quick Action Options Toggle */}
                  <button
                    onClick={() => setActiveActionId(isActionOpen ? null : img._id)}
                    style={{
                      marginTop: '6px',
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #008b8b',
                      background: isActionOpen ? '#e6f7f6' : '#ffffff',
                      color: '#008b8b',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <i className="fa-solid fa-sliders"></i>
                    {isActionOpen ? 'Hide Options' : '⚡ Action Options (Add / Remove)'}
                  </button>

                  {/* Interactive Action Options Console */}
                  {isActionOpen && (
                    <div style={{
                      marginTop: '8px',
                      padding: '12px',
                      backgroundColor: '#f0fdfa',
                      borderRadius: '10px',
                      border: '1px solid #99f6e4',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div>
                        <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#0f766e', display: 'block', marginBottom: '2px' }}>
                          Medicine Item:
                        </label>
                        <select
                          value={selectedMed}
                          onChange={(e) => setSelectedMed(e.target.value)}
                          style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 600 }}
                        >
                          <option value="Paracetamol">Paracetamol 500mg</option>
                          <option value="Amoxicillin 500mg">Amoxicillin 500mg</option>
                          <option value="Insulin Glargine">Insulin Glargine</option>
                          <option value="Azithromycin 250mg">Azithromycin 250mg</option>
                          <option value="Metformin 500mg">Metformin 500mg</option>
                          <option value="Dollo 650mg">Dollo 650mg</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#0f766e', display: 'block', marginBottom: '2px' }}>
                          Quantity (Kg):
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={selectedQty}
                          onChange={(e) => setSelectedQty(e.target.value)}
                          style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 700 }}
                        />
                      </div>

                      {/* 1-Click Action Buttons */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '4px' }}>
                        <button
                          onClick={() => handleExecute('ADD', img._id)}
                          disabled={executing}
                          style={{
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#10b981',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.74rem',
                            cursor: 'pointer'
                          }}
                        >
                          ➕ Add Stock
                        </button>
                        <button
                          onClick={() => handleExecute('REMOVE', img._id)}
                          disabled={executing}
                          style={{
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.74rem',
                            cursor: 'pointer'
                          }}
                        >
                          ➖ Remove Stock
                        </button>
                      </div>

                      <button
                        onClick={() => handleExecute('TRANSFER_DISPATCH', img._id)}
                        disabled={executing}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: '#008b8b',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.74rem',
                          cursor: 'pointer'
                        }}
                      >
                        📦 Dispatch Active Requisition
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal to view full size photo */}
      {selectedImg && (
        <div
          onClick={() => setSelectedImg(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            padding: '20px'
          }}
        >
          <div style={{ maxWidth: '800px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img
              src={selectedImg}
              alt="ESP32-CAM High Resolution View"
              style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '16px', border: '2px solid #008b8b' }}
            />
            <button
              onClick={() => setSelectedImg(null)}
              className="btn btn-primary"
              style={{ marginTop: '16px' }}
            >
              Close Full View
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
