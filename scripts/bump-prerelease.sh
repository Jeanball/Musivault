#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

VERSION_FILE="VERSION"
PACKAGE_JSON="package.json"
CHANGELOG_FILE="CHANGELOG.md"

# Usage: ./bump-prerelease.sh [beta|alpha|rc]
# If no argument: increments current prerelease number (beta.2 → beta.3)
# If argument provided: switches to that prerelease type (beta.2 → rc.1)

PRERELEASE_TYPE=${1:-""}

# Read current version
if [ ! -f "$VERSION_FILE" ]; then
    echo -e "${RED}❌ VERSION file not found${NC}"
    exit 1
fi

current=$(cat $VERSION_FILE | tr -d '\n')
echo -e "${YELLOW}📦 Current version: $current${NC}"

# Parse version - handle both stable (1.7.2) and prerelease (1.8.0-beta.2)
if [[ "$current" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)(-([a-zA-Z]+)\.([0-9]+))?$ ]]; then
    major="${BASH_REMATCH[1]}"
    minor="${BASH_REMATCH[2]}"
    patch="${BASH_REMATCH[3]}"
    current_type="${BASH_REMATCH[5]}"
    current_num="${BASH_REMATCH[6]}"
else
    echo -e "${RED}❌ Cannot parse version: $current${NC}"
    exit 1
fi

# Determine new version
if [ -z "$current_type" ]; then
    # Currently on stable version, start a new prerelease
    if [ -z "$PRERELEASE_TYPE" ]; then
        PRERELEASE_TYPE="beta"
    fi
    new_version="${major}.${minor}.$((patch + 1))-${PRERELEASE_TYPE}.1"
    prev_version="$current"
elif [ -n "$PRERELEASE_TYPE" ] && [ "$PRERELEASE_TYPE" != "$current_type" ]; then
    # Switching prerelease types (e.g., beta → rc)
    new_version="${major}.${minor}.${patch}-${PRERELEASE_TYPE}.1"
    prev_version="$current"
else
    # Increment current prerelease number
    new_num=$((current_num + 1))
    new_version="${major}.${minor}.${patch}-${current_type}.${new_num}"
    prev_version="$current"
fi

DATE=$(date +%Y-%m-%d)

echo -e "${GREEN}✨ New version: $new_version${NC}"

# Update VERSION file
echo "$new_version" > $VERSION_FILE
echo -e "${GREEN}✅ Updated VERSION file${NC}"

# Update package.json files
for pkg in "$PACKAGE_JSON" "frontend/package.json" "backend/package.json"; do
    if [ -f "$pkg" ]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/\"version\": \".*\"/\"version\": \"$new_version\"/" "$pkg"
        else
            sed -i "s/\"version\": \".*\"/\"version\": \"$new_version\"/" "$pkg"
        fi
        echo -e "${GREEN}✅ Updated $pkg${NC}"
    fi
done

# Generate changelog entry from commits since last tag
echo ""
echo -e "${BLUE}📝 Generating changelog entry...${NC}"

# Try to find last tag, fall back to last beta tag, or use all commits
PREV_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

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

# Check if there are any changes to add
if [ -z "$ADDED" ] && [ -z "$FIXED" ] && [ -z "$CHANGED" ]; then
    echo -e "${YELLOW}⚠️  No commits found since last tag. Adding placeholder entry.${NC}"
    ADDED="- Work in progress\n"
fi

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
    # Check if this version already exists in changelog
    if grep -q "## \[$new_version\]" "$CHANGELOG_FILE"; then
        echo -e "${YELLOW}⚠️  Version $new_version already in changelog, updating entry...${NC}"
        # Remove existing entry and add new one
        # This is complex, so we'll just warn and skip
        echo -e "${YELLOW}   Please manually update the changelog entry${NC}"
    else
        # Find the first version entry (## [x.x.x]) and insert before it
        awk -v entry="$CHANGELOG_ENTRY" '
        /^## \[/ && !inserted { 
            printf entry; 
            print ""; 
            inserted=1 
        }
        { print }
        ' "$CHANGELOG_FILE" > "${CHANGELOG_FILE}.tmp"
        
        mv "${CHANGELOG_FILE}.tmp" "$CHANGELOG_FILE"
        echo -e "${GREEN}✅ Updated CHANGELOG.md${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  CHANGELOG.md not found, skipping changelog update${NC}"
fi

# Copy files to frontend/public for What's New feature
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
echo -e "${GREEN}🎉 Prerelease version bumped successfully!${NC}"
echo -e "   ${YELLOW}$prev_version → $new_version${NC}"
echo ""
echo -e "Next steps:"
echo -e "  1. Review changes: ${YELLOW}git diff${NC}"
echo -e "  2. Edit CHANGELOG.md if needed"
echo -e "  3. Commit: ${YELLOW}git add . && git commit -m 'chore: bump version to $new_version'${NC}"
echo -e "  4. Push: ${YELLOW}git push${NC}"
