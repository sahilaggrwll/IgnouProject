const express = require('express');
const Project = require('../models/Project');
const Deployment = require('../models/Deployment');
const { authenticate } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const projects = await Project.find({ user_id: req.user._id });
  const counts = {
    total: projects.length,
    pending: 0,
    building: 0,
    deployed: 0,
    failed: 0,
    stopped: 0,
  };

  projects.forEach((p) => {
    if (counts[p.status] !== undefined) counts[p.status] += 1;
  });

  const recent = await Project.find({ user_id: req.user._id })
    .sort({ updated_at: -1 })
    .limit(5);

  const recentWithDeploy = await Promise.all(
    recent.map(async (project) => {
      const deployment = await Deployment.findOne({ project_id: project._id }).sort({
        created_at: -1,
      });
      return {
        id: project._id,
        project_name: project.project_name,
        status: project.status,
        updated_at: project.updated_at,
        live_url: deployment?.live_url || null,
      };
    })
  );

  res.json({
    system: {
      deploy_mode: config.deployMode,
      base_domain: config.baseDomain,
      proxy_port: config.proxyPort,
      health: 'ok',
    },
    counts,
    recent: recentWithDeploy,
  });
});

module.exports = router;
