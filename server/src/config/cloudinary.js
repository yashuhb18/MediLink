/**
 * MediLink AI — Cloudinary Cloud Storage Integration
 */
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary with environment variables
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL
  });
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'medilink-pharma',
    api_key: process.env.CLOUDINARY_API_KEY || '123456789012345',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'abcdefghijklmnopqrstuvwxyz01234',
    secure: true
  });
}

/**
 * Upload Base64 Image to Cloudinary CDN
 * @param {string} base64Data - Raw base64 string or dataURI
 * @param {string} folder - Target folder in Cloudinary
 * @returns {Promise<{ url: string, public_id: string } | null>}
 */
async function uploadToCloudinary(base64Data, folder = 'medilink_esp32_scans') {
  if (!base64Data) return null;

  try {
    const formattedData = base64Data.startsWith('data:')
      ? base64Data
      : `data:image/jpeg;base64,${base64Data}`;

    const result = await cloudinary.uploader.upload(formattedData, {
      folder: folder,
      resource_type: 'image',
      transformation: [
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ]
    });

    console.log(`[Cloudinary] ✅ Uploaded image successfully: ${result.secure_url}`);
    return {
      url: result.secure_url,
      public_id: result.public_id
    };
  } catch (err) {
    console.warn(`[Cloudinary] ⚠️ Cloudinary upload warning:`, err.message);
    return null;
  }
}

module.exports = {
  cloudinary,
  uploadToCloudinary
};
