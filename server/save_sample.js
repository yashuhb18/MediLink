require('dotenv').config();
const { connectMongoDB, mongoose } = require('./src/config/mongodb');
const fs = require('fs');

const capturedImageSchema = new mongoose.Schema({
  image_data: { type: String, required: true },
  source: { type: String, default: 'ESP32-CAM' },
}, { timestamps: true });

const CapturedImage = mongoose.models.CapturedImage || mongoose.model('CapturedImage', capturedImageSchema);

async function saveSample() {
  await connectMongoDB();
  const latest = await CapturedImage.findById('6a947012678d5c46606c5a03');
  if (latest) {
    const raw = latest.image_data.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync('sample_received.jpg', Buffer.from(raw, 'base64'));
    console.log('Saved sample_received.jpg (size:', fs.statSync('sample_received.jpg').size, 'bytes)');
  }
  process.exit(0);
}

saveSample();
