export function StatusBadge({ status }) {
  const value = status || 'pending';
  return <span className={`badge badge-${value}`}>{value}</span>;
}

export function Layout({ children, user, onLogout }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            ACDE
            <div>
              <span>Automated Cloud Deployment Engine</span>
            </div>
          </div>
        </div>
        <div className="topbar-actions">
          {user ? (
            <>
              <span style={{ color: 'var(--muted)', fontSize: '0.92rem' }}>
                {user.name}
              </span>
              <button type="button" className="btn btn-secondary" onClick={onLogout}>
                Logout
              </button>
            </>
          ) : null}
        </div>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
