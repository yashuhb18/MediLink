"use client";
import React, { useEffect, useRef, useState } from 'react';

export default function RegionalLiveMap() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [selectedHospital, setSelectedHospital] = useState(null);

  // Real hospital nodes in Karnataka, India
  const hospitalNodes = [
    {
      id: 'H02',
      name: 'Bangalore Medical Center (BMC)',
      address: 'Victoria Hospital Campus, Fort Road, Bengaluru, Karnataka 560002',
      city: 'Bengaluru, Karnataka',
      role: 'Primary Regional Donor Hub',
      lat: 12.9716,
      lng: 77.5946,
      karma: 78,
      stock: '14.5 kg Surplus',
      status: 'Healthy',
      color: '#0d9488'
    },
    {
      id: 'H01',
      name: 'Mysore District Hospital',
      address: 'Sayyaji Rao Road, Mandi Mohalla, Mysuru, Karnataka 570001',
      city: 'Mysuru, Karnataka',
      role: 'Critical Care ICU Center',
      lat: 12.2958,
      lng: 76.6394,
      karma: 62,
      stock: 'Depletion Alert on LC01',
      status: 'Critical',
      color: '#dc2626'
    },
    {
      id: 'H03',
      name: 'Mangalore Coastal General Hospital',
      address: 'Hampankatta, Mangaluru, Karnataka 575001',
      city: 'Mangaluru, Karnataka',
      role: 'Coastal Regional Node',
      lat: 12.9141,
      lng: 74.8560,
      karma: 45,
      stock: 'Stable Reserves',
      status: 'Moderate',
      color: '#d97706'
    },
    {
      id: 'H04',
      name: 'Hubli Central Hospital',
      address: 'PB Road, Vidya Nagar, Hubballi, Karnataka 580021',
      city: 'Hubballi, Karnataka',
      role: 'North Karnataka Node',
      lat: 15.3647,
      lng: 75.1240,
      karma: 55,
      stock: 'Normal Reserves',
      status: 'Healthy',
      color: '#2563eb'
    }
  ];

  useEffect(() => {
    let isMounted = true;

    // Load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const initMap = () => {
      if (!window.L || !mapContainerRef.current || mapInstanceRef.current) return;

      const L = window.L;

      // Center on Karnataka, India
      const map = L.map(mapContainerRef.current, {
        center: [13.2, 76.2],
        zoom: 7,
        zoomControl: true,
        scrollWheelZoom: true,
      });
      mapInstanceRef.current = map;

      // Pure OpenStreetMap India Tiles (100% Free, No Watermark, No API Key)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      // Real Hospital Location Markers
      hospitalNodes.forEach(node => {
        const customIcon = L.divIcon({
          className: 'real-hospital-marker',
          html: `
            <div style="text-align: center; transform: translate(-50%, -50%); cursor: pointer;">
              <div style="
                width: 38px; height: 38px; border-radius: 50%;
                background: ${node.color};
                border: 3px solid #ffffff;
                box-shadow: 0 4px 14px rgba(0,0,0,0.35);
                display: flex; align-items: center; justify-content: center;
                color: #ffffff; font-size: 16px; font-weight: bold;
              ">
                <i class="fa-solid fa-hospital"></i>
              </div>
              <div style="
                background: #0f172a; color: #ffffff;
                padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;
                white-space: nowrap; margin-top: 4px; border: 1px solid rgba(255,255,255,0.2);
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              ">
                ${node.name.split(' ')[0]} (${node.id})
              </div>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const marker = L.marker([node.lat, node.lng], { icon: customIcon }).addTo(map);

        marker.on('click', () => {
          setSelectedHospital(node);
          map.flyTo([node.lat, node.lng], 11, { duration: 1.0 });
        });

        const popupContent = `
          <div style="font-family: system-ui, sans-serif; padding: 6px; min-width: 220px;">
            <strong style="color: #0f172a; font-size: 14px;">${node.name}</strong>
            <div style="font-size: 11px; color: #64748b; margin-top: 3px;">${node.address}</div>
            <div style="margin-top: 8px; font-size: 12px; font-weight: 700; color: ${node.color};">
              Status: ${node.status} • Karma: ${node.karma} pts
            </div>
            <div style="font-size: 11px; color: #008b8b; font-weight: 600; margin-top: 4px;">
              Stock: ${node.stock}
            </div>
          </div>
        `;
        marker.bindPopup(popupContent);
      });
    };

    // Load Leaflet script
    if (!window.L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = initMap;
      document.body.appendChild(script);
    } else {
      initMap();
    }

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const resetView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([13.2, 76.2], 7, { duration: 1 });
      setSelectedHospital(null);
    }
  };

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '18px',
      overflow: 'hidden',
      border: '1.5px solid #e2efee',
      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
      position: 'relative',
    }}>
      {/* Real Map Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #e2efee',
        background: '#f8fafb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: '#e6f7f6', color: '#008b8b',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
          }}>
            <i className="fa-solid fa-map-location-dot"></i>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#008b8b', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }}>
              REAL GEOGRAPHIC MAP · KARNATAKA, INDIA
            </div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Live Regional Hospital Network Locations
            </h4>
          </div>
        </div>

        <button
          onClick={resetView}
          style={{
            background: '#ffffff',
            border: '1.5px solid #cbd5e1',
            color: '#0f172a',
            padding: '7px 14px',
            borderRadius: '10px',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          <i className="fa-solid fa-compress"></i>
          <span>Reset Map View</span>
        </button>
      </div>

      {/* Real Map Container */}
      <div style={{ position: 'relative', width: '100%', height: '500px' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />

        {/* Selected Hospital Details Overlay */}
        {selectedHospital && (
          <div style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '320px',
            background: '#ffffff',
            border: '1.5px solid #008b8b',
            borderRadius: '16px',
            padding: '18px',
            boxShadow: '0 12px 30px rgba(0,0,0,0.2)',
            zIndex: 1000,
            color: '#0f172a',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <span className="badge badge-teal" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                  Node {selectedHospital.id}
                </span>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                  {selectedHospital.name}
                </h4>
              </div>
              <button
                onClick={() => setSelectedHospital(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '12px', lineHeight: 1.5 }}>
              <div><i className="fa-solid fa-location-dot" style={{ color: '#008b8b', marginRight: '6px' }}></i> {selectedHospital.address}</div>
              <div style={{ marginTop: '6px' }}>Coordinates: <strong style={{ color: '#0f172a', fontFamily: 'var(--font-mono)' }}>{selectedHospital.lat.toFixed(4)}° N, {selectedHospital.lng.toFixed(4)}° E</strong></div>
              <div>Trust Score: <strong style={{ color: '#10b981' }}>{selectedHospital.karma} Karma Points</strong></div>
              <div>Status: <strong style={{ color: selectedHospital.color }}>{selectedHospital.status}</strong></div>
            </div>

            <button
              onClick={() => setSelectedHospital(null)}
              style={{
                width: '100%',
                background: '#008b8b',
                color: '#ffffff',
                border: 'none',
                padding: '8px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Close Details
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
