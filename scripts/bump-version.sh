#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BUMP_TYPE=${1:-patch}
VERSION_FILE="VERSION"
PACKAGE_JSON="package.json"

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

echo ""
echo -e "${GREEN}🎉 Version bumped successfully!${NC}"
echo -e "   ${YELLOW}$current → $new_version${NC}"
echo ""
echo -e "Next steps:"
echo -e "  1. Review changes: ${YELLOW}git diff${NC}"
echo -e "  2. Commit changes: ${YELLOW}git add VERSION package.json && git commit -m 'chore: bump version to $new_version'${NC}"
echo -e "  3. Create release: ${YELLOW}npm run release${NC}"
