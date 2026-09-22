/**
 * MediLink AI — High-Performance Dual-Engine Optical QR Decoder (jsQR + ZXing)
 */
const { Jimp } = require('jimp');
const jsQR = require('jsqr');
const { 
  MultiFormatReader, 
  BarcodeFormat, 
  DecodeHintType, 
  RGBLuminanceSource, 
  BinaryBitmap, 
  HybridBinarizer,
  GlobalHistogramBinarizer 
} = require('@zxing/library');

/**
 * Helper to run jsQR on a Jimp image
 */
function tryJsQR(jimpImg) {
  if (!jimpImg || !jimpImg.bitmap) return null;
  const { width, height, data } = jimpImg.bitmap;
  const clamped = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  const code = jsQR(clamped, width, height, { inversionAttempts: "attemptBoth" });
  return code ? { data: code.data, location: code.location, engine: 'jsQR' } : null;
}

/**
 * Helper to run ZXing on a Jimp image
 */
function tryZXing(jimpImg) {
  if (!jimpImg || !jimpImg.bitmap) return null;
  try {
    const { width, height } = jimpImg.bitmap;
    const rawBytes = new Uint8ClampedArray(width * height * 4);
    jimpImg.bitmap.data.copy(rawBytes);

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new MultiFormatReader();
    reader.setHints(hints);

    // Pass A: HybridBinarizer
    try {
      const lum = new RGBLuminanceSource(rawBytes, width, height);
      const bmp = new BinaryBitmap(new HybridBinarizer(lum));
      const res = reader.decode(bmp);
      if (res && res.getText()) {
        return { data: res.getText(), engine: 'ZXing-Hybrid' };
      }
    } catch (e) {}

    // Pass B: GlobalHistogramBinarizer
    try {
      const lum = new RGBLuminanceSource(rawBytes, width, height);
      const bmp = new BinaryBitmap(new GlobalHistogramBinarizer(lum));
      const res = reader.decode(bmp);
      if (res && res.getText()) {
        return { data: res.getText(), engine: 'ZXing-Histogram' };
      }
    } catch (e) {}

    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Run both engines on a Jimp image pass
 */
function decodePass(jimpImg) {
  return tryJsQR(jimpImg) || tryZXing(jimpImg);
}

/**
 * Decode QR Code with multi-pass contrast, binarization, padding, and center-crop
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

    // Do NOT aggressively downsample: preserve full resolution for sharp QR modules
    let code = decodePass(baseImg);

    // Pass 2: Greyscale + Contrast (0.4)
    if (!code) {
      const p2 = baseImg.clone().greyscale().contrast(0.4);
      code = decodePass(p2);
    }

    // Pass 3: Greyscale + High Contrast (0.75) + Normalize
    if (!code) {
      const p3 = baseImg.clone().greyscale().normalize().contrast(0.75);
      code = decodePass(p3);
    }

    // Pass 4: Inverted colors (for phone/screen glare)
    if (!code) {
      const p4 = baseImg.clone().greyscale().invert().contrast(0.5);
      code = decodePass(p4);
    }

    // Pass 5: Center-crop (focus on center 80% where QR typically sits)
    if (!code) {
      const w = baseImg.bitmap.width;
      const h = baseImg.bitmap.height;
      if (w > 120 && h > 120) {
        const cropW = Math.floor(w * 0.85);
        const cropH = Math.floor(h * 0.85);
        const cropX = Math.floor((w - cropW) / 2);
        const cropY = Math.floor((h - cropH) / 2);
        const p5 = baseImg.clone().crop({ x: cropX, y: cropY, w: cropW, h: cropH }).greyscale().contrast(0.5);
        code = decodePass(p5);
      }
    }

    if (code && code.data) {
      console.log(`[QR Decoder] 🎯 Successfully Decoded Optical QR via ${code.engine}: "${code.data}"`);
      let parsedPayload = null;
      try {
        const raw = code.data.trim();
        if (raw.startsWith('{')) {
          parsedPayload = JSON.parse(raw);
          parsedPayload.medicine = parsedPayload.medicine || parsedPayload.m || parsedPayload.med || parsedPayload.name || parsedPayload.product || null;
          parsedPayload.batch = parsedPayload.batch || parsedPayload.b || parsedPayload.lot || parsedPayload.batchId || null;
          parsedPayload.count = parsedPayload.count !== undefined ? parseInt(parsedPayload.count) : (parsedPayload.c !== undefined ? parseInt(parsedPayload.c) : (parsedPayload.packageCount !== undefined ? parseInt(parsedPayload.packageCount) : 1));
          parsedPayload.weightKg = parsedPayload.weightKg !== undefined ? parseFloat(parsedPayload.weightKg) : (parsedPayload.w !== undefined ? parseFloat(parsedPayload.w) : 1.0);
          parsedPayload.action = (parsedPayload.action || parsedPayload.act || parsedPayload.a || 'ADD').toUpperCase();
          parsedPayload.destHospital = parsedPayload.destHospital || parsedPayload.hospital || parsedPayload.h || null;
          parsedPayload.qrId = parsedPayload.qrId || (parsedPayload.batch ? `QR-${parsedPayload.batch}` : null);
        } else if (raw.startsWith('ML:') || raw.startsWith('MED:')) {
          // Dynamic token parsing: ML:ACTION:HOSPITAL:MEDICINE:BATCH:COUNT:WEIGHT
          const parts = raw.split(':').map(p => p.trim());
          let action = 'ADD';
          let batch = null;
          let medicine = null;
          let count = 1;
          let weightKg = 1.0;
          let qrId = null;
          let hospital = null;

          for (let i = 1; i < parts.length; i++) {
            const p = parts[i];
            if (!p) continue;
            const up = p.toUpperCase();
            if (['ADD', 'REMOVE', 'TRANSFER_DISPATCH', 'TRANSFER_RECEIVE', 'DISPATCH', 'RECEIVE', 'DEDUCT', '+', '-'].includes(up)) {
              action = up;
            } else if (up === 'H01' || up === 'H02' || up === 'H03') {
              hospital = up;
            } else if (p.startsWith('QR-')) {
              qrId = p;
            } else if (p.startsWith('BATCH-') || p.startsWith('LOT-') || /^[A-Z0-9]{2,4}-[0-9]{3,}$/.test(p)) {
              batch = p;
            } else if (!isNaN(parseFloat(p)) && isFinite(p) && !p.includes('-')) {
              const num = parseFloat(p);
              if (num > 10) count = Math.round(num);
              else weightKg = num;
            } else if (!medicine) {
              medicine = p;
            }
          }

          parsedPayload = {
            prefix: parts[0],
            action,
            destHospital: hospital,
            batch: batch || (qrId ? qrId.replace('QR-', '') : null),
            weightKg,
            medicine,
            count,
            qrId: qrId || (batch ? `QR-${batch}` : null)
          };
        } else {
          // Raw string (could be medicine name or batch UID or QR id)
          parsedPayload = {
            rawText: raw,
            qrId: raw.startsWith('QR-') ? raw : `QR-${raw}`,
            medicine: (!raw.startsWith('QR-') && !raw.startsWith('BATCH-')) ? raw : null,
            batch: (raw.startsWith('BATCH-') || raw.startsWith('QR-')) ? raw.replace('QR-', '') : null
          };
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
