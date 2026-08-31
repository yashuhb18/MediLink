const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  hospitalId: { type: String, required: true, index: true },
  boxId: { type: String, required: true },
  loadCellId: { type: String, required: true },
  rfidUid: { type: String, required: true },
  medicine: { type: String, required: true },
  batch: { type: String, required: true },
  currentStockKg: { type: Number, required: true },
  minThresholdKg: { type: Number, required: true },
  expiryDate: { type: String, required: true },
  shelfPosition: { type: String, required: true },
  locked: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Inventory', inventorySchema);
