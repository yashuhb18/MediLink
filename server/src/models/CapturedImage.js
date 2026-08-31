const mongoose = require('mongoose');

const CapturedImageSchema = new mongoose.Schema({
  image_data: { type: String, required: true },
  source: { type: String, default: "ESP32-CAM" },
  medicine: { type: String, default: "Auto-Detected Medicine" },
  batch: { type: String, default: "Auto-Detect" },
  action: { type: String, default: "ADD" },
  weightKg: { type: Number, default: 1.0 },
  decodedPayload: { type: mongoose.Schema.Types.Mixed },
  glmReasoning: { type: String },
  hospitalId: { type: String, default: "H01" },
  requestId: { type: String },
  inventoryItemId: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.CapturedImage || mongoose.model('CapturedImage', CapturedImageSchema);
