#!/bin/bash
set -e

VERSION_FILE="VERSION"
PACKAGE_JSON="package.json"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Check VERSION file exists
if [ ! -f "$VERSION_FILE" ]; then
    echo -e "${RED}❌ VERSION file not found${NC}"
    exit 1
fi

# Read and validate VERSION
version=$(cat $VERSION_FILE)
if ! [[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$ ]]; then
    echo -e "${RED}❌ Invalid version in VERSION file: $version${NC}"
    echo "Must follow Semantic Versioning (X.Y.Z[-PRERELEASE][+BUILD])"
    exit 1
fi

# Check package.json if it exists
if [ -f "$PACKAGE_JSON" ]; then
    package_version=$(grep -o '"version": *"[^"]*"' $PACKAGE_JSON | grep -o '[0-9][^"]*')
    if [ "$version" != "$package_version" ]; then
        echo -e "${RED}❌ Version mismatch${NC}"
        echo "  VERSION file: $version"
        echo "  package.json: $package_version"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Version validation passed: $version${NC}"
exit 0
