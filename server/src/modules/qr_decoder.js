/**
 * MediLink AI — Edge Vision QR & Barcode Auto-Decoder
 */
const { Jimp } = require('jimp');
const jsQR = require('jsqr');

/**
 * Decode QR Code from an image buffer (JPEG/PNG)
 * @param {Buffer} imageBuffer
 * @returns {Promise<{found: boolean, data: string|null, payload: any|null, error?: string}>}
 */
async function decodeQRFromBuffer(imageBuffer) {
  try {
    let jimpImage;
    // Handle Jimp v1 / v0 compatibility
    if (Jimp.read) {
      jimpImage = await Jimp.read(imageBuffer);
    } else {
      const jimpModule = require('jimp');
      jimpImage = await (jimpModule.read || jimpModule)(imageBuffer);
    }

    const { width, height, data } = jimpImage.bitmap;
    const clampedArray = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);

    const code = jsQR(clampedArray, width, height, {
      inversionAttempts: "attemptBoth"
    });

    if (code && code.data) {
      let parsedPayload = null;
      try {
        parsedPayload = JSON.parse(code.data);
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
