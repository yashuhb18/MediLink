const mongoose = require('mongoose');

const transferRequestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  requestingHospitalId: { type: String, required: true, index: true },
  sourceHospitalId: { type: String, required: true, index: true },
  medicine: { type: String, required: true },
  quantityKg: { type: Number, required: true },
  urgency: { type: String, default: 'MEDIUM' },
  reason: { type: String, default: '' },
  status: { type: String, default: 'PENDING_SOURCE' },
  rfidVerified: { type: Boolean, default: false },
  weightVerified: { type: Boolean, default: false },
  rfidUidScanned: { type: String, default: null },
  inventoryItemId: { type: String, default: null },
  boxId: { type: String, default: null },
  shelfPosition: { type: String, default: null },
  targetRfidUid: { type: String, default: null },
  parentRequestId: { type: String, default: null },
  isSplit: { type: Boolean, default: false },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() },
  acceptedAt: { type: String, default: null },
  dispatchedAt: { type: String, default: null },
  receivedAt: { type: String, default: null },
  rejectReason: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('TransferRequest', transferRequestSchema);
