# Changelog

All notable changes to Musivault will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [1.9.0] - 2026-01-17

### Added
- feat: Add develop branch triggers, prerelease version detection, refined Docker image tagging, and build summary.
- feat: Allow dynamic image tagging for backend and frontend services in docker-compose.
- feat: Display application release channel in the footer by exposing it via the version API.
- feat: display release channel alongside version number in settings page
- feat: Add wide screen mode user preference with UI toggle and backend support to adjust content width.
- ci: Remove linux/arm64 from default Docker build platforms.
- feat: add internationalization (i18n) support with initial DE, EN, and FR translations and instructions.
- feat: introduce multi-language support and add a language selector in settings
- feat: implement internationalization across various frontend pages and components by replacing hardcoded strings with translation keys and updating locale files.
- feat: Add user language preference setting and persistence across frontend and backend.
- feat: Add authentication check and redirection to PublicLayout, displaying a loading spinner during verification.
- style: Enhance UI with Lucide icons for navigation and 'Made with' text, and streamline locale strings.
- feat: Implement user profile management including display name and email, and refactor settings page with tabbed navigation.
- feat: Add condition grading for collection items including user preferences and dedicated UI.
- feat: add support for importing media and sleeve conditions and update the CSV template
- feat: Add Discogs lookup by ID and catalog number with new UI and API endpoint.
- feat: Implement manual album creation with cover upload, persistent storage, and a centralized image URL utility.
- feat: Refactor database migration and cleanup scripts for modularity and integrate them into the server.
- feat: Implement secure entrypoint for permission management and switch backend volumes to bind mounts.
- shareId` and apply minor UI adjustments.
- feat: Improve mobile search UI by replacing tabs with a dropdown and using shorter input placeholders, with corresponding localization updates.
- feat: Allow customization of OIDC login/signup button text by dynamically displaying the provider name from environment variables.
- feat: update README with new features, OIDC environment variables, and refined setup instructions.

### Changed
- refactor: Centralize Discogs API logic, types, and utilities into dedicated files, consolidate search endpoints, and update frontend usage.
- refactor: replace inline SVG icons with lucide-react components across various UI elements.
- refactor: split settings components, refactor authentication, middleware, file structure and convention name
- refactor: Update type import paths and add Vite build chunking configuration.
- refactor: Replace VersionsPage with MasterPage for the master route.
- refactor: Add non-null assertion for album discogsId in migration script.
- refactor: simplify log directory path resolution and reuse Album model in migration script.
- refactor: update 'or' divider translation key to `common.or` in login and signup pages

### Fixed
- fix: resolve login redirection and headers already sent error

---


## [1.8.0] - 2025-12-31

### Added
- OIDC/SSO single sign-on support
- Unified search for albums and artists with side-by-side results
- "What's New" modal showing release notes on version updates
- Success modal after adding album with "View Album" / "Continue Searching" options
- Format details display on album detail page (vinyl color, LP, Album, Limited Edition)
- Migration script for backfilling format details from Discogs
- Dynamic greeting on home page based on time of day
- Artist name cleanup script to remove Discogs numbering suffixes
- Collection data centralized via React Context
- Exclude digital-only releases/versions, add cassette and country filtering
- Remove digital format options from collection
- Enhanced album detail display with badges
- Back button to the public collection header
- Track artist data to models, Discogs import, and UI display
- Collection search by track name
- Toggleable 'Tracks' view in collection alongside 'Albums' view with track aggregation

### Changed
- Admin dashboard: "Last Login" replaced with "Last Added" (album)
- Album detail page: Record Label moved below artist name
- Album detail page: Genres and Format Details displayed side by side
- Removed landing page, defaulting to login route
- Persist collection layout and artist album sort preferences
- Auto-focus search bar and improved responsive styling
- Replace static home link with dynamic back navigation
- Improved public collection header layout with flexbox

### Fixed
- Scroll to top when navigating to album detail page
- Placeholder image path for Freshly Added section (now uses SVG)
- VERSION file served correctly by Vite dev server

---


## [1.7.2] - 2025-12-21

### Added
- feat: add album tracklist and label fields, including migration script and UI support
- feat: Introduce Discover page and API to list users with public collections.

### Fixed
- fix: add Discover page placeholder, consolidate migration scripts

---

## [1.7.1] - 2025-12-21

### Added
- feat: add album tracklist and label fields, including migration script and UI support
- feat: Introduce Discover page and API to list users with public collections.

### Fixed
- fix: add Discover page placeholder, consolidate migration scripts

---

## [1.7.0] - 2025-12-20

### Added
- Support for Release ID and Catalog Number in CSV imports
- Direct Discogs lookup via `fetchByReleaseId()`
- Catalog number search via `searchByCatalogNumber()`
- Auto-detect format (Vinyl/CD) from Discogs data

### Changed
- Updated CSV template and UI for new import options

---


## [1.6.2] - 2025-12-19

### Fixed
- Make backend proxy host configurable for different deployment environments

---

## [1.6.1] - 2025-12-12

### Fixed
- Implement Discogs API rate limit error handling on frontend and backend
- Improve barcode search error responses

---

## [1.6.0] - 2025-12-12

### Added
- Barcode scanning functionality to search and add releases to collection

---

## [1.5.5] - 2025-12-12

### Added
- Enhanced admin page with user search
- Updated admin statistics
- Public collection link copying functionality
- Project screenshots and icon
- Updated README documentation

---

## [1.5.4] - 2025-12-12

### Changed
- Update Docker publish workflow triggers (release, PR, manual dispatch)
- Update Browserlist-db package in frontend

---

## [1.5.3] - 2025-12-12

### Added
- Style statistics to collection overview

### Changed
- Refactored stats display layout

---

## [1.5.2] - 2025-12-11

### Fixed
- Duplicate key error handling for rematch
- Rate limit error handling for rematch

### Added
- Discogs API rate limit handling
- Optimized frontend search in rematch modal
- Backend dev script

---

## [1.5.0] - 2025-12-11

### Added
- Style filter for collection
- Session persistence
- DRY collection refactoring

---

## [1.4.0] - 2025-12-11

### Added
- Rematch feature to re-match albums with different Discogs releases
- Robust rematch search with Vitest tests (9 test cases)
- Test:run and test scripts to package.json

### Fixed
- Unsafe master fallback in RematchModal (prevents 404 errors)

### Changed
- Reorganized album detail page buttons for better UX
- Configured Vitest with jsdom environment

---

## [1.3.0] - 2025-12-10

### Added
- Share collection with other users (public collections)
- Last login tracking for users
- Admin ability to change user passwords

### Fixed
- Mobile: Filters (Format, Decade, Added) now display vertically
- Mobile: Reset password design improvements
- Mobile: Easier album version selection

### Changed
- Ability to change format in album detail view

---

## [1.2.0] - 2025-12-09

### Added
- Progress bar for CSV import
- Manual trigger for CI workflow
- Dockerignore optimization

### Fixed
- Timeout issue on large imports

---

## [1.1.1] - 2025-12-08

### Fixed
- User permission issue with logs file
- Docker-compose.dev.yml for local environment testing
- Created logs folder with proper access permissions

---

## [1.1.0] - 2025-12-08

### Added
- CSV import matching rules for accurate Discogs album matching
- Import log files saved locally and downloadable
- Volume mount for backend Docker logs

### Fixed
- Footer display on mobile
- Modal behavior when clicking on an album

---

## [1.0.0] - 2025-12-08

### Added
- Initial release of Musivault
- Music collection management
- Discogs API integration
- User authentication and authorization
- Admin dashboard
- CSV import functionality
- PWA support with offline capabilities
- Docker deployment with GitHub Container Registry
- Theme customization (dark/light modes)
- Album search and browsing
- Collection statistics and filtering

---

[Unreleased]: https://github.com/Jeanball/Musivault/compare/v1.9.0...HEAD
[1.9.0]: https://github.com/Jeanball/Musivault/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/Jeanball/Musivault/compare/v1.7.2...v1.8.0
[1.7.2]: https://github.com/Jeanball/Musivault/compare/v1.7.1...v1.7.2
[1.7.1]: https://github.com/Jeanball/Musivault/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/Jeanball/Musivault/compare/v1.6.2...v1.7.0
[1.6.2]: https://github.com/Jeanball/Musivault/compare/v1.6.1...v1.6.2
[1.6.1]: https://github.com/Jeanball/Musivault/compare/v1.6.0...v1.6.1
[1.6.0]: https://github.com/Jeanball/Musivault/compare/v1.5.5...v1.6.0
[1.5.5]: https://github.com/Jeanball/Musivault/compare/v1.5.4...v1.5.5
[1.5.4]: https://github.com/Jeanball/Musivault/compare/v1.5.3...v1.5.4
[1.5.3]: https://github.com/Jeanball/Musivault/compare/v1.5.2...v1.5.3
[1.5.2]: https://github.com/Jeanball/Musivault/compare/v1.5.0...v1.5.2
[1.5.0]: https://github.com/Jeanball/Musivault/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/Jeanball/Musivault/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/Jeanball/Musivault/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/Jeanball/Musivault/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/Jeanball/Musivault/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/Jeanball/Musivault/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Jeanball/Musivault/releases/tag/v1.0.0
