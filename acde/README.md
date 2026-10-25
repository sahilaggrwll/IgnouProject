# Automated Cloud Deployment Engine (ACDE)

IGNOU MCSP-232 project — a containerized Platform as a Service that turns a Git repository URL into a live web application.

**Student:** Sahil Aggarwal (2500675011)  
**Guide:** Aishwariya Singh

## What it does

1. Developer signs in (JWT + bcrypt)
2. Creates a project with a Git URL
3. Orchestrator clones → builds Docker image → deploys container (Docker or Kubernetes)
4. Proxy manager writes an Nginx route and allocates a host port
5. Dashboard streams build logs and shows the live URL

Matches the synopsis DFDs, ER diagram (Users / Projects / Deployments / Logs), and security layers.

## Stack

| Layer | Technology |
|-------|------------|
| Host | Ubuntu Linux |
| API | Node.js + Express |
| DB | MongoDB |
| Containers | Docker Engine |
| Orchestration | Kubernetes (optional, via minikube) |
| Proxy | Nginx (dynamic conf.d routes) |
| UI | React + Vite |

## Project layout

```
acde/
  backend/     Express API + orchestrator
  frontend/    React dashboard
  nginx/       Base nginx config + conf.d
  k8s/         Sample Kubernetes manifests
  samples/     hello-app demo source
  workspace/   Cloned repos during builds
```

## Prerequisites

- Node.js **18+** (Vite 5; Node 20+ also fine)
- MongoDB 6+ (local or Docker)
- Docker Engine
- Optional: minikube + kubectl for `DEPLOY_MODE=k8s`
- Optional: Nginx for subdomain routing on port 8080

## Quick start (local)

### 1. MongoDB

```bash
# If not already running:
sudo systemctl start mongod
# or
docker run -d --name acde-mongo -p 27017:27017 mongo:7
```

### 2. Backend

```bash
cd IgnouProject/acde/backend
cp .env.example .env   # already present as .env for local dev
npm install
npm start
```

API: `http://localhost:4000`

### 3. Frontend

```bash
cd IgnouProject/acde/frontend
npm install
npm run dev
```

UI: `http://localhost:5173`

### 4. Deploy a sample app

1. Register / login in the UI
2. **New Project** with:
   - Name: `hello-demo`
   - Git URL: absolute path to the sample, e.g.  
     `/home/whistlewithme/Downloads/fretron/Scripts/IgnouProject/acde/samples/hello-app`  
     (or any public `https://github.com/.../....git` URL)
3. Open the project → **Deploy**
4. Watch live build logs; open the **Live URL** (`http://127.0.0.1:<assigned_port>`)

## Docker Compose

Runs MongoDB, Nginx, and the API (Docker socket mounted for builds):

```bash
cd IgnouProject/acde
docker compose up --build
```

Then run the frontend locally (`npm run dev` in `frontend/`).

## Kubernetes mode

```bash
minikube start
# in backend/.env
DEPLOY_MODE=k8s
```

Restart the API. Builds still use Docker; images are applied with `kubectl`. If Kubernetes apply fails, the orchestrator falls back to Docker run.

## Environment variables

See [`backend/.env.example`](backend/.env.example):

| Variable | Purpose |
|----------|---------|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret |
| `DEPLOY_MODE` | `docker` or `k8s` |
| `PORT_RANGE_START/END` | Host ports for apps |
| `NGINX_CONF_DIR` | Where route snippets are written |
| `NGINX_RELOAD_CMD` | e.g. `nginx -s reload` (empty skips reload) |

## API overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login → JWT |
| GET | `/api/dashboard` | Counts + system health |
| GET/POST | `/api/projects` | List / create |
| GET | `/api/projects/:id` | Detail + logs |
| POST | `/api/projects/:id/deploy` | Start pipeline |
| POST | `/api/projects/:id/stop` | Stop container / remove route |
| GET | `/api/projects/:id/logs/stream` | SSE build logs |

## Tests (Slide 16 cases)

```bash
cd IgnouProject/acde/backend
npm test
```

Covers:

- **TC-01** Valid login → JWT
- **TC-02** Invalid Git URL rejected
- **TC-03/04** Deploy starts pipeline and writes logs
- **TC-05** Unauthorized project access denied

## Demo walkthrough (viva)

1. Show synopsis slides / ER diagram
2. Start MongoDB + API + frontend
3. Register, create project with sample path or public repo
4. Deploy and show streaming logs
5. Open live URL in browser
6. Optionally show generated Nginx conf under `nginx/conf.d/`
7. Stop / delete project

## Out of scope (v2 — Future Scope slide)

- GitHub/GitLab webhooks (true CI/CD)
- Auto-provisioned databases
- OAuth / SSH for private repos
- Prometheus / Grafana monitoring
