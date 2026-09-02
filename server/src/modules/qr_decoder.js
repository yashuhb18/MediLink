/**
 * MediLink AI — High-Performance Multi-Pass Edge Vision QR Decoder
 */
const { Jimp } = require('jimp');
const jsQR = require('jsqr');

/**
 * Helper to run jsQR on a Jimp image
 */
function tryDecode(jimpImg) {
  if (!jimpImg || !jimpImg.bitmap) return null;
  const { width, height, data } = jimpImg.bitmap;
  const clamped = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  return jsQR(clamped, width, height, { inversionAttempts: "attemptBoth" });
}

/**
 * Decode QR Code with multi-pass contrast, adaptive binarization, and center-crop
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

    // Pass 2: Greyscale + Contrast (0.4)
    if (!code) {
      const p2 = baseImg.clone().greyscale().contrast(0.4);
      code = tryDecode(p2);
    }

    // Pass 3: Greyscale + High Contrast (0.75) + Normalize
    if (!code) {
      const p3 = baseImg.clone().greyscale().normalize().contrast(0.75);
      code = tryDecode(p3);
    }

    // Pass 4: Inverted colors (for screen glare)
    if (!code) {
      const p4 = baseImg.clone().greyscale().invert().contrast(0.5);
      code = tryDecode(p4);
    }

    // Pass 5: Center-crop (focus on the screen QR area)
    if (!code) {
      const w = baseImg.bitmap.width;
      const h = baseImg.bitmap.height;
      if (w > 100 && h > 100) {
        const cropW = Math.floor(w * 0.8);
        const cropH = Math.floor(h * 0.8);
        const cropX = Math.floor((w - cropW) / 2);
        const cropY = Math.floor((h - cropH) / 2);
        const p5 = baseImg.clone().crop({ x: cropX, y: cropY, w: cropW, h: cropH }).greyscale().contrast(0.6);
        code = tryDecode(p5);
      }
    }

    // Pass 6: Scaled up 1.5x (small QR in frame)
    if (!code) {
      const p6 = baseImg.clone().scale(1.5).greyscale().contrast(0.5);
      code = tryDecode(p6);
    }

    // Pass 7: Scaled down 0.75x (reduces noise on low-res cameras)
    if (!code) {
      const p7 = baseImg.clone().scale(0.75).greyscale().contrast(0.6);
      code = tryDecode(p7);
    }

    if (code && code.data) {
      console.log(`[QR Decoder] 🎯 Successfully Decoded Optical QR: "${code.data}"`);
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

    console.log('[QR Decoder] No optical QR pattern detected in frame passes.');
    return { found: false, data: null, payload: null };
  } catch (err) {
    console.warn('[QR Decoder] Decoding warning:', err.message);
    return { found: false, error: err.message };
  }
}

module.exports = { decodeQRFromBuffer };
