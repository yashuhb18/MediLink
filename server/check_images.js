const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
require('dotenv').config();

async function checkImages() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB Atlas!');
    const CapturedImage = require('./src/models/CapturedImage');
    const images = await CapturedImage.find().sort({ createdAt: -1 });
    console.log('Total Captured Images found in MongoDB Atlas:', images.length);
    images.forEach((img, i) => {
      console.log(`[${i+1}] ID: ${img._id}, Source: ${img.source}, CreatedAt: ${img.createdAt}, DataLength: ${img.image_data ? img.image_data.length : 0} chars, Preview: ${img.image_data ? img.image_data.substring(0, 50) : 'none'}...`);
    });
    
    // Also list all collections in the database
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\nAll Collections in MongoDB Atlas:');
    for (let c of collections) {
      const count = await mongoose.connection.db.collection(c.name).countDocuments();
      console.log(`- ${c.name}: ${count} documents`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('MongoDB Atlas Error:', err);
    process.exit(1);
  }
}
checkImages();
