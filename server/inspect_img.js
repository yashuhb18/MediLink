require('dotenv').config();
const { connectMongoDB, mongoose } = require('./src/config/mongodb');

const capturedImageSchema = new mongoose.Schema({
  image_data: { type: String, required: true },
  source: { type: String, default: 'ESP32-CAM' },
  captured_at: { type: Date, default: Date.now },
  notes: { type: String, default: '' },
  requestId: { type: String, default: null },
  inventoryItemId: { type: String, default: null }
}, { timestamps: true });

const CapturedImage = mongoose.models.CapturedImage || mongoose.model('CapturedImage', capturedImageSchema);

async function inspectLatest() {
  await connectMongoDB();
  const latest = await CapturedImage.findById('6a947012678d5c46606c5a03') || await CapturedImage.findOne().sort({ createdAt: -1 });
  if (latest) {
    console.log('ID:', latest._id.toString());
    console.log('Source:', latest.source);
    console.log('Data Length:', latest.image_data?.length);
    console.log('Prefix:', latest.image_data?.substring(0, 100));
    
    // Check if it is valid JPEG or PNG header
    let raw = latest.image_data.replace(/^data:image\/\w+;base64,/, '');
    const buf = Buffer.from(raw, 'base64');
    console.log('Decoded Buffer Size (bytes):', buf.length);
    console.log('Hex Header:', buf.subarray(0, 16).toString('hex'));
    if (buf[0] === 0xFF && buf[1] === 0xD8) {
      console.log('Format: JPEG');
    } else if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
      console.log('Format: PNG');
    } else if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
      console.log('Format: GIF');
    } else if (buf[0] === 0x42 && buf[1] === 0x4D) {
      console.log('Format: BMP (Bitmap)');
    } else {
      console.log('Format: RAW / Uncompressed grayscale bytes');
    }
  }
  process.exit(0);
}

inspectLatest();
