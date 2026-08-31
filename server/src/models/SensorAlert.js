const mongoose = require('mongoose');

const sensorAlertSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  hospitalId: { type: String, required: true, index: true },
  loadCellId: { type: String, required: true },
  type: { type: String, required: true },
  message: { type: String, required: true },
  severity: { type: String, default: 'MEDIUM' },
  resolved: { type: Boolean, default: false },
  timestamp: { type: String, default: () => new Date().toISOString() }
}, { timestamps: true });

module.exports = mongoose.model('SensorAlert', sensorAlertSchema);
