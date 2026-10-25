import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { StatusBadge } from '../components/Layout';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.dashboard(), api.listProjects()])
      .then(([dash, list]) => {
        setData(dash);
        setProjects(list.projects || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading dashboard…</div>;
  if (error) return <div className="error-banner">{error}</div>;

  const counts = data?.counts || {};

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Deployment Dashboard</h1>
          <p>
            Mode: {data?.system?.deploy_mode || 'docker'} · Proxy port{' '}
            {data?.system?.proxy_port || 8080}
          </p>
        </div>
        <Link className="btn btn-primary" to="/projects/new">
          New Project
        </Link>
      </div>

      <div className="grid-stats">
        <div className="stat-card">
          <div className="label">Total</div>
          <div className="value">{counts.total || 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">Deployed</div>
          <div className="value" style={{ color: 'var(--success)' }}>
            {counts.deployed || 0}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Building</div>
          <div className="value" style={{ color: 'var(--warn)' }}>
            {counts.building || 0}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Failed</div>
          <div className="value" style={{ color: 'var(--danger)' }}>
            {counts.failed || 0}
          </div>
        </div>
      </div>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Projects</h2>
        {projects.length === 0 ? (
          <div className="empty-state">
            No projects yet. Create one and paste a public Git URL to deploy.
          </div>
        ) : (
          <div className="project-list">
            {projects.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="project-row"
              >
                <div className="project-name">{project.project_name}</div>
                <div className="project-meta">{project.git_repo_url}</div>
                <StatusBadge status={project.status} />
                <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                  {project.deployment?.live_url ? 'Live URL ready' : '—'}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
