const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, required: true },
  hospitalId: { type: String, default: null },
  initials: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
