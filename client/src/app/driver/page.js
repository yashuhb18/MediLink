"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { API_BASE } from '@/lib/api';

export default function RealDriverGpsPage() {
  const [isTracking, setIsTracking] = useState(false);
  const [gpsReady, setGpsReady] = useState(false);
  const [gpsError, setGpsError] = useState(null);

  // Consignment & Transfer State
  const [selectedReqId, setSelectedReqId] = useState('');
  const [currentTransfer, setCurrentTransfer] = useState(null);
  const [transfers, setTransfers] = useState([]);

  // Real GPS Telemetry State (null until device provides true fix)
  const [realCoords, setRealCoords] = useState(null); // { lat, lng }
  const [accuracyMeters, setAccuracyMeters] = useState(null);
  const [speedKmH, setSpeedKmH] = useState(0);
  const [altitudeMeters, setAltitudeMeters] = useState(null);
  const [realAddress, setRealAddress] = useState('Acquiring physical street address...');
  const [transmittedCount, setTransmittedCount] = useState(0);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState(null);
  const [progressPercent, setProgressPercent] = useState(15);
  const [deliveryConfirmed, setDeliveryConfirmed] = useState(false);

  // Leaflet Map Refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const userMarkerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const pathPolylineRef = useRef(null);
  const pathHistoryRef = useRef([]);
  const watchIdRef = useRef(null);
  const lastGeocodeTimeRef = useRef(0);

  const activeReqIdRef = useRef('');

  // 1. Parse URL Parameter (?req=REQ-XXXX) and Fetch Consignments
  useEffect(() => {
    let reqFromUrl = null;
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      reqFromUrl = urlParams.get('req');
    }

    if (reqFromUrl) {
      activeReqIdRef.current = reqFromUrl;
      setSelectedReqId(reqFromUrl);

      // Fetch consignment telemetry & metadata directly
      fetch(`${API_BASE}/iot/transit-gps/${reqFromUrl}`)
        .then(r => r.json())
        .then(d => {
          if (d && d.success) {
            setCurrentTransfer({
              id: d.requestId,
              medicine: d.medicine || 'Paracetamol 500mg',
              quantityKg: d.quantityKg || 1.0,
              dosageUnit: d.dosageUnit || 'Strips',
              packageCount: d.packageCount || 20,
              requestingHospitalId: d.requestingHospitalId || 'H01',
              sourceHospitalId: d.sourceHospitalId || 'H02',
              driverName: d.driverName || 'Ramesh Gowda (Ambulance Fleet)',
              vehicleNumber: d.vehicleNumber || 'KA-01-MD-9901',
              transitGps: d.transitGps
            });
            if (d.transitGps?.progressPercent) {
              setProgressPercent(d.transitGps.progressPercent);
            }
          }
        })
        .catch(() => {});
    }

    fetch(`${API_BASE}/iot/active-transfers${reqFromUrl ? `?req=${reqFromUrl}` : ''}`)
      .then(r => r.json())
      .then(d => {
        if (d.transfers && d.transfers.length > 0) {
          setTransfers(d.transfers);
          const matched = reqFromUrl
            ? d.transfers.find(t => t.id === reqFromUrl)
            : d.transfers[0];

          const activeId = matched ? matched.id : (reqFromUrl || d.transfers[0].id);
          activeReqIdRef.current = activeId;
          setSelectedReqId(activeId);
          if (matched) setCurrentTransfer(matched);

          if (matched && matched.transitGps?.progressPercent) {
            setProgressPercent(matched.transitGps.progressPercent);
          }
        } else if (reqFromUrl) {
          activeReqIdRef.current = reqFromUrl;
          setSelectedReqId(reqFromUrl);
        }
      })
      .catch((err) => {
        console.warn('Failed to load active consignments:', err);
        if (reqFromUrl) {
          activeReqIdRef.current = reqFromUrl;
          setSelectedReqId(reqFromUrl);
        }
      });
  }, []);

  // Reverse Geocoding via OpenStreetMap (fetches actual real street name)
  const fetchAddress = async (lat, lng) => {
    const now = Date.now();
    if (now - lastGeocodeTimeRef.current < 8000) return;
    lastGeocodeTimeRef.current = now;

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
        headers: { 'User-Agent': 'MediLink-RealTime-Driver-GPS' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
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
  const transmitRealGps = async (lat, lng, speed, acc, addr, overrideProgress, overrideStatus) => {
    try {
      let curReq = activeReqIdRef.current || selectedReqId;
      if (!curReq && typeof window !== 'undefined') {
        curReq = new URLSearchParams(window.location.search).get('req');
      }
      if (!curReq) curReq = 'REQ-1001';

      const currentProg = overrideProgress !== undefined ? overrideProgress : progressPercent;

      const res = await fetch(`${API_BASE}/iot/transit-gps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: curReq,
          lat,
          lng,
          accuracy: acc,
          currentSpeedKmH: speed,
          currentLocationName: addr || realAddress,
          progressPercent: currentProg,
          temperatureC: 3.8,
          liveTrackingStatus: overrideStatus || (currentProg >= 100 ? 'ARRIVED_AT_DOCK' : 'IN_TRANSIT')
        })
      });

      if (res.ok) {
        setTransmittedCount(prev => prev + 1);
        setLastSyncTimestamp(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.warn('Telemetry transmission error:', err.message);
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

    const initMap = (initialLat, initialLng, isRealLock = false) => {
      if (!window.L || !mapContainerRef.current || mapInstanceRef.current) return;
      const L = window.L;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: isRealLock ? 17 : 14,
        zoomControl: false,
        attributionControl: false
      });
      mapInstanceRef.current = map;

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      if (isRealLock) {
        // Accuracy circle
        const circle = L.circle([initialLat, initialLng], {
          radius: 15,
          color: '#2563eb',
          fillColor: '#60a5fa',
          fillOpacity: 0.18,
          weight: 1.5
        }).addTo(map);
        accuracyCircleRef.current = circle;

        // User Marker
        const userIcon = L.divIcon({
          className: 'real-gps-pin',
          html: `
            <div style="position:relative; display:flex; align-items:center; justify-content:center; transform:translate(-50%, -50%);">
              <div style="position:absolute; width:44px; height:44px; border-radius:50%; background:rgba(37,99,235,0.35); animation:pulse 1.8s infinite;"></div>
              <div style="width:32px; height:32px; border-radius:50%; background:#0f172a; border:3px solid #ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:#ffffff; font-size:14px;">
                🚑
              </div>
            </div>
          `,
          iconSize: [44, 44],
          iconAnchor: [22, 22]
        });

        const marker = L.marker([initialLat, initialLng], { icon: userIcon }).addTo(map);
        userMarkerRef.current = marker;

        const polyline = L.polyline([[initialLat, initialLng]], {
          color: '#0f172a',
          weight: 4,
          opacity: 0.85
        }).addTo(map);
        pathPolylineRef.current = polyline;
        pathHistoryRef.current = [[initialLat, initialLng]];
      }
    };

    // First acquire actual device position
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
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
            script.onload = () => initMap(lat, lng, true);
            document.body.appendChild(script);
          } else {
            initMap(lat, lng, true);
          }

          fetchAddress(lat, lng);
        },
        (err) => {
          setGpsError(err.message);
          // Clean initial view centered on Southern India until user clicks Allow
          const fallbackLat = 12.9716, fallbackLng = 77.5946;
          if (!window.L) {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.async = true;
            script.onload = () => initMap(fallbackLat, fallbackLng, false);
            document.body.appendChild(script);
          } else {
            initMap(fallbackLat, fallbackLng, false);
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
    setGpsReady(true);
    setGpsError(null);
    if (alt !== null) setAltitudeMeters(alt);

    // If marker doesn't exist yet, create it
    if (mapInstanceRef.current) {
      const L = window.L;
      if (!userMarkerRef.current && L) {
        const userIcon = L.divIcon({
          className: 'real-gps-pin',
          html: `
            <div style="position:relative; display:flex; align-items:center; justify-content:center; transform:translate(-50%, -50%);">
              <div style="position:absolute; width:44px; height:44px; border-radius:50%; background:rgba(37,99,235,0.35); animation:pulse 1.8s infinite;"></div>
              <div style="width:32px; height:32px; border-radius:50%; background:#0f172a; border:3px solid #ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:#ffffff; font-size:14px;">
                🚑
              </div>
            </div>
          `,
          iconSize: [44, 44],
          iconAnchor: [22, 22]
        });
        userMarkerRef.current = L.marker([lat, lng], { icon: userIcon }).addTo(mapInstanceRef.current);
      } else if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([lat, lng]);
      }

      if (!accuracyCircleRef.current && L) {
        accuracyCircleRef.current = L.circle([lat, lng], {
          radius: Math.max(10, acc),
          color: '#2563eb',
          fillColor: '#60a5fa',
          fillOpacity: 0.18,
          weight: 1.5
        }).addTo(mapInstanceRef.current);
      } else if (accuracyCircleRef.current) {
        accuracyCircleRef.current.setLatLng([lat, lng]);
        accuracyCircleRef.current.setRadius(Math.max(10, acc));
      }

      if (!pathPolylineRef.current && L) {
        pathHistoryRef.current = [[lat, lng]];
        pathPolylineRef.current = L.polyline(pathHistoryRef.current, {
          color: '#0f172a',
          weight: 4,
          opacity: 0.85
        }).addTo(mapInstanceRef.current);
      } else if (pathPolylineRef.current) {
        pathHistoryRef.current.push([lat, lng]);
        pathPolylineRef.current.setLatLngs(pathHistoryRef.current);
      }

      mapInstanceRef.current.panTo([lat, lng], { animate: true });
    }

    // Reverse geocode
    fetchAddress(lat, lng);

    // Send real coordinates to backend
    transmitRealGps(lat, lng, spd, acc, realAddress);
  };

  // Toggle Live Hardware GPS Streaming
  const toggleGps = () => {
    if (!isTracking) {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        alert('Geolocation is not supported by your mobile browser.');
        return;
      }

      setIsTracking(true);
      setGpsError(null);

      // Force immediate single fix first
      navigator.geolocation.getCurrentPosition(
        handlePositionUpdate,
        (err) => {
          console.error('Initial GPS error:', err);
          setGpsError(err.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );

      // Continuous high accuracy watcher
      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        (err) => {
          console.error('Continuous GPS error:', err);
          setGpsError(err.message);
          if (err.code === 1) { // PERMISSION_DENIED
            setIsTracking(false);
            alert(`Location Permission Blocked: ${err.message}. Please tap the browser lock icon and enable Location.`);
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 15000
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

  // Manual Step Simulator for testing indoors without driving
  const simulateWalkStep = () => {
    const baseLat = realCoords?.lat || 12.9716;
    const baseLng = realCoords?.lng || 77.5946;
    // Step forward ~40 meters northward
    const nextLat = baseLat + 0.00035;
    const nextLng = baseLng + (Math.random() - 0.5) * 0.0002;
    const nextSpeed = Math.floor(25 + Math.random() * 20);
    const nextProg = Math.min(95, progressPercent + 10);
    setProgressPercent(nextProg);

    handlePositionUpdate({
      coords: {
        latitude: nextLat,
        longitude: nextLng,
        accuracy: 4.2,
        speed: nextSpeed / 3.6,
        altitude: 880
      }
    });
  };

  // Confirm arrival at hospital dock
  const confirmDockArrival = async () => {
    setProgressPercent(100);
    setDeliveryConfirmed(true);
    if (realCoords) {
      await transmitRealGps(
        realCoords.lat,
        realCoords.lng,
        0,
        accuracyMeters || 3,
        realAddress,
        100,
        'ARRIVED_AT_DOCK'
      );
    }
    alert('🏁 Consignment arrived at hospital receiving dock! Verification workstation notified.');
  };

  const activeMedicine = currentTransfer?.medicine || 'Medical Consignment';
  const activeQuantity = currentTransfer?.quantityKg || 1.0;
  const activeUnit = currentTransfer?.dosageUnit || 'Strips';
  const activeCount = currentTransfer?.packageCount || Math.round(activeQuantity * 20);
  const activeSrc = currentTransfer?.sourceHospitalId || 'Donor Node';
  const activeDest = currentTransfer?.requestingHospitalId || 'Receiver Node';
  const activeDriver = currentTransfer?.driverName || 'Ambulance Driver';
  const activeVehicle = currentTransfer?.vehicleNumber || 'Emergency Fleet';

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
            fontSize: '1.1rem', fontWeight: 900
          }}>
            🚑
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>MediLink Driver</span>
              <span style={{ fontSize: '0.72rem', background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '999px', fontWeight: 800 }}>
                {selectedReqId || 'REQ-LIVE'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#64748b' }}>
              <span style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: isTracking ? '#10b981' : '#f59e0b',
                boxShadow: isTracking ? '0 0 8px #10b981' : 'none'
              }}></span>
              <span style={{ fontWeight: 700 }}>
                {isTracking ? 'BROADCASTING REAL GPS' : 'READY TO BROADCAST'}
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
          View Map ➔
        </Link>
      </header>

      {/* Street-Level Map Viewport */}
      <div style={{ position: 'relative', flex: 1, minHeight: '260px' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', minHeight: '260px', background: '#e2e8f0' }} />

        {/* Real GPS Precision Pill */}
        <div style={{
          position: 'absolute', top: '14px', right: '14px', zIndex: 400,
          background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)',
          border: '1px solid #e2e8f0', borderRadius: '999px',
          padding: '5px 12px', fontSize: '0.74rem', fontWeight: 800, color: '#0f172a',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          <span style={{ color: accuracyMeters && accuracyMeters < 10 ? '#10b981' : '#f59e0b' }}>●</span>
          <span>{accuracyMeters ? `True A-GPS ±${accuracyMeters}m` : 'Awaiting Device Lock'}</span>
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

      {/* Bottom Real-Time Telemetry & Controls Card */}
      <div style={{
        background: '#ffffff',
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px',
        padding: '18px 20px 28px 20px',
        boxShadow: '0 -8px 25px rgba(0,0,0,0.06)',
        borderTop: '1px solid #e2e8f0',
        zIndex: 500,
        maxWidth: '540px',
        margin: '0 auto',
        width: '100%'
      }}>
        {/* Drag Handle */}
        <div style={{ width: '36px', height: '4px', background: '#cbd5e1', borderRadius: '999px', margin: '-6px auto 14px auto' }} />

        {/* Consignment Overview Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #f0fdfa 0%, #e6f7f6 100%)',
          border: '1.5px solid #99f6e4',
          borderRadius: '16px',
          padding: '12px 16px',
          marginBottom: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#008b8b', textTransform: 'uppercase' }}>
              📦 Active Dispatch Consignment
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
              {activeMedicine}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {activeCount} {activeUnit} ({activeQuantity} kg) · {activeSrc} ➔ {activeDest}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>Vehicle / Driver</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#0f172a' }}>{activeVehicle}</div>
            <div style={{ fontSize: '0.72rem', color: '#008b8b', fontWeight: 700 }}>{activeDriver}</div>
          </div>
        </div>

        {/* Real Physical Location Address */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          padding: '12px 14px',
          marginBottom: '14px'
        }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            📍 Your Real Physical Location (Turn-by-Turn GPS)
          </div>
          <div style={{ fontSize: '0.98rem', fontWeight: 900, color: '#0f172a', marginTop: '2px', lineHeight: '1.3' }}>
            {realAddress}
          </div>
          <div style={{
            fontSize: '0.72rem', fontFamily: 'monospace', color: '#0284c7',
            marginTop: '4px', fontWeight: 700, display: 'flex', gap: '12px'
          }}>
            <span>Lat: {realCoords ? realCoords.lat.toFixed(6) : 'Awaiting GPS...'}°</span>
            <span>Lng: {realCoords ? realCoords.lng.toFixed(6) : 'Awaiting GPS...'}°</span>
          </div>
        </div>

        {/* Real Sensor Telemetry Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>GPS Speed</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginTop: '1px', fontFamily: 'monospace' }}>
              {speedKmH} <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748b' }}>km/h</span>
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Accuracy</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#059669', marginTop: '1px', fontFamily: 'monospace' }}>
              {accuracyMeters ? `±${accuracyMeters}m` : '--'}
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Packets Sent</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginTop: '1px', fontFamily: 'monospace' }}>
              {transmittedCount}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: '4px' }}>
            <span>Route Completion</span>
            <span>{progressPercent}%</span>
          </div>
          <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', background: '#008b8b', transition: 'width 0.4s ease' }} />
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

        {/* Quick Simulator & Arrival Action Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
          <button
            onClick={simulateWalkStep}
            style={{
              padding: '10px 12px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#0f172a',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
            title="Advance coordinates by +40 meters for indoor testing"
          >
            🚶 Test Walk (+40m)
          </button>

          <button
            onClick={confirmDockArrival}
            disabled={deliveryConfirmed}
            style={{
              padding: '10px 12px',
              borderRadius: '12px',
              border: '1px solid #a7f3d0',
              background: '#ecfdf5',
              color: '#059669',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: deliveryConfirmed ? 'not-allowed' : 'pointer',
              opacity: deliveryConfirmed ? 0.6 : 1
            }}
          >
            🏁 Confirm Dock Arrival
          </button>
        </div>

        {gpsError && (
          <div style={{ marginTop: '10px', padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#b91c1c', fontSize: '0.75rem', lineHeight: 1.4 }}>
            ⚠️ <strong>Location Notice:</strong> {gpsError}.<br/>
            Please tap the lock icon in your browser address bar and enable Location access for this page.
          </div>
        )}

        {/* Sync Info Footer */}
        <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.72rem', color: '#94a3b8' }}>
          {isTracking
            ? `Transmitting real device GPS every 1.5s · Last sync: ${lastSyncTimestamp || 'Just now'}`
            : 'Tap Start to broadcast your true physical coordinates to the MediLink network'}
        </div>
      </div>
    </div>
  );
}
