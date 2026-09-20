/**
 * MediLink AI — Multi-Database Access Layer (Memory / Firestore / MongoDB Atlas)
 *
 * Supported DB_MODE values in .env:
 *   - "memory"  : Uses in-memory data store (instant zero-config development)
 *   - "mongodb" or "atlas" : Connects to MongoDB Atlas via Mongoose
 *   - "firestore": Connects to Firebase Firestore via Admin SDK
 */

const admin = require('firebase-admin');
require('dotenv').config();
const { connectMongoDB } = require('./mongodb');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const Inventory = require('../models/Inventory');
const TransferRequest = require('../models/TransferRequest');
const KarmaHistory = require('../models/KarmaHistory');
const AuditLog = require('../models/AuditLog');
const SensorAlert = require('../models/SensorAlert');
const WeightHistory = require('../models/WeightHistory');
const QRCode = require('../models/QRCode');
const bcrypt = require('bcryptjs');

let firestoreDb = null;
const dbMode = (process.env.DB_MODE || 'memory').toLowerCase();

// ─── Initialize Firebase (only if DB_MODE=firestore) ───
if (dbMode === 'firestore') {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      })
    });
    firestoreDb = admin.firestore();
    console.log('[Firebase] Connected to Firestore');
  } catch (err) {
    console.error('[Firebase] Failed to connect:', err.message);
    console.log('[Firebase] Falling back to in-memory database');
  }
}

// ─── Initialize MongoDB Atlas (only if DB_MODE=mongodb or DB_MODE=atlas) ───
if (dbMode === 'mongodb' || dbMode === 'atlas' || (process.env.MONGODB_URI && dbMode !== 'firestore' && dbMode !== 'memory')) {
  connectMongoDB().catch(err => {
    console.error('[MongoDB] Auto-connect error:', err.message);
  });
}

