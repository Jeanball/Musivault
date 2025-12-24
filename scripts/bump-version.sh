#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BUMP_TYPE=${1:-patch}
VERSION_FILE="VERSION"
PACKAGE_JSON="package.json"
CHANGELOG_FILE="CHANGELOG.md"

# Validate bump type
if [[ ! "$BUMP_TYPE" =~ ^(major|minor|patch)$ ]]; then
    echo -e "${RED}❌ Invalid bump type: $BUMP_TYPE${NC}"
    echo "Usage: $0 <major|minor|patch>"
    exit 1
fi

# Read current version
if [ ! -f "$VERSION_FILE" ]; then
    echo -e "${RED}❌ VERSION file not found${NC}"
    exit 1
fi

current=$(cat $VERSION_FILE)
echo -e "${YELLOW}📦 Current version: $current${NC}"

# Parse version
IFS='.' read -r major minor patch <<< "$current"

# Bump version based on type
case $BUMP_TYPE in
  major)
    major=$((major + 1))
    minor=0
    patch=0
    ;;
  minor)
    minor=$((minor + 1))
    patch=0
    ;;
  patch)
    patch=$((patch + 1))
    ;;
esac

new_version="$major.$minor.$patch"
DATE=$(date +%Y-%m-%d)

# Update VERSION file
echo "$new_version" > $VERSION_FILE
echo -e "${GREEN}✅ Updated VERSION file: $current → $new_version${NC}"

# Update package.json if it exists
if [ -f "$PACKAGE_JSON" ]; then
    # Use sed to update version in package.json
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/\"version\": \".*\"/\"version\": \"$new_version\"/" $PACKAGE_JSON
    else
        # Linux
        sed -i "s/\"version\": \".*\"/\"version\": \"$new_version\"/" $PACKAGE_JSON
    fi
    echo -e "${GREEN}✅ Updated package.json${NC}"
fi

