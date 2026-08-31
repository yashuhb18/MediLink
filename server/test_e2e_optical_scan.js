const http = require('http');
const QRCode = require('qrcode');

async function runE2ETest() {
  console.log('--- STARTING E2E OPTICAL SCAN SIMULATION ---');

  // 1. Generate Smart Label payload
  const payload = {
    token: `ML-OPT-${Date.now().toString(36).toUpperCase()}`,
    action: "TRANSFER_DISPATCH",
    medicine: "Amoxicillin 500mg",
    batch: "AM-882",
    weightKg: 1.0,
    requestId: "REQ-1001",
    sourceHospital: "H02",
    destHospital: "H01"
  };

  // 2. Render to PNG Buffer
  const qrBuffer = await QRCode.toBuffer(JSON.stringify(payload), {
    type: 'png',
    width: 400,
    margin: 2
  });

  const base64Image = qrBuffer.toString('base64');
  console.log(`Generated simulated camera image buffer: ${qrBuffer.length} bytes`);

  // 3. Post to /api/upload (exact same as ESP32-CAM)
  const postData = JSON.stringify({
    image_data: base64Image,
    source: "ESP32-CAM-SIMULATOR"
  });

  const req = http.request('http://localhost:5000/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('RESPONSE STATUS:', res.statusCode);
      try {
        const json = JSON.parse(body);
        console.log('RESPONSE BODY:', JSON.stringify(json, null, 2));
        if (json.qrFound && json.scanResult && json.scanResult.success) {
          console.log('🎉 E2E TEST PASSED: ESP32 Optical Capture successfully auto-decoded & processed!');
        } else {
          console.warn('⚠️ Scan processed with fallback.');
        }
      } catch (e) {
        console.error('Parse error:', e, body);
      }
    });
  });

  req.on('error', err => console.error('Request error:', err));
  req.write(postData);
  req.end();
}

runE2ETest();
