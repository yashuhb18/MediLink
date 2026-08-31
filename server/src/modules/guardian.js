/** Module 5: Guardian Angel — Sensor Hygiene Monitor */
const { db } = require('../config/firebase');

const Guardian = {
  detectSuddenCrash(history) {
    if (!history || history.length < 3) return null;
    for (let i = history.length - 1; i >= 1; i--) {
      const dt = (history[i].timestamp - history[i - 1].timestamp) / 1000;
      const dw = history[i - 1].weightKg - history[i].weightKg;
      if (dt <= 2 && dw >= 0.5) return { type: 'SUDDEN_CRASH', drop: +dw.toFixed(2), seconds: +dt.toFixed(1) };
    }
    return null;
  },

  detectStuckSensor(history, durationHours = 6) {
    if (!history || history.length < 10) return null;
    const cutoff = Date.now() - durationHours * 3600000;
    const recent = history.filter(h => h.timestamp >= cutoff);
    if (recent.length < 3) return null;
    const allSame = recent.every(h => Math.abs(h.weightKg - recent[0].weightKg) < 0.001);
    return allSame ? { type: 'STUCK_SENSOR', hours: durationHours, constantWeight: recent[0].weightKg } : null;
  },

  async getActiveAlerts() {
    return db.getSensorAlerts();
  }
};

module.exports = Guardian;
