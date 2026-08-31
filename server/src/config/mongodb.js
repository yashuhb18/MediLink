/**
 * MediLink AI — MongoDB Atlas Connection Manager
 */
const mongoose = require('mongoose');
const dns = require('dns');

// Fix for Windows DNS resolution for MongoDB Atlas SRV records
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  // Ignore if custom DNS cannot be set
}

let isConnected = false;

const connectMongoDB = async () => {
  if (isConnected) return mongoose.connection;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[MongoDB] MONGODB_URI is not defined in environment variables.');
    return null;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    isConnected = true;
    console.log(`[MongoDB Atlas] Connected successfully to cluster: ${conn.connection.host}`);
    return conn.connection;
  } catch (err) {
    console.error('[MongoDB Atlas] Connection failed:', err.message);
    throw err;
  }
};

module.exports = { connectMongoDB, mongoose };
