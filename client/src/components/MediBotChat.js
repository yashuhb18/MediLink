"use client";
import React, { useState, useEffect, useRef } from 'react';
import { aiApi } from '@/lib/api';

export default function MediBotChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: "Hello Doctor/Supervisor! I am **MediBot**, powered by your local **GLM-4** model. I monitor real-time medicine load-cell weights, predict hospital stockouts, and rank inter-hospital donor transfers.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [modelStatus, setModelStatus] = useState({ online: true, model: 'glm4' });
  const [userContext, setUserContext] = useState({ hospitalId: 'H01', role: 'SUPERVISOR' });
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Check if user is logged in
    try {
      const userStr = localStorage.getItem('medilink_user');
      if (userStr) {
        const u = JSON.parse(userStr);
        setUserContext({ hospitalId: u.hospitalId || 'H01', role: u.role || 'SUPERVISOR' });
      }
    } catch (e) {}

    // Check GLM-4 model status
    aiApi.getStatus()
      .then(res => setModelStatus(res))
      .catch(() => setModelStatus({ online: false, model: 'glm4 (offline)' }));
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    const userMsg = {
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const res = await aiApi.chat(query, userContext.hospitalId, userContext.role);
      const botMsg = {
        sender: 'bot',
        text: res.reply || "I processed your request with current clinical data.",
        model: res.model || 'glm4',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      const errMsg = {
        sender: 'bot',
        text: `⚠️ Error reaching local GLM-4 model: ${err.message || 'Connection timeout'}. Please verify Ollama is running on 127.0.0.1:11434.`,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    "🔮 Predict next 5-hour stockout risk",
    "🏥 Find nearest donor hospital for Paracetamol",
    "📊 Explain current medicine burn rates",
    "⚖️ How does Nash Game-Theory Karma work?"
  ];

  return (
    <>
      {/* Floating Launcher Trigger */}
      {!isOpen && (
        <button
          id="medibot-launcher"
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 22px',
            borderRadius: '9999px',
            background: 'linear-gradient(135deg, #008b8b 0%, #005f5f 100%)',
            color: '#ffffff',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 12px 30px rgba(0, 139, 139, 0.4), 0 4px 12px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.92rem',
            transition: 'all 0.25s ease',
            transform: 'scale(1)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <span style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: '#ffffff',
            color: '#008b8b',
            fontSize: '0.85rem'
          }}>
            <i className="fa-solid fa-brain"></i>
          </span>
          <span>Ask MediBot AI</span>
          <span style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: modelStatus.online ? '#10b981' : '#f59e0b',
            boxShadow: modelStatus.online ? '0 0 8px #10b981' : 'none'
          }} />
        </button>
      )}

      {/* Interactive Chat Window */}
      {isOpen && (
        <div
          id="medibot-modal"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: 'min(420px, calc(100vw - 32px))',
            height: 'min(600px, calc(100vh - 48px))',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '24px',
            backgroundColor: '#ffffff',
            boxShadow: '0 25px 60px -15px rgba(0, 50, 50, 0.35), 0 0 0 1px rgba(0, 139, 139, 0.15)',
            overflow: 'hidden',
            animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #008b8b 0%, #006666 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.15rem'
              }}>
                🤖
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  MediBot AI
                  <span style={{
                    fontSize: '0.68rem',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(255, 255, 255, 0.25)',
                    fontWeight: 600
                  }}>
                    GLM-4 Local
                  </span>
                </div>
                <div style={{ fontSize: '0.74rem', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: modelStatus.online ? '#4ade80' : '#fbbf24'
                  }} />
                  {modelStatus.online ? '127.0.0.1:11434 Live' : 'Connecting to local GLM...'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setMessages([{ sender: 'bot', text: 'Chat cleared. How can I assist with hospital inventory and predictions?', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }])}
                title="Clear Chat"
                style={{ background: 'transparent', border: 'none', color: '#ffffff', opacity: 0.8, cursor: 'pointer', padding: '6px', fontSize: '0.85rem' }}
              >
                <i className="fa-solid fa-rotate-left"></i>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', padding: '6px', fontSize: '1.1rem' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          {/* Quick Action Suggestion Bar */}
          <div style={{
            padding: '10px 14px',
            background: '#f8fafc',
            borderBottom: '1px solid #edf2f7',
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            scrollbarWidth: 'none'
          }}>
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(qp)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '999px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#008b8b'; e.currentTarget.style.color = '#008b8b'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#334155'; }}
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Chat Messages Stream */}
          <div style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            background: '#fcfdfd'
          }}>
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: m.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
                  alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div style={{
                  padding: '12px 16px',
                  borderRadius: m.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: m.sender === 'user'
                    ? 'linear-gradient(135deg, #008b8b 0%, #006e6e 100%)'
                    : m.isError ? '#fef2f2' : '#ffffff',
                  color: m.sender === 'user' ? '#ffffff' : m.isError ? '#991b1b' : '#1e293b',
                  fontSize: '0.88rem',
                  lineHeight: 1.55,
                  boxShadow: m.sender === 'user'
                    ? '0 4px 12px rgba(0, 139, 139, 0.25)'
                    : '0 2px 8px rgba(0, 0, 0, 0.06)',
                  border: m.sender === 'user' ? 'none' : m.isError ? '1px solid #fecaca' : '1px solid #e2e8f0',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap'
                }}>
                  {m.text}
                </div>
                <div style={{
                  fontSize: '0.68rem',
                  color: '#94a3b8',
                  marginTop: '4px',
                  paddingLeft: '4px',
                  paddingRight: '4px',
                  display: 'flex',
                  gap: '6px'
                }}>
                  <span>{m.timestamp}</span>
                  {m.model && <span style={{ color: '#008b8b', fontWeight: 600 }}>• {m.model}</span>}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: '#f1f5f9', borderRadius: '12px', width: 'fit-content' }}>
                <span className="pulse-dot" style={{ width: '8px', height: '8px' }} />
                <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
                  GLM-4 is analyzing live telemetry...
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            style={{
              padding: '12px 14px',
              borderTop: '1px solid #e2e8f0',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <input
              type="text"
              placeholder="Ask about shortages, telemetry, transfers..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.86rem',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#008b8b'}
              onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                border: 'none',
                background: input.trim() ? '#008b8b' : '#94a3b8',
                color: '#ffffff',
                cursor: input.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.95rem',
                transition: 'background-color 0.2s'
              }}
            >
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
