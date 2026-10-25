const Project = require('../models/Project');

async function requireProjectOwner(req, res, next) {
  try {
    const project = await Project.findById(req.params.id || req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (String(project.user_id) !== String(req.user._id)) {
      return res.status(403).json({
        error: 'Access denied: you do not own this project',
      });
    }

    req.project = project;
    return next();
  } catch (err) {
    return res.status(400).json({ error: 'Invalid project id' });
  }
}

module.exports = { requireProjectOwner };
