/** Module 2: Karma Market — Game Theory Reputation Engine */
const { db } = require('../config/firebase');

const KarmaMarket = {
  RULES: {
    ACCEPT_QUICK: { change: +5, label: 'Accepted HIGH urgency request quickly' },
    DISPATCH_VERIFIED: { change: +3, label: 'RFID + Weight verified dispatch' },
    REJECT_HIGH: { change: -5, label: 'Rejected HIGH urgency request' },
    REJECT_MEDIUM: { change: -2, label: 'Rejected MEDIUM urgency request' },
    WRONG_MEDICINE: { change: -10, label: 'RFID mismatch — sent wrong medicine' },
    RECEIVED_TRANSFER: { change: +3, label: 'Successfully received a transfer' }
  },

  async applyRule(hospitalId, ruleKey, customDetail) {
    const rule = this.RULES[ruleKey];
    if (!rule) return;
    await db.addKarmaChange(hospitalId, rule.change, customDetail || rule.label);
    await db.addAuditLog('KARMA_CHANGE', `${hospitalId}: ${rule.change > 0 ? '+' : ''}${rule.change} — ${customDetail || rule.label}`, hospitalId);
  },

  async rankDonorHospitals(medicine, requestingHospitalId) {
    const hospitals = await db.getHospitals();
    const candidates = [];

    for (const hospital of hospitals) {
      if (hospital.id === requestingHospitalId || !hospital.active) continue;
      const { surplus, items } = await db.getTransferableSurplus(hospital.id, medicine);
      if (surplus <= 0) continue;

      const bestItem = items.reduce((best, item) => {
        const above = item.currentStockKg - item.minThresholdKg;
        return above > (best ? best.currentStockKg - best.minThresholdKg : 0) ? item : best;
      }, null);
      if (!bestItem) continue;

      const distance = db.getDistance(requestingHospitalId, hospital.id);
      const daysToExpiry = Math.ceil((new Date(bestItem.expiryDate) - new Date()) / 86400000);

      candidates.push({
        hospital, surplus, distanceKm: distance, karmaScore: hospital.karmaScore,
        daysToExpiry, bestItem, boxId: bestItem.boxId, rfidUid: bestItem.rfidUid,
        shelfPosition: bestItem.shelfPosition, inventoryItemId: bestItem.id
      });
    }

    candidates.sort((a, b) => {
      if (b.karmaScore !== a.karmaScore) return b.karmaScore - a.karmaScore;
      if (b.surplus !== a.surplus) return b.surplus - a.surplus;
      return a.distanceKm - b.distanceKm;
    });
    return candidates;
  },

  getKarmaClass(score) {
    if (score >= 60) return 'high';
    if (score >= 35) return 'medium';
    return 'low';
  }
};

module.exports = KarmaMarket;
