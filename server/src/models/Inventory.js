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
  dosageForm: { type: String, default: 'Tablets' }, // Tablets, Syrups, Injections, Ointments, Bulk Powders
  dosageUnit: { type: String, default: 'Strips' }, // Strips, Bottles, Vials, Tubes, kg, Liters, Boxes
  packageCount: { type: Number, default: 100 },
  unitDescription: { type: String, default: '100 Strips' },
  expiryDate: { type: String, required: true },
  shelfPosition: { type: String, required: true },
  locked: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Inventory', inventorySchema);
