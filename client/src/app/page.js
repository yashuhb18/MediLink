"use client";
import React, { useState, useEffect, useRef } from 'react';
import InteractiveLifelineFlow from '../components/InteractiveLifelineFlow';

export default function UniversalLandingPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Video showcase state & scroll autoplay observer
  const videoRef = useRef(null);
  const videoSectionRef = useRef(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState('0:00');
  const [videoDuration, setVideoDuration] = useState('0:00');
  const [isVideoInView, setIsVideoInView] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Interactive Live Hardware Sandbox State
  const [sandboxTab, setSandboxTab] = useState('duallock'); // 'duallock' | 'telemetry' | 'mesh' | 'camera'
  const [barcodeScanned, setBarcodeScanned] = useState(false);
  const [rfidTapped, setRfidTapped] = useState(false);
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  const [isTappingRfid, setIsTappingRfid] = useState(false);
  const [simulatedWeight, setSimulatedWeight] = useState(0.85); // in kg
  const [meshTransitStep, setMeshTransitStep] = useState(0); // 0: Idle, 1: En Route, 2: Delivered
  const [capturedCamImages, setCapturedCamImages] = useState([]);
  const [isLoadingCamImages, setIsLoadingCamImages] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState('');

  const fetchCamImages = async () => {
    setIsLoadingCamImages(true);
    try {
      const res = await fetch('http://localhost:5000/api/iot/images');
      if (res.ok) {
        const data = await res.json();
        if (data.images) setCapturedCamImages(data.images);
      }
    } catch (e) {
      console.log('Using local fallback for images:', e);
    } finally {
      setIsLoadingCamImages(false);
    }
  };

  useEffect(() => {
    fetchCamImages();
  }, []);

  const handleTestUpload = async () => {
    setUploadStatusMsg('Uploading sample frame to MongoDB Atlas...');
    try {
      const sampleB64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAMElEQVR4nO3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOBgB14AATGfF1AAAAAASUVORK5CYII=";
      const res = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_data: sampleB64, source: "ESP32-CAM" })
      });
      if (res.ok) {
        setUploadStatusMsg('✅ Uploaded to MongoDB Atlas successfully!');
        fetchCamImages();
      } else {
        setUploadStatusMsg('🔴 Upload failed');
      }
    } catch (err) {
      setUploadStatusMsg('🔴 Upload error: ' + err.message);
    }
    setTimeout(() => setUploadStatusMsg(''), 3500);
  };

  const handleTriggerBarcodeScan = () => {
    setIsScanningBarcode(true);
    setTimeout(() => {
      setBarcodeScanned(true);
      setIsScanningBarcode(false);
    }, 600);
  };

  const handleTriggerRfidScan = () => {
    setIsTappingRfid(true);
    setTimeout(() => {
      setRfidTapped(true);
      setIsTappingRfid(false);
    }, 600);
  };

  const handleResetDualLock = () => {
    setBarcodeScanned(false);
    setRfidTapped(false);
  };

  const handleTriggerDualPassBoth = () => {
    setIsScanningBarcode(true);
    setIsTappingRfid(true);
    setTimeout(() => {
      setBarcodeScanned(true);
      setRfidTapped(true);
      setIsScanningBarcode(false);
      setIsTappingRfid(false);
    }, 600);
  };

  const handleSimulateMeshDispatch = () => {
    setMeshTransitStep(1);
    setTimeout(() => {
      setMeshTransitStep(2);
    }, 1600);
  };

  useEffect(() => {
    const vid = videoRef.current;
    const sec = videoSectionRef.current;
    if (!sec || !vid) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVideoInView(true);
            const playPromise = vid.play();
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  setIsVideoPlaying(true);
                })
                .catch((err) => {
                  console.log("Autoplay preview notice:", err);
                });
            }
          } else {
            setIsVideoInView(false);
            vid.pause();
            setIsVideoPlaying(false);
          }
        });
      },
      {
        threshold: 0.2,
        rootMargin: "0px 0px -30px 0px"
      }
    );

    observer.observe(sec);
    return () => {
      if (sec) observer.unobserve(sec);
    };
  }, []);

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 1;
    setVideoProgress((current / dur) * 100);

    const formatTime = (timeInSeconds) => {
      if (isNaN(timeInSeconds)) return '0:00';
      const mins = Math.floor(timeInSeconds / 60);
      const secs = Math.floor(timeInSeconds % 60);
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    setVideoCurrentTime(formatTime(current));
    if (videoRef.current.duration) {
      setVideoDuration(formatTime(videoRef.current.duration));
    }
  };

  const handleVideoLoadedMetadata = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration || 0;
    const mins = Math.floor(dur / 60);
    const secs = Math.floor(dur % 60);
    setVideoDuration(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
  };

  const toggleVideoPlay = () => {
    if (!videoRef.current) return;
    if (isVideoPlaying) {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    } else {
      videoRef.current.play();
      setIsVideoPlaying(true);
    }
    setHasInteracted(true);
  };

  const toggleVideoMute = () => {
    if (!videoRef.current) return;
    const nextMute = !isVideoMuted;
    videoRef.current.muted = nextMute;
    setIsVideoMuted(nextMute);
    setHasInteracted(true);
  };

  const handleVideoSeek = (e) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = pos * (videoRef.current.duration || 0);
    videoRef.current.currentTime = targetTime;
    setVideoProgress(pos * 100);
    setHasInteracted(true);
  };

  const toggleVideoFullscreen = () => {
    const el = document.getElementById('medilink-video-container');
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(console.error);
    } else {
      document.exitFullscreen?.().catch(console.error);
    }
  };

  const restartVideo = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play();
    setIsVideoPlaying(true);
    setHasInteracted(true);
  };

  const heroSlides = [
    {
      src: '/real-doctor-hero.png',
      alt: 'MediLink Doctor Command Center',
      tag: 'Hospital Network Command',
      icon: 'fa-user-doctor'
    },
    {
      src: '/hero-2.webp',
      alt: 'Smart Medical Telemetry',
      tag: 'Smart Medical Telemetry',
      icon: 'fa-laptop-medical'
    },
    {
      src: '/hero-3.webp',
      alt: 'Automated Pharmacy Inventory',
      tag: 'Automated Pharmacy Inventory',
      icon: 'fa-pills'
    },
    {
      src: '/hero-4.webp',
      alt: 'AI Shortage Forecasting',
      tag: 'AI Shortage Forecasting',
      icon: 'fa-brain'
    },
    {
      src: '/hero-5.webp',
      alt: 'IoT Dual-Lock Hardware Station',
      tag: 'IoT Dual-Lock Hardware Station',
      icon: 'fa-barcode'
    },
    {
      src: '/hero-6.webp',
      alt: 'Regional Node Routing',
      tag: 'Regional Node Routing',
      icon: 'fa-network-wired'
    },
    {
      src: '/hero-7.webp',
      alt: 'Clinical Supervisor Approval',
      tag: 'Clinical Supervisor Approval',
      icon: 'fa-signature'
    },
    {
      src: '/hero-8.webp',
      alt: 'Real-time Cold-Chain Dispatch',
      tag: 'Real-time Cold-Chain Dispatch',
      icon: 'fa-truck-medical'
    },
    {
      src: '/hero-9.webp',
      alt: 'Hospital Mesh Network',
      tag: 'Hospital Mesh Network',
      icon: 'fa-hospital'
    },
    {
      src: '/hero-10.webp',
      alt: 'Karma Reputation System',
      tag: 'Karma Reputation System',
      icon: 'fa-award'
    },
  ];

  // Auto-rotate hero photos every 1 second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 1000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  const handleStepChange = (newIdx) => {
    if (newIdx === activeStep) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveStep(newIdx);
      setIsTransitioning(false);
    }, 120);
  };

  const demoAccounts = [
    { roleKey: 'admin', role: 'Network Admin', email: 'admin@medilink.ai', pass: 'admin123', icon: 'fa-user-shield', desc: 'Global supply chain command matrix, regional heatmap, and emergency override console.', status: 'Command Level' },
    { roleKey: 'nurse', role: 'Clinical Viewer', email: 'nurse@h01.medilink.ai', pass: 'nurse123', icon: 'fa-magnifying-glass', desc: 'Read-only regional medicine availability directory and stock inquiry system.', status: 'Read Only' },
    { roleKey: 'supervisor-req', role: 'Requesting Supervisor', email: 'supervisor@h01.medilink.ai', pass: 'super123', icon: 'fa-paper-plane', desc: 'AI shortage predictions tray and emergency redistribution request triggers.', status: 'Node H01 Lead' },
    { roleKey: 'supervisor-src', role: 'Source Supervisor', email: 'supervisor@h02.medilink.ai', pass: 'super123', icon: 'fa-boxes-packing', desc: 'Donor priority queue review and Good Samaritan Karma reputation tracker.', status: 'Node H02 Lead' },
    { roleKey: 'pharmacist', role: 'Dispatch Pharmacist', email: 'pharmacist@h02.medilink.ai', pass: 'pharm123', icon: 'fa-truck-ramp-box', desc: 'Dual RFID + Barcode Scanner physical workstation verification station.', status: 'Hardware Station' },
  ];

  const flowSteps = [
    {
      step: 1,
      shortTitle: 'AI Prediction',
      badge: 'STAGE 01: PREDICTIVE TELEMETRY',
      title: 'AI Time-Traveler Shortage Forecast',
      subtitle: 'Predicts medicine shortages 5 hours before stockout',
      desc: 'MediLink continuously ingests real-time pharmacy load-cell telemetry. At 14:00, the AI Time-Traveler detects Paracetamol dropping at 0.22 kg/hr at Mysore Node H01 and predicts a zero-stock event in 4.5 hours.',
      icon: 'fa-brain',
      tag: 'AUTOMATED AI ALERT',
      tagColor: '#008b8b',
      tiles: [
        { label: 'Telemetry Source', val: 'Mysore Pharmacy (H01)', icon: 'fa-scale-balanced', highlight: false },
        { label: 'Consumption Velocity', val: '-0.22 kg / hr', icon: 'fa-chart-line', highlight: true },
        { label: 'Current Stock Level', val: '1.00 kg (Critical)', icon: 'fa-triangle-exclamation', highlight: true },
        { label: 'Stockout Horizon', val: '4.5 Hours Remaining', icon: 'fa-clock', highlight: false }
      ]
    },
    {
      step: 2,
      shortTitle: 'Donor Matching',
      badge: 'STAGE 02: GAME THEORY MATCHING',
      title: 'Karma Market Multi-Node Matching',
      subtitle: 'Ranks neighboring donor hospitals by proximity & trust',
      desc: 'The Karma Engine evaluates 3 regional nodes based on road distance, surplus stock, and historical donation reliability. Bangalore Central Hospital (H02) is selected with Karma Score 78/100.',
      icon: 'fa-award',
      tag: 'NASH EQUILIBRIUM MATCH',
      tagColor: '#008b8b',
      tiles: [
        { label: 'Optimal Donor', val: 'Bangalore Central (H02)', icon: 'fa-hospital', highlight: true },
        { label: 'Donor Karma Score', val: '78 / 100 (Tier A)', icon: 'fa-award', highlight: false },
        { label: 'Available Surplus', val: '14.50 kg Available', icon: 'fa-boxes-stacked', highlight: false },
        { label: 'Transit Distance', val: '140 km (~2.2 hrs)', icon: 'fa-route', highlight: false }
      ]
    },
    {
      step: 3,
      shortTitle: 'Clinical Approval',
      badge: 'STAGE 03: DIGITAL AUTHORIZATION',
      title: '1-Click Cryptographic Supervisor Approval',
      subtitle: 'Encrypted clinical workflow with digital signature',
      desc: 'An automated emergency dispatch order (REQ-1001) is routed to Clinical Supervisor Dr. Sarah Chen. She reviews the AI justification and authorizes with a single click.',
      icon: 'fa-signature',
      tag: 'APPROVED BY DR. SARAH CHEN',
      tagColor: '#10b981',
      tiles: [
        { label: 'Emergency Request ID', val: 'REQ-1001 (Priority)', icon: 'fa-hashtag', highlight: false },
        { label: 'Authorized Officer', val: 'Dr. Sarah Chen (CMO)', icon: 'fa-user-doctor', highlight: false },
        { label: 'Allocated Quantity', val: '1.00 kg (Paracetamol)', icon: 'fa-pills', highlight: false },
        { label: 'Approval Speed', val: '< 45 Seconds Latency', icon: 'fa-bolt', highlight: true }
      ]
    },
    {
      step: 4,
      shortTitle: 'Dual-Lock Verify',
      badge: 'STAGE 04: HARDWARE DUAL-LOCK',
      title: 'RFID + Laser Barcode Scanner Station',
      subtitle: 'Hardware-enforced physical dispatch verification',
      desc: 'At Bangalore H02 Pharmacy, Dispatch Pharmacist scans the package using the handheld laser Barcode Scanner AND verifies the RFID tag. The ESP32 smart lock unlocks ONLY when both match 100%.',
      icon: 'fa-barcode',
      tag: 'BARCODE + RFID VERIFIED',
      tagColor: '#10b981',
      imageSrc: '/flow-step-barcode.png',
      tiles: [
        { label: 'Laser Barcode UID', val: 'BATCH-PCM-2026-X9', icon: 'fa-barcode', highlight: false },
        { label: 'RFID Tag UID', val: 'E280116060000204', icon: 'fa-id-card', highlight: false },
        { label: 'ESP32 Solenoid', val: 'DISENGAGED (OPEN)', icon: 'fa-lock-open', highlight: true },
        { label: 'Verification Match', val: '100% Dual Pass', icon: 'fa-circle-check', highlight: true }
      ]
    },
    {
      step: 5,
      shortTitle: 'Transit & Karma',
      badge: 'STAGE 05: RECEIPT & REPUTATION',
      title: 'GPS Transit & Good Samaritan Karma Credit',
      subtitle: 'Full chain of custody & instant karma reward',
      desc: 'The medicine dispatch is transported under real-time GPS telemetry. Upon arrival at Mysore Node H01, receiving staff scan the barcode to confirm receipt. +15 Karma Points are awarded to Donor H02!',
      icon: 'fa-truck-fast',
      tag: 'STOCK REPLENISHED & LOGGED',
      tagColor: '#10b981',
      tiles: [
        { label: 'Transit Vehicle', val: 'MED-EXPRESS-04 (GPS)', icon: 'fa-truck', highlight: false },
        { label: 'Receiving Station', val: 'Mysore Node H01', icon: 'fa-location-dot', highlight: false },
        { label: 'Karma Incentive', val: '+15 Points to H02', icon: 'fa-star', highlight: true },
        { label: 'Network Impact', val: 'Zero Stockout Averted', icon: 'fa-shield-heart', highlight: true }
      ]
    },
  ];

  const features = [
    {
      num: '01',
      icon: 'fa-clock-rotate-left',
      badge: 'PREDICTIVE ML',
      title: 'Predictive Time-Traveler',
      desc: 'Predicts exact zero-stock times 5 hours in advance using consumption telemetry velocity & machine learning rate analysis.',
      metric: '5.0h Forecast Window',
      status: 'Live Active'
    },
    {
      num: '02',
      icon: 'fa-award',
      badge: 'GAME THEORY',
      title: 'Karma Market Engine',
      desc: 'Game-theory reputation system ranking donor hospitals by available surplus stock, karma score, and proximity.',
      metric: 'Nash Equilibrium Logic',
      status: 'Auto-Matching'
    },
    {
      num: '03',
      icon: 'fa-scissors',
      badge: 'ORDER SPLITTING',
      title: 'Surgical Bundler',
      desc: 'Splits large emergency orders across multiple donor hospitals when no single source can fulfill the request.',
      metric: 'Multi-Node Sourcing',
      status: 'Instant Optimization'
    },
    {
      num: '04',
      icon: 'fa-shield-halved',
      badge: 'IOT DUAL-LOCK',
      title: 'Fortress Verifier',
      desc: 'Dual-lock verification requiring RFID tag scan AND handheld Barcode Scanner verification before vault unlock.',
      metric: 'ESP32 Solenoid Control',
      status: 'Hardware Synchronized'
    },
    {
      num: '05',
      icon: 'fa-eye',
      badge: 'SENSOR HYGIENE',
      title: 'Guardian Angel',
      desc: 'IoT sensor hygiene monitor detecting telemetry drops and stuck hardware components to trigger maintenance alerts.',
      metric: '<0.02s Telemetry Polling',
      status: 'Self-Healing'
    },
  ];

  return (
    <div style={{ background: '#f4f8f8', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── Top Header Bar ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        height: '78px', background: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1.5px solid #e2efee',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(24px, 5vw, 80px)',
        boxShadow: '0 4px 24px -2px rgba(0, 139, 139, 0.06)',
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', transition: 'transform 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
          <img src="/medilink-logo-transparent.png" alt="MediLink" style={{ height: '54px', width: 'auto', objectFit: 'contain' }} />
        </a>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '32px', fontSize: '0.9rem', fontWeight: 600 }}>
          <a href="#hero" style={{ color: '#008b8b', fontWeight: 700 }}>Home</a>
          <a href="#features" style={{ color: '#334155', transition: 'color 0.2s ease' }} onMouseEnter={e => e.target.style.color = '#008b8b'} onMouseLeave={e => e.target.style.color = '#334155'}>Features</a>
          <a href="#demo-flow" style={{ color: '#334155', transition: 'color 0.2s ease' }} onMouseEnter={e => e.target.style.color = '#008b8b'} onMouseLeave={e => e.target.style.color = '#334155'}>Workflow</a>
          <a href="#portals" style={{ color: '#334155', transition: 'color 0.2s ease' }} onMouseEnter={e => e.target.style.color = '#008b8b'} onMouseLeave={e => e.target.style.color = '#334155'}>User Portals</a>
          <a href="#hardware-demo" style={{ color: '#334155', transition: 'color 0.2s ease' }} onMouseEnter={e => e.target.style.color = '#008b8b'} onMouseLeave={e => e.target.style.color = '#334155'}>Live Demo</a>
        </nav>

        <button className="btn btn-primary" style={{ padding: '9px 24px', borderRadius: '9999px', fontSize: '0.88rem', fontWeight: 700 }} onClick={() => window.location.href = '/login'}>
          Get Started
        </button>
      </header>

      {/* ── Hero Section ── */}
      <section id="hero" style={{
        maxWidth: '1280px', margin: '0 auto',
        minHeight: 'calc(100vh - 72px)',
        padding: '40px 32px 60px',
        display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: '56px', alignItems: 'center',
        position: 'relative'
      }}>
        {/* Subtle background radial ambient light */}
        <div style={{
          position: 'absolute', top: '10%', left: '-10%', width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(0, 139, 139, 0.08) 0%, rgba(244, 248, 248, 0) 70%)',
          borderRadius: '50%', pointerEvents: 'none', zIndex: 0
        }} />

        <div style={{ paddingRight: '12px', zIndex: 1 }}>
          {/* Pill Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '7px 18px', borderRadius: '9999px',
            background: '#e6f7f6', border: '1.5px solid #d1e5e3',
            color: '#008b8b', fontSize: '0.82rem', fontWeight: 800, marginBottom: '24px',
            boxShadow: '0 2px 10px rgba(0, 139, 139, 0.08)',
          }}>
            <i className="fa-solid fa-heart-pulse text-teal" style={{ fontSize: '0.88rem' }}></i>
            Smart Healthcare, Connected Care
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: 'clamp(2.5rem, 3.8vw, 3.5rem)',
            fontWeight: 800,
            lineHeight: 1.16,
            letterSpacing: '-0.035em',
            color: '#0f172a',
            marginBottom: '22px',
          }}>
            Connecting Hospitals. <span style={{ color: '#008b8b', display: 'block', textShadow: '0 2px 20px rgba(0, 139, 139, 0.15)' }}>Empowering Zero Stockouts.</span>
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: '1.08rem',
            color: '#64748b',
            lineHeight: 1.75,
            marginBottom: '36px',
            maxWidth: '560px',
          }}>
            MediLink predicts medicine shortages before stockouts occur, ranks donor hospitals using Game-Theory Karma scores, and verifies physical dispatches with IoT RFID & Scale dual-locks.
          </p>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-primary btn-lg" style={{ padding: '14px 34px', fontSize: '0.98rem', fontWeight: 700 }} onClick={() => window.location.href = '/login'}>
              Get Started <i className="fa-solid fa-arrow-right" style={{ marginLeft: '6px', fontSize: '0.85rem' }}></i>
            </button>
            <a href="#demo-flow" className="btn btn-ghost btn-lg" style={{ padding: '14px 30px', fontSize: '0.98rem', fontWeight: 600 }}>
              <i className="fa-solid fa-circle-play text-teal" style={{ marginRight: '6px' }}></i> See How It Works
            </a>
          </div>

          {/* Micro Telemetry Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '36px', paddingTop: '24px', borderTop: '1px solid #e2efee' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>
              <span className="pulse-dot"></span> 3 Regional Nodes Online
            </div>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#cbd5e1' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>
              <i className="fa-solid fa-shield-halved text-teal"></i> ESP32 Hardware Dual-Lock
            </div>
          </div>
        </div>

        {/* Right Hero Showcase (Auto-rotating 5 realistic photos every 2s) */}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {/* Ambient Lighting Backdrop */}
          <div style={{
            position: 'absolute', inset: '-25px',
            background: 'radial-gradient(circle, rgba(0, 139, 139, 0.2) 0%, rgba(0, 139, 139, 0.05) 55%, rgba(0,0,0,0) 75%)',
            filter: 'blur(35px)', pointerEvents: 'none', zIndex: 0
          }}></div>

          {/* Real Commercial Photograph Rotating Square Container */}
          <div style={{
            position: 'relative', zIndex: 10,
            borderRadius: '30px', overflow: 'hidden',
            boxShadow: '0 25px 60px -12px rgba(0, 139, 139, 0.22), 0 10px 30px -6px rgba(15, 23, 42, 0.08)',
            border: '5px solid #ffffff',
            background: '#0f172a',
            width: '100%',
            maxWidth: '520px',
            aspectRatio: '1 / 1',
          }}>
            {heroSlides.map((slide, idx) => (
              <div
                key={idx}
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: currentSlide === idx ? 1 : 0,
                  transform: currentSlide === idx ? 'scale(1)' : 'scale(1.03)',
                  transition: 'opacity 0.4s ease, transform 0.4s ease',
                  pointerEvents: currentSlide === idx ? 'auto' : 'none'
                }}
              >
                <img
                  src={slide.src}
                  alt={slide.alt}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                {/* Glossy gradient overlay */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(15, 23, 42, 0.65) 100%)',
                  pointerEvents: 'none'
                }}></div>

                {/* Micro Caption Bar inside image */}
                <div style={{
                  position: 'absolute',
                  bottom: '22px',
                  left: '20px',
                  right: '20px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '14px',
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 700
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className={`fa-solid ${slide.icon}`} style={{ color: '#38bdf8' }}></i>
                    <span>{slide.tag}</span>
                  </span>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {heroSlides.map((_, dotIdx) => (
                      <div
                        key={dotIdx}
                        onClick={() => setCurrentSlide(dotIdx)}
                        style={{
                          width: currentSlide === dotIdx ? '16px' : '6px',
                          height: '6px',
                          borderRadius: '9999px',
                          background: currentSlide === dotIdx ? '#008b8b' : 'rgba(255,255,255,0.3)',
                          transition: 'all 0.3s ease',
                          cursor: 'pointer'
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Floating Pill Badge 1: AI Predictions */}
          <div className="animate-float-slow" style={{
            position: 'absolute', top: '25px', left: '-25px', zIndex: 25,
            background: '#ffffff', borderRadius: '9999px', padding: '12px 22px',
            boxShadow: '0 14px 35px rgba(0, 139, 139, 0.2), 0 2px 6px rgba(0,0,0,0.04)',
            border: '1.5px solid #ccfbf1',
            display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem', fontWeight: 800, color: '#008b8b'
          }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e6f7f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-brain" style={{ color: '#008b8b', fontSize: '0.9rem' }}></i>
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>AI Time-Traveler</div>
              <div style={{ color: '#0f172a' }}>5-Hour Stock Forecast</div>
            </div>
          </div>

          {/* Floating Pill Badge 2: ESP32 Hardware */}
          <div className="animate-float-delay" style={{
            position: 'absolute', bottom: '30px', right: '-25px', zIndex: 25,
            background: '#ffffff', borderRadius: '9999px', padding: '12px 22px',
            boxShadow: '0 14px 35px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(0,0,0,0.04)',
            border: '1.5px solid #e2efee',
            display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem', fontWeight: 800, color: '#0f172a'
          }}>
            <span className="pulse-dot"></span>
            <div>
              <div style={{ fontSize: '0.68rem', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.04em' }}>IoT Telemetry</div>
              <div>ESP32 Dual-Lock Active</div>
            </div>
          </div>

        </div>
      </section>

      {/* ── Statistics Section ── */}
      <section style={{ padding: '0 clamp(24px, 5vw, 80px)', margin: '40px 0 80px' }}>
        <div
          style={{
            maxWidth: '1280px', margin: '0 auto',
            background: 'linear-gradient(135deg, #ffffff 0%, #f0fbfb 100%)',
            border: '1.5px solid #d1e5e3', borderRadius: '28px',
            padding: '30px 40px', boxShadow: '0 12px 35px rgba(0, 139, 139, 0.07)',
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '28px',
            alignItems: 'center'
          }}
        >
          <div style={{ borderRight: '1px solid #d1e5e3', paddingRight: '20px' }}>
            <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#0f172a', lineHeight: 1, letterSpacing: '-0.025em' }}>3+</div>
            <div style={{ fontSize: '0.92rem', color: '#008b8b', fontWeight: 700, marginTop: '8px' }}>Connected Hospital Nodes</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>Real-time stock isolation grid</div>
          </div>

          <div style={{ borderRight: '1px solid #d1e5e3', paddingRight: '20px', paddingLeft: '8px' }}>
            <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#0f172a', lineHeight: 1, letterSpacing: '-0.025em' }}>5</div>
            <div style={{ fontSize: '0.92rem', color: '#008b8b', fontWeight: 700, marginTop: '8px' }}>Autonomous AI Engines</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>5-hr predictive forecasting</div>
          </div>

          <div style={{ borderRight: '1px solid #d1e5e3', paddingRight: '20px', paddingLeft: '8px' }}>
            <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#008b8b', lineHeight: 1, letterSpacing: '-0.025em' }}>99.9%</div>
            <div style={{ fontSize: '0.92rem', color: '#008b8b', fontWeight: 700, marginTop: '8px' }}>Zero-Stockout Rate</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>Emergency auto-redistribution</div>
          </div>

          <div style={{ paddingLeft: '8px' }}>
            <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#10b981', lineHeight: 1, letterSpacing: '-0.025em' }}>&lt;0.02s</div>
            <div style={{ fontSize: '0.92rem', color: '#10b981', fontWeight: 700, marginTop: '8px' }}>IoT Telemetry Latency</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>RFID + Barcode dual-lock</div>
          </div>
        </div>
      </section>

      {/* ── The 5 AI Engine Modules ── */}
      <section id="features" style={{ padding: '80px clamp(24px, 5vw, 80px)', background: '#ffffff', borderTop: '1px solid #e2efee', borderBottom: '1px solid #e2efee' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto 52px' }}>
            <span className="badge badge-teal" style={{ marginBottom: '12px', fontSize: '0.78rem', padding: '6px 16px' }}>
              <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: '6px' }}></i> Autonomous Intelligence
            </span>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              The 5 AI Engine Modules
            </h2>
            <p style={{ color: '#64748b', marginTop: '10px', fontSize: '1.02rem' }}>
              Operating 24/7 across all connected regional healthcare nodes.
            </p>
          </div>

          {/* Balanced 3 + 2 Centered Cards Layout */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '28px',
            maxWidth: '1240px',
            margin: '0 auto'
          }}>
            {features.map((f, i) => (
              <div
                key={f.num}
                className="card-spotlight"
                style={{
                  flex: '1 1 calc(33.333% - 28px)',
                  minWidth: '320px',
                  maxWidth: '380px',
                  padding: '36px 30px',
                  background: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '300px',
                  position: 'relative'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
                    <div style={{
                      width: '52px', height: '52px', borderRadius: '16px',
                      background: '#e6f7f6', color: '#008b8b',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.3rem', border: '1.5px solid #cceee9',
                      boxShadow: '0 4px 12px rgba(0, 139, 139, 0.1)'
                    }}>
                      <i className={`fa-solid ${f.icon}`}></i>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 800, color: '#008b8b',
                        background: '#f0fbfb', border: '1.5px solid #ccfbf1',
                        padding: '4px 12px', borderRadius: '9999px', letterSpacing: '0.04em'
                      }}>
                        {f.badge}
                      </span>
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8',
                        background: '#f8fafc', border: '1px solid #e2e8f0',
                        padding: '4px 9px', borderRadius: '8px', fontFamily: 'var(--font-mono)'
                      }}>
                        {f.num}
                      </span>
                    </div>
                  </div>

                  <h4 style={{ fontSize: '1.18rem', fontWeight: 800, color: '#0f172a', marginBottom: '12px', lineHeight: 1.3 }}>
                    {f.title}
                  </h4>
                  <p style={{ fontSize: '0.92rem', color: '#64748b', lineHeight: 1.7, margin: 0 }}>
                    {f.desc}
                  </p>
                </div>

                {/* Telemetry Micro-Footer inside card */}
                <div style={{
                  marginTop: '24px', paddingTop: '16px',
                  borderTop: '1px solid #f1f7f7',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: '0.75rem', fontWeight: 700
                }}>
                  <span style={{ color: '#008b8b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="pulse-dot-teal" style={{ width: '6px', height: '6px' }}></span>
                    {f.metric}
                  </span>
                  <span style={{ color: '#94a3b8' }}>{f.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── State-of-the-Art Interactive Workflow Section ── */}
      <section id="demo-flow" style={{ padding: '90px clamp(24px, 5vw, 80px)', background: 'linear-gradient(180deg, #ffffff 0%, #f4f8f8 100%)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          
          {/* Section Header */}
          <div style={{ textAlign: 'center', maxWidth: '780px', margin: '0 auto 40px' }}>
            <span className="badge badge-teal" style={{ marginBottom: '14px', fontSize: '0.8rem', padding: '6px 18px' }}>
              <i className="fa-solid fa-network-wired" style={{ marginRight: '6px' }}></i> Autonomous Protocol Pipeline
            </span>
            <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em' }}>
              How MediLink Prevents Zero Stockouts
            </h2>
            <p style={{ color: '#64748b', marginTop: '10px', fontSize: '1.05rem', lineHeight: 1.7 }}>
              Explore the interactive emergency simulation below: test live AI depletion triggers, Nash donor selection, clinical seals, and hardware dual-lock verification.
            </p>
          </div>

          {/* Interactive Lifeline Flow Cockpit */}
          <InteractiveLifelineFlow />

        </div>
      </section>

      {/* ── Select Staff Workstation (Portals) ── */}
      <section id="portals" style={{ padding: '80px clamp(24px, 5vw, 80px)', background: '#f4f8f8', borderTop: '1px solid #e2efee' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 48px' }}>
            <span className="badge badge-info" style={{ marginBottom: '12px', fontSize: '0.78rem', padding: '6px 16px' }}>
              <i className="fa-solid fa-users" style={{ marginRight: '6px' }}></i> Role-Based Access
            </span>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              Select Staff Workstation
            </h2>
            <p style={{ color: '#64748b', marginTop: '10px', fontSize: '1.02rem' }}>
              Click any portal below to instantly sign in with demo credentials.
            </p>
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '22px',
            maxWidth: '1280px',
            margin: '0 auto'
          }}>
            {demoAccounts.map(p => (
              <div
                key={p.roleKey}
                className="card card-interactive"
                style={{
                  flex: '1 1 calc(20% - 22px)',
                  minWidth: '220px',
                  maxWidth: '245px',
                  padding: '28px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: '1.5px solid #e2efee',
                  borderRadius: '24px'
                }}
                onClick={() => window.location.href = `/login?role=${p.roleKey}&email=${encodeURIComponent(p.email)}&pass=${encodeURIComponent(p.pass)}`}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
                    <div style={{
                      width: '46px', height: '46px', borderRadius: '14px',
                      background: '#e6f7f6', color: '#008b8b',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
                      border: '1.5px solid #cceee9',
                      transition: 'transform 0.2s ease',
                    }}>
                      <i className={`fa-solid ${p.icon}`}></i>
                    </div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#10b981', background: '#ecfdf5', border: '1px solid #d1fae5', padding: '3px 8px', borderRadius: '9999px' }}>
                      ● {p.status}
                    </span>
                  </div>

                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>{p.role}</h4>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.6, marginBottom: '18px' }}>{p.desc}</p>
                </div>

                <div>
                  <div style={{
                    fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: '#008b8b', fontWeight: 700,
                    background: '#f8fafb', padding: '6px 10px', borderRadius: '8px',
                    border: '1px solid #e2efee', marginBottom: '14px', wordBreak: 'break-all'
                  }}>
                    {p.email}
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ width: '100%', fontWeight: 700, borderRadius: '9999px', padding: '8px 16px' }}>
                    Sign In <i className="fa-solid fa-arrow-right" style={{ marginLeft: '6px', fontSize: '0.75rem' }}></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live Physical Hardware & IoT Video Showcase ── */}
      <section
        id="hardware-demo"
        ref={videoSectionRef}
        style={{
          padding: '90px clamp(24px, 5vw, 80px) 100px',
          background: '#f4f8f8',
          position: 'relative',
          overflow: 'hidden',
          borderTop: '1px solid #e2efee',
        }}
      >
        {/* Subtle Ambient Radial Light */}
        <div style={{
          position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
          width: '700px', height: '400px',
          background: 'radial-gradient(circle, rgba(0, 139, 139, 0.06) 0%, rgba(244, 248, 248, 0) 70%)',
          borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
        }} />

        <div style={{ maxWidth: '1280px', margin: '0 auto', position: 'relative', zIndex: 1 }}>

          {/* Section Header */}
          <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 48px' }}>
            <span className="showcase-badge" style={{ marginBottom: '14px' }}>
              <i className="fa-solid fa-circle-play" style={{ color: '#008b8b', fontSize: '0.85rem' }}></i>
              Live Physical Demonstration & Telemetry
            </span>

            <h2 style={{
              fontSize: 'clamp(2.2rem, 3.8vw, 2.8rem)',
              fontWeight: 800,
              letterSpacing: '-0.025em',
              color: '#0f172a',
              marginBottom: '14px',
            }}>
              Physical Hardware Verification in Action
            </h2>

            <p style={{
              color: '#64748b',
              fontSize: '1.05rem',
              lineHeight: 1.7,
              maxWidth: '660px',
              margin: '0 auto',
            }}>
              Watch MediLink’s live physical testbench: automated load-cell telemetry streaming, laser barcode dual-lock scanning, and instant hospital redistribution in real time.
            </p>
          </div>

          {/* Video Player Main Stage Frame (Clean Light Aesthetic) */}
          <div
            id="medilink-video-container"
            className="video-showcase-frame"
            style={{
              maxWidth: '1080px',
              margin: '0 auto',
              transform: isVideoInView ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(24px)',
              opacity: isVideoInView ? 1 : 0.4,
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Animated Scanning Line */}
            <div className="video-scanline" />

            {/* Window Header */}
            <div style={{
              background: '#f8fafb',
              padding: '14px 22px',
              borderBottom: '1px solid #e2efee',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ display: 'flex', gap: '7px' }}>
                  <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
                  <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
                  <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                </div>
                <div style={{
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-mono)',
                  color: '#334155',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <i className="fa-solid fa-microchip" style={{ color: '#008b8b' }}></i>
                  <span>ESP32-HARDWARE-STATION-DEMO.MP4</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: isVideoPlaying ? '#ecfdf5' : '#fffbeb',
                  border: `1px solid ${isVideoPlaying ? '#d1fae5' : '#fef3c7'}`,
                  padding: '3px 12px',
                  borderRadius: '9999px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: isVideoPlaying ? '#10b981' : '#f59e0b',
                  fontFamily: 'var(--font-mono)',
                }}>
                  <span className="pulse-dot" style={{
                    width: '6px',
                    height: '6px',
                    background: isVideoPlaying ? '#10b981' : '#f59e0b',
                  }}></span>
                  {isVideoPlaying ? 'AUTO-PLAYING ON SCROLL' : 'PAUSED (SCROLL TO PLAY)'}
                </div>

                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2efee',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  fontSize: '0.7rem',
                  color: '#64748b',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                }}>
                  1080P HD
                </div>
              </div>
            </div>

            {/* Video Container */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                background: '#0a101d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              onClick={toggleVideoPlay}
            >
              <video
                ref={videoRef}
                src="/medilink-showcase.mp4"
                muted={isVideoMuted}
                playsInline
                loop
                preload="auto"
                onTimeUpdate={handleVideoTimeUpdate}
                onLoadedMetadata={handleVideoLoadedMetadata}
                onPlay={() => setIsVideoPlaying(true)}
                onPause={() => setIsVideoPlaying(false)}
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '640px',
                  display: 'block',
                  objectFit: 'contain',
                }}
              />

              {/* Top Left Telemetry Watermark */}
              <div style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                zIndex: 10,
              }}>
                <div style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)',
                  color: '#38bdf8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.25)',
                }}>
                  <i className="fa-solid fa-satellite-dish"></i>
                  <span>LIVE TESTBENCH FEED</span>
                </div>
              </div>

              {/* Top Right Floating Sound Toggle Pill */}
              <div
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  zIndex: 20,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleVideoMute();
                }}
              >
                <button
                  style={{
                    background: isVideoMuted ? '#008b8b' : '#10b981',
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '8px 18px',
                    color: '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: isVideoMuted ? '0 4px 16px rgba(0, 139, 139, 0.4)' : '0 4px 16px rgba(16, 185, 129, 0.5)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {isVideoMuted ? (
                    <>
                      <i className="fa-solid fa-volume-xmark" style={{ color: '#ffffff' }}></i>
                      <span>Click for Sound</span>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', height: '14px' }}>
                        <span className="audio-bar audio-bar-1"></span>
                        <span className="audio-bar audio-bar-2"></span>
                        <span className="audio-bar audio-bar-3"></span>
                        <span className="audio-bar audio-bar-4"></span>
                      </div>
                      <span>Audio Active</span>
                    </>
                  )}
                </button>
              </div>

              {/* Big Center Play/Pause Ripple Button Overlay (Visible when paused) */}
              {!isVideoPlaying && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(15, 23, 42, 0.35)',
                  backdropFilter: 'blur(2px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 12,
                  transition: 'all 0.3s ease',
                }}>
                  <div style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    background: '#008b8b',
                    border: '3px solid #ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '1.5rem',
                    boxShadow: '0 8px 30px rgba(0, 139, 139, 0.5)',
                    transform: 'scale(1)',
                    transition: 'transform 0.2s ease',
                  }}>
                    <i className="fa-solid fa-play" style={{ marginLeft: '4px' }}></i>
                  </div>
                </div>
              )}
            </div>

            {/* Interactive Bottom Control Bar */}
            <div style={{
              background: '#ffffff',
              padding: '14px 22px',
              borderTop: '1px solid #e2efee',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}>
              {/* Interactive Timeline Scrubber */}
              <div
                style={{
                  width: '100%',
                  height: '6px',
                  background: '#e2efee',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onClick={handleVideoSeek}
              >
                <div style={{
                  width: `${videoProgress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #008b8b, #10b981)',
                  borderRadius: '3px',
                  transition: 'width 0.1s linear',
                }} />
              </div>

              {/* Controls & Metrics Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                
                {/* Left Controls: Play/Pause, Replay, Time */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={toggleVideoPlay}
                    style={{
                      background: '#008b8b',
                      border: 'none',
                      borderRadius: '50%',
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      boxShadow: '0 2px 8px rgba(0, 139, 139, 0.25)',
                      transition: 'all 0.15s ease',
                    }}
                    title={isVideoPlaying ? "Pause" : "Play"}
                  >
                    <i className={`fa-solid ${isVideoPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                  </button>

                  <button
                    onClick={restartVideo}
                    style={{
                      background: '#f8fafb',
                      border: '1.5px solid #e2efee',
                      borderRadius: '50%',
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#334155',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                    }}
                    title="Restart Video"
                  >
                    <i className="fa-solid fa-rotate-left"></i>
                  </button>

                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.78rem',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <span style={{ color: '#0f172a', fontWeight: 800 }}>{videoCurrentTime}</span>
                    <span>/</span>
                    <span>{videoDuration}</span>
                  </div>
                </div>

                {/* Right Controls: Mute Toggle, Fullscreen */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={toggleVideoMute}
                    style={{
                      background: isVideoMuted ? '#f8fafb' : '#ecfdf5',
                      border: `1.5px solid ${isVideoMuted ? '#e2efee' : '#d1fae5'}`,
                      borderRadius: '8px',
                      padding: '6px 14px',
                      color: isVideoMuted ? '#64748b' : '#10b981',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <i className={`fa-solid ${isVideoMuted ? 'fa-volume-xmark' : 'fa-volume-high'}`}></i>
                    <span>{isVideoMuted ? 'Muted' : 'Unmuted'}</span>
                  </button>

                  <button
                    onClick={toggleVideoFullscreen}
                    style={{
                      background: '#f8fafb',
                      border: '1.5px solid #e2efee',
                      borderRadius: '8px',
                      padding: '6px 14px',
                      color: '#334155',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <i className="fa-solid fa-expand"></i>
                    <span>Fullscreen</span>
                  </button>
                </div>

              </div>
            </div>

          </div>

          {/* ── Interactive Live Hardware Sandbox (Creative Replacement) ── */}
          <div style={{
            marginTop: '48px',
            background: '#ffffff',
            borderRadius: '24px',
            border: '1.5px solid #e2efee',
            boxShadow: '0 12px 40px -4px rgba(0, 139, 139, 0.1), 0 4px 12px -2px rgba(15, 23, 42, 0.04)',
            overflow: 'hidden',
          }}>
            {/* Sandbox Top Control Bar */}
            <div style={{
              background: '#f8fafb',
              padding: '20px 24px',
              borderBottom: '1.5px solid #e2efee',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span className="pulse-dot" style={{ background: '#10b981' }}></span>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#008b8b', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                    Physical Hardware Sandbox · ESP32 Telemetry
                  </span>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                  Interactive Hardware & Telemetry Simulator
                </h3>
              </div>

              {/* Navigation Tabs */}
              <div style={{
                display: 'flex',
                background: '#e6f7f6',
                padding: '4px',
                borderRadius: '14px',
                border: '1px solid #cceee9',
                gap: '4px',
              }}>
                <button
                  onClick={() => setSandboxTab('duallock')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: sandboxTab === 'duallock' ? '#008b8b' : 'transparent',
                    color: sandboxTab === 'duallock' ? '#ffffff' : '#334155',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <i className="fa-solid fa-barcode"></i>
                  <span>Dual-Lock Station</span>
                </button>

                <button
                  onClick={() => setSandboxTab('telemetry')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: sandboxTab === 'telemetry' ? '#008b8b' : 'transparent',
                    color: sandboxTab === 'telemetry' ? '#ffffff' : '#334155',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <i className="fa-solid fa-scale-balanced"></i>
                  <span>Load Cell Telemetry</span>
                </button>

                <button
                  onClick={() => { setSandboxTab('mesh'); }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: sandboxTab === 'mesh' ? '#008b8b' : 'transparent',
                    color: sandboxTab === 'mesh' ? '#ffffff' : '#334155',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <i className="fa-solid fa-route"></i>
                  <span>Hospital Mesh GPS</span>
                </button>

                <button
                  onClick={() => { setSandboxTab('camera'); fetchCamImages(); }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: sandboxTab === 'camera' ? '#008b8b' : 'transparent',
                    color: sandboxTab === 'camera' ? '#ffffff' : '#334155',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <i className="fa-solid fa-camera"></i>
                  <span>ESP32-CAM Live Feed</span>
                </button>
              </div>
            </div>

            {/* TAB 1: DUAL-LOCK HARDWARE TESTING STATION */}
            {sandboxTab === 'duallock' && (
              <div style={{ padding: '28px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '24px',
                  marginBottom: '24px',
                }}>
                  {/* Step 1: Laser Barcode Scanner */}
                  <div style={{
                    background: barcodeScanned ? '#f0fdf4' : '#f8fafb',
                    border: `1.5px solid ${barcodeScanned ? '#86efac' : '#e2efee'}`,
                    borderRadius: '18px',
                    padding: '22px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: barcodeScanned ? '#dcfce7' : '#e6f7f6', color: barcodeScanned ? '#10b981' : '#008b8b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                            <i className="fa-solid fa-barcode"></i>
                          </div>
                          <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>Step 1: Laser Barcode</span>
                        </div>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 800,
                          padding: '3px 10px', borderRadius: '9999px',
                          background: barcodeScanned ? '#10b981' : '#e2e8f0',
                          color: barcodeScanned ? '#ffffff' : '#64748b',
                        }}>
                          {barcodeScanned ? '✓ SCANNED' : 'PENDING'}
                        </span>
                      </div>

                      {/* Barcode Visual Box */}
                      <div style={{
                        background: '#ffffff',
                        border: '1.5px dashed #cbd5e1',
                        borderRadius: '12px',
                        padding: '16px',
                        textAlign: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                        marginBottom: '16px',
                      }}>
                        {isScanningBarcode && (
                          <div style={{
                            position: 'absolute',
                            left: 0, right: 0,
                            height: '3px',
                            background: '#ef4444',
                            boxShadow: '0 0 10px #ef4444',
                            zIndex: 10,
                          }} className="animate-laser" />
                        )}
                        <div style={{ fontSize: '1.8rem', letterSpacing: '4px', color: '#0f172a', fontFamily: 'monospace', fontWeight: 900 }}>
                          |||| ||| ||||| |||
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                          UID: BATCH-PCM-2026-X9
                        </div>
                      </div>

                      <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5, marginBottom: '16px' }}>
                        {barcodeScanned
                          ? '✅ SHA-256 Hash matched with Clinical Dispatch REQ-1001.'
                          : 'Click below to simulate the handheld physical laser barcode scan.'}
                      </div>
                    </div>

                    <button
                      onClick={handleTriggerBarcodeScan}
                      disabled={isScanningBarcode || barcodeScanned}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '10px',
                        border: 'none',
                        background: barcodeScanned ? '#10b981' : '#008b8b',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: barcodeScanned ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {isScanningBarcode ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin"></i>
                          <span>Scanning Barcode...</span>
                        </>
                      ) : barcodeScanned ? (
                        <>
                          <i className="fa-solid fa-check"></i>
                          <span>Barcode Authenticated</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-bolt"></i>
                          <span>Laser Scan Barcode</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Step 2: RC522 RFID Card */}
                  <div style={{
                    background: rfidTapped ? '#f0fdf4' : '#f8fafb',
                    border: `1.5px solid ${rfidTapped ? '#86efac' : '#e2efee'}`,
                    borderRadius: '18px',
                    padding: '22px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: rfidTapped ? '#dcfce7' : '#e6f7f6', color: rfidTapped ? '#10b981' : '#008b8b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                            <i className="fa-solid fa-id-card"></i>
                          </div>
                          <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>Step 2: RC522 RFID Tag</span>
                        </div>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 800,
                          padding: '3px 10px', borderRadius: '9999px',
                          background: rfidTapped ? '#10b981' : '#e2e8f0',
                          color: rfidTapped ? '#ffffff' : '#64748b',
                        }}>
                          {rfidTapped ? '✓ AUTHENTICATED' : 'PENDING'}
                        </span>
                      </div>

                      {/* RFID Visual Box */}
                      <div style={{
                        background: '#ffffff',
                        border: '1.5px dashed #cbd5e1',
                        borderRadius: '12px',
                        padding: '16px',
                        textAlign: 'center',
                        position: 'relative',
                        marginBottom: '16px',
                      }}>
                        <div style={{
                          width: '42px', height: '42px', borderRadius: '50%',
                          background: rfidTapped ? '#dcfce7' : '#e6f7f6',
                          color: rfidTapped ? '#10b981' : '#008b8b',
                          margin: '0 auto 8px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
                        }} className={isTappingRfid ? 'animate-rfid-pulse' : ''}>
                          <i className="fa-solid fa-wifi"></i>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#0f172a', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                          RFID UID: E280116060000204
                        </div>
                      </div>

                      <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5, marginBottom: '16px' }}>
                        {rfidTapped
                          ? '✅ Container RFID tag validated with physical inventory database.'
                          : 'Click below to tap the encrypted RFID physical container card.'}
                      </div>
                    </div>

                    <button
                      onClick={handleTriggerRfidScan}
                      disabled={isTappingRfid || rfidTapped}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '10px',
                        border: 'none',
                        background: rfidTapped ? '#10b981' : '#008b8b',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: rfidTapped ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {isTappingRfid ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin"></i>
                          <span>Transmitting RFID...</span>
                        </>
                      ) : rfidTapped ? (
                        <>
                          <i className="fa-solid fa-check"></i>
                          <span>RFID Card Verified</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-id-card"></i>
                          <span>Tap RFID Card</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* ESP32 Solenoid Vault Live Status Box */}
                <div style={{
                  background: (barcodeScanned && rfidTapped) ? '#ecfdf5' : '#fffbeb',
                  border: `1.5px solid ${(barcodeScanned && rfidTapped) ? '#a7f3d0' : '#fef3c7'}`,
                  borderRadius: '18px',
                  padding: '20px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                  boxShadow: (barcodeScanned && rfidTapped) ? '0 0 25px rgba(16, 185, 129, 0.2)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '50%',
                      background: (barcodeScanned && rfidTapped) ? '#10b981' : '#f59e0b',
                      color: '#ffffff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
                    }}>
                      <i className={`fa-solid ${(barcodeScanned && rfidTapped) ? 'fa-lock-open' : 'fa-lock'}`}></i>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: (barcodeScanned && rfidTapped) ? '#047857' : '#b45309', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                        ESP32 Solenoid Smart Vault Status
                      </div>
                      <div style={{ fontSize: '1.08rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
                        {(barcodeScanned && rfidTapped)
                          ? 'DISENGAGED (OPEN) — DISPATCH VERIFICATION AUTHORIZED'
                          : `LOCKED — Dual-Lock Required (${Number(barcodeScanned) + Number(rfidTapped)}/2 Keys Scanned)`}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    {!(barcodeScanned && rfidTapped) ? (
                      <button
                        onClick={handleTriggerDualPassBoth}
                        style={{
                          background: '#008b8b',
                          color: '#ffffff',
                          border: 'none',
                          padding: '9px 18px',
                          borderRadius: '10px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                      >
                        <i className="fa-solid fa-wand-magic-sparkles"></i>
                        <span>1-Click Test Dual Pass</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleResetDualLock}
                        style={{
                          background: '#ffffff',
                          color: '#0f172a',
                          border: '1.5px solid #e2efee',
                          padding: '9px 18px',
                          borderRadius: '10px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                      >
                        <i className="fa-solid fa-rotate-left"></i>
                        <span>Reset Tester</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: LIVE LOAD CELL & AI DEPLETION ENGINE */}
            {sandboxTab === 'telemetry' && (
              <div style={{ padding: '28px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1.1fr 0.9fr',
                  gap: '24px',
                }}>
                  {/* Left Column: Interactive Weight Slider */}
                  <div style={{ background: '#f8fafb', border: '1.5px solid #e2efee', borderRadius: '18px', padding: '22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>Simulate Medicine Stock Load Cell</span>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: '1.3rem',
                        color: simulatedWeight < 1.0 ? '#ef4444' : simulatedWeight < 2.0 ? '#f59e0b' : '#10b981',
                      }}>
                        {simulatedWeight.toFixed(2)} kg
                      </span>
                    </div>

                    <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '18px' }}>
                      Drag the weight slider to simulate real-time hospital pharmacy stock depletion:
                    </p>

                    <input
                      type="range"
                      min="0.10"
                      max="4.50"
                      step="0.05"
                      value={simulatedWeight}
                      onChange={(e) => setSimulatedWeight(parseFloat(e.target.value))}
                      style={{ width: '100%', accentColor: '#008b8b', height: '8px', cursor: 'pointer', marginBottom: '20px' }}
                    />

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'var(--font-mono)', marginBottom: '16px' }}>
                      <span>0.10 kg (Empty)</span>
                      <span>1.00 kg (Threshold)</span>
                      <span>4.50 kg (Full Surplus)</span>
                    </div>

                    {/* Dynamic AI Status Card */}
                    <div style={{
                      background: simulatedWeight < 1.0 ? '#fef2f2' : simulatedWeight < 2.0 ? '#fffbeb' : '#ecfdf5',
                      border: `1.5px solid ${simulatedWeight < 1.0 ? '#fecaca' : simulatedWeight < 2.0 ? '#fef3c7' : '#d1fae5'}`,
                      borderRadius: '14px',
                      padding: '16px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <i className={`fa-solid ${simulatedWeight < 1.0 ? 'fa-triangle-exclamation text-red' : 'fa-brain'}`} style={{ color: simulatedWeight < 1.0 ? '#ef4444' : '#008b8b' }}></i>
                        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: simulatedWeight < 1.0 ? '#991b1b' : '#0f172a' }}>
                          {simulatedWeight < 1.0 ? 'CRITICAL STOCKOUT PREDICTION ALERT' : 'AI TELEMETRY VELOCITY NORMAL'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: simulatedWeight < 1.0 ? '#b91c1c' : '#64748b' }}>
                        {simulatedWeight < 1.0
                          ? `At -0.22 kg/hr velocity, zero-stock occurs in ${(simulatedWeight / 0.22).toFixed(1)} hours. Autonomous emergency redistribution triggered!`
                          : `Current stock level is stable. Estimated run-time: ${(simulatedWeight / 0.22).toFixed(1)} hours remaining.`}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Live Simulated Stream Metrics */}
                  <div style={{ background: '#f8fafb', border: '1.5px solid #e2efee', borderRadius: '18px', padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-satellite-dish" style={{ color: '#008b8b' }}></i>
                        <span>Live Sensor Telemetry Bus</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2efee' }}>
                          <span style={{ color: '#64748b' }}>Sensor Hardware:</span>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>HX711 24-bit ADC Load Cell</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2efee' }}>
                          <span style={{ color: '#64748b' }}>Sampling Rate:</span>
                          <span style={{ fontWeight: 700, color: '#008b8b' }}>80 Hz Continuous Stream</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2efee' }}>
                          <span style={{ color: '#64748b' }}>Consumption Velocity:</span>
                          <span style={{ fontWeight: 700, color: '#ef4444' }}>-0.22 kg / hour</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2efee' }}>
                          <span style={{ color: '#64748b' }}>Target Hospital Node:</span>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>Mysore Node H01</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, textAlign: 'center', marginTop: '14px', background: '#ecfdf5', padding: '6px', borderRadius: '6px' }}>
                      ● ESP32 Wi-Fi Telemetry Stream Active (0.01s latency)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: HOSPITAL MESH GPS & KARMA TRACKER */}
            {sandboxTab === 'mesh' && (
              <div style={{ padding: '28px' }}>
                <div style={{ background: '#f8fafb', border: '1.5px solid #e2efee', borderRadius: '18px', padding: '22px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#008b8b', fontWeight: 800, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                        Nash Equilibrium Routing Engine
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                        Emergency Redistribution Route: Bangalore Node H02 ➔ Mysore Node H01
                      </div>
                    </div>
                    <span style={{ background: '#e6f7f6', color: '#008b8b', fontSize: '0.75rem', fontWeight: 800, padding: '4px 12px', borderRadius: '9999px', border: '1px solid #cceee9' }}>
                      Distance: 140 km (~2.2 hrs)
                    </span>
                  </div>

                  {/* Route Progress Visual */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2efee', borderRadius: '14px', padding: '20px', marginBottom: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.9rem', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-hospital text-teal"></i>
                        <span>Bangalore H02 (Donor Node)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-hospital text-emerald"></i>
                        <span>Mysore H01 (Requesting Node)</span>
                      </div>
                    </div>

                    <div style={{ height: '8px', background: '#e2efee', borderRadius: '4px', position: 'relative', margin: '24px 0 12px' }}>
                      <div style={{
                        height: '100%',
                        background: 'linear-gradient(90deg, #008b8b, #10b981)',
                        borderRadius: '4px',
                        width: meshTransitStep === 0 ? '0%' : meshTransitStep === 1 ? '50%' : '100%',
                        transition: 'width 1.2s ease-in-out',
                      }} />
                      <div style={{
                        position: 'absolute',
                        top: '-14px',
                        left: meshTransitStep === 0 ? '0%' : meshTransitStep === 1 ? '50%' : '96%',
                        transform: 'translateX(-50%)',
                        transition: 'left 1.2s ease-in-out',
                        background: '#008b8b',
                        color: '#ffffff',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        boxShadow: '0 2px 8px rgba(0, 139, 139, 0.4)',
                      }}>
                        <i className="fa-solid fa-truck-fast"></i>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                      <span>Dispatched via MED-EXPRESS-04</span>
                      <span>GPS: 12.9716° N, 77.5946° E</span>
                      <span>Recipient Confirmed</span>
                    </div>
                  </div>

                  {/* Karma Settlement Output */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', border: '1px solid #d1fae5' }}>
                        <i className="fa-solid fa-star"></i>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Good Samaritan Karma Reward</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                          {meshTransitStep === 2 ? '✅ +15 Karma Points Awarded to Node H02' : '+15 Karma Points Pending Receipt'}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSimulateMeshDispatch}
                      disabled={meshTransitStep === 1}
                      style={{
                        background: '#008b8b',
                        color: '#ffffff',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '10px',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px',
                      }}
                    >
                      <i className={`fa-solid ${meshTransitStep === 1 ? 'fa-spinner fa-spin' : 'fa-truck-fast'}`}></i>
                      <span>{meshTransitStep === 0 ? 'Trigger Live Transit Simulation' : meshTransitStep === 1 ? 'Transit in Progress...' : 'Re-run Simulation'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: ESP32-CAM LIVE FEED & MONGODB ATLAS VERIFIER */}
            {sandboxTab === 'camera' && (
              <div style={{ padding: '28px' }}>
                <div style={{
                  background: '#f8fafb',
                  border: '1.5px solid #e2efee',
                  borderRadius: '18px',
                  padding: '24px',
                  marginBottom: '20px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className="pulse-dot" style={{ background: '#10b981' }}></span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#008b8b', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                          MongoDB Atlas Cloud Verification · Collection: capturedimages
                        </span>
                      </div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                        Live ESP32-CAM Microcontroller Upload Gallery
                      </h4>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={fetchCamImages}
                        disabled={isLoadingCamImages}
                        style={{
                          background: '#ffffff',
                          color: '#008b8b',
                          border: '1.5px solid #cceee9',
                          padding: '8px 16px',
                          borderRadius: '10px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                      >
                        <i className={`fa-solid fa-rotate ${isLoadingCamImages ? 'fa-spin' : ''}`}></i>
                        <span>Refresh Feed</span>
                      </button>

                      <button
                        onClick={handleTestUpload}
                        style={{
                          background: '#008b8b',
                          color: '#ffffff',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '10px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                      >
                        <i className="fa-solid fa-cloud-arrow-up"></i>
                        <span>Test Upload Frame</span>
                      </button>
                    </div>
                  </div>

                  {uploadStatusMsg && (
                    <div style={{
                      padding: '10px 16px',
                      borderRadius: '10px',
                      background: '#e6f7f6',
                      border: '1px solid #cceee9',
                      color: '#008b8b',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      marginBottom: '18px',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {uploadStatusMsg}
                    </div>
                  )}

                  {/* Images Grid */}
                  {capturedCamImages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px', background: '#ffffff', borderRadius: '14px', border: '1px dashed #cbd5e1' }}>
                      <i className="fa-solid fa-camera" style={{ fontSize: '2rem', color: '#94a3b8', marginBottom: '10px' }}></i>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>No images captured yet</div>
                      <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>
                        Post images to <code style={{ color: '#008b8b' }}>/api/upload</code> or click "Test Upload Frame" above.
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: '20px',
                    }}>
                      {capturedCamImages.map((img, idx) => (
                        <div
                          key={img._id || idx}
                          style={{
                            background: '#ffffff',
                            border: '1.5px solid #e2efee',
                            borderRadius: '16px',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                          }}
                        >
                          {/* Image Thumbnail Preview */}
                          <div style={{
                            width: '100%',
                            height: '180px',
                            borderRadius: '12px',
                            background: '#0f172a',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '14px',
                            border: '1px solid #e2efee',
                          }}>
                            {img.image_data ? (
                              <img
                                src={img.image_data.startsWith('data:') ? img.image_data : `data:image/jpeg;base64,${img.image_data}`}
                                alt="ESP32-CAM Upload"
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                              />
                            ) : (
                              <div style={{ color: '#64748b', fontSize: '0.8rem' }}>No image data</div>
                            )}
                          </div>

                          {/* Metadata */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontWeight: 800, color: '#008b8b', fontSize: '0.85rem' }}>
                                <i className="fa-solid fa-microchip" style={{ marginRight: '6px' }}></i>
                                {img.source || 'ESP32-CAM'}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: '#10b981', background: '#ecfdf5', padding: '2px 8px', borderRadius: '9999px', fontWeight: 700 }}>
                                Stored in Atlas
                              </span>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                              ID: {img._id}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                              Time: {new Date(img.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid #e2efee', padding: '36px clamp(24px, 5vw, 80px)', background: '#ffffff' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', fontSize: '0.88rem', color: '#64748b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/medilink-logo-transparent.png" alt="MediLink" style={{ height: '46px', width: 'auto', objectFit: 'contain' }} />
          </div>
          <div>MediLink AI © 2026. Zero-Stockout Medicine Redistribution Network.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#008b8b', fontWeight: 700, background: '#e6f7f6', padding: '6px 16px', borderRadius: '9999px', border: '1px solid #cceee9' }}>
            <span className="pulse-dot"></span> All 3 Regional Nodes Online
          </div>
        </div>
      </footer>
    </div>
  );
}
