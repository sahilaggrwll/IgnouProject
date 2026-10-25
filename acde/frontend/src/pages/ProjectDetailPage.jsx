import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, getToken } from '../api';
import { StatusBadge } from '../components/Layout';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [deployment, setDeployment] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const logEndRef = useRef(null);
  const sourceRef = useRef(null);

  const load = useCallback(async () => {
    const data = await api.getProject(id);
    setProject(data.project);
    setDeployment(data.deployment);
    setLogs(data.logs || []);
  }, [id]);

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [load]);

  useEffect(() => {
    if (!deployment?.id) return undefined;

    if (sourceRef.current) {
      sourceRef.current.close();
    }

    const token = getToken();
    // EventSource cannot set Authorization headers; use query fallback via fetch stream proxy pattern:
    // We open SSE with fetch polyfill using cookie-less token in a custom EventSource-like approach.
    const controller = new AbortController();
    let cancelled = false;

    async function stream() {
      try {
        const res = await fetch(`/api/projects/${id}/logs/stream`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() || '';

          chunks.forEach((chunk) => {
            const line = chunk
              .split('\n')
              .find((l) => l.startsWith('data: '));
            if (!line) return;
            try {
              const payload = JSON.parse(line.slice(6));
              setLogs((prev) => {
                const next = [...prev, payload];
                return next.slice(-2000);
              });
            } catch {
              // ignore malformed
            }
          });
        }
      } catch {
        // aborted or network error
      }
    }

    stream();
    sourceRef.current = { close: () => controller.abort() };

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [deployment?.id, id]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Poll status while building
  useEffect(() => {
    if (!project || !['building', 'pending'].includes(project.status)) {
      return undefined;
    }
    const timer = setInterval(() => {
      load().catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [project, load]);

  async function handleDeploy() {
    setBusy('deploy');
    setError('');
    try {
      await api.deployProject(id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function handleStop() {
    setBusy('stop');
    setError('');
    try {
      await api.stopProject(id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this project and stop its deployment?')) return;
    setBusy('delete');
    try {
      await api.deleteProject(id);
      window.location.href = '/';
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  }

  if (!project && !error) return <div className="loading">Loading project…</div>;
  if (!project) return <div className="error-banner">{error}</div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{project.project_name}</h1>
          <p>{project.git_repo_url}</p>
        </div>
        <Link className="btn btn-secondary" to="/">
          Dashboard
        </Link>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="detail-grid">
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Deployment</h2>
          <div className="kv">
            <div className="kv-row">
              <span>Status</span>
              <StatusBadge status={project.status} />
            </div>
            <div className="kv-row">
              <span>Tech stack</span>
              <span>{project.tech_stack || 'auto'}</span>
            </div>
            <div className="kv-row">
              <span>Subdomain</span>
              <span>{deployment?.subdomain || '—'}</span>
            </div>
            <div className="kv-row">
              <span>Port</span>
              <span>{deployment?.assigned_port || '—'}</span>
            </div>
            <div className="kv-row">
              <span>Mode</span>
              <span>{deployment?.mode || '—'}</span>
            </div>
            <div className="kv-row">
              <span>Live URL</span>
              {deployment?.live_url ? (
                <a href={deployment.live_url} target="_blank" rel="noreferrer">
                  {deployment.live_url}
                </a>
              ) : (
                <span>—</span>
              )}
            </div>
          </div>

          <div className="actions-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleDeploy}
              disabled={busy === 'deploy' || project.status === 'building'}
            >
              {busy === 'deploy' || project.status === 'building'
                ? 'Deploying…'
                : deployment
                  ? 'Redeploy'
                  : 'Deploy'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleStop}
              disabled={!deployment || busy === 'stop' || project.status === 'stopped'}
            >
              Stop
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={busy === 'delete'}
            >
              Delete
            </button>
          </div>
        </section>

        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Build Logs</h2>
          <div className="log-panel">
            {logs.length === 0 ? (
              <div style={{ color: '#64748b' }}>
                No logs yet. Click Deploy to start the pipeline.
              </div>
            ) : (
              logs.map((entry, idx) => (
                <div className="log-line" key={`${entry.timestamp}-${idx}`}>
                  <span className="ts">
                    {entry.timestamp
                      ? new Date(entry.timestamp).toLocaleTimeString()
                      : ''}
                  </span>
                  {entry.log_message}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </section>
      </div>
    </>
  );
}
