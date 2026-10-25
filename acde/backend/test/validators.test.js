const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isValidGitUrl,
  sanitizeProjectName,
  toSubdomain,
} = require('../src/utils/validators');

describe('validators (TC-02 related)', () => {
  it('accepts valid GitHub HTTPS URLs', () => {
    assert.equal(
      isValidGitUrl('https://github.com/user/repo.git'),
      true
    );
  });

  it('rejects malformed Git URLs', () => {
    assert.equal(isValidGitUrl('not-a-repo'), false);
    assert.equal(isValidGitUrl('https://example.com/x'), false);
    assert.equal(isValidGitUrl(''), false);
  });

  it('accepts local paths for offline demos', () => {
    assert.equal(isValidGitUrl('/tmp/my-repo'), true);
    assert.equal(isValidGitUrl('file:///tmp/my-repo'), true);
  });

  it('sanitizes project names', () => {
    assert.equal(sanitizeProjectName(' Hello App! '), 'Hello App');
  });

  it('builds subdomain from name and id', () => {
    const sub = toSubdomain('Hello App', 'abc123def456');
    assert.match(sub, /^hello-app-def456$/);
  });
});
