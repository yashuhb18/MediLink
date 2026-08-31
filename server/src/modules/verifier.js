/** Module 4: Fortress Verifier — RFID + Weight Dual-Lock */
const { db } = require('../config/firebase');

const Verifier = {
  verifyRfid(scannedUid, expectedUid) {
    return { rfidOk: scannedUid.trim().toUpperCase() === expectedUid.trim().toUpperCase(), scannedUid, expectedUid };
  },

  verifyWeight(measuredKg, expectedKg, tolerance = 0.05) {
    const diff = Math.abs(measuredKg - expectedKg);
    return { weightOk: diff <= tolerance, measuredKg, expectedKg, diff: +diff.toFixed(3) };
  },

  dualLockCheck(scannedUid, expectedUid, measuredKg, expectedKg) {
    const rfid = this.verifyRfid(scannedUid, expectedUid);
    const weight = this.verifyWeight(measuredKg, expectedKg);
    return { rfidOk: rfid.rfidOk, weightOk: weight.weightOk, overallPass: rfid.rfidOk && weight.weightOk, rfid, weight };
  },

  isBoxLocked(rfidUid) { return db.isBoxLocked(rfidUid); },
  lockBox(rfidUid) { db.lockBox(rfidUid); }
};

module.exports = Verifier;
