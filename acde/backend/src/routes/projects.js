const express = require('express');
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const Deployment = require('../models/Deployment');
const Log = require('../models/Log');
const { authenticate } = require('../middleware/auth');
const { requireProjectOwner } = require('../middleware/ownership');
const {
  isValidGitUrl,
  sanitizeProjectName,
  toSubdomain,
} = require('../utils/validators');
const { onLog } = require('../utils/logBus');
const {
  runDeploymentPipeline,
  stopDeployment,
  allocatePort,
} = require('../services/orchestrator');
const { liveUrl } = require('../services/proxy');

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  const projects = await Project.find({ user_id: req.user._id }).sort({
    updated_at: -1,
  });

  const enriched = await Promise.all(
    projects.map(async (project) => {
      const deployment = await Deployment.findOne({ project_id: project._id }).sort({
        created_at: -1,
      });
      return {
        id: project._id,
        project_name: project.project_name,
        git_repo_url: project.git_repo_url,
        tech_stack: project.tech_stack,
        status: project.status,
        created_at: project.created_at,
        updated_at: project.updated_at,
        deployment: deployment
          ? {
              id: deployment._id,
              subdomain: deployment.subdomain,
              assigned_port: deployment.assigned_port,
              live_url: deployment.live_url,
              status: deployment.status,
              mode: deployment.mode,
            }
          : null,
      };
    })
  );

  res.json({ projects: enriched });
});

router.post(
  '/',
  body('project_name').trim().isLength({ min: 2, max: 80 }),
  body('git_repo_url').trim().isLength({ min: 10, max: 500 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const project_name = sanitizeProjectName(req.body.project_name);
    const git_repo_url = String(req.body.git_repo_url).trim();

    if (!project_name) {
      return res.status(400).json({ error: 'Invalid project name' });
    }

    if (!isValidGitUrl(git_repo_url)) {
      return res.status(400).json({
        error:
          'Invalid Git repository URL. Use a GitHub/GitLab/Bitbucket HTTPS/SSH URL or a local path.',
      });
    }

    const project = await Project.create({
      user_id: req.user._id,
      project_name,
      git_repo_url,
      status: 'pending',
    });

    res.status(201).json({
      project: {
        id: project._id,
        project_name: project.project_name,
        git_repo_url: project.git_repo_url,
        status: project.status,
      },
    });
  }
);

router.get('/:id', requireProjectOwner, async (req, res) => {
  const deployment = await Deployment.findOne({ project_id: req.project._id }).sort({
    created_at: -1,
  });

  let logs = [];
  if (deployment) {
    logs = await Log.find({ deployment_id: deployment._id })
      .sort({ timestamp: 1 })
      .limit(1000);
  }

  res.json({
    project: {
      id: req.project._id,
      project_name: req.project.project_name,
      git_repo_url: req.project.git_repo_url,
      tech_stack: req.project.tech_stack,
      status: req.project.status,
      created_at: req.project.created_at,
      updated_at: req.project.updated_at,
    },
    deployment: deployment
      ? {
          id: deployment._id,
          subdomain: deployment.subdomain,
          assigned_port: deployment.assigned_port,
          live_url:
            deployment.live_url ||
            liveUrl(deployment.subdomain, deployment.assigned_port),
          status: deployment.status,
          mode: deployment.mode,
          container_id: deployment.container_id,
        }
      : null,
    logs: logs.map((l) => ({
      id: l._id,
      log_message: l.log_message,
      timestamp: l.timestamp,
    })),
  });
});

router.post('/:id/deploy', requireProjectOwner, async (req, res) => {
  if (['building'].includes(req.project.status)) {
    return res.status(409).json({ error: 'Deployment already in progress' });
  }

  const assigned_port = await allocatePort();
  const subdomain = toSubdomain(req.project.project_name, req.project._id);

  const deployment = await Deployment.create({
    project_id: req.project._id,
    subdomain,
    assigned_port,
    status: 'pending',
    live_url: liveUrl(subdomain, assigned_port),
  });

  req.project.status = 'building';
  await req.project.save();

  // Fire-and-forget pipeline; client streams logs via SSE
  setImmediate(() => {
    runDeploymentPipeline({ project: req.project, deployment }).catch(() => {
      // Errors already logged and persisted by orchestrator
    });
  });

  res.status(202).json({
    message: 'Deployment started',
    deployment: {
      id: deployment._id,
      subdomain: deployment.subdomain,
      assigned_port: deployment.assigned_port,
      live_url: deployment.live_url,
      status: deployment.status,
    },
  });
});

router.post('/:id/stop', requireProjectOwner, async (req, res) => {
  const deployment = await Deployment.findOne({ project_id: req.project._id }).sort({
    created_at: -1,
  });

  if (!deployment) {
    return res.status(404).json({ error: 'No deployment found' });
  }

  await stopDeployment({ project: req.project, deployment });
  res.json({ message: 'Deployment stopped', status: 'stopped' });
});

router.delete('/:id', requireProjectOwner, async (req, res) => {
  const deployment = await Deployment.findOne({ project_id: req.project._id }).sort({
    created_at: -1,
  });

  if (deployment) {
    try {
      await stopDeployment({ project: req.project, deployment });
    } catch {
      // Continue deleting records even if stop fails
    }
    await Log.deleteMany({ deployment_id: deployment._id });
    await Deployment.deleteMany({ project_id: req.project._id });
  }

  await Project.deleteOne({ _id: req.project._id });
  res.json({ message: 'Project deleted' });
});

router.get('/:id/logs/stream', requireProjectOwner, async (req, res) => {
  const deployment = await Deployment.findOne({ project_id: req.project._id }).sort({
    created_at: -1,
  });

  if (!deployment) {
    return res.status(404).json({ error: 'No deployment found' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const existing = await Log.find({ deployment_id: deployment._id }).sort({
    timestamp: 1,
  });
  existing.forEach((entry) => {
    res.write(`data: ${JSON.stringify({
      log_message: entry.log_message,
      timestamp: entry.timestamp,
    })}\n\n`);
  });

  const unsubscribe = onLog(String(deployment._id), (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  });

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

module.exports = router;
