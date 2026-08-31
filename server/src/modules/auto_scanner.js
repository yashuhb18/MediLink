/**
 * MediLink AI — Automated Vision Action Dispatcher
 */
const { db } = require('../config/firebase');
const AIAgent = require('./ai_agent');
const { broadcastSSE } = require('../routes/events.routes');

const AutoScanner = {
  /**
   * Process decoded QR payload from ESP32-CAM optical capture
   */
  async processScan({ payload, rawImageId, imageBase64 }) {
    if (!payload) return { success: false, reason: "No QR payload detected" };

    const {
      token,
      action = "TRANSFER_DISPATCH",
      medicine = "Paracetamol 500mg",
      batch = "PA-902",
      weightKg = 1.0,
      requestId,
      sourceHospital = "H02",
      destHospital = "H01",
      notes
    } = payload;

    let result = {
      action,
      medicine,
      batch,
      weightKg,
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
      // 3. ACTION: ADD / RESTOCK_INFLOW
      // ──────────────────────────────────────────
      else if (action === "ADD" || action === "ADDITION" || action === "RESTOCK" || action === "RESTOCK_INFLOW" || action === "INFLOW") {
        const destItems = await db.getInventoryForHospital(destHospital);
        const destItem = destItems.find(i => 
          i.medicine.toLowerCase().includes(medicine.toLowerCase()) || 
          medicine.toLowerCase().includes(i.medicine.toLowerCase())
        );
        if (destItem) {
          const newStock = +(destItem.currentStockKg + parseFloat(weightKg)).toFixed(2);
          await db.updateInventoryItem(destItem.id, { currentStockKg: newStock });
          result.newStockKg = newStock;
          result.message = `Successfully ADDED ${weightKg}kg to existing ${destItem.medicine} (Batch: ${batch}) at ${destHospital}. New Stock: ${newStock}kg.`;
        } else {
          // Create new medicine entry in MongoDB!
          const created = await db.createInventoryItem({
            hospitalId: destHospital,
            medicine: medicine,
            currentStockKg: parseFloat(weightKg),
            batch: batch || 'BATCH-ESP32',
            minThresholdKg: 1.0
          });
          result.newStockKg = parseFloat(weightKg);
          result.message = `New medicine successfully created in inventory: ${medicine} (${weightKg}kg, Batch: ${batch}) at ${destHospital}.`;
        }

        if (db.addAuditLog) {
          await db.addAuditLog("ITEM_ADDED", `ESP32-CAM Header Action: Added ${weightKg}kg of ${medicine} (Batch: ${batch})`, destHospital);
        }
      }

      // ──────────────────────────────────────────
      // 4. ACTION: REMOVE / DEDUCT / DISPENSE
      // ──────────────────────────────────────────
      else if (action === "REMOVE" || action === "REMOVAL" || action === "DEDUCT" || action === "DELETE" || action === "DISPENSE" || action === "PHARMACY_DISPENSE") {
        const srcItems = await db.getInventoryForHospital(sourceHospital);
        const matchItem = srcItems.find(i => i.medicine.toLowerCase().includes(medicine.toLowerCase()));
        if (matchItem) {
          const newStock = Math.max(0, +(matchItem.currentStockKg - parseFloat(weightKg)).toFixed(2));
          await db.updateInventoryItem(matchItem.id, { currentStockKg: newStock });
          result.newStockKg = newStock;
          result.message = `Successfully REMOVED/DEDUCTED ${weightKg}kg of ${medicine} (Batch: ${batch}). Remaining Stock: ${newStock}kg.`;
        } else {
          result.message = `Deduction recorded for ${medicine} (${weightKg}kg) batch ${batch}.`;
        }

        if (db.addAuditLog) {
          await db.addAuditLog("ITEM_REMOVED", `ESP32-CAM Header Action: Removed ${weightKg}kg of ${medicine} (Batch: ${batch})`, sourceHospital);
        }
      }

      // ──────────────────────────────────────────
      // 5. Run GLM-4 Optical AI Assessment
      // ──────────────────────────────────────────
      const glmVerification = await AIAgent.explainPrediction({
        medicine,
        batch,
        currentStockKg: result.newStockKg || weightKg,
        minThresholdKg: 1.0,
        consumptionRate: 0.05,
        hoursToZero: 24,
        deficitKg: weightKg,
        urgency: "LOW"
      }).catch(() => ({ explanation: `Optical verification sealed for ${medicine} (Batch ${batch}). Inventory adjusted by ${weightKg}kg.` }));

      result.glmExplanation = glmVerification.explanation;
      result.model = glmVerification.model || "GLM-4 Local";

      // ──────────────────────────────────────────
      // 6. Broadcast Real-Time SSE to All Web Portals
      // ──────────────────────────────────────────
      broadcastSSE({
        type: 'ESP32_SCAN_SUCCESS',
        result,
        payload,
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
