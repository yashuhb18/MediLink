const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

async function runTest() {
  console.log('🧪 ==========================================');
  console.log('🧪 MediLink QR Code Count & Header Test Suite');
  console.log('🧪 ==========================================\n');

  let uploadUrl = 'http://localhost:5000/api/upload';
  try {
    const tunnelInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'active_tunnel.json'), 'utf8'));
    if (tunnelInfo && tunnelInfo.uploadUrl) {
      console.log('🌐 Active Cloudflare Tunnel URL Detected:', tunnelInfo.uploadUrl);
      uploadUrl = tunnelInfo.uploadUrl;
    }
  } catch (e) {}

  const testBatch = `BATCH-TEST-${Date.now().toString().slice(-4)}`;
  const testQrId = `QR-${testBatch}`;
  const initialCount = 5;

  console.log(`📌 1. Registering New QR Code: ${testQrId} with initialCount = ${initialCount}`);
  const regRes = await fetch('http://localhost:5000/api/iot/qr-codes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      qrId: testQrId,
      medicine: 'Paracetamol 500mg (Test Batch)',
      batch: testBatch,
      count: initialCount,
      initialCount: initialCount,
      weightKg: 1.0,
      dosageUnit: 'Strips',
      hospitalId: 'H01',
      action: 'ADD'
    })
  });

  const regData = await regRes.json();
  console.log('   Registration Status:', regRes.status, 'Current Count:', regData.qrCode?.count);

  if (regData.qrCode?.count !== initialCount) {
    throw new Error(`Expected initial count ${initialCount}, got ${regData.qrCode?.count}`);
  }

  // 2. Generate actual QR code Image Buffer (Optical payload)
  const qrPayload = {
    qrId: testQrId,
    action: "ADD",
    medicine: "Paracetamol 500mg (Test Batch)",
    batch: testBatch,
    count: initialCount,
    weightKg: 1.0,
    destHospital: "H01"
  };

  const qrBuffer = await QRCode.toBuffer(JSON.stringify(qrPayload), {
    errorCorrectionLevel: 'M',
    type: 'png',
    margin: 2,
    width: 350
  });
  const base64Image = qrBuffer.toString('base64');

  // Helper to send upload scan with custom header
  async function sendScan(headerAction, stepDescription) {
    console.log(`\n📸 ---> ${stepDescription}`);
    console.log(`   Sending Optical Scan with Header [x-action: ${headerAction}] to ${uploadUrl}...`);

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-action': headerAction,
        'x-medicine': 'Paracetamol 500mg (Test Batch)',
        'x-batch': testBatch,
        'x-weight': '1.0',
        'x-hospital-id': 'H01'
      },
      body: JSON.stringify({
        image_data: base64Image,
        source: 'ESP32-CAM-TEST',
        batch: testBatch,
        medicine: 'Paracetamol 500mg (Test Batch)'
      })
    });

    const rawText = await res.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error(`   Server returned non-JSON response (status ${res.status}):`, rawText.slice(0, 300));
      throw e;
    }
    console.log(`   Server Status: ${res.status}`);
    console.log(`   Response Message: "${data.message}"`);
    console.log(`   QR Found: ${data.qrFound}`);
    console.log(`   QR ID: ${data.qrId}`);
    console.log(`   Previous Count: ${data.previousCount} ➔ New Count: ${data.qrCount}`);
    return data;
  }

  // Step 3: Scan with x-action: ADD (5 -> 6)
  const resAdd1 = await sendScan('ADD', 'STEP 2: Scan QR with [x-action: ADD] ➔ Expect Count: 6');
  if (resAdd1.qrCount !== 6) throw new Error(`Expected count 6, got ${resAdd1.qrCount}`);

  // Step 4: Scan with x-action: ADD (6 -> 7)
  const resAdd2 = await sendScan('ADD', 'STEP 3: Scan QR with [x-action: ADD] ➔ Expect Count: 7');
  if (resAdd2.qrCount !== 7) throw new Error(`Expected count 7, got ${resAdd2.qrCount}`);

  // Step 5: Scan with x-action: REMOVE (7 -> 6)
  const resRem1 = await sendScan('REMOVE', 'STEP 4: Scan QR with [x-action: REMOVE] ➔ Expect Count: 6');
  if (resRem1.qrCount !== 6) throw new Error(`Expected count 6, got ${resRem1.qrCount}`);

  // Step 6: Scan with x-action: REMOVE (6 -> 5)
  const resRem2 = await sendScan('REMOVE', 'STEP 5: Scan QR with [x-action: REMOVE] ➔ Expect Count: 5');
  if (resRem2.qrCount !== 5) throw new Error(`Expected count 5, got ${resRem2.qrCount}`);

  // Step 7: Verify Database State & History via GET /api/iot/qr-codes/:qrId
  console.log(`\n📋 6. Verifying Database Record for ${testQrId}...`);
  const getRes = await fetch(`http://localhost:5000/api/iot/qr-codes/${testQrId}`);
  const getData = await getRes.json();
  console.log('   Final Persisted QR Document:');
  console.log(`     - QR ID: ${getData.qrCode?.qrId}`);
  console.log(`     - Medicine: ${getData.qrCode?.medicine}`);
  console.log(`     - Batch: ${getData.qrCode?.batch}`);
  console.log(`     - Final Count Variable: ${getData.qrCode?.count}`);
  console.log(`     - Total Scan History Records: ${getData.qrCode?.scanHistory?.length}`);

  if (getData.qrCode?.count === 5 && getData.qrCode?.scanHistory?.length === 4) {
    console.log('\n🎉 =========================================================');
    console.log('🎉 ALL TESTS PASSED! QR Count increment & decrement verified!');
    console.log('🎉 =========================================================\n');
  } else {
    throw new Error('Verification mismatch');
  }
}

runTest().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
