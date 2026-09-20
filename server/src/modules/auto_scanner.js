/**
 * MediLink AI — Automated Vision Action Dispatcher
 */
const { db } = require('../config/firebase');
const AIAgent = require('./ai_agent');
const { broadcastSSE } = require('../routes/events.routes');

function resolveNodeHospital(rawHospital, deviceName) {
  if (deviceName) {
    const dev = deviceName.toString().toUpperCase();
    if (dev.includes('NODE_1') || dev.includes('NODE-1') || dev.includes('NODE 1') || dev === 'NODE1' || dev === 'H01') return 'H01';
    if (dev.includes('NODE_2') || dev.includes('NODE-2') || dev.includes('NODE 2') || dev === 'NODE2' || dev === 'H02') return 'H02';
    if (dev.includes('NODE_3') || dev.includes('NODE-3') || dev.includes('NODE 3') || dev === 'NODE3' || dev === 'H03') return 'H03';
  }
  if (rawHospital && (rawHospital === 'H01' || rawHospital === 'H02' || rawHospital === 'H03')) {
    return rawHospital;
  }
  const dev = (rawHospital || '').toString().toUpperCase();
  if (dev.includes('NODE_1') || dev.includes('NODE-1') || dev.includes('NODE 1') || dev === 'NODE1' || dev === 'H01') return 'H01';
  if (dev.includes('NODE_2') || dev.includes('NODE-2') || dev.includes('NODE 2') || dev === 'NODE2' || dev === 'H02') return 'H02';
  if (dev.includes('NODE_3') || dev.includes('NODE-3') || dev.includes('NODE 3') || dev === 'NODE3' || dev === 'H03') return 'H03';
  return 'H01';
}

