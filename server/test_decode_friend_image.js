require('dotenv').config();
const { connectMongoDB } = require('./src/config/mongodb');
const CapturedImage = require('./src/models/CapturedImage');
const { decodeQRFromBuffer } = require('./src/modules/qr_decoder');
const fs = require('fs');

async function testFriendImage() {
  await connectMongoDB();
  const latestImage = await CapturedImage.findOne({ source: 'ESP32-CAM' }).sort({ createdAt: -1 });
  if (!latestImage) {
    console.log('No image found');
    process.exit(0);
  }

  console.log(`Latest image ID: ${latestImage._id}`);
  console.log(`Created At: ${latestImage.createdAt}`);
  console.log(`Data length: ${latestImage.image_data.length}`);

  const buffer = Buffer.from(latestImage.image_data, 'base64');
  fs.writeFileSync('latest_friend_capture.jpg', buffer);
  console.log('Saved latest capture to server/latest_friend_capture.jpg (Buffer bytes: ' + buffer.length + ')');

  const decodeResult = await decodeQRFromBuffer(buffer);
  console.log('DECODE RESULT ON FRIEND CAPTURE:');
  console.log(JSON.stringify(decodeResult, null, 2));

  process.exit(0);
}

testFriendImage();
