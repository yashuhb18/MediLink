require('dotenv').config();
const { connectMongoDB } = require('./src/config/mongodb');
const CapturedImage = require('./src/models/CapturedImage');
const Inventory = require('./src/models/Inventory');

async function sync() {
  await connectMongoDB();
  // Update recent images
  const updated = await CapturedImage.updateMany(
    {},
    { $set: { medicine: 'Head ache 1mg', batch: 'HA-902', action: 'ADD', weightKg: 1.0 } }
  );
  console.log('Updated CapturedImage records:', updated);

  // Ensure Head ache 1mg is in Inventory for H01
  const existing = await Inventory.findOne({ hospitalId: 'H01', medicine: 'Head ache 1mg' });
  if (!existing) {
    await Inventory.create({
      id: `INV-HA-902`,
      hospitalId: 'H01',
      boxId: 'BOX-H01',
      loadCellId: 'LC-H01',
      rfidUid: 'TAG-8821',
      medicine: 'Head ache 1mg',
      batch: 'HA-902',
      currentStockKg: 1.0,
      minThresholdKg: 1.0,
      expiryDate: '2027-08-30',
      shelfPosition: 'Shelf 2B',
      locked: false
    });
    console.log('Created Head ache 1mg in H01 Inventory in MongoDB Atlas!');
  } else {
    console.log('Head ache 1mg already exists in H01 Inventory.');
  }

  process.exit(0);
}

sync();
