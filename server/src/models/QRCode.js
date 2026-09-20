const mongoose = require('mongoose');

const qrCodeSchema = new mongoose.Schema({
  qrId: { type: String, required: true, unique: true, index: true },
  medicine: { type: String, required: true },
  batch: { type: String, required: true, index: true },
  count: { type: Number, default: 1 },
  initialCount: { type: Number, default: 1 },
  weightKg: { type: Number, default: 1.0 },
  dosageUnit: { type: String, default: 'Strips' },
  hospitalId: { type: String, default: 'H01' },
  action: { type: String, default: 'ADD' },
  rawQrData: { type: String, default: '' },
  lastScannedNode: { type: String, default: 'Node_1' },
  scanHistory: [
    {
      action: { type: String },
      headerUsed: { type: String },
      previousCount: { type: Number },
      newCount: { type: Number },
      timestamp: { type: Date, default: Date.now },
      source: { type: String, default: 'Node_1' },
      deviceName: { type: String, default: 'Node_1' }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('QRCode', qrCodeSchema);
