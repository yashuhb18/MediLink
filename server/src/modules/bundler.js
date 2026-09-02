/** Module 3: Surgical Bundler — Split Fulfillment Engine */
const KarmaMarket = require('./karma');
const { db } = require('../config/firebase');

const Bundler = {
  async findFulfillment(medicine, requiredKg, requestingHospitalId) {
    const donors = await KarmaMarket.rankDonorHospitals(medicine, requestingHospitalId);
    if (!donors.length) return { canFulfill: false, sources: [], totalSurplus: 0, method: 'NONE' };

    const single = donors.find(d => d.surplus >= requiredKg);
    if (single) return { canFulfill: true, sources: [{ ...single, allocatedKg: requiredKg }], totalSurplus: single.surplus, method: 'SINGLE' };

    const selected = [];
    let remaining = requiredKg;
    for (const d of donors) {
      if (remaining <= 0) break;
      const take = Math.min(d.surplus, remaining);
      selected.push({ ...d, allocatedKg: +take.toFixed(2) });
      remaining = +(remaining - take).toFixed(2);
    }
    return {
      canFulfill: remaining <= 0,
      sources: selected,
      totalSurplus: +selected.reduce((s, d) => s + d.allocatedKg, 0).toFixed(2),
      deficit: +Math.max(0, remaining).toFixed(2),
      method: selected.length > 1 ? 'SPLIT' : selected.length === 1 ? 'SINGLE' : 'NONE'
    };
  },

  async createSplitRequests(medicine, sources, requestingHospitalId, urgency, userId, extraData = {}) {
    const parentId = `SPLIT-${Date.now()}`;
    const requests = [];
    for (const src of sources) {
      const req = await db.createTransferRequest({
        requestingHospitalId,
        sourceHospitalId: src.hospital.id,
        medicine,
        quantityKg: src.allocatedKg,
        dosageUnit: extraData.dosageUnit || 'Strips',
        packageCount: extraData.packageCount || Math.round(src.allocatedKg * 20),
        driverMode: extraData.driverMode || 'SENDER_DRIVER_REQUIRED',
        driverName: extraData.driverName || null,
        driverPhone: extraData.driverPhone || null,
        vehicleNumber: extraData.vehicleNumber || null,
        requesterContactName: extraData.requesterContactName || 'Dr. Ramesh Kumar (ICU Incharge)',
        requesterContactPhone: extraData.requesterContactPhone || '+91 98450 12345',
        senderContactName: src.hospital.supervisor || 'Chief Pharmacist',
        senderContactPhone: '+91 98800 67890',
        liveTrackingStatus: 'PENDING_SOURCE_APPROVAL',
        urgency: urgency || 'MEDIUM',
        reason: extraData.reason || (sources.length > 1 ? `Split fulfillment — Part of ${parentId}` : 'AI-recommended source'),
        inventoryItemId: src.inventoryItemId,
        boxId: src.boxId,
        shelfPosition: src.shelfPosition,
        targetRfidUid: src.rfidUid,
        parentRequestId: parentId,
        isSplit: sources.length > 1,
        userId
      });
      requests.push(req);
    }
    return { parentId, requests };
  }
};

module.exports = Bundler;
