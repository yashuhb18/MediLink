"use client";
import React, { useEffect, useRef, useState } from 'react';

// Real GPS Coordinates for Hospitals in Karnataka & South India
const HOSPITAL_GEO = {
  H01: { name: 'Apollo Hospital (Mysore)', lat: 12.2958, lng: 76.6394, city: 'Mysuru, Karnataka' },
  H02: { name: 'Bangalore Medical Center (BMC)', lat: 12.9716, lng: 77.5946, city: 'Bengaluru, Karnataka' },
  H03: { name: 'Mangalore General Hospital', lat: 12.9141, lng: 74.8560, city: 'Mangaluru, Karnataka' },
  H04: { name: 'Hubli Central Hospital', lat: 15.3647, lng: 75.1240, city: 'Hubballi, Karnataka' },
  CENTRAL_DC: { name: 'Central DC Pharma Hub', lat: 13.0827, lng: 80.2707, city: 'Chennai / South DC' }
};

export default function ProximityIndiaMap({
  availableNodes = [],
  selectedSourceNode = null,
  onSelectNode = () => {},
  requestingHospitalId = 'H01',
  medicineName = 'Medicine'
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerGroupRef = useRef(null);
  const [viewMode, setViewMode] = useState('map'); // 'map' | 'list'

  // Initialize and maintain the Leaflet map
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

    const renderMap = () => {
      if (!isMounted || !mapContainerRef.current || !window.L) return;
      const L = window.L;

      // Clean up previous map instance
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // 1. Create Leaflet Map centered on Karnataka / South India
      const map = L.map(mapContainerRef.current, {
        center: [12.95, 76.5],
        zoom: 7,
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: false
      });
      mapInstanceRef.current = map;

      // 2. OpenStreetMap High-Res Tiles
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        minZoom: 5,
      }).addTo(map);

      // 3. Layer Group for dynamic hospital nodes & routes
      const group = L.layerGroup().addTo(map);
      markerGroupRef.current = group;

      // Draw all current hospital nodes & routes
      updateMarkers(map, group, L);

      // Guarantee tile layout calculation
      setTimeout(() => { if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize(); }, 150);
      setTimeout(() => { if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize(); }, 450);
    };

    const updateMarkers = (map, group, L) => {
      if (!map || !group || !L) return;
      group.clearLayers();

      const reqGeo = HOSPITAL_GEO[requestingHospitalId] || HOSPITAL_GEO.H01;
      const bounds = L.latLngBounds();

      const defaultDonorPool = {
        H01: [
          { hospitalId: 'H02', hospitalName: 'Bangalore Medical Center (BMC)', distanceKm: 140, etaText: '2.5 hrs (140 km)', packageCount: 96, dosageUnit: 'Strips', karmaScore: 78, isOptimalNearest: true },
          { hospitalId: 'H03', hospitalName: 'Mangalore General Hospital', distanceKm: 250, etaText: '4.5 hrs (250 km)', packageCount: 44, dosageUnit: 'Strips', karmaScore: 65, isOptimalNearest: false }
        ],
        H02: [
          { hospitalId: 'H01', hospitalName: 'Apollo Hospital (Mysore)', distanceKm: 140, etaText: '2.5 hrs (140 km)', packageCount: 96, dosageUnit: 'Strips', karmaScore: 85, isOptimalNearest: true },
          { hospitalId: 'H03', hospitalName: 'Mangalore General Hospital', distanceKm: 350, etaText: '6.0 hrs (350 km)', packageCount: 44, dosageUnit: 'Strips', karmaScore: 65, isOptimalNearest: false }
        ],
        H03: [
          { hospitalId: 'H01', hospitalName: 'Apollo Hospital (Mysore)', distanceKm: 250, etaText: '4.5 hrs (250 km)', packageCount: 96, dosageUnit: 'Strips', karmaScore: 85, isOptimalNearest: true },
          { hospitalId: 'H02', hospitalName: 'Bangalore Medical Center (BMC)', distanceKm: 350, etaText: '6.0 hrs (350 km)', packageCount: 44, dosageUnit: 'Strips', karmaScore: 78, isOptimalNearest: false }
        ]
      };

      const displayNodes = (availableNodes && availableNodes.length > 0)
        ? availableNodes.filter(n => n.hospitalId !== requestingHospitalId)
        : (defaultDonorPool[requestingHospitalId] || defaultDonorPool.H01);

      // 1. Requester Hospital Pin (Dynamic location based on active hospital)
      const reqIcon = L.divIcon({
        className: 'custom-req-pin',
        html: `
          <div style="text-align: center; transform: translate(-50%, -50%); cursor: pointer;">
            <div style="
              width: 36px; height: 36px; border-radius: 50%;
              background: #0f172a; border: 2.5px solid #38bdf8;
              box-shadow: 0 0 16px rgba(56, 189, 248, 0.95);
              display: flex; align-items: center; justify-content: center;
              color: #38bdf8; font-size: 14px;
            ">
              <i class="fa-solid fa-hospital"></i>
            </div>
            <div style="
              background: #0f172a; color: #ffffff;
              padding: 3px 8px; border-radius: 6px; font-size: 9.5px; font-weight: 800;
              white-space: nowrap; margin-top: 3px; border: 1.5px solid #38bdf8;
              box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            ">
              🏥 ${requestingHospitalId} (You - ${reqGeo.city ? reqGeo.city.split(',')[0] : 'Local Node'})
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const reqMarker = L.marker([reqGeo.lat, reqGeo.lng], { icon: reqIcon }).addTo(group);
      reqMarker.bindPopup(`<strong>${reqGeo.name}</strong><br/>Your Active Facility (${requestingHospitalId})`);
      bounds.extend([reqGeo.lat, reqGeo.lng]);

      // 2. Plot Peer Donor Hospital Nodes
      displayNodes.forEach((node, idx) => {
        const geo = HOSPITAL_GEO[node.hospitalId] || { lat: reqGeo.lat + 0.5, lng: reqGeo.lng + 0.5 };
        const isSelected = selectedSourceNode ? (selectedSourceNode.hospitalId === node.hospitalId) : (idx === 0);
        const isNearest = node.isOptimalNearest || idx === 0;

        const pinBg = isSelected ? '#008b8b' : isNearest ? '#059669' : '#d97706';

        const donorIcon = L.divIcon({
          className: `custom-donor-pin-${node.hospitalId}`,
          html: `
            <div style="text-align: center; transform: translate(-50%, -50%); cursor: pointer;">
              <div style="
                width: 36px; height: 36px; border-radius: 50%;
                background: ${pinBg}; border: 2.5px solid #ffffff;
                box-shadow: ${isSelected ? '0 0 18px rgba(0, 139, 139, 0.95)' : '0 3px 10px rgba(0,0,0,0.3)'};
                display: flex; align-items: center; justify-content: center;
                color: #ffffff; font-size: 14px; font-weight: 800;
              ">
                <i class="fa-solid fa-truck-medical"></i>
              </div>
              <div style="
                background: #ffffff; color: #0f172a;
                padding: 3px 8px; border-radius: 6px; font-size: 9.5px; font-weight: 900;
                white-space: nowrap; margin-top: 3px; border: 1.5px solid ${pinBg};
                box-shadow: 0 3px 10px rgba(0,0,0,0.25);
              ">
                ${isNearest ? '<span style="color: #059669; font-size: 8px; display: block; font-weight: 800;">🟢 NEAREST</span>' : ''}
                <strong>${node.hospitalId}</strong> · <span style="color: #008b8b;">${node.packageCount} ${node.dosageUnit}</span>
                <div style="font-size: 8px; color: #64748b; font-weight: 600;">${node.distanceKm} km · ${node.etaText?.split(' ')[0] || '2.5'}h</div>
              </div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });

        const donorMarker = L.marker([geo.lat, geo.lng], { icon: donorIcon }).addTo(group);
        donorMarker.on('click', () => {
          onSelectNode(node);
        });

        bounds.extend([geo.lat, geo.lng]);
      });

      // 3. Draw Highway Polyline Corridor to Selected Donor
      const activeDonor = selectedSourceNode || displayNodes[0];
      if (activeDonor) {
        const srcGeo = HOSPITAL_GEO[activeDonor.hospitalId] || HOSPITAL_GEO.H01;
        L.polyline([
          [reqGeo.lat, reqGeo.lng],
          [srcGeo.lat, srcGeo.lng]
        ], {
          color: '#008b8b',
          weight: 4.5,
          dashArray: '8, 8',
          opacity: 0.95
        }).addTo(group);
      }

      // Auto-fit bounds
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 });
      }
    };

    // Load Leaflet JS
    if (!window.L) {
      if (!document.getElementById('leaflet-script')) {
        const script = document.createElement('script');
        script.id = 'leaflet-script';
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.async = true;
        script.onload = () => {
          if (isMounted) renderMap();
        };
        document.body.appendChild(script);
      }
    } else {
      renderMap();
    }

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [availableNodes, selectedSourceNode, requestingHospitalId, viewMode]);

  const defaultDonorPool = {
    H01: [
      { hospitalId: 'H02', hospitalName: 'Bangalore Medical Center (BMC)', distanceKm: 140, etaText: '2.5 hrs (140 km)', packageCount: 96, dosageUnit: 'Strips', karmaScore: 78, isOptimalNearest: true },
      { hospitalId: 'H03', hospitalName: 'Mangalore General Hospital', distanceKm: 250, etaText: '4.5 hrs (250 km)', packageCount: 44, dosageUnit: 'Strips', karmaScore: 65, isOptimalNearest: false }
    ],
    H02: [
      { hospitalId: 'H01', hospitalName: 'Apollo Hospital (Mysore)', distanceKm: 140, etaText: '2.5 hrs (140 km)', packageCount: 96, dosageUnit: 'Strips', karmaScore: 85, isOptimalNearest: true },
      { hospitalId: 'H03', hospitalName: 'Mangalore General Hospital', distanceKm: 350, etaText: '6.0 hrs (350 km)', packageCount: 44, dosageUnit: 'Strips', karmaScore: 65, isOptimalNearest: false }
    ],
    H03: [
      { hospitalId: 'H01', hospitalName: 'Apollo Hospital (Mysore)', distanceKm: 250, etaText: '4.5 hrs (250 km)', packageCount: 96, dosageUnit: 'Strips', karmaScore: 85, isOptimalNearest: true },
      { hospitalId: 'H02', hospitalName: 'Bangalore Medical Center (BMC)', distanceKm: 350, etaText: '6.0 hrs (350 km)', packageCount: 44, dosageUnit: 'Strips', karmaScore: 78, isOptimalNearest: false }
    ]
  };

  const activeNodesList = (availableNodes && availableNodes.length > 0)
    ? availableNodes.filter(n => n.hospitalId !== requestingHospitalId)
    : (defaultDonorPool[requestingHospitalId] || defaultDonorPool.H01);

  const activeDisplayNode = selectedSourceNode || activeNodesList[0];

  return (
    <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-map-location-dot" style={{ color: '#008b8b' }}></i>
              Regional GIS Map
            </h3>
            <span style={{ fontSize: '0.72rem', background: '#e6f7f6', color: '#008b8b', padding: '2px 8px', borderRadius: '999px', fontWeight: 800 }}>
              {activeNodesList.length} Nodes Found
            </span>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '3px 0 0 0' }}>
            Live GPS telemetry for <strong>{medicineName}</strong> relative to <strong>{requestingHospitalId}</strong>.
          </p>
        </div>

        {/* View Switcher */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '2px' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{
              padding: '4px 10px',
              fontSize: '0.75rem',
              fontWeight: 800,
              background: viewMode === 'map' ? '#ffffff' : 'transparent',
              color: viewMode === 'map' ? '#008b8b' : '#64748b',
              boxShadow: viewMode === 'map' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              borderRadius: '6px'
            }}
            onClick={() => setViewMode('map')}
          >
            <i className="fa-solid fa-map"></i> Live Map
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{
              padding: '4px 10px',
              fontSize: '0.75rem',
              fontWeight: 800,
              background: viewMode === 'list' ? '#ffffff' : 'transparent',
              color: viewMode === 'list' ? '#008b8b' : '#64748b',
              boxShadow: viewMode === 'list' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              borderRadius: '6px'
            }}
            onClick={() => setViewMode('list')}
          >
            <i className="fa-solid fa-list"></i> Node Cards
          </button>
        </div>
      </div>

      {/* Map / List Viewport with fixed 390px height */}
      <div style={{ width: '100%', height: '390px', position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1.5px solid #cbd5e1' }}>
        {viewMode === 'map' ? (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* The Actual Leaflet Map Canvas */}
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />

            {/* Floating Sleek Legend Overlay */}
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              zIndex: 1000,
              background: 'rgba(15, 23, 42, 0.88)',
              backdropFilter: 'blur(6px)',
              padding: '6px 10px',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '0.62rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              border: '1px solid rgba(255,255,255,0.12)',
              pointerEvents: 'none'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8' }}></span>
                <span><strong>{requestingHospitalId} (You)</strong>: Requester Node</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                <span><strong>{activeNodesList.map(n => n.hospitalId).join('/')}</strong>: Donor Nodes (Click)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '2.5px', background: '#008b8b' }}></span>
                <span><strong>Route</strong>: Highway Transit Arc</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '14px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '10px', background: '#ffffff' }}>
            {activeNodesList.map((node, idx) => {
              const isSelected = activeDisplayNode?.hospitalId === node.hospitalId;
              const isNearest = idx === 0;

              return (
                <div
                  key={node.hospitalId}
                  onClick={() => onSelectNode(node)}
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid #008b8b' : '1px solid #e2e8f0',
                    background: isSelected ? '#f0fdfa' : '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '0.94rem', color: '#0f172a' }}>{node.hospitalName}</strong>
                      <span style={{ fontSize: '0.7rem', background: '#0f172a', color: '#ffffff', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>{node.hospitalId}</span>
                    </div>
                    {isNearest && <span style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 800 }}>🟢 NEAREST</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {node.distanceKm} km · {node.etaText} · <strong style={{ color: '#008b8b' }}>{node.packageCount} {node.dosageUnit}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Node Summary Banner */}
      {activeDisplayNode && (
        <div style={{
          marginTop: '12px',
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #f0fdfa 0%, #e6f7f6 100%)',
          borderRadius: '12px',
          border: '1.5px solid #99f6e4',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#008b8b', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <i className="fa-solid fa-circle-check"></i> Selected Primary Source Node
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
              {activeDisplayNode.hospitalName} <span style={{ fontSize: '0.78rem', color: '#64748b' }}>({activeDisplayNode.hospitalId})</span>
            </div>
            <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '2px' }}>
              Distance: <strong>{activeDisplayNode.distanceKm} km</strong> · Transit ETA: <strong>{activeDisplayNode.etaText}</strong> · Karma: <strong>{activeDisplayNode.karmaScore || 78} pts</strong>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#008b8b', fontFamily: 'var(--font-mono)' }}>
              {activeDisplayNode.packageCount} {activeDisplayNode.dosageUnit}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 800 }}>
              Available in Surplus
            </div>
          </div>
        </div>
      )}

      {/* Available Node Quick Selector Chips */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
        {activeNodesList.map(node => (
          <button
            key={node.hospitalId}
            type="button"
            onClick={() => onSelectNode(node)}
            style={{
              background: activeDisplayNode?.hospitalId === node.hospitalId ? '#008b8b' : '#ffffff',
              color: activeDisplayNode?.hospitalId === node.hospitalId ? '#ffffff' : '#0f172a',
              border: '1px solid #cbd5e1',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 800,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <span>🏥 {node.hospitalId}</span>
            <span style={{ opacity: 0.85, fontSize: '0.7rem' }}>({node.distanceKm} km · {node.packageCount} {node.dosageUnit})</span>
          </button>
        ))}
      </div>
    </div>
  );
}
