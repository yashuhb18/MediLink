"use client";
import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';

export default function TransitTrackerCard({ transfer, onUpdate, userRole = 'REQUESTING_SUPERVISOR' }) {
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedLinkType, setSelectedLinkType] = useState('tunnel'); // 'tunnel' | 'lan' | 'local'

  // Server discovery state
  const [serverIp, setServerIp] = useState('');
  const [tunnelUrl, setTunnelUrl] = useState('');

  // Check if transfer already has a genuine real-time GPS fix
  const initialHasRealFix = Boolean(
    transfer?.transitGps?.lat &&
    transfer?.transitGps?.lng &&
    transfer?.transitGps?.isRealFix
  );

  const [phoneGpsActive, setPhoneGpsActive] = useState(initialHasRealFix);

  // Real GPS Telemetry State (null by default if no real fix exists)
  const [localCoords, setLocalCoords] = useState({
    lat: initialHasRealFix ? transfer.transitGps.lat : null,
    lng: initialHasRealFix ? transfer.transitGps.lng : null
  });
  const [localSpeed, setLocalSpeed] = useState(initialHasRealFix ? (transfer?.transitGps?.currentSpeedKmH || 0) : 0);
  const [localAccuracy, setLocalAccuracy] = useState(initialHasRealFix ? transfer?.transitGps?.accuracy : null);
  const [localTemp, setLocalTemp] = useState(transfer?.transitGps?.temperatureC || 3.8);
  const [localLocation, setLocalLocation] = useState(
    initialHasRealFix
      ? (transfer?.transitGps?.currentLocationName || 'In Transit')
      : 'Awaiting Driver Smartphone GPS Broadcast...'
  );
  const [lastPacketTime, setLastPacketTime] = useState(initialHasRealFix ? 'Active' : null);
  const [packetCount, setPacketCount] = useState(initialHasRealFix ? 1 : 0);

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

  // Fetch local server IP and active tunnel URL for mobile QR code
  useEffect(() => {
    fetch(`${API_BASE}/server-info`)
      .then(res => res.json())
      .then(data => {
        if (data) {
          if (data.serverIp) setServerIp(data.serverIp);
          if (data.tunnelUrl) {
            setTunnelUrl(data.tunnelUrl);
            setSelectedLinkType('tunnel');
          } else {
            setSelectedLinkType('lan');
          }
        }
      })
      .catch(() => {});
  }, []);

  // Compute URLs for different network environments
  const lanHost = serverIp ? `${serverIp}:3000` : (typeof window !== 'undefined' ? window.location.host : 'localhost:3000');
  const localHost = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';

  const tunnelDriverUrl = tunnelUrl ? `${tunnelUrl}/driver?req=${transfer.id}` : null;
  const lanDriverUrl = `${typeof window !== 'undefined' ? window.location.protocol : 'http:'}//${lanHost}/driver?req=${transfer.id}`;
  const localDriverUrl = `${typeof window !== 'undefined' ? window.location.protocol : 'http:'}//${localHost}/driver?req=${transfer.id}`;

  const activeDriverUrl = (selectedLinkType === 'tunnel' && tunnelDriverUrl)
    ? tunnelDriverUrl
    : (selectedLinkType === 'local' ? localDriverUrl : lanDriverUrl);

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(activeDriverUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Telemetry Applicator: updates local coordinates, speed, address, packet count, and animates Leaflet Map
  const applyGpsTelemetry = (gps) => {
    if (!gps || gps.lat === null || gps.lng === null || isNaN(gps.lat) || isNaN(gps.lng)) return;

    setPhoneGpsActive(true);
    setLocalCoords({ lat: gps.lat, lng: gps.lng });
    if (gps.currentSpeedKmH !== undefined && gps.currentSpeedKmH !== null) setLocalSpeed(gps.currentSpeedKmH);
    if (gps.accuracy !== undefined && gps.accuracy !== null) setLocalAccuracy(gps.accuracy);
    if (gps.temperatureC !== undefined && gps.temperatureC !== null) setLocalTemp(gps.temperatureC);
    if (gps.currentLocationName) setLocalLocation(gps.currentLocationName);

    setPacketCount(c => c + 1);
    setLastPacketTime(new Date().toLocaleTimeString());

    // Update Leaflet Map dynamically to exact real coordinates
    if (mapInstanceRef.current && window.L) {
      const L = window.L;

      // Fly to real street level coordinates
      mapInstanceRef.current.flyTo([gps.lat, gps.lng], 17, { duration: 0.8 });

      if (markerRef.current) {
        markerRef.current.setLatLng([gps.lat, gps.lng]);
      } else {
        const icon = L.divIcon({
          className: 'live-ambulance-marker',
          html: `
            <div style="position:relative; display:flex; align-items:center; justify-content:center; transform:translate(-50%, -50%);">
              <div style="position:absolute; width:46px; height:46px; border-radius:50%; background:rgba(16, 185, 129, 0.4); animation:pulse 1.8s infinite;"></div>
              <div style="width:34px; height:34px; border-radius:50%; background:#0f172a; border:3px solid #ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:#ffffff; font-size:15px;">
                🚑
              </div>
            </div>
          `,
          iconSize: [46, 46],
          iconAnchor: [23, 23]
        });
        markerRef.current = L.marker([gps.lat, gps.lng], { icon }).addTo(mapInstanceRef.current);
      }

      // Accuracy circle
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.setLatLng([gps.lat, gps.lng]);
        accuracyCircleRef.current.setRadius(Math.max(10, gps.accuracy || 15));
      } else {
        accuracyCircleRef.current = L.circle([gps.lat, gps.lng], {
          radius: Math.max(10, gps.accuracy || 15),
          color: '#10b981',
          fillColor: '#34d399',
          fillOpacity: 0.18,
          weight: 1.5
        }).addTo(mapInstanceRef.current);
      }

      // Real movement breadcrumbs trail
      if (pathPolylineRef.current) {
        pathHistoryRef.current.push([gps.lat, gps.lng]);
        pathPolylineRef.current.setLatLngs(pathHistoryRef.current);
      } else {
        pathHistoryRef.current = [[gps.lat, gps.lng]];
        pathPolylineRef.current = L.polyline(pathHistoryRef.current, {
          color: '#0f172a',
          weight: 4,
          opacity: 0.85
        }).addTo(mapInstanceRef.current);
      }
    }
  };

  // 1A. Sync from transfer prop if parent re-fetches
  useEffect(() => {
    if (transfer?.transitGps?.lat && transfer?.transitGps?.lng) {
      applyGpsTelemetry(transfer.transitGps);
    }
  }, [transfer?.transitGps?.lat, transfer?.transitGps?.lng, transfer?.transitGps?.updatedAt]);

  // 1B. Listen to Window Telemetry Event (broadcast by page-level SSE)
  useEffect(() => {
    const handleGpsUpdate = (e) => {
      const data = e.detail;
      if (data && (!data.requestId || data.requestId === transfer.id) && data.transitGps) {
        applyGpsTelemetry(data.transitGps);
      }
    };
    window.addEventListener('medilink_gps_update', handleGpsUpdate);
    return () => window.removeEventListener('medilink_gps_update', handleGpsUpdate);
  }, [transfer.id]);

  // 1C. Listen to Real-Time SSE Stream directly
  useEffect(() => {
    let es;
    try {
      es = new EventSource(`${API_BASE}/events`);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'TRANSIT_GPS_UPDATED' && (!data.requestId || data.requestId === transfer.id)) {
            if (data.transitGps) applyGpsTelemetry(data.transitGps);
          }
        } catch (e) {}
      };
    } catch (e) {}

    return () => {
      if (es) es.close();
    };
  }, [transfer.id]);

  // 1D. Bulletproof 1.5-second Polling Fallback (ensures real-time updates even if SSE is blocked/stalled)
  useEffect(() => {
    if (!transfer?.id) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/iot/transit-gps/${transfer.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.transitGps && data.transitGps.lat && data.transitGps.lng) {
          applyGpsTelemetry(data.transitGps);
        }
      } catch (err) {}
    }, 1500);
    return () => clearInterval(interval);
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

      // If genuine coords exist, center on them; otherwise show clean regional view
      const hasCoords = Boolean(localCoords.lat && localCoords.lng && phoneGpsActive);
      const initialLat = hasCoords ? localCoords.lat : 12.9716;
      const initialLng = hasCoords ? localCoords.lng : 77.5946;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: hasCoords ? 17 : 11,
        zoomControl: true
      });
      mapInstanceRef.current = map;

      // Clean OpenStreetMap tiles
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19
      }).addTo(map);

      // ONLY add marker and accuracy circle if a REAL GPS lock was already present
      if (hasCoords) {
        const circle = L.circle([initialLat, initialLng], {
          radius: Math.max(10, localAccuracy || 15),
          color: '#10b981',
          fillColor: '#34d399',
          fillOpacity: 0.18,
          weight: 1.5
        }).addTo(map);
        accuracyCircleRef.current = circle;

        const icon = L.divIcon({
          className: 'live-ambulance-marker',
          html: `
            <div style="position:relative; display:flex; align-items:center; justify-content:center; transform:translate(-50%, -50%);">
              <div style="position:absolute; width:46px; height:46px; border-radius:50%; background:rgba(16, 185, 129, 0.4); animation:pulse 1.8s infinite;"></div>
              <div style="width:34px; height:34px; border-radius:50%; background:#0f172a; border:3px solid #ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:#ffffff; font-size:15px;">
                🚑
              </div>
            </div>
          `,
          iconSize: [46, 46],
          iconAnchor: [23, 23]
        });

        markerRef.current = L.marker([initialLat, initialLng], { icon }).addTo(map);

        pathHistoryRef.current = [[initialLat, initialLng]];
        pathPolylineRef.current = L.polyline(pathHistoryRef.current, {
          color: '#0f172a',
          weight: 4,
          opacity: 0.85
        }).addTo(map);
      }
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
      padding: '24px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.05)',
      marginBottom: '24px',
      position: 'relative'
    }}>
      {/* Header Strip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: phoneGpsActive ? '#ecfdf5' : '#fef3c7',
              color: phoneGpsActive ? '#059669' : '#b45309',
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
                background: phoneGpsActive ? '#10b981' : '#f59e0b',
                boxShadow: phoneGpsActive ? '0 0 8px #10b981' : 'none'
              }}></span>
              {phoneGpsActive ? '🟢 REAL DRIVER GPS CONNECTED' : '🟡 STANDBY · AWAITING DRIVER SCAN'}
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: '0.84rem', fontWeight: 800, color: '#0f172a', background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px' }}>
              {transfer.id}
            </span>
          </div>

          <h4 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a', margin: '6px 0 2px 0' }}>
            {transfer.medicine} · <span style={{ color: '#008b8b' }}>{transfer.packageCount || (transfer.quantityKg * 20)} {transfer.dosageUnit || 'Strips'} ({transfer.quantityKg} kg)</span>
          </h4>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Origin: <strong>{transfer.sourceHospitalId}</strong> ➔ Destination: <strong>{transfer.requestingHospitalId}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Prominent Driver Scanner QR Button */}
          <button
            onClick={() => setShowQrModal(true)}
            style={{
              background: '#0f172a',
              color: '#ffffff',
              borderRadius: '12px',
              border: 'none',
              padding: '10px 16px',
              fontSize: '0.82rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(15, 23, 42, 0.2)',
              cursor: 'pointer'
            }}
          >
            <span>📱</span> Driver GPS Scanner QR
          </button>

          {/* Direct link button for instant testing on laptop */}
          <a
            href={`/driver?req=${transfer.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#f8fafc',
              color: '#0284c7',
              border: '1.5px solid #cbd5e1',
              borderRadius: '12px',
              padding: '9px 14px',
              fontSize: '0.8rem',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ↗ Open Driver Page
          </a>
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
          <span>{phoneGpsActive ? 'STREET LEVEL GPS SATELLITE TRACKING' : 'MAP VIEW (STANDBY)'}</span>
        </div>

        {phoneGpsActive && localCoords.lat ? (
          <div style={{
            position: 'absolute', top: '12px', right: '12px', zIndex: 400,
            background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(6px)',
            border: '1px solid #e2e8f0', padding: '4px 12px', borderRadius: '999px',
            fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 800, color: '#0f172a',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}>
            📍 {localCoords.lat.toFixed(6)}° N, {localCoords.lng.toFixed(6)}° E
          </div>
        ) : (
          <div style={{
            position: 'absolute', top: '12px', right: '12px', zIndex: 400,
            background: 'rgba(254, 243, 199, 0.95)', backdropFilter: 'blur(6px)',
            border: '1px solid #fde68a', padding: '4px 12px', borderRadius: '999px',
            fontSize: '0.72rem', fontWeight: 800, color: '#b45309',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}>
            ⚠️ Awaiting Driver GPS Stream
          </div>
        )}

        {/* Map Standby Overlay when driver has not yet broadcasted */}
        {!phoneGpsActive && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 390,
            background: 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(3px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '20px', textAlign: 'center'
          }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%', background: '#0f172a', color: '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', marginBottom: '10px',
              boxShadow: '0 4px 14px rgba(15,23,42,0.2)'
            }}>
              📱
            </div>
            <h5 style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a', margin: '0 0 4px 0' }}>
              Awaiting Driver Phone GPS Stream
            </h5>
            <p style={{ fontSize: '0.8rem', color: '#64748b', maxWidth: '380px', margin: '0 0 14px 0', lineHeight: 1.4 }}>
              Give the QR code to the driver or open the companion app. Once the driver accepts location permission, this map will immediately center on their vehicle in real time.
            </p>
            <button
              onClick={() => setShowQrModal(true)}
              style={{
                background: '#008b8b', color: '#ffffff', border: 'none', borderRadius: '10px',
                padding: '8px 18px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <span>📱</span> Show Driver Scanner QR Code
            </button>
          </div>
        )}

        <div ref={mapContainerRef} style={{ width: '100%', height: '280px', background: '#f8fafc' }} />
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
          📍 Actual Physical Address (Reverse Geocoded from Device)
        </div>
        <div style={{ fontSize: '1.02rem', fontWeight: 900, color: '#0f172a', marginTop: '3px' }}>
          {localLocation}
        </div>
        {phoneGpsActive && localCoords.lat && (
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px', fontFamily: 'monospace' }}>
            Precision: ±{localAccuracy || '3'}m · Coordinates: {localCoords.lat.toFixed(6)}, {localCoords.lng.toFixed(6)}
          </div>
        )}
      </div>

      {/* Real Telemetry Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
        <div style={{ padding: '12px 14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Current Speed</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', marginTop: '2px', fontFamily: 'monospace' }}>
            {phoneGpsActive ? localSpeed : '--'} <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>km/h</span>
          </div>
        </div>

        <div style={{ padding: '12px 14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Cold Chain</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#059669', marginTop: '2px', fontFamily: 'monospace' }}>
            {localTemp}°C
          </div>
        </div>

        <div style={{ padding: '12px 14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Live Packets</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', marginTop: '2px', fontFamily: 'monospace' }}>
            {packetCount}
          </div>
        </div>
      </div>

      {/* Driver info & status footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748b', paddingTop: '10px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          Driver: <strong style={{ color: '#0f172a' }}>{driverName}</strong> ({vehicleNo}) · {driverPhone}
        </div>
        <div>
          {lastPacketTime ? `Last GPS packet at ${lastPacketTime}` : 'Driver companion ready to broadcast'}
        </div>
      </div>

      {/* QR Code Modal for Real Phone Tracking */}
      {showQrModal && (
        <div
          onClick={() => setShowQrModal(false)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10002, padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff', borderRadius: '24px', padding: '28px',
              maxWidth: '460px', width: '100%', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
              border: '1.5px solid #e2e8f0'
            }}
          >
            <div style={{
              width: '46px', height: '46px', borderRadius: '14px',
              background: '#0f172a', color: '#ffffff', margin: '0 auto 12px auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem'
            }}>
              📱
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a', marginBottom: '4px' }}>
              Driver GPS Mobile Transponder
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '18px', lineHeight: '1.4' }}>
              Scan this QR code with the driver's smartphone camera. Once opened, tap <strong>Allow Location</strong> to stream true turn-by-turn physical coordinates.
            </p>

            {/* Network Route Selection Tabs */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px', marginBottom: '16px', gap: '4px' }}>
              {tunnelUrl && (
                <button
                  type="button"
                  onClick={() => setSelectedLinkType('tunnel')}
                  style={{
                    flex: 1, padding: '6px 8px', borderRadius: '8px', border: 'none',
                    background: selectedLinkType === 'tunnel' ? '#ffffff' : 'transparent',
                    color: selectedLinkType === 'tunnel' ? '#0f172a' : '#64748b',
                    fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer',
                    boxShadow: selectedLinkType === 'tunnel' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
                  }}
                >
                  🔒 Cloudflare HTTPS (Phones)
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedLinkType('lan')}
                style={{
                  flex: 1, padding: '6px 8px', borderRadius: '8px', border: 'none',
                  background: selectedLinkType === 'lan' ? '#ffffff' : 'transparent',
                  color: selectedLinkType === 'lan' ? '#0f172a' : '#64748b',
                  fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer',
                  boxShadow: selectedLinkType === 'lan' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                📶 Local Wi-Fi ({serverIp || 'LAN'})
              </button>
              <button
                type="button"
                onClick={() => setSelectedLinkType('local')}
                style={{
                  flex: 1, padding: '6px 8px', borderRadius: '8px', border: 'none',
                  background: selectedLinkType === 'local' ? '#ffffff' : 'transparent',
                  color: selectedLinkType === 'local' ? '#0f172a' : '#64748b',
                  fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer',
                  boxShadow: selectedLinkType === 'local' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                💻 Localhost (This PC)
              </button>
            </div>

            {/* High-Contrast QR Code */}
            <div style={{
              display: 'inline-block', padding: '18px', background: '#ffffff',
              borderRadius: '20px', border: '2px solid #0f172a', boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              marginBottom: '16px'
            }}>
              <QRCodeSVG value={activeDriverUrl} size={190} level="H" />
            </div>

            {/* Consignment Tag info */}
            <div style={{ fontSize: '0.74rem', color: '#64748b', marginBottom: '14px', background: '#f8fafc', padding: '10px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontWeight: 800, color: '#0f172a' }}>Consignment: {transfer.id}</span>
                <span style={{ color: '#008b8b', fontWeight: 700 }}>{transfer.medicine}</span>
              </div>
              <div style={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.7rem', color: '#475569' }}>
                {activeDriverUrl}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <button
                onClick={handleCopyLink}
                style={{
                  padding: '11px', borderRadius: '12px', border: '1.5px solid #cbd5e1',
                  background: '#f8fafc', color: '#0f172a', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer'
                }}
              >
                {copiedLink ? '✅ Copied to Clipboard!' : '📋 Copy Driver Link'}
              </button>

              <a
                href={`/driver?req=${transfer.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '11px', borderRadius: '12px', border: 'none',
                  background: '#0284c7', color: '#ffffff', fontWeight: 800, fontSize: '0.78rem',
                  textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                }}
              >
                ↗ Open & Test Here
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
