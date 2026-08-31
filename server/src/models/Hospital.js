const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  location: { type: String, required: true },
  code: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  status: { type: String, default: 'ONLINE' },
  karmaScore: { type: Number, default: 50 },
  active: { type: Boolean, default: true },
  supervisor: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Hospital', hospitalSchema);
