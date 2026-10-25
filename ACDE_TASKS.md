# ACDE — Automated Cloud Deployment Engine
## IGNOU MCSP-232 Project Task Tracker
**Student:** Sahil Aggarwal (2500675011) · **Guide:** Aishwariya Singh

---

> [!IMPORTANT]
> Scope of this task file: **Node.js backend/orchestrator** and **plain HTML slide pages** only.
> React frontend (Vite) and Kubernetes/Docker infra config are tracked separately if needed.

---

## Project Overview

ACDE is a containerised Platform-as-a-Service (PaaS) that converts a Git repository URL into a live, port-mapped web application via a Docker/Kubernetes pipeline, managed through a Node.js + Express API with real-time SSE log streaming.

```
acde/
  backend/       Node.js + Express API (port 4000)
  frontend/      React + Vite dashboard (port 5173)  <- out of scope here
  nginx/         Nginx conf.d routes
  k8s/           Kubernetes manifests
  samples/       hello-app demo project
  workspace/     Runtime clone/build scratch space
IgnouProject/
  Slide01-17.html   Synopsis presentation slides
  snapshots/        PNG renders of each slide
```

---

## Phase 1 — Backend Foundations (Node.js)

### 1.1 Auth Routes — `backend/src/routes/auth.js`
- [ ] `POST /api/auth/register` — hash password with bcryptjs, create User doc, return JWT
- [ ] `POST /api/auth/login` — verify credentials, sign JWT with `JWT_SECRET`
- [ ] Input validation via `express-validator` on both routes
- [ ] Unit test: **TC-01** Valid login → JWT (in `backend/test/`)

### 1.2 Project Routes — `backend/src/routes/projects.js`
- [ ] `GET  /api/projects` — list projects owned by authenticated user
- [ ] `POST /api/projects` — create project; validate `git_repo_url` format
  - [ ] Reject invalid/unreachable URLs → **TC-02**
- [ ] `GET  /api/projects/:id` — return project + latest deployment + last 100 log lines
- [ ] `POST /api/projects/:id/deploy` — trigger `runDeploymentPipeline()` async; return 202
  - [ ] Pipeline starts and writes logs → **TC-03 / TC-04**
- [ ] `POST /api/projects/:id/stop` — call `stopDeployment()`
- [ ] `GET  /api/projects/:id/logs/stream` — SSE endpoint streaming from `logBus`
- [ ] Ownership guard (auth middleware + project.owner check) → **TC-05**

### 1.3 Dashboard Route — `backend/src/routes/dashboard.js`
- [ ] `GET /api/dashboard` — counts (total projects, deployed, failed, stopped) + system health
- [ ] Check Docker daemon reachability (`docker info`)
- [ ] Check Kubernetes reachability if `DEPLOY_MODE=k8s`

### 1.4 Orchestrator — `backend/src/services/orchestrator.js`
- [ ] `detectStack(repoDir)` — returns `dockerfile | node | static`
- [ ] `defaultDockerfile(stack)` — generates Dockerfile for `node` or `static` (nginx:alpine)
- [ ] `ensureDockerfile()` — write only if missing; log `Generated default Dockerfile`
- [ ] `cloneRepo()` — support:
  - [ ] Public HTTPS git URLs (via `simple-git`)
  - [ ] Local absolute paths (via `cp -a`) — for offline/demo
  - [ ] `file://` prefix stripping
- [ ] `buildImage()` — `docker build -t <tag> .` with streamed stdout/stderr logs
- [ ] `inferContainerPort()` — read `pkg.acde.port` → fallback `3000`; `static` → `80`
- [ ] `deployDocker()` — `docker run -d --restart unless-stopped -p HOST:CONTAINER`
- [ ] `deployK8s()` — render YAML manifest, `kubectl apply -f`, fallback to Docker on error
- [ ] `stopDockerContainer()` — `docker rm -f <name>` (silent if not found)
- [ ] `stopDeployment()` — stop K8s or Docker, call `removeRoute()`, update DB status
- [ ] `runDeploymentPipeline()` — full pipeline: Clone → Build → Deploy → Proxy → DB update

### 1.5 Proxy Manager — `backend/src/services/proxy.js`
- [ ] `upsertRoute(subdomain, port)` — write `nginx/conf.d/<subdomain>.conf` snippet
- [ ] `removeRoute(subdomain)` — delete the conf file
- [ ] `liveUrl(subdomain, port)` — return `http://127.0.0.1:<port>` or subdomain URL
- [ ] `nginx -s reload` via `NGINX_RELOAD_CMD` env (skip if empty)

### 1.6 Port Allocator — `backend/src/services/ports.js`
- [ ] `allocatePort()` — find next free port in `[PORT_RANGE_START, PORT_RANGE_END]`
- [ ] Skip ports already in use by running containers

### 1.7 Models — `backend/src/models/`
- [ ] `User.js` — `{ email, password_hash, created_at }`
- [ ] `Project.js` — `{ owner, name, git_repo_url, tech_stack, status, created_at }`
  - Status enum: `idle | building | deployed | failed | stopped`
- [ ] `Deployment.js` — `{ project, subdomain, assigned_port, container_id, image_tag, mode, status, live_url, created_at }`
  - Mode enum: `docker | k8s`
- [ ] `Log.js` — `{ deployment_id, log_message, created_at }`

