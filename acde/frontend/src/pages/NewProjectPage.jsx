import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function NewProjectPage() {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api.createProject({
        project_name: projectName,
        git_repo_url: gitRepoUrl,
      });
      navigate(`/projects/${data.project.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>New Project</h1>
          <p>Validate a Git repository URL and store project configuration.</p>
        </div>
        <Link className="btn btn-secondary" to="/">
          Back
        </Link>
      </div>

      <section className="panel" style={{ maxWidth: 640 }}>
        {error ? <div className="error-banner">{error}</div> : null}
        <form className="form-stack" onSubmit={onSubmit}>
          <label>
            Project name
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              required
              minLength={2}
              placeholder="my-web-app"
            />
          </label>
          <label>
            Git repository URL
            <input
              value={gitRepoUrl}
              onChange={(e) => setGitRepoUrl(e.target.value)}
              required
              placeholder="https://github.com/user/repo.git"
            />
          </label>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.88rem' }}>
            Public GitHub, GitLab, or Bitbucket HTTPS/SSH URLs are accepted.
            For a local demo, you can host the included sample app on GitHub or
            push it to a remote first.
          </p>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Create project'}
          </button>
        </form>
      </section>
    </>
  );
}
