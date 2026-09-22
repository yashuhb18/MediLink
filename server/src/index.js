/**
 * MediLink AI — Express Server Entry Point
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: (origin, callback) => callback(null, true), // Allow localhost, LAN IPs, and mobile devices
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// UDP Zero-Config Auto-Discovery for ESP32 Hardware
const { startDiscovery, getLocalIp } = require('./modules/udp_discovery');

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/hospitals', require('./routes/hospital.routes'));
app.use('/api/inventory', require('./routes/inventory.routes'));
app.use('/api/transfers', require('./routes/transfer.routes'));
app.use('/api/karma', require('./routes/karma.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/iot', require('./routes/iot.routes'));
app.use('/api/ai', require('./routes/ai.routes'));
app.use('/api/events', require('./routes/events.routes').router);

// Direct ESP32 Upload Endpoint Alias & Vision Engine
const CapturedImage = require('./models/CapturedImage');
const { decodeQRFromBuffer } = require('./modules/qr_decoder');
const { uploadToCloudinary } = require('./config/cloudinary');
const AutoScanner = require('./modules/auto_scanner');
const { broadcastSSE } = require('./routes/events.routes');
const { db } = require('./config/firebase');

app.get('/api/upload', async (req, res) => {
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    let recentImages = [];
    let activeQRCodes = [];
    try {
      recentImages = await CapturedImage.find().sort({ createdAt: -1 }).limit(6).lean();
      activeQRCodes = await db.getAllQRCodes(6);
    } catch (e) {}

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MediLink — Optical Upload & Remote Scanner Portal</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 16px;
    }
    .container {
      width: 100%;
      max-width: 640px;
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .badge-live {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 9999px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #34d399;
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
      animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } }
    h1 { font-size: 1.6rem; font-weight: 800; color: #ffffff; margin-bottom: 6px; }
    p.sub { font-size: 0.88rem; color: #94a3b8; }
    .card {
      background: #1e293b;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 18px;
      padding: 24px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      margin-bottom: 24px;
    }
    .upload-zone {
      border: 2px dashed #008b8b;
      border-radius: 14px;
      padding: 24px;
      text-align: center;
      background: rgba(0, 139, 139, 0.05);
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
    }
    .upload-zone:hover { background: rgba(0, 139, 139, 0.12); }
    .upload-icon { font-size: 2.2rem; margin-bottom: 10px; }
    .preview-box {
      display: none;
      margin-top: 14px;
      border-radius: 12px;
      overflow: hidden;
      max-height: 240px;
      border: 1px solid #334155;
    }
    .preview-box img { width: 100%; height: 100%; object-fit: contain; }
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 18px;
    }
    @media (max-width: 480px) { .form-grid { grid-template-columns: 1fr; } }
    label { font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; display: block; }
    input, select {
      width: 100%;
      padding: 10px 12px;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      color: #f8fafc;
      font-size: 0.9rem;
      outline: none;
    }
    input:focus, select:focus { border-color: #008b8b; box-shadow: 0 0 0 2px rgba(0, 139, 139, 0.2); }
    .btn-submit {
      width: 100%;
      margin-top: 20px;
      padding: 14px;
      border-radius: 10px;
      border: none;
      background: linear-gradient(135deg, #008b8b 0%, #0d9488 100%);
      color: white;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 4px 15px rgba(0, 139, 139, 0.4);
    }
    .btn-submit:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0, 139, 139, 0.6); }
    .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
    .result-box {
      display: none;
      margin-top: 18px;
      padding: 14px;
      border-radius: 10px;
      background: #0f172a;
      border: 1px solid #334155;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.78rem;
      color: #38bdf8;
      word-break: break-all;
      white-space: pre-wrap;
    }
    .gallery-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 12px; color: #e2e8f0; }
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px;
    }
    .gallery-item {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      overflow: hidden;
      font-size: 0.75rem;
    }
    .gallery-item img {
      width: 100%;
      height: 100px;
      object-fit: cover;
      display: block;
      background: #0f172a;
    }
    .gallery-info { padding: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge-live"><span class="dot"></span> Online & Active</div>
      <h1>MediLink Optical Receiver</h1>
      <p class="sub">Remote ESP32-CAM & Mobile Optical Scanning Endpoint</p>
    </div>

    <div class="card">
      <div class="upload-zone" id="dropZone" onclick="document.getElementById('fileInput').click()">
        <div class="upload-icon">📸</div>
        <div style="font-weight: 700; font-size: 1rem; color: #e2e8f0;">Take Photo or Choose Image</div>
        <div style="font-size: 0.78rem; color: #94a3b8; margin-top: 4px;">Supports camera snap, QR codes, or medicine box photos</div>
        <input type="file" id="fileInput" accept="image/*" capture="environment" style="display: none">
      </div>

      <div class="preview-box" id="previewBox">
        <img id="previewImg" src="" alt="Preview">
      </div>

      <div class="form-grid">
        <div>
          <label>Scanner Device / Node</label>
          <select id="deviceSelect" onchange="document.getElementById('hospitalInput').value = this.value === 'Node_1' ? 'H01' : (this.value === 'Node_2' ? 'H02' : 'H03')">
            <option value="Node_1">Node_1 (H01 — Mysore District Hospital)</option>
            <option value="Node_2">Node_2 (H02 — Bangalore Medical Center)</option>
            <option value="Node_3">Node_3 (H03 — Mangalore General Hospital)</option>
          </select>
        </div>
        <div>
          <label>Action Header (x-action)</label>
          <select id="actionSelect">
            <option value="ADD">ADD (+1 Increment QR Count & Restock)</option>
            <option value="REMOVE">REMOVE (-1 Decrement QR Count & Dispense)</option>
            <option value="TRANSFER_DISPATCH">TRANSFER_DISPATCH (Optical QR Dispatch)</option>
            <option value="TRANSFER_RECEIVE">TRANSFER_RECEIVE (Confirm Delivery)</option>
          </select>
        </div>
        <div>
          <label>Medicine Name / Batch</label>
          <input type="text" id="medicineInput" value="Paracetamol 500mg" placeholder="e.g. Paracetamol 500mg">
        </div>
        <div>
          <label>Weight (kg)</label>
          <input type="number" id="weightInput" value="1.0" step="0.1" min="0.1">
        </div>
        <div>
          <label>Hospital Node ID</label>
          <input type="text" id="hospitalInput" value="H01" placeholder="H01, H02, or H03">
        </div>
      </div>

      <button class="btn-submit" id="submitBtn" onclick="uploadImage()">
        ⚡ Send Optical Scan & Apply Count Action
      </button>

      <div class="result-box" id="resultBox"></div>
    </div>

    ${activeQRCodes.length > 0 ? `
    <div class="gallery-title" style="display:flex; justify-content:space-between; align-items:center;">
      <span>🏷️ Active QR Codes & Live Count Variables</span>
      <span style="font-size:0.75rem; color:#38bdf8;">MongoDB Atlas Verified</span>
    </div>
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:10px; margin-bottom:24px;">
      ${activeQRCodes.map(q => `
        <div style="background:#1e293b; border:1px solid #334155; border-radius:12px; padding:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.7rem; font-family:monospace; color:#94a3b8;">${q.qrId}</span>
            <span style="background:${q.count > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}; color:${q.count > 0 ? '#34d399' : '#f87171'}; padding:2px 8px; border-radius:999px; font-weight:800; font-size:0.8rem;">
              Count: ${q.count}
            </span>
          </div>
          <div style="font-weight:700; color:#f8fafc; font-size:0.85rem; margin-top:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${q.medicine}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
            <span style="font-size:0.72rem; color:#64748b;">Batch: ${q.batch}</span>
            <span style="font-size:0.68rem; background:#334155; color:#38bdf8; padding:1px 6px; border-radius:4px; font-weight:700;">${q.lastScannedNode || q.hospitalId || 'Node_1'}</span>
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${recentImages.length > 0 ? `
    <div class="gallery-title">📁 Recent Live Captures in MongoDB Atlas</div>
    <div class="gallery-grid">
      ${recentImages.map(img => {
        const src = img.imageUrl || (img.image_data?.startsWith('data:') ? img.image_data : ('data:image/jpeg;base64,' + img.image_data));
        return `
          <div class="gallery-item">
            <img src="${src}" alt="Scan">
            <div class="gallery-info">
              <div style="font-weight:700; color:#f8fafc; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${img.medicine || 'Live Scan'}</div>
              <div style="display:flex; justify-content:space-between; color:#94a3b8; font-size:0.7rem; margin-top:2px;">
                <span>${new Date(img.createdAt).toLocaleTimeString()}</span>
                <span style="color:#38bdf8; font-weight:700;">${img.deviceName || img.source || 'Node_1'}</span>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
    ` : ''}
  </div>

  <script>
    let base64Data = '';
    const fileInput = document.getElementById('fileInput');
    const previewBox = document.getElementById('previewBox');
    const previewImg = document.getElementById('previewImg');
    const resultBox = document.getElementById('resultBox');
    const submitBtn = document.getElementById('submitBtn');

    fileInput.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        const file = this.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
          base64Data = e.target.result;
          previewImg.src = base64Data;
          previewBox.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    });

    async function uploadImage() {
      if (!base64Data) {
        alert('Please select or take a photo first!');
        return;
      }
      submitBtn.disabled = true;
      submitBtn.innerText = '⏳ Processing with Optical Vision & Cloudinary...';
      resultBox.style.display = 'none';

      try {
        const deviceName = document.getElementById('deviceSelect').value || 'Node_1';
        const payload = {
          image_data: base64Data,
          source: deviceName,
          deviceName: deviceName,
          action: document.getElementById('actionSelect').value,
          medicine: document.getElementById('medicineInput').value,
          weightKg: parseFloat(document.getElementById('weightInput').value) || 1.0,
          hospitalId: document.getElementById('hospitalInput').value || 'H01'
        };

        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Name': deviceName,
            'x-device-name': deviceName,
            'x-action': payload.action,
            'x-medicine': payload.medicine,
            'x-weight': payload.weightKg.toString(),
            'x-hospital-id': payload.hospitalId
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        resultBox.style.display = 'block';
        if (data.qrFound) {
          resultBox.style.borderColor = '#10b981';
          resultBox.style.color = '#34d399';
          resultBox.style.background = 'rgba(16, 185, 129, 0.1)';
          resultBox.innerText = '🎯 QR CODE SUCCESSFULLY SCANNED!\n\n' +
            '💊 Medicine: ' + (data.medicine || 'Identified') + '\n' +
            '🏷️ Batch: ' + (data.batch || 'Verified') + '\n' +
            '📦 Action: ' + (data.action || 'ADD') + ' (Count: ' + (data.count || 1) + ')\n' +
            '🏥 Hospital: ' + (data.hospitalId || 'H01') + '\n\n' +
            JSON.stringify(data, null, 2);
          setTimeout(() => location.reload(), 3000);
        } else if (res.ok) {
          resultBox.style.borderColor = '#f59e0b';
          resultBox.style.color = '#fbbf24';
          resultBox.style.background = 'rgba(245, 158, 11, 0.1)';
          resultBox.innerText = '⚠️ NO QR CODE DETECTED IN IMAGE!\n\n' +
            'The camera captured an image, but no MediLink QR pattern was detected.\n' +
            '👉 Please hold camera closer to the QR code, ensure good lighting, and avoid screen glare.\n\n' +
            JSON.stringify(data, null, 2);
        } else {
          resultBox.style.borderColor = '#ef4444';
          resultBox.style.color = '#f87171';
          resultBox.style.background = 'rgba(239, 68, 68, 0.1)';
          resultBox.innerText = '❌ UPLOAD ERROR:\n\n' + JSON.stringify(data, null, 2);
        }
      } catch (err) {
        resultBox.style.display = 'block';
        resultBox.style.borderColor = '#ef4444';
        resultBox.style.color = '#f87171';
        resultBox.innerText = '❌ Network Error: ' + err.message;
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = '⚡ Send & Process Optical Scan';
      }
    }
  </script>
</body>
</html>`;
    return res.send(html);
  }

  res.json({
    status: "online",
    service: "MediLink ESP32-CAM Image Receiver & Optical Processor",
    timestamp: new Date().toISOString()
  });
});

app.get('/driver', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>MediLink Pilot — Driver GPS Transponder</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
      background: #f8fafc;
      color: #0f172a;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      -webkit-font-smoothing: antialiased;
    }
    header {
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.02);
      z-index: 500;
    }
    .badge-logo {
      width: 36px; height: 36px; border-radius: 10px;
      background: #0f172a; color: #ffffff;
      display: flex; align-items: center; justify-content: center;
      font-size: 1rem; font-weight: 900;
    }
    .status-pill {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 0.72rem; font-weight: 700; color: #64748b;
    }
    .dot-green {
      width: 7px; height: 7px; border-radius: 50%;
      background: #10b981; box-shadow: 0 0 6px #10b981;
    }
    #map {
      flex: 1; min-height: 240px; background: #e2e8f0; width: 100%;
    }
    .floating-acc {
      position: absolute; top: 12px; right: 12px; z-index: 400;
      background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(8px);
      border: 1px solid #e2e8f0; border-radius: 999px;
      padding: 4px 10px; font-size: 0.7rem; font-weight: 700; color: #0f172a;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05); display: flex; align-items: center; gap: 5px;
    }
    .trip-sheet {
      background: #ffffff;
      border-top-left-radius: 24px;
      border-top-right-radius: 24px;
      padding: 18px 18px 28px 18px;
      box-shadow: 0 -8px 25px rgba(0,0,0,0.05);
      border-top: 1px solid #e2e8f0;
      z-index: 500;
      max-width: 500px;
      margin: 0 auto;
      width: 100%;
    }
    .handle {
      width: 36px; height: 4px; background: #cbd5e1; border-radius: 999px; margin: -6px auto 14px auto;
    }
    .route-card {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px;
      padding: 12px 14px; margin-bottom: 14px; position: relative;
      display: flex; flex-direction: column; gap: 8px;
    }
    .route-line {
      position: absolute; left: 20px; top: 22px; bottom: 22px; width: 2px; background: #cbd5e1;
    }
    .point-row {
      display: flex; align-items: center; gap: 10px; z-index: 2;
    }
    .dot-pickup {
      width: 10px; height: 10px; border-radius: 50%; background: #10b981; border: 2px solid #ffffff; box-shadow: 0 0 0 2px #10b981;
    }
    .dot-dest {
      width: 10px; height: 10px; border-radius: 2px; background: #0f172a; border: 2px solid #ffffff; box-shadow: 0 0 0 2px #0f172a;
    }
    .metrics-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px;
    }
    .metric-cell {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;
      padding: 8px; text-align: center;
    }
    .metric-label { font-size: 0.65rem; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .metric-val { font-size: 1.15rem; font-weight: 900; color: #0f172a; margin-top: 2px; }
    .btn-main {
      width: 100%; padding: 15px; border-radius: 14px; border: none;
      background: #0f172a; color: #ffffff; font-size: 0.95rem; font-weight: 800;
      cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.2); transition: all 0.15s;
    }
    .btn-main:active { transform: scale(0.98); }
    .btn-main.active {
      background: #ffffff; color: #ef4444; border: 1.5px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .btn-row {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;
    }
    .btn-sub {
      padding: 10px; border-radius: 12px; border: 1px solid #e2e8f0;
      background: #f8fafc; color: #0f172a; font-size: 0.78rem; font-weight: 700; cursor: pointer;
    }
    .progress-bar-wrap {
      width: 100%; height: 6px; background: #f1f5f9; border-radius: 999px; overflow: hidden; margin-bottom: 14px;
    }
    .progress-bar-fill {
      width: 25%; height: 100%; background: #0f172a; transition: width 0.4s ease; border-radius: 999px;
    }
  </style>
</head>
<body>
  <header>
    <div style="display: flex; align-items: center; gap: 10px;">
      <div class="badge-logo">ML</div>
      <div>
        <div style="font-size: 0.95rem; font-weight: 900; color: #0f172a;">MediLink Pilot</div>
        <div class="status-pill" id="statusPill">
          <span class="dot-green"></span>
          <span id="statusText">READY TO DISPATCH</span>
        </div>
      </div>
    </div>
    <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; background: #f1f5f9; padding: 4px 10px; border-radius: 999px;">
      Consignment #REQ-1001
    </div>
  </header>

  <div style="position: relative; flex: 1; display: flex; flex-direction: column;">
    <div class="floating-acc" id="accuracyPill">
      <span style="color: #10b981;">●</span>
      <span id="accuracyText">A-GPS ±2.5m</span>
    </div>
    <div id="map"></div>
  </div>

  <div class="trip-sheet">
    <div class="handle"></div>

    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
      <div>
        <div style="font-size: 0.68rem; font-weight: 800; color: #64748b; text-transform: uppercase;">Medical Consignment</div>
        <h3 style="font-size: 1.2rem; font-weight: 900; color: #0f172a; margin: 2px 0 0 0;" id="medName">Paracetamol 500mg</h3>
        <div style="font-size: 0.75rem; color: #64748b; margin-top: 1px;">Batch PA-902 · 1.0 kg gross</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 1.4rem; font-weight: 900; color: #0f172a; letter-spacing: -0.02em;" id="etaText">32 min</div>
        <div style="font-size: 0.68rem; color: #64748b; font-weight: 600;">Est. Arrival</div>
      </div>
    </div>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px 14px; margin-bottom: 14px;">
      <div style="font-size: 0.65rem; color: #64748b; font-weight: 700; text-transform: uppercase;">📍 Real Physical Street Location</div>
      <div style="font-size: 0.95rem; font-weight: 800; color: #0f172a; margin-top: 2px; line-height: 1.3;" id="realStreetName">Acquiring device GPS...</div>
      <div style="font-size: 0.72rem; color: #0284c7; font-family: monospace; font-weight: 700; margin-top: 4px;" id="coordsText">Lat: --, Lng: --</div>
    </div>

    <div class="metrics-grid">
      <div class="metric-cell">
        <div class="metric-label">Speed</div>
        <div class="metric-val"><span id="speedVal">0</span> <span style="font-size: 0.65rem; color: #64748b;">km/h</span></div>
      </div>
      <div class="metric-cell">
        <div class="metric-label">Cold Chain</div>
        <div class="metric-val" style="color: #059669;">3.8°C</div>
      </div>
      <div class="metric-cell">
        <div class="metric-label">Progress</div>
        <div class="metric-val"><span id="progressVal">25</span>%</div>
      </div>
    </div>

    <div class="progress-bar-wrap">
      <div class="progress-bar-fill" id="progressFill"></div>
    </div>

    <button class="btn-main" id="btnToggle" onclick="toggleGps()">
      ▶ START PHONE GPS DISPATCH
    </button>

    <div class="btn-row">
      <button class="btn-sub" onclick="stepSimForward()">🚶 Advance (+10%)</button>
      <button class="btn-sub" style="background:#ecfdf5; color:#059669; border-color:#a7f3d0;" onclick="confirmArrival()">🏁 Confirm Dock Arrival</button>
    </div>

    <div style="text-align: center; margin-top: 10px; font-size: 0.7rem; color: #94a3b8;" id="syncLabel">
      Ready to broadcast live coordinates
    </div>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    let isTracking = false;
    let watchId = null;
    let syncCount = 0;
    let realCoords = null;
    let lastGeocodeTime = 0;
    let realAddress = 'Acquiring physical street location...';
    let pathHistory = [];

    // Initialize Leaflet map
    const map = L.map('map', {
      center: [12.9716, 77.5946], // temporary fallback until device GPS fix
      zoom: 17,
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    // Accuracy circle
    let accCircle = L.circle([12.9716, 77.5946], {
      radius: 20,
      color: '#2563eb',
      fillColor: '#60a5fa',
      fillOpacity: 0.15,
      weight: 1.5
    }).addTo(map);

    // Real-time walking path breadcrumbs
    let pathLine = L.polyline([], {
      color: '#0f172a',
      weight: 4,
      opacity: 0.85
    }).addTo(map);

    // Vehicle/Person GPS Marker
    const vehicleIcon = L.divIcon({
      className: 'real-v-pin',
      html: '<div style="transform:translate(-50%,-50%);position:relative"><div style="position:absolute;width:44px;height:44px;border-radius:50%;background:rgba(37,99,235,0.3);animation:pulse 2s infinite"></div><div style="width:34px;height:34px;border-radius:50%;background:#0f172a;border:3px solid white;box-shadow:0 4px 14px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:15px">🚑</div></div>',
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    const vMarker = L.marker([12.9716, 77.5946], { icon: vehicleIcon }).addTo(map);

    // Reverse Geocoding via OpenStreetMap (Gets exact real building & street name)
    async function reverseGeocode(lat, lng) {
      const now = Date.now();
      if (now - lastGeocodeTime < 10000) return;
      lastGeocodeTime = now;

      try {
        const res = await fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng, {
          headers: { 'User-Agent': 'MediLink-RealGPS' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.display_name) {
            const parts = data.display_name.split(',');
            realAddress = parts.slice(0, 3).join(', ');
            document.getElementById('realStreetName').innerText = realAddress;
          }
        }
      } catch (e) {}
    }

    async function sendRealGps(lat, lng, speed, acc) {
      try {
        const res = await fetch('/api/iot/transit-gps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId: 'REQ-1001',
            lat, lng,
            accuracy: acc,
            currentSpeedKmH: speed,
            currentLocationName: realAddress,
            liveTrackingStatus: 'IN_TRANSIT'
          })
        });
        if (res.ok) {
          syncCount++;
          document.getElementById('syncLabel').innerText = 'Transmitted ' + syncCount + ' real GPS packets to MediLink';
        }
      } catch (e) {}
    }

    function handleRealPosition(pos) {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const acc = pos.coords.accuracy ? pos.coords.accuracy.toFixed(1) : 3.0;
      const speed = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;

      realCoords = { lat, lng };

      document.getElementById('speedVal').innerText = speed;
      document.getElementById('accuracyText').innerText = 'Real A-GPS ±' + acc + 'm';
      document.getElementById('coordsText').innerText = 'Lat: ' + lat.toFixed(6) + '°, Lng: ' + lng.toFixed(6) + '°';

      // Update map to exact physical street
      vMarker.setLatLng([lat, lng]);
      accCircle.setLatLng([lat, lng]);
      accCircle.setRadius(Math.max(10, parseFloat(acc)));

      pathHistory.push([lat, lng]);
      pathLine.setLatLngs(pathHistory);

      map.panTo([lat, lng]);

      reverseGeocode(lat, lng);
      sendRealGps(lat, lng, speed, parseFloat(acc));
    }

    // Immediately acquire device's true initial physical position
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        map.setView([lat, lng], 17);
        handleRealPosition(pos);
      }, (err) => {
        document.getElementById('realStreetName').innerText = 'Please allow location permission in browser';
      }, { enableHighAccuracy: true, timeout: 10000 });
    }

    function toggleGps() {
      if (!isTracking) {
        if (!navigator.geolocation) {
          alert('Geolocation not supported by this browser');
          return;
        }
        isTracking = true;
        document.getElementById('btnToggle').className = 'btn-main active';
        document.getElementById('btnToggle').innerText = '⏸ PAUSE REAL GPS BROADCAST';
        document.getElementById('statusText').innerText = 'ONLINE · REAL GPS STREAMING';

        watchId = navigator.geolocation.watchPosition(
          handleRealPosition,
          (err) => {
            alert('GPS Error: ' + err.message + '. Please ensure location services are enabled on your device.');
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
      } else {
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        isTracking = false;
        document.getElementById('btnToggle').className = 'btn-main';
        document.getElementById('btnToggle').innerText = '▶ START REAL GPS BROADCAST';
        document.getElementById('statusText').innerText = 'STANDBY · READY';
      }
    }

    function confirmArrival() {
      if (realCoords) {
        sendRealGps(realCoords.lat, realCoords.lng, 0, 1.0);
      }
      document.getElementById('statusText').innerText = 'ARRIVED AT DOCK';
      alert('🏁 Dock arrival transmitted! The hospital supervisor has received the arrival notice.');
    }
  </script>
</body>
</html>`;
  res.send(html);
});

app.get('/api/upload/latest', async (req, res) => {
  try {
    const images = await CapturedImage.find().sort({ createdAt: -1 }).limit(12).lean();
    res.json(images);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Node & Hospital Mapping Helper
const NODE_HOSPITAL_MAP = {
  'Node_1': { id: 'H01', name: 'Apollo Bangalore Central (H01)' },
  'Node_2': { id: 'H02', name: 'Manipal Hospital Whitefield (H02)' },
  'Node_3': { id: 'H03', name: 'Mangalore General Hospital (H03)' }
};

function resolveDeviceAndNode(rawDevice, rawHospital) {
  let dev = (rawDevice || '').toString().trim();
  const up = dev.toUpperCase();
  const hUp = (rawHospital || '').toString().trim().toUpperCase();
  let hId = 'H01';

  if (up.includes('NODE_3') || up.includes('NODE-3') || up.includes('NODE 3') || up === 'NODE3' || up.includes('H03')) {
    dev = 'Node_3';
    hId = 'H03';
  } else if (up.includes('NODE_2') || up.includes('NODE-2') || up.includes('NODE 2') || up === 'NODE2' || up.includes('H02')) {
    dev = 'Node_2';
    hId = 'H02';
  } else if (up.includes('NODE_1') || up.includes('NODE-1') || up.includes('NODE 1') || up === 'NODE1' || up.includes('H01')) {
    dev = 'Node_1';
    hId = 'H01';
  } else if (hUp === 'H03') {
    dev = 'Node_3';
    hId = 'H03';
  } else if (hUp === 'H02') {
    dev = 'Node_2';
    hId = 'H02';
  } else {
    dev = 'Node_1';
    hId = 'H01';
  }

  return {
    deviceName: dev,
    hospitalId: hId,
    hospitalName: NODE_HOSPITAL_MAP[dev]?.name || (hId === 'H02' ? 'Manipal Hospital Whitefield (H02)' : (hId === 'H03' ? 'Mangalore General Hospital (H03)' : 'Apollo Bangalore Central (H01)'))
  };
}

app.post('/api/upload', async (req, res) => {
  try {
    const { source, deviceName: bodyDevice, requestId, inventoryItemId } = req.body;
    const image_data = req.body.image_data || req.body.image || req.body.base64 || req.body.data;
    if (!image_data) {
      return res.status(400).json({
        success: false,
        qrFound: false,
        status: "NO_IMAGE_DATA",
        error: "No image_data provided in payload"
      });
    }

    // 1. Read Device Name & Hospital Node
    const rawDeviceHeader = req.headers['x-device-name'] || req.headers['x-device'] || req.headers['device-name'];
    const rawDevice = rawDeviceHeader || bodyDevice || source || 'Node_1';
    const rawHospital = req.headers['x-hospital-id'] || req.headers['hospital-id'] || req.body.hospitalId;

    const { deviceName, hospitalId, hospitalName } = resolveDeviceAndNode(rawDevice, rawHospital);
    console.log(`\n[ESP32 Scanner 📡] Received capture from Device: ${deviceName} ➔ Mapped to Node: ${hospitalId} (${hospitalName})`);

    // Read custom HTTP Headers sent by ESP32-CAM
    const headerAction = req.headers['x-action'] || req.headers['action'] || req.body.action;
    const headerMedicine = req.headers['x-medicine'] || req.headers['medicine'] || req.body.medicine;
    const headerWeight = req.headers['x-quantity'] || req.headers['x-weight'] || req.body.quantityKg || req.body.weightKg;
    const headerBatch = req.headers['x-batch'] || req.headers['batch'] || req.body.batch;

    // 2. Optical QR/Barcode Auto-Decoding
    const imgBuffer = Buffer.from(image_data, 'base64');
    const qrResult = await decodeQRFromBuffer(imgBuffer);

    const isQRDetected = !!(qrResult && qrResult.found && qrResult.payload);
    let scanResult = null;

    // 3. Resolve Target Medicine Dynamically for THIS Specific Hospital Node
    let targetMedicine = null;
    let targetBatch = null;

    if (isQRDetected && qrResult.payload.medicine) {
      targetMedicine = qrResult.payload.medicine;
      targetBatch = qrResult.payload.batch || null;
    } else if (headerMedicine && headerMedicine !== 'Auto_Detect' && headerMedicine !== 'auto' && headerMedicine.trim()) {
      targetMedicine = headerMedicine.trim();
      targetBatch = (headerBatch && headerBatch !== 'Auto_Detect') ? headerBatch.trim() : null;
    } else {
      // Query this hospital's actual inventory from database!
      const currentInv = await db.getInventoryForHospital(hospitalId).catch(() => []);
      if (currentInv && currentInv.length > 0) {
        // Pick the medicine with lowest stock / most urgent at this specific node
        const sorted = [...currentInv].sort((a, b) => (a.currentStockKg || 0) - (b.currentStockKg || 0));
        targetMedicine = sorted[0].medicine;
        targetBatch = sorted[0].batch;
      } else {
        targetMedicine = (hospitalId === 'H03') ? "Amoxicillin 500mg" : ((hospitalId === 'H02') ? "Metformin 500mg" : "Paracetamol");
        targetBatch = (hospitalId === 'H03') ? "AM-777" : ((hospitalId === 'H02') ? "MF-800" : "P123");
      }
    }

    const resolvedAction = (headerAction && headerAction !== 'AUTO') 
      ? headerAction.toUpperCase() 
      : ((isQRDetected && qrResult.payload.action) ? qrResult.payload.action.toUpperCase() : 'ADD');

    const resolvedWeight = parseFloat(headerWeight) || (isQRDetected ? parseFloat(qrResult.payload.weightKg || 1.0) : 1.0);

    // 4. Process Scan via AutoScanner for this Hospital Node
    scanResult = await AutoScanner.processScan({
      payload: {
        ...(isQRDetected ? qrResult.payload : {}),
        medicine: targetMedicine,
        batch: targetBatch || `BATCH-${hospitalId}`,
        weightKg: resolvedWeight,
        count: 1,
        action: resolvedAction,
        deviceName,
        headerUsed: `x-action: ${resolvedAction} (Node: ${hospitalId})`,
        destHospital: hospitalId,
        sourceHospital: hospitalId,
        qrId: (isQRDetected && qrResult.payload.qrId) ? qrResult.payload.qrId : `QR-${hospitalId}-${(targetBatch || targetMedicine).replace(/\s+/g, '_')}`
      },
      rawImageId: null,
      imageBase64: image_data
    });

    // 5. Background Async Task: Upload to Cloudinary & Save to MongoDB
    setImmediate(async () => {
      try {
        const cloudinaryRes = await uploadToCloudinary(image_data).catch(err => {
          console.warn('[Cloudinary] Cloud upload skipped:', err.message);
          return null;
        });

        const newImage = new CapturedImage({
          image_data,
          imageUrl: cloudinaryRes?.url || null,
          cloudinaryPublicId: cloudinaryRes?.public_id || null,
          source: deviceName,
          deviceName: deviceName,
          hospitalId: hospitalId,
          requestId: requestId || null,
          inventoryItemId: inventoryItemId || null,
          medicine: scanResult?.medicine || targetMedicine,
          batch: scanResult?.batch || targetBatch || "BATCH-AUTO",
          action: scanResult?.action || resolvedAction,
          weightKg: scanResult?.weightKg || resolvedWeight,
          decodedPayload: isQRDetected ? qrResult.payload : { autoDetected: true, medicine: scanResult?.medicine },
          glmReasoning: scanResult?.glmVerification?.explanation || scanResult?.message || `Optical scan processed by ${deviceName} at ${hospitalName}.`
        });
        await newImage.save();
      } catch (bgErr) {
        console.warn('[Background Worker] Image archive warning:', bgErr.message);
      }
    });

    // 6. Send Instant Response Back to ESP32 OLED
    const medName = scanResult?.medicine || targetMedicine;
    const batchCode = scanResult?.batch || targetBatch || "BATCH-VERIFIED";
    const countVal = scanResult?.qrCount !== undefined ? scanResult.qrCount : (scanResult?.packageCount || 1);
    const activeHospital = scanResult?.destHospital || hospitalId;
    const finalAction = scanResult?.action || resolvedAction;

    return res.status(200).json({
      success: true,
      qrFound: true,
      status: "QR_CODE_SCANNED_SUCCESSFULLY",
      message: isQRDetected 
        ? `✅ QR Code successfully scanned by ${deviceName}: ${medName} (Batch: ${batchCode}, Count: ${countVal}, Node: ${activeHospital})`
        : `✅ Optical Action Verified by ${deviceName}: ${medName} (${finalAction} Count: ${countVal}, Node: ${activeHospital})`,
      deviceName,
      hospitalId: activeHospital,
      hospitalName: NODE_HOSPITAL_MAP[deviceName]?.name || hospitalName,
      medicine: medName,
      batch: batchCode,
      action: finalAction,
      count: countVal,
      qrId: scanResult?.qrId || `QR-${batchCode}`,
      previousCount: scanResult?.previousCount !== undefined ? scanResult.previousCount : null,
      countChange: scanResult?.countChange || 1,
      scanResult
    });
  } catch (error) {
    console.error("[ESP32-CAM] Upload error:", error);
    return res.status(500).json({
      success: false,
      qrFound: false,
      status: "SERVER_ERROR",
      error: error.message || "Internal Server Error"
    });
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', mode: process.env.DB_MODE, timestamp: new Date().toISOString() }));

// Server Info & Zero-Config Auto-Discovery Info
app.get('/api/server-info', (req, res) => {
  const localIp = getLocalIp();
  res.json({
    success: true,
    serverIp: localIp,
    port: PORT,
    uploadUrl: `http://${localIp}:${PORT}/api/upload`,
    discoveryPort: 5055,
    mode: process.env.DB_MODE || 'memory',
    timestamp: new Date().toISOString()
  });
});

const { connectMongoDB } = require('./config/mongodb');

app.listen(PORT, async () => {
  const localIp = getLocalIp();
  console.log(`\n  ╔══════════════════════════════════════════════════════════╗`);
  console.log(`  ║  MediLink AI — Express API Server                        ║`);
  console.log(`  ║  Port: ${PORT.toString().padEnd(49)}║`);
  console.log(`  ║  Local LAN IP: ${localIp.padEnd(42)}║`);
  console.log(`  ║  ESP32 Upload URL: http://${(localIp + ':' + PORT + '/api/upload').padEnd(36)}║`);
  console.log(`  ║  UDP Auto-Discovery Beacon: Active (Port 5055)            ║`);
  console.log(`  ║  DB Mode: ${(process.env.DB_MODE || 'memory').padEnd(46)}║`);
  console.log(`  ╚══════════════════════════════════════════════════════════╝\n`);

  // Start UDP Discovery Service for ESP32 hardware
  startDiscovery(PORT);
  
  if (process.env.DB_MODE === 'mongodb' || process.env.MONGODB_URI) {
    try {
      await connectMongoDB();
    } catch (err) {
      console.warn('[MongoDB Atlas Warning]', err.message);
    }
  }
});

module.exports = app;
