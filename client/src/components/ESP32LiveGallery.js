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

    // Listen for live SSE updates
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
              ESP32-CAM Hardware Live Capture Feed
            </h3>
            <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="pulse-dot-teal" style={{ width: '6px', height: '6px' }}></span>
              <span>Optical Vision Terminal Bridge · Real-time Photos Saved in MongoDB Atlas</span>
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
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '14px',
          padding: '4px'
        }}>
          {images.map((img, idx) => {
            const isBase64Jpeg = img.image_data?.startsWith('/9j/') || img.image_data?.startsWith('data:image');
            const imgSrc = img.image_data?.startsWith('data:')
              ? img.image_data
              : `data:image/jpeg;base64,${img.image_data}`;

            return (
              <div
                key={img._id || idx}
                style={{
                  borderRadius: '14px',
                  backgroundColor: '#f8fafc',
                  border: idx === 0 ? '2px solid #008b8b' : '1px solid #e2e8f0',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: idx === 0 ? '0 8px 20px rgba(0, 139, 139, 0.15)' : 'none',
                  position: 'relative'
                }}
              >
                {idx === 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    zIndex: 2,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: '#008b8b',
                    color: '#ffffff',
                    fontSize: '0.65rem',
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
                    height: '140px',
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
                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#1e293b', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{img.source || 'ESP32-CAM'}</span>
                    <span style={{ color: '#10b981', fontWeight: 800 }}>● VERIFIED</span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                    {new Date(img.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {new Date(img.createdAt).toLocaleDateString()}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    ID: {img._id}
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
