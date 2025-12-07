#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

VERSION=$(cat VERSION)

echo -e "${BLUE}🚀 Starting release process for v$VERSION${NC}"
echo ""

# 1. Validate version format (SemVer)
if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$ ]]; then
    echo -e "${RED}❌ Invalid version format: $VERSION${NC}"
    echo "Must follow Semantic Versioning (X.Y.Z[-PRERELEASE][+BUILD])"
    exit 1
fi
echo -e "${GREEN}✅ Version format valid${NC}"

# 2. Ensure clean working directory
if [[ -n $(git status -s) ]]; then
    echo -e "${RED}❌ Working directory not clean${NC}"
    echo "Please commit or stash your changes before releasing:"
    git status -s
    exit 1
fi
echo -e "${GREEN}✅ Working directory clean${NC}"

# 3. Ensure on main branch
current_branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "$current_branch" != "main" ]]; then
    echo -e "${YELLOW}⚠️  Warning: You are on branch '$current_branch', not 'main'${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Release cancelled"
        exit 1
    fi
fi

# 4. Check if tag already exists
if git rev-parse "v$VERSION" >/dev/null 2>&1; then
    echo -e "${RED}❌ Tag v$VERSION already exists${NC}"
    echo "Please bump the version first: npm run version:patch|minor|major"
    exit 1
fi
echo -e "${GREEN}✅ Tag v$VERSION does not exist${NC}"

# 5. Pull latest changes
echo -e "${YELLOW}📥 Pulling latest changes...${NC}"
git pull origin "$current_branch"

# 6. Create git tag
echo -e "${YELLOW}🏷️  Creating git tag v$VERSION${NC}"
git tag -a "v$VERSION" -m "Release version $VERSION"

# 7. Push to remote
echo -e "${YELLOW}📤 Pushing to remote...${NC}"
git push origin "$current_branch"
git push origin "v$VERSION"

echo ""
echo -e "${GREEN}✅ Release v$VERSION completed successfully!${NC}"
echo ""
echo -e "Next steps:"
echo -e "  • GitHub Actions will build and publish Docker images"
echo -e "  • Check workflow: ${BLUE}https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions${NC}"
echo -e "  • Docker images will be available at:"
echo -e "    - ${YELLOW}ghcr.io/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/' | tr '[:upper:]' '[:lower:]')/backend:$VERSION${NC}"
echo -e "    - ${YELLOW}ghcr.io/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/' | tr '[:upper:]' '[:lower:]')/frontend:$VERSION${NC}"
