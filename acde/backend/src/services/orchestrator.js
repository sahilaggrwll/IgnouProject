const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const config = require('../config');
const Log = require('../models/Log');
const { emitLog } = require('../utils/logBus');
const { runCommand } = require('../utils/process');
const { allocatePort } = require('./ports');
const { upsertRoute, removeRoute, liveUrl } = require('./proxy');
const { openTunnel, closeTunnel } = require('./tunnel');

async function appendLog(deploymentId, message) {
  const line = String(message).replace(/\s+$/, '');
  if (!line) return;
  await Log.create({ deployment_id: deploymentId, log_message: line });
  emitLog(String(deploymentId), line);
}

function streamLines(text, onLine) {
  String(text)
    .split(/\r?\n/)
    .filter(Boolean)
    .forEach((line) => onLine(line));
}

function defaultDockerfile(stack) {
  if (stack === 'static') {
    return `FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
  }

  return `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev || npm install
COPY . .
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
`;
}

function detectStack(repoDir) {
  if (fs.existsSync(path.join(repoDir, 'Dockerfile'))) {
    return 'dockerfile';
  }
  if (fs.existsSync(path.join(repoDir, 'package.json'))) {
    return 'node';
  }
  if (
    fs.existsSync(path.join(repoDir, 'index.html')) ||
    fs.existsSync(path.join(repoDir, 'public', 'index.html'))
  ) {
    return 'static';
  }
  return 'node';
}

function ensureDockerfile(repoDir, stack) {
  const dockerfilePath = path.join(repoDir, 'Dockerfile');
  if (!fs.existsSync(dockerfilePath)) {
    fs.writeFileSync(dockerfilePath, defaultDockerfile(stack), 'utf8');
    return true;
  }
  return false;
}

function containerName(projectId) {
  return `acde-${String(projectId).slice(-12)}`;
}

function imageTag(projectId) {
  return `acde/${String(projectId).toLowerCase()}:latest`;
}

function renderK8sManifest({ name, image, port, namespace }) {
  return `apiVersion: v1
kind: Namespace
metadata:
  name: ${namespace}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
        - name: app
          image: ${image}
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: ${port}
          resources:
            limits:
              cpu: "500m"
              memory: "512Mi"
            requests:
              cpu: "100m"
              memory: "128Mi"
          readinessProbe:
            tcpSocket:
              port: ${port}
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  type: NodePort
  selector:
    app: ${name}
  ports:
    - port: ${port}
      targetPort: ${port}
      nodePort: ${Math.min(32767, Math.max(30000, port))}
`;
}

async function stopDockerContainer(name, log) {
  try {
    await runCommand('docker', ['rm', '-f', name], {
      onStdout: (t) => streamLines(t, log),
      onStderr: (t) => streamLines(t, log),
    });
  } catch {
    // Container may not exist yet.
  }
}

async function deployDocker({ project, deployment, image, containerPort, log }) {
  const name = containerName(project._id);
  await stopDockerContainer(name, log);
  await log(`Starting container ${name} on host port ${deployment.assigned_port}`);

  await runCommand(
    'docker',
    [
      'run',
      '-d',
      '--name',
      name,
      '-p',
      `${deployment.assigned_port}:${containerPort}`,
      '--restart',
      'unless-stopped',
      image,
    ],
    {
      onStdout: (t) => streamLines(t, log),
      onStderr: (t) => streamLines(t, log),
    }
  );

  return { containerId: name, mode: 'docker' };
}

async function deployK8s({ project, deployment, image, containerPort, log }) {
  const name = containerName(project._id);
  const manifest = renderK8sManifest({
    name,
    image,
    port: containerPort,
    namespace: config.k8sNamespace,
  });

  const manifestPath = path.join(
    config.workspaceDir,
    String(project._id),
    'k8s-manifest.yaml'
  );
  fs.writeFileSync(manifestPath, manifest, 'utf8');
  await log(`Applying Kubernetes manifests for ${name}`);

  try {
    await runCommand('kubectl', ['apply', '-f', manifestPath], {
      onStdout: (t) => streamLines(t, log),
      onStderr: (t) => streamLines(t, log),
    });
  } catch (err) {
    await log(`Kubernetes apply failed: ${err.message}. Falling back to Docker.`);
    return deployDocker({ project, deployment, image, containerPort, log });
  }

  return { containerId: name, mode: 'k8s' };
}

async function cloneRepo(gitUrl, destDir, log) {
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(destDir), { recursive: true });
  await log(`Cloning repository ${gitUrl}`);

  let source = gitUrl;
  if (source.startsWith('file://')) {
    source = source.replace(/^file:\/\//, '');
  }

  // Local path / already-initialized sample repo for offline demos
  if (source.startsWith('/') || source.startsWith('./') || source.startsWith('../')) {
    const resolved = path.resolve(source);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Local repository path not found: ${resolved}`);
    }
    await runCommand('cp', ['-a', resolved, destDir], {
      onStdout: (t) => streamLines(t, log),
      onStderr: (t) => streamLines(t, log),
    });
    await log(`Copied local repository from ${resolved}`);
    return;
  }

  const git = simpleGit();
  await git.clone(gitUrl, destDir, ['--depth', '1']);
  await log('Clone completed');
}

