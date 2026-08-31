/** Module 1: Predictive Time-Traveler */
const { db } = require('../config/firebase');

const Predictor = {
  calculateConsumptionRate(history) {
    if (!history || history.length < 5) return 0;
    const recent = history.slice(-7);
    const oldest = recent[0], newest = recent[recent.length - 1];
    const hours = (newest.timestamp - oldest.timestamp) / 3600000;
    if (hours <= 0) return 0;
    const drop = oldest.weightKg - newest.weightKg;
    return drop > 0 ? +(drop / hours).toFixed(4) : 0;
  },

  predictZeroStockTime(currentKg, rate) {
    return rate > 0 ? +(currentKg / rate).toFixed(1) : Infinity;
  },

  predictThresholdBreachTime(currentKg, thresholdKg, rate) {
    if (currentKg <= thresholdKg) return 0;
    return rate > 0 ? +((currentKg - thresholdKg) / rate).toFixed(1) : Infinity;
  },

  async generatePredictions(hospitalId, thresholdHours = 5) {
    const items = await db.getInventoryForHospital(hospitalId);
    const existingReqs = await db.getTransferRequests({ requestingHospitalId: hospitalId });
    const drafts = [];

    for (const item of items) {
      if (db.isExpired(item)) continue;
      const history = db.getWeightHistory(item.id);
      const rate = this.calculateConsumptionRate(history);
      const hoursToZero = this.predictZeroStockTime(item.currentStockKg, rate);
      const hoursToThreshold = this.predictThresholdBreachTime(item.currentStockKg, item.minThresholdKg, rate);

      if (hoursToZero <= thresholdHours || item.currentStockKg < item.minThresholdKg) {
        const existing = existingReqs.find(r =>
          r.medicine.toLowerCase() === item.medicine.toLowerCase() &&
          ['DRAFT', 'PENDING_SOURCE', 'ACCEPTED'].includes(r.status)
        );
        if (existing) continue;

        const targetStock = item.minThresholdKg * 1.5;
        const deficit = Math.max(0.5, +(targetStock - item.currentStockKg).toFixed(2));

        drafts.push({
          inventoryItemId: item.id, medicine: item.medicine, batch: item.batch,
          currentStockKg: item.currentStockKg, minThresholdKg: item.minThresholdKg,
          consumptionRate: rate, hoursToZero, hoursToThreshold,
          deficitKg: deficit,
          urgency: hoursToZero <= 2 ? 'HIGH' : hoursToZero <= 5 ? 'MEDIUM' : 'LOW',
          isAlreadyBelowMin: item.currentStockKg < item.minThresholdKg,
          sparkline: history.slice(-10).map(h => h.weightKg)
        });
      }
    }
    drafts.sort((a, b) => ({ HIGH: 0, MEDIUM: 1, LOW: 2 }[a.urgency] - { HIGH: 0, MEDIUM: 1, LOW: 2 }[b.urgency]));
    return drafts;
  }
};

module.exports = Predictor;