// ─── In-Memory Fallback Database ───
const memoryDb = {
  users: [
    { id: 'U01', email: 'admin@medilink.ai', passwordHash: bcrypt.hashSync('admin123', 10), name: 'Arun Patel', role: 'NETWORK_ADMIN', hospitalId: null, initials: 'AP' },
    { id: 'U02', email: 'nurse@h01.medilink.ai', passwordHash: bcrypt.hashSync('nurse123', 10), name: 'Priya Devi', role: 'CLINICAL_VIEWER', hospitalId: 'H01', initials: 'PD' },
    { id: 'U03', email: 'supervisor@h01.medilink.ai', passwordHash: bcrypt.hashSync('super123', 10), name: 'Dr. Ramesh Kumar', role: 'REQUESTING_SUPERVISOR', hospitalId: 'H01', initials: 'RK' },
    { id: 'U04', email: 'supervisor@h02.medilink.ai', passwordHash: bcrypt.hashSync('super123', 10), name: 'Dr. Ananya Sharma', role: 'SOURCE_SUPERVISOR', hospitalId: 'H02', initials: 'AS' },
    { id: 'U05', email: 'pharmacist@h02.medilink.ai', passwordHash: bcrypt.hashSync('pharm123', 10), name: 'Suresh Reddy', role: 'DISPATCH_PHARMACIST', hospitalId: 'H02', initials: 'SR' },
    { id: 'U06', email: 'supervisor@h03.medilink.ai', passwordHash: bcrypt.hashSync('super123', 10), name: 'Dr. Vikram Naik', role: 'SOURCE_SUPERVISOR', hospitalId: 'H03', initials: 'VN' }
  ],

  hospitals: [
    { id: 'H01', name: 'Mysore District Hospital', location: 'Mysore, KA', code: 'H01 / Mysore', lat: 12.2958, lng: 76.6394, status: 'ONLINE', karmaScore: 62, active: true, supervisor: 'Dr. Ramesh Kumar' },
    { id: 'H02', name: 'Bangalore Medical Center', location: 'Bangalore, KA', code: 'H02 / Bangalore', lat: 12.9716, lng: 77.5946, status: 'ONLINE', karmaScore: 78, active: true, supervisor: 'Dr. Ananya Sharma' },
    { id: 'H03', name: 'Mangalore General Hospital', location: 'Mangalore, KA', code: 'H03 / Mangalore', lat: 12.9141, lng: 74.856, status: 'ONLINE', karmaScore: 45, active: true, supervisor: 'Dr. Vikram Naik' }
  ],

  distances: { 'H01-H02': 140, 'H02-H01': 140, 'H01-H03': 250, 'H03-H01': 250, 'H02-H03': 350, 'H03-H02': 350 },

  inventory: [
    { id: 'INV-101', hospitalId: 'H01', boxId: 'BOX01', loadCellId: 'LC01', rfidUid: 'A101', medicine: 'Paracetamol', batch: 'P123', currentStockKg: 1.5, minThresholdKg: 1.0, expiryDate: '2026-09-25', shelfPosition: 'Shelf 2 / Position 3', locked: false },
    { id: 'INV-102', hospitalId: 'H01', boxId: 'BOX02', loadCellId: 'LC02', rfidUid: 'B202', medicine: 'Amoxicillin 500mg', batch: 'AM-882', currentStockKg: 0.7, minThresholdKg: 1.2, expiryDate: '2026-11-15', shelfPosition: 'Shelf 1 / Position 4', locked: false },
    { id: 'INV-103', hospitalId: 'H01', boxId: 'BOX03', loadCellId: 'LC03', rfidUid: 'C303', medicine: 'Insulin Glargine', batch: 'INS-990', currentStockKg: 2.1, minThresholdKg: 1.0, expiryDate: '2026-09-02', shelfPosition: 'Refrig-A / Pos 2', locked: false },
    { id: 'INV-104', hospitalId: 'H01', boxId: 'BOX04', loadCellId: 'LC04', rfidUid: 'D404', medicine: 'Azithromycin 250mg', batch: 'AZ-404', currentStockKg: 0.4, minThresholdKg: 0.8, expiryDate: '2025-10-01', shelfPosition: 'Shelf 3 / Position 1', locked: false },
    { id: 'INV-105', hospitalId: 'H01', boxId: 'BOX05', loadCellId: 'LC05', rfidUid: 'E505', medicine: 'Metformin 500mg', batch: 'MF-770', currentStockKg: 1.8, minThresholdKg: 1.0, expiryDate: '2027-03-15', shelfPosition: 'Shelf 4 / Position 2', locked: false },
    { id: 'INV-201', hospitalId: 'H02', boxId: 'BOX01-B', loadCellId: 'LC11', rfidUid: 'A101-B', medicine: 'Paracetamol', batch: 'P129', currentStockKg: 4.8, minThresholdKg: 1.0, expiryDate: '2027-01-30', shelfPosition: 'Bay 4 / Shelf 2', locked: false },
    { id: 'INV-202', hospitalId: 'H02', boxId: 'BOX02-B', loadCellId: 'LC12', rfidUid: 'B202-B', medicine: 'Amoxicillin 500mg', batch: 'AM-900', currentStockKg: 3.5, minThresholdKg: 1.2, expiryDate: '2027-03-20', shelfPosition: 'Bay 2 / Shelf 1', locked: false },
    { id: 'INV-203', hospitalId: 'H02', boxId: 'BOX03-B', loadCellId: 'LC13', rfidUid: 'C303-B', medicine: 'Insulin Glargine', batch: 'INS-112', currentStockKg: 1.8, minThresholdKg: 1.0, expiryDate: '2027-02-28', shelfPosition: 'Cold Room 1 / Shelf 1', locked: false },
    { id: 'INV-204', hospitalId: 'H02', boxId: 'BOX04-B', loadCellId: 'LC14', rfidUid: 'D404-B', medicine: 'Azithromycin 250mg', batch: 'AZ-555', currentStockKg: 2.3, minThresholdKg: 0.8, expiryDate: '2027-05-10', shelfPosition: 'Bay 3 / Shelf 4', locked: false },
    { id: 'INV-205', hospitalId: 'H02', boxId: 'BOX05-B', loadCellId: 'LC15', rfidUid: 'E505-B', medicine: 'Metformin 500mg', batch: 'MF-800', currentStockKg: 0.9, minThresholdKg: 1.0, expiryDate: '2027-04-22', shelfPosition: 'Bay 1 / Shelf 3', locked: false },
    { id: 'INV-301', hospitalId: 'H03', boxId: 'BOX01-M', loadCellId: 'LC21', rfidUid: 'A101-M', medicine: 'Paracetamol', batch: 'P111', currentStockKg: 2.2, minThresholdKg: 1.0, expiryDate: '2026-12-10', shelfPosition: 'Store B / Shelf 3', locked: false },
    { id: 'INV-302', hospitalId: 'H03', boxId: 'BOX02-M', loadCellId: 'LC22', rfidUid: 'B202-M', medicine: 'Amoxicillin 500mg', batch: 'AM-777', currentStockKg: 0.6, minThresholdKg: 1.2, expiryDate: '2027-01-05', shelfPosition: 'Store A / Shelf 1', locked: false },
    { id: 'INV-303', hospitalId: 'H03', boxId: 'BOX03-M', loadCellId: 'LC23', rfidUid: 'C303-M', medicine: 'Azithromycin 250mg', batch: 'AZ-333', currentStockKg: 1.6, minThresholdKg: 0.8, expiryDate: '2027-06-01', shelfPosition: 'Store C / Shelf 2', locked: false }
  ],

  weightHistory: {},

  transferRequests: [
    {
      id: 'REQ-1001',
      requestingHospitalId: 'H01',
      sourceHospitalId: 'H02',
      medicine: 'Paracetamol',
      quantityKg: 1.0,
      urgency: 'HIGH',
      reason: 'Urgent ICU stockout prevention (Load cell LC01 threshold alert)',
      status: 'ACCEPTED',
      rfidVerified: false,
      weightVerified: false,
      rfidUidScanned: null,
      inventoryItemId: 'INV-201',
      boxId: 'BOX01-B',
      shelfPosition: 'Bay 4 / Shelf 2',
      targetRfidUid: 'A101-B',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],

  auditLog: [],
  karmaHistory: [
    { id: 'KH-1', hospitalId: 'H01', change: 3, reason: 'Successful transfer received', timestamp: new Date(Date.now() - 86400000).toISOString() },
    { id: 'KH-2', hospitalId: 'H02', change: 5, reason: 'Accepted HIGH urgency request quickly', timestamp: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: 'KH-3', hospitalId: 'H02', change: 3, reason: 'RFID + Weight verified dispatch', timestamp: new Date(Date.now() - 86400000 * 3).toISOString() },
    { id: 'KH-4', hospitalId: 'H03', change: -5, reason: 'Rejected HIGH urgency request', timestamp: new Date(Date.now() - 86400000 * 5).toISOString() }
  ],
  sensorAlerts: [
    { id: 'SA-001', hospitalId: 'H01', loadCellId: 'LC04', type: 'STUCK_SENSOR', message: 'LC04 reading unchanged for 8h while others fluctuate', severity: 'MEDIUM', resolved: false, timestamp: new Date(Date.now() - 7200000).toISOString() }
  ],
  qrCodes: [],
  lockedBoxes: new Set(),
  _nextReqId: 1000
};

// Generate weight history for memory mode
function initWeightHistory() {
  const now = Date.now();
  const FOUR_HOURS = 4 * 3600000;
  const POINTS = 42;
  memoryDb.inventory.forEach(item => {
    const history = [];
    const startWeight = item.currentStockKg + (Math.random() * 1.5 + 0.3);
    for (let i = 0; i < POINTS; i++) {
      const t = now - (POINTS - i) * FOUR_HOURS;
      const decay = (startWeight - item.currentStockKg) * (i / POINTS);
      const noise = (Math.random() - 0.5) * 0.08;
      history.push({ timestamp: t, weightKg: Math.max(0, +(startWeight - decay + noise).toFixed(3)) });
    }
    history.push({ timestamp: now, weightKg: item.currentStockKg });
    memoryDb.weightHistory[item.id] = history;
  });
}
initWeightHistory();

// Helper to convert Mongoose doc to plain object without _id & __v
function toPlain(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  delete obj._id;
  delete obj.__v;
  return obj;
}

// ─── Unified DB Access Layer ───
const db = {
  get mode() {
    return (process.env.DB_MODE || 'memory').toLowerCase();
  },

  // ── Users ──
  async getUserByEmail(email) {
    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const user = await User.findOne({ email: email.toLowerCase() }).lean();
        if (user) return toPlain(user);
      } catch (err) {
        console.warn('[MongoDB] getUserByEmail fallback to memoryDb:', err.message);
        return memoryDb.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
      }
      return null;
    }
    if (this.mode === 'memory') return memoryDb.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
    try {
      const snap = await firestoreDb.collection('users').where('email', '==', email.toLowerCase()).limit(1).get();
      return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
    } catch (e) {
      return memoryDb.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
    }
  },

  async getUserById(id) {
    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const user = await User.findOne({ id }).lean();
        if (user) return toPlain(user);
      } catch (err) {
        console.warn('[MongoDB] getUserById fallback to memoryDb:', err.message);
        return memoryDb.users.find(u => u.id === id) || null;
      }
      return null;
    }
    if (this.mode === 'memory') return memoryDb.users.find(u => u.id === id) || null;
    try {
      const doc = await firestoreDb.collection('users').doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (e) {
      return memoryDb.users.find(u => u.id === id) || null;
    }
  },

  // ── Hospitals ──
  async getHospitals() {
    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const list = await Hospital.find({}).lean();
        if (list && list.length > 0) return list.map(toPlain);
      } catch (err) {
        console.warn('[MongoDB] getHospitals fallback to memoryDb:', err.message);
      }
    }
    if (this.mode === 'memory') return memoryDb.hospitals;
    try {
      const snap = await firestoreDb.collection('hospitals').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      return memoryDb.hospitals;
    }
  },

  async getHospital(id) {
    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const h = await Hospital.findOne({ id }).lean();
        if (h) return toPlain(h);
      } catch (err) {
        console.warn('[MongoDB] getHospital fallback to memoryDb:', err.message);
      }
    }
    if (this.mode === 'memory') return memoryDb.hospitals.find(h => h.id === id) || null;
    try {
      const doc = await firestoreDb.collection('hospitals').doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (e) {
      return memoryDb.hospitals.find(h => h.id === id) || null;
    }
  },

  async updateHospital(id, updates) {
    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const updated = await Hospital.findOneAndUpdate({ id }, updates, { returnDocument: 'after' }).lean();
        if (updated) return toPlain(updated);
      } catch (err) {
        console.warn('[MongoDB] updateHospital fallback to memoryDb:', err.message);
      }
    }
    if (this.mode === 'memory') {
      const h = memoryDb.hospitals.find(h => h.id === id);
      if (h) Object.assign(h, updates);
      return h;
    }
    try {
      await firestoreDb.collection('hospitals').doc(id).update(updates);
      return this.getHospital(id);
    } catch (e) {
      const h = memoryDb.hospitals.find(h => h.id === id);
      if (h) Object.assign(h, updates);
      return h;
    }
  },

  getDistance(a, b) {
    if (a === b) return 0;
    return memoryDb.distances[`${a}-${b}`] || 999;
  },

  // ── Inventory ──
  async getInventoryForHospital(hospitalId) {
    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const list = await Inventory.find({ hospitalId }).sort({ updatedAt: -1, createdAt: -1, _id: -1 }).lean();
        if (list) return list.map(toPlain);
      } catch (err) {
        console.warn('[MongoDB] getInventoryForHospital fallback:', err.message);
      }
    }
    if (this.mode === 'memory') return memoryDb.inventory.filter(i => i.hospitalId === hospitalId);
    try {
      const snap = await firestoreDb.collection('inventory').where('hospitalId', '==', hospitalId).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      return memoryDb.inventory.filter(i => i.hospitalId === hospitalId);
    }
  },

  async getAllInventory() {
    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const list = await Inventory.find({}).sort({ updatedAt: -1, createdAt: -1, _id: -1 }).lean();
        if (list) return list.map(toPlain);
      } catch (err) {
        console.warn('[MongoDB] getAllInventory fallback:', err.message);
      }
    }
    if (this.mode === 'memory') return memoryDb.inventory;
    try {
      const snap = await firestoreDb.collection('inventory').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      return memoryDb.inventory;
    }
  },

  async createInventoryItem(data) {
    const pkgCount = data.packageCount !== undefined ? parseInt(data.packageCount) : Math.round((parseFloat(data.currentStockKg) || 1.0) * 20);
    const dUnit = data.dosageUnit || 'Strips';
    const newItem = {
      id: data.id || `INV-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      hospitalId: data.hospitalId || 'H01',
      medicine: data.medicine,
      currentStockKg: parseFloat(data.currentStockKg) || 1.0,
      minThresholdKg: parseFloat(data.minThresholdKg) || 1.0,
      consumptionRatePerHour: data.consumptionRatePerHour || 0.05,
      batch: data.batch || 'BATCH-01',
      dosageForm: data.dosageForm || 'Tablets',
      dosageUnit: dUnit,
      packageCount: pkgCount,
      unitDescription: data.unitDescription || `${pkgCount} ${dUnit}`,
      expiryDate: data.expiryDate || new Date(Date.now() + 365*86400000).toISOString().split('T')[0],
      rfidUid: data.rfidUid || `TAG-${Math.floor(Math.random()*9000+1000)}`,
      boxId: data.boxId || 'BOX-A1',
      loadCellId: data.loadCellId || 'LC-01',
      shelfPosition: data.shelfPosition || 'Shelf 1A',
      sensorHygiene: 'OK',
      locked: false,
      lastSyncTime: new Date().toISOString()
    };
    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      const created = await Inventory.create(newItem);
      return toPlain(created);
    }
    if (this.mode === 'memory') {
      memoryDb.inventory.push(newItem);
      return newItem;
    }
    await firestoreDb.collection('inventory').doc(newItem.id).set(newItem);
    return newItem;
  },

  async getInventoryItem(id) {
    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const item = await Inventory.findOne({ id }).lean();
        if (item) return toPlain(item);
      } catch (err) {
        console.warn('[MongoDB] getInventoryItem fallback:', err.message);
      }
    }
    if (this.mode === 'memory') return memoryDb.inventory.find(i => i.id === id) || null;
    try {
      const doc = await firestoreDb.collection('inventory').doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (e) {
      return memoryDb.inventory.find(i => i.id === id) || null;
    }
  },

  async updateInventoryItem(id, updates) {
    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const updated = await Inventory.findOneAndUpdate({ id }, updates, { returnDocument: 'after' }).lean();
        if (updated && updates.currentStockKg !== undefined) {
          await WeightHistory.create({
            inventoryItemId: id,
            timestamp: Date.now(),
            weightKg: updates.currentStockKg
          }).catch(() => {});
        }
        if (updated) return toPlain(updated);
      } catch (err) {
        console.warn('[MongoDB] updateInventoryItem fallback:', err.message);
      }
    }
    if (this.mode === 'memory') {
      const item = memoryDb.inventory.find(i => i.id === id);
      if (item) Object.assign(item, updates);
      return item;
    }
    try {
      await firestoreDb.collection('inventory').doc(id).update(updates);
      return this.getInventoryItem(id);
    } catch (e) {
      const item = memoryDb.inventory.find(i => i.id === id);
      if (item) Object.assign(item, updates);
      return item;
    }
  },

  isExpired(item) {
    return Math.ceil((new Date(item.expiryDate) - new Date()) / 86400000) <= 7;
  },

  async getTransferableSurplus(hospitalId, medicine) {
    const items = (await this.getInventoryForHospital(hospitalId)).filter(i =>
      i.medicine.toLowerCase() === medicine.toLowerCase() && !this.isExpired(i) && !i.locked && !memoryDb.lockedBoxes.has(i.rfidUid)
    );
    let surplus = 0;
    items.forEach(i => { const above = i.currentStockKg - i.minThresholdKg; if (above > 0) surplus += above; });
    return { surplus: +surplus.toFixed(2), items };
  },

  getPublicAvailability(item, viewerHospitalId) {
    if (item.hospitalId === viewerHospitalId) {
      return { level: item.currentStockKg > item.minThresholdKg ? 'IN_STOCK' : item.currentStockKg > 0 ? 'LOW' : 'OUT', exactKg: item.currentStockKg.toFixed(2) };
    }
    if (item.currentStockKg > item.minThresholdKg * 1.5) return { level: 'AVAILABLE', exactKg: null };
    if (item.currentStockKg > 0) return { level: 'LOW', exactKg: null };
    return { level: 'UNAVAILABLE', exactKg: null };
  },

  // ── Weight History ──
  async getWeightHistory(inventoryItemId) {
    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const docs = await WeightHistory.find({ inventoryItemId }).sort({ timestamp: 1 }).lean();
        if (docs && docs.length > 0) return docs.map(toPlain);
      } catch (err) {
        console.warn('[MongoDB] getWeightHistory fallback:', err.message);
      }
    }
    return memoryDb.weightHistory[inventoryItemId] || [];
  },

  // ── Transfer Requests ──
  async getTransferRequests(filter = {}) {
    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const query = {};
        if (filter.requestingHospitalId) query.requestingHospitalId = filter.requestingHospitalId;
        if (filter.sourceHospitalId) query.sourceHospitalId = filter.sourceHospitalId;
        if (filter.status) query.status = filter.status;
        const list = await TransferRequest.find(query).sort({ createdAt: -1 }).lean();
        if (list && list.length > 0) return list.map(toPlain);
      } catch (err) {
        console.warn('[MongoDB] getTransferRequests fallback:', err.message);
      }
    }
    let reqs = (this.mode === 'memory' ? memoryDb.transferRequests : []) || [];
    if (filter.requestingHospitalId) reqs = reqs.filter(r => r.requestingHospitalId === filter.requestingHospitalId);
    if (filter.sourceHospitalId) reqs = reqs.filter(r => r.sourceHospitalId === filter.sourceHospitalId);
    if (filter.status) reqs = reqs.filter(r => r.status === filter.status);
    return reqs;
  },

  async createTransferRequest(data) {
    memoryDb._nextReqId++;
    const uniqueReqId = data.id || `REQ-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;
    const req = {
      id: uniqueReqId,
      requestingHospitalId: data.requestingHospitalId,
      sourceHospitalId: data.sourceHospitalId,
      medicine: data.medicine,
      quantityKg: data.quantityKg,
      dosageUnit: data.dosageUnit || 'Strips',
      packageCount: data.packageCount || (data.quantityKg * 20),
      driverMode: data.driverMode || 'SENDER_DRIVER_REQUIRED',
      driverName: data.driverName || null,
      driverPhone: data.driverPhone || null,
      vehicleNumber: data.vehicleNumber || null,
      requesterContactName: data.requesterContactName || null,
      requesterContactPhone: data.requesterContactPhone || null,
      urgency: data.urgency || 'MEDIUM',
      reason: data.reason || '',
      status: data.status || 'PENDING_SOURCE',
      rfidVerified: false, weightVerified: false, rfidUidScanned: null,
      inventoryItemId: data.inventoryItemId || null,
      boxId: data.boxId || null, shelfPosition: data.shelfPosition || null,
      targetRfidUid: data.targetRfidUid || null,
      parentRequestId: data.parentRequestId || null,
      isSplit: data.isSplit || false,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      acceptedAt: null, dispatchedAt: null, receivedAt: null, rejectReason: null
    };

    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const created = await TransferRequest.create(req);
        await this.addAuditLog('TRANSFER_CREATED', `${req.id}: ${req.medicine} ${req.quantityKg}kg`, data.requestingHospitalId, data.userId);
        return toPlain(created);
      } catch (err) {
        console.warn('[MongoDB] createTransferRequest fallback to memoryDb:', err.message);
      }
    }

    if (this.mode === 'memory') { memoryDb.transferRequests.unshift(req); }
    else {
      try {
        await firestoreDb.collection('transferRequests').doc(req.id).set(req);
      } catch (e) {
        memoryDb.transferRequests.unshift(req);
      }
    }
    await this.addAuditLog('TRANSFER_CREATED', `${req.id}: ${req.medicine} ${req.quantityKg}kg`, data.requestingHospitalId, data.userId);
    return req;
  },

  async updateTransferRequest(id, updates) {
    updates.updatedAt = new Date().toISOString();
    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const updated = await TransferRequest.findOneAndUpdate({ id }, updates, { returnDocument: 'after' }).lean();
        if (updated) return toPlain(updated);
      } catch (err) {
        console.warn('[MongoDB] updateTransferRequest fallback to memoryDb:', err.message);
      }
    }
    if (this.mode === 'memory') {
      const req = memoryDb.transferRequests.find(r => r.id === id);
      if (req) Object.assign(req, updates);
      return req;
    }
    try {
      await firestoreDb.collection('transferRequests').doc(id).update(updates);
      const doc = await firestoreDb.collection('transferRequests').doc(id).get();
      return { id: doc.id, ...doc.data() };
    } catch (e) {
      const req = memoryDb.transferRequests.find(r => r.id === id);
      if (req) Object.assign(req, updates);
      return req;
    }
  },

  async getTransferRequest(id) {
    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const doc = await TransferRequest.findOne({ id }).lean();
        if (doc) return toPlain(doc);
      } catch (err) {
        console.warn('[MongoDB] getTransferRequest fallback to memoryDb:', err.message);
      }
    }
    if (this.mode === 'memory') return memoryDb.transferRequests.find(r => r.id === id) || null;
    try {
      const doc = await firestoreDb.collection('transferRequests').doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (e) {
      return memoryDb.transferRequests.find(r => r.id === id) || null;
    }
  },

  // ── Dual Inventory Update ──
  async dualInventoryUpdate(sourceItemId, destHospitalId, medicine, quantityKg) {
    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const src = await Inventory.findOne({ id: sourceItemId });
        if (src) {
          src.currentStockKg = Math.max(0, +(src.currentStockKg - quantityKg).toFixed(2));
          await src.save();
        }
        const dest = await Inventory.findOne({ hospitalId: destHospitalId, medicine: new RegExp(`^${medicine}$`, 'i') });
        if (dest) {
          dest.currentStockKg = +(dest.currentStockKg + quantityKg).toFixed(2);
          await dest.save();
        }
        return;
      } catch (err) {
        console.warn('[MongoDB] dualInventoryUpdate fallback to memoryDb:', err.message);
      }
    }
    if (this.mode === 'memory') {
      const src = memoryDb.inventory.find(i => i.id === sourceItemId);
      if (src) src.currentStockKg = Math.max(0, +(src.currentStockKg - quantityKg).toFixed(2));
      const dest = memoryDb.inventory.find(i => i.hospitalId === destHospitalId && i.medicine.toLowerCase() === medicine.toLowerCase());
      if (dest) dest.currentStockKg = +(dest.currentStockKg + quantityKg).toFixed(2);
    }
  },

  // ── Audit Log ──
  async addAuditLog(action, detail, hospitalId, userId, isImpersonation) {
    const entry = {
      id: `AUD-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      action, detail, hospitalId: hospitalId || null,
      userId: userId || null, isImpersonation: isImpersonation || false,
      timestamp: new Date().toISOString()
    };
    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const created = await AuditLog.create(entry);
        return toPlain(created);
      } catch (err) {
        console.warn('[MongoDB] addAuditLog fallback to memoryDb:', err.message);
      }
    }
    if (this.mode === 'memory') { memoryDb.auditLog.unshift(entry); }
    else {
      try {
        await firestoreDb.collection('auditLog').add(entry);
      } catch (e) {
        memoryDb.auditLog.unshift(entry);
      }
    }
    return entry;
  },

  async getAuditLog(limit = 100) {
    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const docs = await AuditLog.find({}).sort({ timestamp: -1 }).limit(limit).lean();
        if (docs && docs.length > 0) return docs.map(toPlain);
      } catch (err) {
        console.warn('[MongoDB] getAuditLog fallback to memoryDb:', err.message);
      }
    }
    if (this.mode === 'memory') return memoryDb.auditLog.slice(0, limit);
    try {
      const snap = await firestoreDb.collection('auditLog').orderBy('timestamp', 'desc').limit(limit).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      return memoryDb.auditLog.slice(0, limit);
    }
  },

  // ── Karma ──
  async addKarmaChange(hospitalId, change, reason) {
    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const h = await Hospital.findOne({ id: hospitalId });
        if (h) {
          h.karmaScore = Math.max(0, Math.min(100, h.karmaScore + change));
          await h.save();
        }
        await KarmaHistory.create({
          id: `KH-${Date.now()}`,
          hospitalId,
          change,
          reason,
          timestamp: new Date().toISOString()
        });
        return;
      } catch (err) {
        console.warn('[MongoDB] addKarmaChange fallback to memoryDb:', err.message);
      }
    }
    if (this.mode === 'memory') {
      const h = memoryDb.hospitals.find(h => h.id === hospitalId);
      if (h) h.karmaScore = Math.max(0, Math.min(100, h.karmaScore + change));
      memoryDb.karmaHistory.unshift({ id: `KH-${Date.now()}`, hospitalId, change, reason, timestamp: new Date().toISOString() });
    } else {
      try {
        const hRef = firestoreDb.collection('hospitals').doc(hospitalId);
        await firestoreDb.runTransaction(async t => {
          const doc = await t.get(hRef);
          const current = doc.data().karmaScore || 50;
          t.update(hRef, { karmaScore: Math.max(0, Math.min(100, current + change)) });
        });
        await firestoreDb.collection('karmaHistory').add({ hospitalId, change, reason, timestamp: new Date().toISOString() });
      } catch (e) {
        const h = memoryDb.hospitals.find(h => h.id === hospitalId);
        if (h) h.karmaScore = Math.max(0, Math.min(100, h.karmaScore + change));
        memoryDb.karmaHistory.unshift({ id: `KH-${Date.now()}`, hospitalId, change, reason, timestamp: new Date().toISOString() });
      }
    }
  },

  async getKarmaHistory(hospitalId) {
    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const docs = await KarmaHistory.find({ hospitalId }).sort({ timestamp: -1 }).lean();
        if (docs && docs.length > 0) return docs.map(toPlain);
      } catch (err) {
        console.warn('[MongoDB] getKarmaHistory fallback to memoryDb:', err.message);
      }
    }
    if (this.mode === 'memory') return memoryDb.karmaHistory.filter(k => k.hospitalId === hospitalId);
    try {
      const snap = await firestoreDb.collection('karmaHistory').where('hospitalId', '==', hospitalId).orderBy('timestamp', 'desc').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      return memoryDb.karmaHistory.filter(k => k.hospitalId === hospitalId);
    }
  },

  // ── Sensor Alerts ──
  async getSensorAlerts() {
    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const docs = await SensorAlert.find({}).lean();
        if (docs && docs.length > 0) return docs.map(toPlain);
      } catch (err) {
        console.warn('[MongoDB] getSensorAlerts fallback to memoryDb:', err.message);
      }
    }
    if (this.mode === 'memory') return memoryDb.sensorAlerts;
    try {
      const snap = await firestoreDb.collection('sensorAlerts').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      return memoryDb.sensorAlerts;
    }
  },

  // ── Locked Boxes ──
  isBoxLocked(rfidUid) { return memoryDb.lockedBoxes.has(rfidUid); },
  lockBox(rfidUid) { memoryDb.lockedBoxes.add(rfidUid); },

  // ── QR Code Count Management (Increment on ADD, Decrement on REMOVE) ──
  async createOrUpdateQRCode(data) {
    const qrId = data.qrId || (data.batch ? `QR-${data.batch}` : `QR-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
    const initialCount = parseInt(data.initialCount !== undefined ? data.initialCount : (data.count !== undefined ? data.count : (data.packageCount !== undefined ? data.packageCount : 1))) || 1;
    const count = parseInt(data.count !== undefined ? data.count : initialCount) || 1;
    
    const qrDoc = {
      qrId,
      medicine: data.medicine || 'Paracetamol 500mg',
      batch: data.batch || 'BATCH-01',
      count,
      initialCount,
      weightKg: parseFloat(data.weightKg) || 1.0,
      dosageUnit: data.dosageUnit || 'Strips',
      hospitalId: data.hospitalId || 'H01',
      action: (data.action || 'ADD').toUpperCase(),
      rawQrData: data.rawQrData || data.code || ''
    };

    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const existing = await QRCode.findOne({ qrId });
        if (existing) {
          existing.medicine = qrDoc.medicine;
          existing.batch = qrDoc.batch;
          if (data.count !== undefined) existing.count = count;
          existing.weightKg = qrDoc.weightKg;
          existing.dosageUnit = qrDoc.dosageUnit;
          existing.hospitalId = qrDoc.hospitalId;
          existing.action = qrDoc.action;
          if (qrDoc.rawQrData) existing.rawQrData = qrDoc.rawQrData;
          await existing.save();
          return toPlain(existing);
        } else {
          const created = await QRCode.create(qrDoc);
          return toPlain(created);
        }
      } catch (err) {
        console.warn('[MongoDB] createOrUpdateQRCode fallback to memoryDb:', err.message);
      }
    }

    const memIdx = memoryDb.qrCodes.findIndex(q => q.qrId === qrId);
    if (memIdx >= 0) {
      Object.assign(memoryDb.qrCodes[memIdx], qrDoc);
      return memoryDb.qrCodes[memIdx];
    } else {
      memoryDb.qrCodes.unshift(qrDoc);
      return qrDoc;
    }
  },

  async getQRCode(identifier) {
    if (!identifier) return null;
    const cleanId = identifier.toString().trim();

    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        let doc = await QRCode.findOne({
          $or: [
            { qrId: cleanId },
            { batch: cleanId },
            { qrId: `QR-${cleanId}` },
            { medicine: new RegExp(`^${cleanId}$`, 'i') }
          ]
        }).lean();
        if (doc) return toPlain(doc);
      } catch (err) {
        console.warn('[MongoDB] getQRCode fallback:', err.message);
      }
    }

    return memoryDb.qrCodes.find(q =>
      q.qrId === cleanId ||
      q.batch === cleanId ||
      q.qrId === `QR-${cleanId}` ||
      (q.medicine && q.medicine.toLowerCase() === cleanId.toLowerCase())
    ) || null;
  },

  async incrementQRCount(identifier, step = 1, metadata = {}) {
    let qr = await this.getQRCode(identifier);
    const incAmount = parseInt(step) || 1;

    if (!qr) {
      // Auto-provision QR code entry if scanned first time
      qr = await this.createOrUpdateQRCode({
        qrId: metadata.qrId || (metadata.batch ? `QR-${metadata.batch}` : (identifier.startsWith('QR-') ? identifier : `QR-${identifier}`)),
        medicine: metadata.medicine || identifier,
        batch: metadata.batch || 'BATCH-AUTO',
        count: 0,
        initialCount: 0,
        weightKg: metadata.weightKg || 1.0,
        hospitalId: metadata.destHospital || metadata.hospitalId || 'H01'
      });
    }

    const previousCount = qr.count || 0;
    const newCount = previousCount + incAmount;

    const historyEntry = {
      action: 'ADD',
      headerUsed: metadata.headerUsed || 'x-action: add',
      previousCount,
      newCount,
      timestamp: new Date(),
      source: metadata.source || metadata.deviceName || 'Node_1',
      deviceName: metadata.deviceName || metadata.source || 'Node_1'
    };

    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const updated = await QRCode.findOneAndUpdate(
          { qrId: qr.qrId },
          {
            $set: { 
              count: newCount, 
              action: 'ADD', 
              lastScannedNode: metadata.deviceName || metadata.source || 'Node_1',
              hospitalId: metadata.destHospital || qr.hospitalId || 'H01',
              updatedAt: new Date() 
            },
            $push: { scanHistory: historyEntry }
          },
          { returnDocument: 'after' }
        ).lean();
        if (updated) return { ...toPlain(updated), previousCount, change: incAmount, action: 'ADD' };
      } catch (err) {
        console.warn('[MongoDB] incrementQRCount fallback:', err.message);
      }
    }

    qr.count = newCount;
    qr.action = 'ADD';
    qr.lastScannedNode = metadata.deviceName || metadata.source || 'Node_1';
    if (!qr.scanHistory) qr.scanHistory = [];
    qr.scanHistory.push(historyEntry);
    return { ...qr, previousCount, change: incAmount, action: 'ADD' };
  },

  async decrementQRCount(identifier, step = 1, metadata = {}) {
    let qr = await this.getQRCode(identifier);
    const decAmount = parseInt(step) || 1;

    if (!qr) {
      qr = await this.createOrUpdateQRCode({
        qrId: metadata.qrId || (metadata.batch ? `QR-${metadata.batch}` : (identifier.startsWith('QR-') ? identifier : `QR-${identifier}`)),
        medicine: metadata.medicine || identifier,
        batch: metadata.batch || 'BATCH-AUTO',
        count: 1,
        initialCount: 1,
        weightKg: metadata.weightKg || 1.0,
        hospitalId: metadata.destHospital || metadata.hospitalId || 'H01'
      });
    }

    const previousCount = qr.count !== undefined ? qr.count : 1;
    const newCount = Math.max(0, previousCount - decAmount);

    const historyEntry = {
      action: 'REMOVE',
      headerUsed: metadata.headerUsed || 'x-action: remove',
      previousCount,
      newCount,
      timestamp: new Date(),
      source: metadata.source || metadata.deviceName || 'Node_1',
      deviceName: metadata.deviceName || metadata.source || 'Node_1'
    };

    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const updated = await QRCode.findOneAndUpdate(
          { qrId: qr.qrId },
          {
            $set: { 
              count: newCount, 
              action: 'REMOVE', 
              lastScannedNode: metadata.deviceName || metadata.source || 'Node_1',
              updatedAt: new Date() 
            },
            $push: { scanHistory: historyEntry }
          },
          { returnDocument: 'after' }
        ).lean();
        if (updated) return { ...toPlain(updated), previousCount, change: -decAmount, action: 'REMOVE' };
      } catch (err) {
        console.warn('[MongoDB] decrementQRCount fallback:', err.message);
      }
    }

    qr.count = newCount;
    qr.action = 'REMOVE';
    qr.lastScannedNode = metadata.deviceName || metadata.source || 'Node_1';
    if (!qr.scanHistory) qr.scanHistory = [];
    qr.scanHistory.push(historyEntry);
    return { ...qr, previousCount, change: -decAmount, action: 'REMOVE' };
  },

  async getAllQRCodes(limit = 100) {
    if (this.mode === 'mongodb' || this.mode === 'atlas') {
      try {
        const docs = await QRCode.find({}).sort({ updatedAt: -1, createdAt: -1 }).limit(limit).lean();
        if (docs && docs.length > 0) return docs.map(toPlain);
      } catch (err) {
        console.warn('[MongoDB] getAllQRCodes fallback:', err.message);
      }
    }
    return (memoryDb.qrCodes || []).slice(0, limit);
  }
};

module.exports = { db, firestoreDb, memoryDb };

