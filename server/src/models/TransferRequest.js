const mongoose = require('mongoose');

const transferRequestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  requestingHospitalId: { type: String, required: true, index: true },
  sourceHospitalId: { type: String, required: true, index: true },
  medicine: { type: String, required: true },
  quantityKg: { type: Number, required: true },
  dosageUnit: { type: String, default: 'Strips' },
  packageCount: { type: Number, default: 10 },
  urgency: { type: String, default: 'MEDIUM' },
  reason: { type: String, default: '' },
  status: { type: String, default: 'PENDING_SOURCE' },
  // Logistics & Driver Coordination
  driverMode: { type: String, default: 'SENDER_DRIVER_REQUIRED' }, // REQUESTER_DRIVER | SENDER_DRIVER_REQUIRED | EXTERNAL_COURIER
  driverName: { type: String, default: null },
  driverPhone: { type: String, default: null },
  vehicleNumber: { type: String, default: null },
  requesterContactName: { type: String, default: 'Dr. Ramesh Kumar (ICU Incharge)' },
  requesterContactPhone: { type: String, default: '+91 98450 12345' },
  senderContactName: { type: String, default: 'Dr. Ananya Sharma (Chief Pharmacist)' },
  senderContactPhone: { type: String, default: '+91 98800 67890' },
  // Live GPS Telemetry
  transitGps: {
    lat: { type: Number, default: 12.9716 },
    lng: { type: Number, default: 77.5946 },
    progressPercent: { type: Number, default: 0 },
    currentSpeedKmH: { type: Number, default: 0 },
    temperatureC: { type: Number, default: 4.2 },
    etaMinutes: { type: Number, default: 45 },
    currentLocationName: { type: String, default: 'Hospital Dispatch Bay' }
  },
  liveTrackingStatus: { type: String, default: 'PREPARING_CONSIGNMENT' },
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
