/**
 * MediLink AI — Enhanced Edge Vision QR & Barcode Auto-Decoder
 */
const { Jimp } = require('jimp');
const jsQR = require('jsqr');

/**
 * Helper to run jsQR on a Jimp image
 */
function tryDecode(jimpImg) {
  const { width, height, data } = jimpImg.bitmap;
  const clamped = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  return jsQR(clamped, width, height, { inversionAttempts: "attemptBoth" });
}

/**
 * Decode QR Code with multi-pass contrast & adaptive binarization
 * @param {Buffer} imageBuffer
 */
async function decodeQRFromBuffer(imageBuffer) {
  try {
    let baseImg;
    if (Jimp.read) {
      baseImg = await Jimp.read(imageBuffer);
    } else {
      const jimpModule = require('jimp');
      baseImg = await (jimpModule.read || jimpModule)(imageBuffer);
    }

    // Pass 1: Raw image
    let code = tryDecode(baseImg);

    // Pass 2: Greyscale + High Contrast
    if (!code) {
      const p2 = baseImg.clone().greyscale().contrast(0.5);
      code = tryDecode(p2);
    }

    // Pass 3: Greyscale + Normalize + Extra Contrast
    if (!code) {
      const p3 = baseImg.clone().greyscale().normalize().contrast(0.7);
      code = tryDecode(p3);
    }

    // Pass 4: Scaled 1.5x + Contrast
    if (!code) {
      const p4 = baseImg.clone().scale(1.5).greyscale().contrast(0.6);
      code = tryDecode(p4);
    }

    // Pass 5: Scaled 0.75x (reduces blur noise)
    if (!code) {
      const p5 = baseImg.clone().scale(0.75).greyscale().contrast(0.6);
      code = tryDecode(p5);
    }

    if (code && code.data) {
      let parsedPayload = null;
      try {
        if (code.data.startsWith('{')) {
          parsedPayload = JSON.parse(code.data);
        } else if (code.data.startsWith('ML:')) {
          // Compact format: ML:ACTION:REQUEST_ID:BATCH:WEIGHT:MEDICINE
          const parts = code.data.split(':');
          parsedPayload = {
            prefix: parts[0],
            action: parts[1] || 'TRANSFER_DISPATCH',
            requestId: parts[2] || 'REQ-1001',
            batch: parts[3] || 'PA-902',
            weightKg: parseFloat(parts[4]) || 1.0,
            medicine: parts[5] || 'Paracetamol 500mg'
          };
        } else {
          parsedPayload = { rawText: code.data };
        }
      } catch (e) {
        parsedPayload = { rawText: code.data };
      }

      return {
        found: true,
        data: code.data,
        payload: parsedPayload,
        location: code.location
      };
    }

    return { found: false, data: null, payload: null };
  } catch (err) {
    console.warn('[QR Decoder] Decoding warning:', err.message);
    return { found: false, error: err.message };
  }
}

module.exports = { decodeQRFromBuffer };
