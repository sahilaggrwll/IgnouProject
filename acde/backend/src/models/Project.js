const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  project_name: { type: String, required: true, trim: true },
  git_repo_url: { type: String, required: true, trim: true },
  tech_stack: { type: String, default: 'auto' },
  status: {
    type: String,
    enum: ['pending', 'building', 'deployed', 'failed', 'stopped'],
    default: 'pending',
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

projectSchema.pre('save', function updateTimestamp(next) {
  this.updated_at = new Date();
  next();
});

module.exports = mongoose.model('Project', projectSchema);