# Update frontend/package.json
FRONTEND_PACKAGE="frontend/package.json"
if [ -f "$FRONTEND_PACKAGE" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/\"version\": \".*\"/\"version\": \"$new_version\"/" $FRONTEND_PACKAGE
    else
        sed -i "s/\"version\": \".*\"/\"version\": \"$new_version\"/" $FRONTEND_PACKAGE
    fi
    echo -e "${GREEN}✅ Updated frontend/package.json${NC}"
fi

# Update backend/package.json
BACKEND_PACKAGE="backend/package.json"
if [ -f "$BACKEND_PACKAGE" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/\"version\": \".*\"/\"version\": \"$new_version\"/" $BACKEND_PACKAGE
    else
        sed -i "s/\"version\": \".*\"/\"version\": \"$new_version\"/" $BACKEND_PACKAGE
    fi
    echo -e "${GREEN}✅ Updated backend/package.json${NC}"
fi

# Generate changelog entry from commits since last tag
echo ""
echo -e "${BLUE}📝 Generating changelog entry...${NC}"

PREV_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

# Get commits since last tag
if [ -z "$PREV_TAG" ]; then
    COMMITS=$(git log --format="%s" --reverse 2>/dev/null || echo "")
else
    COMMITS=$(git log --format="%s" ${PREV_TAG}..HEAD --reverse 2>/dev/null || echo "")
fi

# Categorize commits
ADDED=""
FIXED=""
CHANGED=""

while IFS= read -r commit; do
    # Skip noise
    [[ "$commit" =~ ^Merge ]] && continue
    [[ "$commit" =~ ^chore: ]] && continue
    [[ "$commit" =~ ^Revert ]] && continue
    [[ "$commit" =~ ^Reapply ]] && continue
    [[ -z "$commit" ]] && continue
    
    # Categorize by conventional commit prefix
    if [[ "$commit" =~ ^feat: ]] || [[ "$commit" =~ ^feat\( ]]; then
        clean=$(echo "$commit" | sed 's/^feat[:(][^)]*[)]*: *//')
        ADDED="${ADDED}- ${clean}\n"
    elif [[ "$commit" =~ ^fix: ]] || [[ "$commit" =~ ^fix\( ]]; then
        clean=$(echo "$commit" | sed 's/^fix[:(][^)]*[)]*: *//')
        FIXED="${FIXED}- ${clean}\n"
    elif [[ "$commit" =~ ^refactor: ]] || [[ "$commit" =~ ^perf: ]]; then
        clean=$(echo "$commit" | sed 's/^[a-z]*[:(][^)]*[)]*: *//')
        CHANGED="${CHANGED}- ${clean}\n"
    elif [[ "$commit" =~ ^docs: ]]; then
        clean=$(echo "$commit" | sed 's/^docs[:(][^)]*[)]*: *//')
        CHANGED="${CHANGED}- Documentation: ${clean}\n"
    else
        # Default to Added for non-conventional commits
        ADDED="${ADDED}- ${commit}\n"
    fi
done <<< "$COMMITS"

# Build the new changelog entry
CHANGELOG_ENTRY="## [$new_version] - $DATE\n"

if [ -n "$ADDED" ]; then
    CHANGELOG_ENTRY="${CHANGELOG_ENTRY}\n### Added\n${ADDED}"
fi

if [ -n "$CHANGED" ]; then
    CHANGELOG_ENTRY="${CHANGELOG_ENTRY}\n### Changed\n${CHANGED}"
fi

if [ -n "$FIXED" ]; then
    CHANGELOG_ENTRY="${CHANGELOG_ENTRY}\n### Fixed\n${FIXED}"
fi

CHANGELOG_ENTRY="${CHANGELOG_ENTRY}\n---\n"

# Update CHANGELOG.md
if [ -f "$CHANGELOG_FILE" ]; then
    # Create temp file with the new entry inserted after [Unreleased] section
    # Find the line with "---" after [Unreleased] and insert after it
    
    # Read the changelog and insert the new version after the Unreleased section
    awk -v entry="$CHANGELOG_ENTRY" '
    /^## \[Unreleased\]/ { unreleased=1 }
    unreleased && /^---$/ { 
        print; 
        print ""; 
        printf entry; 
        unreleased=0; 
        next 
    }
    { print }
    ' "$CHANGELOG_FILE" > "${CHANGELOG_FILE}.tmp"
    
    mv "${CHANGELOG_FILE}.tmp" "$CHANGELOG_FILE"
    
    # Update the version comparison links at the bottom
    # Add new version link and update Unreleased link
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|\[Unreleased\]: https://github.com/Jeanball/Musivault/compare/v${current}...HEAD|[Unreleased]: https://github.com/Jeanball/Musivault/compare/v${new_version}...HEAD\n[${new_version}]: https://github.com/Jeanball/Musivault/compare/v${current}...v${new_version}|" "$CHANGELOG_FILE"
    else
        sed -i "s|\[Unreleased\]: https://github.com/Jeanball/Musivault/compare/v${current}...HEAD|[Unreleased]: https://github.com/Jeanball/Musivault/compare/v${new_version}...HEAD\n[${new_version}]: https://github.com/Jeanball/Musivault/compare/v${current}...v${new_version}|" "$CHANGELOG_FILE"
    fi
    
    echo -e "${GREEN}✅ Updated CHANGELOG.md with new version entry${NC}"
else
    echo -e "${YELLOW}⚠️  CHANGELOG.md not found, skipping changelog update${NC}"
fi

# Copy VERSION and CHANGELOG.md to frontend/public for What's New feature
echo ""
echo -e "${BLUE}📋 Copying files for What's New feature...${NC}"
if [ -d "frontend/public" ]; then
    cp "$VERSION_FILE" "frontend/public/VERSION"
    cp "$CHANGELOG_FILE" "frontend/public/CHANGELOG.md"
    echo -e "${GREEN}✅ Copied VERSION and CHANGELOG.md to frontend/public/${NC}"
else
    echo -e "${YELLOW}⚠️  frontend/public not found, skipping copy${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Version bumped successfully!${NC}"
echo -e "   ${YELLOW}$current → $new_version${NC}"
echo ""
echo -e "Next steps:"
echo -e "  1. Review changes: ${YELLOW}git diff${NC}"
echo -e "  2. Edit CHANGELOG.md if needed (clean up auto-generated entries)"
echo -e "  3. Commit changes: ${YELLOW}git add VERSION package.json frontend/package.json backend/package.json CHANGELOG.md frontend/public/VERSION frontend/public/CHANGELOG.md && git commit -m 'chore: bump version to $new_version'${NC}"
echo -e "  4. Create release: ${YELLOW}npm run release${NC}"
