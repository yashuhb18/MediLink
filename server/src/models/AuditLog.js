const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  action: { type: String, required: true },
  detail: { type: String, required: true },
  hospitalId: { type: String, default: null },
  userId: { type: String, default: null },
  isImpersonation: { type: Boolean, default: false },
  timestamp: { type: String, default: () => new Date().toISOString() }
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
