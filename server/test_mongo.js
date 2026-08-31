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

async function check() {
  await connectMongoDB();
  const count = await CapturedImage.countDocuments();
  const latest = await CapturedImage.findOne().sort({ createdAt: -1 });
  console.log('\n=======================================');
  console.log('✅ TOTAL IMAGES IN MONGODB ATLAS:', count);
  if (latest) {
    console.log('Latest Document ID:', latest._id.toString());
    console.log('Source Device:', latest.source);
    console.log('Upload Timestamp:', latest.createdAt);
  }
  console.log('=======================================\n');
  process.exit(0);
}

check();
