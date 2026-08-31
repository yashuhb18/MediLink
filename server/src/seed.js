/**
 * MediLink AI — Database Seed Script for MongoDB Atlas / Local MongoDB
 * Run: npm run seed
 */
require('dotenv').config();
const { connectMongoDB } = require('./config/mongodb');
const User = require('./models/User');
const Hospital = require('./models/Hospital');
const Inventory = require('./models/Inventory');
const TransferRequest = require('./models/TransferRequest');
const KarmaHistory = require('./models/KarmaHistory');
const AuditLog = require('./models/AuditLog');
const SensorAlert = require('./models/SensorAlert');
const WeightHistory = require('./models/WeightHistory');
const { memoryDb } = require('./config/firebase');

async function seed() {
  console.log('🌱 Starting MediLink Database Seeding...');
  
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI missing in .env file!');
    process.exit(1);
  }

  try {
    await connectMongoDB();
    console.log('🧹 Clearing existing collections...');
    await User.deleteMany({});
    await Hospital.deleteMany({});
    await Inventory.deleteMany({});
    await TransferRequest.deleteMany({});
    await KarmaHistory.deleteMany({});
    await AuditLog.deleteMany({});
    await SensorAlert.deleteMany({});
    await WeightHistory.deleteMany({});

    console.log('📦 Seeding Users...');
    await User.insertMany(memoryDb.users);

    console.log('🏥 Seeding Hospitals...');
    await Hospital.insertMany(memoryDb.hospitals);

    console.log('💊 Seeding Inventory Items...');
    await Inventory.insertMany(memoryDb.inventory);

    console.log('🔄 Seeding Transfer Requests...');
    await TransferRequest.insertMany(memoryDb.transferRequests);

    console.log('⭐ Seeding Karma History...');
    await KarmaHistory.insertMany(memoryDb.karmaHistory);

    console.log('⚠️ Seeding Sensor Alerts...');
    await SensorAlert.insertMany(memoryDb.sensorAlerts);

    console.log('⚖️ Seeding Weight Telemetry History...');
    const historyDocs = [];
    Object.entries(memoryDb.weightHistory).forEach(([itemId, points]) => {
      points.forEach(pt => {
        historyDocs.push({
          inventoryItemId: itemId,
          timestamp: pt.timestamp,
          weightKg: pt.weightKg
        });
      });
    });
    if (historyDocs.length > 0) {
      await WeightHistory.insertMany(historyDocs);
    }

    console.log('\n✅ Database Seeding Completed Successfully!');
    console.log(`Summary:
    - Users: ${memoryDb.users.length}
    - Hospitals: ${memoryDb.hospitals.length}
    - Inventory: ${memoryDb.inventory.length}
    - Transfer Requests: ${memoryDb.transferRequests.length}
    - Karma Log Entries: ${memoryDb.karmaHistory.length}
    - Sensor Alerts: ${memoryDb.sensorAlerts.length}
    - Weight Telemetry Points: ${historyDocs.length}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error during seeding:', err.message);
    process.exit(1);
  }
}

seed();
