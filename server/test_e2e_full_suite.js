require('dotenv').config();
const http = require('http');

async function runE2ETests() {
  console.log('🧪 Starting Full MediLink End-to-End API Suite...\n');
  
  // 1. Require app and connect MongoDB
  require('./src/index');
  const baseUrl = 'http://127.0.0.1:5000';
  console.log(`📡 Connecting to test server at ${baseUrl}\n`);
  // Wait 1.5s for initial mongodb connect
  await new Promise(r => setTimeout(r, 1500));

  let passed = 0;
  let failed = 0;

  async function check(desc, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${desc}:`, err.message);
      failed++;
    }
  }

  let adminToken = '';
  let supervisorToken = '';

  // 1. Health check
  await check('GET /api/health', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error('Status not ok');
  });

  // 2. Auth - Admin Login
  await check('POST /api/auth/login (Network Admin)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@medilink.ai', password: 'admin123' })
    });
    const data = await res.json();
    if (!res.ok || !data.token) throw new Error(data.error || `Status ${res.status}`);
    adminToken = data.token;
  });

  // 3. Auth - Supervisor Login
  await check('POST /api/auth/login (Requesting Supervisor)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'supervisor@h01.medilink.ai', password: 'super123' })
    });
    const data = await res.json();
    if (!res.ok || !data.token) throw new Error(data.error || `Status ${res.status}`);
    supervisorToken = data.token;
  });

  // 4. Auth - Me
  await check('GET /api/auth/me', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (!res.ok || !data.user) throw new Error(`Status ${res.status}`);
  });

  // 5. Hospitals
  await check('GET /api/hospitals', async () => {
    const res = await fetch(`${baseUrl}/api/hospitals`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (!res.ok || !Array.isArray(data) || data.length === 0) throw new Error('Hospitals empty or failed');
  });

  // 6. Inventory
  await check('GET /api/inventory', async () => {
    const res = await fetch(`${baseUrl}/api/inventory`, {
      headers: { Authorization: `Bearer ${supervisorToken}` }
    });
    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) throw new Error(`Failed: status ${res.status}`);
  });

  // 7. Inventory Search
  await check('GET /api/inventory/search?medicine=Paracetamol', async () => {
    const res = await fetch(`${baseUrl}/api/inventory/search?medicine=Paracetamol&viewerHospitalId=H01`, {
      headers: { Authorization: `Bearer ${supervisorToken}` }
    });
    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) throw new Error(`Failed: status ${res.status}`);
  });

  // 8. Inventory Predictions
  await check('GET /api/inventory/predictions/H01', async () => {
    const res = await fetch(`${baseUrl}/api/inventory/predictions/H01`, {
      headers: { Authorization: `Bearer ${supervisorToken}` }
    });
    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) throw new Error(`Failed: status ${res.status}`);
  });

  // 9. Transfers Available Nodes
  await check('GET /api/transfers/available-nodes?medicine=Paracetamol', async () => {
    const res = await fetch(`${baseUrl}/api/transfers/available-nodes?medicine=Paracetamol&requestingHospitalId=H01`, {
      headers: { Authorization: `Bearer ${supervisorToken}` }
    });
    const data = await res.json();
    if (!res.ok || !Array.isArray(data.availableNodes)) throw new Error(`Failed: status ${res.status}`);
  });

  // 10. Transfers AI Suggest
  await check('POST /api/transfers/ai-suggest', async () => {
    const res = await fetch(`${baseUrl}/api/transfers/ai-suggest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supervisorToken}`
      },
      body: JSON.stringify({ medicine: 'Paracetamol', requiredKg: 1.0, requestingHospitalId: 'H01', urgency: 'HIGH' })
    });
    const data = await res.json();
    if (!res.ok || !Array.isArray(data.sources)) throw new Error(`Failed: ${data.error || res.status}`);
  });

  // 11. Karma
  await check('GET /api/karma', async () => {
    const res = await fetch(`${baseUrl}/api/karma`, {
      headers: { Authorization: `Bearer ${supervisorToken}` }
    });
    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) throw new Error(`Failed: status ${res.status}`);
  });

  // 12. Admin Heatmap
  await check('GET /api/admin/heatmap', async () => {
    const res = await fetch(`${baseUrl}/api/admin/heatmap`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (!res.ok || !data.heatmap) throw new Error(`Failed: status ${res.status}`);
  });

  // 13. Admin Audit Log
  await check('GET /api/admin/audit-log', async () => {
    const res = await fetch(`${baseUrl}/api/admin/audit-log`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) throw new Error(`Failed: status ${res.status}`);
  });

  // 14. Admin Sensor Alerts
  await check('GET /api/admin/sensor-alerts', async () => {
    const res = await fetch(`${baseUrl}/api/admin/sensor-alerts`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) throw new Error(`Failed: status ${res.status}`);
  });

  // 15. AI Agent Status
  await check('GET /api/ai/status', async () => {
    const res = await fetch(`${baseUrl}/api/ai/status`);
    const data = await res.json();
    if (!res.ok || data.online === undefined) throw new Error(`Failed: status ${res.status}`);
  });

  // 16. AI Agent Chat
  await check('POST /api/ai/chat', async () => {
    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What is the current stock status of Paracetamol in H01?', hospitalId: 'H01' })
    });
    const data = await res.json();
    if (!res.ok || !data.reply) throw new Error(`Failed: ${data.error || res.status}`);
  });

  // 17. IoT Images
  await check('GET /api/iot/images', async () => {
    const res = await fetch(`${baseUrl}/api/iot/images`);
    const data = await res.json();
    if (!res.ok || !data.images) throw new Error(`Failed: status ${res.status}`);
  });

  // 18. Upload GET endpoint
  await check('GET /api/upload', async () => {
    const res = await fetch(`${baseUrl}/api/upload`);
    const data = await res.json();
    if (!res.ok || data.status !== 'online') throw new Error(`Failed: status ${res.status}`);
  });

  // 19. Upload Latest Images
  await check('GET /api/upload/latest', async () => {
    const res = await fetch(`${baseUrl}/api/upload/latest`);
    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) throw new Error(`Failed: status ${res.status}`);
  });

  // 20. Direct ESP32 Upload POST endpoint (simulating camera payload)
  await check('POST /api/upload (ESP32-CAM Image Upload)', async () => {
    // 1x1 transparent GIF base64 or small JPEG
    const testBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const res = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-action': 'ADD',
        'x-medicine': 'Paracetamol 500mg',
        'x-quantity': '2.5',
        'x-batch': 'BATCH-TEST-E2E',
        'x-hospital-id': 'H01'
      },
      body: JSON.stringify({
        image_data: testBase64,
        source: 'ESP32-CAM-TEST'
      })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || `Status ${res.status}`);
  });

  console.log('\n=======================================');
  console.log(`🏁 TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log('=======================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runE2ETests().catch(err => {
  console.error('Fatal test suite error:', err);
  process.exit(1);
});
