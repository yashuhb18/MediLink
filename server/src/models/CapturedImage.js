const mongoose = require('mongoose');

const CapturedImageSchema = new mongoose.Schema({
  image_data: { type: String, required: true },
  source: { type: String, default: "ESP32-CAM" },
  requestId: { type: String },
  inventoryItemId: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.CapturedImage || mongoose.model('CapturedImage', CapturedImageSchema);
