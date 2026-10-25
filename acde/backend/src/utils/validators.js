const GIT_URL_RE =
  /^(https?:\/\/(www\.)?(github|gitlab|bitbucket)\.com\/[\w.-]+\/[\w.-]+(?:\.git)?\/?|git@[\w.-]+:[\w.-]+\/[\w.-]+(?:\.git)?)$/i;

function isLocalRepoPath(url) {
  const trimmed = String(url || '').trim();
  return (
    trimmed.startsWith('file://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../')
  );
}

function isValidGitUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.length > 500) return false;
  if (isLocalRepoPath(trimmed)) return true;
  return GIT_URL_RE.test(trimmed);
}

function sanitizeProjectName(name) {
  return String(name || '')
    .trim()
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .slice(0, 80);
}

function toSubdomain(projectName, projectId) {
  const base = String(projectName || 'app')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'app';
  const suffix = String(projectId).slice(-6).toLowerCase();
  return `${base}-${suffix}`;
}

module.exports = {
  isValidGitUrl,
  isLocalRepoPath,
  sanitizeProjectName,
  toSubdomain,
  GIT_URL_RE,
};
