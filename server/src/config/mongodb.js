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

let connectionPromise = null;

const connectMongoDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[MongoDB] MONGODB_URI is not defined in environment variables.');
    return null;
  }

  connectionPromise = (async () => {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
      });
      const host = conn.connection.host || conn.connection.name || 'Atlas Cluster';
      console.log(`[MongoDB Atlas] Connected successfully to cluster: ${host}`);
      return conn.connection;
    } catch (err) {
      connectionPromise = null;
      console.error('[MongoDB Atlas] Connection failed:', err.message);
      throw err;
    }
  })();

  return connectionPromise;
};

module.exports = { connectMongoDB, mongoose };

