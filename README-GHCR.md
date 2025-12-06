# GitHub Container Registry (GHCR) Setup

Musivault automatically publishes pre-built Docker images to GitHub Container Registry, making deployment faster and easier.

## Benefits

- ✅ **No local build needed** - Just pull and run
- ✅ **Multi-architecture** - Works on Intel/AMD (amd64) and Apple Silicon (arm64)
- ✅ **Automatic updates** - Images built on every commit to main
- ✅ **Version tags** - Pin to specific versions for stability

## Image Locations

```
ghcr.io/jeanball/musivault/backend:latest
ghcr.io/jeanball/musivault/frontend:latest
```

## Quick Start

Users can deploy with pre-built images:

```bash
git clone https://github.com/jeanball/musivault.git
cd musivault
cp .env.example .env
# Edit .env with your credentials
docker-compose pull
docker-compose up -d
```

## For Developers

Local development with live builds:

```bash
docker-compose -f docker-compose.dev.yml up --build
```

## Making Images Public

1. Go to https://github.com/jeanball?tab=packages
2. Click on the package (backend or frontend)
3. Settings → Change visibility → Public

This allows anyone to pull images without authentication.

## More Information

See [docs/GHCR.md](docs/GHCR.md) for complete documentation.
