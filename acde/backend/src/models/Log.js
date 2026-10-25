const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  deployment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deployment',
    required: true,
    index: true,
  },
  log_message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Log', logSchema);
