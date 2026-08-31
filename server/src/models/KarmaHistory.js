const mongoose = require('mongoose');

const karmaHistorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  hospitalId: { type: String, required: true, index: true },
  change: { type: Number, required: true },
  reason: { type: String, required: true },
  timestamp: { type: String, default: () => new Date().toISOString() }
}, { timestamps: true });

module.exports = mongoose.model('KarmaHistory', karmaHistorySchema);