async function buildImage(repoDir, image, log) {
  await log(`Building Docker image ${image}`);
  await runCommand('docker', ['build', '-t', image, '.'], {
    cwd: repoDir,
    onStdout: (t) => streamLines(t, log),
    onStderr: (t) => streamLines(t, log),
  });
  await log('Docker image built successfully');
}

function inferContainerPort(repoDir, stack) {
  if (stack === 'static') return 80;
  const pkgPath = path.join(repoDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.acde && pkg.acde.port) return Number(pkg.acde.port);
    } catch {
      // ignore
    }
  }
  return 3000;
}

/**
 * Full pipeline: Clone → Build → Deploy → Proxy → Update DB
 */
async function runDeploymentPipeline({ project, deployment }) {
  const deploymentId = deployment._id;
  const log = (msg) => appendLog(deploymentId, msg);

  try {
    project.status = 'building';
    deployment.status = 'building';
    await project.save();
    await deployment.save();

    const repoDir = path.join(config.workspaceDir, String(project._id), 'src');
    await cloneRepo(project.git_repo_url, repoDir, log);

    const stack = detectStack(repoDir);
    project.tech_stack = stack;
    await project.save();
    await log(`Detected tech stack: ${stack}`);

    if (ensureDockerfile(repoDir, stack === 'dockerfile' ? 'node' : stack)) {
      await log('Generated default Dockerfile');
    }

    const image = imageTag(project._id);
    await buildImage(repoDir, image, log);

    const containerPort = inferContainerPort(repoDir, stack);
    const deployer =
      config.deployMode === 'k8s' ? deployK8s : deployDocker;

    const result = await deployer({
      project,
      deployment,
      image,
      containerPort,
      log,
    });

    await upsertRoute(deployment.subdomain, deployment.assigned_port);
    await log(
      `Nginx route mapped: ${deployment.subdomain}.${config.baseDomain} -> :${deployment.assigned_port}`
    );

    // Try to open a public tunnel (only when TUNNEL_ENABLED=true in .env)
    const tunnelUrl = await openTunnel(deployment.subdomain, deployment.assigned_port);
    const url = tunnelUrl || liveUrl(deployment.subdomain, deployment.assigned_port);

    deployment.container_id = result.containerId;
    deployment.image_tag = image;
    deployment.mode = result.mode;
    deployment.status = 'deployed';
    deployment.live_url = url;
    await deployment.save();

    project.status = 'deployed';
    await project.save();

    if (tunnelUrl) {
      await log(`Public tunnel active: ${tunnelUrl}`);
    }
    await log(`Deployment successful: ${url}`);
    return deployment;
  } catch (err) {
    await log(`ERROR: ${err.message}`);
    if (err.stderr) {
      streamLines(err.stderr, (line) => appendLog(deploymentId, line));
    }
    deployment.status = 'failed';
    await deployment.save();
    project.status = 'failed';
    await project.save();
    throw err;
  }
}

async function stopDeployment({ project, deployment }) {
  const log = (msg) => appendLog(deployment._id, msg);
  await log('Stopping deployment...');

  // Close public tunnel first (if one was opened)
  await closeTunnel(deployment.subdomain);

  if (deployment.mode === 'k8s' && deployment.container_id) {
    try {
      await runCommand('kubectl', [
        'delete',
        'deployment,service',
        deployment.container_id,
        '-n',
        config.k8sNamespace,
        '--ignore-not-found',
      ]);
    } catch (err) {
      await log(`K8s cleanup warning: ${err.message}`);
    }
  }

  if (deployment.container_id) {
    await stopDockerContainer(deployment.container_id, log);
  }

  await removeRoute(deployment.subdomain);
  deployment.status = 'stopped';
  await deployment.save();
  project.status = 'stopped';
  await project.save();
  await log('Deployment stopped');
  return deployment;
}

module.exports = {
  runDeploymentPipeline,
  stopDeployment,
  allocatePort,
  appendLog,
  detectStack,
  imageTag,
  containerName,
};