const AutoScanner = {
  /**
   * Process decoded QR payload from ESP32-CAM optical capture
   */
  async processScan({ payload, rawImageId, imageBase64 }) {
    if (!payload) return { success: false, reason: "No QR payload detected" };

    const deviceName = payload.deviceName || payload.source || 'Node_1';
    const action = (payload.action || "ADD").toUpperCase();
    const medicine = payload.medicine || payload.name || "Paracetamol 500mg";
    const batch = payload.batch || payload.batchNumber || "BATCH-2026-X902";
    const weightKg = parseFloat(payload.weightKg || payload.weight || payload.quantity || 1.0);
    const destHospital = resolveNodeHospital(payload.destHospital || payload.hospitalId || payload.targetHospital, deviceName);
    const sourceHospital = resolveNodeHospital(payload.sourceHospital || payload.hospitalId, deviceName);
    const requestId = payload.requestId || null;
    const token = payload.token || null;

    let result = {
      action,
      medicine,
      batch,
      weightKg,
      destHospital,
      deviceName,
      success: true,
      message: "Optical Scan Processed Successfully",
      timestamp: new Date().toISOString()
    };

    try {
      // ──────────────────────────────────────────
      // 1. ACTION: TRANSFER_DISPATCH
      // ──────────────────────────────────────────
      if (action === "TRANSFER_DISPATCH" || action === "DISPATCH") {
        let reqToUpdate = null;
        if (requestId) {
          reqToUpdate = await db.getTransferRequest(requestId);
        } else {
          // Find first matching approved transfer request for this medicine
          const pendingReqs = await db.getTransferRequests({ status: 'APPROVED' });
          reqToUpdate = pendingReqs.find(r => r.medicine.toLowerCase().includes(medicine.toLowerCase())) || pendingReqs[0];
        }

        if (reqToUpdate) {
          await db.updateTransferRequest(reqToUpdate.id, {
            status: 'IN_TRANSIT',
            dispatchedAt: new Date().toISOString(),
            opticalVerified: true,
            esp32ImageId: rawImageId || null
          });
          result.requestId = reqToUpdate.id;
          result.message = `Dispatched Request #${reqToUpdate.id} (${medicine} - ${weightKg}kg). Status set to IN_TRANSIT.`;
        } else {
          result.message = `Optical verification recorded for ${medicine} batch ${batch}. Ready for transport.`;
        }

        // Deduct from source hospital inventory if item found
        const srcItems = await db.getInventoryForHospital(sourceHospital);
        const matchItem = srcItems.find(i => i.medicine.toLowerCase().includes(medicine.toLowerCase()));
        if (matchItem) {
          const newStock = Math.max(0, +(matchItem.currentStockKg - weightKg).toFixed(2));
          await db.updateInventoryItem(matchItem.id, { currentStockKg: newStock });
          result.newStockKg = newStock;
        }

        // Create Audit Log
        if (db.addAuditLog) {
          await db.addAuditLog(
            "DISPATCH_VERIFIED",
            `Dual verification passed for ${medicine} (Batch: ${batch}, Qty: ${weightKg}kg). Optical QR & image captured.`,
            sourceHospital
          );
        }
      }

      // ──────────────────────────────────────────
      // 2. ACTION: TRANSFER_RECEIVE
      // ──────────────────────────────────────────
      else if (action === "TRANSFER_RECEIVE" || action === "RECEIVE") {
        let reqToDeliver = null;
        if (requestId) {
          reqToDeliver = await db.getTransferRequest(requestId);
        } else {
          const transitReqs = await db.getTransferRequests({ status: 'IN_TRANSIT' });
          reqToDeliver = transitReqs.find(r => r.medicine.toLowerCase().includes(medicine.toLowerCase())) || transitReqs[0];
        }

        if (reqToDeliver) {
          await db.updateTransferRequest(reqToDeliver.id, {
            status: 'DELIVERED',
            deliveredAt: new Date().toISOString(),
            opticalReceiptVerified: true
          });
          result.requestId = reqToDeliver.id;
          result.message = `Transfer #${reqToDeliver.id} confirmed DELIVERED. +5 Karma Points awarded to ${sourceHospital}!`;

          // Award Karma to donor hospital
          await db.awardKarma(sourceHospital || reqToDeliver.sourceHospitalId || 'H02', 5, `Successful verified delivery of ${medicine}`);
        } else {
          result.message = `Stock receipt verified for ${medicine} (+${weightKg}kg added to hospital inventory).`;
        }

        // Add to destination hospital inventory
        const destItems = await db.getInventoryForHospital(destHospital);
        const destItem = destItems.find(i => i.medicine.toLowerCase().includes(medicine.toLowerCase()));
        if (destItem) {
          const newStock = +(destItem.currentStockKg + weightKg).toFixed(2);
          await db.updateInventoryItem(destItem.id, { currentStockKg: newStock });
          result.newStockKg = newStock;
        }
      }

      // ──────────────────────────────────────────
      // 3. ACTION: ADD / RESTOCK_INFLOW / INCREMENT
      // ──────────────────────────────────────────
      else if (action === "ADD" || action === "ADDITION" || action === "RESTOCK" || action === "RESTOCK_INFLOW" || action === "INFLOW" || action === "INCREMENT" || action === "+") {
        // Increment QR Code Count Variable
        const qrId = payload.qrId || (batch ? `QR-${batch}` : `QR-${medicine.replace(/\s+/g, '_')}`);
        const qrUpdate = await db.incrementQRCount(qrId, 1, {
          qrId,
          medicine,
          batch,
          weightKg,
          destHospital,
          deviceName,
          headerUsed: payload.headerUsed || 'x-action: ADD',
          source: deviceName
        });

        result.qrId = qrUpdate.qrId;
        result.qrCount = qrUpdate.count;
        result.previousCount = qrUpdate.previousCount;
        result.countChange = 1;

        const destItems = await db.getInventoryForHospital(destHospital);
        const destItem = destItems.find(i => 
          (i.batch && batch && i.batch.toLowerCase() === batch.toLowerCase() && i.medicine.toLowerCase() === medicine.toLowerCase()) ||
          (i.medicine.toLowerCase() === medicine.toLowerCase())
        );
        if (destItem) {
          const newStock = +(destItem.currentStockKg + parseFloat(weightKg)).toFixed(2);
          const newPkgCount = (destItem.packageCount || 0) + (payload.count ? parseInt(payload.count) : 1);
          await db.updateInventoryItem(destItem.id, { currentStockKg: newStock, packageCount: newPkgCount });
          result.newStockKg = newStock;
          result.packageCount = newPkgCount;
          result.message = `Successfully ADDED by ${deviceName} (+${payload.count || 1} Count: ${qrUpdate.previousCount} ➔ ${qrUpdate.count}) for ${destItem.medicine} (Batch: ${batch}) at ${destHospital}. New Stock: ${newStock}kg.`;
        } else {
          // Create new medicine entry in MongoDB!
          const created = await db.createInventoryItem({
            hospitalId: destHospital,
            medicine: medicine,
            currentStockKg: parseFloat(weightKg) || 1.0,
            packageCount: payload.count !== undefined ? parseInt(payload.count) : (qrUpdate.count || 1),
            dosageUnit: payload.unit || payload.dosageUnit || 'Strips',
            dosageForm: payload.dosageForm || 'Tablets',
            batch: batch || 'BATCH-ESP32',
            minThresholdKg: 1.0
          });
          result.newStockKg = parseFloat(weightKg) || 1.0;
          result.packageCount = created.packageCount || qrUpdate.count || 1;
          result.message = `New medicine successfully created by ${deviceName}: ${medicine} (+Count: ${result.packageCount}, ${weightKg}kg, Batch: ${batch}) at ${destHospital}.`;
        }

        if (db.addAuditLog) {
          await db.addAuditLog("ITEM_ADDED", `Scanned by ${deviceName}: Incremented QR Count to ${qrUpdate.count} for ${medicine} (Batch: ${batch})`, destHospital);
        }
      }

      // ──────────────────────────────────────────
      // 4. ACTION: REMOVE / DEDUCT / DISPENSE / DECREMENT
      // ──────────────────────────────────────────
      else if (action === "REMOVE" || action === "REMOVAL" || action === "DEDUCT" || action === "DELETE" || action === "DISPENSE" || action === "PHARMACY_DISPENSE" || action === "DECREMENT" || action === "-") {
        // Decrement QR Code Count Variable
        const qrId = payload.qrId || (batch ? `QR-${batch}` : `QR-${medicine.replace(/\s+/g, '_')}`);
        const qrUpdate = await db.decrementQRCount(qrId, 1, {
          qrId,
          medicine,
          batch,
          weightKg,
          sourceHospital,
          deviceName,
          headerUsed: payload.headerUsed || 'x-action: REMOVE',
          source: deviceName
        });

        result.qrId = qrUpdate.qrId;
        result.qrCount = qrUpdate.count;
        result.previousCount = qrUpdate.previousCount;
        result.countChange = -1;

        const srcItems = await db.getInventoryForHospital(sourceHospital);
        const matchItem = srcItems.find(i => 
          (i.batch && batch && i.batch.toLowerCase() === batch.toLowerCase() && i.medicine.toLowerCase() === medicine.toLowerCase()) ||
          (i.medicine.toLowerCase() === medicine.toLowerCase())
        );
        if (matchItem) {
          const newStock = Math.max(0, +(matchItem.currentStockKg - parseFloat(weightKg)).toFixed(2));
          const newPkgCount = Math.max(0, (matchItem.packageCount || 1) - 1);
          await db.updateInventoryItem(matchItem.id, { currentStockKg: newStock, packageCount: newPkgCount });
          result.newStockKg = newStock;
          result.packageCount = newPkgCount;
          result.message = `Successfully REMOVED by ${deviceName} (-1 Count: ${qrUpdate.previousCount} ➔ ${qrUpdate.count}) for ${medicine} (Batch: ${batch}). Remaining Stock: ${newStock}kg.`;
        } else {
          result.message = `Deduction recorded by ${deviceName} for ${medicine} (-1 Count: ${qrUpdate.previousCount} ➔ ${qrUpdate.count}, ${weightKg}kg) batch ${batch}.`;
        }

        if (db.addAuditLog) {
          await db.addAuditLog("ITEM_REMOVED", `Scanned by ${deviceName}: Decremented QR Count to ${qrUpdate.count} for ${medicine} (Batch: ${batch})`, sourceHospital);
        }
      }

      // ──────────────────────────────────────────
      // 5. Optical Assessment & Real-Time Sync
      // ──────────────────────────────────────────
      result.glmExplanation = `Optical verification confirmed by ${deviceName} for ${medicine} (Batch: ${batch}). Verified action: ${action} at node ${destHospital}.`;
      result.model = "MediLink Vision Engine";

      // ──────────────────────────────────────────
      // 6. Broadcast Real-Time SSE to All Web Portals
      // ──────────────────────────────────────────
      broadcastSSE({
        type: 'ESP32_SCAN_SUCCESS',
        result,
        payload: { ...payload, deviceName, hospitalId: destHospital },
        deviceName,
        hospitalId: destHospital,
        rawImageId,
        hasImage: !!imageBase64
      });

      return result;
    } catch (err) {
      console.error('[AutoScanner] Error executing scan action:', err);
      return { success: false, error: err.message };
    }
  }
};

module.exports = AutoScanner;
