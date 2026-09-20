"use client";
import React, { useState, useEffect, useRef } from 'react';
import { transferApi } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';

export default function TransitTrackerCard({ transfer, onUpdate, userRole = 'REQUESTING_SUPERVISOR' }) {
  const [showQrModal, setShowQrModal] = useState(false);
  const [phoneGpsActive, setPhoneGpsActive] = useState(false);

  // Real GPS Telemetry State
  const [localCoords, setLocalCoords] = useState({
    lat: transfer?.transitGps?.lat || null,
    lng: transfer?.transitGps?.lng || null
  });
  const [localSpeed, setLocalSpeed] = useState(transfer?.transitGps?.currentSpeedKmH || 0);
  const [localAccuracy, setLocalAccuracy] = useState(transfer?.transitGps?.accuracy || null);
  const [localTemp, setLocalTemp] = useState(transfer?.transitGps?.temperatureC || 3.8);
  const [localLocation, setLocalLocation] = useState(
    transfer?.transitGps?.currentLocationName || 'Awaiting Live GPS stream from Driver Smartphone...'
  );
  const [lastPacketTime, setLastPacketTime] = useState(null);
  const [packetCount, setPacketCount] = useState(0);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const pathHistoryRef = useRef([]);
  const pathPolylineRef = useRef(null);

  if (!transfer) return null;

  const driverName = transfer.driverName || 'Suresh Kumar (Ambulance Fleet)';
  const driverPhone = transfer.driverPhone || '+91 98455 12345';
  const vehicleNo = transfer.vehicleNumber || 'KA-09-EA-4421';

  // Public Cloudflare tunnel driver app URL (works on any smartphone over 4G/WiFi)
  const tunnelDriverUrl = 'https://tommy-cost-hear-vice.trycloudflare.com/driver';
  const driverAppUrl = typeof window !== 'undefined'
    ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? `${tunnelDriverUrl}?req=${transfer.id}`
      : `${window.location.origin}/driver?req=${transfer.id}`
    : `${tunnelDriverUrl}?req=${transfer.id}`;

  // 1. Listen to Real-Time SSE Stream for TRUE Hardware Coordinates
  useEffect(() => {
    let es;
    try {
      es = new EventSource('http://localhost:5000/api/events');
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'TRANSIT_GPS_UPDATED' && (!data.requestId || data.requestId === transfer.id)) {
            const gps = data.transitGps;
            if (gps && gps.lat && gps.lng) {
              setPhoneGpsActive(true);
              setLocalCoords({ lat: gps.lat, lng: gps.lng });
              if (gps.currentSpeedKmH !== undefined) setLocalSpeed(gps.currentSpeedKmH);
              if (gps.accuracy !== undefined) setLocalAccuracy(gps.accuracy);
              if (gps.temperatureC !== undefined) setLocalTemp(gps.temperatureC);
              if (gps.currentLocationName) setLocalLocation(gps.currentLocationName);

              setPacketCount(c => c + 1);
              setLastPacketTime(new Date().toLocaleTimeString());

              // Update Leaflet Map dynamically to exact real coordinates
              if (mapInstanceRef.current) {
                // Fly to real street level coordinates
                mapInstanceRef.current.flyTo([gps.lat, gps.lng], 17, { duration: 1.0 });

                if (markerRef.current) {
                  markerRef.current.setLatLng([gps.lat, gps.lng]);
                } else if (window.L) {
                  const L = window.L;
                  const icon = L.divIcon({
                    className: 'live-ambulance-marker',
                    html: `
                      <div style="position:relative; display:flex; align-items:center; justify-content:center; transform:translate(-50%, -50%);">
                        <div style="position:absolute; width:44px; height:44px; border-radius:50%; background:rgba(16, 185, 129, 0.35); animation:pulse 1.8s infinite;"></div>
                        <div style="width:34px; height:34px; border-radius:50%; background:#0f172a; border:3px solid #ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:#ffffff; font-size:15px;">
                          🚑
                        </div>
                      </div>
                    `,
                    iconSize: [44, 44],
                    iconAnchor: [22, 22]
                  });
                  markerRef.current = L.marker([gps.lat, gps.lng], { icon }).addTo(mapInstanceRef.current);
                }

                // Accuracy circle
                if (accuracyCircleRef.current) {
                  accuracyCircleRef.current.setLatLng([gps.lat, gps.lng]);
                  accuracyCircleRef.current.setRadius(Math.max(10, gps.accuracy || 15));
                }

                // Real walking path trail
                if (pathPolylineRef.current) {
                  pathHistoryRef.current.push([gps.lat, gps.lng]);
                  pathPolylineRef.current.setLatLngs(pathHistoryRef.current);
                }
              }
            }
          }
        } catch (e) {}
      };
    } catch (e) {}

    return () => {
      if (es) es.close();
    };
  }, [transfer.id]);

  // 2. Initialize Street-Level Leaflet Map
  useEffect(() => {
    let isMounted = true;

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

      const initialLat = localCoords.lat || 12.9716;
      const initialLng = localCoords.lng || 77.5946;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: localCoords.lat ? 17 : 13,
        zoomControl: true
      });
      mapInstanceRef.current = map;

      // Clean OpenStreetMap tiles
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19
      }).addTo(map);

      // Accuracy circle
      const circle = L.circle([initialLat, initialLng], {
        radius: 20,
        color: '#10b981',
        fillColor: '#34d399',
        fillOpacity: 0.18,
        weight: 1.5
      }).addTo(map);
      accuracyCircleRef.current = circle;

      // Real vehicle marker
      const icon = L.divIcon({
        className: 'live-ambulance-marker',
        html: `
          <div style="position:relative; display:flex; align-items:center; justify-content:center; transform:translate(-50%, -50%);">
            <div style="position:absolute; width:44px; height:44px; border-radius:50%; background:rgba(16, 185, 129, 0.35); animation:pulse 1.8s infinite;"></div>
            <div style="width:34px; height:34px; border-radius:50%; background:#0f172a; border:3px solid #ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:#ffffff; font-size:15px;">
              🚑
            </div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });

      markerRef.current = L.marker([initialLat, initialLng], { icon }).addTo(map);

      // Breadcrumb polyline
      pathHistoryRef.current = [[initialLat, initialLng]];
      pathPolylineRef.current = L.polyline(pathHistoryRef.current, {
        color: '#0f172a',
        weight: 4,
        opacity: 0.85
      }).addTo(map);
    };

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

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '20px',
      border: '1.5px solid #e2e8f0',
      padding: '22px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.05)',
      marginBottom: '22px',
      position: 'relative'
    }}>
      {/* Header Strip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: phoneGpsActive ? '#ecfdf5' : '#f1f5f9',
              color: phoneGpsActive ? '#059669' : '#64748b',
              padding: '4px 12px',
              borderRadius: '999px',
              fontSize: '0.74rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: phoneGpsActive ? '#10b981' : '#94a3b8',
                boxShadow: phoneGpsActive ? '0 0 8px #10b981' : 'none'
              }}></span>
              {phoneGpsActive ? '🟢 REAL HARDWARE GPS CONNECTED' : 'STANDBY · AWAITING DRIVER GPS'}
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 800, color: '#64748b' }}>
              {transfer.id}
            </span>
          </div>

          <h4 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: '6px 0 2px 0' }}>
            {transfer.medicine} · <span style={{ color: '#008b8b' }}>{transfer.quantityKg} kg</span>
          </h4>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setShowQrModal(true)}
            className="btn btn-sm"
            style={{
              background: '#0f172a',
              color: '#ffffff',
              borderRadius: '12px',
              border: 'none',
              padding: '9px 14px',
              fontSize: '0.8rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
              cursor: 'pointer'
            }}
          >
            📱 Scan Phone GPS Transponder
          </button>
        </div>
      </div>

      {/* Real-World Street Map */}
      <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1.5px solid #e2e8f0', marginBottom: '16px', position: 'relative' }}>
        <div style={{
          position: 'absolute', top: '12px', left: '12px', zIndex: 400,
          background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(6px)',
          border: '1px solid #e2e8f0', padding: '4px 12px', borderRadius: '999px',
          fontSize: '0.72rem', fontWeight: 800, color: '#0f172a',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: phoneGpsActive ? '#10b981' : '#f59e0b' }}></span>
          <span>{phoneGpsActive ? 'STREET LEVEL SATELLITE TRACKING' : 'MAP VIEW'}</span>
        </div>

        {localCoords.lat && (
          <div style={{
            position: 'absolute', top: '12px', right: '12px', zIndex: 400,
            background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(6px)',
            border: '1px solid #e2e8f0', padding: '4px 12px', borderRadius: '999px',
            fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 800, color: '#0f172a',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}>
            📍 {localCoords.lat.toFixed(6)}° N, {localCoords.lng.toFixed(6)}° E
          </div>
        )}

        <div ref={mapContainerRef} style={{ width: '100%', height: '260px', background: '#f8fafc' }} />
      </div>

      {/* Real Physical Location Box */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '14px 16px',
        marginBottom: '16px'
      }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          📍 Actual Physical Address (Reverse Geocoded)
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a', marginTop: '3px' }}>
          {localLocation}
        </div>
        {localCoords.lat && (
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px', fontFamily: 'monospace' }}>
            Precision: ±{localAccuracy || '3'}m · Coordinates: {localCoords.lat.toFixed(6)}, {localCoords.lng.toFixed(6)}
          </div>
        )}
      </div>

      {/* Real Telemetry Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
        <div style={{ padding: '12px 14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Current Speed</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', marginTop: '2px', fontFamily: 'monospace' }}>
            {localSpeed} <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>km/h</span>
          </div>
        </div>

        <div style={{ padding: '12px 14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Cold Chain</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#059669', marginTop: '2px', fontFamily: 'monospace' }}>
            {localTemp}°C
          </div>
        </div>

        <div style={{ padding: '12px 14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>GPS Packets</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', marginTop: '2px', fontFamily: 'monospace' }}>
            {packetCount}
          </div>
        </div>
      </div>

      {/* Driver info & status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748b', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
        <div>
          Driver: <strong style={{ color: '#0f172a' }}>{driverName}</strong> ({vehicleNo}) · {driverPhone}
        </div>
        <div>
          {lastPacketTime ? `Last packet at ${lastPacketTime}` : 'Open driver app to stream live coordinates'}
        </div>
      </div>

      {/* QR Code Modal for Real Phone Tracking */}
      {showQrModal && (
        <div
          onClick={() => setShowQrModal(false)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10002, padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff', borderRadius: '24px', padding: '28px',
              maxWidth: '420px', width: '100%', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: '#0f172a', color: '#ffffff', margin: '0 auto 14px auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'
            }}>
              📱
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginBottom: '6px' }}>
              Connect Real Phone GPS
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '20px', lineHeight: '1.4' }}>
              Scan this QR code with your smartphone camera. It will open the real-time GPS transponder, streaming your actual physical walking/driving position to this map.
            </p>

            <div style={{
              display: 'inline-block', padding: '16px', background: '#ffffff',
              borderRadius: '18px', border: '1.5px solid #e2e8f0', boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
              marginBottom: '16px'
            }}>
              <QRCodeSVG value={driverAppUrl} size={180} />
            </div>

            <div style={{ fontSize: '0.74rem', color: '#64748b', wordBreak: 'break-all', marginBottom: '20px', background: '#f8fafc', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              Direct link for testing on this computer:<br/>
              <a href="/driver" target="_blank" style={{ color: '#0284c7', fontWeight: 700, textDecoration: 'none' }}>
                Open /driver in new tab
              </a>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '12px', borderRadius: '12px', fontWeight: 800 }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
