const QRCode = require('qrcode');
const { decodeQRFromBuffer } = require('./src/modules/qr_decoder');

async function test() {
  const samplePayload = {
    token: "ML-TX-9901",
    action: "TRANSFER_DISPATCH",
    medicine: "Paracetamol 500mg",
    batch: "PA-902",
    weightKg: 1.0,
    requestId: "REQ-1002"
  };

  const qrBuffer = await QRCode.toBuffer(JSON.stringify(samplePayload), { type: 'png', width: 300 });
  console.log('Generated QR buffer size:', qrBuffer.length);

  const result = await decodeQRFromBuffer(qrBuffer);
  console.log('DECODER RESULT:', result);
  if (result.found && result.payload.medicine === "Paracetamol 500mg") {
    console.log('✅ QR DECODER TEST PASSED!');
  } else {
    console.error('❌ QR DECODER FAILED');
  }
}

test();
