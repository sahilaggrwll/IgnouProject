const mongoose = require('mongoose');

const deploymentSchema = new mongoose.Schema({
  project_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
  container_id: { type: String, default: '' },
  subdomain: { type: String, required: true },
  assigned_port: { type: Number, required: true },
  image_tag: { type: String, default: '' },
  mode: { type: String, enum: ['docker', 'k8s'], default: 'docker' },
  status: {
    type: String,
    enum: ['pending', 'building', 'deployed', 'failed', 'stopped'],
    default: 'pending',
  },
  live_url: { type: String, default: '' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

deploymentSchema.pre('save', function updateTimestamp(next) {
  this.updated_at = new Date();
  next();
});

module.exports = mongoose.model('Deployment', deploymentSchema);
