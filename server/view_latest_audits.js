require('dotenv').config();
const { connectMongoDB } = require('./src/config/mongodb');
const AuditLog = require('./src/models/AuditLog');
const Inventory = require('./src/models/Inventory');

async function view() {
  await connectMongoDB();
  const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(6).lean();
  console.log('=== LATEST 6 AUDIT LOGS IN MONGODB ATLAS ===');
  logs.forEach((l, i) => {
    console.log(`[${i+1}] Action: ${l.action} | Details: ${l.details} | Hospital: ${l.hospitalId} | Time: ${new Date(l.timestamp).toLocaleTimeString()}`);
  });

  const inv = await Inventory.find().lean();
  console.log('\n=== CURRENT HOSPITAL INVENTORIES IN ATLAS ===');
  inv.forEach(item => {
    console.log(`- ${item.hospitalId} | ${item.medicine}: ${item.currentStockKg} kg (Batch: ${item.batch})`);
  });
  process.exit(0);
}

view();
