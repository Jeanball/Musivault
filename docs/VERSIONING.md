# Musivault Versioning Strategy

## Overview

Musivault follows **Semantic Versioning 2.0.0** (SemVer) and uses automated tools to manage version bumps, releases, and Docker image tagging.

## Semantic Versioning

Format: `MAJOR.MINOR.PATCH[-PRE RELEASE][+BUILD]`

- **MAJOR**: Breaking/incompatible API changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)
- **PRERELEASE**: Optional (e.g., `alpha`, `beta`, `rc.1`)
- **BUILD**: Optional metadata (commit SHA, build date)

### Examples

```
1.0.0        # Initial release
1.1.0        # New feature added
1.1.1        # Bug fix
2.0.0        # Breaking change
2.1.0-beta.1 # Beta release
```

## Version Source of Truth

The **`VERSION`** file at the project root contains the current version:

```
1.0.0
```

All systems read from this file:
- Build scripts
- Backend API
- Frontend UI
- Docker images
- GitHub Actions

## Bumping Versions

### Automated Scripts

```bash
# Patch version (1.0.0 → 1.0.1)
npm run version:patch

# Minor version (1.0.1 → 1.1.0)
npm run version:minor

# Major version (1.1.0 → 2.0.0)
npm run version:major
```

These scripts:
1. Update `VERSION` file
2. Update `package.json`
3. Show next steps

### Manual Bump

Edit the `VERSION` file directly:

```bash
echo "1.2.0" > VERSION
```

## Release Process

### Automated Release (Recommended)

```bash
# 1. Bump version
npm run version:minor

# 2. Review changes
git diff

# 3. Commit
git add VERSION package.json
git commit -m "chore: bump version to 1.1.0"

# 4. Create release (creates tag and pushes)
npm run release
```

The `release` script:
1. Validates version format
2. Checks working directory is clean
3. Creates git tag (`v1.1.0`)
4. Pushes to remote
5. Triggers GitHub Actions to build Docker images

### Manual Release

```bash
git tag v1.1.0
git push origin v1.1.0
```

## Conventional Commits

Use conventional commit messages for automatic changelog generation:

```bash
# Features (minor bump)
git commit -m "feat: add user profile page"
git commit -m "feat(api): add version endpoint"

# Fixes (patch bump)
git commit -m "fix: resolve login timeout"
git commit -m "fix(ui): correct footer alignment"

# Breaking changes (major bump)
git commit -m "feat!: redesign authentication API"
git commit -m "BREAKING CHANGE: remove deprecated endpoints"

# Other types (no version bump)
git commit -m "docs: update README"
git commit -m "chore: update dependencies"
git commit -m "style: format code"
git commit -m "refactor: simplify auth logic"
```

## Version Exposure

### Backend API

**`GET /api/version`**

```json
{
  "version": "1.0.0",
  "buildDate": "2024-01-06T12:00:00.000Z",
  "commitSha": "abc1234",
  "environment": "production"
}
```

**`GET /api/health`**

```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2024-01-06T12:00:00.000Z"
}
```

### Frontend UI

- **Footer**: Displays version number (e.g., "v1.0.0")
- **Settings Page**: Full version card with:
  - Version number
  - Build date
  - Commit SHA
  - Environment

### Docker Images

Version metadata in image labels:

```bash
docker inspect ghcr.io/jeanball/musivault/backend:1.0.0

# Labels:
# version=1.0.0
# commit=abc1234567890
# build_date=2024-01-06T12:00:00.000Z
```

## Docker Image Tags

### Tag Strategy

| Source | Tags Applied |
|--------|-------------|
| Push to `main` | `latest`, `main-abc1234` |
| Tag `v1.2.3` | `1.2.3`, `1.2`, `1`, `latest` |
| Pull request | Built but not pushed |

### Pulling Specific Versions

```yaml
# Production: Pin to specific version
services:
  backend:
    image: ghcr.io/jeanball/musivault/backend:1.2.3

# Development: Use latest
services:
  backend:
    image: ghcr.io/jeanball/musivault/backend:latest
```

## Branching Strategy

### Main Branch

- Always deployable
- Protected (requires PR)
- Version in `VERSION` file = next release

### Feature Branches

```bash
git checkout -b feature/user-profiles
# Work on feature
git commit -m "feat: add user profile page"
# Create PR to main
```

### Hotfixes

```bash
# Create hotfix branch from tag
git checkout -b hotfix/1.0.1 v1.0.0

# Fix the bug
git commit -m "fix: critical security issue"

# Bump version
echo "1.0.1" > VERSION

# Release
npm run release

# Merge back to main
git checkout main
git merge hotfix/1.0.1
```

## CI/CD Integration

### GitHub Actions

Workflow: `.github/workflows/docker-publish.yml`

**Triggers:**
- Push to `main` → Build `latest`
- Push tag `v*` → Build versioned images
- Pull request → Build for testing (no push)

**Build Process:**
1. Checkout code
2. Read `VERSION` file
3. Build Docker images with version build args
4. Tag with version + metadata
5. Push to GHCR

### Version Build Args

Docker images built with:

```dockerfile
ARG VERSION=1.0.0
ARG COMMIT_SHA=abc1234
ARG BUILD_DATE=2024-01-06T12:00:00.000Z
```

Available in containers:
- Backend: `process.env.COMMIT_SHA`, `VERSION` constant
- Docker labels: `version`, `commit`, `build_date`

## Best Practices

### DO

✅ Bump version before merging breaking changes  
✅ Use conventional commits for clear history  
✅ Pin Docker images to specific versions in production  
✅ Test release process in staging first  
✅ Document breaking changes in commit messages

### DON'T

❌ Edit VERSION file without committing  
❌ Skip version bump for public releases  
❌ Use `latest` tag in production  
❌ Push tags for unreleased code

## Troubleshooting

### Version Mismatch

If `VERSION` and `package.json` differ:

```bash
npm run validate:version
```

### Failed Release

If `npm run release` fails:

```bash
# Check git status
git status

# Verify VERSION format
cat VERSION

# Manually create tag
git tag v1.0.0
git push origin v1.0.0
```

### Wrong Docker Image Version

```bash
# Check what version was built
docker inspect ghcr.io/jeanball/musivault/backend:latest | grep version

# Pull specific version
docker pull ghcr.io/jeanball/musivault/backend:1.0.0
```

## Resources

- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Keep a Changelog](https://keepachangelog.com/)