### 1.8 Middleware — `backend/src/middleware/`
- [ ] `auth.js` — JWT verify middleware, attach `req.user`
- [ ] Error handler (global, in `index.js`)

### 1.9 Config — `backend/src/config.js`
- [ ] Read all env vars with sane defaults:
  - `MONGO_URI`, `JWT_SECRET`, `PORT` (4000), `DEPLOY_MODE` (docker)
  - `PORT_RANGE_START` (3100), `PORT_RANGE_END` (3999)
  - `NGINX_CONF_DIR`, `NGINX_RELOAD_CMD`, `BASE_DOMAIN`, `FRONTEND_ORIGIN`
  - `WORKSPACE_DIR`, `K8S_NAMESPACE`

### 1.10 Utilities — `backend/src/utils/`
- [ ] `logBus.js` — in-memory EventEmitter keyed by `deploymentId`; `emitLog()` + `subscribe()`
- [ ] `process.js` — `runCommand(cmd, args, opts)` wrapping `child_process.spawn`; streams stdout/stderr via callbacks

---

## Phase 2 — Test Suite (Node.js built-in `--test`)

File: `backend/test/*.test.js`

| ID | Test Case | Status |
|----|-----------|--------|
| TC-01 | Valid login → 200 + JWT token returned | ☐ |
| TC-02 | Invalid Git URL rejected with 400 | ☐ |
| TC-03 | Deploy endpoint starts pipeline (status 202) | ☐ |
| TC-04 | Build logs appear in DB / SSE stream | ☐ |
| TC-05 | Accessing another user's project returns 403 | ☐ |

Run with:
```bash
cd acde/backend && npm test
```

---

## Phase 3 — Samples / Demo App (Node.js)

### `samples/hello-app/`
- [ ] `server.js` — minimal `http.createServer` or Express server, responds `Hello from ACDE!`
- [ ] `package.json` — `{ "scripts": { "start": "node server.js" } }`, no extra deps
- [ ] `Dockerfile` (optional) — or rely on auto-generated one via `detectStack()`
- [ ] Confirm: local-path deploy via UI works end-to-end

---

## Phase 4 — HTML Slide Deck (plain HTML pages)

All slides live in `IgnouProject/Slide0X.html`. Each is a self-contained 1280x720 px slide.
Shared design tokens (already implemented):
- Background: `#0f172a`, Accent: `#3b82f6` (blue-500), Font: Inter
- Grid overlay via `::before` pseudo-element
- All decorative blob/circle divs hidden via shared CSS block

### Slide Status

| File | Title | Status |
|------|-------|--------|
| Slide01.html | Cover — ACDE + student/guide details | Done |
| Slide02.html | Introduction & Problem Statement | Done |
| Slide03.html | Objectives | Done |
| Slide04.html | System Architecture / DFD Level 0 | Done |
| Slide05.html | DFD Level 1 | Done |
| Slide06.html | DFD Level 2 | Done |
| Slide07.html | ER Diagram | Done |
| Slide08.html | Technology Stack Details | Done |
| Slide09.html | Deployment Pipeline Flow | Done |
| Slide10.html | Security Architecture | Done |
| Slide11.html | System Requirements | Done |
| Slide12.html | API Design / Endpoints | Done |
| Slide13.html | Database Schema | Done |
| Slide14.html | Implementation Plan / Gantt | Done |
| Slide15.html | (missing — check if intentionally skipped) | Missing |
| Slide16.html | Test Cases | Done |
| Slide17.html | Conclusion / Future Scope | Done |

### Slide Tasks
- [ ] Verify all slides render correctly at 1280x720 in browser
- [ ] Confirm Slide15 — is it needed? (Budget / Risk slide?)
- [ ] Cross-check all slides share the unified background CSS (already patched in Slide01)
- [ ] Apply the shared background patch to Slide02–17 if not already present
- [ ] Export final snapshots to `snapshots/` folder (Puppeteer script or browser screenshot)

---

## Phase 5 — Integration & End-to-End Verification

- [ ] Start MongoDB + backend + frontend; deploy `samples/hello-app` via UI
- [ ] Verify SSE log stream shows real-time Docker build output
- [ ] Verify live URL `http://127.0.0.1:<port>` is accessible after deploy
- [ ] Verify Stop button removes Nginx route and kills container
- [ ] Run full test suite (`npm test`) — all 5 TCs pass
- [ ] `docker compose up --build` — backend + MongoDB + Nginx run cleanly

---

## Quick Commands

```bash
# Backend (dev watch)
cd acde/backend && npm run dev

# Frontend
cd acde/frontend && npm run dev

# Tests
cd acde/backend && npm test

# Docker Compose (full stack)
cd acde && docker compose up --build

# Sample app deploy path (paste in UI)
/home/whistlewithme/Downloads/fretron/Scripts/IgnouProject/acde/samples/hello-app
```

---

## File Reference Map

| Symbol | File |
|--------|------|
| API entry | backend/src/index.js |
| Config | backend/src/config.js |
| Orchestrator | backend/src/services/orchestrator.js |
| Port allocator | backend/src/services/ports.js |
| Proxy manager | backend/src/services/proxy.js |
| Auth routes | backend/src/routes/auth.js |
| Project routes | backend/src/routes/projects.js |
| Dashboard route | backend/src/routes/dashboard.js |
| Root README | acde/README.md |
| Slides | IgnouProject/Slide01–17.html |

---

*Last updated: 2026-10-15*
