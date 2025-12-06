# GitHub Container Registry Setup

This document explains how Musivault uses GitHub Container Registry (GHCR) for Docker image distribution.

## Overview

Musivault uses GitHub Actions to automatically build and publish Docker images to GitHub Container Registry. This means:

✅ **Users don't need to build images locally** - just pull pre-built images  
✅ **Faster deployment** - no compilation time needed  
✅ **Consistent builds** - same image for everyone  
✅ **Multi-architecture support** - Works on both amd64 and arm64 (Apple Silicon)

## How It Works

### Automated Builds

Every time code is pushed to `main` or a release is created:

1. GitHub Actions automatically runs
2. Builds both frontend and backend Docker images
3. Publishes them to `ghcr.io/jeanball/musivault/`
4. Tags them appropriately (latest, version, commit SHA)

### Image Locations

```
ghcr.io/jeanball/musivault/backend:latest
ghcr.io/jeanball/musivault/frontend:latest
```

## For End Users (Deployment)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/jeanball/musivault.git
cd musivault

# Configure environment
cp .env.example .env
nano .env  # Add your Discogs API keys

# Pull and start (images downloaded automatically)
docker-compose pull
docker-compose up -d
```

No build step required! Images are pulled from GHCR.

### Using Specific Versions

```yaml
# docker-compose.yml
services:
  backend:
    image: ghcr.io/jeanball/musivault/backend:v1.2.3  # Specific version
    # or
    image: ghcr.io/jeanball/musivault/backend:main-abc123  # Specific commit
```

## For Developers (Local Development)

Use `docker-compose.dev.yml` for local development with live builds:

```bash
# Build and run locally
docker-compose -f docker-compose.dev.yml up --build

# Or for faster iteration
docker-compose -f docker-compose.dev.yml up
```

This uses local `build:` directives instead of pre-built images.

## GitHub Actions Workflow

Located at `.github/workflows/docker-publish.yml`

### Triggers

- **Push to main**: Builds and tags as `latest`
- **Pull requests**: Builds but doesn't push (for testing)
- **Release/Tags**: Builds and tags with version number

### Features

- ✅ Matrix build (builds backend and frontend in parallel)
- ✅ Multi-architecture (amd64 + arm64)
- ✅ Build caching (faster subsequent builds)
- ✅ Automatic tagging (latest, version, SHA)
- ✅ Metadata extraction

### Image Tags

| Trigger | Tags Created |
|---------|-------------|
| Push to main | `latest`, `main-<sha>` |
| Tag `v1.2.3` | `v1.2.3`, `1.2`, `latest` |
| Pull request | Built but not pushed |

## Making Images Public

By default, GHCR images are private. To make them public:

1. Go to repository packages: https://github.com/jeanball?tab=packages
2. Click on `musivault/backend` or `musivault/frontend`
3. Click "Package settings"
4. Scroll to "Danger Zone"
5. Click "Change visibility" → "Public"
6. Repeat for both backend and frontend packages

This allows anyone to pull the images without authentication.

## Troubleshooting

### Cannot pull images

If users get "permission denied" errors:

```bash
# Login to GHCR (only needed for private repos)
docker login ghcr.io -u USERNAME
# Use a GitHub Personal Access Token as password
```

Or make the packages public (see above).

### Images not updating

Check the GitHub Actions tab for build status:
https://github.com/jeanball/musivault/actions

### Force pull latest

```bash
docker-compose pull  # Pull latest images
docker-compose down  # Stop old containers
docker-compose up -d # Start with new images
```

## CI/CD Best Practices

### Versioning Strategy

```bash
# Development
main → ghcr.io/jeanball/musivault/backend:latest

# Releases
v1.0.0 → ghcr.io/jeanball/musivault/backend:1.0.0
       → ghcr.io/jeanball/musivault/backend:1.0
       → ghcr.io/jeanball/musivault/backend:latest

# Feature testing
commit abc123 → ghcr.io/jeanball/musivault/backend:main-abc123
```

### Production Deployment

For production, pin to specific versions instead of `latest`:

```yaml
services:
  backend:
    image: ghcr.io/jeanball/musivault/backend:1.0.0  # Pinned version
```

This prevents unexpected updates.

## Resources

- [GitHub Container Registry Docs](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [GitHub Actions Docker Docs](https://docs.github.com/en/actions/publishing-packages/publishing-docker-images)
