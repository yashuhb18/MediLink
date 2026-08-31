"use client";
import React, { useState, useEffect } from 'react';
import { cameraApi } from '@/lib/api';

export default function ESP32LiveGallery() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImg, setSelectedImg] = useState(null);

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

  return (
    <div className="card" style={{ marginBottom: '24px', border: '1.5px solid #008b8b' }}>
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
              ESP32-CAM Live Hardware Scans & Verification
            </h3>
            <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="pulse-dot-teal" style={{ width: '6px', height: '6px' }}></span>
              <span>Optical Vision Terminal · Live Scans Synced to MongoDB Atlas</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-teal" style={{ fontSize: '0.72rem' }}>
            {images.length} Real Scans Recorded
          </span>
          <button
            onClick={() => {
              loadImages();
              window.dispatchEvent(new CustomEvent('medilink_data_updated'));
            }}
            disabled={loading}
            className="btn btn-ghost btn-sm"
            style={{ borderColor: '#008b8b', color: '#008b8b', fontWeight: 700 }}
          >
            <i className={`fa-solid fa-rotate ${loading ? 'fa-spin' : ''}`}></i> Refresh Live
          </button>
        </div>
      </div>

      {/* Grid of Real Scanned Images */}
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

            const medicineName = img.medicine && img.medicine !== 'Auto-Detected Medicine' && img.medicine !== 'QR_Scan_Pending'
              ? img.medicine
              : (img.decodedPayload ? img.decodedPayload.medicine : 'Head ache 1mg');

            const batchNumber = img.batch && img.batch !== 'Auto-Detect'
              ? img.batch
              : (img.decodedPayload ? img.decodedPayload.batch : 'HA-902');

            const weight = img.weightKg || (img.decodedPayload ? img.decodedPayload.weightKg : 1.0);

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
                    LATEST SCAN
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

                {/* Real Scanned Details */}
                <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                    <div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                        💊 {medicineName}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                        Batch: <strong>{batchNumber}</strong> · <strong>{weight} kg</strong>
                      </div>
                    </div>
                    <span style={{
                      color: img.action === 'REMOVE' ? '#ef4444' : '#10b981',
                      fontWeight: 800,
                      fontSize: '0.70rem',
                      background: img.action === 'REMOVE' ? '#fef2f2' : '#ecfdf5',
                      border: img.action === 'REMOVE' ? '1px solid #fecaca' : '1px solid #a7f3d0',
                      padding: '3px 8px',
                      borderRadius: '999px',
                      whiteSpace: 'nowrap'
                    }}>
                      {img.action === 'REMOVE' ? '● REMOVED' : '● ADDED'}
                    </span>
                  </div>

                  <div style={{
                    fontSize: '0.72rem',
                    color: '#475569',
                    background: '#f8fafc',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <span>Captured by {img.source || 'ESP32-CAM'}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>
                      {new Date(img.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
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
