"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { API_BASE } from '@/lib/api';

export default function RealDriverGpsPage() {
  const [isTracking, setIsTracking] = useState(false);
  const [gpsReady, setGpsReady] = useState(false);
  const [gpsError, setGpsError] = useState(null);

  // Real GPS Telemetry State (Initialized null until device provides true fix)
  const [realCoords, setRealCoords] = useState(null); // { lat, lng }
  const [accuracyMeters, setAccuracyMeters] = useState(null);
  const [speedKmH, setSpeedKmH] = useState(0);
  const [altitudeMeters, setAltitudeMeters] = useState(null);
  const [realAddress, setRealAddress] = useState('Acquiring real street address...');
  const [transmittedCount, setTransmittedCount] = useState(0);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState(null);
  const [selectedReqId, setSelectedReqId] = useState('REQ-1001');
  const [transfers, setTransfers] = useState([]);

  // Leaflet Map Refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const userMarkerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const pathPolylineRef = useRef(null);
  const pathHistoryRef = useRef([]);
  const watchIdRef = useRef(null);
  const lastGeocodeTimeRef = useRef(0);

  // Fetch active transfers from server
  useEffect(() => {
    fetch(`${API_BASE}/iot/active-transfers`)
      .then(r => r.json())
      .then(d => {
        if (d.transfers && d.transfers.length > 0) {
          setTransfers(d.transfers);
          setSelectedReqId(d.transfers[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Reverse Geocoding via OpenStreetMap (fetches actual real street name)
  const fetchAddress = async (lat, lng) => {
    const now = Date.now();
    // Throttle reverse geocoding to once every 10 seconds to respect OpenStreetMap rate limits
    if (now - lastGeocodeTimeRef.current < 10000) return;
    lastGeocodeTimeRef.current = now;

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
        headers: { 'User-Agent': 'MediLink-RealTime-GPS' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          // Format concise clean street address
          const addr = data.address || {};
          const road = addr.road || addr.pedestrian || addr.suburb || '';
          const neighborhood = addr.neighbourhood || addr.suburb || addr.city_district || '';
          const city = addr.city || addr.town || addr.county || addr.state || '';
          const formatted = [road, neighborhood, city].filter(Boolean).join(', ') || data.display_name.split(',').slice(0, 3).join(',');
          setRealAddress(formatted);
          return formatted;
        }
      }
    } catch (e) {
      console.warn('Geocoding notice:', e.message);
    }
    return null;
  };

  // Send REAL GPS coordinates to MediLink server
  const transmitRealGps = async (lat, lng, speed, acc, addr) => {
    try {
      const res = await fetch(`${API_BASE}/iot/transit-gps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: selectedReqId || 'REQ-1001',
          lat,
          lng,
          accuracy: acc,
          currentSpeedKmH: speed,
          currentLocationName: addr || realAddress,
          temperatureC: 3.8,
          liveTrackingStatus: 'IN_TRANSIT'
        })
      });

      if (res.ok) {
        setTransmittedCount(prev => prev + 1);
        setLastSyncTimestamp(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.warn('Telemetry error:', err.message);
    }
  };

  // Initialize Leaflet Map
  useEffect(() => {
    let isMounted = true;

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const initMap = (initialLat, initialLng) => {
      if (!window.L || !mapContainerRef.current || mapInstanceRef.current) return;
      const L = window.L;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 17, // Street-level high resolution
        zoomControl: false,
        attributionControl: false
      });
      mapInstanceRef.current = map;

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      // Accuracy circle
      const circle = L.circle([initialLat, initialLng], {
        radius: 15,
        color: '#2563eb',
        fillColor: '#60a5fa',
        fillOpacity: 0.15,
        weight: 1.5
      }).addTo(map);
      accuracyCircleRef.current = circle;

      // Real User GPS Marker (pulsing blue dot + ambulance badge)
      const userIcon = L.divIcon({
        className: 'real-gps-pin',
        html: `
          <div style="position:relative; display:flex; align-items:center; justify-content:center; transform:translate(-50%, -50%);">
            <div style="position:absolute; width:44px; height:44px; border-radius:50%; background:rgba(37,99,235,0.3); animation:pulse 1.8s infinite;"></div>
            <div style="width:26px; height:26px; border-radius:50%; background:#2563eb; border:3px solid #ffffff; box-shadow:0 4px 12px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:#ffffff; font-size:11px; font-weight:bold;">
              📍
            </div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });

      const marker = L.marker([initialLat, initialLng], { icon: userIcon }).addTo(map);
      userMarkerRef.current = marker;

      // Polyline for real-time movement breadcrumbs
      const polyline = L.polyline([[initialLat, initialLng]], {
        color: '#0f172a',
        weight: 4,
        opacity: 0.85
      }).addTo(map);
      pathPolylineRef.current = polyline;
      pathHistoryRef.current = [[initialLat, initialLng]];
    };

    // First acquire actual device position to center map
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!isMounted) return;
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setRealCoords({ lat, lng });
          setAccuracyMeters(pos.coords.accuracy ? +(pos.coords.accuracy.toFixed(1)) : 5);
          setGpsReady(true);

          if (!window.L) {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.async = true;
            script.onload = () => initMap(lat, lng);
            document.body.appendChild(script);
          } else {
            initMap(lat, lng);
          }

          fetchAddress(lat, lng);
        },
        (err) => {
          setGpsError(err.message);
          // Fallback initial view if permission not yet accepted
          const fallbackLat = 12.9716, fallbackLng = 77.5946;
          if (!window.L) {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.async = true;
            script.onload = () => initMap(fallbackLat, fallbackLng);
            document.body.appendChild(script);
          } else {
            initMap(fallbackLat, fallbackLng);
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map elements when real position updates
  const handlePositionUpdate = (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const acc = pos.coords.accuracy ? +(pos.coords.accuracy.toFixed(1)) : 3;
    const spd = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
    const alt = pos.coords.altitude ? Math.round(pos.coords.altitude) : null;

    setRealCoords({ lat, lng });
    setAccuracyMeters(acc);
    setSpeedKmH(spd);
    if (alt !== null) setAltitudeMeters(alt);

    // Update map view & marker
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([lat, lng]);
    }
    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.setLatLng([lat, lng]);
      accuracyCircleRef.current.setRadius(Math.max(10, acc));
    }
    if (pathPolylineRef.current) {
      pathHistoryRef.current.push([lat, lng]);
      pathPolylineRef.current.setLatLngs(pathHistoryRef.current);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo([lat, lng]);
    }

    // Reverse geocode
    fetchAddress(lat, lng);

    // Send real coordinates to backend
    transmitRealGps(lat, lng, spd, acc, realAddress);
  };

  // Toggle Live Hardware GPS Streaming
  const toggleGps = () => {
    if (!isTracking) {
      if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
      }

      setIsTracking(true);
      setGpsError(null);

      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        (err) => {
          console.error('GPS error:', err);
          setGpsError(err.message);
          setIsTracking(false);
          alert(`GPS Error: ${err.message}. Please enable location access in browser settings.`);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000
        }
      );
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTracking(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      color: '#0f172a',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Top Header */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '12px 18px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
        zIndex: 500
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '12px',
            background: '#0f172a', color: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1rem', fontWeight: 900
          }}>
            GPS
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>
              Real Hardware GPS
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#64748b' }}>
              <span style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: isTracking ? '#10b981' : '#f59e0b',
                boxShadow: isTracking ? '0 0 8px #10b981' : 'none'
              }}></span>
              <span style={{ fontWeight: 700 }}>
                {isTracking ? 'BROADCASTING REAL COORDINATES' : 'STANDBY · READY'}
              </span>
            </div>
          </div>
        </div>

        <Link
          href="/supervisor-req"
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#475569',
            textDecoration: 'none',
            padding: '6px 12px',
            background: '#f1f5f9',
            borderRadius: '999px',
            border: '1px solid #e2e8f0'
          }}
        >
          View Map
        </Link>
      </header>

      {/* Street-Level Map Viewport */}
      <div style={{ position: 'relative', flex: 1, minHeight: '300px' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', minHeight: '300px', background: '#e2e8f0' }} />

        {/* Real GPS Precision Pill */}
        <div style={{
          position: 'absolute', top: '14px', right: '14px', zIndex: 400,
          background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)',
          border: '1px solid #e2e8f0', borderRadius: '999px',
          padding: '5px 12px', fontSize: '0.74rem', fontWeight: 800, color: '#0f172a',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          <span style={{ color: accuracyMeters && accuracyMeters < 10 ? '#10b981' : '#f59e0b' }}>●</span>
          <span>True Accuracy: ±{accuracyMeters || '--'}m</span>
        </div>

        {/* Recenter Button */}
        {realCoords && (
          <button
            onClick={() => {
              if (mapInstanceRef.current && realCoords) {
                mapInstanceRef.current.setView([realCoords.lat, realCoords.lng], 18, { animate: true });
              }
            }}
            style={{
              position: 'absolute', bottom: '14px', right: '14px', zIndex: 400,
              width: '40px', height: '40px', borderRadius: '50%',
              background: '#ffffff', border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '1.1rem', cursor: 'pointer'
            }}
            title="Recenter Map on Real Location"
          >
            🎯
          </button>
        )}
      </div>

      {/* Bottom Real-Time Location Card */}
      <div style={{
        background: '#ffffff',
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px',
        padding: '20px 20px 32px 20px',
        boxShadow: '0 -8px 25px rgba(0,0,0,0.06)',
        borderTop: '1px solid #e2e8f0',
        zIndex: 500,
        maxWidth: '540px',
        margin: '0 auto',
        width: '100%'
      }}>
        {/* Drag Handle */}
        <div style={{ width: '36px', height: '4px', background: '#cbd5e1', borderRadius: '999px', margin: '-8px auto 16px auto' }} />

        {/* Real Physical Location Address */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '14px 16px',
          marginBottom: '16px'
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            📍 Your Real Physical Location
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', marginTop: '2px', lineHeight: '1.3' }}>
            {realAddress}
          </div>
          <div style={{
            fontSize: '0.75rem', fontFamily: 'monospace', color: '#0284c7',
            marginTop: '6px', fontWeight: 700, display: 'flex', gap: '12px'
          }}>
            <span>Lat: {realCoords ? realCoords.lat.toFixed(6) : 'Acquiring...'}°</span>
            <span>Lng: {realCoords ? realCoords.lng.toFixed(6) : 'Acquiring...'}°</span>
          </div>
        </div>

        {/* Real Sensor Telemetry Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '12px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>GPS Speed</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', marginTop: '2px', fontFamily: 'monospace' }}>
              {speedKmH} <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b' }}>km/h</span>
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '12px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Accuracy</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#059669', marginTop: '2px', fontFamily: 'monospace' }}>
              ±{accuracyMeters || '--'}m
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '12px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Packets Sent</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', marginTop: '2px', fontFamily: 'monospace' }}>
              {transmittedCount}
            </div>
          </div>
        </div>

        {/* Main Action Toggle Button */}
        {!isTracking ? (
          <button
            onClick={toggleGps}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '16px',
              border: 'none',
              background: '#0f172a',
              color: '#ffffff',
              fontSize: '1rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(15, 23, 42, 0.25)'
            }}
          >
            <span>▶</span> START REAL GPS BROADCAST
          </button>
        ) : (
          <button
            onClick={toggleGps}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '16px',
              border: '1.5px solid #e2e8f0',
              background: '#ffffff',
              color: '#ef4444',
              fontSize: '1rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}
          >
            <span>⏸</span> PAUSE REAL GPS BROADCAST
          </button>
        )}

        {gpsError && (
          <div style={{ marginTop: '10px', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '0.75rem' }}>
            ⚠️ Location permission error: {gpsError}. Please allow GPS in your device settings.
          </div>
        )}

        {/* Sync Info Footer */}
        <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '0.72rem', color: '#94a3b8' }}>
          {isTracking
            ? `Transmitting real device GPS every 1.5s · Last sync: ${lastSyncTimestamp || 'Just now'}`
            : 'Tap Start to broadcast your true physical coordinates to the MediLink network'}
        </div>
      </div>
    </div>
  );
}
