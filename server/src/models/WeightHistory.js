const mongoose = require('mongoose');

const weightHistorySchema = new mongoose.Schema({
  inventoryItemId: { type: String, required: true, index: true },
  timestamp: { type: Number, required: true },
  weightKg: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('WeightHistory', weightHistorySchema);
