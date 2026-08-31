"use client";
import React, { useState, useEffect } from 'react';
import { authApi } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const demoAccounts = [
    { roleKey: 'admin', email: 'admin@medilink.ai', pass: 'admin123' },
    { roleKey: 'nurse', email: 'nurse@h01.medilink.ai', pass: 'nurse123' },
    { roleKey: 'supervisor-req', email: 'supervisor@h01.medilink.ai', pass: 'super123' },
    { roleKey: 'supervisor-src', email: 'supervisor@h02.medilink.ai', pass: 'super123' },
    { roleKey: 'pharmacist', email: 'pharmacist@h02.medilink.ai', pass: 'pharm123' },
  ];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const role = params.get('role');
      const paramEmail = params.get('email');
      const paramPass = params.get('pass');

      // If URL params exist (user clicked a portal card), pre-fill credentials
      if (paramEmail) {
        setEmail(paramEmail);
        if (paramPass) setPassword(paramPass);
      } else if (role) {
        const match = demoAccounts.find(a => a.roleKey === role);
        if (match) {
          setEmail(match.email);
          setPassword(match.pass);
        }
      } else {
        // Fresh visit: clear input fields
        setEmail('');
        setPassword('');
      }
    }
  }, []);

  const redirectByRole = (role) => {
    const r = {
      NETWORK_ADMIN: '/admin',
      CLINICAL_VIEWER: '/clinical',
      REQUESTING_SUPERVISOR: '/supervisor-req',
      SOURCE_SUPERVISOR: '/supervisor-src',
      DISPATCH_PHARMACIST: '/pharmacist'
    };
    window.location.href = r[role] || '/';
  };

  const executeLogin = async (e, p) => {
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(e, p);
      localStorage.setItem('medilink_token', res.token);
      localStorage.setItem('medilink_user', JSON.stringify(res.user));
      redirectByRole(res.user.role);
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (ev) => {
    ev.preventDefault();
    executeLogin(email, password);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f8f8', padding: '32px 20px', position: 'relative' }}>
      
      {/* Background ambient radial highlight */}
      <div style={{
        position: 'absolute', width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(0, 139, 139, 0.08) 0%, rgba(244, 248, 248, 0) 70%)',
        borderRadius: '50%', pointerEvents: 'none'
      }} />

      <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1 }}>

        {/* Back */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <a href="/" style={{ fontSize: '0.86rem', fontWeight: 700, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '8px', transition: 'color 0.2s ease' }} onMouseEnter={e => e.target.style.color = '#008b8b'} onMouseLeave={e => e.target.style.color = '#64748b'}>
            <i className="fa-solid fa-arrow-left"></i> Back to Home
          </a>
        </div>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img src="/medilink-logo-transparent.png" alt="MediLink" style={{ height: '58px', width: 'auto', objectFit: 'contain', marginBottom: '12px' }} />
          <p style={{ fontSize: '0.92rem', color: '#64748b', margin: 0, fontWeight: 600 }}>Zero-Stockout Healthcare Network</p>
        </div>

        {/* Login Card */}
        <div className="card" style={{ padding: '36px', borderRadius: '24px', border: '1.5px solid #d1e5e3', boxShadow: '0 12px 35px rgba(0, 139, 139, 0.07)' }}>
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Sign In to Station</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0' }}>Enter your official workstation email and password</p>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: '14px', fontSize: '0.84rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
              <i className="fa-solid fa-circle-exclamation"></i> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label">Email Address</label>
              <input type="email" className="form-input" placeholder="supervisor@h01.medilink.ai" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Password</label>
              <input type="password" className="form-input" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '13px', fontWeight: 800, borderRadius: '9999px', fontSize: '0.92rem' }} disabled={loading}>
              {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-right-to-bracket"></i>} Sign In
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

